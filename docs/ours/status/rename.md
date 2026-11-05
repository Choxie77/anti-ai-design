# Status: rename (task-51)

Branch `agent/rename` (base `main` bbc3a568, worktree `../aad-worktrees/rename`). **NOT fully done**: the full Rust workspace test run (`cargo test --workspace --no-fail-fast`) had not finished when the session hit its usage limit, so the Rust result is unverified. Everything else below was run.

## What changed
- `tools/rebrand/rebrand2.sh` (+ `rebrand2.pl`, `rebrand2_paths.pl`): idempotent (tree hash identical on a second run). anti-design -> anti-ai-design in contents and paths under `anti-design-skill/` and `docs/` (not `docs/ours/status`, `agent-prompts`, `BASELINE.md` tables, `tools/rebrand/`, LICENSE/NOTICE/UPSTREAM). `OWNER/anti-design` -> `Choxie77/anti-ai-design`; placeholder domains -> `https://github.com/Choxie77/anti-ai-design` (scheme kept, bare mentions too). Subfolder `anti-design-skill/` keeps its name. Trap: `git grep` skips `-diff` files (oracle goldens, vectors); the script uses `git ls-files | grep -I --null` (BSD grep: `-Z` means decompress).
- 1752 files rewritten, 1345 paths `git mv`ed. Cargo.lock rewritten by cargo; bundle-signature vector regenerated; in-page bundle regenerated with `cargo xtask bundle` (installed wasm-pack 0.15.1); component-review bundle regenerated.
- Hand fixes: `crates/bundle/src/lib.rs` wasm-pack `--out-name` is now `anti_ai_design` (the first pass left a hyphenated name the bundler could not find); `crates/context/src/url.rs` hostname assertion `github.com`; `scripts/lib/transformers/factory.js` display name "Anti-AI Design" (title-casing gave "Anti Ai Design"); LEGACY_NPM_SCOPE and the scope warning removed; stale "rename pending" notes removed from READMEs/docs; UPSTREAM.md keeps the historical "Anti-Design" wording and gains a "Second rename" entry; README names the Apply subprocess flags (`live-reference` test was already red on main without them); `tests/aad-safe-fix.test.mjs` registered in the oracle suite (`test-suites` tests were red on main).
- Extras: hook passes `default_pack()` at both sites (`hook_lib.rs`) + `crates/hook/tests/aad_pack_tests.rs` (dev-dependency on aad-rules); `detect --help` lists `--fix`/`--write`.
- Engine rebuilt after the rename; binary embeds key `aad-release-2026-11`, contains no `anti-design` / `ANTI_DESIGN` strings. Stale old-named binaries in the cloned target cache were deleted; do not reuse a binary built before this branch (old keyring).

## Results (real)
| Suite | Result |
|---|---|
| Bun core | 486 pass, 0 fail |
| Node core | 254 pass, 0 fail, 2 skipped |
| Oracle replay | 1320 pass, 0 fail, 23 accepted deltas, 0 missing goldens (27 goldens re-recorded, logged in `tests/oracle/DELTAS.md`: 25 rename/extras reasons, 2 not rename: `detect-unknown-flag`, `detect-config-cross-project`, which also fail on main because DESIGN.md gained a type ramp) |
| Detector | 82 pass |
| Live | 263 pass, 0 fail, 2 skipped (re-run after the README fix) |
| Framework | 196 pass |
| Plugin E2E | 4 pass |
| `cargo test --workspace` | NOT FINISHED, no result |
| `cargo xtask bundle --check`, `bun run build:release` drift | build:release ran clean after the display-name fix, no tracked drift |

`grep -rIl 'OWNER/anti-design' anti-design-skill ... | wc -l` = 0. `target/release/anti-ai-design --version` prints `0.1.18+engine`.

## Intentional remaining `anti-design` mentions
`anti-design-skill/` folder name (everywhere); `tools/rebrand/*` (first pass); `docs/ours/status/*`, `docs/ours/agent-prompts/*`, `docs/ours/BASELINE.md` historical tables; UPSTREAM.md historical wording; root `prd.json`, `progress.txt`, `.github/workflows/*` (outside my ownership).

## Requests for others (important)
1. Root `.github/workflows/` still use old names and will fail: `test.yml:84,87` (`-p anti-design`, `ANTI_DESIGN_BIN`, `target/release/anti-design`), `test.yml:25` (`ANTI_DESIGN_TELEMETRY_CHANNEL`), `release.yml:8,84,87` (`ANTI_DESIGN_SIGNING_KEY` secret; sign-bundle.mjs now reads `ANTI_AI_DESIGN_SIGNING_KEY[_FILE]`, so the GitHub secret must be created under the new name), `release-engine.yml:4,58,62,66`. Suggested: `perl -pi -e 's/anti-design(?!-skill)/anti-ai-design/g; s/ANTI_DESIGN/ANTI_AI_DESIGN/g' .github/workflows/*.yml`.
2. Finish `cargo test --workspace --no-fail-fast` (Chrome-driven tests flake under load; rerun alone).
3. `bun.lock` lists `@anti-ai-design/cli-*` with integrity hashes copied from upstream's packages; re-resolve after the first npm publish.
4. Telemetry default endpoint is now `https://github.com/Choxie77/anti-ai-design/api` (and `/privacy`), per the placeholder rule; telemetry is on by default, so requests go to github.com (404). Decide whether to default it off or use an unresolvable host. `scripts/release.mjs` also fetches `.../api/version`.
5. `skill/scripts/engine-checksums.txt` still has pre-fork digests (names renamed only); first release needs a new ENGINE_VERSION.
6. Process note: I once ran `git add -A -- .` scoped to `anti-design-skill/` (ignored dirs excluded); nothing outside ownership was staged.
7. `main` moved (f8295596) after this branch was cut; merge may need a re-run of `rebrand2.sh` for new files.
