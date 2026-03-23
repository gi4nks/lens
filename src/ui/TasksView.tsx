import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { taskManager, formatElapsed, homePath } from '../tasks/BackgroundTaskManager.js';
import { THEMES } from './themes.js';

const STATUS_ICON: Record<string, string> = {
  running: '●',
  done: '✓',
  failed: '✗',
  killed: '○',
};

const STATUS_COLOR: Record<string, string> = {
  running: 'green',
  done: 'gray',
  failed: 'red',
  killed: 'yellow',
};

export const TasksView = () => {
  const tasks = useAppStore((state) => state.backgroundTasks);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  const [cursor, setCursor] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, tick] = useState(0);

  // Tick every second to refresh elapsed times on running tasks
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const filtered = tasks.filter((t) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      t.label.toLowerCase().includes(q) ||
      t.command.toLowerCase().includes(q) ||
      t.cwd.toLowerCase().includes(q)
    );
  });

  const safeCursor = Math.min(cursor, Math.max(0, filtered.length - 1));
  const selected = filtered[safeCursor];
  const runningCount = tasks.filter((t) => t.status === 'running').length;

  useInput((char, key) => {
    if (filterActive) {
      if (key.escape) {
        setFilterActive(false);
        setFilterText('');
        return;
      }
      if (key.return) {
        setFilterActive(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterText((s) => s.slice(0, -1));
        return;
      }
      if (char && !key.ctrl && !key.meta) {
        setFilterText((s) => s + char);
      }
      return;
    }

    if (confirmDelete) {
      if (char === 'y') {
        useAppStore.setState((state) => ({
          backgroundTasks: state.backgroundTasks.filter((t) => t.status === 'running'),
        }));
        setConfirmDelete(false);
        setCursor(0);
      } else {
        setConfirmDelete(false);
      }
      return;
    }

    if (key.escape || char === 'q') {
      useAppStore.setState({ view: 'shell' });
      return;
    }

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
      return;
    }

    if (key.return && selected) {
      useAppStore.setState({ view: 'task-output', selectedTaskId: selected.id });
      return;
    }

    if (char === 'f' || char === 'F') {
      setFilterActive(true);
      return;
    }

    if ((char === 'k' || char === 'K') && selected?.status === 'running') {
      taskManager.kill(selected.id);
      return;
    }

    if (char === 'd' || char === 'D') {
      const hasDone = tasks.some((t) => t.status !== 'running');
      if (hasDone) setConfirmDelete(true);
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text color={theme.primary} bold>⚡ Background Tasks</Text>
        <Text color={runningCount > 0 ? 'green' : 'gray'}>
          {runningCount > 0 ? `${runningCount} running` : 'idle'}
          {tasks.length > 0 ? ` · ${tasks.length} total` : ''}
        </Text>
      </Box>

      {/* Filter bar */}
      <Box marginBottom={1}>
        {filterActive ? (
          <Text>Filter: <Text color="yellow">{filterText || ' '}</Text><Text color="yellow">▌</Text></Text>
        ) : (
          <Text dimColor>F: filter · Enter: view output · K: kill · D: clear done · Esc: back</Text>
        )}
      </Box>

      {/* Task list */}
      {filtered.length === 0 ? (
        <Text dimColor>{tasks.length === 0 ? '(no background tasks)' : '(no matches)'}</Text>
      ) : (
        filtered.map((task, i) => {
          const isSelected = i === safeCursor;
          const icon = STATUS_ICON[task.status] || '?';
          const color = STATUS_COLOR[task.status] || 'gray';

          return (
            <Box key={task.id}>
              <Text bold={isSelected}>{isSelected ? '▶ ' : '  '}</Text>
              <Text color={color}>{icon} </Text>
              <Text bold={isSelected} wrap="truncate">
                {task.label.padEnd(18).slice(0, 18)}
              </Text>
              <Text dimColor wrap="truncate">
                {'  '}{homePath(task.cwd).padEnd(20).slice(0, 20)}
              </Text>
              <Text dimColor>{'  '}{formatElapsed(task)}</Text>
              {task.status !== 'running' && task.exitCode !== undefined && (
                <Text color={task.exitCode === 0 ? 'green' : 'red'}>
                  {'  '}[exit: {task.exitCode}]
                </Text>
              )}
              {task.status === 'running' && (
                <Text color="green">{'  '}[running]</Text>
              )}
              {task.status === 'killed' && (
                <Text color="yellow">{'  '}[killed]</Text>
              )}
            </Box>
          );
        })
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <Box marginTop={1}>
          <Text color="yellow">Remove all completed tasks? (y/n)</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {safeCursor + 1}/{Math.max(1, filtered.length)}
          {filterText ? `  filter: "${filterText}"` : ''}
        </Text>
      </Box>
    </Box>
  );
};
