// Runs against the real detector binary. Skips cleanly when it is not built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBinary } from '../lib/engine.mjs';
import { LocalEngine } from '../web/engine.js';
import { startApp } from './helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, '..', '..', 'anti-design-skill', 'tests', 'fixtures', 'aad');
const bin = resolveBinary();
const skip = !bin ? 'engine binary not found (build it, or set ANTI_AI_DESIGN_BIN)' : !fs.existsSync(path.join(FIXTURES, 'gradient-text.css')) ? 'fixtures not found' : false;

test('real engine: scan, preview, apply, changelog, rescan on the gradient-text fixture', { skip }, async () => {
  const s = await startApp({ engineBin: bin });
  try {
    fs.copyFileSync(path.join(FIXTURES, 'gradient-text.css'), path.join(s.root, 'gradient-text.css'));
    const eng = new LocalEngine({ baseUrl: s.base, token: s.token });

    const info = await eng.info();
    assert.equal(info.engine.found, true);
    assert.match(info.engine.version, /\d/);

    const { rules } = await eng.listRules();
    assert.ok(rules.length > 10);
    assert.ok(rules.some((r) => r.firstParty && r.id.startsWith('aad-')));

    const scan = await eng.scan({ target: 'gradient-text.css' });
    const grad = scan.findings.find((f) => f.rule === 'gradient-text');
    assert.ok(grad, 'gradient-text is reported');
    assert.equal(grad.file, 'gradient-text.css');
    assert.ok(grad.context.lines.some((l) => l.hit && l.text.includes('background-clip')));

    const preview = await eng.previewFixes({ target: 'gradient-text.css' });
    assert.equal(preview.fixCount, 1);
    assert.ok(preview.files[0].changedLines.includes(grad.line));
    assert.match(fs.readFileSync(path.join(s.root, 'gradient-text.css'), 'utf8'), /background-clip: text/, 'a preview writes nothing');

    const done = await eng.applyFixes({ target: 'gradient-text.css', confirm: true, diffId: preview.diffId });
    assert.equal(done.applied, 1);
    assert.doesNotMatch(fs.readFileSync(path.join(s.root, 'gradient-text.css'), 'utf8'), /background-clip/);

    const log = await eng.changelog();
    assert.equal(log.exists, true);
    assert.equal(log.entries.at(-1).rule, 'gradient-text');

    const after = await eng.scan({ target: 'gradient-text.css' });
    assert.ok(!after.findings.some((f) => f.rule === 'gradient-text'), 'the finding is gone');
  } finally {
    await s.close();
  }
});

test('real engine: a pasted snippet is scanned and fixed without touching the root', { skip }, async () => {
  const s = await startApp({ engineBin: bin });
  try {
    const css = fs.readFileSync(path.join(FIXTURES, 'gradient-text.css'), 'utf8');
    const scan = await s.post('/api/scan', { snippet: css, ext: 'css' });
    assert.equal(scan.status, 200);
    assert.ok(scan.json.findings.some((f) => f.rule === 'gradient-text'));
    const fixed = await s.post('/api/fix/apply', { snippet: css, ext: 'css', confirm: true });
    assert.equal(fixed.status, 200);
    assert.doesNotMatch(fixed.json.fixed, /background-clip/);
    assert.deepEqual(fs.readdirSync(s.root), []);
    assert.deepEqual(fs.readdirSync(s.tmpParent), []);
  } finally {
    await s.close();
  }
});
