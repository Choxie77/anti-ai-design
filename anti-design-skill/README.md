# Anti-Design

The design vocabulary for your coding agent. Steer with `polish` and `bolder`, review with `critique` and `audit`, and catch AI slop before it ships.

From your project root:

```bash
npx anti-design install
```

Reload your coding tool, then run `/anti-design init` in your agent (`$anti-design init` on Codex).

Works with Claude Code, Cursor, Codex CLI, GitHub Copilot, Devin, Replit Agent, Gemini CLI, Grok Build, OpenCode, Google Antigravity, Kiro, Trae, Rovo Dev, Qoder, Mistral Vibe, Pi, Hermes Agent, DeepSeek Harness, and Veto. Full docs live at [anti-design.example/docs](https://anti-design.example/docs).

| Without Anti-Design | With Anti-Design |
|---|---|
| ![Villa Castagneto built without Anti-Design: cream background, a thin serif headline with an italic accent, two pill buttons, and flat vector illustrations in rounded cards](https://github.com/OWNER/anti-design/raw/main/docs/images/readme-without.webp) | ![Villa Castagneto built with Anti-Design: a full-bleed engraved night scene of the villa on its cliff above the sea, a condensed cream and vermilion headline, and a month strip along the bottom](https://github.com/OWNER/anti-design/raw/main/docs/images/readme-with.webp) |

Same model (Fable 5.1), same brief: a fourteen-room family guesthouse on the Ligurian coast. Without Anti-Design, it builds the tasteful default: cream page, thin serif, italic accent, pill buttons. With it, the page is built around one picture: the house at night, seen from the water.

For a full project, see the [Neo Mirai case study](https://anti-design.example/cases/neo-mirai): a conference site taken from mockup to shipped page.

## Why

Inter for everything. Purple-to-blue gradients. Cards nested in cards, gray text on colored backgrounds, a rounded-square icon tile above every heading. Ask an agent for a page with no other guidance and these show up again and again, across models and projects.

- **Words for what you want.** "Make it pop" leaves your agent to guess. `/anti-design bolder the pricing cards` loads a playbook written for that one move and points it at one target.
- **A reviewer.** `critique` scores the design against usability heuristics and ranks what to fix first. `audit` checks accessibility, performance, theming, and responsive behavior, with findings ranked P0 (blocking) to P3 (polish).
- **A slop detector.** 62 deterministic rules flag the tells above, plus quality problems like cramped padding and skipped headings. No LLM, no API key.

Anti-Design is strongest on interfaces that already exist: point it at a page or a component and iterate. It builds new pages too; see [Build something new](https://anti-design.example/docs/new-work) for how to get the most out of that harder mode. To start, pick one component:

```
/anti-design critique the pricing cards
```

## How it works

Run `/anti-design init` once per project. It reads your code, asks only what it can't infer (who the product is for, what it needs to do, the constraints), and writes `PRODUCT.md`. Every later command reads it. Run `/anti-design document` to capture your existing visual system in `DESIGN.md`, so changes stay on-brand. [More on context files](https://anti-design.example/docs/context).

Then name a command and a target:

```
/anti-design critique the onboarding flow
/anti-design quieter the landing page
/anti-design polish settings
/anti-design harden checkout
```

Or just describe what you want: `/anti-design redo this hero section`. Narrow targets get better results; a single section reviewed closely beats a whole page at a glance. Pin a command you use often with `/anti-design pin audit` to get `/audit` as its own shortcut.

### 24 commands

| | Commands |
|---|---|
| **Steer** | `bolder` amplifies safe designs · `quieter` tones down loud ones · `distill` removes what the page doesn't need · `colorize` brings color to a gray interface · `typeset` fixes fonts, hierarchy, and sizing · `layout` fixes spacing and rhythm · `animate` adds transitions and interaction feedback · `delight` adds personality · `overdrive` goes for shaders, spring physics, and scroll-driven effects |
| **Review** | `critique` is a scored UX review · `audit` is a technical quality report |
| **Finish** | `polish` is the final pass before shipping · `harden` covers errors, i18n, overflow, and edge cases · `clarify` rewrites unclear copy · `adapt` handles screen sizes and devices · `optimize` fixes loading and rendering performance · `onboard` designs first-run flows and empty states |
| **Iterate live** | `live` lets you pick an element in the browser and cycle through variants · `generate` produces variants of a named element without manual picking |
| **Plan and set up** | `shape` plans UX before code · `init` writes `PRODUCT.md` · `document` writes `DESIGN.md` · `extract` pulls repeated patterns into your design system |

The 24th, `craft`, is a deprecated alias for a plain build request. Type `/anti-design` alone to see the list in your agent. Each command has its own page: [anti-design.example/docs](https://anti-design.example/docs).

On Codex, open `/skills` or type `$anti-design` instead of the slash command.

### Live mode

`/anti-design live` opens your running dev server with an overlay. Select an element, pick a direction, and Anti-Design hot-swaps variants in place. Accept one and it is written back to your source. It works with Vite, Next, SvelteKit, Astro, Nuxt, and plain HTML. [Iterate in the browser](https://anti-design.example/tutorials/iterate-live).

Live mode edits a local checkout only; don't inject it into a deployed site or weaken a production CSP to make it work. Applying copy edits runs your `package.json`'s optional `anti-design:manual-edit-validate` script with your permissions, so review it before using live mode in an unfamiliar repo.

Apply sends staged copy edits to your chat agent while a live session is polling. If none has polled in the last minute, it runs the `codex` CLI from your PATH instead (or `claude` when codex is missing), with approvals, permission checks, and sandboxing off (`--dangerously-bypass-approvals-and-sandbox` or `--permission-mode bypassPermissions`) and your environment inherited. Its prompt carries the staged edits, the edited elements' HTML and nearby text, the page URL, and candidate source paths. Set `ANTI_DESIGN_LIVE_COPY_AGENT=chat` in the environment that starts live mode to keep Apply in your chat session, or `off` to disable Apply. The server reads it once at startup.

## Three ways to run the detector

**In your agent.** The design hook scans every UI file your agent edits and hands the findings back before the agent calls the work done. This is where most slop gets caught: without the hook, the detector only runs when someone remembers to run it. It's available on Claude Code, Cursor, Codex, GitHub Copilot, Grok Build, and Hermes Agent, and the installer sets it up. Say yes. [Automatic design checks](https://anti-design.example/docs/hooks).

**In CI or your terminal.** The CLI needs no agent:

```bash
npx anti-design detect src/                   # scan a directory
npx anti-design detect https://example.com    # scan a rendered page (uses your installed Chrome or Edge)
npx anti-design detect --json .               # machine-readable output
npx anti-design detect --github src/          # GitHub Actions annotations
npx anti-design detect --list-rules           # every rule with its id and description
```

Source files like JSX and TSX get the pattern rules only. Rules that need a rendered page, such as low contrast and tiny text, run when you scan a URL, so point the CLI at your dev server too: `npx anti-design detect http://localhost:5173`.

Exit code `2` means findings, `1` means a target couldn't be scanned. To allow your brand font everywhere, run `npx anti-design ignores add-value overused-font Inter --reason "Brand font"`. To turn a rule off for one file, add a comment: `<!-- anti-design-disable overused-font: exported brand doc -->`. [Run a detector scan](https://anti-design.example/docs/detector) · [Configuration and ignores](https://anti-design.example/docs/config).

**In your browser.** The [Chrome extension](https://chromewebstore.google.com/detail/anti-design/bdkgmiklpdmaojlpflclinlofgjfpabf) overlays the same findings on any live page, yours or anyone else's. [Review with a visual overlay](https://anti-design.example/tutorials/critique-with-overlay).

## Installation

```bash
npx anti-design install
```

The installer detects your coding tools, asks whether to install for this project or globally, and offers the design hook where your tool supports one. Accept the hook. Reload your tool afterward. `npx anti-design update` refreshes an existing install. For scripts, pass `--providers=claude,codex,cursor` and `--scope=project|global`.

Three tools need one more step before the hook runs. In Codex, open `/hooks` and approve the project hook (again after an update that changes it). In Grok Build, run `/hooks-trust` or launch with `--trust`. In Hermes Agent, the hook is a plugin: run `hermes plugins enable anti-design-design-hook` once. [Allow the hook in your harness](https://anti-design.example/docs/hooks#allow-the-hook-in-your-harness).

Node is only needed for `npx`. The skill itself runs a self-contained engine binary that ships next to it or downloads once into `~/.anti-design/bin/`.

<details>
<summary><b>Claude Code, Copilot, and Grok plugins</b></summary>

**Claude Code:** `/plugin marketplace add OWNER/anti-design`, then open `/plugin` and install Anti-Design.

**GitHub Copilot in VS Code:** install [Anti-Design from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=renaissance-geek.anti-design) or run `code --install-extension renaissance-geek.anti-design`. Needs VS Code 1.109.3+, Copilot Chat, and a trusted workspace. It installs the skill without the hook. [Details](docs/VSCODE-EXTENSION.md).

**Grok Build:** `grok plugin install OWNER/anti-design#plugin --trust` installs the skill, agents, and hook.

</details>

<details>
<summary><b>Git submodule (a pinned version for the whole team)</b></summary>

```bash
git submodule add https://github.com/OWNER/anti-design vendor/anti-design
npx anti-design link --source=vendor/anti-design --providers=claude,cursor
```

Commit `.gitmodules`, the submodule, and the generated links. Teammates run `git submodule update --init --recursive`. To upgrade, run `git submodule update --remote vendor/anti-design`, rerun the `link` command, and commit. Linking installs skills, not hooks. Existing skill folders stay put unless you pass `--force`.

</details>

<details>
<summary><b>Manual copy, no Node required</b></summary>

Download the ZIP for your tool from [anti-design.example](https://anti-design.example), or clone this repo: each tool's build is committed at the repo root. Copy `skills/anti-design` from the folder below into the same place in your project, or into the global folder.

| Tool | Repo folder | Global skills folder |
|---|---|---|
| Claude Code | `.claude/` | `~/.claude/skills/` |
| Cursor | `.cursor/` | |
| Codex CLI, Replit Agent | `.agents/` | `~/.agents/skills/` |
| Devin | `.devin/` | `${XDG_CONFIG_HOME:-$HOME/.config}/devin/skills/` |
| GitHub Copilot | `.github/` | |
| Gemini CLI | `.gemini/` | |
| Google Antigravity | `.agent/` | `~/.gemini/config/skills/` |
| OpenCode | `.opencode/` | |
| Grok Build | `.grok/` | `~/.grok/skills/` |
| Hermes Agent | `.hermes/` | `${HERMES_HOME:-$HOME/.hermes}/skills/` |
| DeepSeek Harness | `.dsh/` | `${DSH_HOME:-$HOME/.dsh}/skills/` |
| Pi | `.pi/` | |
| Qoder | `.qoder/` | `~/.qoder/skills/` |
| Rovo Dev | `.rovodev/` | `~/.rovodev/skills/` |
| Mistral Vibe | `.vibe/` | `~/.vibe/skills/` |
| Trae | `.trae/` | `~/.trae/skills/` |
| Trae China | `.trae-cn/` | `~/.trae-cn/skills/` |

For example: `mkdir -p your-project/.claude/skills && cp -r .claude/skills/anti-design your-project/.claude/skills/`.

Notes:
- A manual copy skips the design hook and subagents. Run `npx anti-design install` to get them; it writes each tool's hook pointing at the right skill path.
- OpenCode also needs `.opencode/commands/anti-design.md` copied into your project's `.opencode/commands/` to provide `/anti-design`.
- Hermes asks you to trust project-local skills once: run `hermes skills trust` from the project root. Global installs need no trust step.
- Cursor and Gemini CLI may need Agent Skills enabled in settings. See the [Cursor](https://cursor.com/docs/context/skills) and [Gemini CLI](https://geminicli.com/docs/cli/skills/) skills docs.
- Restart Trae after copying.
- `anti-design install` and `update` manage a DeepSeek Harness global copy only when `DSH_HOME` is inside your home directory.

</details>

## Project files and git

Anti-Design writes its working files under `.anti-design/`. A few are shared project artifacts and belong in the repo: `config.json`, `live/config.json`, `design.json`, `surfaces/*.md`, and `critique/*.md`. Keep `PRODUCT.md` and `DESIGN.md` in the repo too. The rest is screenshots, caches, and runtime state.

<details>
<summary><b>Copy the <code>.gitignore</code> entries</b></summary>

```gitignore
# anti-design-ignore-start
# Ephemeral output, runtime state, and per-dev overrides.
# The **/ prefix covers .anti-design at the repo root or in a nested workspace.
# Shared artifacts stay tracked: config.json, live/config.json,
# design.json, surfaces/*.md, critique/*.md.
**/.anti-design/config.local.json
**/.anti-design/hook.cache.json
**/.anti-design/hook.pending.json
**/.anti-design/*.png
**/.anti-design/review/
**/.anti-design/questions/
**/.anti-design/live/server.json
**/.anti-design/live/sessions/
**/.anti-design/live/previews/
**/.anti-design/live/annotations/
**/.anti-design/live/cache/
**/.anti-design/live/manual-edit-apply-transaction.json
**/.anti-design/live/manual-edit-events.jsonl
**/.anti-design/live/manual-edit-evidence/
**/.anti-design/live/pending-manual-edits.json
**/.anti-design/live/deferred-svelte-component-accepts.json
**/.anti-design/live/*.png
# anti-design-ignore-end
```

</details>

The folders that hold decision-round state (`.anti-design/questions/`, `.anti-design/mocks/worlds/`) also ignore themselves. A `.gitignore` can't untrack a file git already tracks; if you committed one earlier, run `git rm --cached <path>`.

## Good to know

**Build path.** For new landing pages and showcase surfaces, Anti-Design can generate a full-fidelity comp first and build to match it (bolder, slower), or build straight in code (leaner, faster). App screens and documents are always built in code. `init` asks once and saves the answer as `buildPath` in `.anti-design/config.json`; the decision page lets you override it for one session. The choice only appears when your harness can generate images. [Image generation](https://anti-design.example/docs/image-generation) · [Configuration](https://anti-design.example/docs/config).

**Hooks run outside model approval.** In Claude Code, installed command hooks run even when you deny the model's own commands, so the first edit can download the engine. Review installed hooks before unattended runs, or pass `--settings '{"disableAllHooks": true}'` to turn them off for a run. The installer leaves hook entries it didn't add alone.

**Something broken?** `/anti-design doctor` finds stale context files, unused settings, and broken hooks. [Fix setup problems](https://anti-design.example/docs/doctor).

**Telemetry.** When a new design starts, the skill fetches a set of visual directions from the anti-design.example catalog. Turning telemetry off doesn't stop that request; it stops the anonymous record of which directions were shown and which one you picked, which is how the catalog learns what works. Your project name, files, code, and `PRODUCT.md` are never sent. Disable telemetry with `npx anti-design telemetry off`, `DO_NOT_TRACK=1`, or `"telemetry": false` in `.anti-design/config.json` for the whole project. The full list of what is sent is on the [privacy page](https://anti-design.example/privacy).

## Community

- [Issues](https://github.com/OWNER/anti-design/issues) for bugs, questions, and ideas. Outside contributions start with an issue; see [DEVELOP.md](docs/DEVELOP.md).
- [Changelog](https://anti-design.example/changelog) for what shipped.

## License

Apache 2.0. See [LICENSE](LICENSE). Anti-Design started from Anthropic's [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) skill.

---

Anti-Design is a modified fork of [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus, used under Apache 2.0. See [NOTICE.md](NOTICE.md) and [UPSTREAM.md](UPSTREAM.md).
