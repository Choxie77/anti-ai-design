# The safe-fix tier

Task-48. Design rationale is the last section of [contract-diff.md](contract-diff.md);
this page is how to use what was built and where it lives.

## Use

```bash
# Dry run (the default): prints a unified diff on stdout, a summary on stderr, changes nothing.
anti-design detect --fix src/

# Apply. --write implies --fix.
anti-design detect --write src/
```

* Targets are files or folders. URLs, `--cdp`, `--github`, `--list-rules` and `--json`
  are refused in fix mode (they have no file to rewrite, or a different output).
* Plain `anti-design detect ...` is unchanged byte for byte and never writes.
* Exit code: `0` when the run completed (preview or write), `1` when a file could not be
  scanned, read or written or the arguments are not valid in fix mode.
* The fixes follow findings. Fix mode runs the normal detector first, so `.anti-design`
  config ignores, `anti-design-disable` comments and DESIGN.md decide what is eligible. A
  waived finding is never rewritten.

## What gets fixed

Only `gradient-text`, in two shapes. Everything else stays advice.

| Shape | Before | After |
|---|---|---|
| CSS rule or `style="..."` | `background: linear-gradient(90deg, #6366f1, #ec4899); background-clip: text; -webkit-text-fill-color: transparent;` | `color: #6366f1;` |
| Tailwind classes | `bg-clip-text bg-gradient-to-r from-sky-500 to-pink-500 text-transparent` | `text-sky-500` |

The solid colour is the gradient's **first colour stop**, or the colour the rule already sets
when it has one. The fix **declines** (the finding stays, reported as needing a manual
change) when it is not sure: a layered or multi-value background, a first stop that is
`transparent` or unreadable, another background fill in the same rule, a non-transparent
`-webkit-text-fill-color`, a Tailwind class with a variant prefix (`dark:from-...`), or
several `from-` classes. Commented-out code is never touched.

## Run log

`--write` appends one line per applied fix to `.anti-design/changelog.md` in the folder
you ran the command from. The file is created with a short header; after that it is
append-only (never rewritten or trimmed).

```
- 2026-11-05T12:34:56Z | gradient-text | src/hero.css:3 | gradient text -> color #6366f1
```

A second run finds no finding left to fix, so it writes nothing and logs nothing. Dry runs
never create the folder.

## Where it lives

| Piece | File |
|---|---|
| Pure fixes and the unified diff (no I/O) | `anti-design-skill/crates/aad-rules/src/safe_fix.rs` |
| Orchestration: run detect, apply, write, log | `anti-design-skill/crates/cli/src/safe_fix.rs` |
| Routing (`detect` + `--fix`/`--write`) | `anti-design-skill/crates/cli/src/main.rs` (marked as modified) |
| Rust tests (`cargo test --workspace safe_fix`) | `crates/aad-rules/src/safe_fix.rs` (unit), `crates/cli/tests/safe_fix.rs` (binary) |
| Node tests | `anti-design-skill/tests/aad-safe-fix.test.mjs` |

## For the rename pass

* `anti-design-skill/crates/cli/src/safe_fix.rs`: `CONTEXT_DIR` (alias of
  `anti_design_live::paths::ANTI_DESIGN_DIR`, currently `.anti-design`) and `CHANGELOG_FILE`.
* The tests hard-code `.anti-design/changelog.md` in `crates/cli/tests/safe_fix.rs` and
  `tests/aad-safe-fix.test.mjs`, plus the `anti-design-disable` waiver comment in one test.
* The `--fix`/`--write` help text is not in `detect --help` yet (the usage text lives in
  `crates/detect/src/cli.rs` and the oracle pins it); adding it needs a golden update.
