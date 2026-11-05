# Status: release (task-53)

Branch `agent/release` (base `main`, worktree `../aad-worktrees/release`).
**Done**, with the gaps listed under "Not verified".

## What changed

All paths under `anti-design-skill/` unless marked *(root)*.

| Area | Change |
|---|---|
| Signing key | New Ed25519 keypair. Public key committed in `scripts/bundle-signing-keys.json` as `aad-release-2026-11` (upstream's key removed). Private PKCS#8 PEM at `~/aad-secrets/bundle-signing-private.pem` (dir 0700, file 0600), outside every repo. Never printed or committed. |
| `scripts/sign-bundle.mjs` | Key sources: `ANTI_DESIGN_SIGNING_KEY_FILE` (refuses group/world-readable files), `ANTI_DESIGN_SIGNING_KEY` (the CI secret), then the existing 1Password path. Error messages still never echo key material. |
| `docs/BUNDLE-SIGNING.md` | Rewritten for the new key, GitHub-secret flow, tag-driven signing, key-in-engine rollout warning. Wire format and scope sections kept. |
| `scripts/fetch-engine.mjs` | Single source of truth: `RELEASE_REPO`, `REPO_URL`, `DEFAULT_DOWNLOAD_BASE` (= GitHub Releases of `Choxie77/anti-ai-design`), `NPM_SCOPE` (`@anti-ai-design`), `LEGACY_NPM_SCOPE`, `platformPackageName()`. |
| `scripts/check-engine-release.mjs` | Uses the constants; new `--no-npm` (skip npm probe) and `--from-dir <dir>` (write `engine-checksums.txt` from local assets, no network); `renderManifest()` shared by `--record` and `--from-dir`. |
| `scripts/release.mjs` | `REPO_URL` and scope from the constants, pin filter is scope-agnostic, messages updated, clear failure (instead of an ENOENT stack trace) when no changelog source exists. |
| `scripts/publish-platform-packages.mjs` | Packages named `@anti-ai-design/cli-<target>`; pin check matches by `/cli-<target>` and warns about the scope instead of failing. `--dry-run` never publishes. |
| `cli/platform-packages/*` | Templates renamed to `@anti-ai-design/cli-*`, repo/homepage -> GitHub repo, license `Apache-2.0` (was "SEE LICENSE IN LICENSE"). |
| `package.json` | `repository` (with `directory`), `homepage`, `bugs` -> GitHub; new script `release:checksums` (= `check-engine-release --record --no-npm`). `optionalDependencies` keys deliberately unchanged (see Requests). |
| `scripts/build.js`, `scripts/lib/vscode-extension.js` | OWNER placeholders replaced (comments / generated extension metadata only). |
| `docs/ENGINE.md` | "Releases" section rewritten for the GitHub Releases flow and the new workflows. |
| *(root)* `.github/workflows/test.yml` | core (bun+node), cargo build/test on Linux + Windows, oracle replay. |
| *(root)* `.github/workflows/release-engine.yml` | tag `engine-v*` (or manual, build-only): `build-engine` matrix darwin arm64/x64, linux x64/arm64 (musl, `cross` 0.2.5), windows x64, then `publish-engine` creates release `engine-v<X>` with binaries, `.sha256` sidecars and a generated `engine-checksums.txt`. |
| *(root)* `.github/workflows/release.yml` | tag `v*`: tag == `.claude-plugin/plugin.json` version, engine release + manifest check (`--no-npm`), core suite, `build:release`, drift check, sign with `ANTI_DESIGN_SIGNING_KEY`, verify against the committed public key, publish `universal.zip` + `universal.zip.sig.json` as release `skill-v<version>` (the tag the compiled installer expects). |

Workflows live at the **repo root** `.github/workflows/` because GitHub ignores `anti-design-skill/.github/`. Every action is pinned to a full commit SHA (reused from the existing upstream-derived workflows, which are untouched and inert; `tests/release-engine-workflow.test.js` and `tests/workflow-security.test.js` still target those). Token permissions are `contents: read`, with `contents: write` only on the two publish jobs.

## Commands run (real results)

- Baseline `node scripts/run-tests.mjs core` on `main`: 253 pass, 0 fail, 3 skipped.
- After changes, same command: **253 pass, 0 fail, 3 skipped**. (Two intermediate failures in `tests/release.test.mjs` came from message wording the test pins; I kept the wording.)
- Workflow check: no `actionlint` installed. Parsed all three with `Bun.YAML.parse` plus a script checking every `uses:` is a 40-hex SHA, every `needs:` resolves, every job has `runs-on`, `${{ }}` balanced: `structure ok`.
- Signing end to end with the real key, on a random 100 kB stand-in ZIP: signed via key file and via env var (the CI path); the exact verify step extracted from `release.yml` printed `signature ok, key aad-release-2026-11`; a one-byte-appended ZIP failed with `signature verification failed`; a 0644 copy of the key was refused. The Rust verifier agrees: `cargo test -p anti-design-skills verifies_reviewed_release_with_production_keyring -- --ignored` with that ZIP and `4.8.0` -> `1 passed`.
- Dry runs, in a scratch clone whose `origin` is a local bare repo (this checkout has no remote) and a local mock of GitHub Releases/npm serving the locally built `target/release/anti-design` (reported `anti-design-engine 0.1.18` from `engine-probe`) under all five asset names. **The same binary stands in for every platform; this checks plumbing, not per-platform builds.**
  - `bun run release:engine -- --dry-run`: passes; prints the tag/push it would do and the new workflow URL.
  - `bun run release:platform-packages -- --dry-run --target linux-x64` (mock channel): downloads, verifies sidecar, stages `@anti-ai-design/cli-linux-x64@0.1.18`, `npm publish --dry-run` lists LICENSE, `bin/anti-design`, `package.json`; nothing published. Prints the warning that `package.json` still names the legacy scope. Only linux-x64 was dry-run, not all five.
  - `bun run release:checksums` (mock): writes the manifest, exit 0. `check-engine-release --no-npm`: "release is complete". `fetch-engine --all`: all five verified against the recorded manifest. `check-engine-release --from-dir`: writes a 5-line manifest.
  - `release:skill` / `release:cli -- --dry-run`: with no engine tag on origin they refuse (correct). With the tag present they refuse because the five npm packages are not published (correct, the npm probe is not mockable via the CLI). With `ANTI_DESIGN_SKIP_ENGINE_CHECK=1` and a throwaway changelog + fake `dist/universal.zip` in the scratch clone, they run through to the tag/`gh release create` plan without executing it.
  - `release:ext -- --dry-run`: fails at the changelog step (no `site/pages/changelog.astro` in this repo). Before my change that was an ENOENT stack trace; now a clear message.
  - Against the real channel (nothing released yet): `check:engine-release` lists 15 missing assets, `fetch:engine` and `release:platform-packages -- --dry-run` fail with 404 on `.../engine-v0.1.18/anti-design-linux-x64`. Expected.

## Not verified

- **No workflow has run on GitHub.** `actionlint` was not available. Untested: `cross` on linux-arm64, the Windows build, `bun install --frozen-lockfile` on the runners (locally it succeeds; it also prints a 404 warning for the unpublished optional `@anti-design/cli-*` packages), `build:release` in CI, and the "build produced uncommitted changes" drift check in `release.yml` (copied from `release.mjs`; if generated output legitimately differs on CI it will fail the release).
- `release.yml` has not published anything; the `skill-v<version>` release name is inferred from the Rust installer's tests (`crates/skills/src/bundle.rs`).
- Per-platform binaries were never built by me; the dry-run binary came from the cloned build cache.
- Windows binaries are **not** Authenticode-signed (upstream's Azure signing job was not carried over; no identity exists).
- The `release.mjs` local flow (`skill`, `cli`, `extension`) still needs a changelog file this repo lacks; the tag-driven `release.yml` does not use it.
- `skill/scripts/engine-checksums.txt` still holds the pre-fork digests for `0.1.18`. The first real engine release must use a **new** `ENGINE_VERSION` (and matching `package.json` pins) or the manifest will not match the new binaries.

## Requests for other agents (outside my ownership)

1. **Rename pass, one atomic change:** `package.json` `optionalDependencies` keys, `cli/bin/cli.js:24` (`@anti-design/cli-`), `tests/cli-shim.test.mjs:42,45`, `tests/check-engine-release.test.mjs:29` (mock npm route), then delete `LEGACY_NPM_SCOPE` and its two uses (`fetch-engine.mjs`, `check-engine-release.mjs`) and the scope warning in `publish-platform-packages.mjs`. Until then a `@anti-design/*` stand-in is accepted by the npm probe.
2. **Download base placeholders still `OWNER/anti-design`:** `cli/bin/cli.js:29`, `skill/scripts/anti-design:188,265`, `skill/scripts/anti-design.cmd`, `crates/skills/src/{bundle,engine_binary,bundle_signature}.rs`, `crates/skills/tests/launcher_contract_tests.rs`, `extension/STORE_LISTING.md`, README files, generated harness copies. Set them to `https://github.com/Choxie77/anti-ai-design/releases/download` (and `skill-v<ver>` stays the bundle tag until you change both sides).
3. The installer's `anti-design.example` download endpoint and `https://anti-design.example/api/version` (end of `scripts/release.mjs`, `skill` flow) have no backing site; decide whether the redirect is dropped.
4. Integrator: `scripts/test-suites.mjs:41` still triggers `core` on `.github/workflows/release-engine.yml` (the inert upstream path); root workflows are not covered by any test. I did not touch that file.
5. Because the keyring is compiled into the engine, the **first engine release after this branch** must be rebuilt (the current cached binary trusts the old key).
6. Changelog source for `release:skill|cli|ext` (see above).

## Human steps, in order

1. **Back up the private key** `~/aad-secrets/bundle-signing-private.pem` in a second place you control (password manager). Losing it means rotating the key and shipping a new engine.
2. **Create the GitHub repository** `Choxie77/anti-ai-design` and push this repo (the root containing `anti-design-skill/`). Decide visibility; **release downloads and the installer need the repository (or at least its Releases) public**, and unauthenticated 404s are what a private repo returns. Enable Actions.
3. **Add the signing secret** (value read from stdin, nothing printed):
   `gh secret set ANTI_DESIGN_SIGNING_KEY --repo Choxie77/anti-ai-design < ~/aad-secrets/bundle-signing-private.pem`
   Optional hardening: put it in a `release` environment with required reviewers and add `environment: release` to the `sign-and-publish` job.
4. **Claim the npm scope `@anti-ai-design`** (create the npm organization with that name). Nothing publishes until you run `bun run release:platform-packages` yourself while logged in with `npm login`.
5. **First engine release:** merge to `main` and wait for `test` to be green; choose a new `ENGINE_VERSION` (for example `0.2.0`), update the five `package.json` pins to match, merge, then `cd anti-design-skill && bun run release:engine -- --dry-run`, then without `--dry-run` (this pushes the `engine-v<X>` tag; `release-engine.yml` builds and publishes). Then `bun run release:checksums`, commit `skill/scripts/engine-checksums.txt`, push.
6. **Platform packages:** `bun run release:platform-packages -- --dry-run`, then the real run.
7. **First product release:** make sure `.claude-plugin/plugin.json`, `marketplace.json` and the regenerated outputs agree and are committed, then `git tag v4.8.0 && git push origin v4.8.0` (use the real skill version). `release.yml` tests, builds, signs and publishes `skill-v4.8.0`. Check the release has both `universal.zip` and `universal.zip.sig.json`.
