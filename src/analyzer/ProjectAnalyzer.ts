import fs from 'fs';
import path from 'path';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target',
  '.venv', 'venv', '.egg-info', '.tox', 'coverage', '.pytest_cache',
]);

const KEY_DIRS = ['src', 'cmd', 'internal', 'pkg', 'api', 'app', 'lib', 'core', 'bin'];

const SIGNATURES: Record<string, string[]> = {
  Go: ['go.mod'],
  'Node.js': ['package.json'],
  Python: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  Rust: ['Cargo.toml'],
  Java: ['pom.xml', 'build.gradle'],
  Ruby: ['Gemfile'],
  PHP: ['composer.json'],
  'C/C++': ['CMakeLists.txt', 'Makefile'],
};

export class ProjectAnalyzer {
  static detectProjectType(cwd: string): string {
    for (const [type, files] of Object.entries(SIGNATURES)) {
      if (files.some((f) => fs.existsSync(path.join(cwd, f)))) {
        return type;
      }
    }
    return 'Unknown';
  }

  static analyzeStructure(cwd: string, maxDepth = 3): string {
    const lines: string[] = [];
    const walk = (dir: string, depth: number, prefix: string) => {
      if (depth > maxDepth || lines.length > 500) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (IGNORE_DIRS.has(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const isKey = depth === 0 && KEY_DIRS.includes(entry.name);
            lines.push(`${prefix}${entry.name}/`);
            if (isKey) walk(fullPath, depth + 1, prefix + '  ');
          } else {
            lines.push(`${prefix}${entry.name}`);
          }
        }
      } catch {}
    };
    lines.push(path.basename(cwd) + '/');
    walk(cwd, 0, '  ');
    return lines.join('\n');
  }

  static extractSymbols(cwd: string, maxFiles = 20): string {
    const lines: string[] = [];
    let fileCount = 0;

    const patterns: Record<string, RegExp[]> = {
      go: [/^func\s+/, /^type\s+/, /^var\s+/],
      ts: [/^export\s+(function|class|interface|type|const)\s+/, /^(function|class)\s+/],
      js: [/^export\s+(function|class)\s+/, /^(function|class)\s+/],
      py: [/^def\s+/, /^class\s+/],
      rs: [/^pub\s+fn\s+/, /^pub\s+struct\s+/, /^impl\s+/],
    };

    const walk = (dir: string) => {
      if (fileCount >= maxFiles) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (IGNORE_DIRS.has(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (fileCount < maxFiles) {
            const ext = path.extname(fullPath).slice(1);
            const regs = patterns[ext];
            if (!regs) continue;
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const relPath = path.relative(cwd, fullPath);
              let hasSymbols = false;
              for (const line of content.split('\n')) {
                for (const reg of regs) {
                  if (reg.test(line.trim())) {
                    if (!hasSymbols) {
                      lines.push(`--- ${relPath} ---`);
                      hasSymbols = true;
                    }
                    lines.push(line);
                    break;
                  }
                }
              }
              if (hasSymbols) {
                fileCount++;
                lines.push('');
              }
            } catch {}
          }
        }
      } catch {}
    };

    walk(cwd);
    return lines.join('\n');
  }

  static extractBuildConfigs(cwd: string): string {
    const configs = ['Makefile', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'];
    const lines: string[] = [];

    for (const file of configs) {
      const fullPath = path.join(cwd, file);
      if (!fs.existsSync(fullPath)) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const contentLines = content.split('\n').slice(0, 30);
        lines.push(`--- ${file} ---`);
        lines.push(...contentLines);
        if (content.split('\n').length > 30) lines.push('...');
        lines.push('');
      } catch {}
    }

    return lines.join('\n');
  }

  static getContext(cwd: string): string {
    const type = this.detectProjectType(cwd);
    const structure = this.analyzeStructure(cwd);
    const symbols = this.extractSymbols(cwd);
    const builds = this.extractBuildConfigs(cwd);

    return `# Project Context

## Type
${type}

## Structure
\`\`\`
${structure}
\`\`\`

## Key Symbols
\`\`\`
${symbols || '(no symbols found)'}
\`\`\`

## Build Configs
\`\`\`
${builds || '(no build configs found)'}
\`\`\``;
  }
}

// Singleton for convenience (though all methods are static)
export const projectAnalyzer = new ProjectAnalyzer();
