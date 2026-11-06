// HTTP server: static files from web/ plus a small JSON API around the engine.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as engine from './engine.mjs';
import { parseUnifiedDiff } from './diff.mjs';
import { inspectProject, SKIP_DIRS } from './project.mjs';
import { locateFinding, linkedStylesheets } from './locate.mjs';
import {
  HttpError,
  CSP,
  MAX_BODY_BYTES,
  MAX_FILE_BYTES,
  MAX_SNIPPET_BYTES,
  hasDotSegment,
  isInside,
  newToken,
  relLabel,
  resolveInside,
  safeEqual,
} from './security.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, '..', 'web');
const SNIPPET_EXTS = new Set(['html', 'css', 'jsx', 'tsx']);
const CONTEXT_RADIUS = 3;
const CHANGELOG_REL = '.anti-ai-design/changelog.md'; // the engine's changelog location

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * @param {object} opts
 * @param {string} opts.root        project folder the server may touch
 * @param {string} [opts.token]     API token (random when omitted)
 * @param {string} [opts.engineBin] explicit engine binary
 * @param {string} [opts.tmpParent] where snippet temp folders are created
 */
export function createApp(opts) {
  const realRoot = fs.realpathSync(opts.root);
  if (!fs.statSync(realRoot).isDirectory()) throw new Error('--root must be a folder');
  const token = opts.token || newToken();
  const tmpParent = opts.tmpParent || os.tmpdir();
  let port = 0;
  let cachedRules = null;
  let writeLock = Promise.resolve();

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => sendError(res, err));
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 20_000;

  // ---- engine -------------------------------------------------------------
  async function getEngine() {
    const bin = engine.resolveBinary({ explicit: opts.engineBin });
    if (!bin) {
      throw new HttpError(503, 'engine_not_found', 'The detector binary was not found.', {
        buildCommand: engine.BUILD_COMMAND,
      });
    }
    return bin;
  }

  async function info() {
    const bin = engine.resolveBinary({ explicit: opts.engineBin });
    let version = null;
    let error = null;
    if (bin) {
      try {
        version = await engine.engineVersion(bin);
      } catch (e) {
        error = e.message;
      }
    }
    return {
      engine: { found: Boolean(bin) && !error, path: bin, version, error },
      root: realRoot,
      buildCommand: engine.BUILD_COMMAND,
      limits: { maxFileBytes: MAX_FILE_BYTES, maxSnippetBytes: MAX_SNIPPET_BYTES },
      snippetExts: [...SNIPPET_EXTS],
      capabilities: { folders: true, snippets: true, apply: true, changelog: true },
    };
  }

  // ---- inputs -------------------------------------------------------------
  /** Runs fn({cwd, base, target, label, cleanup}) for a folder/file target or a pasted snippet. */
  async function withInput(body, fn) {
    if (body && typeof body.snippet === 'string') {
      const ext = String(body.ext || '').toLowerCase();
      if (!SNIPPET_EXTS.has(ext)) throw new HttpError(400, 'bad_ext', `Snippet type must be one of: ${[...SNIPPET_EXTS].join(', ')}.`);
      if (Buffer.byteLength(body.snippet) > MAX_SNIPPET_BYTES) throw new HttpError(413, 'too_large', 'That snippet is over 1 MB.');
      if (body.snippet.length === 0) throw new HttpError(400, 'empty_snippet', 'Paste some code first.');
      const dir = await fsp.mkdtemp(path.join(tmpParent, 'aad-studio-'));
      try {
        const realDir = await fsp.realpath(dir);
        const file = path.join(realDir, `snippet.${ext}`);
        await fsp.writeFile(file, body.snippet, { mode: 0o600 });
        return await fn({ kind: 'snippet', cwd: realDir, base: realDir, target: file, label: `snippet.${ext}`, file });
      } finally {
        await fsp.rm(dir, { recursive: true, force: true });
      }
    }
    const real = resolveInside(realRoot, typeof body?.target === 'string' && body.target !== '' ? body.target : '.');
    const st = fs.statSync(real);
    if (st.isFile() && st.size > MAX_FILE_BYTES) throw new HttpError(413, 'file_too_large', 'That file is over 2 MB.');
    return fn({ kind: st.isDirectory() ? 'folder' : 'file', cwd: realRoot, base: realRoot, target: real, label: relLabel(realRoot, real) || '.' });
  }

  /** The lines of a file inside base, or null when it is hidden, outside base, too big or unreadable. */
  function loadLines(base, rel, cache) {
    if (hasDotSegment(rel)) return null; // dotfiles are only read by the engine
    let lines = cache.get(rel);
    if (lines === undefined) {
      lines = null;
      try {
        const real = fs.realpathSync(path.join(base, rel));
        if (isInside(base, real)) {
          const st = fs.statSync(real);
          if (st.isFile() && st.size <= MAX_FILE_BYTES) lines = fs.readFileSync(real, 'utf8').split(/\r?\n/);
        }
      } catch {
        lines = null;
      }
      cache.set(rel, lines);
    }
    return lines;
  }

  function readContext(base, rel, line, cache) {
    if (!Number.isInteger(line) || line < 1) return null;
    const lines = loadLines(base, rel, cache);
    if (!lines) return null;
    const start = Math.max(1, line - CONTEXT_RADIUS);
    const end = Math.min(lines.length, line + CONTEXT_RADIUS);
    const out = [];
    for (let n = start; n <= end; n++) out.push({ n, text: lines[n - 1].slice(0, 400), hit: n === line });
    return { start, end, lines: out };
  }

  /**
   * The detector gives no line for findings in HTML pages, nor for ones that come from a stylesheet the page
   * links. Find the most likely line (in the page first, then its stylesheets) and say it is a guess.
   */
  function locateMissingLines(base, findings, cache) {
    const used = new Set();
    const linked = new Map();
    for (const f of findings) {
      if (f.line) continue;
      const own = loadLines(base, f.file, cache);
      if (!own) continue;
      const candidates = [{ rel: f.file, lines: own }];
      if (/\.html?$/i.test(f.file)) {
        if (!linked.has(f.file)) {
          const found = [];
          for (const href of linkedStylesheets(own)) {
            const abs = path.resolve(base, path.dirname(f.file), href);
            const rel = isInside(base, abs) ? relLabel(base, abs) : null;
            const lines = rel ? loadLines(base, rel, cache) : null;
            if (lines) found.push({ rel, lines, via: f.file });
          }
          linked.set(f.file, found);
        }
        candidates.push(...linked.get(f.file));
      }
      const hit = locateFinding(f, candidates, used);
      if (!hit) continue;
      f.file = hit.rel;
      f.line = hit.line;
      f.located = { approximate: true, via: hit.via };
    }
  }

  function summarize(findings, files) {
    const bySeverity = {};
    const byCategory = {};
    const byRule = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      byRule[f.rule] = (byRule[f.rule] || 0) + 1;
    }
    return { total: findings.length, files: files.size, bySeverity, byCategory, byRule };
  }

  async function doScan(body) {
    const bin = await getEngine();
    return withInput(body, async (ctx) => {
      const started = Date.now();
      const { findings: raw } = await engine.detectJson(bin, ctx.target, ctx.cwd);
      const cache = new Map();
      const realCache = new Map();
      const findings = [];
      let skipped = 0;
      for (const f of raw) {
        const rel = toRel(ctx.base, f.file, realCache);
        if (rel === null) {
          skipped += 1;
          continue;
        }
        findings.push({
          id: String(findings.length),
          rule: String(f.antipattern ?? ''),
          name: String(f.name ?? f.antipattern ?? ''),
          description: String(f.description ?? ''),
          severity: String(f.severity ?? 'warning'),
          category: String(f.category ?? 'other'),
          file: rel,
          line: Number.isInteger(f.line) ? f.line : 0,
          snippet: String(f.snippet ?? ''),
          advisory: Boolean(f.advisory),
          context: null,
        });
      }
      locateMissingLines(ctx.base, findings, cache);
      // A page that links a stylesheet makes the engine report the stylesheet's marks twice: once for the page
      // and once for the file itself. Once both sit on the same line they are the same mark, so keep one.
      const seen = new Set(findings.filter((f) => !f.located).map((f) => `${f.rule}|${f.file}:${f.line}`));
      const unique = findings.filter((f) => {
        if (!f.located) return true;
        const k = `${f.rule}|${f.file}:${f.line}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      findings.length = 0;
      unique.forEach((f, i) => findings.push({ ...f, id: String(i) }));
      for (const f of findings) f.context = readContext(ctx.base, f.file, f.line, cache);
      const files = new Set(findings.map((f) => f.file));
      return {
        kind: ctx.kind,
        target: ctx.label,
        durationMs: Date.now() - started,
        scanned: ctx.kind === 'snippet' ? { files: 1, byExt: { ['.' + ctx.label.split('.').pop()]: 1 }, skippedDirs: [], truncated: false } : inspectProject(ctx.target),
        skipped,
        summary: summarize(findings, files),
        findings,
      };
    });
  }

  /** Engine path -> label relative to base, or null when it falls outside base. */
  function toRel(base, file, cache) {
    if (typeof file !== 'string' || file === '') return null;
    if (cache.has(file)) return cache.get(file);
    let out = null;
    try {
      const real = fs.realpathSync(path.resolve(base, file));
      if (isInside(base, real)) out = relLabel(base, real);
    } catch {
      out = null;
    }
    cache.set(file, out);
    return out;
  }

  /** Validate that every file a diff touches resolves inside base. */
  function checkDiffFiles(base, files) {
    for (const f of files) {
      let real;
      try {
        real = fs.realpathSync(path.resolve(base, f.file));
      } catch {
        throw new HttpError(403, 'outside_root', `Refusing to touch ${f.file}: it cannot be resolved inside the project folder.`);
      }
      if (!isInside(base, real)) {
        throw new HttpError(403, 'outside_root', `Refusing to touch ${f.file}: it resolves outside the project folder.`);
      }
    }
  }

  function countFixes(summary, files) {
    const m = /(\d+)\s+safe fix/i.exec(summary || '');
    if (m) return Number(m[1]);
    return files.reduce((n, f) => n + f.hunks.length, 0);
  }

  async function dryRun(bin, ctx) {
    const { diff, summary } = await engine.fixDryRun(bin, ctx.target, ctx.cwd);
    const files = parseUnifiedDiff(diff);
    checkDiffFiles(ctx.base, files);
    return {
      kind: ctx.kind,
      target: ctx.label,
      fixCount: countFixes(summary, files),
      fileCount: files.length,
      files,
      summary,
      diffId: crypto.createHash('sha256').update(diff).digest('hex'),
    };
  }

  async function doPreview(body) {
    const bin = await getEngine();
    return withInput(body, (ctx) => dryRun(bin, ctx));
  }

  async function doApply(body) {
    if (body?.confirm !== true) {
      throw new HttpError(400, 'confirmation_required', 'Applying fixes needs {"confirm": true}.');
    }
    const bin = await getEngine();
    // One writer at a time.
    const run = writeLock.then(() =>
      withInput(body, async (ctx) => {
        const preview = await dryRun(bin, ctx);
        if (body.diffId !== undefined && body.diffId !== preview.diffId) {
          throw new HttpError(409, 'diff_changed', 'The files changed since you previewed the fixes. Preview again.');
        }
        if (preview.fixCount === 0) return { ...preview, applied: 0, written: [] };
        if (ctx.kind === 'snippet') {
          await engine.fixWrite(bin, ctx.target, ctx.cwd);
          const fixed = await fsp.readFile(ctx.file, 'utf8');
          return { ...preview, applied: preview.fixCount, written: [], fixed };
        }
        // The engine logs to <root>/.anti-ai-design/changelog.md; that folder must not be a way out.
        const ctxDir = path.join(realRoot, path.dirname(CHANGELOG_REL));
        if (fs.existsSync(ctxDir) && !isInside(realRoot, fs.realpathSync(ctxDir))) {
          throw new HttpError(403, 'outside_root', 'The changelog folder resolves outside the project folder.');
        }
        const { diff, summary } = await engine.fixWrite(bin, ctx.target, ctx.cwd);
        const files = parseUnifiedDiff(diff);
        return { ...preview, summary, files, applied: preview.fixCount, written: files.map((f) => f.file) };
      }),
    );
    writeLock = run.catch(() => {});
    return run;
  }

  async function doChangelog() {
    const empty = { exists: false, path: CHANGELOG_REL, entries: [] };
    const dir = path.join(realRoot, path.dirname(CHANGELOG_REL));
    let file;
    try {
      file = fs.realpathSync(path.join(dir, path.basename(CHANGELOG_REL)));
    } catch {
      return empty;
    }
    if (!isInside(realRoot, file)) throw new HttpError(403, 'outside_root', 'The changelog resolves outside the project folder.');
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return empty;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('- '));
    const entries = lines.slice(-20).map((l) => {
      const [time = '', rule = '', where = '', ...change] = l.slice(2).split(' | ');
      return { time: time.trim(), rule: rule.trim(), where: where.trim(), change: change.join(' | ').trim() };
    });
    return { exists: true, path: CHANGELOG_REL, entries, total: lines.length };
  }

  async function doBrowse(url) {
    const real = resolveInside(realRoot, url.searchParams.get('path') || '.');
    if (!fs.statSync(real).isDirectory()) throw new HttpError(400, 'not_a_folder', 'That path is not a folder.');
    const rel = relLabel(realRoot, real);
    if (rel && hasDotSegment(rel)) throw new HttpError(403, 'dotfile', 'Hidden folders are not listed.');
    const dirs = [];
    let fileCount = 0;
    for (const e of fs.readdirSync(real, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      let isDir = e.isDirectory();
      let isFile = e.isFile();
      if (e.isSymbolicLink()) {
        try {
          const target = fs.realpathSync(path.join(real, e.name));
          if (!isInside(realRoot, target)) continue; // links out of the root are not shown
          const st = fs.statSync(target);
          isDir = st.isDirectory();
          isFile = st.isFile();
        } catch {
          continue;
        }
      }
      if (isDir) dirs.push(e.name);
      else if (isFile) fileCount += 1;
    }
    dirs.sort((a, b) => a.localeCompare(b));
    return {
      scannable: inspectProject(real),
      skippedDirs: dirs.filter((d) => SKIP_DIRS.includes(d)),
      path: rel,
      parent: rel === '' ? null : path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel),
      dirs: dirs.slice(0, 500),
      truncated: dirs.length > 500,
      fileCount,
    };
  }

  // ---- request plumbing ---------------------------------------------------
  function allowedHosts() {
    return new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  }

  function checkOrigin(req) {
    const hosts = allowedHosts();
    if (!hosts.has(String(req.headers.host || '').toLowerCase())) {
      throw new HttpError(403, 'bad_host', 'Unexpected Host header.');
    }
    const origin = req.headers.origin;
    if (origin !== undefined) {
      let ok = false;
      try {
        const u = new URL(origin);
        ok = u.protocol === 'http:' && hosts.has(u.host.toLowerCase());
      } catch {
        ok = false;
      }
      if (!ok) throw new HttpError(403, 'bad_origin', 'Cross-origin requests are refused.');
    }
    const site = req.headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin' && site !== 'none') {
      throw new HttpError(403, 'bad_origin', 'Cross-origin requests are refused.');
    }
  }

  async function readJson(req) {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') throw new HttpError(415, 'bad_content_type', 'Send application/json.');
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'Request body is too large.');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'Request body is too large.');
      chunks.push(chunk);
    }
    if (size === 0) return {};
    try {
      const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
      return v;
    } catch {
      throw new HttpError(400, 'bad_json', 'The request body is not a JSON object.');
    }
  }

  function baseHeaders(extra = {}) {
    return {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      ...extra,
    };
  }

  function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }));
    res.end(body);
  }

  function sendError(res, err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (err instanceof HttpError) {
      return sendJson(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof engine.EngineRunError) {
      return sendJson(res, 502, { error: { code: err.code, message: err.message, details: { stderr: err.stderr.slice(0, 2000) } } });
    }
    process.stderr.write(`studio: unexpected error: ${err && err.stack ? err.stack : err}\n`);
    return sendJson(res, 500, { error: { code: 'internal', message: 'Something went wrong inside the server.' } });
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      throw new HttpError(400, 'bad_path', 'Bad path.');
    }
    if (rel === '/') rel = '/index.html';
    if (rel.includes('\0')) throw new HttpError(400, 'bad_path', 'Bad path.');
    const file = path.resolve(WEB_DIR, '.' + rel);
    if (!isInside(WEB_DIR, file)) throw new HttpError(404, 'not_found', 'Not found.');
    let real;
    try {
      real = fs.realpathSync(file);
    } catch {
      throw new HttpError(404, 'not_found', 'Not found.');
    }
    if (!isInside(fs.realpathSync(WEB_DIR), real) || !fs.statSync(real).isFile()) throw new HttpError(404, 'not_found', 'Not found.');
    const type = MIME[path.extname(real).toLowerCase()];
    if (!type) throw new HttpError(404, 'not_found', 'Not found.');
    const data = fs.readFileSync(real);
    res.writeHead(200, baseHeaders({ 'Content-Type': type, 'Content-Length': data.length }));
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function handle(req, res) {
    checkOrigin(req);
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

    const sent = req.headers['x-studio-token'];
    if (typeof sent !== 'string' || !safeEqual(sent, token)) {
      throw new HttpError(401, 'bad_token', 'Missing or wrong token. Open the URL printed when the server started.');
    }
    const route = `${req.method} ${url.pathname}`;
    switch (route) {
      case 'GET /api/info':
        return sendJson(res, 200, await info());
      case 'GET /api/rules': {
        const bin = await getEngine();
        if (!cachedRules) {
          const rules = await engine.listRules(bin);
          cachedRules = rules.map((r) => ({
            id: String(r.id),
            name: String(r.name ?? r.id),
            category: String(r.category ?? 'other'),
            severity: String(r.severity ?? 'warning'),
            scopes: Array.isArray(r.scopes) ? r.scopes.map(String) : [],
            description: String(r.description ?? ''),
            firstParty: String(r.id).startsWith('aad-'),
          }));
        }
        return sendJson(res, 200, { rules: cachedRules });
      }
      case 'GET /api/browse':
        return sendJson(res, 200, await doBrowse(url));
      case 'GET /api/changelog':
        return sendJson(res, 200, await doChangelog());
      case 'POST /api/scan':
        return sendJson(res, 200, await doScan(await readJson(req)));
      case 'POST /api/fix/preview':
        return sendJson(res, 200, await doPreview(await readJson(req)));
      case 'POST /api/fix/apply':
        return sendJson(res, 200, await doApply(await readJson(req)));
      default:
        throw new HttpError(404, 'not_found', 'No such API route.');
    }
  }

  return {
    server,
    token,
    root: realRoot,
    /** Listens on 127.0.0.1 only. Resolves with the port. */
    listen(wantedPort = 0) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(wantedPort, '127.0.0.1', () => {
          port = server.address().port;
          resolve(port);
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    },
  };
}
