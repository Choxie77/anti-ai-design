/**
 * The first-party Anti-AI Design rules (crates/aad-rules), end to end through
 * the engine binary: each rule fires on its fixture, stays quiet on the clean
 * one, and ANTI_DESIGN_BUILTIN_ONLY=1 turns the whole pack off.
 *
 * Skips cleanly when no binary is available (ANTI_DESIGN_BIN or target/release).
 * Run with: node --test tests/aad-rules.test.mjs
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
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'aad');
const BIN = findEngineBinary();

const ALL = [
  'aad-emoji-icons',
  'aad-focus-removed',
  'aad-icon-button-name',
  'aad-multiple-accents',
  'aad-mixed-radii',
  'aad-glass-overuse',
];

function run(args, env = {}) {
  const base = { ...process.env, NO_COLOR: '1', ANTI_DESIGN_NO_UPDATE_CHECK: '1' };
  delete base.ANTI_DESIGN_BUILTIN_ONLY;
  return spawnSync(BIN, args, { encoding: 'utf8', env: { ...base, ...env }, cwd: REPO_ROOT });
}

function findings(file, env) {
  const res = run(['detect', '--json', '--no-config', path.join(FIXTURES, file)], env);
  assert.ok([0, 2].includes(res.status), `exit ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

describe('Anti-AI Design rules in the engine binary', { skip: BIN ? false : ENGINE_MISSING_MESSAGE }, () => {
  it('lists the six rows next to the built-in rules', () => {
    const res = run(['detect', '--list-rules', '--json']);
    assert.equal(res.status, 0);
    const ids = JSON.parse(res.stdout).map((r) => r.id);
    for (const id of ALL) assert.ok(ids.includes(id), id);
    assert.ok(ids.includes('side-tab'), 'built-in rules are still there');
  });

  it('fires every rule on the bad fixture, at the expected lines', () => {
    const byRule = Object.fromEntries(findings('bad.html').map((f) => [f.antipattern, f.line]));
    for (const id of ALL) assert.ok(id in byRule, `${id} did not fire`);
    assert.equal(byRule['aad-focus-removed'], 7);
    assert.equal(byRule['aad-mixed-radii'], 7);
    assert.equal(byRule['aad-glass-overuse'], 11);
    assert.equal(byRule['aad-multiple-accents'], 14);
    assert.equal(byRule['aad-emoji-icons'], 21);
    assert.equal(byRule['aad-icon-button-name'], 25);
  });

  it('marks the taste rules as advisories and the defects as findings', () => {
    const sev = Object.fromEntries(findings('bad.html').map((f) => [f.antipattern, f.severity]));
    for (const id of ['aad-multiple-accents', 'aad-mixed-radii', 'aad-glass-overuse']) assert.equal(sev[id], 'advisory', id);
    for (const id of ['aad-emoji-icons', 'aad-focus-removed', 'aad-icon-button-name']) assert.equal(sev[id], 'warning', id);
  });

  it('stays quiet on the clean fixture', () => {
    const own = findings('clean.html').filter((f) => f.antipattern.startsWith('aad-'));
    assert.deepEqual(own, []);
  });

  it('ANTI_DESIGN_BUILTIN_ONLY=1 removes the pack from scans and from the rule list', () => {
    const env = { ANTI_DESIGN_BUILTIN_ONLY: '1' };
    assert.deepEqual(findings('bad.html', env).filter((f) => f.antipattern.startsWith('aad-')), []);
    const ids = JSON.parse(run(['detect', '--list-rules', '--json'], env).stdout).map((r) => r.id);
    assert.equal(ids.filter((id) => id.startsWith('aad-')).length, 0);
    assert.equal(ids.length, 62);
  });

  it('an inline ignore waives a pack rule', () => {
    // --no-config would also switch inline ignores off, and this repo's own config
    // ignores tests/fixtures, so scan a copy in a scratch project.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aad-waive-'));
    try {
      const copy = path.join(dir, 'waived.css');
      fs.copyFileSync(path.join(FIXTURES, 'waived.css'), copy);
      const res = spawnSync(BIN, ['detect', '--json', copy], {
        encoding: 'utf8', cwd: dir, env: { ...process.env, NO_COLOR: '1', ANTI_DESIGN_NO_UPDATE_CHECK: '1' },
      });
      assert.ok([0, 2].includes(res.status), res.stderr);
      assert.deepEqual(JSON.parse(res.stdout).filter((f) => f.antipattern === 'aad-focus-removed'), []);
      // The same file without the comment is flagged, so the waiver is what silenced it.
      fs.writeFileSync(copy, fs.readFileSync(copy, 'utf8').split('\n').slice(1).join('\n'));
      const again = spawnSync(BIN, ['detect', '--json', copy], {
        encoding: 'utf8', cwd: dir, env: { ...process.env, NO_COLOR: '1', ANTI_DESIGN_NO_UPDATE_CHECK: '1' },
      });
      assert.equal(JSON.parse(again.stdout).filter((f) => f.antipattern === 'aad-focus-removed').length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
