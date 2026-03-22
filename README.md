# 👓 Lens Shell

**Lens Shell** is an AI-powered terminal assistant. It acts as an intelligent TUI wrapper that helps you write, explain, and execute commands safely using either local LLMs (via **Ollama**) or cloud models (via **Google Gemini**).

Inspired by the speed of modern CLIs and the utility of AI assistants, Lens provides a premium TUI (Terminal User Interface) built with **React and Ink** for your daily tasks.

---

## ✨ Features

- **🚀 Hybrid Workflow**: Type `ls` to run it instantly, or type "find large files" to get an AI suggestion.
- **📺 Real-Time Streaming**: Watch your commands execute line-by-line in a beautiful, scrollable viewport.
- **👻 Ghost Suggestions**: Predictive text suggests your next likely command in gray (accept with `→`).
- **🛡️ Safety First**: Destructive commands (like `rm -rf`) are automatically flagged for confirmation. History automatically redacts secrets.
- **🧠 Smart Context**: Lens automatically "sees" your project type (Node, etc.) and Git status to give better advice.
- **🏠 Privacy-First**: Default integration with **Ollama** means your data stays on your machine.

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
- **Type anything**: Lens decides if it's a command or a request.
- **Tab**: Cycle through autocomplete suggestions (commands, files, or `/` commands).
- **Arrows (Up/Down)**: Navigate command history.
- **Right Arrow (→)**: Accept Ghost Suggestion.

### 💡 Quick Tips
- **Natural Language**: Type `show me the last 5 git commits` and Lens will translate it into `git log -n 5`.
- **Safety**: Try `rm -rf .` and notice how Lens asks for confirmation before executing dangerous commands.
- **Context**: Lens knows you are in a Node.js project if it sees a `package.json`, tailoring its suggestions accordingly.

---

## ⚙️ Configuration

Config is managed internally and stored automatically.
You can use the built-in UI by pressing Tab or executing configuration-related tasks directly in the interactive TUI.

To use **Google Gemini** or other providers (Anthropic, OpenAI), use the internal TUI config menu (`/config` or similar settings menu if available) or set the API keys via the UI.

---

*Built with ❤️ for the terminal community.*
