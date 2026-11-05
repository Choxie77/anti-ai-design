# Runtime environment the binary reads (context crate)

The JS scripts learned two things from their own file location that a single
binary cannot: which harness built them (`lib/provider.mjs`) and where the
skill's `reference/` and `SKILL.md` live (`../reference`, `../SKILL.md`).
`crates/context/src/provider.rs` resolves both at run time.

| Variable | Meaning | Default |
|---|---|---|
| `ANTI_AI_DESIGN_SKILL_DIR` | The skill directory (holds `SKILL.md`, `reference/`, `scripts/`). Used for the native platform references `context` inlines, the local version in the update check, `pin`'s `command-metadata.json`, and `concept-seed`'s default catalog dir (`<skill>/scripts`). | Walk up from the executable's directory until a directory containing `reference/ios.md` is found (the binary ships at `<skill>/scripts/bin/<os>-<arch>/`). None if nothing matches: native refs are then skipped silently, like a missing file in the JS. |
| `ANTI_AI_DESIGN_PROVIDER_ID` | The build provider id (`claude-code`, `codex`, `cursor`, ...). Selects the hook manifest paths `context` and `doctor` inspect and the `$`/`/` command prefix (`$` only for `codex`). | Derived from the skill dir's harness folder (`<root>/.codex/skills/anti-ai-design` -> `codex`); otherwise `source`, which is what the JS reads in a source checkout. |
| `ANTI_AI_DESIGN_SELF` | How to spell this binary in printed commands where the JS printed `node <scripts>/<script>.mjs` (`context`'s MANUAL_DETECTOR_REQUIRED, IMAGE_GEN_AVAILABLE, SURFACE_CONTEXT_AVAILABLE, MONOREPO_TARGET_REQUIRED, `serve-question --start`'s follow-up line). Printed as `<self> <verb>`; a Windows `.cmd` path that has to be quoted (one containing spaces, or any quoted hook spelling) is printed as `& '<path>' <verb>` (a PowerShell literal, `'` doubled) so PowerShell runs it (`anti_ai_design_common::launcher`, #744). | The executable path. |
| `ANTI_AI_DESIGN_SEED_SALT` | Pins the salt seed references are computed under (`anti_ai_design_common::seed`), so tests and the oracle print stable references. Never set it in normal use: the per-user salt is what keeps a committed reference from being computed out of a key. | The contents of `~/.anti-ai-design/seed-salt`, 128 random bits created on first use. |
| `ANTI_AI_DESIGN_TELEMETRY_CHANNEL` | A lowercase word appended to `X-Anti-AI Design-Client` (`test` in this repo's tests and CI) so test traffic is tagged. | None. |

Everything else is the JS contract's own environment (`ANTI_AI_DESIGN_CONTEXT_DIR`,
`ANTI_AI_DESIGN_UPDATE_*`, `ANTI_AI_DESIGN_STALENESS_CACHE`, `ANTI_AI_DESIGN_CATALOG_DIR`,
`ANTI_AI_DESIGN_API_URL`, `ANTI_AI_DESIGN_IMAGE_GEN_FAKE`, ...), read unchanged.

The launcher (`launcher/anti-ai-design`) does not export these yet; a launcher that
sets `ANTI_AI_DESIGN_SKILL_DIR="$dir/.."` and `ANTI_AI_DESIGN_SELF="$0"` would make
directives name the launcher instead of the platform binary.

Oracle note: run the public repo's `tests/oracle/run.mjs` with
`ANTI_AI_DESIGN_SKILL_DIR=<public repo>/skill` (the corpus expects the native
references inlined) and an `ANTI_AI_DESIGN_BIN` path outside `$HOME` (the
harness normalizes `$HOME` before it normalizes the bin path, so a binary
under the home dir renders as `<HOME>/...` instead of `<ANTI_AI_DESIGN>`).
