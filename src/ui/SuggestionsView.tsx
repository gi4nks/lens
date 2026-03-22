import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { THEMES } from './themes.js';

export const SuggestionsView = () => {
  const suggestions = useAppStore((state) => state.suggestions);
  const selectedIndex = useAppStore((state) => state.selectedSuggestionIndex);
  const setSelectedIndex = useAppStore((state) => state.setSelectedSuggestionIndex);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  useInput((char, key) => {
    if (key.upArrow || char === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || char === 'j') {
      setSelectedIndex(Math.min(suggestions.length - 1, selectedIndex + 1));
    } else if (key.leftArrow || char === 'h') {
      // Left/h cycles backward (carousel)
      setSelectedIndex(selectedIndex === 0 ? suggestions.length - 1 : selectedIndex - 1);
    } else if (key.rightArrow || char === 'l') {
      // Right/l cycles forward (carousel)
      setSelectedIndex(selectedIndex === suggestions.length - 1 ? 0 : selectedIndex + 1);
    } else if (key.return) {
      const selected = suggestions[selectedIndex];
      if (selected) {
        useAppStore.setState({ view: 'shell', input: selected.cmd, suggestions: [] });
      }
    } else if (key.escape || char === 'q') {
      useAppStore.setState({ view: 'shell', suggestions: [] });
    }
  });

  return (
    <Box flexDirection="column" padding={2} backgroundColor={theme.bg}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>💡 Command Suggestions</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>↑↓ navigate · Enter to select · ESC/q to cancel</Text>
      </Box>

      <Box flexDirection="column">
        {suggestions.map((item, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={i === selectedIndex ? theme.primary : theme.dim} bold={i === selectedIndex}>
                {i === selectedIndex ? '❯ ' : '  '}
              </Text>
              <Text color={i === selectedIndex ? 'white' : theme.dim} bold={i === selectedIndex}>
                {item.cmd}
              </Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor>{item.description}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
