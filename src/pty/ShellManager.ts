// @ts-expect-error node-pty typings issue
import * as pty from '@lydell/node-pty';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export class ShellManager extends EventEmitter {
  private ptyProcess: pty.IPty | null = null;
  public isRunning: boolean = false;
  public isBusy: boolean = false;

  start() {
    let shellFile = process.env.SHELL || '/bin/zsh';
    if (os.platform() === 'win32') shellFile = 'powershell.exe';

    const cleanEnv = { ...process.env };
    for (const key of Object.keys(cleanEnv)) {
      if (key.toLowerCase().startsWith('npm_')) {
        delete cleanEnv[key];
      }
    }

    let args: string[] = [];

    // Inject shell-specific initialization for CWD and Exit Code tracking
    if (shellFile.includes('zsh')) {
      const zdotdir = path.join(os.tmpdir(), 'lens-zsh');
      if (!fs.existsSync(zdotdir)) {
        fs.mkdirSync(zdotdir, { recursive: true });
      }
      const userZdotdir = process.env.ZDOTDIR || process.env.HOME;
      const zshrcContent = `
stty -echo -icrnl
export CLICOLOR=1
alias ls='ls -G -h'
alias grep='grep --color=auto'
if [ -f "${userZdotdir}/.zshrc" ]; then
  source "${userZdotdir}/.zshrc"
fi
export PS1=""
export PROMPT=""
export RPROMPT=""
# Force prompt off even if theme tries to set it
precmd_functions=( \${precmd_functions[@]} _lens_precmd )
_lens_precmd() { 
  export PS1=""
  export PROMPT=""
  printf '\\033]9001;exitCode=%d\\007' "$?"
}
chpwd() { printf '\\033]7;%s\\007' "$PWD"; }
stty -echo -icrnl
`;
      fs.writeFileSync(path.join(zdotdir, '.zshrc'), zshrcContent);
      cleanEnv['ZDOTDIR'] = zdotdir;
    } else if (shellFile.includes('bash')) {
      const bashrc = path.join(os.tmpdir(), 'lens-bashrc');
      const bashrcContent = `
stty -echo -icrnl
export CLICOLOR=1
alias ls='ls -G -h'
alias grep='grep --color=auto'
[ -f /etc/bash.bashrc ] && . /etc/bash.bashrc
[ -f ~/.bashrc ] && . ~/.bashrc
export PS1=""
_lens_prompt() {
  local exit_code=$?
  printf "\\033]7;%s\\007" "$PWD"
  printf "\\033]9001;exitCode=%d\\007" "$exit_code"
  export PS1=""
}
PROMPT_COMMAND="_lens_prompt"
stty -echo -icrnl
`;
      fs.writeFileSync(bashrc, bashrcContent);
      args = ['--rcfile', bashrc];
    } else if (shellFile.includes('fish')) {
      const fishInit = `
stty -echo -icrnl
set -gx CLICOLOR 1
alias ls 'ls -G -h'
alias grep 'grep --color=auto'
function fish_prompt; end
function fish_right_prompt; end
function fish_greeting; end
function _lens_post_exec --on-event fish_postexec
    set -l last_status $status
    printf "\\033]7;%s\\007" $PWD
    printf "\\033]9001;exitCode=%d\\007" $last_status
end
stty -echo -icrnl
`;
      args = ['-C', fishInit];
    }

    // Create the pseudo-terminal
    this.ptyProcess = pty.spawn(shellFile, args, {
      name: 'xterm-color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: process.cwd(),
      env: cleanEnv as Record<string, string>,
    });

    this.isRunning = true;

    this.ptyProcess.onData((data: string) => {
      // 1. Convert \r\n to \n, then convert standalone \r to nothing (prevents overlapping lines in Ink)
      // 2. Strip complex ANSI cursor escapes (A-K, etc), keeping only 'm' which are graphic Rendition (colors)
      let clean = data
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '')
        .replace(/\x1B\[[0-9;]*[A-KFGsu]/g, '')
        .replace(/\x1B\][^\x07]*\x07/g, ''); // Strip all OSC sequences (title, cwd, etc.)
      
      this.emit('data', clean);

      // Intercept OSC 7 (cwd) and OSC 9001 (exit code) before stripping
      // Note: use original 'data' because 'clean' removed OSCs
      // Stop on \x1b (ESC) to avoid bleeding into adjacent sequences; accept BEL or ST as terminator
      const oscCwdRegex  = /\x1b\]7;([^\x07\x1b]*)(?:\x07|\x1b\\)/g;
      const oscExitRegex = /\x1b\]9001;exitCode=(\d+)(?:\x07|\x1b\\)/g;
      let match: RegExpExecArray | null;
      while ((match = oscCwdRegex.exec(data))  !== null) {
        let rawCwd = match[1];
        if (rawCwd.startsWith('file://')) {
          try {
            // URL pathname on macOS might contain %20 etc.
            const url = new URL(rawCwd);
            rawCwd = decodeURIComponent(url.pathname);
          } catch {
            // Manual cleanup if URL is malformed
            rawCwd = rawCwd.replace(/^file:\/\/[^\/]+/, '');
            rawCwd = decodeURIComponent(rawCwd);
          }
        }
        // Strip any remaining control characters that might have leaked in
        rawCwd = rawCwd.replace(/[\x00-\x1f\x7f]/g, '');
        if (rawCwd) this.emit('cwd', rawCwd);
      }
      while ((match = oscExitRegex.exec(data)) !== null) {
        this.isBusy = false;
        this.emit('exitCode', parseInt(match[1], 10));
      }
    });

    this.ptyProcess.onExit(({ exitCode }: { exitCode: number; signal: number }) => {
      this.isRunning = false;
      this.isBusy = false;
      this.emit('exit', exitCode);
      // Restore alt screen safely just in case App crashes
      process.stdout.write('\x1b[?1049l');
      process.exit(exitCode);
    });
  }

  write(cmd: string) {
    if (this.ptyProcess && this.isRunning) {
      if (cmd.includes('\r')) {
        this.isBusy = true;
      }
      this.ptyProcess.write(cmd);
    }
  }

  sendSignal(signal: string) {
    if (this.ptyProcess && this.isRunning) {
       this.ptyProcess.write(signal);
    }
  }

  resize(cols: number, rows: number) {
    if (this.ptyProcess && this.isRunning) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  stop() {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.isRunning = false;
    }
  }
}
