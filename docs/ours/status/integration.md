# Status: integration (task-55)

Branch `integration`, cut from `main` (f8295596) on 2026-11-06. **Done and verified; nothing pushed, `main` not moved, no tag.**
Waiting for the owner's OK (see "Human steps").

## What was merged, in order

| Order | Branch | State before this task | Action |
|---|---|---|---|
| 1 | `agent/branding` | already in `main` (merge 450ac129) | none; read `status/branding.md` |
| 2 | `agent/release` | already in `main` (merge e6bdc88e) | none; read `status/release.md`. The local branch `release-gh` is the same release work replayed on the GitHub history; the release files are byte-identical to `main`, so it was **not** merged a second time |
| 3 | `agent/safefix` | already in `main` (merge b04e76bc) | none; read `status/safefix.md` |
| 4 | `agent/rename` | 6 commits ahead, 1 doc commit behind | merged, no conflicts (merge 0a453dc3) |
| 5 | `agent/studio` | 3 commits ahead | merged, no conflicts (merge 1550faf7) |

No conflict needed resolving, so neither side lost anything.

## Fixes made on top of the merges

- `studio/` still used the old names: engine lookup, env var, `.anti-design/changelog.md`, and a doubled "legacy name" list.
  Rebranded with `tools/rebrand/rebrand2.pl`, then the duplicated legacy entries (`ENGINE_NAMES`, `ENGINE_ENV_VARS`) were
  collapsed to the single new name and the README sentence fixed by hand.
- One studio test built its path from `new URL(import.meta.url).pathname`, which keeps `%20` for the space in
  `Anti ai design`; it now uses `fileURLToPath`. (Found by running the tests; they then pass: 30 pass, 2 skipped, 0 fail,
  matching the studio agent's own number without the binary.)
- The three root workflows (`.github/workflows/{test,release-engine,release}.yml`) still said `-p anti-design`,
  `ANTI_DESIGN_BIN`, `anti-design-<os>` asset names and the `ANTI_DESIGN_SIGNING_KEY` secret. They now match the code:
  `-p anti-ai-design`, `ANTI_AI_DESIGN_BIN`, `anti-ai-design-<os>`, secret **`ANTI_AI_DESIGN_SIGNING_KEY`** (what
  `scripts/sign-bundle.mjs` reads). The rename script never touched the repo root, which is why this was left.
- `tools/dashboard/index.html` command names.
- `prd.json`: task-43 and task-46 verification commands used the old binary, crate and env names (updated); the task-42
  command used `wc -l | grep -qx 0`, which can never pass on macOS because `wc` pads with spaces (now `tr -d ' '`);
  tasks 51, 53 and 55 added (they only existed in the agent prompts). There is no task-50, 52 or 54 anywhere in the repo,
  so none were created.

## Regeneration (once, at the end)

Engine rebuilt from the merged tree (`cargo build --release`, `anti-ai-design --version` = `0.1.18+engine`).
`cargo xtask bundle`, `bun run build:release` and `tools/rebrand/regen-vector.mjs`: **no tracked file changed**, so
`Cargo.lock`, the signature vector, the in-page bundle and the oracle goldens from the rename branch are already current.
The git-ignored `dist/` and `build/` held output from before the rename (names like `dist/openai/anti-design`); they were
deleted and rebuilt, then `cargo xtask bundle` regenerated the detector files in `dist/`. A grep that respects `.gitignore`
(this shell's `grep` function) and plain `/usr/bin/grep` disagreed about `OWNER/anti-design` until that was done.

## Verification (real runs, release engine from this tree)

| Check | Result |
|---|---|
| `cargo test --workspace --no-fail-fast` | **2518 pass, 0 fail, 9 ignored**, 158 targets, exit 0 |
| `cargo test --workspace safe_fix` | 17 pass, 0 fail |
| `bun run test` (all default suites), run twice (before and after the clean `dist/` rebuild) | exit 0 both times: Bun 486/0; Node core 254 pass, 0 fail, 2 skipped; oracle + aad tests 9/0; detector 82/0; live 263 pass, 0 fail, 2 skipped; framework 196/0; plugin-e2e 4/0 |
| Oracle replay (`tests/oracle/run.mjs`) | **1320 pass, 0 fail, 23 accepted deltas, 0 missing goldens** |
| Studio (`node --test studio/tests/*.test.mjs`) | 30 pass, 0 fail, 2 skipped (the real-binary integration test was not run here) |
| Every non-superseded `prd.json` verification command | all pass (tasks 01-06, 42-49, 51, 53, 55) |
| `/usr/bin/grep -rIl 'OWNER/anti-design' anti-design-skill` | 0 files |

The Chrome-driven Rust tests that flaked under load in earlier runs passed in this run; the suites were run one after
another, not in parallel.

## Release scripts in dry-run mode

Run in a scratch clone whose `origin` is a local bare repository (so nothing could reach GitHub).

| Command | Result |
|---|---|
| `bun run release:engine -- --dry-run` | passes; prints `git tag -a engine-v0.1.18` and the push it would do, and the workflow URL |
| `bun run release:skill -- --dry-run` | refuses: "origin has no engine-v0.1.18 tag. Release the engine first." (correct) |
| `bun run release:cli -- --dry-run` | refuses for the same reason (correct) |
| `bun run release:ext -- --dry-run` | refuses: no `site/pages/changelog.astro` (known, see release status) |
| `bun run release:platform-packages -- --dry-run --target linux-x64` | 404 on `.../releases/download/engine-v0.1.18/anti-ai-design-linux-x64` (nothing released yet; expected) |
| `bun run check:engine-release -- --no-npm` | fails with the "publish the engine first" message (expected) |

## Task-49

`docs/ours/e2e.md`, on the new fixture `anti-design-skill/tests/fixtures/sample-app/`: 8 findings and 3 advisories before,
a dry run that changes nothing, `--write` applying 2 gradient-text fixes with a log, 4 findings after, a second `--write`
doing nothing. The doc also records that the fixer's solid colour (indigo) is itself flagged by `ai-color-palette`.

## Not verified / known gaps

- No workflow has run on GitHub. Per-platform engine builds, the Windows build and the CI drift check are untested.
- The real-binary studio integration test was not run (the studio unit tests were).
- The first engine release needs a new `ENGINE_VERSION` and matching checksums (`release.md`, human step 5).
- Telemetry still defaults to on and points at `https://github.com/Choxie77/anti-ai-design/api`, which is not an API.
  The owner decides whether it should default to off or go away.
- `bun.lock` carries stale integrity entries for `@anti-ai-design/cli-*`; re-resolve after the first npm publish.
- `scripts/test-suites.mjs:41` still triggers `core` on the upstream `anti-design-skill/.github` workflow path.
- Studio engine false positives from `status/studio.md` (`aad-focus-removed` on displayed code) are open.

## Human steps, in order

1. Read the diff stat and the `publish` branch graph, then say OK (or what to change). Until then `main`, tags and the
   remote are untouched.
2. Decide whether to purge `.pnpm/` and `.claude/settings.local.json` from the **public** history (needs a force-push and
   fresh clones everywhere). Current public history is not touched by the plain fast-forward below.
3. After the OK: fast-forward `main` to the reconciled branch and push it as a plain fast-forward (no force):
   `git push origin publish:main`. Check first that `git log --all -- .env` is empty **for the pushed refs** (the local
   repository's old history still lists `.env`; the reconciled branch does not contain it).
4. Back up `~/aad-secrets/bundle-signing-private.pem` in a second place you control.
5. In the GitHub repository: enable Actions; add the secret **`ANTI_AI_DESIGN_SIGNING_KEY`** (value from the PEM file, via
   `gh secret set ANTI_AI_DESIGN_SIGNING_KEY --repo Choxie77/anti-ai-design < ~/aad-secrets/bundle-signing-private.pem`).
6. Claim the npm organisation `@anti-ai-design`.
7. First engine release: pick a new `ENGINE_VERSION` (and update the five `package.json` pins), merge, wait for `test` to be
   green, then `bun run release:engine -- --dry-run` and without `--dry-run`; then `bun run release:checksums`, commit the
   manifest, `bun run release:platform-packages -- --dry-run` and for real.
8. First product release: tag `v<plugin version>` (not decided here; the plugin manifest says 4.8.0, which is the upstream
   number) after the engine and packages exist.
9. Decide the telemetry default and the changelog source for `release:ext`.
