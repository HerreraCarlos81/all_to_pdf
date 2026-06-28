/**
 * @fileoverview Entry point for the Project to PDF VS Code extension.
 * Registers commands and context menu actions, wires user settings to the
 * PDF generation engine.
 */

const vscode = require('vscode');
const path = require('path');
const { createPDF } = require('./pdfGenerator');

/**
 * Reads the extension's configuration from VS Code settings.
 * @returns {{ useGitIgnore: boolean, skipDirs: string[], maxFileSizeKb: number }}
 */
function readUserSettings() {
    const config = vscode.workspace.getConfiguration('allToPdf');
    return {
        useGitIgnore: config.get('useGitIgnore', true),
        skipDirs: config.get('exclude', []),
        maxFileSizeKb: config.get('maxFileSizeKb', 1024),
    };
}

/**
 * Wraps PDF generation in a VS Code progress notification.
 * @param {string} folderPath - Root folder to compile.
 */
async function generatePdfWithProgress(folderPath) {
    const settings = readUserSettings();

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating project PDF...',
        cancellable: false,
    }, async () => {
        const { pdfBytes, folderName } = await createPDF(folderPath, settings);
        const outputPath = path.join(folderPath, 'PDF Compiled Project.pdf');
        require('fs-extra').writeFile(outputPath, pdfBytes);
        vscode.window.showInformationMessage(
            `PDF successfully generated for "${folderName}" by All-to-PDF Extension!`
        );
    });
}

/**
 * Activates the extension.
 * Registers the command that triggers PDF generation.
 * @param {vscode.ExtensionContext} context - VS Code extension context.
 */
function activate(context) {
    console.log('All-to-PDF extension is now active.');

    // Command palette action
    const commandPaletteHandler = vscode.commands.registerCommand(
        'extension.convertProjectToPDF',
        async (folder) => {
            if (folder && folder.fsPath) {
                await generatePdfWithProgress(folder.fsPath);
            }
        }
    );

    // Explorer context menu action (right-click a folder)
    const contextMenuHandler = vscode.commands.registerCommand(
        'extension.convertProjectToPDFContext',
        async (folder) => {
            if (folder && folder.fsPath) {
                await generatePdfWithProgress(folder.fsPath);
            }
        }
    );

    context.subscriptions.push(commandPaletteHandler, contextMenuHandler);
}

/**
 * Deactivates the extension. Cleanup runs here if needed.
 */
function deactivate() {
    // Nothing to clean up at this time.
}

module.exports = { activate, deactivate };
