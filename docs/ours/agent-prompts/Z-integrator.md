# Prompt: Z-integrator (paste everything below into a new session)

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
(No worktree needed; run in a fresh session once all agents are done.)
Task (new task-55): in the repo at /Users/Adam/Desktop/Anti ai design, merge the agent branches (agent/branding, agent/release, agent/rename, plus anything else listed in docs/ours/status/) into branch `integration` one at a time, reading each docs/ours/status/*.md first and resolving conflicts without dropping either side. Regenerate dist/, Cargo.lock and oracle goldens once at the end. Run the full suite (commands in docs/ours/BASELINE.md). Do the remaining PRD tasks that are not yet completed in prd.json (47, 48, 49 if the long-running session did not finish them): task-49 = run the built binary's detect on the sample app fixture (or a project I name), save before/after to docs/ours/e2e.md. Run the release scripts in dry-run mode. Update prd.json and progress.txt (mark 42, 50-55 and the rest completed only if their verification command passes). Then show me the diff stat and the remaining human steps, and WAIT for my OK before fast-forwarding main, tagging v0.1.0 or pushing to https://github.com/Choxie77/anti-ai-design.git. Before any push, run `git log --all -- .env` (must print nothing) and list the files that would be pushed.
