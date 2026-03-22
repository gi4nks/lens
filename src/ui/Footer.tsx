import React from 'react';
import { Box, Text } from 'ink';
import { useAppStore } from '../store/index.js';

export const Footer = () => {
  const isThinking = useAppStore((state) => state.isThinking);
  const model = useAppStore((state) => state.model);
  const error = useAppStore((state) => state.error);
  const scrollOffset = useAppStore((state) => state.scrollOffset);

  return (
    <Box marginTop={1} flexDirection="row" justifyContent="space-between" width="100%">
      <Box>
        <Text dimColor>Ctrl+D to exit | Tab for completions | Shift+↑/↓ to scroll</Text>
      </Box>

      <Box>
        {scrollOffset > 0 && <Box marginRight={1}><Text color="yellow" bold>↑ SCROLLED </Text></Box>}
        {error ? (
          <Box marginRight={2}>
            <Text color="red">❌ {error}</Text>
          </Box>
        ) : null}
        {isThinking ? (
          <Text color="magenta" bold>✨ AI is thinking...</Text>
        ) : (
          <Text color="green" dimColor>🤖 {model}</Text>
        )}
      </Box>
    </Box>
  );
};
