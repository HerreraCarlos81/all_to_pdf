// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs-extra');
const pdf = require('pdf-lib');
const path = require('path');

/**
 * Recursively collects all files in a folder and its subfolders.
 * @param {string} folderPath - The path of the folder to collect files from.
 * @returns {Promise<string[]>} - A promise that resolves to an array of file paths.
 */
async function collectFiles(folderPath) {
    const files = [];
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        if (entry.isDirectory()) {
            const subFiles = await collectFiles(fullPath);
            files.push(...subFiles);
        } else {
            files.push(fullPath);
        }
    }

    return files;
}


/**
 * Splits the content into multiple pages and adds them to the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the pages to.
 * @param {string} filePathText - The text to display the file path.
 * @param {string} content - The content to be split into pages.
 * @param {pdf.PDFFont} font - The font to be used for the content.
 * @param {number} fontSize - The font size to be used for the content.
 * @param {number} lineHeight - The line height to be used for the content.
 * @param {number} maxWidth - The maximum width of the content on each page.
 * @param {number} maxHeight - The maximum height of the content on each page.
 */
async function addContentPages(pdfDoc, filePathText, content, font, fontSize, lineHeight, maxWidth, maxHeight) {
    const lines = content.split('\n');
    let pageContent = '';
    let y = maxHeight;
    let isFirstPage = true;

    for (const line of lines) {
        const words = line.split(' ');
        let lineContent = '';

        for (const word of words) {
            const tempLine = `${lineContent} ${word}`.trim();
            const tempWidth = font.widthOfTextAtSize(tempLine, fontSize);

            if (tempWidth > maxWidth) {
                if (y - lineHeight < 50) {
                    await addContentPage(pdfDoc, filePathText, pageContent, font, fontSize, isFirstPage);
                    pageContent = '';
                    y = maxHeight;
                    isFirstPage = false;
                }
                pageContent += `${lineContent}\n`;
                lineContent = word;
                y -= lineHeight;
            } else {
                lineContent = tempLine;
            }
        }

        if (y - lineHeight < 50) {
            await addContentPage(pdfDoc, filePathText, pageContent, font, fontSize, isFirstPage);
            pageContent = '';
            y = maxHeight;
            isFirstPage = false;
        }
        pageContent += `${lineContent}\n`;
        y -= lineHeight;
    }

    if (pageContent.trim() !== '') {
        await addContentPage(pdfDoc, filePathText, pageContent, font, fontSize, isFirstPage);
    }
}


/**
 * Adds a content page to the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the page to.
 * @param {string} filePathText - The text to display the file path.
 * @param {string} content - The content to be added to the page.
 * @param {pdf.PDFFont} font - The font to be used for the content.
 * @param {number} fontSize - The font size to be used for the content.
 * @param {boolean} isFirstPage - Indicates whether it's the first page of the file's content.
 */
async function addContentPage(pdfDoc, filePathText, content, font, fontSize, isFirstPage) {
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();
    const pageWidth = width - 100;
    const pageHeight = height - 120;

    if (isFirstPage) {
        page.drawText(filePathText, { x: 50, y: height - 50, size: 10, font });
    }
    page.drawText(content, { x: 50, y: height - 70, size: fontSize, font, maxWidth: pageWidth, lineHeight: fontSize * 1.2 });
}


/**
 * Adds a header to the first page of the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the header to.
 * @param {string} folderName - The name of the folder being processed.
 */
function addHeaderPage(pdfDoc, folderName) {
    const headerPage = pdfDoc.addPage([841.89, 595.28]);
    headerPage.drawText(`Compiled PDF\n\nProject: ${folderName}`, { x: 300, y: headerPage.getHeight() - 200, size: 36 });
}

/**
 * Adds the contents of a code file to the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the code file to.
 * @param {string} filePathText - The text to display the file path.
 * @param {string} content - The contents of the code file.
 */
function addCodeFilePage(pdfDoc, filePathText, content) {
    const page = pdfDoc.addPage([841.89, 595.28]);
    page.drawText(filePathText, { x: 50, y: page.getHeight() - 50, size: 10 });
    page.drawText("\n", { x: 50, y: page.getHeight() - 70, size: 8 });
    page.drawText(content.toString(), { x: 50, y: page.getHeight() - 70, size: 8 });
}

/**
 * Adds the contents of a data file (JSON, CSV, XML, YAML) to the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the data file to.
 * @param {string} filePathText - The text to display the file path.
 * @param {string} content - The contents of the data file.
 * @param {string} extension - The file extension of the data file.
 */
function addDataFilePage(pdfDoc, filePathText, content, extension) {
    const page = pdfDoc.addPage([841.89, 595.28]);
    page.drawText(filePathText, { x: 50, y: page.getHeight() - 50, size: 10 });
    page.drawText("\n", { x: 50, y: page.getHeight() - 70, size: 8 });
    const data = extension === '.json' ? JSON.parse(content) : content;
    const text = JSON.stringify(data, null, 2);
    page.drawText(text, { x: 50, y: page.getHeight() - 70, size: 8 });
}

/**
 * Adds an image file to the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the image file to.
 * @param {string} filePathText - The text to display the file path.
 * @param {string} file - The path of the image file.
 * @param {string} extension - The file extension of the image file.
 */
async function addImageFilePage(pdfDoc, filePathText, file, extension) {
    const imageBytes = await fs.readFile(file);
    const image = extension === '.png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
    const page = pdfDoc.addPage([841.89, 595.28]);
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
    page.drawText(filePathText, { x: 50, y: page.getHeight() - 50, size: 10 });
    page.drawImage(image, { x, y, width: scaledWidth, height: scaledHeight });
}

/**
 * Adds the contents of a text file to the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the text file to.
 * @param {string} filePathText - The text to display the file path.
 * @param {string} content - The contents of the text file.
 */
function addTextFilePage(pdfDoc, filePathText, content) {
    const page = pdfDoc.addPage([841.89, 595.28]);
    page.drawText(filePathText, { x: 50, y: page.getHeight() - 50, size: 10 });
    page.drawText("\n", { x: 50, y: page.getHeight() - 70, size: 8 });
    page.drawText(content.toString(), { x: 50, y: page.getHeight() - 70, size: 8 });
}

/**
 * Adds a footer to the last page of the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to add the footer to.
 * @param {string} folderName - The name of the folder being processed.
 */
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
    const extensionWidth = font.widthOfTextAtSize(extensionText, footerFontSize);

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

/**
 * Sets the metadata of the PDF document.
 * @param {pdf.PDFDocument} pdfDoc - The PDF document to set the metadata for.
 * @param {string} folderName - The name of the folder being processed.
 */
function setMetadata(pdfDoc, folderName) {
    pdfDoc.setTitle(folderName);
    pdfDoc.setAuthor('Created with All to PDF - AI Facilitator');
    pdfDoc.setSubject('PDF generated from project files');
    pdfDoc.setKeywords([folderName, 'project', 'compilation', 'PDF']);
}


/**
 * Generates a PDF document from the files in a folder.
 * @param {string} folderPath - The path of the folder to generate the PDF from.
 */
async function createPDF(folderPath) {
    try {
        const files = await collectFiles(folderPath);
        const pdfDoc = await pdf.PDFDocument.create();

        const folderName = path.basename(folderPath);
        addHeaderPage(pdfDoc, folderName);

        const font = await pdfDoc.embedFont(pdf.StandardFonts.Helvetica);

        for (const file of files) {
            const extension = path.extname(file).toLowerCase();
            const content = await fs.readFile(file, 'utf8');
            const filePathText = `Content of the file: ${file}`;

            if (['.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go'].includes(extension)) {
                await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 750, 520);
            } else if (['.json', '.csv', '.xml', '.yml', '.yaml'].includes(extension)) {
                const data = extension === '.json' ? JSON.parse(content) : content;
                const formattedContent = JSON.stringify(data, null, 2);
                await addContentPages(pdfDoc, filePathText, formattedContent, font, 8, 10, 750, 520);
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(extension)) {
                await addImageFilePage(pdfDoc, filePathText, file, extension);
            } else if (['.txt', '.md', '.html', '.css'].includes(extension)) {
                await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 750, 520);
            }
        }

        await addFooterPage(pdfDoc, folderName);
        setMetadata(pdfDoc, folderName);

        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join(folderPath, 'PDF Compiled Project.pdf');
        await fs.writeFile(outputPath, pdfBytes);

        vscode.window.showInformationMessage('PDF successfully generated by All-to-PDF Extension!');
    } catch (error) {
        console.error('Error generating PDF:', error);
        vscode.window.showErrorMessage('Failed to generate PDF. Please check the console for details.');
    }
}


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, You can now call the extension by right-clicking the desired project folder and selecting the Compile Folder to PDF option.');

    let disposable = vscode.commands.registerCommand('extension.convertProjectToPDF', async (folder) => {
        if (folder && folder.fsPath) {
            const folderPath = folder.fsPath;
            await createPDF(folderPath);
        }
    });

    let context_disposable = vscode.commands.registerCommand('extension.convertProjectToPDFContext', async (folder) => {
        if (folder && folder.fsPath) {
            const folderPath = folder.fsPath;
            await createPDF(folderPath);
        }
    });

    context.subscriptions.push(disposable, context_disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
