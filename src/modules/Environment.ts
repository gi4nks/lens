import { execSync } from 'child_process';
import fs from 'fs';

export interface Module {
  symbol: string;
  text: string;
  color: string;
}

export class Environment {
  static getContextModules(): Module[] {
    const modules: Module[] = [];

    const git = this.getGitInfo();
    if (git) modules.push(git);

    const go = this.getGoModule();
    if (go) modules.push(go);

    const node = this.getNodeModule();
    if (node) modules.push(node);

    const py = this.getPythonModule();
    if (py) modules.push(py);

    const rust = this.getRustModule();
    if (rust) modules.push(rust);

    return modules;
  }

  private static safeExec(cmd: string): string | null {
    try {
      return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  static getGitInfo(): Module | null {
    const branch = this.safeExec('git branch --show-current');
    if (!branch) return null;

    const statusObj = this.safeExec('git status --short');
    const isDirty = statusObj ? statusObj.length > 0 : false;

    return {
      symbol: '',
      text: `${branch}${isDirty ? '*' : ''}`,
      color: '#F05032',
    };
  }

  static getGoModule(): Module | null {
    if (fs.existsSync('go.mod')) {
      const out = this.safeExec('go version');
      let version = 'unknown';
      if (out) {
        const parts = out.split(' ');
        if (parts.length >= 3) {
          version = parts[2].replace('go', '');
        }
      }
      return { symbol: '🐹', text: version, color: '#00ADD8' };
    }
    return null;
  }

  static getNodeModule(): Module | null {
    if (fs.existsSync('package.json')) {
      const out = this.safeExec('node --version');
      return { symbol: '🟢', text: out || 'unknown', color: '#339933' };
    }
    return null;
  }

  static getPythonModule(): Module | null {
    const isPy = ['requirements.txt', 'pyproject.toml', 'setup.py'].some(f => fs.existsSync(f));
    if (isPy) {
      const out = this.safeExec('python3 --version');
      let version = 'unknown';
      if (out) {
        const parts = out.split(' ');
        if (parts.length >= 2) {
          version = parts[1];
        } else {
          version = out;
        }
      }
      return { symbol: '🐍', text: version, color: '#3776AB' };
    }
    return null;
  }

  static getRustModule(): Module | null {
    if (fs.existsSync('Cargo.toml')) {
      const out = this.safeExec('rustc --version');
      let version = 'unknown';
      if (out) {
        const parts = out.split(' ');
        if (parts.length >= 2) {
          version = parts[1];
        }
      }
      return { symbol: '🦀', text: version, color: '#E57324' };
    }
    return null;
  }
}
