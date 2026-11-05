# Prompt: S-studio (paste everything below into a new session)

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
NAME=studio  BASE=main
Build "Anti-AI Design Studio": a local web UI for the detector. This runs IN PARALLEL with the agent "rename", which owns anti-design-skill/, tools/rebrand/ and docs/. You must not touch any of those. No Rust build is needed: skip step 2 of the rules.

OWNERSHIP: a new top-level folder `studio/` (repo root, next to anti-design-skill/) and docs/ours/status/studio.md. Nothing else.

WHAT IT IS
A small web app you start with `node studio/server.mjs --root <folder>` and open in a browser. It lets a person scan a project folder or a pasted snippet with the engine binary, read the findings in a good interface, preview the safe fixes as diffs, and apply them. It also lists the rule catalog. Public-website mode (WASM) comes later; design for it now (see ADAPTER) but do not build it.

FACTS ABOUT THE ENGINE (verify each by running it; the status files docs/ours/status/safefix.md and docs/ours/contract-diff.md have details)
- Binary today: anti-design-skill/target/release/anti-design (the rename session will later call it anti-ai-design). Never hard-code the name in the UI; read it from `--version`.
- `detect --json <path>` prints a bare JSON array of findings: antipattern, name, description, severity, category, file, line, snippet. Exit code 0 = clean, 2 = findings; treat both as success. Unknown flags are silently ignored.
- `detect --list-rules --json` lists the rules (first-party ones start with `aad-`).
- `detect --fix <path>` is a dry run: unified diff on stdout, summary on stderr, nothing written. `detect --write <path>` applies the fixes and appends to .anti-design/changelog.md in the current directory (run it with cwd = the project root).
- Test inputs live in anti-design-skill/tests/fixtures/aad/ (for example gradient-text.css).

ARCHITECTURE
- `studio/server.mjs`: Node >= 20, ZERO runtime dependencies, ES modules. Serves `studio/web/` and a JSON API: GET /api/info (binary path, version, root), GET /api/rules, POST /api/scan {target | snippet+ext}, POST /api/fix/preview, POST /api/fix/apply {confirm:true}, GET /api/changelog. Run the engine ONLY with execFile and an args array (never a shell string).
- Binary resolution order: env ANTI_AI_DESIGN_BIN, env ANTI_DESIGN_BIN, then ../anti-design-skill/target/release/anti-ai-design, then .../anti-design, then PATH. Show the resolved path and version in the UI footer; show a clear "engine not found" state with the build command if none.
- SECURITY (this server can read and write files, so treat it as hostile-input code): bind 127.0.0.1 only; check the Host header (DNS-rebinding defense); generate a random token at start, print the full URL with the token, require it on every /api call (header), and refuse cross-origin requests; every requested path must resolve (realpath, symlinks included) inside --root, otherwise 403; no dotfile reads except through the engine; refuse files over 2 MB; /api/fix/apply needs {confirm:true} and a target inside --root; pasted snippets go to a mkdtemp directory that is deleted afterwards; no network calls of any kind, no telemetry, no CDN, no remote fonts.
- ADAPTER: `studio/web/engine.js` exports one interface: scan(input), listRules(), previewFixes(input), applyFixes(input), info(). Implement `LocalEngine` (talks to the server). Add `WasmEngine` as a documented stub that throws "not available yet", and write the contract (inputs, outputs, errors) in studio/README.md so a later session can implement it with the wasm crate's detect_text_json / detect_html_source_json. The UI must only talk to the adapter.
- Frontend: plain HTML, CSS and ES modules, no framework, no build step, no dependencies. Responsive from 360 px to wide desktop, keyboard-operable, light and dark via prefers-color-scheme.

SCREENS
1. Scan: choose a folder under --root (a typed path with a listing of subfolders) or paste a snippet (pick html/css/jsx/tsx). One clear primary action.
2. Results: counts by severity and category; findings grouped by file or by rule (toggle); filters; each finding shows the rule name and plain-language explanation, file:line, and the code around the line (read from the file, a few lines of context, the flagged line marked). Empty and error states are designed, not afterthoughts.
3. Fixes: for fixable findings show the dry-run diff, side by side or unified, a visible "nothing is written until you apply" statement, an Apply button with a confirmation step, and afterwards the changelog tail and a re-scan showing the finding gone.
4. Rules: searchable catalog from --list-rules, marking first-party rules, with severity and category.

DESIGN DIRECTION (important: this is a tool against generic AI-made design, so it must not look like it)
Treat it like a proofreader's marked-up manuscript or a lab report: warm paper background, ink-dark text, ONE accent colour (a proofreader's red) used only to mark findings and the primary action, a serif for headings and reading text and a monospace for code, using system font stacks (no downloads). Strong typographic hierarchy, generous but deliberate spacing, ruled lines instead of boxed cards, visible keyboard focus, real contrast (check WCAG AA). Forbidden: purple or blue-to-purple gradients, gradient text, glassmorphism, identical rounded card grids, emoji as icons, sparkle icons, more than one accent colour, mixed corner radii, a hero with a centred headline and two buttons, side-stripe borders on cards, removing focus outlines, icon-only buttons without accessible names. Write your own copy: concrete verbs, no marketing filler.
DOGFOOD: when done, run the engine's detect on studio/web/ and fix everything it reports until it exits 0 (or document precisely why a finding is a false positive, with the rule id and line). Put that output in the status file.

TESTS (node --test, in studio/tests/, no dependencies)
- Server: token required; wrong Host rejected; path traversal and symlink escape rejected; apply without confirm rejected; fix/apply writes only inside --root; temp snippet dir removed.
- Adapter and API with a fake engine (a small script that prints canned JSON, selected by env var) so tests do not need the Rust build; plus one integration test against the real binary that skips cleanly when it is missing.
- Scripts in studio/package.json: start, test. studio/ is a standalone package; do not edit any other package.json.

VISUAL VERIFICATION
Start the server on port 4180 (4173 is the progress dashboard, leave it alone) with --root pointing at a copy of the fixtures, open it in the built-in browser pane, and check desktop (1280 px) and mobile (375 px), light and dark, the empty, loading, error and populated states. Fix what looks wrong. Describe what you saw in the status file (screenshots saved under studio/docs/ are welcome).

OUT OF SCOPE
WASM engine, URL scanning, desktop packaging, accounts, publishing, hosting, telemetry of any kind. Note ideas for them in the status file.

DONE WHEN
`node --test studio/tests` passes (report the numbers); the four screens work end to end on the gradient-text fixture (scan, preview diff, apply, changelog, rescan clean); the dogfood scan of studio/web is clean or fully explained; studio/README.md explains how to run it, the security model and the adapter contract; the status file says honestly what is not verified.
