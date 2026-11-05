# Context files and project footprint

How the reference tool stores what it knows about a project, and what a run leaves behind. Our own
summary from the pages captured on 2026-11-04, followed by what we will do differently. Names in the
"Ours" column are decided in `docs/spec/originality.md`.

## Why context files exist

Without knowing who a product serves and what the existing visual rules are, any design tool produces
generic output, which is exactly the thing we are trying to catch. The reference tool therefore keeps two
human-readable files at the project root and a small folder of generated or per-page data.

## PRODUCT.md

- **What it holds:** audience, their situation, the product's purpose, platform, constraints,
  terminology, and confirmed brand commitments. Unresolved facts are marked as open on purpose, so later
  work knows what evidence exists.
- **Who writes it:** the `init` command reads the project first (docs, features, code, assets), asks only
  about the gaps, and writes the agreed result. The user is expected to review and edit it by hand.
- **What it must not hold:** palette or font choices. Product context and visual design are separate.
- **Platform field:** a `## Platform` section with `web` (default when missing), `ios`, `android` or
  `adaptive`. It changes which guidance applies; native support is marked alpha and the web detector does
  not inspect native UI.
- **How commands consume it:** every command reads it before acting; it decides tone, priorities and what
  must be preserved. When it is stale, `doctor` flags it.

## DESIGN.md

- **What it holds:** the shared visual system. YAML frontmatter stores design tokens (named values such as
  `colors.action`); the Markdown body explains how to use them.
- **Body sections, in order:** Overview, Colors, Typography, Layout, Elevation and Depth, Shapes,
  Components, Do's and Don'ts. Irrelevant sections may be omitted; headings must stay so tools can find
  them.
- **Who writes it:** `document` reads tokens, styles, components and the rendered page, confirms intent
  with the user, then writes it. `document --seed` writes a marked starting record for a project that has
  no design yet. Existing files are shown and the user is asked before overwriting.
- **How commands consume it:** the detector checks that fonts, colors, corner radii and type sizes used in
  code exist in the documented system (the "drift" rules). Rewrite commands match new work to it.
- **Review rule:** a recorded rule can capture an accident; the user must prune one-off choices.

## Surrounding files

| File | Purpose | Hand-edited? | Shared via git? |
|---|---|---|---|
| `.impeccable/design.json` | Generated metadata: extra tokens, component previews | no | yes |
| `.impeccable/surfaces/*.md` | Per-page brief: purpose, chosen direction, resolved mode | yes | yes |
| `.impeccable/config.json` | Shared settings, detector ignores, extensions, project roots | yes | yes |
| `.impeccable/config.local.json` | One developer's overrides and private ignores | yes | no (git-excluded) |
| `.impeccable/critique/<timestamp>__<slug>.md` | Saved critique report (score, P0 to P3 issues) | no | optional |
| live session records | Let an interrupted live session resume | no | no |
| hook files in the agent's own config | Run the detector after UI edits | no | depends on tool |

### Page modes (a notable idea)

Each page is classified by what visitors come to do, and that picks the approach:
**persuade** (landing, pricing), **operate** (dashboards, settings), **read** (docs, help),
**experience** (portfolio, gallery). The same product can use different modes on different pages. The
resolved mode is stored with that page's brief.

### Where files are looked up

Order: project root, then `.agents/context/`, then `docs/`; the first location that has any context wins.
In a monorepo each app may have its own files; a missing file falls back to the repository root, resolved
separately for product and design context. Workspace boundaries come from `package.json` workspaces,
`pnpm-workspace.yaml` or `lerna.json`, or an explicit `projectRoots` list.

### Ignores (how intentional choices survive)

- Value ignore: allow one value for one rule (for example one brand font) while the rule stays active.
- File ignore: exclude a path glob from every rule (for deliberate bad-design fixtures).
- Rule ignore: turn one rule off project-wide.
- Inline comments: `disable` (whole file), `disable-line`, `disable-next-line`, optional reason.
- Shared by default, private with `--local`. Bypass flags exist for scans.

## The footprint of a run

What the reference tool leaves in a project, from the pages:

1. **Context files** at the root (`PRODUCT.md`, `DESIGN.md`) and the `.impeccable/` folder above.
2. **Saved critique reports** with timestamps, so later runs can reuse priority findings.
3. **Hook definitions** written into the agent's settings (`PostToolUse` and `Stop` in Claude Code).
4. **Source edits** from rewrite commands, reviewed by the user as an ordinary diff.

We did not find a per-run change log inside the project. The product publishes release notes (its public
changelog, 76 releases at capture time) split by skill, CLI and extension, but that is about the tool, not
about a user's project. The PRD item "changelog footprint" is therefore **our own design**.

## What we will do (ours)

- **Folder:** `.anti-ai-design/` instead of `.impeccable/`. Same split: `config.json` (shared),
  `config.local.json` (private), `surfaces/`, `reports/`, `design.json`.
- **Root files:** `PRODUCT.md` and `DESIGN.md` stay as the names, because they are generic conventions,
  but our templates, section wording and validators are written fresh.
- **Our run log:** every command that changes files appends one entry to
  `.anti-ai-design/changelog.md`: timestamp, command, rule IDs touched, files changed, counts, and a
  pointer to a saved patch under `.anti-ai-design/patches/`. This makes every automatic fix reviewable and
  reversible, which matters more for us because we may edit files without an agent in the loop.
- **Dry run by default** for any command that mutates source, with `--write` to apply.
- **Reports:** `audit` and `critique` save a report to `.anti-ai-design/reports/` only with `--save`;
  otherwise they print and leave nothing behind.
- **Idempotence:** running a rewrite twice must not produce a second change or a second changelog entry
  when nothing is left to fix (task-38 tests this).
- **Doctor-equivalent:** a later, optional `doctor` command validates config keys, rule IDs and context
  file formats.
