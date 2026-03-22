import fs from 'fs';
import path from 'path';
import os from 'os';

const ALIASES_PATH = path.join(os.homedir(), '.lens_aliases.json');
export interface AliasEntry {
  name: string;
  command: string;
}

export class AliasManager {
  private path: string;
  private aliases: AliasEntry[] = [];

  constructor(aliasPath = ALIASES_PATH) {
    this.path = aliasPath;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.path)) {
        const data = JSON.parse(fs.readFileSync(this.path, 'utf-8'));
        if (Array.isArray(data)) {
          this.aliases = data;
        }
      }
    } catch {}
  }

  private save(): void {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.aliases, null, 2), 'utf-8');
    } catch {}
  }

  list(): AliasEntry[] {
    return [...this.aliases];
  }

  add(name: string, command: string): void {
    // Remove existing alias with same name
    this.aliases = this.aliases.filter((a) => a.name !== name);
    this.aliases.push({ name, command });
    this.save();
  }

  remove(name: string): boolean {
    const before = this.aliases.length;
    this.aliases = this.aliases.filter((a) => a.name !== name);
    if (this.aliases.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  /** Expand an alias if the input starts with an alias name. */
  expand(input: string): string {
    const tokens = input.split(' ');
    const firstToken = tokens[0];
    const alias = this.aliases.find((a) => a.name === firstToken);
    if (alias) {
      return alias.command + (tokens.length > 1 ? ' ' + tokens.slice(1).join(' ') : '');
    }
    return input;
  }

  /** Get autocomplete suggestions for aliases. */
  getSuggestions(input: string): string[] {
    const trimmed = input.trim();
    return this.aliases
      .filter((a) => a.name.startsWith(trimmed) && a.name !== trimmed)
      .map((a) => `${a.name}: ${a.command}`)
      .slice(0, 5);
  }
}

export const aliasManager = new AliasManager();
