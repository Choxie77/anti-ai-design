# Status: safefix (tasks 47 and 48)

Branch `agent/safefix`, base `main` (d9ba398). Date 2026-11-05. **Done.**

## Verification left open by the previous session (rule pack installed, binary from this tree)

| Command | Result |
|---|---|
| `cargo test --workspace --no-fail-fast` (baseline, before my code) | 2499 passed, 1 failed, 9 ignored, 155 suites. The failure was `asset_capture::native_capture_distinguishes_paint_from_file_presence`: `Browser.getVersion timed out` after 205 s (headless Chrome, machine busy with the node suites). The doctest error in that log came from my own edit landing mid-run, not from the baseline. |
| `cargo test --workspace --no-fail-fast` (final, with my code) | **2517 passed, 0 failed, 9 ignored, 157 suites**, exit 0. The browser test passed this time, so it is a load-sensitive flake, not a regression. |
| `node scripts/run-tests.mjs live` (release binary) | 265 tests, 263 pass, 0 fail, 2 skipped |
| `node scripts/run-tests.mjs framework` (release binary) | 196 tests, 196 pass, 0 fail |
| `node scripts/run-tests.mjs oracle` (debug binary with my change) | 7 tests, 7 pass, 0 fail ("zero unreviewed differences", 143 s) |
| `node --test tests/aad-safe-fix.test.mjs tests/aad-rules.test.mjs` | 8 pass, 0 fail |
| `cargo test --workspace safe_fix` | 17 pass (8 unit in aad-rules, 9 binary tests in cli), 0 fail |
| `test -s docs/ours/contract-diff.md` | passes |

**`hook` does not pass the pack:** `crates/hook/src/hook_lib.rs:1648` and `:1713` build scan options with `rule_pack: None`, so the design hook ignores the `aad-*` rules. Not fixed: `crates/hook` is not in my ownership. The fix is probably `rule_pack: anti_design_core::rule_pack::default_pack()` at both sites (as `crates/detect/src/cli.rs:642` does), plus a hook test.

## Task-47: contract diff

`docs/ours/contract-diff.md`, every row checked by running the binary. Headline findings: `detect` is the only scanner verb; `audit/critique/polish/typeset/distill/generate/document/init` are agent skill commands, not binary verbs (`audit` and `init` exit 1); `live` exists but means something else; unknown flags (`--write`, `--fail-on`, `--cwd`, `--no-color`, `-q`) are silently ignored by `detect`; usage errors exit 1, not 2; `--json` is a bare findings array; the fork had no changelog or footprint module. `docs/spec/cli-schema.json` now says in `$comment` that it is a wish list and points at the contract and the diff. It ends with the safe-fix design.

## Task-48: safe-fix tier

`anti-design detect --fix <target>` = dry run (unified diff on stdout, summary on stderr, nothing written, no log, no folder). `--write` (implies `--fix`) applies and appends one line per fix to `.anti-design/changelog.md`. Plain `detect` is untouched, so the oracle is byte-identical. Fix mode runs the normal detector first, so config ignores and `anti-design-disable` comments are respected; fixes apply only where a `gradient-text` finding is. Docs: `docs/ours/safe-fix.md`.

Fixes: `gradient-text` as CSS (rule block or `style=""`, `background-clip: text` + one gradient -> `color: <first stop>`, or the rule's existing color) and as Tailwind classes (`bg-clip-text bg-gradient-to-* from-X ... text-transparent` -> `text-X`). It declines when unsure (layered backgrounds, transparent/unreadable first stop, variants, commented-out code). No third fix: nothing else was trivial and safe.

Idempotence: an applied fix removes its finding, so a second run finds nothing, prints no diff and logs nothing (tested: log file byte-identical after run two).

### Files touched (all in my ownership)
- new `anti-design-skill/crates/aad-rules/src/safe_fix.rs` (pure fixes + diff + unit tests); `crates/aad-rules/src/lib.rs` (+1 line `pub mod safe_fix;`)
- new `anti-design-skill/crates/cli/src/safe_fix.rs` (orchestration, log); `crates/cli/src/lib.rs`, `crates/cli/src/main.rs` (upstream, small edits, each with a "Modified by Anti-Design contributors, 2026-11-05" notice)
- new tests: `crates/cli/tests/safe_fix.rs`, `tests/aad-safe-fix.test.mjs`, `tests/fixtures/aad/gradient-text.css`
- docs: `docs/ours/contract-diff.md`, `docs/ours/safe-fix.md`, `docs/spec/cli-schema.json`, this file
- No new crate dependency, `Cargo.lock` untouched, no goldens regenerated, `Finding` unchanged.

### Names for the rename pass
- `crates/cli/src/safe_fix.rs`: `CONTEXT_DIR` (= `anti_design_live::paths::ANTI_DESIGN_DIR`, `.anti-design`) and `CHANGELOG_FILE`.
- Tests hard-code `.anti-design/changelog.md` (`crates/cli/tests/safe_fix.rs`, `tests/aad-safe-fix.test.mjs`) and an `anti-design-disable` comment in one test.
- `crates/cli/src/main.rs` calls `anti_design::safe_fix`.

## NOT verified / known limits
- `--fix`/`--write` are not in `detect --help` (usage text is pinned by oracle goldens; adding it needs a golden update by the integrator).
- Only run on macOS here; no Windows path handling test (labels normalise `\` to `/`).
- Dir scans with many files, symlinked cwd, and non-UTF-8 files are only lightly covered (non-UTF-8 file: reported as unreadable, exit 1).
- Cosmetic: a `style=""` fix can leave one trailing space inside the attribute (`style="color: red; "`).
- The changelog is written to the cwd's `.anti-design/`, not the nearest project root.
- No `--json` for fix mode, no URL/`--cdp` support, no undo (all by design).
- Node suites live/framework ran against the older release binary (it has the rule pack but not safe-fix); oracle and aad tests ran against the debug binary that includes it.

## Requests for other agents
- hook owner: pass `default_pack()` in `crates/hook/src/hook_lib.rs` (lines 1648, 1713), add a hook test with an `aad-*` finding.
- integrator: if wanted, add `--fix`/`--write` to `detect --help` and regenerate the affected oracle golden; add `tests/aad-safe-fix.test.mjs` to a suite list in `scripts/run-tests.mjs` (owned by "release").
