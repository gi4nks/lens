import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { THEME_NAMES, THEMES } from './themes.js';

const PROVIDERS = ['Ollama', 'OpenAI', 'Anthropic', 'Gemini'];
const STATIC_MODELS: Record<string, string[]> = {
  Ollama:    ['llama3.1:latest', 'llama3.2', 'llama3.3', 'qwen2.5-coder', 'phi4', 'deepseek-r1:8b', 'deepseek-r1:14b', 'deepseek-r1:32b'],
  OpenAI:    ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'o3-mini'],
  Anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  Gemini:    ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

type Row = 'provider' | 'model' | 'ollamaurl' | 'apikey' | 'theme' | 'history';

export const ConfigView = () => {
  const store = useAppStore();
  const theme = THEMES[store.theme] || THEMES.dark;

  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  
  const [draftProvider, setDraftProvider] = useState(store.provider);
  const [draftModel, setDraftModel] = useState(store.model);
  const [draftOllamaUrl, setDraftOllamaUrl] = useState(store.ollamaUrl);
  const [committedOllamaUrl, setCommittedOllamaUrl] = useState(store.ollamaUrl);
  const [ollamaModels, setOllamaModels] = useState<string[]>(STATIC_MODELS.Ollama);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const rows: Row[] = draftProvider === 'Ollama'
    ? ['provider', 'model', 'ollamaurl', 'apikey', 'theme', 'history']
    : ['provider', 'model', 'apikey', 'theme', 'history'];

  useEffect(() => {
    if (draftProvider !== 'Ollama') return;
    let cancelled = false;
    setOllamaLoading(true);

    let url = committedOllamaUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    fetch(`${url}/api/tags`)
      .then(r => {
        if (!r.ok) throw new Error(`Ollama error (${r.status})`);
        return r.json();
      })
      .then((data: { models?: Array<{ name: string }> }) => {
        if (cancelled) return;
        const names = (data.models ?? []).map(m => m.name).filter(Boolean);
        if (names.length > 0) {
          setOllamaModels(names);
          if (!names.includes(draftModel)) setDraftModel(names[0]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Ollama connection failed:', err);
      })
      .finally(() => { if (!cancelled) setOllamaLoading(false); });
    return () => { cancelled = true; };
  }, [draftProvider, committedOllamaUrl]);
  const [draftTheme, setDraftTheme] = useState(store.theme);
  const [draftMaxHistory, setDraftMaxHistory] = useState(store.maxHistorySize.toString());
  const [apiKeyInput, setApiKeyInput] = useState(store.apiKeys[store.provider] || '');

  const activeRow = rows[activeRowIdx];

  const saveAndExit = () => {
    // Perform all updates in the store at once to avoid flickering/crash
    const s = useAppStore.getState();
    s.setProvider(draftProvider);
    s.setModel(draftModel);
    s.setOllamaUrl(draftOllamaUrl);
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
        if (activeRow === 'ollamaurl') setCommittedOllamaUrl(draftOllamaUrl);
        setIsEditing(false);
      } else if (key.escape) {
        if (activeRow === 'ollamaurl') setDraftOllamaUrl(committedOllamaUrl); // revert
        setIsEditing(false);
      } else if (key.backspace || key.delete) {
        if (activeRow === 'apikey') setApiKeyInput(k => k.slice(0, -1));
        if (activeRow === 'ollamaurl') setDraftOllamaUrl(u => u.slice(0, -1));
        if (activeRow === 'history') setDraftMaxHistory(h => h.slice(0, -1));
      } else if (char) {
        if (activeRow === 'apikey') setApiKeyInput(k => k + char);
        if (activeRow === 'ollamaurl') setDraftOllamaUrl(u => u + char);
        if (activeRow === 'history' && /\d/.test(char)) setDraftMaxHistory(h => (h + char).slice(0, 3));
      }
      return;
    }

    if (key.upArrow) setActiveRowIdx(i => Math.max(0, i - 1));
    if (key.downArrow) setActiveRowIdx(i => Math.min(rows.length - 1, i + 1));

    if (key.rightArrow || key.leftArrow) {
      const dir = key.rightArrow ? 1 : -1;
      if (activeRow === 'provider') {
        const idx = PROVIDERS.indexOf(draftProvider);
        const next = PROVIDERS[(idx + dir + PROVIDERS.length) % PROVIDERS.length];
        setDraftProvider(next);
        setActiveRowIdx(i => Math.min(i, (next === 'Ollama' ? 6 : 5) - 1));
        const nextModels = next === 'Ollama' ? ollamaModels : (STATIC_MODELS[next] || []);
        setDraftModel(nextModels[0] ?? '');
        setApiKeyInput(store.apiKeys[next] || '');
      } else if (activeRow === 'model') {
        const models = draftProvider === 'Ollama' ? ollamaModels : (STATIC_MODELS[draftProvider] || []);
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
      if (activeRow === 'apikey' || activeRow === 'ollamaurl' || activeRow === 'history') {
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
    const isInteractive = ['provider', 'model', 'theme'].includes(row as string);

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
        {renderRow('provider',  'AI Provider', draftProvider)}
        {renderRow('model',     'Model',       ollamaLoading && draftProvider === 'Ollama' ? `${draftModel} (loading...)` : draftModel)}
        {draftProvider === 'Ollama' && renderRow('ollamaurl', 'Ollama URL', draftOllamaUrl)}
        {renderRow('apikey',    'API Key',     activeRow === 'apikey' && isEditing ? apiKeyInput : (apiKeyInput ? '••••••••••••' : '(none)'))}
        {renderRow('theme',     'UI Theme',    THEMES[draftTheme]?.name || draftTheme)}
        {renderRow('history',   'History Max', draftMaxHistory)}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={theme.dim} paddingX={2}>
        <Text dimColor italic>
          Arrows to navigate (←/→ change values) · Enter to save/edit · Esc to exit
        </Text>
      </Box>
    </Box>
  );
};
