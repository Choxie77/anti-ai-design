# Test baseline of the fork (task-44)

Run 2026-11-05 on macOS (Apple silicon), Rust 1.99.1, Bun 1.4.4 (matches `.bun-version`), Node v24.22.2,
engine built from source (`target/release/anti-design`, 0.1.18+engine) and passed as `ANTI_DESIGN_BIN`.
Nothing was fixed; this lists what the fork does on a clean checkout of our rebrand. Google Chrome is
installed, so browser-driven tests did run.

## Summary

| Suite | Command | Result |
|---|---|---|
| Bun core | `bun run test` (first suite only; it stops after a failure) | 485 pass, **1 fail** |
| Oracle (engine replay) | `node scripts/run-tests.mjs oracle` | 1292 pass, **31 fail**, 20 accepted deltas, 0 missing goldens |
| Detector | `node scripts/run-tests.mjs detector` | 82 pass, 0 fail |
| Live | `node scripts/run-tests.mjs live` | 262 pass, **1 fail**, 2 skipped |
| Framework | `node scripts/run-tests.mjs framework` | 196 pass, 0 fail |
| Plugin E2E | `node scripts/run-tests.mjs plugin-e2e` | 4 pass, 0 fail |
| Rust workspace, as is | `cargo test --workspace` | **does not compile** (see 1) |
| Rust, all crates except `anti-design` | `cargo test --workspace --exclude anti-design --no-fail-fast` | 2384 pass, **7 fail**, 1 ignored (141 targets) |
| Rust, `anti-design` crate | `cargo test -p anti-design --lib --bins` | 11 pass, 0 fail, 8 ignored (its 9 integration test files were not run, see 1) |

Totals: Bun/Node 2321 pass, 33 fail, 2 skipped (core, oracle, detector, live, framework, plugin-e2e);
Rust 2395 pass, 7 fail, plus one target that does not compile. Opt-in suites (live-e2e, skill-behavior and others that need Playwright browsers or provider API keys)
were not run.

## Failures and their likely causes

### 1. CLI integration tests do not compile (rebrand leftover)
`crates/cli/tests/*.rs` read `env!("CARGO_BIN_EXE_anti_design")`. Cargo derives that name from the binary
name `anti-design`, so the variable is `CARGO_BIN_EXE_anti-design` (hyphen). Compilation of the whole
`cargo test --workspace` stops at `live_server_security`. Likely a one-line search-and-replace fix across
`agent_target.rs`, `component_capture.rs`, `live_server_security.rs` and `tests/support/`. Not fixed here.

### 2. Native component review bundle differs from a fresh build
`tests/component-review-bundle.test.js` ("native component review bundle matches the shared UI source")
fails: the committed `crates/context/assets/component-review.js` differs from a freshly built bundle only in
minified variable names. Bun matches the pinned version, so this is probably a stale committed asset or a
bundler non-determinism, to be regenerated per `AGENTS.md`.

### 3. Oracle replay: 31 of 1323 cases differ
All 31 failing cases belong to a few families; the engine binary used was built from this checkout:

- `embed-png`, `embed-png-prompt-file`, `embed-jpeg`
- `seed-*` (direction, mode rules, surface, degraded, presentation build path)
- `question-update-comps-next`
- `live-complete-source-*`, `live-wrap-text-*`, `live-insert-text-picks-later-file`

The goldens were recorded against upstream output, so branding strings (command name, folder name) in
the rebranded outputs are the first suspect. Needs diffing before any conclusion.

### 4. Live: one timing-sensitive test
`tests/live-agent-target.test.mjs:715`, "extends the grace on a late overlay's first no_match word...",
failed once (`false !== true`). It was run while a heavy `cargo test` and Chrome were using the CPU, so it
may be a load flake. Re-run alone before treating it as a real failure.

## Rust (7 failures in 6 targets)

Four are not environment-related and look like leftovers of the rebrand or of upstream state:

- `anti-design-context` `url::tests::basics` (`crates/context/src/url.rs:227`): expects the host
  `anti-design.example` but the code returns `anti-design.style`. The rebrand used two different
  placeholder domains in different places. Decide the real domain in task-42.
- `anti-design-context` `serve_question::tests::dealt_worlds_come_from_a_fresh_direction_roll_a_decision_page_takes`
  (`serve_question.rs:3567`): fails on an `https://anti-design.example/worlds/cards/a.webp` URL, same cause.
- `anti-design-comp-verbs` `build_phase::integrity_tests::artifact_cleanup_failure_blocks_the_gate`
  (`integrity_tests.rs:626`): "stale evidence: regions/retired.png". Cause not yet known; check whether it
  fails on a pristine upstream checkout.
- `anti-design-live` `dev_url::tests::answers_whatever_scheme_the_page_uses` (`dev_url.rs:162`): asserts
  an `https://127.0.0.1:<port>/` request is not answered. May depend on local network state; rerun alone.

Three drive real Chrome and look environmental (Chrome was also running for other work, and several test
targets ran back to back):

- `anti-design-browser` `card_heuristics::page_level_misreads_stay_silent` and
  `heading_rhythm::fixture_flags_crowded_headings_and_passes_the_misread_shapes`: `Target.createTarget
  timed out` (CDP protocol timeout, 190 to 240 s).
- `anti-design-browser` `fullpage_screenshot::a_page_that_relays_itself_for_the_capture_is_stitched`:
  got `beyond-viewport`, expected `stitched`.

Rerun these three alone with Chrome otherwise idle before drawing conclusions.


## After the fixes (second full run, same day, 18:2x to 18:32)

Fixes made between the two runs: `CARGO_BIN_EXE_anti-design` in the CLI tests and the single placeholder
domain `anti-design.example` (both done by another session working in the same checkout, not by this
one); the stale `component-review.js` bundle regenerated with `scripts/build-component-review.mjs`;
31 oracle goldens re-recorded and logged in `tests/oracle/DELTAS.md`.

| Suite | Before | After |
|---|---|---|
| Bun core (bun test) | 485 pass, 1 fail | 486 pass, 0 fail |
| Node core | not run (stopped at the Bun failure) | 254 pass, 0 fail, 2 skipped |
| Oracle | 1292 pass, 31 fail | 1322 pass, 0 fail, 21 accepted deltas |
| Detector | 82 pass | 82 pass |
| Live | 262 pass, 1 fail, 2 skipped | 263 pass, 0 fail, 2 skipped |
| Framework | 196 pass | 196 pass |
| Plugin E2E | 4 pass | 4 pass |
| Rust, whole workspace | does not compile | compiles: 2468 pass, **2 fail**, 9 ignored (153 targets) |

Still red:

1. `comp-verbs` `artifact_cleanup_failure_blocks_the_gate`: **macOS only**. The engine quarantines evidence by
   renaming a read-only directory; macOS refuses that rename even inside the same parent (checked with a
   minimal test), Linux allows it. A real upstream design assumption, not a rebrand leftover. Options: skip
   the test on macOS, or fall back to copy and delete in `quarantine_comparison_artifacts`.
2. `live` `dev_url::tests::answers_whatever_scheme_the_page_uses`: passes alone (94/94), fails in the full
   parallel run. Port/timing flake under load.
3. Node core `tests/release.test.mjs:426`: **resolved, no code change.** That test uses `git ls-files`, and at
   the time of the run the fork directory was untracked in git, so every embedded file looked uncovered.
   Once the fork was committed (`69aea44`, "fork Impeccable 4.8.0 as Anti-Design") all 27 release tests
   pass. The two other release-guard failures seen on the way were only `bun: command not found` in a shell
   without `~/.bun/bin` on `PATH`. Core suite after that: 486 Bun + 254 Node pass, 0 fail, 2 skipped.
4. Oracle: **resolved** once the other session went idle (18:50). Final replay: 1322 pass, 0 fail,
   21 accepted deltas, 0 missing goldens. Five `live-wrap-text-*` and `live-insert-text-picks-later-file`
   goldens were re-recorded a second time; the only change in them is an added `"styleClose":"</style>"`
   field that the engine emits and the old goldens never had. That one is upstream drift (the goldens predate
   the field), not a rename effect. Logged in `tests/oracle/DELTAS.md`.

Updated summary after the oracle fix: Bun/Node 2321 pass before; now core 486 + 253, oracle 1322 (plus 21
accepted deltas), detector 82, live 263, framework 196, plugin-e2e 4. Remaining red: items 1 and 2 above (both Rust).

## After task-46 (the Anti-AI Design rule pack)

Full Rust workspace before the pack: 2470 pass, 0 fail, 9 ignored (153 targets); the two Rust tests that
were red are fixed (`integrity_tests.rs`, `dev_url.rs`).

With the pack, committed as `37c1b2f`:

| Suite | Result |
|---|---|
| Rust workspace (156 targets) | 2499 pass, 1 fail, 9 ignored. The one failure, `entry_capture::raster_page_that_requests_the_comp_is_refused`, was a Chrome `Browser.getVersion timed out` under load; run alone the target passes 10 of 10 |
| Pack crate | 30 pass (25 unit, 5 engine-level) |
| `tests/aad-rules.test.mjs` | 6 pass |
| Oracle | 1322 pass, 0 fail, 21 accepted deltas (runs with `ANTI_DESIGN_BUILTIN_ONLY=1`) |
| Core | 486 Bun + 254 Node pass, 2 skipped |
| Live | 263 pass, 2 skipped |
| Framework, plugin-e2e, detector | 196, 4 and 82 pass |

Chrome-driven Rust tests (`evidence*`, `card_heuristics`, `heading_rhythm`, `entry_capture`, `fullpage_screenshot`)
time out now and then when other heavy work is running; rerun a failing one alone first.

## How to reproduce

```bash
cd anti-design-skill
export ANTI_DESIGN_BIN="$PWD/target/release/anti-design"
. "$HOME/.cargo/env"; export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun run test                                  # stops at the first failing suite
for s in oracle detector live framework plugin-e2e; do node scripts/run-tests.mjs $s; done
cargo test --workspace --exclude anti-design --no-fail-fast
cargo test -p anti-design --lib --bins
```

Note: macOS has no `timeout` command, so do not wrap these in it.
