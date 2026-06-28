/**
 * @fileoverview Core PDF generation engine for Project to PDF extension.
 * Handles file collection, content rendering, and PDF assembly.
 */

const fs = require('fs-extra');
const pdf = require('pdf-lib');
const path = require('path');
const ignore = require('ignore');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A4 landscape page dimensions in points (1 pt = 1/72 inch). */
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

/** Content area margins in points. */
const MARGIN_LEFT = 50;
const MARGIN_BOTTOM = 50;
const MARGIN_TOP = 60;

/** Directories ignored by default when scanning a project. */
const DEFAULT_SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'target', 'out', '.output', '.vercel', '.cache',
    '__pycache__', '.venv', 'venv', 'env', '.env',
    'vendor', '.bundle', 'coverage', '.nyc_output'
]);

/** Files ignored by default when scanning a project. */
const DEFAULT_SKIP_FILES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.DS_Store', 'Thumbs.db'
]);

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

/**
 * Loads .gitignore rules from a directory using the `ignore` library.
 * @param {string} folderPath - Directory to look for .gitignore in.
 * @returns {Promise<object>} An ignore filter instance (empty if no .gitignore).
 */
async function loadGitIgnoreRules(folderPath) {
    const filter = ignore();
    const gitignorePath = path.join(folderPath, '.gitignore');
    try {
        const content = await fs.readFile(gitignorePath, 'utf8');
        filter.add(content);
    } catch {
        // No .gitignore file present — that is fine.
    }
    return filter;
}

/**
 * Determines whether a file system entry should be skipped during collection.
 * @param {string} entryPath - Full path to the entry.
 * @param {string} entryName - File or directory name.
 * @param {boolean} isDir - Whether the entry is a directory.
 * @param {object} options - Collection options.
 * @param {Set<string>} options.skipDirs - Directory names to skip.
 * @param {Set<string>} options.skipFiles - File names to skip.
 * @param {object|null} options.gitIgnoreFilter - .gitignore filter instance.
 * @param {string} options.rootPath - Root path for relative path calculation.
 * @returns {boolean} True if the entry should be excluded.
 */
function shouldSkip(entryPath, entryName, isDir, options) {
    const { skipDirs, skipFiles, gitIgnoreFilter, rootPath } = options;

    if (isDir) {
        if (skipDirs.has(entryName)) return true;
    } else {
        if (skipFiles.has(entryName)) return true;
    }

    if (gitIgnoreFilter) {
        const relativePath = path.relative(rootPath, entryPath).replace(/\\/g, '/');
        if (gitIgnoreFilter.ignores(relativePath)) return true;
        if (isDir && gitIgnoreFilter.ignores(`${relativePath}/`)) return true;
    }

    return false;
}

/**
 * Recursively collects all files inside a directory, applying filters.
 * @param {string} folderPath - Directory to scan.
 * @param {object} [options={}] - Filtering options (see shouldSkip).
 * @returns {Promise<string[]>} List of absolute file paths.
 */
async function collectFiles(folderPath, options = {}) {
    const files = [];
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        if (entry.isDirectory()) {
            if (shouldSkip(fullPath, entry.name, true, options)) continue;
            const subFiles = await collectFiles(fullPath, options);
            files.push(...subFiles);
        } else {
            if (shouldSkip(fullPath, entry.name, false, options)) continue;
            files.push(fullPath);
        }
    }

    return files;
}

// ---------------------------------------------------------------------------
// Tree generation
// ---------------------------------------------------------------------------

/**
 * Builds an ASCII directory tree from a list of file paths.
 * @param {string[]} files - Absolute file paths.
 * @param {string} rootPath - Root directory for relative path calculation.
 * @returns {string} ASCII tree representation.
 */
function generateProjectTree(files, rootPath) {
    const root = {};
    for (const file of files) {
        const relative = path.relative(rootPath, file);
        const parts = relative.split(path.sep);
        let node = root;
        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            const isLeaf = index === parts.length - 1;
            if (isLeaf) {
                node[part] = null;
            } else {
                if (!node[part] || node[part] === null) node[part] = {};
                node = node[part];
            }
        }
    }
    return renderTreeLines(root, '');
}

/**
 * Recursively renders a tree node into ASCII lines.
 * Directories come first, then files, both sorted alphabetically.
 * @param {object} node - Tree node (key → child node or null for file).
 * @param {string} prefix - Indentation prefix for the current level.
 * @returns {string} Rendered ASCII tree.
 */
function renderTreeLines(node, prefix) {
    const entries = Object.entries(node).sort((first, second) => {
        const firstIsDir = first[1] !== null;
        const secondIsDir = second[1] !== null;
        if (firstIsDir && !secondIsDir) return -1;
        if (!firstIsDir && secondIsDir) return 1;
        return first[0].localeCompare(second[0]);
    });

    let result = '';
    for (let index = 0; index < entries.length; index++) {
        const [key, value] = entries[index];
        const isLast = index === entries.length - 1;
        const connector = isLast ? '|__ ' : '|-- ';
        const suffix = value !== null ? '/' : '';
        result += prefix + connector + key + suffix + '\n';
        if (value !== null) {
            const childPrefix = prefix + (isLast ? '    ' : '|   ');
            result += renderTreeLines(value, childPrefix);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Text formatting
// ---------------------------------------------------------------------------

/**
 * Prepends line numbers to each line of text.
 * Numbers are zero-padded to match the width of the highest line number.
 * @param {string} content - Raw text content.
 * @param {number} startLine - Starting line number.
 * @returns {string} Content with formatted line numbers.
 */
function addLineNumbers(content, startLine) {
    const lines = content.split('\n');
    const digits = String(lines.length + startLine - 1).length;
    return lines.map((line, index) => {
        const number = String(startLine + index).padStart(digits, ' ');
        return `${number} | ${line}`;
    }).join('\n');
}

// ---------------------------------------------------------------------------
// PDF content renderers
// ---------------------------------------------------------------------------

/**
 * Draws a file header (path + separator line) at the top of a PDF page.
 * @param {object} page - pdf-lib PDFPage instance.
 * @param {string} filePathText - File path label to display.
 * @param {object} font - pdf-lib PDFFont instance.
 */
function drawFileHeader(page, filePathText, font) {
    page.drawText(filePathText, { x: MARGIN_LEFT, y: PAGE_HEIGHT - 45, size: 9, font });
    page.drawLine({
        start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - 50 },
        end: { x: PAGE_WIDTH - MARGIN_LEFT, y: PAGE_HEIGHT - 50 },
        thickness: 0.5,
        color: pdf.rgb(0.6, 0.6, 0.6),
    });
}

/**
 * Renders text content across one or more PDF pages with word wrapping.
 * Draws the file path header once on the first page of each file.
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {string} filePathText - File path displayed on the first page.
 * @param {string} content - Text content to render (lines separated by \n).
 * @param {object} font - pdf-lib PDFFont instance.
 * @param {number} fontSize - Font size in points.
 * @param {number} lineHeight - Vertical space per line in points.
 * @param {number} maxWidth - Maximum line width in points before wrapping.
 */
async function addContentPages(pdfDoc, filePathText, content, font, fontSize, lineHeight, maxWidth) {
    const lines = content.split('\n');
    let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let currentY = PAGE_HEIGHT - MARGIN_TOP;
    let headerDrawn = false;

    for (const line of lines) {
        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
            const candidateLine = currentLine ? `${currentLine} ${word}` : word;
            const lineWidth = font.widthOfTextAtSize(candidateLine, fontSize);

            if (lineWidth > maxWidth && currentLine) {
                // Flush the current line and start a new one with the overflow word
                if (currentY - lineHeight < MARGIN_BOTTOM) {
                    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                    currentY = PAGE_HEIGHT - MARGIN_TOP;
                    headerDrawn = false;
                }
                if (!headerDrawn) {
                    drawFileHeader(currentPage, filePathText, font);
                    headerDrawn = true;
                }
                currentPage.drawText(currentLine, { x: MARGIN_LEFT, y: currentY, size: fontSize, font, maxWidth });
                currentY -= lineHeight;
                currentLine = word;
            } else {
                currentLine = candidateLine;
            }
        }

        // Flush the remainder of the current source line
        if (currentY - lineHeight < MARGIN_BOTTOM) {
            currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            currentY = PAGE_HEIGHT - MARGIN_TOP;
            headerDrawn = false;
        }
        if (!headerDrawn) {
            drawFileHeader(currentPage, filePathText, font);
            headerDrawn = true;
        }
        currentPage.drawText(currentLine, { x: MARGIN_LEFT, y: currentY, size: fontSize, font, maxWidth });
        currentY -= lineHeight;
    }
}

/**
 * Adds the cover page with the project name.
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {string} folderName - Project folder name.
 */
function addTitlePage(pdfDoc, folderName) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText(`Compiled PDF\n\nProject: ${folderName}`, { x: 300, y: PAGE_HEIGHT - 200, size: 36 });
}

/**
 * Adds a page displaying the ASCII project directory tree.
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {string} treeText - ASCII tree string.
 * @param {string} folderName - Project folder name.
 * @param {number} fileCount - Total number of collected files.
 */
async function addTreePage(pdfDoc, treeText, folderName, fileCount) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
    const lines = treeText.split('\n').filter(line => line.trim().length > 0);
    let currentY = PAGE_HEIGHT - MARGIN_TOP + 10;

    page.drawText(`Project Structure: ${folderName}`, { x: MARGIN_LEFT, y: currentY, size: 14, font });
    currentY -= 30;

    const separator = '='.repeat(50);
    page.drawText(separator, { x: MARGIN_LEFT, y: currentY, size: 10, font });
    currentY -= 20;

    for (const line of lines) {
        page.drawText(line, { x: MARGIN_LEFT, y: currentY, size: 8, font });
        currentY -= 12;
    }

    currentY -= 10;
    page.drawText(`(${fileCount} files total)`, { x: MARGIN_LEFT, y: currentY, size: 10, font });
}

/**
 * Adds a Table of Contents page listing every file and its starting page.
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {Array<{path: string, page: number}>} tocEntries - File path and page number pairs.
 */
async function addTableOfContentsPage(pdfDoc, tocEntries) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
    let currentY = PAGE_HEIGHT - MARGIN_TOP + 10;

    page.drawText('Table of Contents', { x: MARGIN_LEFT, y: currentY, size: 14, font });
    currentY -= 30;

    const separator = '='.repeat(60);
    page.drawText(separator, { x: MARGIN_LEFT, y: currentY, size: 10, font });
    currentY -= 20;

    for (const entry of tocEntries) {
        if (currentY < MARGIN_BOTTOM + 20) break;
        const pageNumber = String(entry.page);
        const dotGap = '.'.repeat(Math.max(1, 60 - entry.path.length - pageNumber.length - 2));
        page.drawText(`${entry.path} ${dotGap} ${pageNumber}`, { x: MARGIN_LEFT, y: currentY, size: 8, font });
        currentY -= 12;
    }
}

/**
 * Embeds an image file on a new PDF page, scaling it to fit.
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {string} filePathText - File path label.
 * @param {string} file - Absolute path to the image file.
 * @param {string} extension - File extension (e.g. '.png', '.jpg').
 */
async function addImagePage(pdfDoc, filePathText, file, extension) {
    const imageBytes = await fs.readFile(file);
    const image = extension === '.png'
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);

    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const maxDimension = 500;
    let displayWidth = image.width;
    let displayHeight = image.height;

    if (image.width > maxDimension || image.height > maxDimension) {
        const scale = maxDimension / Math.max(image.width, image.height);
        displayWidth = image.width * scale;
        displayHeight = image.height * scale;
    }

    const centerX = (page.getWidth() - displayWidth) / 2;
    const centerY = ((page.getHeight() - displayHeight) / 2) - 20;

    page.drawText(filePathText, { x: MARGIN_LEFT, y: page.getHeight() - 50, size: 10 });
    page.drawImage(image, { x: centerX, y: centerY, width: displayWidth, height: displayHeight });
}

/**
 * Adds a footer bar to the last page with generation date and extension link.
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {string} _folderName - Project folder name (unused, kept for API consistency).
 */
async function addFooterPage(pdfDoc, _folderName) {
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    const generationDate = new Date().toLocaleDateString();
    const footerLabel = `PDF of project created on ${generationDate} with `;
    const linkLabel = 'All to PDF - Ai Facilitator';
    const linkUrl = 'https://github.com/HerreraCarlos81/all_to_pdf';
    const footerSuffix = ' extension for VSCode';
    const fontSize = 10;
    const barWidth = lastPage.getWidth() - 100;
    const barHeight = fontSize * 1.2;
    const barX = 50;
    const barY = 50;

    // Footer background rectangle
    lastPage.drawRectangle({
        x: barX, y: barY, width: barWidth, height: barHeight,
        borderWidth: 1, borderColor: pdf.rgb(0, 0, 0),
    });

    const font = await pdfDoc.embedFont(pdf.StandardFonts.Helvetica);
    const labelWidth = font.widthOfTextAtSize(footerLabel, fontSize);
    const linkWidth = font.widthOfTextAtSize(linkLabel, fontSize);

    lastPage.drawText(footerLabel, {
        x: barX + 10, y: barY + 2, size: fontSize, font, color: pdf.rgb(0, 0, 0),
    });

    const linkX = barX + 10 + labelWidth;
    const linkY = barY + 2;
    lastPage.drawText(linkLabel, {
        x: linkX, y: linkY, size: fontSize, font,
        color: pdf.rgb(0, 0, 1), underline: true,
    });

    // Clickable hyperlink annotation
    const linkAnnotation = pdfDoc.context.obj({
        Type: 'Annot', Subtype: 'Link',
        Rect: [linkX, linkY, linkX + linkWidth, linkY + fontSize],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: linkUrl },
    });
    lastPage.node.addAnnot(linkAnnotation);

    lastPage.drawText(footerSuffix, {
        x: barX + 10 + labelWidth + linkWidth, y: barY + 2,
        size: fontSize, font, color: pdf.rgb(0, 0, 0),
    });
}

/**
 * Sets PDF document metadata (title, author, subject, keywords).
 * @param {object} pdfDoc - pdf-lib PDFDocument instance.
 * @param {string} folderName - Project folder name used as title.
 */
function setDocumentMetadata(pdfDoc, folderName) {
    pdfDoc.setTitle(folderName);
    pdfDoc.setAuthor('Created with All to PDF - AI Facilitator');
    pdfDoc.setSubject('PDF generated from project files');
    pdfDoc.setKeywords([folderName, 'project', 'compilation', 'PDF']);
}

// ---------------------------------------------------------------------------
// Supported file extension lookups
// ---------------------------------------------------------------------------

const CODE_EXTENSIONS = new Set(['.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go']);
const DATA_EXTENSIONS = new Set(['.json', '.csv', '.xml', '.yml', '.yaml']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp']);
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.html', '.css']);

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Scans a project folder and generates a compiled PDF document.
 *
 * The PDF includes: title page → directory tree → file contents (with line
 * numbers for code) → table of contents → footer.
 *
 * @param {string} folderPath - Root folder of the project to compile.
 * @param {object} [options={}] - Generation options.
 * @param {boolean} [options.useGitIgnore=true] - Whether to respect .gitignore.
 * @param {string[]} [options.skipDirs=[]] - Additional directory names to skip.
 * @param {string[]} [options.skipFiles=[]] - Additional file names to skip.
 * @param {number} [options.maxFileSizeKb=1024] - Max file size in KB (0 = no limit).
 * @returns {Promise<{pdfBytes: Uint8Array, folderName: string}>} Generated PDF bytes and folder name.
 */
async function createPDF(folderPath, options = {}) {
    // Merge default and user-provided skip lists
    const skipDirs = new Set([...DEFAULT_SKIP_DIRS, ...(options.skipDirs || [])]);
    const skipFiles = new Set([...DEFAULT_SKIP_FILES, ...(options.skipFiles || [])]);
    const useGitIgnore = options.useGitIgnore !== false;

    // Load .gitignore filtering rules
    let gitIgnoreFilter = null;
    if (useGitIgnore) {
        gitIgnoreFilter = await loadGitIgnoreRules(folderPath);
    }

    // Collect and filter files
    const collectionOptions = { skipDirs, skipFiles, gitIgnoreFilter, rootPath: folderPath };
    const collectedFiles = await collectFiles(folderPath, collectionOptions);

    // Create PDF document
    const pdfDoc = await pdf.PDFDocument.create();
    const folderName = path.basename(folderPath);

    // Title page
    addTitlePage(pdfDoc, folderName);

    // Project tree page
    const treeText = generateProjectTree(collectedFiles, folderPath);
    await addTreePage(pdfDoc, treeText, folderName, collectedFiles.length);

    // Render each file's contents
    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
    const tableOfContents = [];

    for (const file of collectedFiles) {
        const extension = path.extname(file).toLowerCase();

        // Read and sanitize file content
        let rawContent;
        try {
            rawContent = await fs.readFile(file, 'utf8');
            rawContent = rawContent
                .replace(/\r\n/g, '\n')  // Normalize Windows line endings
                .replace(/\r/g, '\n')    // Normalize old Mac line endings
                .replace(/\t/g, '    '); // Replace tabs with spaces (WinAnsi limitation)
        } catch {
            continue; // Skip binary or unreadable files
        }

        const fileLabel = `File: ${file}`;
        const startPage = pdfDoc.getPageCount() + 1;

        if (CODE_EXTENSIONS.has(extension)) {
            const numberedContent = addLineNumbers(rawContent, 1);
            await addContentPages(pdfDoc, fileLabel, numberedContent, font, 8, 10, 740);
        } else if (DATA_EXTENSIONS.has(extension)) {
            try {
                const parsed = extension === '.json' ? JSON.parse(rawContent) : rawContent;
                const formatted = JSON.stringify(parsed, null, 2);
                await addContentPages(pdfDoc, fileLabel, formatted, font, 8, 10, 740);
            } catch {
                await addContentPages(pdfDoc, fileLabel, rawContent, font, 8, 10, 740);
            }
        } else if (IMAGE_EXTENSIONS.has(extension)) {
            try {
                await addImagePage(pdfDoc, fileLabel, file, extension);
            } catch {
                continue;
            }
        } else if (TEXT_EXTENSIONS.has(extension)) {
            await addContentPages(pdfDoc, fileLabel, rawContent, font, 8, 10, 740);
        }

        // Track page number for table of contents
        const endPage = pdfDoc.getPageCount();
        if (endPage >= startPage) {
            tableOfContents.push({
                path: path.relative(folderPath, file).replace(/\\/g, '/'),
                page: startPage,
            });
        }
    }

    // Table of contents and footer
    await addTableOfContentsPage(pdfDoc, tableOfContents);
    await addFooterPage(pdfDoc, folderName);
    setDocumentMetadata(pdfDoc, folderName);

    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, folderName };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

module.exports = {
    createPDF,
    collectFiles,
    addContentPages,
    addTitlePage,
    addImagePage,
    addFooterPage,
    setDocumentMetadata,
    loadGitIgnoreRules,
    shouldSkip,
    DEFAULT_SKIP_DIRS,
    DEFAULT_SKIP_FILES,
    generateProjectTree,
    addLineNumbers,
    addTreePage,
    addTableOfContentsPage,
};
