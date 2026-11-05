# Anti-AI Design CLI

Detect UI anti-patterns and design quality problems from the command line, and install the Anti-AI Design skill into your AI coding tool. The detector scans HTML, CSS, JSX, TSX, Vue and Svelte files with a fixed set of rules (no model, no API key) for patterns that mark AI-generated interfaces, accessibility problems and general quality issues.

Anti-AI Design is a modified fork of [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus, used under the Apache License 2.0. See [UPSTREAM.md](https://github.com/Choxie77/anti-ai-design/blob/main/anti-design-skill/UPSTREAM.md) and [NOTICE.md](https://github.com/Choxie77/anti-ai-design/blob/main/anti-design-skill/NOTICE.md). It is not affiliated with or endorsed by the upstream authors.

The npm package is a small launcher. It runs the engine binary for your platform, installed next to it as an optional dependency (`@anti-ai-design/cli-<os>-<arch>`), and falls back to a per-user cache or a one-time download when that package is missing.

> **Status: pre-release.** The package and the engine downloads are not published yet. Build the engine from source until they are; steps are in the [main README](https://github.com/Choxie77/anti-ai-design/blob/main/anti-design-skill/README.md#build-from-source-works-today).

## Quick start

```bash
# Install the skill into your AI tool (prompts for tools and scope)
npx anti-ai-design install

# Same, without prompts
npx anti-ai-design install -y --providers=claude,codex --scope=project

# First command to run inside your AI tool
/anti-ai-design init

# Refresh an existing install, or check whether one is current
npx anti-ai-design update
npx anti-ai-design check

# Skills only, no hook manifests
npx anti-ai-design install --no-hooks

# Link skills from a Git submodule or local checkout
npx anti-ai-design link --source=vendor/anti-ai-design --providers=claude,cursor

# Scan files, directories or a live URL (URL scans use an installed Chrome, Chromium or Edge)
npx anti-ai-design detect src/
npx anti-ai-design detect https://example.com

# JSON for tooling, annotations for GitHub Actions
npx anti-ai-design detect --json src/
npx anti-ai-design detect --github src/

# Print every rule with its id and description, without scanning
npx anti-ai-design detect --list-rules
```

Other subcommands: `ignores` (manage ignored rules, files and values), `telemetry off|on|status`, and `help`. `help` fetches its list from a hosted service this fork does not have yet, so it reports a network error for now.

## What it detects

Rule ids in parentheses; `detect --list-rules` prints the full catalog with descriptions.

**AI tells**: a thick colored border on one side of a card (`side-tab`), gradient text (`gradient-text`), purple or violet gradients and cyan on dark (`ai-color-palette`), glow and halo effects on dark backgrounds (`dark-glow`, `radial-halo`), reflexive cream palettes (`cream-palette`), nested cards (`nested-cards`), an icon tile stacked above a heading (`icon-tile-stack`), an eyebrow label above the headline (`hero-eyebrow-chip`), an italic serif display line (`italic-serif-display`), and over-used phrasing such as stacked em-dashes or marketing buzzwords (`em-dash-overuse`, `marketing-buzzword`).

**Typography**: overused font families (`overused-font`), a flat size hierarchy (`flat-type-hierarchy`), extreme or wide tracking, tight leading, tiny text, justified text, long all-caps body copy, and orphaned last lines.

**Color and contrast**: contrast below the WCAG AA ratio (`low-contrast`) and gray text on a colored background (`gray-on-color`).

**Layout and spacing**: monotonous spacing (`monotonous-spacing`), cramped padding (`cramped-padding`), line length out of range (`line-length`), skipped headings (`skipped-heading`), text overflow and occlusion.

**Motion and decoration**: bounce and elastic easing (`bounce-easing`), pulsing dots, blinking cursors, marquees.

**Project-specific (`aad-` rules)**: emoji used as icons, a removed focus ring, icon-only buttons with no accessible name, too many unrelated accent hues, too many different corner radii, and backdrop blur on many surfaces.

Rules prefixed `design-system-` compare a page against your `DESIGN.md`.

## Exit codes

- `0`: the scan finished with no primary findings (advisory findings may still be listed)
- `1`: at least one target could not be scanned
- `2`: the scan finished with primary findings

When a multi-target scan is partial, the failure to scan takes precedence. In JSON mode stdout stays a findings array and diagnostics go to stderr. With `--github`, stdout is one annotation per finding; GitHub shows at most 10 annotations of each type per step and 50 per job, and the rest stay in the log.

## Options

```
anti-ai-design detect [options] [file-or-dir-or-url...]

  --json                Output results as JSON
  --quiet               In text mode, only print the final findings count
  --github              Write GitHub Actions annotations for each finding
  --list-rules          Print the rule catalog and exit (--json, --quiet for ids only)
  --scope <name>        Only report rules in a design domain: type, layout (comma-separated)
  --viewport <WxH>      Browser viewport for URL scans (default 1280x800)
  --no-config           Ignore project config, detector ignores, inline comments and DESIGN.md
  --no-inline-ignores   Do not honor in-file disable comments
  --no-design-system    Do not load local DESIGN.md or .anti-ai-design/design.json
  --no-advisory         Hide advisory findings
  --no-consent-hiding   URL scans: leave consent-manager banners on the page
  --no-overlay-hiding   URL scans: leave product tours and preloaders on the page
  --cdp <port|url>      Scan a page of a running Chromium-based desktop app via its DevTools port
  --target <text>       With --cdp: choose the page whose URL or title contains this text
  --help                Show help
```

This block mirrors `detect --help` of the engine in this repository; run it yourself for the authoritative text.

## Requirements

- Node.js 18.19 or newer to run `npx anti-ai-design`. The engine is a self-contained binary and needs no runtime; the installed skill calls it directly.
- For URL scans, an installed Chrome, Chromium or Edge. Set `ANTI_AI_DESIGN_BROWSER` to point at a specific one.
- Behind a TLS-inspecting proxy, downloads trust your operating system's certificate store as well as the bundled Mozilla roots. Set `SSL_CERT_FILE` or `SSL_CERT_DIR` to use a specific CA bundle instead.

Binary lookup order: `ANTI_AI_DESIGN_BIN`, the platform package, `~/.anti-ai-design/bin/<version>/`, then a download of the pinned version into that cache. Set `ANTI_AI_DESIGN_BIN` to a local build to skip all of that.

## Part of Anti-AI Design

This CLI is one part of [Anti-AI Design](https://github.com/Choxie77/anti-ai-design), a design skill with 24 commands for AI coding tools, plus the detector. The README there covers the commands, live mode, hooks and telemetry.

## License

[Apache 2.0](https://github.com/Choxie77/anti-ai-design/blob/main/anti-design-skill/LICENSE)
