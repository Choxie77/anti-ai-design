import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { inspectProject, scannableExt, SCANNABLE_EXTS, SKIP_DIRS } from '../lib/project.mjs';
import { locateFinding, linkedStylesheets } from '../lib/locate.mjs';
import { startApp, write, GRADIENT } from './helpers.mjs';

const lines = (t) => t.split('\n');
const PAGE = lines('<!doctype html>\n<html><head><link rel="stylesheet" href="src/styles.css"></head>\n<body><h1 style="background:linear-gradient(90deg,#6366f1,#a855f7);-webkit-background-clip:text">Supercharge your workflow</h1>\n</body></html>');
const CSS = lines('body{font-family:Inter,sans-serif;background:#0b0b1a}\n.card{box-shadow:0 20px 60px rgba(99,102,241,.5)}');

test('scannable extensions match the ones the engine walks', () => {
  assert.equal(scannableExt('App.vue'), '.vue');
  assert.equal(scannableExt('page.blade.php'), '.blade.php');
  assert.equal(scannableExt('Hero.JSX'), '.jsx');
  assert.equal(scannableExt('notes.md'), null);
  assert.equal(scannableExt('logo.png'), null);
  // When the engine source is next to this checkout, its lists are the source of truth.
  const src = fileURLToPath(new URL('../../anti-design-skill/crates/detect/src/file_system.rs', import.meta.url));
  if (!fs.existsSync(src)) return;
  const text = fs.readFileSync(src, 'utf8');
  const list = (name) => [...text.slice(text.indexOf(`pub const ${name}`)).split('];')[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(SCANNABLE_EXTS, list('SCANNABLE_EXTENSIONS'));
  assert.deepEqual(SKIP_DIRS, list('SKIP_DIRS'));
});

test('inspectProject counts what a scan reads and says what it skips', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aad-proj-'));
  try {
    write(root, 'index.html', '<p>x</p>');
    write(root, 'src/a.css', 'a{}');
    write(root, 'src/b.tsx', 'export {}');
    write(root, 'README.md', '# no');
    write(root, 'node_modules/x/y.css', 'a{}');
    write(root, '.hidden/z.css', 'a{}');
    write(root, '.storybook/preview.js', 'export {}');
    const r = inspectProject(root);
    assert.equal(r.files, 4);
    assert.deepEqual(r.byExt, { '.html': 1, '.css': 1, '.tsx': 1, '.js': 1 });
    assert.deepEqual(r.skippedDirs, ['node_modules']);
    assert.equal(inspectProject(path.join(root, 'README.md')).files, 0);
    assert.equal(inspectProject(path.join(root, 'index.html')).files, 1);
    assert.equal(inspectProject(root, { maxFiles: 2 }).truncated, true);
    assert.equal(inspectProject(path.join(root, 'does-not-exist')).files, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('linked stylesheets: local ones only', () => {
  const html = lines('<link rel="stylesheet" href="src/a.css?v=2">\n<link href="b.css" rel="stylesheet">\n<link rel="stylesheet" href="https://cdn.example/c.css">\n<link rel="stylesheet" href="//cdn.example/d.css">\n<link rel="icon" href="f.ico">');
  assert.deepEqual(linkedStylesheets(html), ['src/a.css', 'b.css']);
});

test('locate: finds the line the detector did not name, in the page or in its stylesheet', () => {
  const files = [{ rel: 'index.html', lines: PAGE }, { rel: 'src/styles.css', lines: CSS, via: 'index.html' }];
  const used = new Set();
  const at = (rule, snippet) => locateFinding({ rule, snippet }, files, used);
  assert.deepEqual(at('gradient-text', 'background-clip: text + gradient'), { rel: 'index.html', line: 3, via: null });
  assert.deepEqual(at('overused-font', 'Primary font: inter'), { rel: 'src/styles.css', line: 1, via: 'index.html' });
  assert.deepEqual(at('dark-glow', 'Colored box-shadow glow (#6366f1) on dark page'), { rel: 'src/styles.css', line: 2, via: 'index.html' });
  assert.deepEqual(at('low-contrast', '1.1:1 (need 4.5:1) — text #000000 on #0b0b1a'), { rel: 'src/styles.css', line: 1, via: 'index.html' });
  assert.deepEqual(at('marketing-buzzword', '1 buzzword phrase: "Acme Supercharge your workflow Ge"'), { rel: 'index.html', line: 3, via: null });
  assert.equal(at('some-rule', 'nothing like this anywhere'), null);
});

test('locate: repeated findings of one rule spread over repeated lines', () => {
  const files = [{ rel: 'a.css', lines: lines('a{background-clip:text;background:linear-gradient(red,blue)}\nb{background-clip:text;background:linear-gradient(red,blue)}') }];
  const used = new Set();
  const one = locateFinding({ rule: 'gradient-text', snippet: 'background-clip: text + gradient' }, files, used);
  const two = locateFinding({ rule: 'gradient-text', snippet: 'background-clip: text + gradient' }, files, used);
  assert.deepEqual([one.line, two.line], [1, 2]);
});

test('the scan reports how many files it read, and the browse list says what a scan would read', async () => {
  const s = await startApp({ files: { 'src/a.css': GRADIENT, 'src/notes.md': '# hi', 'node_modules/x/a.css': GRADIENT, 'docs/readme.md': '# hi' } });
  try {
    const scan = await s.post('/api/scan', { target: '.' });
    assert.equal(scan.status, 200);
    assert.equal(scan.json.scanned.files, 1);
    assert.deepEqual(scan.json.scanned.skippedDirs, ['node_modules']);
    const snip = await s.post('/api/scan', { snippet: GRADIENT, ext: 'css' });
    assert.equal(snip.json.scanned.files, 1);
    const root = await s.get('/api/browse?path=');
    assert.equal(root.json.scannable.files, 1);
    assert.deepEqual(root.json.skippedDirs, ['node_modules']);
    const docs = await s.get('/api/browse?path=docs');
    assert.equal(docs.json.scannable.files, 0);
    const empty = await s.post('/api/scan', { target: 'docs' });
    assert.equal(empty.json.scanned.files, 0);
    assert.equal(empty.json.summary.total, 0);
  } finally {
    await s.close();
  }
});

test('a finding whose line was only guessed is never claimed as fixable', async () => {
  const { fixableIds, newAfterFix } = await import('../web/model.js');
  const files = [{ file: 'index.html', changedLines: [3] }];
  const findings = [
    { id: '0', rule: 'gradient-text', file: 'index.html', line: 3 },
    { id: '1', rule: 'marketing-buzzword', file: 'index.html', line: 3, located: { approximate: true } },
  ];
  assert.deepEqual([...fixableIds(findings, files)], ['0']);
  const before = [{ rule: 'gradient-text', file: 'a.html' }];
  const after = [{ rule: 'low-contrast', name: 'Low contrast', file: 'a.html' }, { rule: 'low-contrast', name: 'Low contrast', file: 'a.html' }];
  assert.deepEqual(newAfterFix(before, after), [{ rule: 'low-contrast', name: 'Low contrast', file: 'a.html', added: 2 }]);
  assert.deepEqual(newAfterFix(after, after), []);
  // The same mark moving from one file to another is not a new finding.
  assert.deepEqual(newAfterFix([{ rule: 'ai-color-palette', file: 'index.html' }], [{ rule: 'ai-color-palette', file: 'styles.css' }]), []);
});
