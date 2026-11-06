import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp, write, GRADIENT, withEnv } from './helpers.mjs';

const json = { 'content-type': 'application/json' };

test('binds to 127.0.0.1 only', async () => {
  const s = await startApp();
  try {
    assert.equal(s.app.server.address().address, '127.0.0.1');
  } finally {
    await s.close();
  }
});

test('every /api call needs the token', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    for (const [method, p] of [['GET', '/api/info'], ['GET', '/api/rules'], ['GET', '/api/browse'], ['GET', '/api/changelog'], ['POST', '/api/scan'], ['POST', '/api/fix/preview'], ['POST', '/api/fix/apply']]) {
      const none = await s.raw(method, p, { auth: false, body: method === 'POST' ? {} : undefined });
      assert.equal(none.status, 401, `${method} ${p} without token`);
      const wrong = await s.raw(method, p, { headers: { 'x-studio-token': 'nope' }, body: method === 'POST' ? {} : undefined });
      assert.equal(wrong.status, 401, `${method} ${p} with wrong token`);
    }
    assert.equal((await s.get('/api/info')).status, 200);
  } finally {
    await s.close();
  }
});

test('a wrong Host header is rejected (DNS rebinding)', async () => {
  const s = await startApp();
  try {
    for (const host of ['evil.example', 'evil.example:' + s.port, '127.0.0.1:1', 'localhost']) {
      const r = await s.get('/api/info', { host });
      assert.equal(r.status, 403, host);
      assert.equal(r.json.error.code, 'bad_host');
      assert.equal((await s.get('/', { host })).status, 403, `static with host ${host}`);
    }
    assert.equal((await s.get('/', { host: `localhost:${s.port}` })).status, 200);
  } finally {
    await s.close();
  }
});

test('cross-origin requests are refused', async () => {
  const s = await startApp();
  try {
    for (const origin of ['http://evil.example', 'null', 'https://127.0.0.1:' + s.port, `http://127.0.0.1:${s.port + 1}`]) {
      const r = await s.get('/api/info', { headers: { origin } });
      assert.equal(r.status, 403, origin);
    }
    const site = await s.get('/api/info', { headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(site.status, 403);
    const same = await s.get('/api/info', { headers: { origin: s.base, 'sec-fetch-site': 'same-origin' } });
    assert.equal(same.status, 200);
  } finally {
    await s.close();
  }
});

test('POST must be application/json', async () => {
  const s = await startApp();
  try {
    const r = await s.raw('POST', '/api/scan', { body: '{"target":"."}', headers: { 'content-type': 'text/plain' } });
    assert.equal(r.status, 415);
    const bad = await s.raw('POST', '/api/scan', { body: '{nope', headers: json });
    assert.equal(bad.status, 400);
  } finally {
    await s.close();
  }
});

test('path traversal is rejected', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    write(s.outside, 'secret.css', GRADIENT);
    const rel = path.relative(s.root, s.outside);
    for (const target of ['..', '../', '../../../../etc', rel, path.join(rel, 'secret.css'), s.outside, '/etc/passwd', 'sub/../../..']) {
      const r = await s.post('/api/scan', { target });
      assert.ok([403, 404].includes(r.status), `${target} -> ${r.status}`);
      assert.notEqual(r.status, 200);
      const p = await s.post('/api/fix/preview', { target });
      assert.ok([403, 404].includes(p.status), `preview ${target} -> ${p.status}`);
    }
    assert.equal((await s.get('/api/browse?path=' + encodeURIComponent('..'))).status, 403);
    assert.equal((await s.get('/api/browse?path=' + encodeURIComponent(s.outside))).status, 403);
    assert.equal((await s.post('/api/scan', { target: 'a.css\0../x' })).status, 400);
  } finally {
    await s.close();
  }
});

test('symlinks that leave the root are rejected and never leak findings', async () => {
  const s = await startApp({ files: { 'a.css': 'p { color: red; }\n' } });
  try {
    write(s.outside, 'leak.css', GRADIENT);
    fs.symlinkSync(s.outside, path.join(s.root, 'linkdir'));
    fs.symlinkSync(path.join(s.outside, 'leak.css'), path.join(s.root, 'linkfile.css'));
    for (const target of ['linkdir', 'linkfile.css', 'linkdir/leak.css']) {
      assert.equal((await s.post('/api/scan', { target })).status, 403, target);
      assert.equal((await s.post('/api/fix/preview', { target })).status, 403, target);
    }
    // Scanning the root makes the engine walk through the links; findings outside are dropped.
    const scan = await s.post('/api/scan', { target: '.' });
    assert.equal(scan.status, 200);
    assert.equal(scan.json.findings.length, 0);
    assert.ok(scan.json.skipped >= 1);
    assert.ok(!scan.text.includes('leak.css'), 'no outside path in the response');
    // The browse listing hides links that point out of the root.
    const b = await s.get('/api/browse?path=.');
    assert.ok(!b.json.dirs.includes('linkdir'));
  } finally {
    await s.close();
  }
});

test('apply without confirm is rejected and writes nothing', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    for (const body of [{ target: 'a.css' }, { target: 'a.css', confirm: false }, { target: 'a.css', confirm: 'true' }, { target: 'a.css', confirm: 1 }]) {
      const r = await s.post('/api/fix/apply', body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.json.error.code, 'confirmation_required');
    }
    assert.equal(fs.readFileSync(path.join(s.root, 'a.css'), 'utf8'), GRADIENT);
    assert.ok(!fs.existsSync(path.join(s.root, '.anti-ai-design')));
  } finally {
    await s.close();
  }
});

test('apply with confirm writes inside the root and logs there', async () => {
  const s = await startApp({ files: { 'src/a.css': GRADIENT } });
  try {
    write(s.outside, 'untouched.css', GRADIENT);
    const prev = await s.post('/api/fix/preview', { target: 'src' });
    assert.equal(prev.status, 200);
    assert.equal(prev.json.fixCount, 1);
    assert.deepEqual(prev.json.files[0].changedLines, [5]);
    const r = await s.post('/api/fix/apply', { target: 'src', confirm: true, diffId: prev.json.diffId });
    assert.equal(r.status, 200);
    assert.equal(r.json.applied, 1);
    assert.deepEqual(r.json.written, ['src/a.css']);
    assert.doesNotMatch(fs.readFileSync(path.join(s.root, 'src/a.css'), 'utf8'), /^\s*background-clip: text/m);
    assert.equal(fs.readFileSync(path.join(s.outside, 'untouched.css'), 'utf8'), GRADIENT);
    const log = await s.get('/api/changelog');
    assert.equal(log.json.exists, true);
    assert.equal(log.json.entries.length, 1);
    assert.equal(log.json.entries[0].rule, 'gradient-text');
    const again = await s.post('/api/scan', { target: 'src' });
    assert.equal(again.json.summary.total, 0);
  } finally {
    await s.close();
  }
});

test('apply refuses when the preview is stale', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    const prev = await s.post('/api/fix/preview', { target: 'a.css' });
    write(s.root, 'a.css', GRADIENT + 'a {\n  background-clip: text;\n}\n');
    const r = await s.post('/api/fix/apply', { target: 'a.css', confirm: true, diffId: prev.json.diffId });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, 'diff_changed');
    assert.doesNotMatch(fs.readFileSync(path.join(s.root, 'a.css'), 'utf8'), /color: inherit/, 'file left alone');
  } finally {
    await s.close();
  }
});

test('apply never writes through a symlink that leaves the root', async () => {
  const s = await startApp({ files: { 'a.css': 'p {}\n' } });
  try {
    const leak = write(s.outside, 'leak.css', GRADIENT);
    fs.symlinkSync(s.outside, path.join(s.root, 'linkdir'));
    const r = await s.post('/api/fix/apply', { target: '.', confirm: true });
    assert.equal(r.status, 403);
    assert.equal(fs.readFileSync(leak, 'utf8'), GRADIENT);
  } finally {
    await s.close();
  }
});

test('a diff that names a file outside the root is refused', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    await withEnv({ FAKE_ENGINE_MODE: 'escape-diff' }, async () => {
      const p = await s.post('/api/fix/preview', { target: 'a.css' });
      assert.equal(p.status, 403);
      const a = await s.post('/api/fix/apply', { target: 'a.css', confirm: true });
      assert.equal(a.status, 403);
    });
    assert.equal(fs.readFileSync(path.join(s.root, 'a.css'), 'utf8'), GRADIENT);
  } finally {
    await s.close();
  }
});

test('a changelog folder that is a symlink out of the root blocks writing', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    fs.symlinkSync(s.outside, path.join(s.root, '.anti-ai-design'));
    const r = await s.post('/api/fix/apply', { target: 'a.css', confirm: true });
    assert.equal(r.status, 403);
    assert.equal(fs.readFileSync(path.join(s.root, 'a.css'), 'utf8'), GRADIENT);
    assert.equal((await s.get('/api/changelog')).status, 200);
  } finally {
    await s.close();
  }
});

test('snippets go to a temp folder that is deleted, on success and on failure', async () => {
  const s = await startApp();
  const left = () => fs.readdirSync(s.tmpParent).filter((n) => n.startsWith('aad-studio-'));
  try {
    const ok = await s.post('/api/scan', { snippet: GRADIENT, ext: 'css' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.kind, 'snippet');
    assert.equal(ok.json.findings.length, 1);
    assert.equal(ok.json.findings[0].file, 'snippet.css');
    assert.equal(ok.json.findings[0].context.lines.find((l) => l.hit).n, 5);
    assert.ok(!ok.text.includes(s.tmpParent), 'temp path not exposed');
    assert.deepEqual(left(), []);

    const fixed = await s.post('/api/fix/apply', { snippet: GRADIENT, ext: 'css', confirm: true });
    assert.equal(fixed.status, 200);
    assert.ok(fixed.json.fixed.includes('color: inherit'));
    assert.deepEqual(left(), []);

    await withEnv({ FAKE_ENGINE_MODE: 'crash' }, async () => {
      const bad = await s.post('/api/scan', { snippet: GRADIENT, ext: 'css' });
      assert.equal(bad.status, 502);
    });
    assert.deepEqual(left(), [], 'removed even when the engine fails');
    assert.deepEqual(fs.readdirSync(s.root), [], 'nothing written to the root');
  } finally {
    await s.close();
  }
});

test('snippet input is validated', async () => {
  const s = await startApp();
  try {
    assert.equal((await s.post('/api/scan', { snippet: 'x', ext: 'sh' })).status, 400);
    assert.equal((await s.post('/api/scan', { snippet: 'x', ext: '../css' })).status, 400);
    assert.equal((await s.post('/api/scan', { snippet: '', ext: 'css' })).status, 400);
    assert.equal((await s.post('/api/scan', { snippet: 'a'.repeat(1024 * 1024 + 1), ext: 'css' })).status, 413);
    assert.deepEqual(fs.readdirSync(s.tmpParent), []);
  } finally {
    await s.close();
  }
});

test('files over 2 MB are refused', async () => {
  const s = await startApp();
  try {
    write(s.root, 'big.css', 'a'.repeat(2 * 1024 * 1024 + 1));
    const r = await s.post('/api/scan', { target: 'big.css' });
    assert.equal(r.status, 413);
    assert.equal(r.json.error.code, 'file_too_large');
    const big = await s.raw('POST', '/api/scan', { body: JSON.stringify({ snippet: 'a'.repeat(2.5 * 1024 * 1024), ext: 'css' }), headers: json });
    assert.equal(big.status, 413);
  } finally {
    await s.close();
  }
});

test('dotfiles are not read or listed by the server', async () => {
  const s = await startApp({ files: { '.hidden.css': GRADIENT, '.secret/x.css': GRADIENT, 'ok.css': GRADIENT } });
  try {
    const b = await s.get('/api/browse?path=.');
    assert.deepEqual(b.json.dirs, []);
    assert.equal(b.json.fileCount, 1);
    assert.equal((await s.get('/api/browse?path=.secret')).status, 403);
    const scan = await s.post('/api/scan', { target: '.' });
    const hidden = scan.json.findings.find((f) => f.file === '.hidden.css');
    assert.ok(hidden, 'the engine still scans it');
    assert.equal(hidden.context, null, 'but the server does not read it for context');
    assert.ok(scan.json.findings.find((f) => f.file === 'ok.css').context);
  } finally {
    await s.close();
  }
});

test('engine failures become clear errors', async () => {
  const s = await startApp({ files: { 'a.css': GRADIENT } });
  try {
    await withEnv({ FAKE_ENGINE_MODE: 'crash' }, async () => {
      const r = await s.post('/api/scan', { target: 'a.css' });
      assert.equal(r.status, 502);
      assert.equal(r.json.error.code, 'engine_failed');
      assert.match(r.json.error.message, /boom/);
    });
    await withEnv({ FAKE_ENGINE_MODE: 'badjson' }, async () => {
      const r = await s.post('/api/scan', { target: 'a.css' });
      assert.equal(r.status, 502);
      assert.equal(r.json.error.code, 'engine_bad_output');
    });
  } finally {
    await s.close();
  }
});

test('a missing engine gives a build hint, not a crash', async () => {
  const s = await startApp({ engineBin: '/nonexistent/anti-ai-design' });
  try {
    const info = await s.get('/api/info');
    assert.equal(info.status, 200);
    assert.equal(info.json.engine.found, false);
    assert.match(info.json.buildCommand, /cargo build/);
    const r = await s.post('/api/scan', { target: '.' });
    assert.equal(r.status, 503);
    assert.equal(r.json.error.code, 'engine_not_found');
    assert.match(r.json.error.details.buildCommand, /cargo build/);
  } finally {
    await s.close();
  }
});

test('static files: served with a strict CSP, nothing outside web/', async () => {
  const s = await startApp();
  try {
    const r = await s.get('/');
    assert.equal(r.status, 200);
    assert.match(r.headers['content-security-policy'], /default-src 'none'/);
    assert.match(r.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.ok(!r.text.includes(s.token), 'the token is never in served pages');
    for (const p of ['/../server.mjs', '/%2e%2e/server.mjs', '/..%2flib/app.mjs', '/lib/app.mjs', '/package.json', '/%00']) {
      const x = await s.get(p, { auth: false });
      assert.ok([400, 404].includes(x.status), `${p} -> ${x.status}`);
    }
    assert.equal((await s.get('/engine.js')).status, 200);
    assert.equal((await s.get('/styles.css')).headers['content-type'].split(';')[0], 'text/css');
    assert.equal((await s.post('/styles.css', {})).status, 405);
  } finally {
    await s.close();
  }
});

test('the web files make no external requests', () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(dir)) {
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!/https?:\/\//.test(text), `${path.relative(dir, f)} mentions an absolute URL`);
    assert.ok(!/@import|fonts\.googleapis|cdn\./i.test(text), `${path.relative(dir, f)} pulls a remote resource`);
  }
});
