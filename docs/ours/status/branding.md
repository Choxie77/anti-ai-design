# Status: branding (non-mechanical part of task-42)

Branch `agent/branding`, base `main` (69aea44). Date 2026-11-05.

## Result

Done for the files I own. Not merged, not pushed.

## What changed (all under `anti-design-skill/`)

| File | Change |
|---|---|
| `README.md` | Rewritten from scratch: what it is, pre-release status, fork notice, how it differs from a generic linter, install (npm path + build from source), the 24 commands, live mode safety notes, detector usage, ignores, project files, telemetry, license. Upstream marketing, the case-study link, the comparison table and all upstream image links are gone. |
| `README.npm.md` | Rewritten: fork notice, status, quick start, rule list by real rule id, exit codes, options mirrored from `detect --help`, requirements. |
| `docs/images/overview.svg` | New, original three-box diagram (hand-written SVG, valid XML, has `<title>`/`<desc>`). |
| `docs/images/readme-with.webp`, `readme-without.webp` | Deleted (`git rm`). |
| `NOTICE.md`, `UPSTREAM.md` | Rewritten: commit `c8891a9ae865d6ee311836ae5199bfce0fe115b1`, version 4.8.0, what was copied, what changed (scripted rename `69aea44` + this pass + later git history), where modifications are marked, no-endorsement and name statements. `LICENSE` untouched. ehmo MIT notice kept. |
| `PRODUCT.md` | Rewritten in our words (the old file described upstream's website). Keeps the `anti-design:product-schema 1` marker and `## Platform` = `web`. |
| `DESIGN.md` | Replaced. The old file was 534 lines of upstream's website design system ("Neo Kinpaku"). New file is a short system for the README art (4 colors, 2 type stacks). |
| `demos/` | Not changed (see "Not verified / decisions"). |

## Commands run and results

- `grep -rIn 'Neo Mirai\|impeccable.style\|readme-with\|readme-without\|anti-design.example\|OWNER' README.md README.npm.md NOTICE.md UPSTREAM.md DESIGN.md PRODUCT.md demos docs/images` (run from `anti-design-skill/`): **no output, exit 1** (after rewording one sentence in UPSTREAM.md that named the deleted files).
- Repo-wide in `anti-design-skill/`: `grep -rIlE 'Neo Mirai|impeccable\.style'` finds nothing. The only other hits in the whole repo are `docs/research/raw/*` (captured upstream pages), `prd.json`, `progress.txt`.
- `ls docs/images` -> `overview.svg` only.
- `xmllint --noout docs/images/overview.svg` -> ok.
- Link check script over README.md, README.npm.md, NOTICE.md, UPSTREAM.md: every relative link exists (`docs/images/overview.svg`, `UPSTREAM.md`, `NOTICE.md`, `LICENSE`, `docs/HARNESSES.md`, `docs/CLI-CONTRACT.md`, `docs/DEVELOP.md`, `docs/ENGINE.md`). Every absolute link is the Choxie77 repo, except two attribution links the fork notice needs: `github.com/pbakaus/impeccable` and `github.com/anthropics/skills/.../frontend-design`.
- Contrast of the new palette on `#f4f1ea` (computed): ink 15.26, muted 6.40, accent 5.38.
- Engine checks, using `anti-design-skill/target/release/anti-design` from the main checkout (0.1.18+engine): `--help`, `detect --help`, `install --help`, `update --help`, `link --help`, `check --help`, `ignores --help`, `telemetry status`, `detect --list-rules --quiet`. Behavior I put in the README was run on small HTML files in the scratchpad: findings -> exit 2 and 5 findings; clean file -> exit 0; missing path -> "Warning: cannot access" and exit 1; an `anti-design-disable overused-font` comment cut 5 findings to 4.

## Not verified / decisions

- **`anti-design help` fails** ("Could not fetch command list from anti-design.example"). README says so. The 24-command list comes from the table in `skill/SKILL.src.md`, not from `help`.
- **Binary name.** Commands in both READMEs use the final name `anti-ai-design`; the real binary is `anti-design`. Each README says so in a "Names" note. Subcommands and flags were checked against the real binary.
- **`aad-` rules.** The READMEs mention our own `aad-` rules (6 in the binary I checked: emoji-icons, focus-removed, icon-button-name, multiple-accents, mixed-radii, glass-overuse). Those live in `crates/aad-rules/`, which is **uncommitted in the main checkout**, not on `main`. The binary I checked was built with them. If they do not land, delete the three sentences that mention them (README.md "It has rules of our own", README.npm.md "Project-specific" paragraph and the sentence after "Run `detect --list-rules`"). I did not state a total rule count on purpose (the binary lists 68; committed upstream-derived code has 62).
- Not run: the install flow, hooks, live mode, URL scans, `cargo build` from the README steps, the npm launcher. The supported-tools list is the installer's provider list; I did not test each tool.
- The gitignore entries in the README come from upstream's documented list, not re-derived from engine code. The `.gitignore`-is-not-edited-by-installer point is advice ("add these yourself"), not something I confirmed in code.
- Live-mode warnings (validate script, codex/claude fallback with sandbox off, `ANTI_DESIGN_LIVE_COPY_AGENT`) were checked to exist in `crates/live/src/copy_edit_agent.rs`; I did not run live mode. The 60-second poll window is from the old README, not re-read from code.
- `demos/landing-demo/` is left as is: upstream's sample project ("Lumina", a fictional product), no upstream brand, Neo Mirai or domain strings in it. It is documented in UPSTREAM.md as copied. If you want zero upstream-authored samples, delete it, but `docs/openai-plugin-submission.md` and a test fixture comment refer to it.
- Apache-2.0 per-file "modified" notices: none exist; UPSTREAM.md says so plainly and relies on NOTICE/UPSTREAM, the rebrand script and git history. Whether that is enough is a call for the integrator.

## Names in new files that the rename pass must change

In `README.md` and `README.npm.md`; each carries an HTML `RENAME-PASS` comment at the top.

- `cargo build --release -p anti-design`, `target/release/anti-design` (README.md, "Build from source")
- `ANTI_DESIGN_BIN`, `ANTI_DESIGN_BROWSER`, `ANTI_DESIGN_LIVE_COPY_AGENT`, `ANTI_DESIGN_NO_TELEMETRY`
- `.anti-design/` project folder, `~/.anti-design/bin/`, `anti-design-disable` inline comment, `anti-design:manual-edit-validate` script name
- the "Names" note blocks in both READMEs (delete when the rename lands)
- `UPSTREAM.md` and `NOTICE.md` mention the old name "Anti-Design" only where describing the fork commit message and the scripted rename; leave those.

## Requests for other agents (files outside my ownership with upstream branding or placeholders)

1. `package.json`: `homepage` = `https://anti-design.example`, `repository.url` = `git+https://github.com/OWNER/anti-design.git`; `bugs`/other URLs likewise. Set to `https://github.com/Choxie77/anti-ai-design`.
2. `.claude-plugin/plugin.json`, `plugin/.claude-plugin/plugin.json`, `plugin/.grok-plugin/plugin.json`: author "Paul Bakaus", homepage `anti-design.example`. Author should be ours; keep upstream credit via NOTICE.
3. `extension/STORE_LISTING.md`, `extension/popup/popup.html`, `extension/shared/findings-report.js`: `anti-design.example` links and store-listing copy written for upstream's extension listing; `extension/shared/kinpaku.css` is upstream's "Neo Kinpaku" site style.
4. `ui/component-review/**` (`vendor/kinpaku-tokens.css`, `kinpaku-kit.css`, `kit-css.ts`, `docs-rail.css`, `instrument-strip.js`, `README.md`, `styles.ts`, `plan-styles.ts`, `kit.ts`): vendored from upstream's website ("VENDORED from anti-design-site/site/styles/..."). This is upstream's visual identity inside the shipped component-review UI; replace with our own tokens. It also feeds `crates/context/assets/component-review.js` (generated).
5. `crates/context/src/{url,telemetry,concept_seed,serve_question,context_cli,seed_text}.rs`, `crates/core/src/browser/{line_breaks,hidden_mockup}.rs`, `crates/skills/src/{commands,bundle,bundle_signature,engine_binary,providers}.rs`, `crates/xtask/src/main.rs`, `crates/detect/src/skills.rs`, `crates/wasm/tools/*.mjs`, `crates/live/assets/README.md`, `scripts/fetch-engine.mjs` (`DEFAULT_DOWNLOAD_BASE` = `OWNER/anti-design` releases): `anti-design.example` and `OWNER/anti-design` placeholders. Also the telemetry default API base `https://anti-design.example/api`.
6. All generated skill copies (`skill/reference/{live,live-setup,routing}.md`, `skill/scripts/anti-design{,.cmd}`, and the per-tool copies under `.claude/`, `.cursor/`, `.agents/`, ... `plugin/`, `cursor-plugin/`) contain the same placeholders; regenerate from `skill/` after fixing the source, do not hand-edit.
7. `tests/oracle/**` (about 41 files), `tests/fixtures/**`, `tests/validate-plugin-manifest.test.js`: placeholder domain in goldens and vectors. Integrator regenerates goldens.
8. `CLAUDE.md`, `docs/openai-plugin-submission.md` (mentions `OWNER/anti-design`), `docs/RELEASE-4.4.0.md`, `docs/REVIEW-4.4.0-READINESS.md`, `docs/adr-live-variant-mode.md` (author line "Paul Bakaus + Claude"): upstream release notes and decision records. Decide whether to keep as history, rewrite, or remove.
9. `docs/research/raw/*.html` (repo root): captured copies of upstream site pages (task-01), 20+ files containing `impeccable.style`. Fine as private research; do not ship, and decide whether they belong in the public repo.
10. `browser-bundle/00-header.js` and `crates/live/assets/detect-antipatterns-browser.js` header: "Copyright (c) 2026 Paul Bakaus" kept on purpose (upstream header), but it is generated from the bundler; if the header text is changed, keep the upstream copyright line.
11. `.pnpm/` at the repo root (not inside `anti-design-skill/`) has about 8,500 tracked files (a pnpm content store) in the fork commit. Probably an accident of the copy; worth checking and removing from tracking. Not touched by me.
