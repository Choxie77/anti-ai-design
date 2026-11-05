# Command surface of the reference tool

Source: pages captured on 2026-11-04 into `docs/research/raw/` (see `SOURCES.md`). This file is our own
summary in our own words. It describes *what the reference tool does*, so we can decide what our product
(Anti-AI Design, see `docs/spec/originality.md`) should offer. Nothing here is copied prose.

## How the reference tool is shaped

- It is an **agent skill**, not a standalone program. Almost every command is a slash command typed into an
  AI coding agent (`/impeccable polish the checkout page`). The agent does the editing.
- It also ships a small **terminal detector** (`npx impeccable detect ...`) that scans source files or a
  rendered URL with fixed rules and needs no AI conversation. This is the only part that runs on its own.
- Every command is told which page or flow to work on, in plain language. There are no documented
  per-command flags except on the detector, on `document`, and on `generate`.
- "Mutates files" below means the command edits the user's project. Reports saved under the tool's own
  folder are a footprint, not a mutation of project source.

**Consequence for us.** Our product has to run without an agent. So every command needs a deterministic
core (rules, findings, safe mechanical fixes) and, where judgment is needed, a clearly separated
"suggestion" output that a human or an agent can act on. See "Design notes for our version" at the end.

## polish

- **Purpose:** take a page whose direction is right and finish it: spacing, typography, alignment,
  interaction states, copy, and consistency with the project's design system.
- **Inputs:** a named page or component, plus things to keep ("keep the layout and brand colors").
  Can reuse findings from a saved critique.
- **Flags:** none documented.
- **Outputs:** edited source. Blocking defects first, then missing loading/empty/error states, focus and
  touch behavior, visual details.
- **Mutates files:** yes.
- **Notes:** does not change the visual identity; for a new arrangement use `layout`.

## typeset

- **Purpose:** make text readable and consistent: font roles, hierarchy, size, line length, line height,
  and behavior under zoom or large text settings.
- **Inputs:** a page or group of pages, plus fonts to keep.
- **Flags:** none documented.
- **Outputs:** edited styles. Keeps established brand fonts unless asked to change identity; often a
  weight or spacing adjustment is enough.
- **Mutates files:** yes.
- **Pairs with:** `bolder`, `polish`.

## distill

- **Purpose:** reduce clutter around the main task: drop repetition, group related controls, move
  occasional options behind a disclosure, make repeated elements uniform.
- **Inputs:** a page plus what the user must be able to do and what must stay. If the main task is
  unclear it asks before cutting.
- **Flags:** none documented.
- **Outputs:** edited markup and styles. Clear labels, interaction states and decision information must
  survive.
- **Mutates files:** yes.
- **Pairs with:** `quieter`, `polish`.

## critique

- **Purpose:** explain why a page feels generic, confusing, or hard to use, and what to fix first.
- **Inputs:** a page or flow; optionally the main task and what is unfinished.
- **Flags:** none documented.
- **Outputs:** a report with design-quality notes, usability scores (0 to 4 per check, `n/a` allowed),
  simulated user walkthroughs, and priorities (strengths, issues, open questions). Combines human-style
  judgment with the detector's findings; inspects the rendered page when a browser is available.
- **Mutates files:** no project source. Saves a snapshot report in the tool's folder
  (`.impeccable/critique/<timestamp>__<slug>.md`) that later runs can reference.
- **Leads to:** `polish`, `distill`, `bolder`, `quieter`, `typeset`, `layout`.

## audit

- **Purpose:** check whether the implementation holds up in use: keyboard access, contrast, dark mode,
  small screens, performance.
- **Inputs:** a page, component or flow.
- **Flags:** none documented.
- **Outputs:** a report sorted by severity P0 (blocking) to P3 (polish), each finding with location,
  effect on the user and a fix. Web areas: accessibility, performance, theming, responsive behavior,
  implementation integrity; each scored 0 to 4, total out of 20. Native apps use platform-specific checks.
- **Mutates files:** no.
- **Leads to:** `harden`, `optimize`, `adapt`, `clarify`.

## live

- **Purpose:** visual iteration on a running web page: pick an element, describe a change, compare
  several variants in the page, accept one or discard.
- **Inputs:** a running dev server or local static HTML. Beta. Needs a helper connection and possibly a
  CSP change (asks first). Web only.
- **Flags:** none documented; defaults to 3 variants. "Steer" gives page-wide direction without picking.
- **Outputs:** temporary preview code in the page; on Accept the chosen variant is written to source and
  the preview code removed; on Discard the original is restored. Session records allow resuming.
- **Mutates files:** yes, on Accept only.
- **Pairs with:** `generate`.

## generate

- **Purpose:** the chat-driven entry into the same variant comparison: name the element and direction,
  get alternatives to cycle through in the browser.
- **Inputs:** element ("the pricing cards"), direction (bolder, quieter, simpler, typography, color,
  layout, motion...), count 1 to 8 (default 3). Vague asks like "better" trigger a question.
- **Flags:** count and direction are the only parameters.
- **Outputs:** same as `live`. Variants keep the existing identity by default.
- **Mutates files:** yes, on Accept only. Does not require PRODUCT.md or DESIGN.md.

## document

- **Purpose:** record the project's existing visual system so future work follows it.
- **Inputs:** the project (tokens, styles, components, rendered page when possible). Asks before
  overwriting an existing DESIGN.md.
- **Flags:** `--seed` starts a new project's visual direction (marked as a seed, no finished token
  library, no metadata file yet).
- **Outputs:** `DESIGN.md` (YAML frontmatter tokens plus eight prose sections) and a generated
  companion `.impeccable/design.json`.
- **Mutates files:** writes the context files only, not UI source.
- **Combines with:** `init`, `extract`.

## Additional commands found on the site

| Command | One-line purpose | Mutates source |
|---|---|---|
| `impeccable` (root) | Free-form entry: describe what to make or improve; routes to the rest | depends |
| `shape` | Turn an idea into a design brief before building | no (writes a brief) |
| `init` | Save product context (audience, goals, platform, constraints) to PRODUCT.md | no (writes context) |
| `animate` | Use motion to clarify changes and feedback | yes |
| `bolder` | Give a section more presence, staying on brand | yes |
| `quieter` | Reduce visual noise, keep personality | yes |
| `colorize` | Use color to clarify actions, states and character | yes |
| `delight` | Add memorable moments | yes |
| `layout` | Rearrange so people know where to look and what belongs together | yes |
| `overdrive` | Push past the expected | yes |
| `adapt` | Make a design work on another screen, device or platform | yes |
| `clarify` | Improve wording so people know what happened and what to do next | yes |
| `harden` | Make the interface survive bad data, connections and failed actions | yes |
| `onboard` | Help new users reach a first useful result | yes |
| `optimize` | Find what makes it slow, fix it, measure | yes |
| `extract` | Turn repeated UI patterns into shared components and styles | yes |
| `doctor` | Check that saved context, config and hooks still fit the project; repairs mechanical issues | config only |
| `hooks on/off/status` | Run the detector automatically while an agent edits UI files | config only |
| `ignores ...` | Manage detector exceptions (see `context-files.md`) | config only |
| `detect` | Terminal scan of files or a URL | no |

### The detector CLI (the one standalone piece)

- Targets: a folder, a file, a URL, or piped stdin.
- Flags observed: `--json`, `--quiet`, `--no-advisory`, `--no-design-system`, `--no-inline-ignores`,
  `--no-config`, `--viewport WxH` (URL scans, default 1280x800), `--scope <domain[,domain]>`.
- Output: human text on stderr, JSON on stdout.
- Exit codes: `0` no primary findings, `2` primary findings, `1` a target could not be scanned.
  Advisories never change the exit code.
- Source checks cover JSX, TSX, Vue, Svelte, Astro, HTML (with linked local CSS) and stylesheets.
  Extra template extensions can be declared in config.

## Design notes for our version

1. **Detect first, always.** `audit` and `critique` are our two read-only commands; both are built on one
   shared detector. Everything else consumes its findings.
2. **Split every rewrite command into two tiers.** Tier 1: mechanical fixes that are safe to apply
   automatically (for example replacing a gradient text rule with a solid color, adding
   `text-wrap: balance`, setting a minimum line height). Tier 2: judgment changes that we only describe
   as a suggestion with a before/after sketch, for a human or an agent to apply.
3. **Mutation must be explicit.** Rewrite commands default to a dry run that prints a diff; `--write`
   applies it. This is a product decision of ours, not something the reference tool documents.
4. **Variants (`generate`, `live`)** are the heaviest feature. Treat them as a later phase; the baseline
   is the detector plus `audit`, `critique`, `init`, `document`.
5. **Context files are inputs, not decoration.** Commands read PRODUCT.md and DESIGN.md when present and
   behave sensibly (with a notice) when they are absent.
