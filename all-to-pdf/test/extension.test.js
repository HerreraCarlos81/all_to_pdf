/**
 * @fileoverview Unit tests for the Project to PDF generator.
 * Tests file collection, PDF generation, tree building, line numbering,
 * filtering, and edge-case handling.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const pdf = require('pdf-lib');
const pdfGenerator = require('../pdfGenerator');

const {
    createPDF,
    collectFiles,
    addTitlePage,
    setDocumentMetadata,
} = pdfGenerator;

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'sample-project');
const OUTPUT_DIR = path.join(__dirname, 'output');

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('pdfGenerator', function () {

    before(async function () {
        await fs.ensureDir(OUTPUT_DIR);
    });

    after(async function () {
        await fs.remove(OUTPUT_DIR);
    });

    // -----------------------------------------------------------------------
    // File collection
    // -----------------------------------------------------------------------

    describe('collectFiles', function () {
        const defaultFilterOptions = {
            skipDirs: pdfGenerator.DEFAULT_SKIP_DIRS,
            skipFiles: pdfGenerator.DEFAULT_SKIP_FILES,
            gitIgnoreFilter: null,
            rootPath: FIXTURE_DIR,
        };

        it('should collect all files recursively from a directory', async function () {
            const files = await collectFiles(FIXTURE_DIR, defaultFilterOptions);
            const relative = files.map(f => path.relative(FIXTURE_DIR, f)).sort();
            assert.ok(relative.includes(path.join('src', 'index.js')));
            assert.ok(relative.includes(path.join('src', 'utils.py')));
            assert.ok(relative.includes(path.join('data', 'config.json')));
            assert.ok(relative.includes('README.md'));
        });

        it('should skip default directories like node_modules', async function () {
            const nmDir = path.join(FIXTURE_DIR, 'node_modules');
            const nmFile = path.join(nmDir, 'lodash', 'index.js');
            await fs.ensureDir(path.dirname(nmFile));
            await fs.writeFile(nmFile, 'module.exports = {};');
            try {
                const files = await collectFiles(FIXTURE_DIR, defaultFilterOptions);
                const relative = files.map(f => path.relative(FIXTURE_DIR, f));
                assert.ok(!relative.includes('node_modules'));
                assert.ok(!relative.some(f => f.startsWith('node_modules')));
            } finally {
                await fs.remove(nmDir);
            }
        });

        it('should return an empty array for an empty directory', async function () {
            const emptyDir = path.join(OUTPUT_DIR, 'empty');
            await fs.ensureDir(emptyDir);
            const files = await collectFiles(emptyDir, defaultFilterOptions);
            assert.strictEqual(files.length, 0);
        });
    });

    // -----------------------------------------------------------------------
    // PDF generation
    // -----------------------------------------------------------------------

    describe('createPDF', function () {
        it('should generate a valid PDF from the sample project', async function () {
            const result = await createPDF(FIXTURE_DIR);
            assert.ok(result.pdfBytes);
            assert.ok(result.pdfBytes instanceof Uint8Array);
            assert.ok(result.pdfBytes.length > 0);
            assert.strictEqual(result.folderName, 'sample-project');
        });

        it('should generate a PDF with at least 4 pages (title + tree + content + TOC)', async function () {
            const { pdfBytes } = await createPDF(FIXTURE_DIR);
            const document = await pdf.PDFDocument.load(pdfBytes);
            assert.ok(
                document.getPageCount() >= 4,
                `Expected >= 4 pages, got ${document.getPageCount()}`
            );
        });

        it('should set PDF metadata', async function () {
            const { pdfBytes, folderName } = await createPDF(FIXTURE_DIR);
            const document = await pdf.PDFDocument.load(pdfBytes);
            assert.strictEqual(document.getTitle(), folderName);
            assert.strictEqual(
                document.getAuthor(),
                'Created with All to PDF - AI Facilitator'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Individual page builders
    // -----------------------------------------------------------------------

    describe('addTitlePage', function () {
        it('should add a title page to the PDF', async function () {
            const document = await pdf.PDFDocument.create();
            addTitlePage(document, 'test-project');
            assert.strictEqual(document.getPageCount(), 1);
        });
    });

    describe('setDocumentMetadata', function () {
        it('should set title, author, subject, and keywords', async function () {
            const document = await pdf.PDFDocument.create();
            setDocumentMetadata(document, 'my-project');
            assert.strictEqual(document.getTitle(), 'my-project');
            assert.strictEqual(
                document.getAuthor(),
                'Created with All to PDF - AI Facilitator'
            );
            assert.strictEqual(
                document.getSubject(),
                'PDF generated from project files'
            );
        });
    });

    // -----------------------------------------------------------------------
    // File filtering (gitignore)
    // -----------------------------------------------------------------------

    describe('file filtering', function () {
        it('should respect .gitignore rules when a filter is provided', async function () {
            const testDir = path.join(OUTPUT_DIR, 'gitignore-test');
            await fs.ensureDir(path.join(testDir, 'src'));
            await fs.ensureDir(path.join(testDir, 'temp'));
            await fs.writeFile(path.join(testDir, 'src', 'index.js'), 'ok');
            await fs.writeFile(path.join(testDir, 'temp', 'cache.txt'), 'ignored');
            await fs.writeFile(path.join(testDir, '.gitignore'), 'temp/');

            const filter = await pdfGenerator.loadGitIgnoreRules(testDir);
            const options = {
                skipDirs: new Set(),
                skipFiles: new Set(),
                gitIgnoreFilter: filter,
                rootPath: testDir,
            };
            const files = await collectFiles(testDir, options);
            const relative = files.map(f => path.relative(testDir, f));
            assert.ok(relative.includes(path.join('src', 'index.js')));
            assert.ok(!relative.some(f => f.startsWith('temp')));
            await fs.remove(testDir);
        });
    });

    // -----------------------------------------------------------------------
    // Line numbering
    // -----------------------------------------------------------------------

    describe('addLineNumbers', function () {
        it('should prepend line numbers to each line', function () {
            const result = pdfGenerator.addLineNumbers('a\nb\nc', 1);
            assert.strictEqual(result, '1 | a\n2 | b\n3 | c');
        });

        it('should zero-pad numbers for multi-digit line counts', function () {
            const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`);
            const result = pdfGenerator.addLineNumbers(lines.join('\n'), 1);
            const outputLines = result.split('\n');
            assert.ok(outputLines[0].startsWith(' 1 | '));
            assert.ok(outputLines[14].startsWith('15 | '));
        });

        it('should accept a custom starting line number', function () {
            const result = pdfGenerator.addLineNumbers('hello\nworld', 10);
            assert.strictEqual(result, '10 | hello\n11 | world');
        });
    });

    // -----------------------------------------------------------------------
    // Project tree generation
    // -----------------------------------------------------------------------

    describe('generateProjectTree', function () {
        it('should build an ASCII tree from a list of file paths', function () {
            const files = [
                path.join(FIXTURE_DIR, 'src', 'index.js'),
                path.join(FIXTURE_DIR, 'src', 'utils.py'),
                path.join(FIXTURE_DIR, 'README.md'),
            ];
            const tree = pdfGenerator.generateProjectTree(files, FIXTURE_DIR);
            assert.ok(tree.includes('index.js'));
            assert.ok(tree.includes('utils.py'));
            assert.ok(tree.includes('README.md'));
            assert.ok(tree.includes('src/'));
        });
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    describe('edge cases', function () {
        it('should handle multi-line content without crashing', async function () {
            const multiLine = 'line1\nline2\nline3\nline4\nline5';
            const document = await pdf.PDFDocument.create();
            const courier = await document.embedFont(pdf.StandardFonts.Courier);
            await pdfGenerator.addContentPages(document, 'test.js', multiLine, courier, 8, 10, 740);
            assert.ok(document.getPageCount() >= 1);
        });

        it('should handle binary / non-utf8 files without crashing', async function () {
            const binaryFile = path.join(FIXTURE_DIR, 'should-be-skipped.bin');
            await fs.writeFile(binaryFile, Buffer.from([0x89, 0x50, 0x4E, 0x47]));
            try {
                const options = {
                    skipDirs: pdfGenerator.DEFAULT_SKIP_DIRS,
                    skipFiles: pdfGenerator.DEFAULT_SKIP_FILES,
                    gitIgnoreFilter: null,
                    rootPath: FIXTURE_DIR,
                };
                const files = await collectFiles(FIXTURE_DIR, options);
                assert.ok(files.includes(binaryFile));
                const result = await createPDF(FIXTURE_DIR);
                assert.ok(result.pdfBytes.length > 0);
            } finally {
                await fs.remove(binaryFile);
            }
        });

        it('should generate a PDF with TOC containing page numbers', async function () {
            const { pdfBytes } = await createPDF(FIXTURE_DIR);
            const document = await pdf.PDFDocument.load(pdfBytes);
            assert.ok(document.getPageCount() >= 4);
        });

        it('should sanitize non-WinAnsi characters to prevent pdf-lib errors', async function () {
            const input = 'Hello\u2014world\u2018test\u201D\u2502\u251Cfoo\u2603';
            const result = pdfGenerator.sanitizeText(input);
            assert.strictEqual(result, 'Hello-world\'test"||--foo?');
        });
    });
});
