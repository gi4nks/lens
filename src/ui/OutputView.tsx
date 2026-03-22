import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { lensDB, CommandRecord } from '../db/LensDB.js';
import { THEMES } from './themes.js';

const MAX_OUTPUT_LINES = 20;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export const OutputView = () => {
  const query = useAppStore((state) => state.outputViewQuery);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  const records: CommandRecord[] = useMemo(() => {
    return query ? lensDB.search(query, 50) : lensDB.recent(50);
  }, [query]);

  const [cursor, setCursor] = useState(0);
  const [outputScroll, setOutputScroll] = useState(0);

  const selected = records[cursor] ?? null;
  const outputLines = selected?.output
    ? selected.output.split('\n').filter(l => l.trim())
    : [];
  const visibleOutput = outputLines.slice(outputScroll, outputScroll + MAX_OUTPUT_LINES);

  useInput((_char, key) => {
    if (key.escape || _char === 'q') {
      useAppStore.setState({ view: 'shell', outputViewQuery: '' });
      return;
    }

    if (key.upArrow) {
      if (key.shift) {
        setOutputScroll((s) => Math.max(0, s - 1));
      } else {
        setCursor((c) => Math.max(0, c - 1));
        setOutputScroll(0);
      }
      return;
    }

    if (key.downArrow) {
      if (key.shift) {
        setOutputScroll((s) => Math.min(Math.max(0, outputLines.length - MAX_OUTPUT_LINES), s + 1));
      } else {
        setCursor((c) => Math.min(records.length - 1, c + 1));
        setOutputScroll(0);
      }
      return;
    }

    // Enter: paste command into prompt
    if (key.return && selected) {
      useAppStore.setState({ input: selected.command, view: 'shell', outputViewQuery: '' });
    }
  });

  return (
    <Box flexDirection="column" padding={1} height="100%">

      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text color={theme.primary} bold>
          Output Viewer{query ? ` — filter: "${query}"` : ''}
        </Text>
        <Text dimColor>{records.length} commands</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>↑↓ navigate · Shift+↑↓ scroll output · Enter paste · q close</Text>
      </Box>

      {records.length === 0 ? (
        <Text dimColor>(no records{query ? ` matching "${query}"` : ' — run some commands first'})</Text>
      ) : (
        <Box flexDirection="row" flexGrow={1}>

          {/* Left: command list */}
          <Box flexDirection="column" width={40} marginRight={2} flexShrink={0}>
            {records.slice(0, 20).map((rec, i) => {
              const isSelected = i === cursor;
              const exitColor = rec.exit_code === 0 ? theme.secondary : 'red';
              return (
                <Box key={rec.id} flexDirection="column">
                  <Box>
                    <Text color={isSelected ? theme.primary : theme.dim} bold={isSelected}>
                      {isSelected ? '❯ ' : '  '}
                    </Text>
                    <Text color={isSelected ? 'white' : theme.dim} wrap="truncate" bold={isSelected}>
                      {rec.command}
                    </Text>
                  </Box>
                  {isSelected && (
                    <Box paddingLeft={2}>
                      <Text color={exitColor}>exit {rec.exit_code}</Text>
                      <Text dimColor>  {formatTimestamp(rec.timestamp)}</Text>
                      <Text dimColor>  {rec.cwd.replace(process.env.HOME || '', '~')}</Text>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Right: output panel */}
          <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={theme.dim} paddingX={1}>
            {!selected ? (
              <Text dimColor>(select a command)</Text>
            ) : outputLines.length === 0 ? (
              <Text dimColor>(no output recorded)</Text>
            ) : (
              <>
                {visibleOutput.map((line, i) => (
                  <Text key={i} wrap="truncate">{line}</Text>
                ))}
                {outputLines.length > MAX_OUTPUT_LINES && (
                  <Text dimColor>
                    [{outputScroll + 1}-{Math.min(outputScroll + MAX_OUTPUT_LINES, outputLines.length)} / {outputLines.length} lines]
                  </Text>
                )}
              </>
            )}
          </Box>

        </Box>
      )}
    </Box>
  );
};
