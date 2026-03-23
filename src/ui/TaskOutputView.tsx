import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { taskManager, formatElapsed, homePath } from '../tasks/BackgroundTaskManager.js';
import { THEMES } from './themes.js';

const STATUS_COLOR: Record<string, string> = {
  running: 'green',
  done: 'gray',
  failed: 'red',
  killed: 'yellow',
};

export const TaskOutputView = () => {
  const selectedTaskId = useAppStore((state) => state.selectedTaskId);
  const tasks = useAppStore((state) => state.backgroundTasks);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  const task = tasks.find((t) => t.id === selectedTaskId);

  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [, tick] = useState(0);
  const termHeight = process.stdout.rows || 24;

  // Tick every second to refresh elapsed timer for running tasks
  useEffect(() => {
    if (!task || task.status !== 'running') return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [task?.status]);

  // Auto-scroll to bottom when new output arrives (if not manually scrolled)
  const prevOutputLen = useRef(0);
  useEffect(() => {
    if (!task) return;
    if (task.output.length !== prevOutputLen.current) {
      prevOutputLen.current = task.output.length;
      if (autoScroll) setScrollOffset(0);
    }
  }, [task?.output.length, autoScroll]);

  useInput((char, key) => {
    if (key.escape || char === 'q') {
      useAppStore.setState({ view: 'tasks', selectedTaskId: null });
      return;
    }

    if ((key.shift && key.upArrow) || key.pageUp) {
      setAutoScroll(false);
      setScrollOffset((s) => s + 5);
      return;
    }

    if ((key.shift && key.downArrow) || key.pageDown) {
      setScrollOffset((s) => {
        const next = Math.max(0, s - 5);
        if (next === 0) setAutoScroll(true);
        return next;
      });
      return;
    }

    if ((char === 'k' || char === 'K') && task?.status === 'running') {
      taskManager.kill(task.id);
      return;
    }

    if (char === 'G') {
      // Jump to bottom
      setScrollOffset(0);
      setAutoScroll(true);
      return;
    }
  });

  if (!task) {
    return (
      <Box padding={1}>
        <Text color="red">Task not found.</Text>
      </Box>
    );
  }

  // Visible lines: reserve rows for header (3) + footer (2) + padding (2)
  const visibleLines = Math.max(5, termHeight - 10);
  const output = task.output;
  const totalLines = output.length;
  const startIdx = Math.max(0, totalLines - visibleLines - scrollOffset);
  const visibleOutput = output.slice(startIdx, startIdx + visibleLines);

  const statusColor = STATUS_COLOR[task.status] || 'gray';

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={theme.primary} bold>OUTPUT: </Text>
          <Text bold>{task.label}</Text>
          <Text dimColor>  {task.command !== task.label ? `(${task.command})` : ''}</Text>
        </Box>
        <Text color={statusColor}>
          {task.status} · {formatElapsed(task)}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>{homePath(task.cwd)}</Text>
        {task.pid && <Text dimColor>  pid: {task.pid}</Text>}
        {task.exitCode !== undefined && (
          <Text color={task.exitCode === 0 ? 'green' : 'red'}>  exit: {task.exitCode}</Text>
        )}
      </Box>

      {/* Divider */}
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(Math.min(process.stdout.columns - 4, 80))}</Text>
      </Box>

      {/* Output */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {visibleOutput.length === 0 ? (
          <Text dimColor>(no output yet)</Text>
        ) : (
          visibleOutput.map((line, i) => (
            <Text key={startIdx + i} wrap="truncate">{line}</Text>
          ))
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>
          {task.status === 'running' ? 'K: kill  ' : ''}
          Shift+↑/↓: scroll  G: bottom  Esc: back
        </Text>
        {scrollOffset > 0 && (
          <Text color="yellow" bold>↑ SCROLLED ({scrollOffset})</Text>
        )}
        {autoScroll && task.status === 'running' && (
          <Text color="green" dimColor>auto-scroll</Text>
        )}
      </Box>
    </Box>
  );
};
