# Prompt: A4-branding (paste everything below into a new session)

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
NAME=branding  BASE=main
Task (finishes the non-mechanical part of task-42). Rewrite README.md and README.npm.md in our own voice: what Anti-AI Design is, install, commands, how it differs from generic linters, and a clear fork notice. Find and replace or delete upstream-derived marketing: docs/images/readme-*.webp, "Neo Mirai" case references, README comparison text (grep -rIn 'Neo Mirai\|impeccable.style' anti-design-skill with node_modules/target excluded; edit only files in your OWNERSHIP). Keep LICENSE untouched. Make NOTICE.md and UPSTREAM.md accurate under Apache-2.0: what is copied, from which commit (c8891a9), what we changed, where modifications are marked. Use https://github.com/Choxie77/anti-ai-design for all URLs. If an image is needed, make a simple original SVG; never reuse upstream art. Any file outside OWNERSHIP that contains upstream branding goes into "Requests for other agents".
OWNERSHIP (all under anti-design-skill/): README.md, README.npm.md, docs/images/**, demos/**, NOTICE.md, UPSTREAM.md, DESIGN.md, PRODUCT.md. Do not touch crates/, scripts/, tests/, package.json.
No Rust build needed: skip step 2 of the rules.
Done when: no "Neo Mirai" and no upstream readme images remain in your files (show the grep output), every link in the two READMEs points at a file that exists or at the Choxie77 repo, and NOTICE/UPSTREAM state the provenance. Commands in the README must match `target/release/anti-design --help` (check, do not guess).
