# Anti-AI Design Studio

A local web UI for the detector. Scan a folder or a pasted snippet, read findings with the code around them, preview safe fixes as diffs, apply them, browse the rule catalog.

## Run

```bash
node studio/server.mjs --root <folder> [--port 4180] [--engine <binary>]
```

Open the full URL it prints (it ends in `#token=...`). Node >= 20, no dependencies.
Engine lookup order: `--engine`, env `ANTI_AI_DESIGN_BIN`, env `ANTI_DESIGN_BIN`, `../anti-design-skill/target/release/anti-ai-design`, `.../anti-design`, then PATH. Names live in `lib/engine.mjs` only. If none is found the UI shows the build command.

Tests: `cd studio && npm test` (or `node --test studio/tests/*.test.mjs` from the repo root; Node 24 does not accept a bare directory argument). The integration test uses the real binary and skips if missing; set `ANTI_DESIGN_BIN` to run it.

## Security model

127.0.0.1 only; Host header checked (DNS rebinding); random per-start token required on every `/api` call (`x-studio-token`), carried in the URL fragment and stripped from the address bar; cross-origin (`Origin`, `Sec-Fetch-Site`) refused; POST must be `application/json`; strict CSP, no network calls, no CDN, no fonts. Every path is realpath-resolved (symlinks included) and must lie inside `--root`, else 403. The server never reads dotfiles itself (only the engine does); files over 2 MB and snippets over 1 MB are refused. Apply needs `{confirm:true}`, re-runs the dry run, refuses (409) if the diff differs from the previewed `diffId`, refuses (403) if any file in the diff resolves outside the root, and serialises writes. Snippets live in a `mkdtemp` folder deleted in a `finally`. The engine is run only through `execFile` with an args array.

## Adapter contract (`web/engine.js`)

The UI talks only to this. `LocalEngine` works; `WasmEngine` is a stub whose every method rejects with `EngineError('not_available', 'The in-browser engine is not available yet.')`.
Input is `{target}` (path relative to root) or `{snippet, ext}` (html/css/jsx/tsx). Errors reject with `EngineError {code, message, status, details}`.

- `info()` -> `{engine:{found,path,version,error}, root, buildCommand, limits, snippetExts, capabilities}`
- `listRules()` -> `{rules:[{id,name,category,severity,scopes,description,firstParty}]}`
- `scan(input)` -> `{kind,target,durationMs,skipped,summary:{total,files,bySeverity,byCategory,byRule},findings:[{id,rule,name,description,severity,category,file,line,snippet,advisory,context:{start,end,lines:[{n,text,hit}]}|null}]}`
- `previewFixes(input)` -> `{kind,target,fixCount,fileCount,summary,diffId,files:[{file,additions,deletions,changedLines,hunks:[{oldStart,oldLines,newStart,newLines,lines:[{t:'ctx'|'add'|'del',old?,new?,text}]}]}]}`
- `applyFixes({...input, confirm:true, diffId?})` -> preview shape + `{applied, written, fixed?}` (`fixed` = fixed text, snippets only)
- `browse(path)`, `changelog()` -> folder mode only; the WASM engine reports `capabilities.folders=false`.

WASM later: implement `scan` with `detect_text_json` / `detect_html_source_json`, `listRules` from the wasm rule list, `previewFixes`/`applyFixes` on the snippet only (return `fixed`), and read `capabilities` in `info()`.
