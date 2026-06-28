# Project to PDF — AI Facilitator

[![Version](https://img.shields.io/badge/version-0.0.1-blue)](https://marketplace.visualstudio.com/items?itemName=all-to-pdf)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Project to PDF** is a Visual Studio Code extension that compiles your entire project folder into a single, well-structured PDF document — optimized for sharing with AI models, code review, and documentation archival.

## Why?

- **AI context upload** — give your AI chatbot the full codebase in one file
- **Code review** — share a portable, paginated document with reviewers
- **IP archival** — snapshot your project state with metadata and structure

## Features

### PDF Structure
Each generated PDF includes:

- **Title page** with project name
- **Directory tree** — ASCII project structure for instant orientation
- **File contents** with **line numbers** on all code files
- **Visual separators** between files for clear AI context boundaries
- **Table of contents** — every file listed with its starting page number
- **Footer** with generation date and link to the extension repository

### Supported File Types

| Category | Extensions |
|----------|-----------|
| Code | `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.php`, `.rb`, `.go` |
| Data | `.json`, `.csv`, `.xml`, `.yml`, `.yaml` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp` |
| Text | `.txt`, `.md`, `.html`, `.css` |

### Smart File Filtering
- Respects `.gitignore` rules automatically
- Skips common junk directories: `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `venv`, `vendor`, `coverage`, and more
- Configurable exclude patterns via VS Code settings
- Gracefully handles binary files without crashing

## Installation

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X`)
3. Search for **"Project to PDF"**
4. Click **Install**

## Usage

1. **Right-click** any folder in the Explorer view
2. Select **Compile Folder to PDF** from the context menu
3. Wait for the progress notification to complete
4. Find `PDF Compiled Project.pdf` in the selected folder

You can also run the command palette (`Ctrl+Shift+P`) and search for **Compile Folder to PDF**.

## Extension Settings

This extension contributes the following settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `allToPdf.useGitIgnore` | `true` | Respect `.gitignore` rules when collecting files |
| `allToPdf.exclude` | `[]` | Additional directory or file names to exclude (e.g., `my-secrets`) |
| `allToPdf.maxFileSizeKb` | `1024` | Maximum file size in KB to include (0 for no limit) |

## Example Output

```
PDF Compiled Project.pdf
├── Page 1 — Title: "Compiled PDF — Project: my-app"
├── Page 2 — Directory tree
├── Pages 3–7 — File contents (numbered lines)
├── Page 8 — Table of Contents
└── Footer with date & extension link
```

## Requirements

- Visual Studio Code 1.88.0 or later
- Node.js 18+ (for development)

## License

[MIT](LICENSE)

---

*Contributions and suggestions are welcome!*
