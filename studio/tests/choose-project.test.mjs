// Choosing a project from the page: no --root needed, any folder on this computer, never the whole disk or home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { pathCandidates, pickFolderNative, readRecent, rememberRecent, isTooBroad } from '../lib/folders.mjs';
import { startApp, makeDir, write, GRADIENT } from './helpers.mjs';
import { LocalEngine, WasmEngine, EngineError, serverIsOutdated, canSwitchProject } from '../web/engine.js';

// ---- understanding what a person typed ------------------------------------------------------------------

test('typed paths: quotes, file links, ~, escaped spaces and bare names all work', () => {
  const home = '/Users/sam';
  assert.deepEqual(pathCandidates('"/a/my site"', { home }), ['/a/my site']);
  assert.deepEqual(pathCandidates("'/a/b'", { home }), ['/a/b']);
  assert.deepEqual(pathCandidates('/a/my\\ site', { home }), ['/a/my site']);
  assert.deepEqual(pathCandidates(pathToFileURL('/a/my site').href, { home }), ['/a/my site']);
  assert.deepEqual(pathCandidates('~/work/site', { home }), ['/Users/sam/work/site']);
  assert.deepEqual(pathCandidates('~', { home }), ['/Users/sam']);
  assert.deepEqual(pathCandidates('shop', { home, bases: ['/p/current'] }).slice(0, 2), ['/p/current/shop', '/Users/sam/shop']);
  assert.deepEqual(pathCandidates('   ', { home }), []);
  assert.deepEqual(pathCandidates('a\0b', { home }), []);
  assert.deepEqual(pathCandidates('x'.repeat(5000), { home }), []);
});

test('the disk root and the home folder are too broad to be a project', () => {
  const home = makeDir('aad-home-');
  try {
    assert.equal(isTooBroad(home, home), true);
    assert.equal(isTooBroad(path.parse(home).root, home), true);
    fs.mkdirSync(path.join(home, 'site'));
    assert.equal(isTooBroad(path.join(home, 'site'), home), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ---- the operating system's folder dialog ---------------------------------------------------------------

const exec = (results) => {
  const calls = [];
  const fn = async (cmd, args) => {
    calls.push([cmd, args]);
    const r = results[cmd];
    return typeof r === 'function' ? r(args) : r;
  };
  fn.calls = calls;
  return fn;
};
const enoent = { err: Object.assign(new Error('nope'), { code: 'ENOENT' }), stdout: '', stderr: '' };

test('folder dialog: macOS returns the folder, or says it was cancelled', async () => {
  const ok = exec({ osascript: { err: null, stdout: '/Users/sam/site/\n', stderr: '' } });
  assert.deepEqual(await pickFolderNative({ platform: 'darwin', exec: ok }), { path: '/Users/sam/site/' });
  assert.equal(ok.calls[0][0], 'osascript');
  assert.ok(ok.calls[0][1].some((a) => a.includes('choose folder')));
  const cancel = exec({ osascript: { err: new Error('x'), stdout: '', stderr: 'execution error: User canceled. (-128)' } });
  assert.deepEqual(await pickFolderNative({ platform: 'darwin', exec: cancel }), { cancelled: true });
  const broken = exec({ osascript: { err: new Error('x'), stdout: '', stderr: 'something else' } });
  await assert.rejects(pickFolderNative({ platform: 'darwin', exec: broken }), (e) => e.code === 'no_dialog' && e.status === 501);
});

test('folder dialog: Windows and Linux, falling back when a helper is missing', async () => {
  assert.deepEqual(await pickFolderNative({ platform: 'win32', exec: exec({ powershell: { err: null, stdout: 'C:\\Users\\sam\\site\r\n', stderr: '' } }) }), { path: 'C:\\Users\\sam\\site' });
  assert.deepEqual(await pickFolderNative({ platform: 'win32', exec: exec({ powershell: { err: null, stdout: '', stderr: '' } }) }), { cancelled: true });
  const viaKde = exec({ zenity: enoent, kdialog: { err: null, stdout: '/home/sam/site\n', stderr: '' } });
  assert.deepEqual(await pickFolderNative({ platform: 'linux', exec: viaKde }), { path: '/home/sam/site' });
  assert.deepEqual(viaKde.calls.map((c) => c[0]), ['zenity', 'kdialog']);
  await assert.rejects(pickFolderNative({ platform: 'linux', exec: exec({ zenity: enoent, kdialog: enoent }) }), (e) => e.code === 'no_dialog');
});

// ---- recent projects ------------------------------------------------------------------------------------

test('recent projects are remembered, capped, and forget folders that are gone', () => {
  const dir = makeDir('aad-recent-');
  try {
    const file = path.join(dir, 'state', 'studio.json');
    const a = path.join(dir, 'a');
    const b = path.join(dir, 'b');
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    let list = rememberRecent(file, [], a);
    list = rememberRecent(file, list, b);
    list = rememberRecent(file, list, a);
    assert.deepEqual(list, [a, b]);
    assert.deepEqual(readRecent(file), [a, b]);
    fs.rmSync(b, { recursive: true });
    assert.deepEqual(readRecent(file), [a]);
    assert.deepEqual(readRecent(path.join(dir, 'missing.json')), []);
    fs.writeFileSync(file, 'not json');
    assert.deepEqual(readRecent(file), []);
    // No file to save to: still works, just does not persist.
    assert.deepEqual(rememberRecent(null, [], a), [a]);
    const many = Array.from({ length: 12 }, (_, i) => `/p/${i}`);
    assert.equal(rememberRecent(null, many, '/p/new').length, 8);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the server -----------------------------------------------------------------------------------------

test('starting without a project: snippets work, folder work asks you to choose one', async () => {
  const s = await startApp({ noRoot: true });
  try {
    const info = await s.get('/api/info');
    assert.equal(info.json.root, null);
    assert.equal(info.json.home, s.home);
    assert.equal(info.json.capabilities.switchProject, true);
    for (const [method, url, body] of [['POST', '/api/scan', { target: '.' }], ['GET', '/api/browse?path=', undefined], ['POST', '/api/fix/preview', { target: '.' }]]) {
      const r = await s.raw(method, url, { body });
      assert.equal(r.status, 409, url);
      assert.equal(r.json.error.code, 'no_project', url);
    }
    assert.equal((await s.get('/api/changelog')).json.exists, false);
    const snippet = await s.post('/api/scan', { snippet: GRADIENT, ext: 'css' });
    assert.equal(snippet.status, 200);
    assert.equal(snippet.json.summary.total, 1);
  } finally {
    await s.close();
  }
});

test('opening a project by path makes it the project, and the old one is no longer reachable', async () => {
  const s = await startApp({ files: { 'old.css': GRADIENT } });
  try {
    const mine = path.join(s.home, 'my-site');
    write(mine, 'index.html', '<p>hi</p>');
    write(mine, 'css/site.css', GRADIENT);
    const open = await s.post('/api/project', { path: mine });
    assert.equal(open.status, 200);
    assert.equal(open.json.root, mine);
    assert.equal(open.json.name, 'my-site');
    assert.equal(open.json.focus, '');
    assert.equal(open.json.scannable.files, 2);
    assert.deepEqual(open.json.recent, [s.root]);
    assert.equal((await s.get('/api/info')).json.root, mine);
    assert.equal(s.app.root, mine);
    const scan = await s.post('/api/scan', { target: '.' });
    assert.equal(scan.json.summary.total, 1);
    assert.equal(scan.json.findings[0].file, 'css/site.css');
    assert.equal((await s.post('/api/scan', { target: 'old.css' })).status, 404, 'the previous project is gone');
    assert.equal((await s.post('/api/scan', { target: '../..' })).status, 403, 'the new project is fenced in too');
    // Every path guard applies to the new project: a link out of it is refused.
    fs.symlinkSync(s.outside, path.join(mine, 'escape'));
    assert.equal((await s.post('/api/scan', { target: 'escape' })).status, 403);
  } finally {
    await s.close();
  }
});

test('a project can be opened by a short name, ~, a quoted path or a link', async () => {
  const s = await startApp({ noRoot: true });
  try {
    const mine = path.join(s.home, 'Desktop', 'shop');
    write(mine, 'a.css', GRADIENT);
    for (const typed of ['shop', 'Desktop/shop', '~/Desktop/shop', `"${mine}"`, pathToFileURL(mine).href]) {
      const r = await s.post('/api/project', { path: typed });
      assert.equal(r.status, 200, typed);
      assert.equal(r.json.root, mine, typed);
    }
  } finally {
    await s.close();
  }
});

test('opening a file opens its folder and points the scan at that file', async () => {
  const s = await startApp({ noRoot: true });
  try {
    const page = write(path.join(s.home, 'site'), 'pages/index.html', '<p>x</p>');
    const r = await s.post('/api/project', { path: page });
    assert.equal(r.status, 200);
    assert.equal(r.json.root, path.join(s.home, 'site', 'pages'));
    assert.equal(r.json.focus, 'index.html');
  } finally {
    await s.close();
  }
});

test('the whole disk and the whole home folder are refused, and the project stays as it was', async () => {
  const s = await startApp();
  try {
    for (const p of [s.home, path.parse(s.home).root]) {
      const r = await s.post('/api/project', { path: p });
      assert.equal(r.status, 400, p);
      assert.equal(r.json.error.code, 'too_broad', p);
    }
    assert.equal(s.app.root, s.root);
  } finally {
    await s.close();
  }
});

test('missing or empty paths give a message that says what to do', async () => {
  const s = await startApp();
  try {
    const missing = await s.post('/api/project', { path: path.join(s.home, 'nope') });
    assert.equal(missing.status, 404);
    assert.match(missing.json.error.message, /no folder at/i);
    assert.equal((await s.post('/api/project', { path: '' })).status, 400);
    assert.equal((await s.post('/api/project', {})).status, 400);
    assert.equal(s.app.root, s.root);
  } finally {
    await s.close();
  }
});

test('folder list: counts what a scan would read, hides the noise, can go anywhere', async () => {
  const s = await startApp({ noRoot: true });
  try {
    write(s.home, 'Desktop/site/index.html', '<p>x</p>');
    write(s.home, 'Desktop/site/a.css', 'a{}');
    write(s.home, 'Desktop/notes/readme.md', '# no');
    write(s.home, 'Desktop/.secret/a.css', 'a{}');
    write(s.home, 'Desktop/deps/node_modules/x/a.css', 'a{}');
    write(s.home, 'Library/x/a.css', 'a{}');
    fs.mkdirSync(path.join(s.home, 'Documents'));
    const top = await s.get('/api/folders');
    assert.equal(top.status, 200);
    assert.equal(top.json.path, s.home);
    assert.equal(top.json.tooBroad, true);
    assert.equal(top.json.parent, path.dirname(s.home));
    assert.deepEqual(top.json.dirs.map((d) => d.name), ['Desktop', 'Documents'], 'Library is noise at the home level');
    assert.deepEqual(top.json.shortcuts.map((x) => x.label), ['Home', 'Desktop', 'Documents']);
    const desk = await s.get('/api/folders?path=' + encodeURIComponent(path.join(s.home, 'Desktop')));
    assert.deepEqual(desk.json.dirs, [{ name: 'deps', files: 0, more: false }, { name: 'notes', files: 0, more: false }, { name: 'site', files: 2, more: false }]);
    assert.equal(desk.json.tooBroad, false);
    // Outside the home folder works too: it is a picker for this whole computer.
    assert.equal((await s.get('/api/folders?path=' + encodeURIComponent(s.outside))).status, 200);
    assert.equal((await s.get('/api/folders?path=' + encodeURIComponent(path.join(s.home, 'Desktop', 'site', 'a.css')))).json.error.code, 'not_a_folder');
    assert.equal((await s.get('/api/folders?path=' + encodeURIComponent(path.join(s.home, 'nope')))).status, 404);
  } finally {
    await s.close();
  }
});

test('finding a dropped folder by its name: project folders first, nothing outside home, bad names refused', async () => {
  const s = await startApp({ noRoot: true });
  try {
    write(s.home, 'Desktop/portfolio/index.html', '<p>x</p>');
    write(s.home, 'Documents/old/Portfolio/readme.md', '# empty copy');
    write(s.home, 'a/b/c/d/e/f/portfolio/index.html', '<p>too deep</p>');
    write(s.home, 'Desktop/node_modules/portfolio/index.html', '<p>skipped</p>');
    const r = await s.get('/api/folders/find?name=portfolio');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.matches.map((m) => [path.relative(s.home, m.path), m.files]), [['Desktop/portfolio', 1], ['Documents/old/Portfolio', 0]]);
    assert.deepEqual((await s.get('/api/folders/find?name=zzz')).json.matches, []);
    for (const bad of ['', '..', 'a/b', 'a%5Cb']) assert.equal((await s.get('/api/folders/find?name=' + bad)).status, 400, bad);
  } finally {
    await s.close();
  }
});

test('the folder dialog result is passed to the page, and a missing dialog says so', async () => {
  const s = await startApp({ pickFolder: async () => ({ path: '/somewhere' }) });
  try {
    assert.deepEqual((await s.post('/api/project/pick', {})).json, { path: '/somewhere' });
  } finally {
    await s.close();
  }
  const t = await startApp({
    pickFolder: async () => {
      const { HttpError } = await import('../lib/security.mjs');
      throw new HttpError(501, 'no_dialog', 'none');
    },
  });
  try {
    const r = await t.post('/api/project/pick', {});
    assert.equal(r.status, 501);
    assert.equal(r.json.error.code, 'no_dialog');
  } finally {
    await t.close();
  }
});

test('the new routes need the token and a JSON body like every other route', async () => {
  const s = await startApp();
  try {
    for (const [m, u] of [['GET', '/api/folders'], ['GET', '/api/folders/find?name=x'], ['POST', '/api/project'], ['POST', '/api/project/pick']]) {
      assert.equal((await s.raw(m, u, { auth: false, body: m === 'POST' ? {} : undefined })).status, 401, u);
    }
    assert.equal((await s.raw('POST', '/api/project', { body: 'path=/', headers: { 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await s.raw('POST', '/api/project', { body: { path: s.outside }, headers: { origin: 'http://evil.example' } })).status, 403);
    assert.equal(s.app.root, s.root, 'none of those changed the project');
  } finally {
    await s.close();
  }
});

test('a locked Studio never switches, lists folders, or opens a dialog', async () => {
  const s = await startApp({ lockRoot: true });
  try {
    assert.equal((await s.get('/api/info')).json.capabilities.switchProject, false);
    for (const [m, u, b] of [['POST', '/api/project', { path: s.outside }], ['GET', '/api/folders'], ['GET', '/api/folders/find?name=x'], ['POST', '/api/project/pick', {}]]) {
      const r = await s.raw(m, u, { body: b });
      assert.equal(r.status, 403, u);
      assert.equal(r.json.error.code, 'project_locked', u);
    }
    assert.equal(s.app.root, s.root);
    assert.equal((await s.post('/api/scan', { target: '.' })).status, 200);
  } finally {
    await s.close();
  }
});

test('recent projects survive a restart and never include the current one in the list', async () => {
  const stateDir = makeDir('aad-state-');
  const stateFile = path.join(stateDir, 'studio.json');
  const s = await startApp({ stateFile });
  try {
    const a = path.join(s.home, 'a');
    const b = path.join(s.home, 'b');
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    await s.post('/api/project', { path: a });
    const second = await s.post('/api/project', { path: b });
    assert.deepEqual(second.json.recent, [a, s.root]);
    assert.deepEqual((await s.get('/api/info')).json.recent, [a, s.root]);
    assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).recent, [b, a, s.root]);
    // A new server over the same file remembers them.
    const { createApp } = await import('../lib/app.mjs');
    const again = createApp({ stateFile, token: 't'.repeat(20), home: s.home });
    assert.equal(again.root, null);
    await again.listen(0);
    const res = await fetch(`http://127.0.0.1:${again.server.address().port}/api/info`, { headers: { 'x-studio-token': 't'.repeat(20) } });
    assert.deepEqual((await res.json()).recent, [b, a, s.root]);
    await again.close();
  } finally {
    await s.close();
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('the page-side engine drives the same routes, and the in-browser engine says it cannot', async () => {
  const s = await startApp({ noRoot: true, pickFolder: async () => ({ cancelled: true }) });
  try {
    const eng = new LocalEngine({ baseUrl: s.base, token: s.token });
    write(s.home, 'Desktop/site/index.html', '<p>x</p>');
    assert.equal((await eng.folders()).path, s.home);
    assert.equal((await eng.folders(path.join(s.home, 'Desktop'))).dirs[0].files, 1);
    assert.equal((await eng.findFolder('site')).matches.length, 1);
    assert.deepEqual(await eng.pickFolder(), { cancelled: true });
    const opened = await eng.openProject(path.join(s.home, 'Desktop', 'site'));
    assert.equal(opened.scannable.files, 1);
    assert.equal((await eng.info()).root, opened.root);
    await assert.rejects(eng.openProject(s.home), (e) => e instanceof EngineError && e.code === 'too_broad');
    const wasm = new WasmEngine();
    for (const m of ['folders', 'findFolder', 'pickFolder', 'openProject']) await assert.rejects(wasm[m](), (e) => e.code === 'not_available', m);
  } finally {
    await s.close();
  }
});

test('every script the page loads is valid JavaScript', () => {
  const webDir = fileURLToPath(new URL('../web/', import.meta.url));
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.js')) files.push(path.join(d, e.name));
    }
  };
  walk(webDir);
  assert.ok(files.length > 10);
  for (const f of files) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }), path.relative(webDir, f));
  }
});

// ---- what people really paste ---------------------------------------------------------------------------

test('typed paths: a lost first slash and %20 from a web address are put right', () => {
  const home = '/Users/sam';
  // "Users" exists at the top of the disk on a Mac; "/Users/..." is tried before anything under the home folder.
  const c = pathCandidates('Users/Adam/Desktop/Anti%20ai%20design/mock-ai-site/index.html', { home });
  assert.equal(c[0], '/Users/Adam/Desktop/Anti ai design/mock-ai-site/index.html');
  assert.ok(c.includes('/Users/Adam/Desktop/Anti%20ai%20design/mock-ai-site/index.html'), 'the raw spelling stays as a fallback');
  assert.deepEqual(pathCandidates('/a/my%20site', { home }), ['/a/my site', '/a/my%20site']);
  assert.deepEqual(pathCandidates('/a/100%', { home }), ['/a/100%'], 'a stray % is not an escape');
  assert.deepEqual(pathCandidates('/a/%zz', { home }), ['/a/%zz']);
});

test('pasting a decoded, slash-less path opens the folder; a missing folder is not mistaken for an old server', async () => {
  const s = await startApp({ noRoot: true });
  try {
    const site = path.join(s.home, 'My Site');
    write(site, 'index.html', '<p>hi</p>');
    const odd = site.replace(/^\//, '').replace(/ /g, '%20');
    const ok = await s.post('/api/project', { path: odd });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.root, fs.realpathSync(site));
    const eng = new LocalEngine({ baseUrl: s.base, token: s.token });
    await assert.rejects(eng.openProject(path.join(s.home, 'nope')), (e) => e.code === 'no_such_folder');
  } finally {
    await s.close();
  }
});

test('the page can tell a server that predates the project chooser, and a locked one', async () => {
  assert.equal(serverIsOutdated({ capabilities: { folders: true, switchProject: undefined } }), true);
  assert.equal(canSwitchProject({ capabilities: { folders: true } }), false);
  assert.equal(serverIsOutdated(null), false);
  const s = await startApp();
  try {
    const info = (await s.get('/api/info')).json;
    assert.equal(serverIsOutdated(info), false);
    assert.equal(canSwitchProject(info), true);
  } finally {
    await s.close();
  }
  const old = new LocalEngine({
    baseUrl: '',
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ error: { code: 'not_found', message: 'No such API route.' } }) }),
  });
  await assert.rejects(old.openProject('/x'), (e) => e.code === 'stale_server' && /restart|start it again/i.test(e.message));
});
