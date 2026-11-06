# Anti-AI Design Studio

A local web UI for the detector. Scan a folder or a pasted snippet, read findings with the code around them, preview safe fixes as diffs, apply them, browse the rule catalog.

## Run

```bash
node studio/server.mjs [folder] [--lock] [--port 4180] [--engine <binary>]
```

Open the full URL it prints (it ends in `#token=...`). The folder is optional: start inside a project and that project opens; start anywhere else and the page asks you to choose one (see "Giving it a project"). `--root <folder>` is the older spelling of the folder argument and still works. Node >= 20, no dependencies.
Engine lookup order: `--engine`, env `ANTI_AI_DESIGN_BIN`, `../anti-design-skill/target/release/anti-ai-design`, then PATH. Names live in `lib/engine.mjs` only. If none is found the UI shows the build command.

Tests: `cd studio && npm test` (or `node --test studio/tests/*.test.mjs` from the repo root; Node 24 does not accept a bare directory argument). The integration test uses the real binary and skips if missing; set `ANTI_AI_DESIGN_BIN` to run it.

## Giving it a project

**Choosing the project (no terminal needed).** The Scan screen has a "Which project do you want to check?" card with four ways in, all ending at the same place (the project bar, with "N files will be read" under it and focus on the Scan button):

- **Choose folder…** asks the operating system's own folder window (`POST /api/project/pick`; `osascript` on macOS, PowerShell on Windows, `zenity` or `kdialog` on Linux). It works because the server runs on the same computer. Where no window can be shown (SSH, no desktop) the button hides itself and the in-page browser opens instead.
- **Drop the folder on the page.** A browser never reveals where a dropped folder lives, only its name, so `GET /api/folders/find?name=` looks for folders of that name near the home folder (4 levels deep, folders with something to scan first). One match opens; several are listed to pick from. A dropped path as text, `file://` link or file also works.
- **Paste a path.** Quotes, `~`, `file://` links, backslash-escaped spaces and bare names (`my-site`, looked up in the current project's parent, home, Desktop and Documents) are understood (`pathCandidates` in `lib/folders.mjs`). A path to a file opens its folder and narrows the scan to that file.
- **Browse or Recent.** `GET /api/folders?path=` lists sub-folders of any folder with a count of what a scan would read in each, so project folders stand out. Recent projects are kept in `~/.anti-ai-design/studio.json` (not written when `--lock` is on).

`POST /api/project {path}` makes the folder the project and clears the page's old findings. The disk root and the whole home folder are refused (`too_broad`). Without a project, folder routes answer 409 `no_project`; pasted snippets still work. Narrowing to a sub-folder or file is under "Only check part of the project".

`--lock` pins the Studio to the folder it was started with: the choose routes answer 403 `project_locked` and the page hides "Change project". Use it for a shared or demo setup.

- **Before the scan.** `GET /api/browse` also returns `scannable` (`lib/project.mjs`): how many files the detector will read under the chosen path, by type, and which folders it skips (`node_modules`, `dist`, `build`, hidden folders). The Scan screen shows "14 files will be read (9 CSS, 4 HTML, 1 JSX)". A folder with nothing to read says so and disables the button; a path that does not exist says so too. The lists mirror the engine's walker, and `tests/project.test.mjs` compares them with the engine source when it is next to this checkout.
- **After the scan.** The result carries `scanned` (files read), so "No files were scanned" is told apart from "Nothing reported".
- **Lines the detector does not name.** For HTML pages, and for marks it finds in a stylesheet the page links, the detector gives line 0. `lib/locate.mjs` finds the most likely line from what the detector says it matched (in the page first, then its local stylesheets) and sets `located: {approximate: true, via}` on the finding. The UI labels these "(likely)". The same mark reported once for a page and once for its stylesheet is collapsed into one. A finding with a guessed line is never tagged "can be fixed automatically", because another mark on the same line would otherwise be claimed as fixed.
- **After a fix.** The re-scan lists rules that are reported more often than before ("the change itself raised something new"), since a mechanical fix can leave a neighbouring problem, such as a low-contrast colour.

## Guided experience (first-time visitors)

The Studio teaches itself, for someone who has never heard of the tool.

- **Tour** (`#/welcome`, opens automatically on the first visit, always available from the header). Six chapters, each with an animated illustration: the problem, what the detector does, then Scan, Findings, Fixes, and why it is safe. Arrow keys move between chapters; "Replay" re-runs a picture; numbered keys light up the matching mark in the picture.
- **Try it on a sample.** One click scans a small piece of real code (`web/sample.js`) in snippet mode, so no project file is touched, then walks through the Findings and Fixes screens with a spotlight walkthrough (`web/coach.js`) laid over the real page. "Walk me through this page" re-runs it on demand.
- **Field guide** (`#/guide`). Ten plates, each an AI-made mark next to a considered version, flippable, tied to the detector rule that catches it. Findings and Rules link to the matching plate (`#/guide/<id>`). The "hidden keyboard focus" plate is live: press Tab on each side.
- **Smaller aids.** Illustrated steps and a reading animation on Scan, a count-up and growing bars on Findings, shape-plus-colour severity glyphs, a before/after bar and a drawn tick after a fix.

How it is built, so it stays inside the Studio's rules:

- Pictures are SVG built in `web/art.js` with `s()` from `ui.js`; colours are CSS classes in `web/tour.css`, so they follow light and dark mode. No `innerHTML`, no style attributes (the CSP blocks them); animation delays are set as CSS custom properties through the CSSOM.
- Keyframes only describe where a thing *starts*. The element's normal style is the finished picture, so with `prefers-reduced-motion` (or no CSS animation) people see the finished picture. The two looping pictures stop after a few turns.
- Copy lives in `web/tour-content.js` and `web/guide-content.js` (pure data). `tests/onboarding.test.mjs` checks that every chapter has a picture, every legend matches its markers, every rule named in the field guide exists in the real engine, and that the sample really produces findings and one safe fix.
- What a browser has already been shown is kept in `localStorage` (`studio-onboarding-v1`), guarded so the Studio works the same with storage blocked. To see the first-run tour again, clear that key or open `#/welcome`.

## Security model

127.0.0.1 only; Host header checked (DNS rebinding); random per-start token required on every `/api` call (`x-studio-token`), carried in the URL fragment and stripped from the address bar; cross-origin (`Origin`, `Sec-Fetch-Site`) refused; POST must be `application/json`; strict CSP, no network calls, no CDN, no fonts. Every path is realpath-resolved (symlinks included) and must lie inside the current project, else 403. **Choosing a project is the one door out of that fence:** the token holder (the page you opened) can point the Studio at any folder this user can read, and can list folder names anywhere (names and file counts only, never contents). That is the same reach as the operating system's own folder window. The disk root and the whole home folder are refused, the routes carry the same token / Host / Origin / JSON checks as the rest, a switch waits for any fix being applied, and `--lock` removes the door entirely. The server never reads dotfiles itself (only the engine does); files over 2 MB and snippets over 1 MB are refused. Apply needs `{confirm:true}`, re-runs the dry run, refuses (409) if the diff differs from the previewed `diffId`, refuses (403) if any file in the diff resolves outside the root, and serialises writes. Snippets live in a `mkdtemp` folder deleted in a `finally`. The engine is run only through `execFile` with an args array.

## Adapter contract (`web/engine.js`)

The UI talks only to this. `LocalEngine` works; `WasmEngine` is a stub whose every method rejects with `EngineError('not_available', 'The in-browser engine is not available yet.')`.
Input is `{target}` (path relative to root) or `{snippet, ext}` (html/css/jsx/tsx). Errors reject with `EngineError {code, message, status, details}`.

- `info()` -> `{engine:{found,path,version,error}, root (null until a project is chosen), home, recent, buildCommand, limits, snippetExts, capabilities:{...,switchProject}}`
- `listRules()` -> `{rules:[{id,name,category,severity,scopes,description,firstParty}]}`
- `scan(input)` -> `{kind,target,durationMs,skipped,summary:{total,files,bySeverity,byCategory,byRule},findings:[{id,rule,name,description,severity,category,file,line,snippet,advisory,context:{start,end,lines:[{n,text,hit}]}|null}]}`
- `previewFixes(input)` -> `{kind,target,fixCount,fileCount,summary,diffId,files:[{file,additions,deletions,changedLines,hunks:[{oldStart,oldLines,newStart,newLines,lines:[{t:'ctx'|'add'|'del',old?,new?,text}]}]}]}`
- `applyFixes({...input, confirm:true, diffId?})` -> preview shape + `{applied, written, fixed?}` (`fixed` = fixed text, snippets only)
- `browse(path)`, `changelog()` -> folder mode only; the WASM engine reports `capabilities.folders=false`.
- `folders(path?)` -> `{path,name,parent,home,tooBroad,scannable,dirs:[{name,files,more}],shortcuts:[{label,path}]}`; `findFolder(name)` -> `{name,matches:[{path,files}]}`; `pickFolder()` -> `{path}` or `{cancelled:true}`; `openProject(path)` -> `{root,name,focus,scannable,recent}`. All local-server only, and refused when `capabilities.switchProject` is false.

WASM later: implement `scan` with `detect_text_json` / `detect_html_source_json`, `listRules` from the wasm rule list, `previewFixes`/`applyFixes` on the snippet only (return `fixed`), and read `capabilities` in `info()`.
