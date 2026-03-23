import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppStore } from '../store/index.js';
import { aliasManager } from '../alias/AliasManager.js';
import { THEMES } from './themes.js';

type Mode = 'list' | 'edit' | 'confirm-delete';

export const AliasView = () => {
  const aliases = useAppStore((state) => state.aliases);
  const setAliases = useAppStore((state) => state.setAliases);
  const currentThemeName = useAppStore((state) => state.theme);
  const theme = THEMES[currentThemeName] || THEMES.dark;

  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>('list');

  // Edit/add form state
  const [editName, setEditName] = useState('');
  const [editCommand, setEditCommand] = useState('');
  const [editIsNew, setEditIsNew] = useState(false);
  const [activeField, setActiveField] = useState<'name' | 'command'>('name');

  const safeCursor = Math.min(cursor, Math.max(0, aliases.length - 1));
  const selected = aliases[safeCursor];

  const openAdd = () => {
    setEditName('');
    setEditCommand('');
    setEditIsNew(true);
    setActiveField('name');
    setMode('edit');
  };

  const openEdit = (alias: { name: string; command: string }) => {
    setEditName(alias.name);
    setEditCommand(alias.command);
    setEditIsNew(false);
    setActiveField('name');
    setMode('edit');
  };

  const saveEdit = () => {
    const name = editName.trim();
    const command = editCommand.trim();
    if (!name || !command) return;
    aliasManager.add(name, command);
    setAliases(aliasManager.list());
    setMode('list');
  };

  const deleteSelected = () => {
    if (!selected) return;
    aliasManager.remove(selected.name);
    setAliases(aliasManager.list());
    setCursor((c) => Math.max(0, c - 1));
    setMode('list');
  };

  useInput((char, key) => {
    // ── Edit/Add form ────────────────────────────────────────────────────────
    if (mode === 'edit') {
      if (key.escape) {
        setMode('list');
        return;
      }
      if (key.tab || key.downArrow) {
        setActiveField((f) => (f === 'name' ? 'command' : 'name'));
        return;
      }
      if (key.upArrow) {
        setActiveField((f) => (f === 'command' ? 'name' : 'command'));
        return;
      }
      if (key.return) {
        if (activeField === 'name' && editName.trim()) {
          setActiveField('command');
          return;
        }
        saveEdit();
        return;
      }
      if (key.backspace || key.delete) {
        if (activeField === 'name') setEditName((s) => s.slice(0, -1));
        else setEditCommand((s) => s.slice(0, -1));
        return;
      }
      if (char && !key.ctrl && !key.meta) {
        if (activeField === 'name') setEditName((s) => s + char);
        else setEditCommand((s) => s + char);
      }
      return;
    }

    // ── Confirm delete ───────────────────────────────────────────────────────
    if (mode === 'confirm-delete') {
      if (char === 'y') deleteSelected();
      else setMode('list');
      return;
    }

    // ── List mode ────────────────────────────────────────────────────────────
    if (key.escape || char === 'q') {
      useAppStore.setState({ view: 'shell' });
      return;
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(aliases.length, c + 1)); // aliases.length = "+ Add" row
      return;
    }
    if (key.return) {
      if (safeCursor === aliases.length) {
        openAdd();
      } else if (selected) {
        openEdit(selected);
      }
      return;
    }
    if (char === 'n' || char === 'N') {
      openAdd();
      return;
    }
    if ((char === 'd' || char === 'D') && selected && safeCursor < aliases.length) {
      setMode('confirm-delete');
      return;
    }
  });

  // ── Edit form render ───────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color={theme.primary} bold>
            {editIsNew ? '+ New Alias' : `Edit: ${editName}`}
          </Text>
        </Box>

        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text color={activeField === 'name' ? 'cyan' : 'gray'}>Name:    </Text>
            <Text color={activeField === 'name' ? 'white' : 'gray'}>
              {editName || ' '}
            </Text>
            {activeField === 'name' && <Text color="cyan">▌</Text>}
          </Box>
          <Box>
            <Text color={activeField === 'command' ? 'cyan' : 'gray'}>Command: </Text>
            <Text color={activeField === 'command' ? 'white' : 'gray'}>
              {editCommand || ' '}
            </Text>
            {activeField === 'command' && <Text color="cyan">▌</Text>}
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Tab/↑↓: switch field  Enter: save  Esc: cancel</Text>
        </Box>
      </Box>
    );
  }

  // ── List render ────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Aliases</Text>
        <Text dimColor>  ({aliases.length} defined)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>↑↓: navigate  Enter/E: edit  N: new  D: delete  Esc: back</Text>
      </Box>

      <Box flexDirection="column">
        {aliases.length === 0 && (
          <Text dimColor>(no aliases defined)</Text>
        )}
        {aliases.map((alias, i) => {
          const isSelected = i === safeCursor;
          return (
            <Box key={alias.name}>
              <Text bold={isSelected}>{isSelected ? '▶ ' : '  '}</Text>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {alias.name.padEnd(16).slice(0, 16)}
              </Text>
              <Text dimColor>→ </Text>
              <Text color="gray" wrap="truncate">{alias.command}</Text>
            </Box>
          );
        })}

        {/* Add new row */}
        {(() => {
          const isSelected = safeCursor === aliases.length;
          return (
            <Box marginTop={aliases.length > 0 ? 1 : 0}>
              <Text bold={isSelected}>{isSelected ? '▶ ' : '  '}</Text>
              <Text color={isSelected ? 'green' : 'gray'}>+ Add new alias</Text>
            </Box>
          );
        })()}
      </Box>

      {mode === 'confirm-delete' && selected && (
        <Box marginTop={1}>
          <Text color="yellow">Delete &quot;{selected.name}&quot;? (y/n)</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{safeCursor + 1}/{aliases.length + 1}</Text>
      </Box>
    </Box>
  );
};
