import React from 'react';
import { Box, Text } from 'ink';
import type { HistoryEntry } from '../store/index.js';
import type { Theme } from './themes.js';
import { getFileColor } from './fileColors.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RenderGroup {
  type: 'shell' | 'ai' | 'system';
  command: string | undefined;
  lines: string[];
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export function groupHistoryForRender(entries: HistoryEntry[]): RenderGroup[] {
  const groups: RenderGroup[] = [];

  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (
      entry.type === 'shell' &&
      entry.command !== undefined &&
      last &&
      last.type === 'shell' &&
      last.command === entry.command
    ) {
      last.lines.push(entry.content);
    } else {
      groups.push({ type: entry.type, command: entry.command, lines: [entry.content] });
    }
  }

  return groups;
}

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const ANSI_RE = /\x1B\[[0-9;?]*[a-zA-Z]|\x1B[=>]|\x1B\][^\x07]*\x07/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

// Unix long-format permission string: drwxr-xr-x, -rw-r--r--, lrwxrwxrwx, etc.
const LONG_PERM_RE = /^[dlbcps-][rwxsStT-]{9}/;

// ─── Ls short-format (multi-column) ───────────────────────────────────────────

const LsShortLine: React.FC<{ line: string; theme: Theme }> = ({ line, theme }) => {
  const clean = stripAnsi(line).trim();
  if (!clean) return null;

  // ls -C pads columns with 2+ spaces; split there
  const tokens = clean.split(/  +/).map(t => t.trim()).filter(Boolean);

  return (
    <Box flexWrap="wrap">
      {tokens.map((name, i) => (
        <Box key={i} marginRight={2}>
          <Text color={getFileColor(name, theme)}>{name}</Text>
        </Box>
      ))}
    </Box>
  );
};

// ─── Ls long-format (ls -l / ls -la) ─────────────────────────────────────────

const LsLongLine: React.FC<{ line: string; theme: Theme }> = ({ line, theme }) => {
  const clean = stripAnsi(line).trim();
  if (!clean) return null;

  // "total 128" header
  if (/^total\s+\d+/.test(clean)) return <Text dimColor>{clean}</Text>;

  if (!LONG_PERM_RE.test(clean)) return <Text>{clean}</Text>;

  // fields: perms nlinks owner group size month day time name...
  const parts = clean.split(/\s+/);
  if (parts.length < 9) return <Text>{clean}</Text>;

  const perms = parts[0];
  const meta = parts.slice(1, 8).join(' ');
  const nameRaw = parts.slice(8).join(' ');

  const isDir = perms.startsWith('d');
  const isLink = perms.startsWith('l');

  const [namePart, linkTarget] = isLink ? nameRaw.split(' -> ') : [nameRaw, undefined];
  const colorKey = isDir ? namePart + '/' : namePart;

  return (
    <Box>
      <Text dimColor>{perms} {meta} </Text>
      <Text color={getFileColor(colorKey, theme)}>{namePart}</Text>
      {linkTarget && <Text dimColor> → {linkTarget}</Text>}
    </Box>
  );
};

const LsRenderer: React.FC<{ lines: string[]; theme: Theme }> = ({ lines, theme }) => {
  const isLong = lines.some(l => {
    const c = stripAnsi(l).trim();
    return c.length > 0 && !c.startsWith('total') && LONG_PERM_RE.test(c);
  });

  return (
    <Box flexDirection="column">
      {lines.map((line, i) =>
        isLong
          ? <LsLongLine key={i} line={line} theme={theme} />
          : <LsShortLine key={i} line={line} theme={theme} />
      )}
    </Box>
  );
};

// ─── Git status ───────────────────────────────────────────────────────────────

const GitStatusRenderer: React.FC<{ lines: string[]; theme: Theme }> = ({ lines, theme }) => (
  <Box flexDirection="column">
    {lines.map((line, i) => {
      const clean = stripAnsi(line);
      const code = clean.slice(0, 2);
      let color: string | undefined;

      if (/^(On branch|HEAD detached)/.test(clean))      color = theme.primary;
      else if (/^(Your branch|nothing to commit)/.test(clean)) color = theme.success;
      else if (/^\?\?/.test(code))                              color = theme.dim;
      else if (/^[MARC][ MARC]/.test(code))                    color = theme.success;   // staged
      else if (/^[ MARC]M/.test(code) || /^MM/.test(code))     color = theme.warning;   // modified
      else if (/^[ D]D/.test(code) || /^DD/.test(code))        color = theme.error;     // deleted
      else if (/^R/.test(code))                                 color = theme.primary;   // renamed

      return <Text key={i} color={color} wrap="wrap">{clean}</Text>;
    })}
  </Box>
);

// ─── Git log ──────────────────────────────────────────────────────────────────

const GitLogRenderer: React.FC<{ lines: string[]; theme: Theme }> = ({ lines, theme }) => (
  <Box flexDirection="column">
    {lines.map((line, i) => {
      const clean = stripAnsi(line);

      const commitM = /^commit ([0-9a-f]{7,40})(.*)/.exec(clean);
      if (commitM) return (
        <Box key={i}>
          <Text dimColor>commit </Text>
          <Text color={theme.warning} bold>{commitM[1]}</Text>
          <Text dimColor>{commitM[2]}</Text>
        </Box>
      );

      const authorM = /^(Author:)\s*(.*)/.exec(clean);
      if (authorM) return (
        <Box key={i}>
          <Text dimColor>{authorM[1]} </Text>
          <Text color={theme.accent}>{authorM[2]}</Text>
        </Box>
      );

      const dateM = /^(Date:)\s*(.*)/.exec(clean);
      if (dateM) return (
        <Box key={i}>
          <Text dimColor>{dateM[1]} </Text>
          <Text color={theme.success}>{dateM[2]}</Text>
        </Box>
      );

      // Commit message (4-space indent) or blank
      if (clean.startsWith('    ')) return <Text key={i}>{clean}</Text>;

      return <Text key={i} dimColor>{clean}</Text>;
    })}
  </Box>
);

// ─── Default (ANSI passthrough) ───────────────────────────────────────────────

const DefaultRenderer: React.FC<{ lines: string[] }> = ({ lines }) => (
  <Box flexDirection="column">
    {lines.map((line, i) => <Text key={i} wrap="wrap">{line}</Text>)}
  </Box>
);

// ─── Command dispatcher ───────────────────────────────────────────────────────

function baseCmd(command: string | undefined): string {
  if (!command) return '';
  return command.trim().split(/\s+/)[0].replace(/^.*\//, '').toLowerCase();
}

function secondWord(command: string | undefined): string {
  if (!command) return '';
  return (command.trim().split(/\s+/)[1] ?? '').toLowerCase();
}

export const OutputRenderer: React.FC<{ group: RenderGroup; theme: Theme }> = ({ group, theme }) => {
  const { command, lines } = group;
  const base = baseCmd(command);
  const sub = secondWord(command);

  if (base === 'ls' || base === 'll' || base === 'la' || base === 'l') {
    return <LsRenderer lines={lines} theme={theme} />;
  }

  if (base === 'git') {
    if (sub === 'status' || sub === 'st') return <GitStatusRenderer lines={lines} theme={theme} />;
    if (sub === 'log')                    return <GitLogRenderer lines={lines} theme={theme} />;
    // git diff, git show, etc. → ANSI passthrough (git already colorizes)
    return <DefaultRenderer lines={lines} />;
  }

  return <DefaultRenderer lines={lines} />;
};
