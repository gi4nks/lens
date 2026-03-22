import { create } from 'zustand';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.lens.json');

function loadConfig() {
   try {
      if (fs.existsSync(CONFIG_PATH)) {
         return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      }
   } catch {}
   return { provider: 'Ollama', model: 'llama3.1:latest', apiKeys: {}, theme: 'dark', maxHistorySize: 50 };
}

function saveConfig(data: Partial<Pick<AppState, 'provider' | 'model' | 'apiKeys' | 'theme' | 'maxHistorySize'>>) {
   try {
      const existing = fs.existsSync(CONFIG_PATH)
         ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
         : {};
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
   } catch {}
}

const initialConfig = loadConfig();

export interface HistoryEntry {
  id: string;
  type: 'shell' | 'ai' | 'system';
  content: string;
  append?: boolean;
  command?: string; // command that produced this shell output line
}

export interface AliasEntry {
  name: string;
  command: string;
}

export interface SafetyCheck {
  command: string;
  reason: string;
}

export interface SuggestionItem {
  cmd: string;
  description: string;
}

interface AppState {
  input: string;
  ghostText: string;
  isThinking: boolean;
  history: HistoryEntry[];
  commandHistory: string[];
  historyIndex: number;
  hints: string[];
  selectedHintIndex: number;
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  theme: string;
  maxHistorySize: number;
  view: 'shell' | 'config' | 'history' | 'suggestions' | 'output';
  outputViewQuery: string;
  error: string | null;
  scrollOffset: number;
  cwd: string;
  aliases: AliasEntry[];
  pendingSafetyCheck: SafetyCheck | null;
  suggestions: SuggestionItem[];
  selectedSuggestionIndex: number;
  aiFixSuggestion: string | null;
  isShellBusy: boolean;
  pendingOrchestrationPlan: string[] | null;

  // Actions
  setInput: (text: string) => void;
  setGhostText: (text: string) => void;
  setHints: (hints: string[]) => void;
  setSelectedHintIndex: (index: number) => void;
  setIsThinking: (thinking: boolean) => void;
  addHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  addCommandHistory: (cmd: string) => void;
  setHistoryIndex: (index: number) => void;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  setApiKey: (provider: string, key: string) => void;
  setError: (error: string | null) => void;
  scrollUp: (amount: number) => void;
  scrollDown: (amount: number) => void;
  resetScroll: () => void;
  setCwd: (cwd: string) => void;
  setAliases: (aliases: AliasEntry[]) => void;
  setPendingSafetyCheck: (check: SafetyCheck | null) => void;
  setTheme: (theme: string) => void;
  setMaxHistorySize: (size: number) => void;
  setSuggestions: (suggestions: SuggestionItem[]) => void;
  setSelectedSuggestionIndex: (index: number) => void;
  setAiFixSuggestion: (suggestion: string | null) => void;
  setShellBusy: (busy: boolean) => void;
  setPendingOrchestrationPlan: (plan: string[] | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  input: '',
  ghostText: '',
  isThinking: false,
  history: [],
  commandHistory: [],
  historyIndex: 0,
  hints: [],
  selectedHintIndex: 0,
  provider: initialConfig.provider || 'Ollama',
  model: initialConfig.model || 'llama3.1:latest',
  apiKeys: initialConfig.apiKeys || {},
  theme: initialConfig.theme || 'dark',
  maxHistorySize: initialConfig.maxHistorySize || 50,
  view: 'shell',
  outputViewQuery: '',
  error: null,
  scrollOffset: 0,
  cwd: process.cwd(),
  aliases: [],
  pendingSafetyCheck: null,
  suggestions: [],
  selectedSuggestionIndex: 0,
  aiFixSuggestion: null,
  isShellBusy: false,
  pendingOrchestrationPlan: null,

  setInput: (text) => set({ input: text }),
  setGhostText: (text) => set({ ghostText: text }),
  setHints: (hints) => set({ hints, selectedHintIndex: 0 }),
  setSelectedHintIndex: (index) => set({ selectedHintIndex: index }),
  setIsThinking: (thinking) => set({ isThinking: thinking }),
  addHistory: (entry) =>
    set((state) => {
      if (entry.append && state.history.length > 0) {
        const last = state.history[state.history.length - 1];
        const updated = { ...last, content: last.content + entry.content };
        return { history: [...state.history.slice(0, -1), updated] };
      }
      return {
        history: [
          ...state.history,
          { ...entry, id: Math.random().toString(36).substring(7) },
        ].slice(-500),
      };
    }),
  addCommandHistory: (cmd) => set((state) => {
    const newHistory = [...state.commandHistory, cmd].slice(-100);
    return { commandHistory: newHistory, historyIndex: newHistory.length };
  }),
  setHistoryIndex: (index) => set({ historyIndex: index }),
  setProvider: (provider) => {
    set({ provider });
    saveConfig({ provider });
  },
  setModel: (model) => {
    set({ model });
    saveConfig({ model });
  },
  setApiKey: (provider, key) => set((state) => {
    const apiKeys = { ...state.apiKeys, [provider]: key };
    saveConfig({ apiKeys });
    return { apiKeys };
  }),
  setError: (error) => set({ error }),
  scrollUp: (amount) => set((state) => ({
    scrollOffset: Math.min(state.scrollOffset + amount, Math.max(0, state.history.length - 5))
  })),
  scrollDown: (amount) => set((state) => ({
    scrollOffset: Math.max(0, state.scrollOffset - amount)
  })),
  resetScroll: () => set({ scrollOffset: 0 }),
  setCwd: (cwd) => set({ cwd }),
  setAliases: (aliases) => set({ aliases }),
  setPendingSafetyCheck: (check) => set({ pendingSafetyCheck: check }),
  setTheme: (theme) => {
    set({ theme });
    saveConfig({ theme });
  },
  setMaxHistorySize: (maxHistorySize) => {
    set({ maxHistorySize });
    saveConfig({ maxHistorySize });
  },
  setSuggestions: (suggestions) => set({ suggestions, selectedSuggestionIndex: 0 }),
  setSelectedSuggestionIndex: (index) => set({ selectedSuggestionIndex: index }),
  setAiFixSuggestion: (suggestion) => set({ aiFixSuggestion: suggestion }),
  setShellBusy: (isShellBusy) => set({ isShellBusy }),
  setPendingOrchestrationPlan: (pendingOrchestrationPlan) => set({ pendingOrchestrationPlan }),
}));
