import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { THEME_NAMES, THEMES } from './themes.js';

const PROVIDERS = ['Ollama', 'OpenAI', 'Anthropic', 'Gemini'];
const MODELS: Record<string, string[]> = {
  Ollama:    ['llama3.1:latest', 'llama3.2', 'llama3.3', 'qwen2.5-coder', 'phi4', 'deepseek-r1:8b', 'deepseek-r1:14b', 'deepseek-r1:32b'],
  OpenAI:    ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'o3-mini'],
  Anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  Gemini:    ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

type Row = 'provider' | 'model' | 'apikey' | 'theme' | 'history';
const ROWS: Row[] = ['provider', 'model', 'apikey', 'theme', 'history'];

export const ConfigView = () => {
  const store = useAppStore();
  const theme = THEMES[store.theme] || THEMES.dark;

  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  
  const [draftProvider, setDraftProvider] = useState(store.provider);
  const [draftModel, setDraftModel] = useState(store.model);
  const [draftTheme, setDraftTheme] = useState(store.theme);
  const [draftMaxHistory, setDraftMaxHistory] = useState(store.maxHistorySize.toString());
  const [apiKeyInput, setApiKeyInput] = useState(store.apiKeys[store.provider] || '');

  const activeRow = ROWS[activeRowIdx];

  const saveAndExit = () => {
    // Perform all updates in the store at once to avoid flickering/crash
    const s = useAppStore.getState();
    s.setProvider(draftProvider);
    s.setModel(draftModel);
    s.setTheme(draftTheme);
    s.setMaxHistorySize(parseInt(draftMaxHistory, 10) || 50);
    if (apiKeyInput.trim()) s.setApiKey(draftProvider, apiKeyInput.trim());
    
    // Switch view last
    useAppStore.setState({ view: 'shell', input: '' });
    s.addHistory({
      type: 'system',
      content: `[Config] Saved: ${draftProvider} (${draftModel}) · Theme: ${draftTheme}`,
    });
  };

  useInput((char, key) => {
    if (isEditing) {
      if (key.return) {
        setIsEditing(false);
      } else if (key.escape) {
        setIsEditing(false);
      } else if (key.backspace || key.delete) {
        if (activeRow === 'apikey') setApiKeyInput(k => k.slice(0, -1));
        if (activeRow === 'history') setDraftMaxHistory(h => h.slice(0, -1));
      } else if (char) {
        if (activeRow === 'apikey') setApiKeyInput(k => k + char);
        if (activeRow === 'history' && /\d/.test(char)) setDraftMaxHistory(h => (h + char).slice(0, 3));
      }
      return;
    }

    if (key.upArrow) setActiveRowIdx(i => Math.max(0, i - 1));
    if (key.downArrow) setActiveRowIdx(i => Math.min(ROWS.length - 1, i + 1));
    
    if (key.rightArrow || key.leftArrow) {
      const dir = key.rightArrow ? 1 : -1;
      if (activeRow === 'provider') {
        const idx = PROVIDERS.indexOf(draftProvider);
        const next = PROVIDERS[(idx + dir + PROVIDERS.length) % PROVIDERS.length];
        setDraftProvider(next);
        setDraftModel(MODELS[next][0]);
        setApiKeyInput(store.apiKeys[next] || '');
      } else if (activeRow === 'model') {
        const models = MODELS[draftProvider] || [];
        const idx = models.indexOf(draftModel);
        const next = models[(idx + dir + models.length) % models.length];
        setDraftModel(next);
      } else if (activeRow === 'theme') {
        const idx = THEME_NAMES.indexOf(draftTheme);
        const next = THEME_NAMES[(idx + dir + THEME_NAMES.length) % THEME_NAMES.length];
        setDraftTheme(next);
      }
    }

    if (key.return) {
      if (activeRow === 'apikey' || activeRow === 'history') {
        setIsEditing(true);
      } else {
        saveAndExit();
      }
    }

    if (key.escape) {
      useAppStore.setState({ view: 'shell', input: '' });
    }
  });

  const renderRow = (row: Row, label: string, value: string) => {
    const isSelected = activeRow === row;
    const color = isSelected ? theme.primary : theme.dim;
    const isInteractive = ['provider', 'model', 'theme'].includes(row);

    return (
      <Box key={row} marginBottom={0}>
        <Text color={color}>{isSelected ? ' ❯ ' : '   '}</Text>
        <Box width={15}><Text color={color} bold={isSelected}>{label}: </Text></Box>
        <Box flexGrow={1}>
          <Text color={isSelected ? theme.accent : theme.dim}>
            {isInteractive && isSelected ? `< ${value} >` : value}
            {isEditing && isSelected ? ' (typing...)' : ''}
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={4} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>⚙️ CONFIGURATION</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {renderRow('provider', 'AI Provider', draftProvider)}
        {renderRow('model',    'Model',       draftModel)}
        {renderRow('apikey',   'API Key',     activeRow === 'apikey' && isEditing ? apiKeyInput : (apiKeyInput ? '••••••••••••' : '(none)'))}
        {renderRow('theme',    'UI Theme',    THEMES[draftTheme]?.name || draftTheme)}
        {renderRow('history',  'History Max', draftMaxHistory)}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={theme.dim} paddingX={2}>
        <Text dimColor italic>
          Arrows to navigate (←/→ change values) · Enter to save/edit · Esc to exit
        </Text>
      </Box>
    </Box>
  );
};
