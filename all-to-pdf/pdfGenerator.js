const fs = require('fs-extra');
const pdf = require('pdf-lib');
const path = require('path');
const ignore = require('ignore');

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_LEFT = 50;
const MARGIN_BOTTOM = 50;
const MARGIN_TOP = 60;

const DEFAULT_SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'target', 'out', '.output', '.vercel', '.cache',
    '__pycache__', '.venv', 'venv', 'env', '.env',
    'vendor', '.bundle', 'coverage', '.nyc_output'
]);

const DEFAULT_SKIP_FILES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.DS_Store', 'Thumbs.db'
]);

async function loadGitIgnoreRules(folderPath) {
    const ig = ignore();
    const gitignorePath = path.join(folderPath, '.gitignore');
    try {
        const content = await fs.readFile(gitignorePath, 'utf8');
        ig.add(content);
    } catch {
        // No .gitignore found
    }
    return ig;
}

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

function generateProjectTree(files, rootPath) {
    const root = {};
    for (const file of files) {
        const relative = path.relative(rootPath, file);
        const parts = relative.split(path.sep);
        let node = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                node[part] = null;
            } else {
                if (!node[part] || node[part] === null) node[part] = {};
                node = node[part];
            }
        }
    }
    return renderTreeLines(root, '');
}

function renderTreeLines(node, prefix) {
    const entries = Object.entries(node).sort((a, b) => {
        const aIsDir = a[1] !== null;
        const bIsDir = b[1] !== null;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a[0].localeCompare(b[0]);
    });
    let result = '';
    for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        const isLast = i === entries.length - 1;
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

function addLineNumbers(content, startLine) {
    const lines = content.split('\n');
    const digits = String(lines.length + startLine - 1).length;
    return lines.map((line, i) => {
        const num = String(startLine + i).padStart(digits, ' ');
        return `${num} | ${line}`;
    }).join('\n');
}

async function addContentPages(pdfDoc, filePathText, content, font, fontSize, lineHeight, maxWidth) {
    const lines = content.split('\n');
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN_TOP;
    let filePathDrawn = false;

    for (const line of lines) {
        const words = line.split(' ');
        let lineText = '';

        for (const word of words) {
            const testLine = lineText ? `${lineText} ${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);

            if (testWidth > maxWidth && lineText) {
                if (y - lineHeight < MARGIN_BOTTOM) {
                    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                    y = PAGE_HEIGHT - MARGIN_TOP;
                    filePathDrawn = false;
                }
                if (!filePathDrawn) {
                    drawFileHeader(page, filePathText, font);
                    filePathDrawn = true;
                }
                page.drawText(lineText, { x: MARGIN_LEFT, y, size: fontSize, font, maxWidth });
                y -= lineHeight;
                lineText = word;
            } else {
                lineText = testLine;
            }
        }

        if (y - lineHeight < MARGIN_BOTTOM) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            y = PAGE_HEIGHT - MARGIN_TOP;
            filePathDrawn = false;
        }
        if (!filePathDrawn) {
            drawFileHeader(page, filePathText, font);
            filePathDrawn = true;
        }
        page.drawText(lineText, { x: MARGIN_LEFT, y, size: fontSize, font, maxWidth });
        y -= lineHeight;
    }
}

function drawFileHeader(page, filePathText, font) {
    page.drawText(filePathText, { x: MARGIN_LEFT, y: PAGE_HEIGHT - 45, size: 9, font });
    page.drawLine({
        start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - 50 },
        end: { x: PAGE_WIDTH - MARGIN_LEFT, y: PAGE_HEIGHT - 50 },
        thickness: 0.5,
        color: pdf.rgb(0.6, 0.6, 0.6),
    });
}

function addHeaderPage(pdfDoc, folderName) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText(`Compiled PDF\n\nProject: ${folderName}`, { x: 300, y: PAGE_HEIGHT - 200, size: 36 });
}

async function addTreePage(pdfDoc, treeText, folderName, fileCount) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
    const lines = treeText.split('\n').filter(l => l.trim());
    let y = PAGE_HEIGHT - MARGIN_TOP + 10;
    page.drawText(`Project Structure: ${folderName}`, { x: MARGIN_LEFT, y, size: 14, font: font });
    y -= 30;
    const separator = '='.repeat(50);
    page.drawText(separator, { x: MARGIN_LEFT, y, size: 10, font: font });
    y -= 20;
    for (const line of lines) {
        page.drawText(line, { x: MARGIN_LEFT, y, size: 8, font: font });
        y -= 12;
    }
    y -= 10;
    page.drawText(`(${fileCount} files total)`, { x: MARGIN_LEFT, y, size: 10, font: font });
}

async function addTOCPage(pdfDoc, tocEntries) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
    let y = PAGE_HEIGHT - MARGIN_TOP + 10;
    page.drawText('Table of Contents', { x: MARGIN_LEFT, y, size: 14, font: font });
    y -= 30;
    const separator = '='.repeat(60);
    page.drawText(separator, { x: MARGIN_LEFT, y, size: 10, font: font });
    y -= 20;
    for (const entry of tocEntries) {
        if (y < MARGIN_BOTTOM + 20) break;
        const pageNum = String(entry.page);
        const dots = '.'.repeat(Math.max(1, 60 - entry.path.length - pageNum.length - 2));
        page.drawText(`${entry.path} ${dots} ${pageNum}`, { x: MARGIN_LEFT, y, size: 8, font: font });
        y -= 12;
    }
}

async function addImageFilePage(pdfDoc, filePathText, file, extension) {
    const imageBytes = await fs.readFile(file);
    const image = extension === '.png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const maxDimension = 500;
    let scaledWidth = image.width;
    let scaledHeight = image.height;
    if (image.width > maxDimension || image.height > maxDimension) {
        const scaleFactor = maxDimension / Math.max(image.width, image.height);
        scaledWidth = image.width * scaleFactor;
        scaledHeight = image.height * scaleFactor;
    }
    const x = (page.getWidth() - scaledWidth) / 2;
    const y = ((page.getHeight() - scaledHeight) / 2) - 20;
    page.drawText(filePathText, { x: MARGIN_LEFT, y: page.getHeight() - 50, size: 10 });
    page.drawImage(image, { x, y, width: scaledWidth, height: scaledHeight });
}

async function addFooterPage(pdfDoc, folderName) {
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    const currentDate = new Date().toLocaleDateString();
    const footerText = `PDF of project created on ${currentDate} with `;
    const linkText = 'All to PDF - Ai Facilitator';
    const linkUrl = 'https://github.com/HerreraCarlos81/all_to_pdf';
    const extensionText = ' extension for VSCode';
    const footerFontSize = 10;
    const footerWidth = lastPage.getWidth() - 100;
    const footerHeight = footerFontSize * 1.2;
    const footerX = 50;
    const footerY = 50;

    lastPage.drawRectangle({
        x: footerX,
        y: footerY,
        width: footerWidth,
        height: footerHeight,
        borderWidth: 1,
        borderColor: pdf.rgb(0, 0, 0),
    });

    const font = await pdfDoc.embedFont(pdf.StandardFonts.Helvetica);
    const textWidth = font.widthOfTextAtSize(footerText, footerFontSize);
    const linkWidth = font.widthOfTextAtSize(linkText, footerFontSize);

    lastPage.drawText(footerText, {
        x: footerX + 10,
        y: footerY + 2,
        size: footerFontSize,
        font: font,
        color: pdf.rgb(0, 0, 0),
    });

    const linkX = footerX + 10 + textWidth;
    const linkY = footerY + 2;
    lastPage.drawText(linkText, {
        x: linkX,
        y: linkY,
        size: footerFontSize,
        font: font,
        color: pdf.rgb(0, 0, 1),
        underline: true,
    });

    const linkAnnotation = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [linkX, linkY, linkX + linkWidth, linkY + footerFontSize],
        Border: [0, 0, 0],
        A: {
            Type: 'Action',
            S: 'URI',
            URI: linkUrl,
        },
    });
    lastPage.node.addAnnot(linkAnnotation);

    lastPage.drawText(extensionText, {
        x: footerX + 10 + textWidth + linkWidth,
        y: footerY + 2,
        size: footerFontSize,
        font: font,
        color: pdf.rgb(0, 0, 0),
    });
}

function setMetadata(pdfDoc, folderName) {
    pdfDoc.setTitle(folderName);
    pdfDoc.setAuthor('Created with All to PDF - AI Facilitator');
    pdfDoc.setSubject('PDF generated from project files');
    pdfDoc.setKeywords([folderName, 'project', 'compilation', 'PDF']);
}

async function createPDF(folderPath, options = {}) {
    const skipDirs = new Set([...DEFAULT_SKIP_DIRS, ...(options.skipDirs || [])]);
    const skipFiles = new Set([...DEFAULT_SKIP_FILES, ...(options.skipFiles || [])]);
    const useGitIgnore = options.useGitIgnore !== false;

    let gitIgnoreFilter = null;
    let rootPath = folderPath;

    if (useGitIgnore) {
        gitIgnoreFilter = await loadGitIgnoreRules(folderPath);
    }

    const collectOptions = { skipDirs, skipFiles, gitIgnoreFilter, rootPath };
    const files = await collectFiles(folderPath, collectOptions);

    const pdfDoc = await pdf.PDFDocument.create();
    const folderName = path.basename(folderPath);
    addHeaderPage(pdfDoc, folderName);

    const treeText = generateProjectTree(files, folderPath);
    await addTreePage(pdfDoc, treeText, folderName, files.length);

    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
    const tocEntries = [];

    for (const file of files) {
        const extension = path.extname(file).toLowerCase();
        let content;
        try {
            content = await fs.readFile(file, 'utf8');
            content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '    ');
        } catch {
            continue;
        }
        const filePathText = `File: ${file}`;
        const startPage = pdfDoc.getPageCount() + 1;

        if (['.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go'].includes(extension)) {
            const numberedContent = addLineNumbers(content, 1);
            await addContentPages(pdfDoc, filePathText, numberedContent, font, 8, 10, 740);
        } else if (['.json', '.csv', '.xml', '.yml', '.yaml'].includes(extension)) {
            try {
                const data = extension === '.json' ? JSON.parse(content) : content;
                const formattedContent = JSON.stringify(data, null, 2);
                await addContentPages(pdfDoc, filePathText, formattedContent, font, 8, 10, 740);
            } catch {
                await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 740);
            }
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(extension)) {
            try {
                await addImageFilePage(pdfDoc, filePathText, file, extension);
            } catch {
                continue;
            }
        } else if (['.txt', '.md', '.html', '.css'].includes(extension)) {
            await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 740);
        }

        const endPage = pdfDoc.getPageCount();
        if (endPage >= startPage) {
            tocEntries.push({ path: path.relative(folderPath, file).replace(/\\/g, '/'), page: startPage });
        }
    }

    await addTOCPage(pdfDoc, tocEntries);
    await addFooterPage(pdfDoc, folderName);
    setMetadata(pdfDoc, folderName);
    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, folderName };
}

module.exports = { createPDF, collectFiles, addContentPages, addHeaderPage, addImageFilePage, addFooterPage, setMetadata, loadGitIgnoreRules, shouldSkip, DEFAULT_SKIP_DIRS, DEFAULT_SKIP_FILES, generateProjectTree, addLineNumbers, addTreePage, addTOCPage };
