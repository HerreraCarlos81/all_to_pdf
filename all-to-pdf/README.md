# Project to PDF — AI Facilitator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.0.1-blue)](https://marketplace.visualstudio.com/items?itemName=all-to-pdf)

**Project to PDF** is a Visual Studio Code extension that compiles your entire source code repository into a single, well-structured PDF document — designed to be uploaded to **AI chat models** (ChatGPT, Claude, Gemini, etc.) so they can understand your full project context in one shot.

Stop pasting individual files. Give the AI the whole picture.

## Mission

Modern AI models accept file uploads and can reason about entire codebases — but only if you give them the full context. This extension bridges the gap between your IDE and your AI assistant by generating a PDF that contains:

- Every source file, with **line numbers** for precise referencing
- The **directory tree** so the AI understands the project layout
- A **table of contents** with page numbers for file-level navigation
- **Visual separators** between files so the AI can clearly identify context boundaries

## Features

### PDF Structure

| Page | Content |
|------|---------|
| 1 | **Title page** with project name |
| 2 | **Directory tree** — full ASCII project structure |
| 3+ | **File contents** with line numbers (code) or formatted (data) |
| Last | **Table of contents** — every file → starting page number |
| Footer | Generation date + link to this extension |

### Supported File Types

| Category | Extensions |
|----------|-----------|
| Code | `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.php`, `.rb`, `.go` |
| Data | `.json`, `.csv`, `.xml`, `.yml`, `.yaml` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp` |
| Text | `.txt`, `.md`, `.html`, `.css` |

### Smart File Filtering

- Respects `.gitignore` rules automatically — only the files that matter
- Skips common junk directories: `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `venv`, `coverage`, and more
- Configurable exclude patterns via VS Code settings
- Gracefully handles binary and non-UTF-8 files

## Installation

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X`)
3. Search for **"Project to PDF"**
4. Click **Install**

## Usage

1. **Right-click** any folder in the Explorer view
2. Select **Compile Folder to PDF**
3. Wait for the progress notification
4. Open `PDF Compiled Project.pdf` — upload it to your preferred AI

You can also use the command palette (`Ctrl+Shift+P`) → **Compile Folder to PDF**.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `allToPdf.useGitIgnore` | `true` | Respect `.gitignore` rules when collecting files |
| `allToPdf.exclude` | `[]` | Additional directory or file names to exclude |
| `allToPdf.maxFileSizeKb` | `1024` | Maximum file size in KB to include (0 = no limit) |

## Example Output

```
PDF Compiled Project.pdf
  Page 1  ── Title: "Compiled PDF — Project: my-app"
  Page 2  ── Directory tree
  Pages 3–7 ── File contents with line numbers
  Page 8  ── Table of Contents
  Footer  ── "PDF created on ... with All to PDF extension"
```

## Requirements

- Visual Studio Code 1.88.0 or later
- Node.js 18+ (for development)

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

*Contributions, issues, and feature requests are welcome.*
