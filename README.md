# 👓 Lens Shell

**Lens Shell** is an AI-powered terminal assistant. It acts as an intelligent TUI wrapper that helps you write, explain, and execute commands safely using either local LLMs (via **Ollama**) or cloud models (via **Google Gemini**, **OpenAI**, or **Anthropic**).

Inspired by the speed of modern CLIs and the utility of AI assistants, Lens provides a premium TUI (Terminal User Interface) built with **React and Ink** for your daily tasks.

---

## ✨ Features

- **🚀 Hybrid Workflow**: Type `ls` to run it instantly, or type "find large files" to get an AI suggestion. Lens auto-detects whether your input is a shell command or a natural language request.
- **📺 Real-Time Streaming**: Watch your commands execute line-by-line in a beautiful, scrollable viewport.
- **🎨 Command-Aware Output Rendering**: Output is styled per-command — `ls` listings get file-type colors, `git status` highlights staged/modified/deleted files, `git log` renders commit hashes and metadata in distinct colors.
- **🌈 File Type Colors**: Filenames are colored by type across the entire UI (ls output, tab hints, ghost suggestions): source code in yellow, config files in green, images/audio/video in magenta, archives in red, directories in cyan, and more.
- **👻 Ghost Suggestions**: Predictive text suggests your next likely command in gray (accept with `→`).
- **⚡ Background Tasks**: Run long-lived processes (dev servers, watchers, builds) in the background with `/bg`. A footer badge shows how many tasks are running. Browse, tail output, and kill tasks from a dedicated TUI.
- **🛡️ Safety First**: Destructive commands (like `rm -rf`) are automatically flagged for confirmation.
- **🧠 Smart Context**: Lens automatically detects your project type (Node, Git, etc.) and injects that context into AI queries.
- **🏠 Privacy-First**: Default integration with **Ollama** means your data stays on your machine.
- **🗄️ Persistent History**: Commands, output, exit codes, cwd, and timestamps are stored in a local SQLite database.

---

## 🚀 Installation

### Prerequisites
- [Node.js](https://nodejs.org/) 20 or later.
- (Optional) [Ollama](https://ollama.com/) running locally.

### Build from source
```bash
git clone https://github.com/gi4nks/lens.git
cd lens
npm install
npm run build
npm install -g .
```
*(Alternatively, you can just run `make install` which automates the build and install process)*

---

## 📖 Usage

### Interactive Mode (TUI)
Just run `lens` to enter the full-screen interface.
- **Type anything**: Lens decides if it's a command or a natural language request.
- **Tab**: Cycle through autocomplete suggestions (files, directories, or `/` commands).
- **Up/Down arrows**: Navigate command history.
- **Shift+Up/Down or PageUp/PageDown**: Scroll through output.
- **Right Arrow (→)**: Accept ghost suggestion.
- **Ctrl+C**: Send SIGINT to the running process.
- **[F] key**: Execute the AI-suggested fix when a command fails.

### Slash Commands

| Command | Description |
|---|---|
| `/gpt <prompt>` | Send an explicit AI query; supports multi-step orchestration plans (y/n to execute) |
| `/fix` | AI analysis of the last failed command |
| `/output` | Browse command history stored in the SQLite DB (↑↓ to navigate, Shift+↑↓ to scroll output, Enter to paste command) |
| `/history <query>` | Semantic search over DB history via AI |
| `/bg <cmd>` | Run a command in the background (supports alias expansion and `--cwd /path` override) |
| `/tasks` | Open the background tasks TUI — browse, tail output, kill tasks |
| `/alias` | Open the alias manager TUI (add, edit, delete aliases interactively) |
| `/alias add\|list\|remove` | Manage aliases from the command line |
| `/model <name>` | Switch AI model inline |
| `/theme <name>` | Switch theme: `dark`, `sunset`, `ocean`, `forest`, `mono` |
| `/provider <name>` | Switch AI provider |
| `/config` | View current configuration |
| `/clear` | Clear the output history |
| `/quit` or `/q` | Exit Lens (kills all background tasks first) |

### 💡 Quick Tips
- **Natural Language**: Type `show me the last 5 git commits` and Lens will translate it into `git log -n 5`.
- **Safety**: Try `rm -rf .` and notice how Lens asks for confirmation before executing dangerous commands.
- **AI Fix**: If a command fails, Lens automatically suggests a corrected command. Press `[F]` to run it.
- **Context**: Lens knows you are in a Node.js project if it sees a `package.json`, tailoring its suggestions accordingly.
- **Output Browser**: Use `/output` to browse everything you've run this session and in past sessions, with full output and exit codes.
- **Background Tasks**: Run `make dev` or `npm run watch` in the background with `/bg make dev`. Check the footer for the `⚡ N running` badge, then use `/tasks` to tail output or kill a process.
- **Alias + Background**: Define an alias with `/alias add dev "make dev --cwd ~/myproject"`, then launch it in background with `/bg dev`.

---

## ⚙️ Configuration

Config is managed internally and stored automatically. Use `/config` inside the TUI to view the current configuration.

To use **Google Gemini**, **OpenAI**, or **Anthropic**, switch providers inside the TUI with `/provider <name>` and set your API keys via the UI.

### Themes

| Theme | Description |
|---|---|
| `dark` | Dark Classic (default) |
| `sunset` | Warm gradient tones |
| `ocean` | Deep blue palette |
| `forest` | Green-tinted |
| `mono` | Monochrome |

Switch themes at any time with `/theme <name>`.

---

*Built with ❤️ for the terminal community.*
