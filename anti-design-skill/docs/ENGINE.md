# The engine: the Rust runtime behind every skill verb

Every command the skill text runs is `{{scripts_path}}/anti-design <verb>`. The
launcher next to the skill (`skill/scripts/anti-design`, `anti-design.cmd`)
finds or downloads one static binary per platform and execs it. That binary
is built from this repo's Cargo workspace. There is no Node at runtime.

This page is the map for anyone building or changing the runtime. The
observable behavior of every verb is specified in `CLI-CONTRACT.md` and
pinned byte-for-byte by `tests/oracle/`.

Everything is in this repo, Apache-2.0, and builds offline from source. No
part of the engine is fetched at build time.

## Layout

```
Cargo.toml              the workspace (crates/*), release profile
rust-toolchain.toml     the channel plus the wasm32 target
ENGINE_VERSION          which engine release the launcher / npm shim download
.cargo/config.toml      the `cargo xtask` alias
browser-bundle/         the page JS the in-page bundle is built from
crates/
  cli          the `anti-design` binary: verb router, exit codes
  common       Io handle (stdout/stderr/stdin/env/cwd), path + process helpers,
               the HTTP/1.1 server core (`http`) behind every local server
  context      context, doctor, staleness, signals, concept-seed, pin, ...
  hook         the design hook (hook, hook-before-edit, hook-admin)
  live         live mode: server, wrap, accept, manual edits, Svelte/Vue
  skills       install / update / check / link (the old npm CLI verbs)
  comp         comp-fidelity pure libs (raster, png, metrics, fonts)
  comp-verbs   build-phase, comp-diff, comp-spec, font-match
  detect       `anti-design detect`: file walk, config, ignores, output, regex engine
  html         the static HTML engine: parser, cascade, static DOM, rule adapters
  browser      the URL engine: Chrome discovery, CDP, snapshot, visual pass
  aad-rules    Anti-Design's own rules (aad-*), shipped as a rule pack (added by the fork)
  foundation   JS-semantics helpers, color, findings, the rule registry, inline
               ignores, the Dom trait, SnapshotDom, and the plain-data types
               every check takes in and hands back
  core         the rule logic: every `check_*` / `scan_*` and its heuristics,
               the browser rule adapters, the visual-contrast decisions
  wasm         wasm-bindgen exports over `core` (the in-page bundle and the
               extension's offscreen core)
  bundle       the page JS plus the bundler: in-page bundle, extension
               pieces, registry JSON, the wasm-pack call
  xtask        `cargo xtask bundle`: the workspace's caller of `bundle`
```

`crates/core` re-exports the foundation modules under its own paths, so every
consumer names one crate: `anti_design_core::js`, `anti_design_core::color`,
`anti_design_core::checks::rules::check_colors`,
`anti_design_core::browser::driver::collect_browser_findings`. The split
between the two crates is about what a check is written against, not about
who may see it.

Build and test:

```bash
cargo build --release -p anti-design      # target/release/anti-design
cargo test --workspace
ANTI_DESIGN_BIN=target/release/anti-design node tests/oracle/run.mjs   # the behavior gate
```

`bun run test` and the oracle find the binary through `ANTI_DESIGN_BIN`, then
`skill/scripts/bin/<os>-<arch>/` (`bun run fetch:engine` downloads the pinned
release there; `ANTI_DESIGN_BIN=target/release/anti-design bun run fetch:engine`
copies a local build), then `target/release/anti-design`, so a plain
`cargo build --release -p anti-design` is enough.

Every local server the engine runs (`live-server`, the `serve-question`
decision page, `component-review serve`) is built on `anti_design_common::http`:
a `TcpListener`, one thread per connection, request parsing with a body cap,
and responses that close their connection. The live server drives connections
itself (turnstile ordering, SSE, parked polls); the other two take requests one
at a time from `SerialServer`, so their handlers stay single-threaded while no
connection waits on another to be read. That replaced tiny_http, whose 0.12
pool could leave part of a browser's connection burst unanswered (#1071). Add
new servers on the same core rather than another HTTP crate.

The frozen function-level vectors in `tests/oracle/vectors/calls/` replay
through `anti_design_core::vectors::call` (`cargo test -p anti-design-core`),
which is the union of foundation's dispatch arms and the core's.

## The browser bundle

The same rules that run natively run in a page, compiled to WebAssembly.
`cargo xtask bundle` is the one command that produces every browser artifact:

1. `wasm-pack build crates/wasm --target no-modules --release` into
   `target/wasm-bundle/` (opt-level `z`, then `wasm-opt`).
2. Concatenate the page JS in `browser-bundle/*.js` in a fixed order with the
   wasm-bindgen glue and the `.wasm` embedded as base64. The page JS only
   implements the `Dom` probe, marshals JSON, and draws the overlay; no rule
   logic lives there.
3. Write `dist/detect-antipatterns-browser.js` and `dist/antipatterns.json`,
   and copy both into **`crates/live/assets/`**. Those two copies are tracked
   generated files. `crates/live/src/browser_assets.rs` embeds the bundle with
   `include_str!` and the live server hands it to the browser as `/detect.js`,
   so the binary has to carry it. `antipatterns.json` is the registry
   (`[{ id, name, category, description }]`, plus `severity` on a row that
   declares one, such as `"advisory"`) that a consumer working from a
   source checkout or a repo tarball reads without a Rust toolchain, since
   `extension/detector/` is gitignored; anti-design.example counts and renders
   the rules from it.
4. Write the five extension pieces into `extension/detector/`
   (`snapshot.js`, `overlay.js`, `core.js`, `core_bg.wasm`,
   `antipatterns.json`). That directory is gitignored;
   `bun run build:extension` runs this task and then packages the zips.

`cargo xtask bundle --check` rebuilds and fails when either tracked asset is
stale, which is the CI staleness gate. The build is deterministic: same
sources, same bytes.

`wasm-pack` is the one extra tool this needs (`cargo install wasm-pack
--locked`) plus the `wasm32-unknown-unknown` target, which
`rust-toolchain.toml` requests. `ANTI_DESIGN_BUNDLE_SKIP_WASM_PACK=1` reuses
whatever is already in `target/wasm-bundle/`, for iterating on the page JS
alone. `ANTI_DESIGN_EXTENSION_SKIP_BUNDLE=1` lets `bun run build:extension`
skip the bundle step when `extension/detector/` is already complete, for CI
matrices that pre-built it.

Run `cargo xtask bundle` after touching `crates/core`, `crates/foundation`,
`crates/wasm`, or `browser-bundle/`, and commit the refreshed assets.

### Reusing the bundler downstream

None of that lives in the task. `anti-design-bundle` (`crates/bundle`) embeds
`browser-bundle/*.js` with `include_str!` and owns the assembly, so a crate
that links `anti-design-core` + `anti-design-wasm` plus its own rule pack into
one wasm module builds the same artifacts for that module without copying a
file out of this repo:

```rust
let (glue, wasm) = anti_design_bundle::wasm_pack_build(
    Path::new("crates/my-wasm"),      // engine + pack, not crates/wasm
    Path::new("target/wasm-bundle"),
    &[],                              // extra cargo args, after `--`
)?;
let js = anti_design_bundle::in_page_bundle(&glue, &wasm);   // /detect.js
let registry = anti_design_bundle::registry_json();          // built-ins + pack rows
let ext = anti_design_bundle::extension_pieces(&glue, &wasm, &registry);
anti_design_bundle::check_capture_contract()?;               // snapshot/core drift
```

Nothing there writes files or exits: the caller places the bytes and reports
its own failures. The pack's registry rows appear in `registry_json` once the
pack is installed, since the registry reads built-ins plus every registered
slice. `ANTI_DESIGN_BUNDLE_SKIP_WASM_PACK=1` is the library's name for the
skip switch (the old `ANTI_DESIGN_XTASK_SKIP_WASM_PACK=1` still works).

## Rule packs

The built-in rules are compiled in and always run. A **rule pack** is how a
crate that depends on this workspace adds rules of its own without forking it:
one process-lifetime value carrying its own registry rows plus the hooks it
has rules for. With no pack installed nothing changes, which the oracle
enforces byte-for-byte.

The traits:

- `anti_design_core::rule_pack::RulePack` (object-safe, `Send + Sync + Debug`)
  with three hooks, each defaulting to empty: `check_text(content, file_path,
  ext)` for the text engine, `check_element_dom(dom, el)` and
  `check_page_dom(dom)` for the browser engines.
- `anti_design_html::StaticRulePack` with `check_document(doc, file_path)`.
  The `StaticDocument` model belongs to `crates/html`, and `detect` cannot
  name a type from a crate that depends on it, so the static engine's hook is
  a separate trait. A pack that covers HTML implements both.

Three steps for the downstream crate: declare `static ROWS: &[Antipattern]`
with namespaced ids (`mypack/my-rule`) and return them from `registry()`;
call `anti_design_core::rule_pack::install(&PACK)` once at startup, which is
what makes `get_antipattern` resolve the pack's ids and therefore what gives
its findings a name, description, category, and severity; then pass the pack
to the engine being run.

Where a pack reference travels:

| Engine | Field |
|---|---|
| text | `TextOptions.rule_pack`, `ScanOptions.rule_pack` |
| static HTML | `DetectHtmlOptions.static_rule_pack` and `.rule_pack`; `StaticHtmlEngine.static_rule_pack` for the `Engines` seam |
| browser / snapshot | `BrowserConfig.rule_pack` (`#[serde(skip)]`: a pack is a Rust value, never JSON from the page) |

Where each hook runs, and why there:

- **Text engine** (`detect_text`): after every built-in matcher, style-block
  and CSS-in-JS pass, the design-system scan, the dedupe, and the page
  analyzers, and before inline ignores. Appending last keeps built-in output
  identical, and being inside the waiver step means `anti-design-disable`
  covers a pack's rules the same way it covers built-in ones.
- **Static HTML engine** (`detect_html_source`): after the element rules, the
  design-system merge, the page-level checks and the pattern checks, again
  just before inline ignores. An HTML file gets exactly one pack pass:
  `static_rule_pack` when it is set, otherwise `rule_pack.check_text` over
  the raw HTML source, which is how a text-only pack still covers `.html`
  files. A pack that implements both never reports the same file twice.
- **Browser driver** (`collect_browser_findings`): `check_element_dom` runs
  at the end of the driver's per-element loop, through the same
  disabled-rules filter and grouped onto the same element as the built-in
  findings; `check_page_dom` runs after every built-in page pass, attributed
  like the built-in checks that name their own element (`el: None` means
  `document.body`). `skipScan` skips the pack too.

The registry keeps `ANTIPATTERNS` as the built-in list and consults the
registered rows after it (`registry::extend`, `registry::all_antipatterns`).
`extend` is idempotent per slice and panics on an id collision, so a pack can
never shadow a built-in rule. Registration is append-only and has no undo:
a pack is a property of the process, not of a run.

### The wasm `detect` feature

`crates/wasm` builds with `--features detect` for hosts that cannot exec the
binary (Cloudflare Workers and other wasm sandboxes). It adds two exports
over the file-scanning engines, JSON in and JSON out:

- `detect_text_json(content, file_path, options_json)`
- `detect_html_source_json(html, file_path, options_json)`

Both take `{ inlineIgnores?: boolean, designSystem?: { frontmatter?, sidecar? } }`
and return the findings array `anti-design detect --json` prints, same keys and
same order. `designSystem` carries the DESIGN.md inputs rather than a
normalized object, because the JS API's normalized form used `Set`s and
`Map`s that JSON cannot hold. Unparseable options fall back to the defaults.
`antipatterns_json()` lists the built-ins followed by any pack's rows, and
`immediate_tier_rules_json()` returns the design hook's immediate tier (the
rule ids worth fixing at the edit site). That list lives in
`anti_design_core::registry::IMMEDIATE_TIER_RULES`, which `anti-design-hook`
re-exports, so a wasm consumer reads the same one the hook runs on instead of
keeping a copy.

A pack reaches those exports through `anti_design_wasm::set_rule_pack` and
`exports_detect::set_static_rule_pack`, both Rust-only: the consumer is a
crate that links `anti-design-wasm` as an rlib, registers its pack, and runs
`wasm-pack` over itself. There is deliberately no JS-facing setter.

```bash
cargo build -p anti-design-wasm --features detect --target wasm32-unknown-unknown --release
```

Pristine (the PR design-review bot) is the first consumer: its `rules/` crate
carries `pristine/*` rules on all three hooks and reaches the engine through
this feature, replacing the `detectText` call it makes into the npm
`anti-design@3` package today.

## Releases

The release channel is **GitHub Releases of `Choxie77/anti-ai-design`**. Every
workflow named below lives in the repository's root `.github/workflows/`
(GitHub does not run workflows from `anti-design-skill/.github/`). Remote skill
ZIPs require a pinned-key signature before extraction; see
[bundle signing](BUNDLE-SIGNING.md) for the key and the secret to store.

Two release kinds touch the runtime, in this order:

1. **Engine** (`engine-v<ENGINE_VERSION>`). The flow:
   1. Bump `ENGINE_VERSION` and the five `optionalDependencies` pins in
      `package.json` together. Use a version that has never been released
      under this name: the digests currently in
      `skill/scripts/engine-checksums.txt` belong to binaries built before the
      fork, so the same version would verify against the wrong bytes.
   2. Merge to `main` with the tests green, then `bun run release:engine`
      (`scripts/release.mjs engine`). It verifies the version, the pins and a
      clean pushed tree, then tags `engine-v<X>` and pushes the tag. Use
      `-- --dry-run` to see the plan without tagging.
   3. `.github/workflows/release-engine.yml` builds darwin arm64/x64, linux
      x64/arm64 (musl) and windows x64, smokes the native ones with
      `engine-probe`, and publishes the release `engine-v<X>` with each
      `anti-design-<os>-<arch>[.exe]`, its `.sha256`, and
      `engine-checksums.txt` generated from those exact files
      (`check-engine-release.mjs --from-dir`). A manual run builds and smokes
      without publishing. The Windows binary is not Authenticode-signed.
   4. Copy `engine-checksums.txt` from the release into
      `skill/scripts/engine-checksums.txt` (or run `bun run release:checksums`,
      which downloads the five binaries and hashes them) and commit it. The launcher, the npm shim and
      `anti-design install` download from
      `github.com/Choxie77/anti-ai-design/releases/download/engine-v<X>/` and
      verify each binary against that file, never the `.sha256` sidecar.
      `scripts/fetch-engine.mjs` defines the repository, download base and npm
      scope in one place (`RELEASE_REPO`, `DEFAULT_DOWNLOAD_BASE`,
      `NPM_SCOPE`).
2. **npm platform packages** (`@anti-ai-design/cli-<os>-<arch>`):
   `bun run release:platform-packages` (never run unattended; `-- --dry-run`
   stages and `npm publish --dry-run`s without publishing). Then the **skill**
   release: push the tag `v<skill version>`; `.github/workflows/release.yml`
   verifies the engine release and manifest
   (`check-engine-release.mjs --no-npm`), builds, signs and publishes
   `universal.zip` + `universal.zip.sig.json` as the release `skill-v<version>`.
   `scripts/check-engine-release.mjs` (without `--no-npm`) is the strict gate
   that `release.mjs skill|cli` applies.

The extension ships its own vendored WASM core and never execs the engine
binary, so `bun run release:ext` is exempt from that gate. It does need
`bun run build:extension` (and therefore a Rust toolchain and `wasm-pack`)
before the zip is attached.

`.github/workflows/test.yml` runs the core suite, `cargo build` / `cargo test`
on Linux and Windows, and the oracle replay against a release build from the
checkout under test, on every pull request and push to `main`.
