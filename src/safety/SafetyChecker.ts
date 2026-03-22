import fs from 'fs';
import path from 'path';
import os from 'os';

const CUSTOM_RULES_PATH = path.join(os.homedir(), '.lens_safety.json');

export interface SafetyCheckResult {
  isDangerous: boolean;
  reason: string;
}

interface SafetyRule {
  pattern: RegExp;
  reason: string;
}

const BUILTIN_RULES: SafetyRule[] = [
  { pattern: /\brm\s+-[rR]f?\b/, reason: 'Recursive file deletion (rm -rf)' },
  { pattern: /:\s*\(\)\s*\{\s*:\s*\|/, reason: 'Fork bomb pattern detected' },
  { pattern: /\bdd\b.*\bif=.*\bof=/, reason: 'Disk dump/overwrite (dd if=...of=...)' },
  { pattern: /\bchmod\s+-R\s+777\b/, reason: 'Insecure recursive permissions (chmod -R 777)' },
  { pattern: /\bchown\s+-R\b/, reason: 'Recursive ownership change (chown -R)' },
  { pattern: /\bmkfs\b/, reason: 'Filesystem format (mkfs)' },
  { pattern: />\s*\/dev\/sd[a-z]\d*/, reason: 'Direct disk partition write' },
  { pattern: />\s*\/dev\/nvme/, reason: 'Direct NVMe device write' },
  { pattern: /\bsudo\s+\S+/, reason: 'Root privilege escalation (sudo)' },
];

export class SafetyChecker {
  private customRules: SafetyRule[] = [];

  constructor() {
    this.loadCustomRules();
  }

  private loadCustomRules(): void {
    try {
      if (!fs.existsSync(CUSTOM_RULES_PATH)) return;
      const data = JSON.parse(fs.readFileSync(CUSTOM_RULES_PATH, 'utf-8'));
      if (!Array.isArray(data)) return;
      for (const rule of data) {
        if (typeof rule.pattern === 'string' && typeof rule.reason === 'string') {
          try {
            this.customRules.push({ pattern: new RegExp(rule.pattern, 'i'), reason: rule.reason });
          } catch {}
        }
      }
    } catch {}
  }

  check(command: string): SafetyCheckResult {
    const trimmed = command.trim();
    const allRules = [...BUILTIN_RULES, ...this.customRules];

    for (const rule of allRules) {
      if (rule.pattern.test(trimmed)) {
        return { isDangerous: true, reason: rule.reason };
      }
    }

    return { isDangerous: false, reason: '' };
  }
}

export const safetyChecker = new SafetyChecker();
