// The only door between the UI and a detector. The UI imports nothing else
// that talks to an engine. Two implementations share one contract:
//
//   LocalEngine  talks to studio/server.mjs over HTTP (works today)
//   WasmEngine   will run the detector in the browser (stub; see README)
//
// Contract (all methods return promises; all failures reject with EngineError):
//   info()                      -> { engine:{found,path,version,error}, root, buildCommand, limits, snippetExts, capabilities }
//   listRules()                 -> { rules:[{id,name,category,severity,scopes,description,firstParty}] }
//   scan(input)                 -> { kind, target, durationMs, skipped, summary, findings:[...] }
//   previewFixes(input)         -> { kind, target, fixCount, fileCount, files:[...], summary, diffId }
//   applyFixes(input)           -> previewFixes result + { applied, written:[...], fixed? } ; input.confirm must be true
//   browse(path)                -> { path, parent, dirs:[...], fileCount }       (folder mode only)
//   changelog()                 -> { exists, path, entries:[{time,rule,where,change}] } (folder mode only)
//
// input is either { target: "relative/folder/or/file" } or { snippet: "code", ext: "html|css|jsx|tsx" }.

export class EngineError extends Error {
  constructor(code, message, { status = 0, details } = {}) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class LocalEngine {
  constructor({ baseUrl = '', token = '', fetchImpl } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.fetchImpl = fetchImpl || ((...a) => fetch(...a));
    this.kind = 'local';
  }

  async call(method, path, body) {
    const headers = { 'x-studio-token': this.token };
    const init = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await this.fetchImpl(this.baseUrl + path, init);
    } catch {
      throw new EngineError('unreachable', 'Cannot reach the Studio server. Is it still running?');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const e = data && data.error;
      throw new EngineError(e?.code || 'http_' + res.status, e?.message || `The server answered ${res.status}.`, {
        status: res.status,
        details: e?.details,
      });
    }
    return data;
  }

  info() {
    return this.call('GET', '/api/info');
  }
  listRules() {
    return this.call('GET', '/api/rules');
  }
  scan(input) {
    return this.call('POST', '/api/scan', input);
  }
  previewFixes(input) {
    return this.call('POST', '/api/fix/preview', input);
  }
  applyFixes(input) {
    return this.call('POST', '/api/fix/apply', input);
  }
  browse(path = '') {
    return this.call('GET', '/api/browse?path=' + encodeURIComponent(path || '.'));
  }
  changelog() {
    return this.call('GET', '/api/changelog');
  }
}

const NOT_YET = 'The in-browser engine is not available yet.';

/**
 * Stub for public-website mode. A later session implements it with the wasm
 * crate (detect_text_json / detect_html_source_json). Every method throws.
 */
export class WasmEngine {
  constructor() {
    this.kind = 'wasm';
  }
  fail() {
    return Promise.reject(new EngineError('not_available', NOT_YET));
  }
  info() {
    return this.fail();
  }
  listRules() {
    return this.fail();
  }
  scan() {
    return this.fail();
  }
  previewFixes() {
    return this.fail();
  }
  applyFixes() {
    return this.fail();
  }
  browse() {
    return this.fail();
  }
  changelog() {
    return this.fail();
  }
}

export function createEngine({ kind = 'local', ...options } = {}) {
  if (kind === 'wasm') return new WasmEngine();
  return new LocalEngine(options);
}
