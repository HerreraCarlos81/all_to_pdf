const fs = require('fs-extra');
const pdf = require('pdf-lib');
const path = require('path');

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

async function addContentPages(pdfDoc, filePathText, content, font, fontSize, lineHeight, maxWidth, maxHeight) {
    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const marginLeft = 50;
    const marginBottom = 50;
    const marginTop = 60;
    const lines = content.split('\n');
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - marginTop;
    let filePathDrawn = false;

    for (const line of lines) {
        const words = line.split(' ');
        let lineText = '';

        for (const word of words) {
            const testLine = lineText ? `${lineText} ${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);

            if (testWidth > maxWidth && lineText) {
                if (y - lineHeight < marginBottom) {
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    y = pageHeight - marginTop;
                    filePathDrawn = false;
                }
                if (!filePathDrawn) {
                    page.drawText(filePathText, { x: marginLeft, y: pageHeight - 45, size: 9, font });
                    filePathDrawn = true;
                }
                page.drawText(lineText, { x: marginLeft, y, size: fontSize, font, maxWidth });
                y -= lineHeight;
                lineText = word;
            } else {
                lineText = testLine;
            }
        }

        if (y - lineHeight < marginBottom) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - marginTop;
            filePathDrawn = false;
        }
        if (!filePathDrawn) {
            page.drawText(filePathText, { x: marginLeft, y: pageHeight - 45, size: 9, font });
            filePathDrawn = true;
        }
        page.drawText(lineText, { x: marginLeft, y, size: fontSize, font, maxWidth });
        y -= lineHeight;
    }
}

function addHeaderPage(pdfDoc, folderName) {
    const headerPage = pdfDoc.addPage([841.89, 595.28]);
    headerPage.drawText(`Compiled PDF\n\nProject: ${folderName}`, { x: 300, y: headerPage.getHeight() - 200, size: 36 });
}

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

async function createPDF(folderPath) {
    const files = await collectFiles(folderPath);
    const pdfDoc = await pdf.PDFDocument.create();
    const folderName = path.basename(folderPath);
    addHeaderPage(pdfDoc, folderName);
    const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);

    for (const file of files) {
        const extension = path.extname(file).toLowerCase();
        let content;
        try {
            content = await fs.readFile(file, 'utf8');
        } catch {
            continue;
        }
        const filePathText = `Content of the file: ${file}`;

        if (['.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go'].includes(extension)) {
            await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 740, 520);
        } else if (['.json', '.csv', '.xml', '.yml', '.yaml'].includes(extension)) {
            try {
                const data = extension === '.json' ? JSON.parse(content) : content;
                const formattedContent = JSON.stringify(data, null, 2);
                await addContentPages(pdfDoc, filePathText, formattedContent, font, 8, 10, 740, 520);
            } catch {
                await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 740, 520);
            }
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(extension)) {
            try {
                await addImageFilePage(pdfDoc, filePathText, file, extension);
            } catch {
                continue;
            }
        } else if (['.txt', '.md', '.html', '.css'].includes(extension)) {
            await addContentPages(pdfDoc, filePathText, content, font, 8, 10, 740, 520);
        }
    }

    await addFooterPage(pdfDoc, folderName);
    setMetadata(pdfDoc, folderName);
    const pdfBytes = await pdfDoc.save();
    return { pdfBytes, folderName };
}

module.exports = { createPDF, collectFiles, addContentPages, addHeaderPage, addImageFilePage, addFooterPage, setMetadata };
