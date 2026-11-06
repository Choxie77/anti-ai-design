// The guided experience: tour content, field guide, first-run state, and that every file is served.
// DOM-free on purpose. The pictures themselves are checked by eye in a browser; what can go wrong
// silently (a rule id that no longer exists, a chapter pointing at a missing picture) is checked here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBinary } from '../lib/engine.mjs';
import { LocalEngine } from '../web/engine.js';
import { CHAPTERS, chapterFromHash, clampChapter } from '../web/tour-content.js';
import { SPECIMENS, specimenForRule, specimenById } from '../web/guide-content.js';
import { SAMPLE, SAMPLE_EXT } from '../web/sample.js';
import { startApp } from './helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, '..', 'web');
const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');

test('tour: chapters are well formed and in a sensible order', () => {
  const ids = CHAPTERS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'chapter ids are unique');
  assert.ok(CHAPTERS.length >= 4);
  for (const c of CHAPTERS) {
    assert.ok(c.title && c.kicker && c.body.length >= 1, `${c.id} has copy`);
    for (const p of c.body) assert.ok(p.length > 20, `${c.id} body is not a stub`);
    for (const [t, d] of c.legend || []) assert.ok(t && d, `${c.id} legend rows have a term and a meaning`);
  }
  // The three steps appear in the same order as the nav: Scan, Findings, Fixes.
  const steps = CHAPTERS.filter((c) => c.step).map((c) => c.step);
  assert.deepEqual(steps, [1, 2, 3]);
  // Only the last chapter carries the call to action.
  assert.deepEqual(CHAPTERS.filter((c) => c.final).map((c) => c.id), [ids.at(-1)]);
});

test('tour: every chapter points at a picture that exists', () => {
  const art = read('art.js');
  const scenes = /export const SCENES = \{([\s\S]*?)\};/.exec(art)?.[1] || '';
  for (const c of CHAPTERS) assert.match(scenes, new RegExp(`\\b${c.scene}:`), `${c.id} -> scene "${c.scene}"`);
});

test('tour: legends match the numbered markers drawn in the pictures', () => {
  const art = read('art.js');
  const problem = /export function sceneProblem\(\)[\s\S]*?\n\}/.exec(art)[0];
  const findings = /export function sceneFindings\(\)[\s\S]*?\n\}/.exec(art)[0];
  const markerCount = (src, re) => new Set([...src.matchAll(re)].map((m) => m[1])).size;
  assert.equal(markerCount(problem, /\bn: (\d+), label/g), CHAPTERS.find((c) => c.id === 'problem').legend.length);
  assert.equal(markerCount(findings, /\bn: (\d+), y: \d+, label/g), CHAPTERS.find((c) => c.id === 'findings').legend.length);
});

test('tour: deep links and clamping', () => {
  assert.equal(chapterFromHash('#/welcome'), 0);
  assert.equal(chapterFromHash('#/welcome/1'), 0);
  assert.equal(chapterFromHash('#/welcome/3'), 2);
  assert.equal(chapterFromHash(`#/welcome/${CHAPTERS.length}`), CHAPTERS.length - 1);
  assert.equal(chapterFromHash('#/welcome/99'), CHAPTERS.length - 1, 'too far clamps to the last chapter');
  assert.equal(chapterFromHash('#/welcome/0'), 0);
  assert.equal(chapterFromHash('#/scan'), 0);
  assert.equal(chapterFromHash(undefined), 0);
  assert.equal(clampChapter(-4), 0);
  assert.equal(clampChapter('x'), 0);
  assert.equal(clampChapter(2.9), 2);
});

test('field guide: specimens are unique, complete, and every one has a plate', () => {
  const ids = SPECIMENS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const guideSrc = read('views/guide.js');
  for (const s of SPECIMENS) {
    assert.ok(s.title && s.tell && s.instead && s.rules.length, `${s.id} is complete`);
    assert.match(guideSrc, new RegExp(`(?:'${s.id}'|\\b${s.id}):\\s*\\(\\)`), `${s.id} has a plate builder`);
    assert.equal(specimenById(s.id), s);
    for (const r of s.rules) assert.equal(specimenForRule(r), s);
  }
  assert.equal(specimenForRule('no-such-rule'), null);
});

test('field guide: every rule it names is a real detector rule (real engine)', { skip: !resolveBinary() && 'engine binary not found' }, async () => {
  const s = await startApp({ engineBin: resolveBinary() });
  try {
    const { rules } = await new LocalEngine({ baseUrl: s.base, token: s.token }).listRules();
    const known = new Set(rules.map((r) => r.id));
    for (const sp of SPECIMENS) for (const r of sp.rules) assert.ok(known.has(r), `${sp.id}: rule "${r}" exists in the engine`);
  } finally {
    await s.close();
  }
});

test('sample: the sample is real code that the real engine flags, with one safe fix', { skip: !resolveBinary() && 'engine binary not found' }, async () => {
  const s = await startApp({ engineBin: resolveBinary() });
  try {
    const eng = new LocalEngine({ baseUrl: s.base, token: s.token });
    const scan = await eng.scan({ snippet: SAMPLE, ext: SAMPLE_EXT });
    const rules = new Set(scan.findings.map((f) => f.rule));
    assert.ok(scan.summary.total >= 3, `the sample shows several findings, got ${scan.summary.total}`);
    assert.ok(rules.has('gradient-text'), 'includes the fixable one');
    const preview = await eng.previewFixes({ snippet: SAMPLE, ext: SAMPLE_EXT });
    assert.ok(preview.fixCount >= 1, 'the sample offers at least one safe fix');
  } finally {
    await s.close();
  }
});

test('first-run state: remembers, and never throws when storage is blocked', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    // 1) Storage that throws on every call, like a blocked or private window.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    const a = await import('../web/onboarding.js?blocked');
    assert.equal(a.hasSeenTour(), false);
    assert.doesNotThrow(() => a.setFlag('tour'));
    assert.equal(a.hasSeenTour(), true, 'still remembered for this visit');
    a.resetFlags();
    assert.equal(a.hasSeenTour(), false);

    // 2) Working storage: values survive a fresh module instance.
    const store = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    });
    const b = await import('../web/onboarding.js?working-1');
    b.setFlag('tour');
    b.setFlag('coach-results');
    const c = await import('../web/onboarding.js?working-2');
    assert.equal(c.hasSeenTour(), true);
    assert.equal(c.hasSeenCoach('results'), true);
    assert.equal(c.hasSeenCoach('fixes'), false);

    // 3) Corrupt stored value is ignored rather than crashing the Studio.
    store.set('studio-onboarding-v1', '{not json');
    const d = await import('../web/onboarding.js?corrupt');
    assert.equal(d.hasSeenTour(), false);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
    else delete globalThis.localStorage;
  }
});

test('the new web files are served with the right type, under the strict CSP', async () => {
  const s = await startApp();
  try {
    const want = {
      '/tour.css': 'text/css',
      '/art.js': 'text/javascript',
      '/coach.js': 'text/javascript',
      '/onboarding.js': 'text/javascript',
      '/tour-content.js': 'text/javascript',
      '/guide-content.js': 'text/javascript',
      '/sample.js': 'text/javascript',
      '/views/tour.js': 'text/javascript',
      '/views/guide.js': 'text/javascript',
    };
    for (const [p, type] of Object.entries(want)) {
      const r = await s.get(p);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers['content-type'].split(';')[0], type, p);
      assert.match(r.headers['content-security-policy'], /script-src 'self'/);
    }
    // The page links the stylesheet, and the CSP still forbids inline styles and scripts.
    const html = (await s.get('/')).text;
    assert.match(html, /\/tour\.css/);
    assert.ok(!/<style[\s>]/i.test(html) && !/\sstyle=/.test(html), 'no inline styles in the page');
  } finally {
    await s.close();
  }
});

test('the new web code stays inside the Studio’s own rules: no innerHTML, no inline style attributes', () => {
  const files = ['art.js', 'coach.js', 'onboarding.js', 'views/tour.js', 'views/guide.js', 'views/scan.js', 'views/results.js', 'views/fixes.js'];
  for (const f of files) {
    const src = read(f);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), `${f} builds the DOM without HTML strings`);
    assert.ok(!/setAttribute\(\s*['"]style['"]/.test(src), `${f} does not set a style attribute (blocked by the CSP)`);
    assert.ok(!/\bstyle:\s*['"`]/.test(src), `${f} does not pass a style string`);
  }
});
