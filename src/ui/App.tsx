import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';

import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { GhostPrompt } from './GhostPrompt.js';
import { ConfigView } from './ConfigView.js';
import { HistoryView } from './HistoryView.js';
import { SuggestionsView } from './SuggestionsView.js';
import { OutputView } from './OutputView.js';
import { ShellManager } from '../pty/ShellManager.js';
import { createProvider, Message } from '../ai/Provider.js';
import { useAppStore } from '../store/index.js';
import { ContextParser } from '../modules/ContextParser.js';
import { historyManager } from '../history/HistoryManager.js';
import { safetyChecker } from '../safety/SafetyChecker.js';
import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer.js';
import { aliasManager } from '../alias/AliasManager.js';
import { OrchestrationEngine } from '../engine/OrchestrationEngine.js';
import { lensDB } from '../db/LensDB.js';
import { THEMES } from './themes.js';

export const App = () => {
  const history = useAppStore((state) => state.history);
  const addHistory = useAppStore((state) => state.addHistory);
  const addCommandHistory = useAppStore((state) => state.addCommandHistory);
  const setIsThinking = useAppStore((state) => state.setIsThinking);
  const aiProviderName = useAppStore((state) => state.provider);
  const aiModelName = useAppStore((state) => state.model);
  const apiKeys = useAppStore((state) => state.apiKeys);
  const scrollOffset = useAppStore((state) => state.scrollOffset);
  const view = useAppStore((state) => state.view);
  const setCwd = useAppStore((state) => state.setCwd);
  const pendingSafetyCheck = useAppStore((state) => state.pendingSafetyCheck);
  const setPendingSafetyCheck = useAppStore((state) => state.setPendingSafetyCheck);
  const setAliases = useAppStore((state) => state.setAliases);
  const setAiFixSuggestion = useAppStore((state) => state.setAiFixSuggestion);
  const isShellBusy = useAppStore((state) => state.isShellBusy);
  const setShellBusy = useAppStore((state) => state.setShellBusy);
  const pendingOrchestrationPlan = useAppStore((state) => state.pendingOrchestrationPlan);
  const setPendingOrchestrationPlan = useAppStore((state) => state.setPendingOrchestrationPlan);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  const [termHeight, setTermHeight] = useState(process.stdout.rows || 24);

  const shellRef = useRef<ShellManager | null>(null);
  // Tracks the last shell command sent to PTY so we can pair it with the exit code
  const lastShellCmdRef = useRef<string | null>(null);

  // Bootstrap: import native shell history on first run, then seed commandHistory and aliases
  useEffect(() => {
    historyManager.bootstrapFromShell();
    const cmds = historyManager.loadCommandHistory(100);
    if (cmds.length > 0) {
      useAppStore.setState({ commandHistory: cmds, historyIndex: cmds.length });
    }
    setAliases(aliasManager.list());
  }, [setAliases]);

  useEffect(() => {
    const handleResize = () => {
      setTermHeight(process.stdout.rows);
      if (shellRef.current) {
        shellRef.current.resize(process.stdout.columns || 80, process.stdout.rows || 24);
      }
    };
    process.stdout.on('resize', handleResize);
    return () => { process.stdout.off('resize', handleResize); };
  }, []);

  const cwd = useAppStore((state) => state.cwd);
  const projectContext = useMemo(() => ProjectAnalyzer.getContext(cwd), [cwd]);

  const ptyBufferRef = useRef('');
  // Accumulates raw output for the current command (saved to DB on exit code)
  const cmdOutputRef = useRef('');

  useEffect(() => {
    const shell = new ShellManager();
    shell.start();

    shell.on('data', (data: string) => {
      setShellBusy(shell.isBusy);
      // Append new data to buffer
      ptyBufferRef.current += data;

      // Process only complete lines
      if (ptyBufferRef.current.includes('\n')) {
        const lines = ptyBufferRef.current.split('\n');
        // Keep the last partial line in the buffer
        ptyBufferRef.current = lines.pop() || '';

        const cmd = lastShellCmdRef.current;

        lines.forEach((line, index) => {
          if (line.trim().length === 0) return;

          // Skip command echo: more robust check
          if (cmd && index === 0) {
            const cleanLine = line
              .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
              .replace(/\x1B[=>]/g, '')
              .replace(/\x1B\][^\x07]*\x07/g, '')
              .trim();

            // If the line is just the command or ends with it (prompt + command), skip it
            if (cleanLine === cmd || cleanLine.endsWith(cmd)) {
              return;
            }
          }

          cmdOutputRef.current += line + '\n';
          addHistory({ type: 'shell', content: line });
        });
      }
    });

    shell.on('cwd', (cwd: string) => {
      setCwd(cwd);
    });

    shell.on('exitCode', async (code: number) => {
      setShellBusy(false);
      // Flush any trailing output that didn't end with a newline
      if (ptyBufferRef.current.length > 0) {
        if (ptyBufferRef.current.trim().length > 0) {
          cmdOutputRef.current += ptyBufferRef.current;
          useAppStore.getState().addHistory({ type: 'shell', content: ptyBufferRef.current });
        }
        ptyBufferRef.current = '';
      }

      const cmd = lastShellCmdRef.current;
      const output = cmdOutputRef.current;
      cmdOutputRef.current = '';

      if (cmd !== null) {
        historyManager.append({ userInput: cmd, mode: 'shell', executedCommand: cmd, exitCode: code });

        // Persist to SQLite DB with full output
        lensDB.append({
          command: cmd,
          output: output.slice(-4000), // cap at 4KB
          exit_code: code,
          cwd: useAppStore.getState().cwd,
          timestamp: Date.now(),
        });

        // --- SEAMLESS FIX LOGIC ---
        if (code !== 0) {
          const fixPrompt = `The command "${cmd}" failed with exit code ${code}.
Output:
${output.slice(-2000)}

Analyze the error and suggest EXACTLY ONE command to fix it. Reply ONLY with the command in the format: FIX_COMMAND: <command>`;
          
          try {
            const activeProvider = createProvider(aiProviderName, {
              model: aiModelName,
              apiKey: apiKeys[aiProviderName],
            });
            const stream = activeProvider.streamChat([{ role: 'user', content: fixPrompt }]);
            let full = '';
            for await (const chunk of stream) {
              full += chunk;
            }
            
            const match = full.match(/FIX_COMMAND:\s*(.+)/);
            if (match && match[1]) {
              setAiFixSuggestion(match[1].trim());
            }
          } catch {
            // Silently fail for automated fixes
          }
        } else {
          setAiFixSuggestion(null); // Clear suggestion on success
        }
        
        lastShellCmdRef.current = null;
      }
    });

    shellRef.current = shell;
    return () => shell.stop();
  }, [addHistory, setCwd, aiProviderName, aiModelName, apiKeys, setAiFixSuggestion]);

  const handleSignal = (signal: string) => {
    if (shellRef.current) {
      shellRef.current.sendSignal(signal);
    }
  };

  const handleSubmit = async (cmd: string) => {
    if (!cmd.trim() || isShellBusy) return;

    // ── Handle pending orchestration plan confirmation ────────────────────────
    if (pendingOrchestrationPlan) {
      const answer = cmd.trim().toLowerCase();
      if (answer === 'y') {
        const plan = [...pendingOrchestrationPlan];
        setPendingOrchestrationPlan(null);
        addHistory({ type: 'system', content: `[Orchestration] Starting ${plan.length} commands...` });
        
        for (const planCmd of plan) {
          addHistory({ type: 'system', content: `  ❯ ${planCmd}` });
          lastShellCmdRef.current = planCmd;
          if (shellRef.current) {
            shellRef.current.write(planCmd + '\r');
            // We need a small wait or a way to wait for exitCode event
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
        useAppStore.setState({ input: '' });
      } else if (answer === 'n') {
        addHistory({ type: 'system', content: '[Orchestration] Plan cancelled' });
        setPendingOrchestrationPlan(null);
        useAppStore.setState({ input: '' });
      }
      return;
    }

    // ── Handle pending safety check confirmation ──────────────────────────────
    if (pendingSafetyCheck) {
      const answer = cmd.trim().toLowerCase();
      if (answer === 'y') {
        // Confirm and execute the dangerous command
        lastShellCmdRef.current = pendingSafetyCheck.command;
        addCommandHistory(pendingSafetyCheck.command);
        addHistory({ type: 'system', content: `❯ ${pendingSafetyCheck.command}` });
        if (shellRef.current) {
          shellRef.current.write(pendingSafetyCheck.command + '\r');
        }
        setPendingSafetyCheck(null);
        useAppStore.setState({ input: '' });
      } else if (answer === 'n') {
        // Cancel the dangerous command
        addHistory({ type: 'system', content: '[Safety] Command cancelled' });
        setPendingSafetyCheck(null);
        useAppStore.setState({ input: '' });
      }
      // else: user is still typing the confirmation (y/n), don't respond
      return;
    }

    if (cmd.startsWith('/model ')) {
      const newModel = cmd.replace('/model ', '').trim();
      useAppStore.getState().setModel(newModel);
      addHistory({ type: 'system', content: `[Config] Model changed to: ${newModel}` });
      useAppStore.setState({ input: '' });
      return;
    }

    if (cmd.startsWith('/theme ')) {
      const newTheme = cmd.replace('/theme ', '').trim();
      if (THEMES[newTheme]) {
        useAppStore.getState().setTheme(newTheme);
        addHistory({ type: 'system', content: `[Config] Theme changed to: ${THEMES[newTheme].name}` });
      } else {
        addHistory({ type: 'system', content: `[Error] Theme not found. Available: ${Object.keys(THEMES).join(', ')}` });
      }
      useAppStore.setState({ input: '' });
      return;
    }

    if (cmd.startsWith('/provider ')) {
      const newProvider = cmd.replace('/provider ', '').trim();
      useAppStore.getState().setProvider(newProvider);
      addHistory({ type: 'system', content: `[Config] Provider changed to: ${newProvider}` });
      useAppStore.setState({ input: '' });
      return;
    }

    if (cmd.startsWith('/config')) {
      useAppStore.setState({ view: 'config', input: '' });
      return;
    }

    if (cmd.startsWith('/clear')) {
      useAppStore.setState({ history: [] });
      return;
    }

    if (cmd.startsWith('/output')) {
      const query = cmd.replace('/output', '').trim();
      useAppStore.setState({ view: 'output', outputViewQuery: query, input: '' });
      return;
    }

    if (cmd.startsWith('/history ')) {
      const query = cmd.replace('/history ', '').trim();
      if (!query) return;

      addCommandHistory(cmd);
      setIsThinking(true);
      addHistory({ type: 'system', content: `[History] Searching for: "${query}"...` });

      // Use persistent DB history (richer, cross-session)
      const dbRecords = lensDB.recent(200);
      const historyContext = dbRecords.length > 0
        ? dbRecords.map(r => `[exit:${r.exit_code}] ${r.command}`).join('\n')
        : useAppStore.getState().commandHistory.slice(-100).reverse().join('\n');

      const semanticPrompt = `You are a terminal history expert. Find the ONE command in the history that best matches this intent: "${query}".
History (format: [exit_code] command):
${historyContext}

Reply ONLY with the command string, nothing else. If no good match found, reply "NOT_FOUND".`;

      try {
        const activeProvider = createProvider(aiProviderName, {
          model: aiModelName,
          apiKey: apiKeys[aiProviderName],
        });
        const stream = activeProvider.streamChat([{ role: 'user', content: semanticPrompt }]);
        let full = '';
        for await (const chunk of stream) {
          full += chunk;
        }
        
        const bestMatch = full.trim();
        if (bestMatch && bestMatch !== 'NOT_FOUND') {
          useAppStore.setState({ input: bestMatch });
          addHistory({ type: 'system', content: `[History] Best match: ${bestMatch}. Press Enter to execute.` });
        } else {
          addHistory({ type: 'system', content: '[History] No semantic match found in recent history' });
        }
      } catch (err: unknown) {
        addHistory({ type: 'system', content: `[Error] ${err instanceof Error ? err.message : String(err)}` });
      }
      
      setIsThinking(false);
      return;
    }

    if (cmd.startsWith('/history')) {
      useAppStore.setState({ view: 'history', input: '' });
      return;
    }

    if (cmd.startsWith('/help')) {
      addHistory({
        type: 'system',
        content: `[Help] /config | /clear | /history | /output [filter] | /gpt <prompt> | /fix | /alias add|list|remove | <natural lang>`,
      });
      return;
    }

    if (cmd.startsWith('/fix')) {
      const records = historyManager.readLastN(20);
      const failed = records.reverse().find((r) => r.exitCode !== undefined && r.exitCode !== 0);

      if (!failed) {
        addHistory({ type: 'system', content: '[Fix] No failed command found in recent history' });
        return;
      }

      const failedCmd = failed.executedCommand || failed.userInput;
      const fixPrompt = `The command failed: "${failedCmd}"\nExit code: ${failed.exitCode}\n\nBriefly explain why it might have failed and suggest a solution.`;

      addCommandHistory(cmd);
      setIsThinking(true);
      addHistory({ type: 'ai', content: '' });

      try {
        const activeProvider = createProvider(aiProviderName, {
          model: aiModelName,
          apiKey: apiKeys[aiProviderName],
        });
        const stream = activeProvider.streamChat([{ role: 'user', content: fixPrompt }]);

        let full = '';
        for await (const chunk of stream) {
          full += chunk;
          addHistory({ type: 'ai', content: chunk, append: true } as never);
        }

        historyManager.append({
          userInput: `/fix: ${failedCmd}`,
          mode: 'ai',
          modelResponse: full,
        });
      } catch (err: unknown) {
        addHistory({ type: 'system', content: `[Error] ${err instanceof Error ? err.message : String(err)}` });
      }
      setIsThinking(false);
      return;
    }

    if (cmd.startsWith('/alias')) {
      const parts = cmd.split(' ');
      const subcommand = parts[1];

      if (subcommand === 'list') {
        const aliasEntries = aliasManager.list();
        if (aliasEntries.length === 0) {
          addHistory({ type: 'system', content: '[Alias] No aliases defined' });
        } else {
          aliasEntries.forEach((a) => {
            addHistory({ type: 'system', content: `  ${a.name} → ${a.command}` });
          });
        }
      } else if (subcommand === 'add' && parts.length >= 4) {
        const name = parts[2];
        const command = parts.slice(3).join(' ');
        aliasManager.add(name, command);
        setAliases(aliasManager.list());
        addHistory({ type: 'system', content: `[Alias] Added: ${name} → ${command}` });
      } else if (subcommand === 'remove' && parts[2]) {
        const removed = aliasManager.remove(parts[2]);
        setAliases(aliasManager.list());
        addHistory({
          type: 'system',
          content: removed
            ? `[Alias] Removed: ${parts[2]}`
            : `[Alias] Not found: ${parts[2]}`,
        });
      } else {
        addHistory({ type: 'system', content: '[Alias] Usage: /alias list | /alias add <name> <command> | /alias remove <name>' });
      }
      useAppStore.setState({ input: '' });
      return;
    }

    // Traditional explicit AI request (or if it falls back to NLP translation)
    if (cmd.startsWith('/gpt ') || !ContextParser.isShellCommand(cmd)) {
      const query = cmd.startsWith('/gpt ') ? cmd.replace('/gpt ', '') : cmd;
      const isAutoTranslation = !cmd.startsWith('/gpt ');

      addCommandHistory(cmd);
      setIsThinking(true);
      
      const recentOutput = history
        .slice(-10)
        .map(h => `[${h.type}] ${h.content}`)
        .join('\n');

      const systemPrompt = isAutoTranslation
        ? `The user asked in natural language: "${query}". You are a macOS terminal translator. Current CWD: ${cwd}. Recent shell output:\n${recentOutput}\n\nProvide a JSON response with exactly this format, nothing else:\n{\n  "suggestions": [\n    {"cmd": "command1", "description": "short explanation"},\n    {"cmd": "command2", "description": "short explanation"},\n    {"cmd": "command3", "description": "short explanation"}\n  ]\n}\nThe descriptions must be short (max 50 chars). Commands must be exact and runnable on macOS.`
        : `You are a technical development assistant. Use the project context below to provide accurate and relevant answers. Current CWD: ${cwd}. Recent shell history:\n${recentOutput}\n\nProject Context:\n${projectContext}\n\nIf the user asks to execute a series of actions (e.g. "create a project", "install packages"), respond including a final JSON with this format:\n{\n  "orchestration_plan": ["command1", "command2", ...]\n}`;

      addHistory({ type: 'ai', content: '' });

      try {
        const payload: Message[] = isAutoTranslation
          ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }]
          : [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }];

        const activeProvider = createProvider(aiProviderName, {
          model: aiModelName,
          apiKey: apiKeys[aiProviderName],
        });
        const stream = activeProvider.streamChat(payload);

        let full = '';
        for await (const chunk of stream) {
          full += chunk;
          if (!isAutoTranslation) {
            addHistory({ type: 'ai', content: chunk, append: true } as never);
          }
        }

        historyManager.append({
          userInput: query,
          mode: isAutoTranslation ? 'nlp' : 'ai',
          modelResponse: full,
        });

        if (isAutoTranslation) {
          // Parse JSON suggestions
          try {
            const jsonMatch = full.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
                const suggestions = parsed.suggestions.slice(0, 3);
                useAppStore.setState({ suggestions, view: 'suggestions', input: '' });
              }
            }
          } catch {
            addHistory({ type: 'system', content: '[Error] Unable to parse suggestions' });
          }
        } else {
          // Check for orchestration plan
          const plan = OrchestrationEngine.extractPlan(full);
          if (plan && plan.length > 0) {
            setPendingOrchestrationPlan(plan);
            addHistory({
              type: 'system',
              content: `[Orchestration] Proposed plan:\n${plan.map(p => `  ❯ ${p}`).join('\n')}\nExecute? (y/n)`,
            });
            useAppStore.setState({ input: '' });
          }
        }
      } catch (err: unknown) {
        addHistory({ type: 'system', content: `[Error] ${err instanceof Error ? err.message : String(err)}` });
      }
      setIsThinking(false);
    } else {
      // Expand aliases
      const expandedCmd = aliasManager.expand(cmd);

      // Safety check for shell commands
      const safetyResult = safetyChecker.check(expandedCmd);
      if (safetyResult.isDangerous) {
        setPendingSafetyCheck({ command: expandedCmd, reason: safetyResult.reason });
        addHistory({
          type: 'system',
          content: `⚠️  Dangerous command: ${safetyResult.reason}\nExecute anyway? (y/n)`,
        });
        useAppStore.setState({ input: '' });
        return;
      }

      // Execute safe shell command — exit code will be captured via 'exitCode' event
      lastShellCmdRef.current = expandedCmd;
      addCommandHistory(cmd);
      addHistory({ type: 'system', content: `❯ ${expandedCmd}` });
      if (shellRef.current) {
        shellRef.current.write(expandedCmd + '\r');
      }
    }
  };

  // Body height calculation:
  // TermHeight - Header (3 lines) - Prompt (3 lines) - Footer (3 lines) = Body height roughly.
  const maxVisibleHistoryItems = Math.max(10, termHeight - 12);
  const startIndex = Math.max(0, history.length - maxVisibleHistoryItems - scrollOffset);
  const visibleHistory = history.slice(startIndex, startIndex + maxVisibleHistoryItems);

  return (
    <Box flexDirection="column" height={termHeight} width="100%">
      
      {/* HEADER */}
      <Box borderStyle="single" borderColor={theme.primary} paddingX={1}>
        <Header />
      </Box>

      {/* BODY | COMMANDS */}
      <Box flexGrow={1} flexDirection="column" paddingX={1} overflowY="hidden">
        {view === 'config' ? (
          <ConfigView />
        ) : view === 'history' ? (
          <HistoryView />
        ) : view === 'suggestions' ? (
          <SuggestionsView />
        ) : view === 'output' ? (
          <OutputView />
        ) : (
          visibleHistory.map((entry, index) => (
            <Box key={index} width="100%">
              <Text wrap="wrap" color={entry.type === 'ai' ? theme.secondary : entry.type === 'system' ? theme.warning : undefined}>
                {entry.content}
              </Text>
            </Box>
          ))
        )}
      </Box>
      
      {/* PROMPT */}
      {view !== 'history' && view !== 'suggestions' && view !== 'output' && (
        <Box backgroundColor={theme.bg} height={3} width="100%" flexDirection="column">
          {view === 'config' ? (
            <Box paddingY={1} paddingX={1} width="100%">
              <Text dimColor>   Configuration Mode Active...</Text>
            </Box>
          ) : (
            <GhostPrompt onSubmit={handleSubmit} onSignal={handleSignal} />
          )}
        </Box>
      )}

      {/* FOOTER */}
      <Box paddingX={1}>
        <Footer />
      </Box>

    </Box>
  );
};
