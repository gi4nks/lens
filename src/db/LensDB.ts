import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';

export interface CommandRecord {
  id: number;
  command: string;
  output: string;
  exit_code: number;
  cwd: string;
  timestamp: number; // unix ms
}

const DB_PATH = path.join(os.homedir(), '.lens', 'history.db');

class LensDB {
  private db: Database.Database;

  constructor() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        command   TEXT    NOT NULL,
        output    TEXT    NOT NULL DEFAULT '',
        exit_code INTEGER NOT NULL DEFAULT 0,
        cwd       TEXT    NOT NULL DEFAULT '',
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_commands_timestamp ON commands(timestamp DESC);
    `);
  }

  append(record: Omit<CommandRecord, 'id'>) {
    this.db
      .prepare('INSERT INTO commands (command, output, exit_code, cwd, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(record.command, record.output, record.exit_code, record.cwd, record.timestamp);
  }

  // Returns the N most recent records, newest first
  recent(n = 200): CommandRecord[] {
    return this.db
      .prepare('SELECT * FROM commands ORDER BY timestamp DESC LIMIT ?')
      .all(n) as CommandRecord[];
  }

  // Full-text search on command string (simple LIKE, good enough for AI semantic layer on top)
  search(query: string, limit = 50): CommandRecord[] {
    return this.db
      .prepare('SELECT * FROM commands WHERE command LIKE ? ORDER BY timestamp DESC LIMIT ?')
      .all(`%${query}%`, limit) as CommandRecord[];
  }

  // Returns the output of the most recent execution of a specific command
  lastOutput(command: string): string | null {
    const row = this.db
      .prepare('SELECT output FROM commands WHERE command = ? ORDER BY timestamp DESC LIMIT 1')
      .get(command) as { output: string } | undefined;
    return row?.output ?? null;
  }
}

export const lensDB = new LensDB();
