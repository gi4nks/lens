# Lens Shell — Technical Reference for AI Agents

This document is a comprehensive technical reference for agents working on the Lens Shell codebase. Read this before making changes.

---

## Overview

Lens Shell is a full-screen TUI terminal assistant built with **React + Ink**. It wraps a real PTY (via `@lydell/node-pty`) running the user's shell (zsh/bash/fish). Input is classified as either a native shell command (executed directly in the PTY) or natural language (sent to an AI provider). Output is rendered with per-command styling.

---

## Architecture: File Map

```
src/
  cli.ts                        Entry point. Renders the Ink app.
  ui/
    App.tsx                     Root TUI component. Orchestrates all state, PTY events, AI calls, slash-command dispatch.
    GhostPrompt.tsx             Input row: text input, ghost text, hints bar, [F] fix suggestion.
    OutputRenderer.tsx          Command-aware output renderer (ls, git status, git log, default).
    fileColors.ts               Maps filenames/extensions to theme-consistent colors.
    themes.ts                   Theme definitions (dark, sunset, ocean, forest, mono).
    OutputView.tsx              /output command: SQLite DB browser UI.
    HistoryView.tsx             /history view.
    ConfigView.tsx              /config view.
    SuggestionsView.tsx         NL suggestion picker (multi-step plan UI).
    TasksView.tsx               /tasks view: background task list with filter, kill, clear.
    TaskOutputView.tsx          Full-screen output view for a selected background task.
    AliasView.tsx               /alias TUI: interactive alias manager (add/edit/delete).
  pty/
    ShellManager.ts             PTY lifecycle, shell init scripts, OSC 7/9001 parsing.
  tasks/
    BackgroundTaskManager.ts    Background process manager via child_process.spawn. Singleton.
                                Emits add/output/update events wired to the Zustand store.
  modules/
    ContextParser.ts            isShellCommand() heuristic + getHints() autocomplete.
  store/
    index.ts                    Zustand state store. Single source of truth for all UI state.
  db/
    LensDB.ts                   SQLite persistence via better-sqlite3.
  history/
    HistoryManager.ts           Text-based command history log (cross-session).
  safety/
    SafetyChecker.ts            Dangerous command detection. Prompts y/n confirmation.
  ai/
    Provider.ts                 Unified AI provider interface (Ollama, Gemini, OpenAI, Anthropic).
  alias/
    AliasManager.ts             Alias storage (~/.lens_aliases.json) and resolution.
  engine/
    OrchestrationEngine.ts      Parses multi-step AI plans; returns steps for y/n confirmation.
  analyzer/
    ProjectAnalyzer.ts          Detects project type (Node, Git, etc.) for AI context injection.
```

---

## PTY Layer (`src/pty/ShellManager.ts`)

- Spawns the user's `$SHELL` (defaults to `/bin/zsh`; Windows falls back to `powershell.exe`).
- Before spawning, writes a custom shell init script to a temp directory:
  - **zsh**: writes a `.zshrc` to `$TMPDIR/lens-zsh/` and sets `ZDOTDIR` to that directory. The script sources the user's real `.zshrc` after applying Lens overrides.
  - **bash**: writes a temp `--rcfile` script.
  - **fish**: passes `-C` with an inline init string.
- All init scripts: run `stty -echo -icrnl` to suppress echo and carriage-return translation; blank all prompt variables (`PS1`, `PROMPT`, `RPROMPT`); inject `chpwd`/`PROMPT_COMMAND`/`fish_postexec` hooks that emit **OSC 7** (cwd) and **OSC 9001** (exit code) after every command.
- Raw PTY data is cleaned before passing to the Ink render layer: `\r\n` → `\n`, standalone `\r` stripped, cursor-movement ANSI sequences stripped (keeps only SGR `m` color codes), all OSC sequences stripped from the visible stream.
- OSC sequences are intercepted from the *raw* data (before stripping) via regex: OSC 7 updates `cwd` state; OSC 9001 updates `exitCode` state and clears `isBusy`.
- Exposes: `start()`, `write(cmd)`, `sendSignal(signal)`, `resize(cols, rows)`, `stop()`. Emits events: `data`, `cwd`, `exitCode`, `exit`.

---

## Hybrid Input (`src/modules/ContextParser.ts`)

`ContextParser.isShellCommand(input)` decides how to route each submission:

1. Empty input → shell.
2. Input starting with `/` → treated as shell (slash commands are intercepted upstream in `App.tsx` before reaching the PTY).
3. First word is in a hardcoded builtin list (`cd`, `ls`, `git`, `npm`, `yarn`, `node`, `go`, `python`, `cat`, `cp`, `mv`, `pwd`, `clear`, `bash`, `zsh`, `touch`, `docker`, `brew`, `sudo`).
4. First word starts with `./` or `/` → shell.
5. Falls back to `which <firstWord>` via `execSync`; if exit code is 0, it's a shell command.
6. Otherwise → natural language, routed to the AI provider.

`ContextParser.getHints(input, cwd)` returns tab-completion candidates:
- Empty input → all slash commands.
- Input starts with `/` → matching slash commands.
- Otherwise → filesystem completion on the last token (max 5 results), sorted dirs-first then case-insensitive alpha, dirs suffixed with `/`. Hidden files only shown when the prefix starts with `.`.

---

## Output Renderer (`src/ui/OutputRenderer.tsx`)

History entries are first grouped by `groupHistoryForRender()`: consecutive `shell` entries sharing the same `command` value are merged into one `RenderGroup` with multiple lines. Then `OutputRenderer` dispatches to a per-command renderer based on the base command and (for git) the subcommand:

| Command pattern | Renderer | Behavior |
|---|---|---|
| `ls`, `ll`, `la`, `l` | `LsRenderer` | Strips ANSI, detects long-format by looking for permission strings (`drwxr-xr-x` pattern). Short format: splits on 2+ spaces, colors each token via `getFileColor`. Long format: renders perms+meta dim, filename by type, symlink targets dim. |
| `git status` / `git st` | `GitStatusRenderer` | Branch line → primary (cyan); staged (M/A/R/C) → success (green); modified → warning (yellow); deleted → error (red); untracked (`??`) → dim. |
| `git log` | `GitLogRenderer` | Commit hash → warning (yellow) bold; Author value → accent (blue); Date value → success (green); message lines → default. |
| `git diff`, `git show`, other git subcommands | `DefaultRenderer` | ANSI passthrough (git already colorizes these). |
| Everything else | `DefaultRenderer` | ANSI passthrough. |

`RenderGroup` type:
```ts
interface RenderGroup {
  type: 'shell' | 'ai' | 'system';
  command: string | undefined;
  lines: string[];
}
```

---

## File Colors (`src/ui/fileColors.ts`)

`getFileColor(filename, theme)` returns an Ink-compatible color string. Resolution order:

1. Ends with `/` → `theme.primary` (directory).
2. Starts with `.` → `theme.dim` (hidden file).
3. Extension lookup:
   - Source code (ts/tsx/js/jsx/py/rs/go/java/kt/c/cpp/swift/rb/php/lua/dart/zig/...) → `theme.warning` (yellow)
   - Web/markup (html/css/scss/vue/svelte/astro) → `theme.accent` (blue)
   - Config/data (json/yaml/toml/env/xml/csv/prisma/graphql/proto) → `theme.success` (green)
   - Shell scripts (sh/zsh/bash/fish/ps1/bat) → `theme.success` (green)
   - Images (png/jpg/svg/heic/avif/raw/...) → `theme.secondary` (magenta)
   - Audio/video (mp3/mp4/mov/mkv/wav/flac/...) → `theme.secondary` (magenta)
   - Archives (zip/tar/gz/7z/rar/dmg/deb/rpm/...) → `theme.error` (red)
   - Documents (md/txt/pdf/epub/tex/rst/adoc) → `'white'`
   - Lock/generated (lock/map/snap/patch) → `theme.dim`
4. No extension → well-known name check:
   - `makefile`, `dockerfile`, `containerfile`, `vagrantfile`, `procfile`, `brewfile`, `gemfile`, `rakefile` → `theme.success`
   - `license`, `readme`, `changelog`, `authors`, `contributors`, `notice`, `copying` → `'white'`
   - Everything else → `theme.dim`

This function is used in: `OutputRenderer.tsx` (ls listings), `GhostPrompt.tsx` (tab hint bar).

---

## Themes (`src/ui/themes.ts`)

`Theme` interface fields: `name`, `primary`, `secondary`, `accent`, `success`, `warning`, `error`, `dim`, `bg`.

| Theme key | Name | primary | secondary | accent | notes |
|---|---|---|---|---|---|
| `dark` | Dark Classic | cyan | magenta | blue | Default |
| `sunset` | Sunset | orange | magenta | yellow | Warm tones |
| `ocean` | Deep Ocean | blue | cyan | white | Cool tones |
| `forest` | Forest | green | yellow | white | |
| `mono` | Monochrome | white | white | gray | All colors map to white/gray |

The active theme name is stored in Zustand state and resolved in components via `THEMES[currentThemeName] || THEMES.dark`.

---

## Slash Commands

Slash commands are intercepted in `App.tsx` before any PTY write. The `/` prefix causes `ContextParser.isShellCommand()` to return `true`, but `App.tsx` checks for the `/` prefix first and dispatches internally.

| Command | Behavior |
|---|---|
| `/gpt <prompt>` | Sends prompt to AI provider. If AI returns a multi-step plan, `OrchestrationEngine` parses it and presents a y/n confirmation via `SuggestionsView`. |
| `/fix` | Sends the last failed command + its output to the AI for analysis and a suggested fix. |
| `/output` | Opens `OutputView`: SQLite-backed browser of past commands. ↑↓ navigate entries; Shift+↑↓ scroll the output panel; Enter pastes the command into the prompt. |
| `/history <query>` | Semantic search over SQLite history via AI. |
| `/bg <cmd>` | Spawns `<cmd>` via `child_process.spawn` (not PTY) in the background. Supports alias expansion and `--cwd /path` override. Output capped at 500 lines in-memory. |
| `/tasks` | Opens `TasksView`: list of background tasks with status, elapsed time, filter, kill (K), clear done (D). Enter opens `TaskOutputView` for full-screen output tail. |
| `/alias` | Opens `AliasView`: interactive TUI for managing aliases (↑↓ navigate, N: new, Enter: edit, D: delete). |
| `/alias add <name> <value>` | Stores an alias via `AliasManager` (CLI shorthand, also works inside `AliasView`). |
| `/alias list` | Lists all aliases. |
| `/alias remove <name>` | Removes an alias. |
| `/model <name>` | Updates the AI model in the store. |
| `/theme <name>` | Updates the theme in the store (one of: dark, sunset, ocean, forest, mono). |
| `/provider <name>` | Updates the AI provider in the store. |
| `/config` | Renders `ConfigView`. |
| `/clear` | Clears the in-memory history entries. |
| `/quit` or `/q` | Kills all background tasks via `taskManager.killAll()` then calls `process.exit(0)`. |

---

## Background Task System (`src/tasks/BackgroundTaskManager.ts`)

`BackgroundTaskManager` (singleton exported as `taskManager`) manages long-lived background processes independently of the main PTY shell.

**Key design points:**
- Uses `child_process.spawn(shell, ['-c', command], { stdio: ['ignore', 'pipe', 'pipe'] })` — not a PTY. This allows true background execution while the shell stays interactive.
- Each task is identified by a short random ID and stored in the Zustand `backgroundTasks[]` array.
- Output (stdout + stderr merged) is accumulated in `task.output: string[]`, capped at **500 lines** (oldest lines are dropped).
- Task output is in-memory only — not persisted to SQLite.
- Events emitted: `add` (new task), `output` (new lines), `update` (status/pid/exitCode changes).
- The store is wired lazily via `wireTaskManagerToStore()` called once at app bootstrap in `App.tsx`, using a dynamic `import()` to avoid circular module dependencies.

**`BackgroundTask` interface:**
```ts
interface BackgroundTask {
  id: string;         // short random ID
  label: string;      // first token of command, or alias name
  command: string;    // full expanded command
  cwd: string;        // working directory at spawn time
  status: 'running' | 'done' | 'failed' | 'killed';
  pid?: number;
  output: string[];   // last 500 lines
  startTime: number;  // epoch ms
  endTime?: number;
  exitCode?: number;
}
```

**Footer badge:** `Footer.tsx` reads `backgroundTasks` from the store and renders `⚡ N running` in yellow when any task has `status === 'running'`.

**`/bg` alias expansion:** `App.tsx` calls `aliasManager.expand(rawCmd)` before spawning, so `/bg dev` with alias `dev → make dev` correctly runs `make dev` in the background.

---

## SQLite Persistence (`src/db/LensDB.ts`)

Uses `better-sqlite3`. Stores one row per command execution with: command text, full output, exit code, cwd, timestamp. Accessed by `/output` (full browser) and `/history` (AI semantic search). The DB file lives in the user's data directory.

---

## AI Providers (`src/ai/Provider.ts`)

Unified interface wrapping: **Ollama** (default, local), **Google Gemini**, **OpenAI**, **Anthropic**. Provider and model are runtime-switchable via `/provider` and `/model` without restarting.

---

## Safety Checker (`src/safety/SafetyChecker.ts`)

Intercepts commands before PTY write. Flags patterns matching destructive operations (e.g. `rm -rf`, `chmod 777`, `dd`, `mkfs`, format operations). When flagged, renders an inline y/n prompt. The user must explicitly confirm before the command is written to the PTY.

---

## Key Design Decisions

- **No shell hook**: Lens does not modify `~/.zshrc` or any shell startup file permanently. Shell integration is injected via a temporary `ZDOTDIR` or `--rcfile` at spawn time and is fully cleaned up.
- **OSC for state, not parsing stdout**: PTY output is not parsed for exit codes or cwd. The shell hooks emit OSC 7 and OSC 9001 sequences which are intercepted on the raw data stream, decoupled from visible output.
- **Ink rendering is read-only**: The PTY writes directly to `ShellManager`, not through any React state path. React state only holds the *log* of completed lines for re-rendering the scrollable history. There is no "live" output box — all output is accumulated into the `HistoryEntry[]` array in the Zustand store.
- **`isShellCommand` is a heuristic, not a parser**: It uses a builtin allowlist + `which` to decide routing. If `which` is unavailable or slow, it degrades gracefully (returns `false`, sending input to AI).
- **Renderer dispatch is stateless**: `OutputRenderer` derives the renderer purely from the `command` field of the `RenderGroup`. There is no per-session or per-run state in the renderer.
- **File colors are theme-relative**: `getFileColor` takes the active `Theme` object and returns theme role values (`theme.warning`, etc.), not hardcoded color strings. This ensures colors stay coherent across all five themes.

---

## Git & Release Strategy

Lens Shell follows **Conventional Commits**. Always use the prefix format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`, `test:`, or `build:`.

Versioning, changelog generation, and tagging are fully automated via `semantic-release`. Do not create version tags or edit `package.json` version manually.

CI runs on every push and pull request to `main`: linting, building, and tests are mandatory gates.
