import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { Environment } from '../modules/Environment.js';
import { useAppStore } from '../store/index.js';
import { THEMES } from './themes.js';
import packageJson from '../../package.json' with { type: 'json' };

export const Header = () => {
  const rawCwd = useAppStore((state) => state.cwd);
  const cwd = rawCwd.replace(process.env.HOME || '', '~');
  const modules = useMemo(() => Environment.getContextModules(), [rawCwd]);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;
  const version = packageJson.version;

  return (
    <Box flexDirection="row" width="100%" justifyContent="space-between">
      <Box>
        <Box marginRight={1}>
          <Text color={theme.primary} bold>lens</Text>
          <Text dimColor> v{version}</Text>
        </Box>

        <Box marginRight={1}>
          <Text color={theme.dim}>in</Text>
          <Text color={theme.accent}> {cwd} </Text>
        </Box>
      </Box>

      <Box>
        {modules.map((m, idx) => (
          <Box key={idx} marginLeft={1}>
            <Text color={m.color}>{m.symbol} </Text>
            <Text dimColor>{m.text}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
