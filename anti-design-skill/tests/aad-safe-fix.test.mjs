/**
 * The safe-fix tier (`anti-ai-design detect --fix [--write]`) through the engine binary:
 * a dry run prints a diff and changes nothing, --write applies and logs one line, and a
 * second run is a no-op. The same cases run as Rust tests in crates/cli/tests/safe_fix.rs;
 * this keeps them reachable from the Node suites too.
 *
 * Skips cleanly when no binary is available (ANTI_AI_DESIGN_BIN or target/release).
 * Run with: node --test tests/aad-safe-fix.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENGINE_MISSING_MESSAGE, findEngineBinary } from './lib/engine-bin.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'aad', 'gradient-text.css');
const BIN = findEngineBinary();

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aad-safe-fix-'));
  fs.copyFileSync(FIXTURE, path.join(dir, 'a.css'));
  return dir;
}

function run(dir, args) {
  const env = { ...process.env, HOME: dir, NO_COLOR: '1', ANTI_AI_DESIGN_NO_UPDATE_CHECK: '1' };
  delete env.ANTI_AI_DESIGN_BUILTIN_ONLY;
  return spawnSync(BIN, args, { encoding: 'utf8', env, cwd: dir });
}

const log = (dir) => path.join(dir, '.anti-ai-design', 'changelog.md');
const entries = (dir) => (fs.existsSync(log(dir)) ? fs.readFileSync(log(dir), 'utf8').split('\n').filter((l) => l.startsWith('- ')) : []);

describe('safe-fix tier', { skip: BIN ? false : ENGINE_MISSING_MESSAGE }, () => {
  it('dry run prints a diff and changes nothing', () => {
    const dir = project();
    const before = fs.readFileSync(path.join(dir, 'a.css'), 'utf8');
    const res = run(dir, ['detect', '--fix', 'a.css']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^--- a\/a\.css\n\+\+\+ b\/a\.css\n@@ /);
    assert.match(res.stdout, /\+  color: #6366f1;/);
    assert.equal(fs.readFileSync(path.join(dir, 'a.css'), 'utf8'), before);
    assert.equal(fs.existsSync(path.join(dir, '.anti-ai-design')), false);
  });

  it('--write applies, logs once, and a second run does nothing', () => {
    const dir = project();
    assert.equal(run(dir, ['detect', '--write', 'a.css']).status, 0);
    const after = fs.readFileSync(path.join(dir, 'a.css'), 'utf8');
    assert.match(after, /color: #6366f1;/);
    assert.doesNotMatch(after, /background-clip/);
    assert.equal(entries(dir).length, 1);
    const logged = fs.readFileSync(log(dir), 'utf8');

    const again = run(dir, ['detect', '--write', 'a.css']);
    assert.equal(again.status, 0);
    assert.equal(again.stdout, '');
    assert.equal(fs.readFileSync(path.join(dir, 'a.css'), 'utf8'), after);
    assert.equal(fs.readFileSync(log(dir), 'utf8'), logged);
  });
});
