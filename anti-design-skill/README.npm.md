# Anti-Design CLI

Detect UI anti-patterns and design quality issues from the command line, and install the Anti-Design design skill into your AI coding harness. The detector scans HTML, CSS, JSX, TSX, Vue, and Svelte files for 62 deterministic rules, including AI-generated UI tells, accessibility violations, and general design quality problems.

The npm package is a small launcher. It runs the `anti-design` engine binary for your platform, installed alongside it as an optional dependency (`@anti-design/cli-<os>-<arch>`), and falls back to a per-user cache or a one-time download when that package is missing.

## Quick Start

```bash
# Install skills into your AI harness (Claude, Cursor, Gemini, etc.)
npx anti-design install

# Non-interactive install for a specific scope
npx anti-design install -y --providers=claude,codex --scope=project

# First command to run inside your AI harness
/anti-design init

# Update skills to the latest version
npx anti-design update

# Install or update skills without hook manifests
npx anti-design install --no-hooks

# Link skills from a Git submodule checkout
npx anti-design link --source=.anti-design --providers=claude,cursor

# List all available commands
npx anti-design help

# Scan files or directories for anti-patterns
npx anti-design detect src/

# Scan a live URL (uses an installed Chrome, Chromium, or Edge)
npx anti-design detect https://example.com

# JSON output for CI/tooling
npx anti-design detect --json src/

# GitHub Actions annotations
npx anti-design detect --github src/
# Catalog of detector rules (no scan)
npx anti-design detect --list-rules
```

`npx anti-design skills <command>` is the legacy namespace and still works.

## What It Detects

**AI Slop Tells**: patterns that scream "AI generated this":
- Side-tab accent borders, gradient text on headings
- Purple/violet gradients and cyan-on-dark palettes
- Dark mode with glowing accents, border + border-radius clashes

**Typography Issues**: overused fonts (Inter, Roboto), flat type hierarchy, single font families

**Color & Contrast**: WCAG AA violations, gray text on colored backgrounds, pure black/white

**Layout & Composition**: nested cards, monotonous spacing, everything-centered layouts

**Motion**: bounce/elastic easing, layout property transitions

**Quality**: tiny body text, cramped padding, long line lengths, small touch targets

62 deterministic detector rules in total. See the full catalog at [anti-design.example/slop](https://anti-design.example/slop).

## Exit Codes

- `0`: scan completed with no primary findings (advisories may still be listed)
- `1`: at least one requested target could not be scanned
- `2`: scan completed with primary findings

Operational failure takes precedence when a multi-target scan is partial. In JSON mode, stdout remains a findings array and diagnostics are written to stderr. With `--github`, stdout is one GitHub Actions annotation per finding; GitHub displays at most 10 annotations of each type per step and 50 per job, and the rest stay in the log.

## Options

```
anti-design detect [options] [file-or-dir-or-url...]

  --json        Output findings as JSON
  --github      Write GitHub Actions annotations for each finding
  --list-rules  Print the detector rule catalog and exit
  --scope       Only report rules in a design domain (type, layout)
  --help        Show help
```

## Requirements

- Node.js 18.19+ to run `npx anti-design`. The engine itself is a self-contained binary and needs no runtime; the skill installed into your harness calls it directly.
- For URL scans, an installed Chrome, Chromium, or Edge (set `ANTI_DESIGN_BROWSER` to point at one).
- Behind a TLS-inspecting proxy, downloads trust your OS certificate store as well as the bundled Mozilla roots. Set `SSL_CERT_FILE` or `SSL_CERT_DIR` to use a specific CA bundle instead.

Binary lookup order: `ANTI_DESIGN_BIN`, the platform package, `~/.anti-design/bin/<version>/`, then a download of the pinned version into that cache. Set `ANTI_DESIGN_BIN` to a local build to skip all of that.

## Part of Anti-Design

This CLI is part of [Anti-Design](https://anti-design.example), a cross-provider design skill pack for AI-powered development tools. The full suite includes 24 commands for Claude, Cursor, GitHub Copilot, Gemini, Codex, Hermes Agent, Veto, and more.

## License

[Apache 2.0](https://github.com/OWNER/anti-design/blob/main/LICENSE)
