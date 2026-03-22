import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { ContextParser } from '../modules/ContextParser.js';
import { THEMES } from './themes.js';

export const GhostPrompt = ({ onSubmit, onSignal }: { onSubmit: (text: string) => void, onSignal: (signal: string) => void }) => {
  const [selectedHintIndex, setSelectedHintIndex] = useState(-1);
  const input = useAppStore((state) => state.input);
  const commandHistory = useAppStore((state) => state.commandHistory);
  const historyIndex = useAppStore((state) => state.historyIndex);
  const ghostText = useAppStore((state) => state.ghostText);
  const hints = useAppStore((state) => state.hints);
  const setInput = useAppStore((state) => state.setInput);
  const setGhostText = useAppStore((state) => state.setGhostText);
  const setHints = useAppStore((state) => state.setHints);
  const addCommandHistory = useAppStore((state) => state.addCommandHistory);
  const setHistoryIndex = useAppStore((state) => state.setHistoryIndex);
  const scrollUp = useAppStore((state) => state.scrollUp);
  const scrollDown = useAppStore((state) => state.scrollDown);
  const resetScroll = useAppStore((state) => state.resetScroll);
  const aiFixSuggestion = useAppStore((state) => state.aiFixSuggestion);
  const setAiFixSuggestion = useAppStore((state) => state.setAiFixSuggestion);
  const isShellBusy = useAppStore((state) => state.isShellBusy);
  const pendingOrchestrationPlan = useAppStore((state) => state.pendingOrchestrationPlan);
  const cwd = useAppStore((state) => state.cwd);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  const isTabPress = useRef(false);

  const isShell = useMemo(() => ContextParser.isShellCommand(input), [input]);

  useEffect(() => {
    // Hide ghost text if input ends with a space to avoid confusion with file hints
    if (input.length > 0 && !input.endsWith(' ')) {
      const match = [...commandHistory].reverse().find(
        (cmd) => cmd.startsWith(input) && cmd !== input
      );
      setGhostText(match ? match.slice(input.length) : '');
    } else {
      setGhostText('');
    }

    if (!isTabPress.current) {
      const newHints = ContextParser.getHints(input, cwd);
      setHints(newHints);
      setSelectedHintIndex(-1);
    }
    isTabPress.current = false;
  }, [input, commandHistory]);

  useInput((char, key) => {
    if (key.ctrl && char === 'c') {
      onSignal('\x03'); // Send SIGINT sequence
      setInput('');
      return;
    }

    if (key.pageDown || (key.shift && key.downArrow)) return scrollDown(10);
    if (key.pageUp || (key.shift && key.upArrow)) return scrollUp(10);

    if (key.upArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      }
      return;
    }
    if (key.downArrow) {
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      } else if (historyIndex === commandHistory.length - 1) {
        setHistoryIndex(commandHistory.length);
        setInput('');
      }
      return;
    }

    if (key.tab) {
      if (hints.length > 0) {
        isTabPress.current = true;
        const nextIndex = (selectedHintIndex + 1) % hints.length;
        setSelectedHintIndex(nextIndex);
        const tokens = input.split(' ');
        tokens[tokens.length - 1] = hints[nextIndex];
        setInput(tokens.join(' '));
      } else if (ghostText) {
        setInput(input + ghostText);
      }
      return;
    }

    if (key.return) {
      if (input.trim().length > 0) {
        resetScroll();
        addCommandHistory(input);
        onSubmit(input);
        setInput('');
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput(input.slice(0, -1));
      return;
    }

    if (key.rightArrow) {
      if (ghostText) {
        setInput(input + ghostText);
        setGhostText('');
      }
      return;
    }

    if (char === 'f' || char === 'F') {
      if (aiFixSuggestion && input === '') {
        resetScroll();
        addCommandHistory(aiFixSuggestion);
        onSubmit(aiFixSuggestion);
        setAiFixSuggestion(null);
        return;
      }
    }

    if (char) {
      setInput(input + char);
      if (aiFixSuggestion) setAiFixSuggestion(null);
    }
  });

  // --- RIGA 3: HINTS ---
  const visibleHints: string[] = [];
  let currentW = 3;
  const termWidth = process.stdout.columns || 80;
  for (let i = 0; i < hints.length; i++) {
    const w = hints[i].length + 2; 
    if (currentW + w > termWidth - 1) break;
    visibleHints.push(hints[i]);
    currentW += w;
  }

  return (
    <Box flexDirection="column" width="100%" height={3}>
      
      {/* RIGA 1: FIX */}
      <Box width="100%" height={1} paddingLeft={1}>
        {aiFixSuggestion && input === '' ? (
          <Text>
            <Text color={theme.primary} bold>[F] Fix: </Text>
            <Text color={theme.dim} italic>{aiFixSuggestion}</Text>
          </Text>
        ) : null}
      </Box>

      {/* RIGA 2: PROMPT */}
      <Box width="100%" height={1} paddingLeft={1}>
        <Text>
          <Text color={isShell ? theme.secondary : theme.primary} bold>{isShellBusy ? '⏳ ' : (isShell ? '❯ ' : '✨ ')}</Text>
          <Text>{isShellBusy ? '' : input}</Text>
          <Text color={theme.dim}>
            {isShellBusy 
              ? 'Shell is busy... (Ctrl+C to abort)' 
              : (pendingOrchestrationPlan ? 'Execute plan? (y/n)' : ghostText)
            }
          </Text>
        </Text>
      </Box>

      {/* RIGA 3: SUGGERIMENTI/HINTS */}
      <Box width="100%" height={1} paddingLeft={3}>
        <Text>
          {visibleHints.map((hint, i) => {
            const isActive = selectedHintIndex >= 0 && i === selectedHintIndex;
            return (
              <Text key={i} color={isActive ? theme.primary : theme.dim} bold={isActive}>
                {hint}{'  '}
              </Text>
            );
          })}
        </Text>
      </Box>

    </Box>
  );
};
