#!/usr/bin/env node
// A stand-in for the detector, so the tests do not need the Rust build.
// It understands just enough of the real command line:
//   --version | detect --list-rules --json | detect --json T | detect --fix T | detect --write T
// FAKE_ENGINE_MODE: crash | badjson | outside (adds a finding in FAKE_OUTSIDE_FILE) | escape-diff
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const mode = process.env.FAKE_ENGINE_MODE || '';
const MARK = 'background-clip: text';

if (args[0] === '--version') {
  console.log('fake-engine 9.9.9');
  process.exit(0);
}
if (mode === 'crash') {
  console.error('boom: the fake engine crashed');
  process.exit(1);
}
if (args[0] !== 'detect') {
  console.error('usage');
  process.exit(1);
}
if (args.includes('--list-rules')) {
  console.log(
    JSON.stringify([
      { id: 'gradient-text', name: 'Gradient text', category: 'slop', severity: 'warning', scopes: [], description: 'Gradient text is decorative.' },
      { id: 'aad-focus-removed', name: 'Focus outline removed', category: 'quality', severity: 'warning', scopes: ['a11y'], description: 'Do not remove focus rings.' },
      { id: 'overused-font', name: 'Overused font', category: 'slop', severity: 'advisory', scopes: ['type'], description: 'Too common.' },
    ]),
  );
  process.exit(0);
}
if (mode === 'badjson') {
  console.log('this is not json');
  process.exit(0);
}

const target = path.resolve(args[args.length - 1]);
const wantFix = args.includes('--fix') || args.includes('--write');
const write = args.includes('--write');

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isFile()) {
    out.push(p);
    return out;
  }
  for (const name of fs.readdirSync(p).sort()) {
    if (name === '.anti-design') continue;
    walk(path.join(p, name), out);
  }
  return out;
}

function hits(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const lines = text.split('\n');
  const found = [];
  lines.forEach((l, i) => {
    if (l.trim().startsWith(MARK)) found.push(i + 1);
  });
  return found;
}

const files = walk(target, []);
if (mode === 'outside' && process.env.FAKE_OUTSIDE_FILE) files.push(process.env.FAKE_OUTSIDE_FILE);

if (!wantFix) {
  const findings = [];
  for (const f of files) {
    for (const line of hits(f)) {
      findings.push({
        antipattern: 'gradient-text',
        name: 'Gradient text',
        description: 'Gradient text is decorative.',
        severity: 'warning',
        category: 'slop',
        file: f,
        line,
        snippet: 'background-clip: text + gradient',
      });
    }
  }
  console.log(JSON.stringify(findings));
  process.exit(findings.length ? 2 : 0);
}

let diff = '';
let count = 0;
const touched = [];
for (const f of files) {
  const hs = hits(f);
  if (!hs.length) continue;
  const rel = path.relative(process.cwd(), f).split(path.sep).join('/');
  const label = mode === 'escape-diff' ? '../escaped.css' : rel;
  const text = fs.readFileSync(f, 'utf8').split('\n');
  diff += `--- a/${label}\n+++ b/${label}\n`;
  for (const n of hs) {
    diff += `@@ -${n},1 +${n},1 @@\n-${text[n - 1]}\n+  color: inherit;\n`;
    count += 1;
  }
  if (write) {
    for (const n of hs) text[n - 1] = '  color: inherit;';
    fs.writeFileSync(f, text.join('\n'));
    touched.push({ rel, n: hs[0] });
  }
}
process.stdout.write(diff);
if (write && count) {
  const dir = path.join(process.cwd(), '.anti-design');
  fs.mkdirSync(dir, { recursive: true });
  const log = path.join(dir, 'changelog.md');
  if (!fs.existsSync(log)) fs.writeFileSync(log, '# changelog\n\n');
  for (const t of touched) fs.appendFileSync(log, `- 2026-01-01T00:00:00Z | gradient-text | ${t.rel}:${t.n} | gradient text -> color inherit\n`);
  console.error(`Applied ${count} safe fix in ${touched.length} file. Logged.`);
} else {
  console.error(`${count} safe fix in ${files.length ? 1 : 0} file (dry run, nothing was changed).`);
}
process.exit(0);
