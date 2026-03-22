import fs from 'fs';
import path from 'path';
import os from 'os';

const HISTORY_PATH = path.join(os.homedir(), '.lens_history.jsonl');
const SENSITIVE_RE = /key|token|password|secret|auth|apikey/i;

export interface HistoryRecord {
  timestamp: number;
  userInput: string;
  mode: 'shell' | 'ai' | 'nlp';
  modelResponse?: string;
  executedCommand?: string;
  exitCode?: number;
}

function isSensitive(cmd: string): boolean {
  if (cmd.startsWith(' ')) return true; // leading space = intentionally hidden (zsh convention)
  return SENSITIVE_RE.test(cmd);
}

function redact(record: HistoryRecord): HistoryRecord {
  const r = { ...record };
  if (r.userInput && isSensitive(r.userInput)) r.userInput = '[REDACTED]';
  if (r.executedCommand && isSensitive(r.executedCommand)) r.executedCommand = '[REDACTED]';
  return r;
}

export class HistoryManager {
  private path: string;

  constructor(historyPath = HISTORY_PATH) {
    this.path = historyPath;
  }

  append(record: Omit<HistoryRecord, 'timestamp'>): void {
    const full: HistoryRecord = { timestamp: Date.now(), ...record };
    const clean = redact(full);
    // Skip fully redacted shell commands (no point in logging "[REDACTED]")
    if (clean.userInput === '[REDACTED]') return;
    try {
      fs.appendFileSync(this.path, JSON.stringify(clean) + '\n', 'utf-8');
    } catch {}
  }

  /** Read the last N records efficiently without loading the whole file. */
  readLastN(n: number): HistoryRecord[] {
    if (n <= 0) return [];
    try {
      if (!fs.existsSync(this.path)) return [];
      const stat = fs.statSync(this.path);
      if (stat.size === 0) return [];

      // Heuristic: each record is ~300 bytes on average; read generously from the end
      const readBytes = Math.min(stat.size, n * 1024);
      const offset = stat.size - readBytes;

      const fd = fs.openSync(this.path, 'r');
      const buf = Buffer.alloc(readBytes);
      fs.readSync(fd, buf, 0, readBytes, offset);
      fs.closeSync(fd);

      const lines = buf.toString('utf-8').split('\n');
      // If we didn't start from the beginning the first line may be a partial record — skip it
      const start = offset > 0 ? 1 : 0;

      const records: HistoryRecord[] = [];
      for (let i = lines.length - 1; i >= start; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          records.unshift(JSON.parse(line));
          if (records.length >= n) break;
        } catch {}
      }
      return records;
    } catch {
      return [];
    }
  }

  loadCommandHistory(limit = 100): string[] {
    const records = this.readLastN(limit * 3); // over-fetch to get enough unique ones
    const seen = new Set<string>();
    const cmds: string[] = [];
    for (const r of records) {
      let cmd = r.executedCommand || r.userInput;
      if (cmd && cmd !== '[REDACTED]') {
        // Sanitize control chars that break ink rendering
        cmd = cmd.replace(/[\r\n]+/g, ' ').trim();
        if (!seen.has(cmd)) {
          seen.add(cmd);
          cmds.push(cmd);
        }
      }
    }
    return cmds.slice(-limit);
  }

  /**
   * One-time import from the native shell history file.
   * Called only when the lens history file does not yet exist.
   */
  bootstrapFromShell(): void {
    if (fs.existsSync(this.path)) return;

    const shell = process.env.SHELL || '';
    const home = os.homedir();
    let histPath = '';
    let parser: (lines: string[]) => string[];

    if (shell.includes('zsh')) {
      histPath = process.env.HISTFILE || path.join(home, '.zsh_history');
      parser = parseZshHistory;
    } else if (shell.includes('fish')) {
      histPath = path.join(home, '.local/share/fish/fish_history');
      parser = parseFishHistory;
    } else {
      histPath = path.join(home, '.bash_history');
      parser = parseBashHistory;
    }

    if (!fs.existsSync(histPath)) return;

    try {
      const raw = fs.readFileSync(histPath, 'utf-8');
      const cmds = parser(raw.split('\n')).slice(-200);
      const seen = new Set<string>();
      for (const cmd of cmds) {
        if (!cmd || seen.has(cmd) || isSensitive(cmd)) continue;
        seen.add(cmd);
        this.append({ userInput: cmd, mode: 'shell', executedCommand: cmd, exitCode: 0 });
      }
    } catch {}
  }
}

// ─── Shell history parsers ────────────────────────────────────────────────────

function parseZshHistory(lines: string[]): string[] {
  const cmds: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: ": timestamp:duration;command"
    const semi = trimmed.indexOf(';');
    if (semi !== -1 && trimmed.startsWith(':')) {
      cmds.push(trimmed.slice(semi + 1));
    } else {
      cmds.push(trimmed);
    }
  }
  return cmds;
}

function parseBashHistory(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

function parseFishHistory(lines: string[]): string[] {
  const cmds: string[] = [];
  for (const line of lines) {
    if (!line.trimStart().startsWith('- cmd:')) continue;
    const idx = line.indexOf('- cmd:');
    const cmd = line.slice(idx + 6).trim().replace(/^["']|["']$/g, '');
    if (cmd) cmds.push(cmd);
  }
  return cmds;
}

// Singleton
export const historyManager = new HistoryManager();
