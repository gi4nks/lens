# Lens Shell - AI-Augmented Command Line Interface

Lens Shell is a professional, TUI-based intelligent wrapper for your terminal. It bridges the gap between natural language intent and shell execution with a focus on safety, real-time feedback, and a premium experience.

## 🎯 Core Value Proposition
- **Hybrid Intelligence**: Automatically detects whether you're typing a known system command (executed immediately) or a natural language request (translated via AI).
- **Real-Time Streaming**: Commands are executed in a live viewport, allowing you to see output line-by-line as it happens with scrollable history.
- **Privacy-First (Ollama)**: Uses local LLMs via Ollama by default, ensuring your terminal history and file snippets never leave your machine.

## 🗺️ Functional Map

### 1. Command Execution & Generation
- **Instant Execution**: Native commands run instantly.
- **Interactive Passthrough**: Full support for running commands inside the wrapper.
- **Live Streaming TUI**: Combined stdout/stderr streaming into a scrollable viewport with direction indicators (↑/↓).
- **Smart Context**: Automatically injects project metadata (Git branch, file snippets, runtime versions) into the AI prompt.
- **Orchestration Plans**: AI can propose and execute multi-step sequences.

### 2. Modern Terminal UX
- **Interactive TUI**: Built with React and Ink, featuring a responsive layout, theming, and persistent footer.
- **Tab Cycling**: Advanced autocompletion for system commands, local files, and internal `/` commands with visual selection.
- **Ghost Suggestions**: Predictive text suggests your next likely command in gray (accept with `→`).
- **Persistent History**: Cross-session history navigation using Arrow keys (Up/Down).

### 3. Personalization & Safety
- **AI Aliases**: Save complex NL queries as reusable shortcuts.
- **Model Switching**: Use `/model` inside the TUI to browse and switch between Ollama tags or Gemini models.
- **Secure History**: Automatically redacts secrets (keys, tokens, passwords) from logs.

## 🛠️ Architecture
- `src/cli.ts`: Main CLI entry point.
- `src/ui/App.tsx`: Main React Ink TUI (State machine with real-time streaming and tab-cycling).
- `src/engine/`: Streaming execution engine with native passthrough.
- `src/modules/`: Environment detection logic (Git, Node, etc.).
- `src/ai/`: Unified Provider interface for Ollama, Gemini, OpenAI, etc.

## 🚀 Integration
Lens provides a full-screen interactive session via the `lens` command and no longer hooks into the shell precmd. Run `lens` directly whenever you need an AI-augmented terminal environment.

## 🚢 Git & Releases Strategy

### Conventional Commits
Lens Shell follows **Conventional Commits** for all version control operations.
- **Mandate**: When performing a commit, always use the prefix format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`, `test:`, or `build:`.
- **Automated Releases**: The GitHub Actions workflow (CI/CD) uses these prefixes to automatically calculate semantic version jumps (Major/Minor/Patch).

### CI/CD Guidelines
- **CI**: On every pull request and push to `main`, linting, testing, and building are mandatory.
- **Semantic Release**: Versioning, changelog generation, and tagging are fully automated via `semantic-release`. Manual versioning in `package.json` is discouraged.
- **Release Tags**: Tags (e.g., `v1.0.0`) are generated automatically. Do not create them manually unless establishing a new baseline.
