# Contract diff: what the fork's CLI is vs. what `docs/spec/cli-schema.json` wished for

Task-47. Written 2026-11-05 against engine `0.1.18+engine`, built from this branch.
Every row below was checked by running the binary (`target/release/anti-ai-design`, the
debug binary for the fix tier later), not read from memory. The authoritative contract
is `anti-design-skill/docs/CLI-CONTRACT.md`; `docs/spec/cli-schema.json` is a wish list
written before we chose to fork and now says so in its `$comment`.

## 1. Short version

* The binary has **one scanner verb, `detect`**. All the design-work verbs in our wish
  list (`audit`, `critique`, `polish`, `typeset`, `distill`, `generate`, `document`,
  `init`) are **not binary verbs**. Eight of the nine are skill commands: Markdown
  playbooks in `skill/reference/*.md` that an AI agent follows, and `anti-ai-design pin`
  lists them (`craft, init, extract, document, shape, critique, audit, polish, ...,
  typeset, ..., generate`). `init` as a binary verb is a hard error with exit 1.
* `live` exists as a verb, with a different meaning: it prepares live variant mode and
  prints JSON (`{ ok, serverPort, ... }`); our wish list described a preview server with
  `--port/--watch/--stop`.
* Nothing in the binary writes to source files during a scan. The only fixers are
  `doctor --fix` (project migration files, tier `auto`) and the skill commands, which are
  done by the agent, not by code. **There is no safe-fix tier, no dry run, no `--write`
  and no run log for source edits.** That is the gap tasks 47 and 48 close.
* Unknown flags are **silently ignored** by `detect`, which is dangerous for a mutating
  flag: `anti-ai-design detect --write a.css` today scans and exits 2 as if nothing was
  asked. A fix tier must claim `--fix` and `--write` explicitly.

## 2. Commands

| Wish-list command | In the binary? | What actually happens (run) | Verdict |
|---|---|---|---|
| `detect` | **yes** | Scans files, dirs, URLs, `--cdp`. Findings on stderr, `--json` on stdout. | Keep. Extend, do not replace. |
| `audit` | no verb | `anti-ai-design audit` -> `Unknown command: "audit"`, exit 1. Skill command `skill/reference/audit.md` exists. | Stay a skill command. Not a CLI goal. |
| `critique` | no verb | Same, exit 1. Skill command `critique.md`. | Stay a skill command. |
| `polish` | no verb | Same, exit 1. Skill command `polish.md` (agent-driven refinement). | The *deterministic* half of polish is the safe-fix tier (section 5). |
| `typeset` | no verb | Same, exit 1. Skill command `typeset.md`. | Skill command. Maybe later a safe tier for font defaults. |
| `distill` | no verb | Same, exit 1. Skill command `distill.md`. | Skill command. |
| `generate` | no verb | Same, exit 1. Skill command `generate.md`; variants run through `live`. | Skill command. |
| `live` | **yes, different** | `live --help`: sets up live mode, starts server, prints JSON. Related verbs: `live-server`, `live-poll`, ... (`live*` prefix routes to `anti-ai-design-live`). | Keep fork behaviour. Drop our `--port/--watch/--stop` wish. |
| `document` | no verb | Same, exit 1. Skill command `document.md` writes DESIGN.md through the agent. | Skill command. |
| `init` | no verb, **error** | Prints `"init" is not a CLI command. Type /anti-ai-design init in your AI coding agent's chat`, exit 1. | Skill command. |

Verbs the fork has that our schema never listed (from `crates/cli/src/main.rs` dispatch and
the root help): `ignores`, `skills`, `help`, `install`, `link`, `update`, `check`,
`telemetry`, `context`, `pin`, `doctor`, `palette`, `signals`, `surface-brief`,
`critique-storage`, `embed-prompt`, `concept-seed`, `generate-image`, `serve-question`,
`component-review`, `comp-spec`, `comp-diff`, `font-match`, `capture-server`,
`build-phase`, `hook`, `hook-before-edit`, `hooks`, `detect-csp`, `live*`.
`anti-ai-design --help` lists only eight of them; the rest are skill plumbing.

## 3. Global flags and `detect` flags

Tested as `anti-ai-design detect <flag> a.css` on a CSS file with one `gradient-text` finding.

| Wish-list flag | In the fork? | Observed | Verdict |
|---|---|---|---|
| `--help` / `-h` | yes | prints usage, exit 0 | same |
| `--version` / `-v` | root only | `anti-ai-design --version` -> `0.1.18+engine`; `detect -v a.css` -> `Warning: cannot access -v` | same at root; `-v` is not a detect flag |
| `--json` | yes | JSON array of findings on stdout | **differs**: bare array of `{antipattern,name,description,severity,category,file,line,snippet}`, not `{findings,counts,score,filesScanned}` |
| `--quiet` / `-q` | `--quiet` yes, `-q` no | `-q` -> `Warning: cannot access -q`, exit 1 | `--quiet` same; no short form |
| `--no-color` | **no** | ignored, exit 2 | not wanted: output is already colorless off a TTY |
| `--cwd` | **no** | `--cwd=.` ignored; `--cwd /tmp` treats `/tmp` as a target, exit 1 | drop |
| `--no-config` | yes | per contract | same |
| `--no-inline-ignores` | yes | per contract (`anti-ai-design-disable*` comments) | same, comment name differs |
| `--scope` | yes, **different values** | `--scope bogus` -> `unknown --scope value(s): bogus. Valid scopes: type, layout`, exit 1 | we wished nine domains; fork has `type`, `layout` |
| `--fail-on` | **no** | `--fail-on high` ignored (and `high` is scanned as a path) | not in the fork. Wanted? Not now: advisory vs primary already gates exit 2 |
| `--no-design-system` | yes | in `detect --help` | same |
| `--no-advisory` | yes | in `detect --help` | same |
| `--write` | **no** | silently ignored, exit 2 | **wanted** (section 5) |
| `--dry-run`, `--save`, `--keep`, `--rules`, `--accept`, `--discard`, `--count`, `--direction`, `--seed`, `--force`, `--yes`, `--platform` | no | all silently ignored by `detect` | belong to skill commands, not the binary |

Fork-only `detect` flags: `--github`, `--list-rules`, `--viewport`, `--cdp`, `--target`,
`--no-consent-hiding`, `--no-overlay-hiding`, plus deprecated `--fast`, `--gpt`, `--gemini`.

### Exit codes

| Wish list | Fork (`detect --help`, verified) |
|---|---|
| 0 clean | 0 no primary findings (advisories may print) |
| 1 runtime failure | 1 a target could not be scanned; **also** unknown command and bad usage (`audit`, `init`, `--scope bogus` all exit 1) |
| 2 findings, **or** invalid usage | 2 primary findings only |

Usage errors are exit 1 in the fork, not 2. The fork wins; the schema's exit-code row is
wrong for us.

### Finding shape

| Wish list | Fork |
|---|---|
| `ruleId`, `domain`, `kind`, `severity high|medium|low`, `check`, `column`, `suggestion`, `fix` | `antipattern`, `category`, `severity` (`warning|advisory|error`), `description`, `snippet`, `line` (0 for static-HTML/browser findings), optional `advisory`, `selector`, `ignoreValue`, `importedBy` |

Key order is pinned by the oracle goldens, so `Finding` must not grow a `fix` field. The
fix tier lives beside the finding, not in it (section 5).

### Context folder

Our wish list says `.anti-ai-design/`; the fork uses `.anti-ai-design/` (`config.json`,
`design.json`, `live/`). New code keeps the name in one constant.

## 4. What we want from the wish list

| Wanted | Where it stands |
|---|---|
| Dry run by default for anything that edits | **Missing.** Needed for the fix tier. |
| `--write` to apply | **Missing.** `--write` is silently ignored today. |
| Append-only run log | **Missing.** The fork has no changelog or footprint module (searched `crates/` for `changelog`/`footprint`; only unrelated text hits). `.anti-ai-design/` holds config, design sidecar and live files only. |
| Unified diff as the dry-run output | **Missing.** |
| `fix: { tier: 'safe'|'manual' }` on findings | Cannot go on `Finding` (oracle). Kept as a separate fix registry. |
| `--fail-on`, `--no-color`, `--cwd`, 9-domain `--scope`, `audit`/`critique`/... as binary verbs | Not wanted in the engine now. Skill commands cover the agent-facing ones. |

## 5. Smallest design for a safe-fix tier

**Principle.** A fix is "safe" when it is a mechanical text rewrite that keeps behaviour and
layout, needs no taste decision, and can be reversed by reading the diff. Everything else
stays advice.

1. **Opt in, never by default.** `anti-ai-design detect --fix <target>` enters fix mode;
   `--write` applies. Without `--write` it is a **dry run**: it prints a unified diff on
   stdout, a one-line summary on stderr, and touches nothing (no source, no log, no
   folder). `--write` alone implies `--fix`. Plain `detect` is unchanged byte for byte,
   so the oracle is untouched.
2. **Fixes follow findings.** Fix mode first runs the normal `detect --json` over the same
   arguments (so config ignores, inline `anti-ai-design-disable` comments and DESIGN.md
   apply for free), keeps only findings whose rule has a registered fix, and offers a fix
   only where the finding is: a file-level finding (line 0, static HTML) allows any
   matching block in that file; a line-numbered finding allows the block that contains
   that line.
3. **Fix registry, pure functions.** Each fix is `fn(content, ext) -> Vec<Edit>` in
   `crates/aad-rules/src/safe_fix.rs`, no I/O, no dependency on the detector. First fix:
   `gradient-text` to a solid colour. The rewritten text is the whole file; a small line
   diff (own implementation, context 3, no new crate and no `Cargo.lock` change) renders
   the unified diff.
4. **A fix declines when unsure.** No parsable colour in the gradient, a variant-prefixed
   Tailwind class, a `var()` gradient: no edit, the finding stays advice.
5. **Run log.** On `--write` only, each applied fix appends one line to
   `<cwd>/.anti-ai-design/changelog.md` (folder name in one constant; created with a short
   header on first use). Append-only: never rewritten, never trimmed.
   Idempotence needs no dedup table: once applied, the finding is gone, so a second run
   finds no fix, writes nothing and logs nothing.
6. **Exit code.** Fix mode exits 0 when it ran (preview or write), 1 if a file could not be
   read or written. It does not use exit 2: the point of the run is to resolve findings,
   and unfixed findings are already reported by plain `detect`.
7. **Out of scope on purpose:** `--json` for fix mode, URL and `--cdp` targets (no file to
   write), a `fix` field on `Finding`, undo, and fixes that need judgment (typography,
   spacing, copy).
