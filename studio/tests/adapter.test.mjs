import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, GRADIENT, withEnv } from './helpers.mjs';
import { LocalEngine, WasmEngine, EngineError, createEngine } from '../web/engine.js';
import { fixableIds, filterFindings, groupFindings, compareRescan, splitRows, SEVERITY_ORDER } from '../web/model.js';

async function local(files) {
  const s = await startApp({ files });
  return { s, eng: new LocalEngine({ baseUrl: s.base, token: s.token }) };
}

test('LocalEngine: info, rules, browse', async () => {
  const { s, eng } = await local({ 'src/a.css': GRADIENT });
  try {
    const info = await eng.info();
    assert.equal(info.engine.found, true);
    assert.equal(info.engine.version, 'fake-engine 9.9.9');
    assert.equal(info.root, s.root);
    const { rules } = await eng.listRules();
    assert.equal(rules.length, 3);
    assert.deepEqual(rules.filter((r) => r.firstParty).map((r) => r.id), ['aad-focus-removed']);
    const b = await eng.browse('');
    assert.deepEqual(b.dirs, ['src']);
    assert.equal(b.parent, null);
    assert.equal((await eng.browse('src')).parent, '');
  } finally {
    await s.close();
  }
});

test('LocalEngine: scan, preview, apply, changelog, rescan', async () => {
  const { s, eng } = await local({ 'src/a.css': GRADIENT });
  try {
    const scan = await eng.scan({ target: 'src' });
    assert.equal(scan.summary.total, 1);
    assert.equal(scan.summary.bySeverity.warning, 1);
    assert.equal(scan.findings[0].file, 'src/a.css');
    const preview = await eng.previewFixes({ target: 'src' });
    assert.equal(preview.fixCount, 1);
    assert.deepEqual([...fixableIds(scan.findings, preview.files)], ['0']);
    await assert.rejects(eng.applyFixes({ target: 'src' }), (e) => e instanceof EngineError && e.code === 'confirmation_required');
    const done = await eng.applyFixes({ target: 'src', confirm: true, diffId: preview.diffId });
    assert.equal(done.applied, 1);
    const log = await eng.changelog();
    assert.equal(log.entries.length, 1);
    const after = await eng.scan({ target: 'src' });
    assert.equal(after.summary.total, 0);
    const cmp = compareRescan(scan.findings, after.findings, fixableIds(scan.findings, preview.files));
    assert.deepEqual(cmp.map((c) => [c.rule, c.before, c.after, c.gone]), [['gradient-text', 1, 0, true]]);
  } finally {
    await s.close();
  }
});

test('LocalEngine: errors carry code, message and status', async () => {
  const { s, eng } = await local({});
  try {
    const bad = new LocalEngine({ baseUrl: s.base, token: 'wrong' });
    await assert.rejects(bad.info(), (e) => e instanceof EngineError && e.code === 'bad_token' && e.status === 401);
    await assert.rejects(eng.scan({ target: '../..' }), (e) => e.code === 'outside_root' && e.status === 403);
    await assert.rejects(eng.scan({ target: 'missing' }), (e) => e.code === 'not_found');
    await withEnv({ FAKE_ENGINE_MODE: 'crash' }, async () => {
      await assert.rejects(eng.scan({ target: '.' }), (e) => e.code === 'engine_failed');
    });
    const gone = new LocalEngine({ baseUrl: 'http://127.0.0.1:1', token: 'x' });
    await assert.rejects(gone.info(), (e) => e.code === 'unreachable');
  } finally {
    await s.close();
  }
});

test('WasmEngine is a stub: every method throws "not available yet"', async () => {
  const w = createEngine({ kind: 'wasm' });
  assert.ok(w instanceof WasmEngine);
  for (const m of ['info', 'listRules', 'scan', 'previewFixes', 'applyFixes', 'browse', 'changelog']) {
    await assert.rejects(w[m]({}), (e) => e instanceof EngineError && e.code === 'not_available' && /not available yet/.test(e.message), m);
  }
  assert.ok(createEngine({ kind: 'local', token: 't' }) instanceof LocalEngine);
});

test('both engines expose the same method names', () => {
  const names = (c) => Object.getOwnPropertyNames(c.prototype).filter((n) => n !== 'constructor' && n !== 'call' && n !== 'fail').sort();
  assert.deepEqual(names(WasmEngine), names(LocalEngine));
});

const F = (id, rule, file, line, severity = 'warning', category = 'slop') => ({ id, rule, name: rule, description: 'd', file, line, severity, category, snippet: '' });

test('model: filter, group and fixable matching', () => {
  const list = [F('0', 'b', 'x.css', 3, 'advisory'), F('1', 'a', 'x.css', 1, 'error'), F('2', 'a', 'y.css', 9, 'warning', 'quality')];
  const fix = fixableIds(list, [{ file: 'x.css', changedLines: [1, 2] }]);
  assert.deepEqual([...fix], ['1']);
  assert.deepEqual(filterFindings(list, { severities: new Set(['error']) }).map((f) => f.id), ['1']);
  assert.deepEqual(filterFindings(list, { category: 'quality' }).map((f) => f.id), ['2']);
  assert.deepEqual(filterFindings(list, { query: 'Y.CSS' }).map((f) => f.id), ['2']);
  assert.deepEqual(filterFindings(list, { fixableOnly: true }, fix).map((f) => f.id), ['1']);
  const byFile = groupFindings(list, 'file');
  assert.deepEqual(byFile.map((g) => [g.key, g.items.length]), [['x.css', 2], ['y.css', 1]]);
  const byRule = groupFindings(list, 'rule');
  assert.equal(byRule[0].key, 'a');
  assert.deepEqual(SEVERITY_ORDER, ['error', 'warning', 'advisory']);
});

test('model: side-by-side pairing', () => {
  const hunk = { lines: [{ t: 'ctx', old: 1, new: 1, text: 'a' }, { t: 'del', old: 2, text: 'b' }, { t: 'del', old: 3, text: 'c' }, { t: 'add', new: 2, text: 'd' }, { t: 'ctx', old: 4, new: 3, text: 'e' }] };
  const rows = splitRows(hunk);
  assert.equal(rows.length, 4);
  assert.equal(rows[1].left.text, 'b');
  assert.equal(rows[1].right.text, 'd');
  assert.equal(rows[2].right, null);
});
