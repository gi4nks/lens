import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SLASH_COMMANDS = ['/help', '/clear', '/config', '/history', '/output', '/gpt', '/fix', '/alias'];

export class ContextParser {
  // Returns contextual hints/autocompletions based on the current input string
  static getHints(input: string, cwd: string): string[] {
    const str = input.trimLeft();
    if (!str) return SLASH_COMMANDS; // default suggestions

    if (str.startsWith('/')) {
      return SLASH_COMMANDS.filter((cmd) => cmd.startsWith(str) && cmd !== str);
    }

    // Autocomplete files/folders for the last token
    // If input ends with space, we're looking for ANY file in the current dir
    const tokens = input.split(' ');
    const lastToken = tokens[tokens.length - 1];

    try {
      let targetDir = cwd;
      let filePrefix = lastToken;

      if (lastToken.includes('/')) {
        const parts = lastToken.split('/');
        filePrefix = parts.pop() || '';
        const dirPart = parts.join('/');
        targetDir = path.resolve(cwd, dirPart);
      }

      if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
        const files = fs.readdirSync(targetDir);
        return files
          .filter((f) => {
             const startsWithPrefix = f.startsWith(filePrefix);
             const isHidden = f.startsWith('.');
             const isRequestedHidden = filePrefix.startsWith('.');
             
             // If user didn't start with '.', don't show hidden files
             if (!isRequestedHidden && isHidden) return false;
             
             return startsWithPrefix && f !== filePrefix;
          })
          .map((f) => {
             // Append slash to directories for better UX
             const fullPath = path.join(targetDir, f);
             try {
                if (fs.statSync(fullPath).isDirectory()) return f + '/';
             } catch {}
             return f;
          })
          .slice(0, 5); // Max 5 hints
      }
    } catch {
      // Ignore fs errors silently for UI
    }

    return [];
  }

  // Heuristic to detect if a command is a known shell executable or natural language
  static isShellCommand(input: string): boolean {
    const raw = input.trim();
    if (!raw) return true; // empty is shell
    
    // Commands that force NLP or internal
    if (raw.startsWith('/')) return true; 

    const firstWord = raw.split(' ')[0];
    const builtins = [
      'cd', 'ls', 'echo', 'rm', 'mkdir', 'git', 'npm', 'yarn', 'node', 'go', 'python',
      'cat', 'cp', 'mv', 'pwd', 'clear', 'bash', 'zsh', 'touch', 'docker', 'brew', 'sudo'
    ];

    if (builtins.includes(firstWord)) return true;
    if (firstWord.startsWith('./') || firstWord.startsWith('/')) return true;

    try {
      // Use standard UNIX which to see if it's in PATH
      const out = execSync(`which ${firstWord}`, { stdio: 'pipe', encoding: 'utf-8' });
      return out.trim().length > 0;
    } catch {
      // `which` exits with 1 if not found
      return false;
    }
  }
}
