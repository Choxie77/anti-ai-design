# Status: studio (Anti-AI Design Studio)

Branch `agent/studio`, base `main`. **Mostly done; not fully finished** (usage limit hit before final polish and a last full test run).

## What exists
`studio/`: `server.mjs`, `lib/{app,engine,security,diff}.mjs`, `web/` (index.html, styles.css, engine.js adapter, model.js, ui.js, app.js, views/{scan,results,fixes,rules,diffview}.js), `tests/` (fake engine + 5 test files), `README.md` (run, security model, adapter contract), `docs/` (3 screenshots).

## Verified (real runs)
- `node --test` in studio/: **30 pass, 2 skipped, 0 fail** without the binary; **32 pass, 0 fail** with `ANTI_DESIGN_BIN` set to the main checkout's release binary (run before the last CSS tweaks; not re-run after them).
- Browser pane on port 4180 with a fixtures copy: scan root (8 findings), results with code context, safe-fix tags, unified diff, confirm step, apply, changelog, rescan clean on gradient-text.css (file verified on disk); snippet flow (scan, fix, copy text); clean-result state; engine-not-found state (port 4181); Rules screen (68 rules, 6 first-party); mobile 375 dark and desktop 1280 light. Found and fixed: sr-only text causing horizontal overflow at 375; placeholder contrast; changelog table on mobile.
- Dogfood: `detect studio/web` exits 0 (regex-only mode; one advisory fixed). `detect --json http://127.0.0.1:4180/#...` (rendered, scan/rules routes) -> `[]`. Rendered scan of a hand-captured Results snapshot initially gave cramped-padding, flat-type-hierarchy and 2x aad-focus-removed; after fixes it was **clean** at the 0.1875rem code-row padding.

## Known false positives / engine findings
- `aad-focus-removed` fires on the *text* "button { outline: none }" when a page merely displays that code (e.g. a finding's note). Only in snapshots with such sample content; not in Studio's own CSS. Engine fix: only look inside `<style>`/style attributes.
- `cramped-padding` does not understand `padding-block`/`padding-inline`; I used physical padding properties instead.

## NOT verified
- Tests not re-run after the final CSS edit (`.cl` padding 0.1875rem) and the Results/Fixes `tally-title` change.
- Side-by-side diff layout, tablet widths, 360px exactly, dark mode on desktop, and keyboard-only walkthrough were not visually checked. Contrast was computed for the palette (all body text >= 6.5:1) but not audited per element.
- Rendered dogfood covered Scan/Rules routes and one Results snapshot, not Fixes states.
- `node --test studio/tests` (bare directory) fails on Node 24; use the glob or `npm test`.
- Not committed: nothing outside studio/ and this file was touched.

## Names for the rename pass
`lib/engine.mjs`: `ENGINE_NAMES`, `ENGINE_ENV_VARS`, `BUILD_COMMAND`; `lib/app.mjs`: `CHANGELOG_REL` (`.anti-design/changelog.md`); `web/views/fixes.js` copy mentions `.anti-design/changelog.md`; `server.mjs` fine. Tests use `ANTI_DESIGN_BIN`.

## Requests for other agents
Engine owner: the two false positives above; `detect --fix --json` would simplify diff parsing.

## Ideas (out of scope)
WASM engine, URL scanning, per-finding fix selection, undo from changelog, export report.
