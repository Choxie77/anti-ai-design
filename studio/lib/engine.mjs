// Runs the detector binary. Every call goes through execFile with an args
// array: there is never a shell and never a string built from user input.
import { execFile } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The binary is still called `anti-design` in the code base; the rename pass
// will switch it to `anti-ai-design`. Both names live ONLY in this list.
export const ENGINE_NAMES = ['anti-ai-design', 'anti-design'];
export const ENGINE_ENV_VARS = ['ANTI_AI_DESIGN_BIN', 'ANTI_DESIGN_BIN'];
export const BUILD_COMMAND = 'cargo build --release -p anti-design --manifest-path anti-design-skill/Cargo.toml';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_RELEASE = path.resolve(here, '..', '..', 'anti-design-skill', 'target', 'release');

function isExecutable(p) {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the engine binary. Returns an absolute path or null. */
export function resolveBinary({ explicit, env = process.env } = {}) {
  // An explicit --engine path is exclusive: if it does not run, there is no fallback.
  if (explicit) return isExecutable(path.resolve(explicit)) ? path.resolve(explicit) : null;
  const candidates = [];
  for (const v of ENGINE_ENV_VARS) if (env[v]) candidates.push(path.resolve(env[v]));
  for (const n of ENGINE_NAMES) candidates.push(path.join(REPO_RELEASE, n));
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const n of ENGINE_NAMES) candidates.push(path.join(dir, n));
  }
  return candidates.find(isExecutable) || null;
}

export class EngineRunError extends Error {
  constructor(message, { code = 'engine_failed', stderr = '', exitCode = null } = {}) {
    super(message);
    this.name = 'EngineRunError';
    this.code = code;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

/**
 * Run the binary. Exit codes 0 (clean) and 2 (findings) are both success.
 * Anything else, a timeout or a spawn failure is an EngineRunError.
 */
export function run(bin, args, { cwd, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (!err) return resolve({ stdout, stderr, exitCode: 0 });
        if (err.killed || err.signal) {
          return reject(new EngineRunError('The engine took too long and was stopped.', { code: 'engine_timeout', stderr }));
        }
        if (err.code === 2) return resolve({ stdout, stderr, exitCode: 2 });
        const exitCode = typeof err.code === 'number' ? err.code : null;
        reject(
          new EngineRunError((stderr || err.message || 'The engine failed.').trim().split('\n')[0], {
            code: 'engine_failed',
            stderr,
            exitCode,
          }),
        );
      },
    );
  });
}

export async function engineVersion(bin) {
  const { stdout } = await run(bin, ['--version'], { timeoutMs: 10_000 });
  return stdout.trim();
}

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch {
    throw new EngineRunError(`The engine returned something that is not JSON (${what}).`, { code: 'engine_bad_output' });
  }
}

export async function detectJson(bin, target, cwd) {
  const { stdout, exitCode } = await run(bin, ['detect', '--json', target], { cwd });
  const findings = parseJson(stdout, 'detect --json');
  if (!Array.isArray(findings)) throw new EngineRunError('Unexpected engine output: expected a list of findings.', { code: 'engine_bad_output' });
  return { findings, exitCode };
}

export async function listRules(bin) {
  const { stdout } = await run(bin, ['detect', '--list-rules', '--json'], { timeoutMs: 20_000 });
  const rules = parseJson(stdout, 'detect --list-rules --json');
  if (!Array.isArray(rules)) throw new EngineRunError('Unexpected engine output: expected a list of rules.', { code: 'engine_bad_output' });
  return rules;
}

/** Dry run. Returns the unified diff text and the summary line. */
export async function fixDryRun(bin, target, cwd) {
  const { stdout, stderr } = await run(bin, ['detect', '--fix', target], { cwd });
  return { diff: stdout, summary: stderr.trim() };
}

/** Writes the fixes and appends to .anti-design/changelog.md in cwd. */
export async function fixWrite(bin, target, cwd) {
  const { stdout, stderr } = await run(bin, ['detect', '--write', target], { cwd });
  return { diff: stdout, summary: stderr.trim() };
}
