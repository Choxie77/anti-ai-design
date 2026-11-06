import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../lib/diff.mjs';

const REAL = `--- a/gradient-text.css
+++ b/gradient-text.css
@@ -1,7 +1,4 @@
 .hero h1 {
   font-size: 3rem;
-  background: linear-gradient(90deg, #6366f1, #ec4899);
-  -webkit-background-clip: text;
-  background-clip: text;
-  -webkit-text-fill-color: transparent;
+  color: #6366f1;
 }
`;

test('parses the engine diff for the gradient fixture', () => {
  const [f] = parseUnifiedDiff(REAL);
  assert.equal(f.file, 'gradient-text.css');
  assert.equal(f.deletions, 4);
  assert.equal(f.additions, 1);
  assert.deepEqual(f.changedLines, [3, 4, 5, 6]);
  assert.equal(f.hunks[0].oldStart, 1);
  assert.equal(f.hunks[0].oldLines, 7);
  assert.deepEqual(f.hunks[0].lines.map((l) => l.t), ['ctx', 'ctx', 'del', 'del', 'del', 'del', 'add', 'ctx']);
  assert.equal(f.hunks[0].lines.at(-1).new, 4);
});

test('handles several files, single-line hunks and an empty diff', () => {
  const two = `--- a/x/a.css\n+++ b/x/a.css\n@@ -3 +3 @@\n-old\n+new\n--- a/b.css\n+++ b/b.css\n@@ -1,2 +1,2 @@\n keep\n-x\n+y\n`;
  const files = parseUnifiedDiff(two);
  assert.deepEqual(files.map((f) => f.file), ['x/a.css', 'b.css']);
  assert.deepEqual(files[0].changedLines, [3]);
  assert.deepEqual(parseUnifiedDiff(''), []);
});
