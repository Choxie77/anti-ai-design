# End-to-end run on a sample app (task-49)

Date: 2026-11-06, macOS. Binary: `anti-design-skill/target/release/anti-ai-design` (0.1.18+engine), built from the
`integration` branch after the rename, studio and workflow merges. Every number below comes from that run.

## What was scanned

`anti-design-skill/tests/fixtures/sample-app/` (added with this task). The earlier sample-app task (task-36) was
dropped with the from-scratch CLI, so no such fixture existed. This one is four small files built to trip the
detector on purpose:

| File | Plants |
|---|---|
| `index.html` | emoji used as icons, `outline: none` on buttons, an icon-only button with no name, four odd corner radii, three blurred surfaces, three unrelated accent hues, and a link to `src/hero.css` |
| `src/hero.css` | gradient text (`background-clip: text` over a gradient) |
| `src/Hero.jsx` | gradient text as Tailwind classes (`bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500 text-transparent`) |
| `package.json` | marks it as a project root |

The run used a throwaway copy (the fix step writes files), so the committed fixture is unchanged.

## Steps and results

| # | Command (run inside the copy) | Result |
|---|---|---|
| 1 | `anti-ai-design detect .` | exit 2. **8 anti-patterns** plus **3 advisory notes**. `--json` lists 11 entries. |
| 2 | `anti-ai-design detect --fix .` | exit 0. Dry run: prints a unified diff for 2 files, says "2 safe fixes in 2 files (dry run, nothing was changed)". A hash of the whole tree before and after is identical, and no `.anti-ai-design/` folder appeared. |
| 3 | `anti-ai-design detect --write .` | exit 0. "Applied 2 safe fixes in 2 files." One line per fix appended to `.anti-ai-design/changelog.md`. |
| 4 | `anti-ai-design detect .` | exit 2. **4 anti-patterns** plus the same 3 advisory notes. `--json` lists 7 entries. |
| 5 | `anti-ai-design detect --write .` again | exit 0. "No safe fixes to apply.", empty diff, tree hash identical to step 4. Idempotent. |

### Before and after, by rule

| Rule | Before | After |
|---|---|---|
| `gradient-text` | 4 (`hero.css`, `Hero.jsx`, and two in `index.html`, which reads the linked stylesheet) | **0** |
| `ai-color-palette` | 1 (`from-indigo-500` gradient) | 1 (`text-indigo-500 on heading`) |
| `aad-emoji-icons` | 1 | 1 |
| `aad-focus-removed` | 1 | 1 |
| `aad-icon-button-name` | 1 | 1 |
| `aad-multiple-accents` (advisory) | 1 | 1 |
| `aad-mixed-radii` (advisory) | 1 | 1 |
| `aad-glass-overuse` (advisory) | 1 | 1 |
| **Total entries** | 11 | 7 |

### The two fixes (from the dry run)

```diff
--- a/src/Hero.jsx
-      <h1 className="text-5xl font-bold bg-clip-text bg-gradient-to-r from-indigo-500 to-pink-500 text-transparent">
+      <h1 className="text-5xl font-bold text-indigo-500">
--- a/src/hero.css
 .hero h1 {
   font-size: 3rem;
-  background: linear-gradient(90deg, #6366f1, #ec4899);
-  -webkit-background-clip: text;
-  background-clip: text;
-  -webkit-text-fill-color: transparent;
+  color: #6366f1;
 }
```

Changelog written by step 3:

```
- 2026-11-06T08:03:01Z | gradient-text | src/Hero.jsx:4 | gradient text -> text-indigo-500
- 2026-11-06T08:03:01Z | gradient-text | src/hero.css:3 | gradient text -> color #6366f1
```

## What this shows, and what it does not

- The loop works end to end with the shipped binary: scan, dry-run diff that touches nothing, applied fix with a
  log line, rescan, and a second apply that does nothing.
- **The safe fix removes the gradient but can keep the colour problem.** It picks the gradient's first stop, which
  here is indigo, and the rule that flags purple/violet palettes (`ai-color-palette`) still fires on the solid
  `text-indigo-500`. The fixer is correct about its own rule (`gradient-text` goes to 0) and does not claim more;
  a human still has to choose a colour.
- Only `gradient-text` has a safe fix. The other four counted findings and the three advisories need a decision
  (which icon set, what focus style, the accessible name) and are left alone on purpose.
- Rules that need a parsed page ran only for `index.html`; the `.css` and `.jsx` files were scanned with regex
  matching, which the tool itself says is an undercount. A rendered scan (`detect http://localhost:PORT`) was not
  part of this run.
- One real project of the owner's choosing was not scanned; none was named. Re-run steps 1 to 5 on any project
  copy to extend this record.

## Reproduce

```bash
cp -R anti-design-skill/tests/fixtures/sample-app /tmp/sample && cd /tmp/sample
BIN=/path/to/anti-design-skill/target/release/anti-ai-design
$BIN detect .            # before
$BIN detect --fix .      # dry run, nothing written
$BIN detect --write .    # apply, logs to .anti-ai-design/changelog.md
$BIN detect .            # after
$BIN detect --write .    # second apply: nothing to do
```
