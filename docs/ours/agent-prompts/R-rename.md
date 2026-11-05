# Prompt: R-rename (paste everything below into a new session)

You are one of several parallel agents building "Anti-AI Design" (a fork of Impeccable 4.8.0, Apache-2.0), repo at /Users/Adam/Desktop/Anti ai design. Other agents and one long-running session work at the same time, so follow these rules exactly.

1. Never work in the main checkout. Create your own worktree (BASE is given in your task):
   cd "/Users/Adam/Desktop/Anti ai design" && mkdir -p ../aad-worktrees && git worktree add ../aad-worktrees/<NAME> -b agent/<NAME> <BASE> && cd ../aad-worktrees/<NAME>
2. If your task builds Rust: clone the build cache (APFS clone, instant) and keep it in your worktree:
   cp -cR "/Users/Adam/Desktop/Anti ai design/anti-design-skill/target" anti-design-skill/target
   export CARGO_TARGET_DIR="$PWD/anti-design-skill/target"; export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"
   For node_modules use `cp -cR` from the main checkout, or `bun install`.
3. Edit ONLY the files in your OWNERSHIP list. If you need a change elsewhere, do not make it: record it under "Requests for other agents" in your status file.
4. Never edit prd.json or progress.txt. Never run `git add -A` or `git add .`. Never regenerate dist/, Cargo.lock or oracle goldens (the integrator does). Never touch .claude/ or skills-lock.json. Never read or print .env (it holds a secret).
5. Commit small and often with explicit paths, on your branch only. Do not push, merge, or touch main.
6. Do not copy Impeccable prose, rule text or assets. Use our own wording. An upstream file you must edit gets a modification notice (Apache-2.0).
7. Final names (use them in anything new): product/bin/package `anti-ai-design`, display "Anti-AI Design", GitHub https://github.com/Choxie77/anti-ai-design, npm scope @anti-ai-design. The code still says `anti-design` until a later rename pass; do not rename code yourself. Where new files must call existing code under its current name, keep that name in ONE obvious place (a variable or constant) and list it in your status file so the rename pass can find it.
8. When finished, write docs/ours/status/<NAME>.md (what changed, files touched, commands run with real results, what is NOT verified, requests for others) and commit it. Your final message must say done / not done honestly, the branch name, and the verification output.

--- YOUR TASK ---
NAME=rename  BASE=main  -- main now contains the branding, release and safefix work. Run it ALONE: all other sessions must be idle (they are, as of now).
Task (new task-51): rename the fork from anti-design to anti-ai-design and replace the OWNER placeholder. Nobody else edits code during this task.
OWNERSHIP: everything under anti-design-skill/, tools/rebrand/, docs/ (mechanical rename only).
Decisions: product/bin/npm name anti-ai-design; GitHub Choxie77/anti-ai-design; every placeholder domain (anti-design.example, anti-design.style) becomes https://github.com/Choxie77/anti-ai-design (no domain that cannot resolve); crates anti-design-* -> anti-ai-design-*; anti_design -> anti_ai_design; antiDesign -> antiAiDesign; display "Anti-AI Design"; env var ANTI_AI_DESIGN_BIN (also ANTI_DESIGN_BUILTIN_ONLY -> ANTI_AI_DESIGN_BUILTIN_ONLY); folder .anti-ai-design/; npm scope @anti-ai-design/cli-*. Keep every "Impeccable" attribution in LICENSE, NOTICE.md, UPSTREAM.md.
Steps: (1) read tools/rebrand/*, progress.txt entries [fork-rebrand] and [fork-verify], docs/ours/BASELINE.md for the traps hit last time. (2) Write tools/rebrand/rebrand2.sh: idempotent, longest patterns first, per-language handling like the first pass. (3) Run it; regenerate the bundle-signature vector (tools/rebrand/regen-vector.mjs), Cargo.lock, dist/ (bun run build); rebuild the engine (cargo build --release); re-record only oracle goldens that differ for rename reasons and log each in tests/oracle/DELTAS.md. (4) Run the full suite with the commands in docs/ours/BASELINE.md (bun/node core, oracle, detector, live, framework, plugin-e2e, cargo test --workspace); set ANTI_AI_DESIGN_BIN.
Carry-over from the other agents' status files (docs/ours/status/release.md and safefix.md), all part of the rename:
 - package.json optionalDependencies keys, cli/bin/cli.js (@anti-design/cli- prefix), tests/cli-shim.test.mjs, tests/check-engine-release.test.mjs: switch to @anti-ai-design/cli-*, then delete LEGACY_NPM_SCOPE and its uses (scripts/fetch-engine.mjs, check-engine-release.mjs) and the scope warning in publish-platform-packages.mjs.
 - Download base placeholders (OWNER/anti-design) in cli/bin/cli.js, skill/scripts/anti-design and .cmd, crates/skills/src/{bundle,engine_binary,bundle_signature}.rs, crates/skills/tests/launcher_contract_tests.rs, extension/STORE_LISTING.md, generated harness copies -> https://github.com/Choxie77/anti-ai-design/releases/download.
 - crates/cli/src/safe_fix.rs constants CONTEXT_DIR and CHANGELOG_FILE, tests/aad-safe-fix.test.mjs and crates/cli/tests/safe_fix.rs (.anti-design/changelog.md), the README gitignore block and tests/readme-gitignore.test.mjs.
 - The compiled-in signing keyring: the new key is aad-release-2026-11; keep it, and note that the engine must be rebuilt (the build cache must not be reused for a release binary built before this change).
 - Also do these two small extras: (1) pass `anti_ai_design_core::rule_pack::default_pack()` as rule_pack in crates/hook/src/hook_lib.rs (two places, about lines 1648 and 1713) and add one hook test showing an aad-* finding; (2) add --fix/--write to the `detect --help` text and re-record only the oracle golden that pins it, logged in tests/oracle/DELTAS.md.
Done when: `grep -rIl 'OWNER/anti-design' anti-design-skill --exclude-dir=node_modules --exclude-dir=target | wc -l` is 0; remaining `anti-design` mentions are only intentional historical ones (list them); the binary prints anti-ai-design --version; the suite equals the green baseline (oracle 0 fail). Report exact numbers.
