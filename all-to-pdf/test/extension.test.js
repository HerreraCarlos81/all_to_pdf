const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const pdf = require('pdf-lib');
const pdfGenerator = require('../pdfGenerator');
const { createPDF, collectFiles, addHeaderPage, setMetadata } = pdfGenerator;

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
        const defaultCollectOpts = {
            skipDirs: pdfGenerator.DEFAULT_SKIP_DIRS,
            skipFiles: pdfGenerator.DEFAULT_SKIP_FILES,
            gitIgnoreFilter: null,
            rootPath: FIXTURE_DIR
        };

        it('should collect all files recursively from a directory', async function () {
            const files = await collectFiles(FIXTURE_DIR, defaultCollectOpts);
            const relativeFiles = files.map(f => path.relative(FIXTURE_DIR, f)).sort();
            assert.ok(relativeFiles.includes(path.join('src', 'index.js')));
            assert.ok(relativeFiles.includes(path.join('src', 'utils.py')));
            assert.ok(relativeFiles.includes(path.join('data', 'config.json')));
            assert.ok(relativeFiles.includes('README.md'));
        });

        it('should skip default directories like node_modules', async function () {
            const nmDir = path.join(FIXTURE_DIR, 'node_modules');
            const nmFile = path.join(nmDir, 'lodash', 'index.js');
            await fs.ensureDir(path.dirname(nmFile));
            await fs.writeFile(nmFile, 'module.exports = {};');
            try {
                const files = await collectFiles(FIXTURE_DIR, defaultCollectOpts);
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
            const files = await collectFiles(emptyDir, defaultCollectOpts);
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

        it('should generate a PDF with all expected pages', async function () {
            const { pdfBytes } = await createPDF(FIXTURE_DIR);
            const pdfDoc = await pdf.PDFDocument.load(pdfBytes);
            assert.ok(pdfDoc.getPageCount() >= 4,
                `Expected at least 4 pages (header + tree + content + TOC), got ${pdfDoc.getPageCount()}`);
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

    describe('File filtering', function () {
        it('should respect .gitignore rules when gitIgnoreFilter is provided', async function () {
            const filteredDir = path.join(OUTPUT_DIR, 'gitignore-test');
            await fs.ensureDir(path.join(filteredDir, 'src'));
            await fs.ensureDir(path.join(filteredDir, 'temp'));
            await fs.writeFile(path.join(filteredDir, 'src', 'index.js'), 'ok');
            await fs.writeFile(path.join(filteredDir, 'temp', 'cache.txt'), 'ignored');
            await fs.writeFile(path.join(filteredDir, '.gitignore'), 'temp/');

            const gitIgnoreFilter = await pdfGenerator.loadGitIgnoreRules(filteredDir);
            const opts = {
                skipDirs: new Set(),
                skipFiles: new Set(),
                gitIgnoreFilter,
                rootPath: filteredDir
            };
            const files = await collectFiles(filteredDir, opts);
            const relative = files.map(f => path.relative(filteredDir, f));
            assert.ok(relative.includes(path.join('src', 'index.js')));
            assert.ok(!relative.some(f => f.startsWith('temp')));
            await fs.remove(filteredDir);
        });
    });

    describe('addLineNumbers', function () {
        it('should add line numbers to content', function () {
            const result = pdfGenerator.addLineNumbers('a\nb\nc', 1);
            assert.strictEqual(result, '1 | a\n2 | b\n3 | c');
        });

        it('should pad line numbers correctly for multi-digit counts', function () {
            const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`);
            const result = pdfGenerator.addLineNumbers(lines.join('\n'), 1);
            const outLines = result.split('\n');
            assert.ok(outLines[0].startsWith(' 1 | '));
            assert.ok(outLines[14].startsWith('15 | '));
        });

        it('should handle custom start line', function () {
            const result = pdfGenerator.addLineNumbers('hello\nworld', 10);
            assert.strictEqual(result, '10 | hello\n11 | world');
        });
    });

    describe('generateProjectTree', function () {
        it('should generate a tree from a list of files', function () {
            const files = [
                path.join(FIXTURE_DIR, 'src', 'index.js'),
                path.join(FIXTURE_DIR, 'src', 'utils.py'),
                path.join(FIXTURE_DIR, 'README.md')
            ];
            const tree = pdfGenerator.generateProjectTree(files, FIXTURE_DIR);
            assert.ok(tree.includes('index.js'));
            assert.ok(tree.includes('utils.py'));
            assert.ok(tree.includes('README.md'));
            assert.ok(tree.includes('src/'));
        });
    });

    describe('TOC generation', function () {
        it('should include correct page numbers in TOC', async function () {
            const { pdfBytes } = await createPDF(FIXTURE_DIR);
            const pdfDoc = await pdf.PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPageCount();
            assert.ok(pages >= 4);
        });
    });

    describe('Bug fixes', function () {
        it('should handle multi-line content without crashing', async function () {
            const multiLine = 'line1\nline2\nline3\nline4\nline5';
            const pdfDoc = await pdf.PDFDocument.create();
            const font = await pdfDoc.embedFont(pdf.StandardFonts.Courier);
            await pdfGenerator.addContentPages(pdfDoc, 'test.js', multiLine, font, 8, 10, 740);
            assert.ok(pdfDoc.getPageCount() >= 1);
        });

        it('should handle binary/non-utf8 files without crashing', async function () {
            const fixture = path.join(FIXTURE_DIR, 'should-be-skipped.bin');
            await fs.writeFile(fixture, Buffer.from([0x89, 0x50, 0x4E, 0x47])); // PNG header
            try {
                const opts = {
                    skipDirs: pdfGenerator.DEFAULT_SKIP_DIRS,
                    skipFiles: pdfGenerator.DEFAULT_SKIP_FILES,
                    gitIgnoreFilter: null,
                    rootPath: FIXTURE_DIR
                };
                const files = await collectFiles(FIXTURE_DIR, opts);
                assert.ok(files.includes(fixture));
                const result = await createPDF(FIXTURE_DIR);
                assert.ok(result.pdfBytes.length > 0);
            } finally {
                await fs.remove(fixture);
            }
        });
    });
});
