import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../lib/app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FAKE = path.join(here, 'fake-engine.mjs');
export const GRADIENT = '.hero h1 {\n  font-size: 3rem;\n  background: linear-gradient(90deg, #6366f1, #ec4899);\n  -webkit-background-clip: text;\n  background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n';

export function makeDir(prefix = 'aad-test-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

export function write(root, rel, text) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
}

/** Start the app on a random port over a fresh root. */
export async function startApp({ files = {}, engineBin = FAKE, token = 'test-token-0123456789' } = {}) {
  const root = makeDir('aad-root-');
  const outside = makeDir('aad-outside-');
  const tmpParent = makeDir('aad-tmp-');
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  const app = createApp({ root, token, engineBin, tmpParent });
  const port = await app.listen(0);
  function raw(method, urlPath, { body, headers = {}, host, auth = true } = {}) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
      const h = { Host: host || `127.0.0.1:${port}`, ...headers };
      if (auth && h['x-studio-token'] === undefined) h['x-studio-token'] = token;
      if (data !== undefined) {
        if (!h['content-type']) h['content-type'] = 'application/json';
        h['content-length'] = Buffer.byteLength(data);
      }
      const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      });
      req.on('error', reject);
      if (data !== undefined) req.write(data);
      req.end();
    });
  }
  return {
    app,
    root,
    outside,
    tmpParent,
    token,
    port,
    base: `http://127.0.0.1:${port}`,
    raw,
    get: (p, o) => raw('GET', p, o),
    post: (p, body, o) => raw('POST', p, { body, ...o }),
    async close() {
      await app.close();
      for (const d of [root, outside, tmpParent]) fs.rmSync(d, { recursive: true, force: true });
    },
  };
}

export async function withEnv(vars, fn) {
  const old = {};
  for (const [k, v] of Object.entries(vars)) {
    old[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
