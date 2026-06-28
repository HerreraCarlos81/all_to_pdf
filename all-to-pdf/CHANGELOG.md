# Change Log

## [0.0.2] — 2026-06-28

### Added
- Line numbers on all code file contents
- Project directory tree as the second page
- Table of Contents page with page numbers for every file
- Visual separator lines between file headers and content
- File filtering: skips `node_modules`, `.git`, `dist`, `build`, and more
- `.gitignore` rule support (opt-out via `allToPdf.useGitIgnore`)
- Three configurable settings: `useGitIgnore`, `exclude`, `maxFileSizeKb`
- Progress notification during PDF generation

### Fixed
- Multi-line content now renders correctly (pdf-lib `drawText` doesn't handle `\n`)
- Courier monospace font for code readability
- Binary files no longer crash the generation process
- Page-break logic: clean breaks between lines instead of mid-word

### Changed
- Extracted core logic into `pdfGenerator.js` for testability
- Mocha unit test suite with 16 tests

## [0.0.1] — Initial release
- Basic PDF generation from project folders
- Support for code, data, image, and text files
- Header page and footer with GitHub link
- Context menu integration
