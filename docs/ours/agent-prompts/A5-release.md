# Prompt: A5-release (paste everything below into a new session)

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
NAME=release  BASE=main
Task (new task-53): make the project releasable from Choxie77/anti-ai-design. Read docs/BUNDLE-SIGNING.md, docs/ENGINE.md, scripts/release.mjs, scripts/fetch-engine.mjs, scripts/check-engine-release.mjs first.
1. Generate OUR bundle-signing keypair. Commit only the PUBLIC key in scripts/bundle-signing-keys.json (replace upstream's). Write the private key to ~/aad-secrets/ OUTSIDE the repo, mode 600, and tell the user to store it as a GitHub Actions secret. Never print or commit the private key or any token. Fix docs/BUNDLE-SIGNING.md to match.
2. Engine release channel = GitHub Releases of Choxie77/anti-ai-design: update fetch-engine.mjs, check-engine-release.mjs, checksum generation (engine-checksums.txt) and the ENGINE_VERSION flow. The OWNER placeholders in these files become Choxie77/anti-ai-design.
3. .github/workflows: test (bun, node, cargo, oracle), build-engine matrix (darwin arm64/x64, linux x64/arm64, windows x64), release on tag v*. Pin action versions.
4. cli/platform-packages and scripts/publish-platform-packages.mjs use the scope @anti-ai-design (the user must claim it on npm; never publish).
5. Run every `release:*` script in dry-run / no-publish mode and record the real output.
OWNERSHIP (under anti-design-skill/): scripts/**, .github/** (create at repo level if the workflows must live there; say where in the status file), cli/platform-packages/**, package.json, docs/BUNDLE-SIGNING.md, docs/ENGINE.md. Do not touch crates/. The running session has an uncommitted edit in scripts/test-suites.mjs: do not rewrite that file wholesale; keep your changes there minimal and note them.
Rust build is only needed to produce a binary for the dry run (step 2 of the rules applies if you do).
Done when: `node scripts/run-tests.mjs core` still passes, workflows parse (actionlint if installed, otherwise a YAML parse), dry runs succeed, and the status file lists the exact human steps (claim npm scope, add secrets, set repo visibility, first tag).
