# Building the engine (task-43)

Built 2026-11-05 on macOS (Darwin 24.1.0, Apple silicon).

| Tool | Version | Installed with |
|---|---|---|
| Rust (cargo, rustc) | 1.99.1 stable (aarch64-apple-darwin) | official `rustup` script, minimal profile; adds `~/.cargo/bin` to the shell env |
| Bun | 1.4.4 | official installer; at `~/.bun/bin`, shell profile not edited |
| Node | v24.22.2 | already present (nvm) |

## Build

```bash
cd anti-design-skill
. "$HOME/.cargo/env"
cargo build --release -p anti-ai-design
```

Result: `anti-design-skill/target/release/anti-ai-design`, 18 MB, built in 2m 34s from a clean target dir.
`--version` prints `0.1.18+engine`.

Use it locally without the (placeholder) download location:

```bash
export ANTI_AI_DESIGN_BIN="$PWD/anti-design-skill/target/release/anti-ai-design"
```

## Smoke test

A 2-line CSS file with gradient text, a colored side stripe and `font-family: Inter` produced 3 findings
(`gradient-text`, `side-tab`, `overused-font`) and exit code 2, as the contract says. For a `.css` file the
engine uses regex matching only and warns that element-level rules did not run, so counts are an undercount;
full checks need a parsed `.html` file or a running URL.

## Notes

- The pinned-binary download (`ENGINE_VERSION` 0.1.18) points at the placeholder `Choxie77/anti-ai-design`, so
  installs from the launcher cannot fetch a binary until task-42 sets a real release location. Local builds
  do not need it.
- Running tests and the Bun build scripts is task-44.
