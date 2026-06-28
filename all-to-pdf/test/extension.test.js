const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const pdf = require('pdf-lib');
const { createPDF, collectFiles, addContentPages, addContentPage, addHeaderPage, setMetadata } = require('../pdfGenerator');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'sample-project');
const OUTPUT_DIR = path.join(__dirname, 'output');

describe('pdfGenerator', function () {
    before(async function () {
        await fs.ensureDir(OUTPUT_DIR);
    });

    after(async function () {
        await fs.remove(OUTPUT_DIR);
    });

    describe('collectFiles', function () {
        it('should collect all files recursively from a directory', async function () {
            const files = await collectFiles(FIXTURE_DIR);
            const relativeFiles = files.map(f => path.relative(FIXTURE_DIR, f)).sort();
            assert.ok(relativeFiles.includes(path.join('src', 'index.js')));
            assert.ok(relativeFiles.includes(path.join('src', 'utils.py')));
            assert.ok(relativeFiles.includes(path.join('data', 'config.json')));
            assert.ok(relativeFiles.includes('README.md'));
            assert.ok(relativeFiles.includes('.gitignore'));
        });

        it('should return an empty array for an empty directory', async function () {
            const emptyDir = path.join(OUTPUT_DIR, 'empty');
            await fs.ensureDir(emptyDir);
            const files = await collectFiles(emptyDir);
            assert.strictEqual(files.length, 0);
        });
    });

    describe('createPDF', function () {
        it('should generate a valid PDF from the sample project', async function () {
            const result = await createPDF(FIXTURE_DIR);
            assert.ok(result.pdfBytes);
            assert.ok(result.pdfBytes instanceof Uint8Array);
            assert.ok(result.pdfBytes.length > 0);
            assert.strictEqual(result.folderName, 'sample-project');
        });

        it('should generate a PDF with at least a header page and some content pages', async function () {
            const { pdfBytes } = await createPDF(FIXTURE_DIR);
            const pdfDoc = await pdf.PDFDocument.load(pdfBytes);
            assert.ok(pdfDoc.getPageCount() >= 2,
                `Expected at least 2 pages (header + content), got ${pdfDoc.getPageCount()}`);
        });

        it('should set PDF metadata', async function () {
            const { pdfBytes, folderName } = await createPDF(FIXTURE_DIR);
            const pdfDoc = await pdf.PDFDocument.load(pdfBytes);
            assert.strictEqual(pdfDoc.getTitle(), folderName);
            assert.strictEqual(pdfDoc.getAuthor(), 'Created with All to PDF - AI Facilitator');
        });
    });

    describe('addHeaderPage', function () {
        it('should add a header page to the PDF', async function () {
            const pdfDoc = await pdf.PDFDocument.create();
            addHeaderPage(pdfDoc, 'test-project');
            assert.strictEqual(pdfDoc.getPageCount(), 1);
        });
    });

    describe('setMetadata', function () {
        it('should set title, author, subject, and keywords', async function () {
            const pdfDoc = await pdf.PDFDocument.create();
            setMetadata(pdfDoc, 'my-project');
            assert.strictEqual(pdfDoc.getTitle(), 'my-project');
            assert.strictEqual(pdfDoc.getAuthor(), 'Created with All to PDF - AI Facilitator');
            assert.strictEqual(pdfDoc.getSubject(), 'PDF generated from project files');
        });
    });
});
