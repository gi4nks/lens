import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { historyManager } from '../history/HistoryManager.js';

export const HistoryView = () => {
  const maxHistorySize = useAppStore((state) => state.maxHistorySize);
  const records = historyManager.readLastN(maxHistorySize).reverse();
  const [cursor, setCursor] = useState(0);

  useInput((char, key) => {
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(records.length - 1, c + 1));
    } else if (key.escape || char === 'q') {
      useAppStore.setState({ view: 'shell' });
    } else if (key.return) {
      const record = records[cursor];
      // For shell commands, use executedCommand; for NLP/AI, use userInput to re-run the query
      const cmd = (record.executedCommand && record.executedCommand !== '[REDACTED]')
        ? record.executedCommand
        : record.userInput;
      if (cmd) {
        useAppStore.setState({ input: cmd, view: 'shell' });
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>📜 History last {maxHistorySize} commands</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          ↑↓ navigate · Enter to insert · ESC/q to close
        </Text>
      </Box>

      <Box flexDirection="column" overflowY="hidden">
        {records.length === 0 ? (
          <Text dimColor>(no commands in history)</Text>
        ) : (
          records.map((record, i) => {
            const cmd = record.executedCommand || record.userInput;
            const isSelected = i === cursor;
            const color = isSelected ? 'white' : 'gray';
            const mode = record.mode === 'shell' ? '' : ` [${record.mode.toUpperCase()}]`;
            const exit = record.exitCode !== undefined ? ` (exit ${record.exitCode})` : '';

            return (
              <Box key={i}>
                <Text color={color} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text color={color} wrap="truncate">
                  {cmd}
                  {mode}
                  {exit}
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Position: {cursor + 1} / {records.length}
        </Text>
      </Box>
    </Box>
  );
};
