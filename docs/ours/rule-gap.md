# Rule gap analysis: the fork's detector versus our catalog

Generated 2026-11-05 from `anti-ai-design detect --list-rules --json` (engine 0.1.18, **62 rules**) and the 51 candidate rules in `docs/research/slop-catalog.md`. Mapping was done by hand from rule names and descriptions, then checked by script: every upstream rule and every catalog entry appears exactly where listed below. Upstream rule IDs are the fork's own; our additions keep the `AAD-` IDs.

Upstream vocabulary: category `slop` or `quality`; severity `error`, `warning` or `advisory`; optional scope `type` or `layout`.

## Summary

| | Count |
|---|---|
| Fork rules | 62 |
| Catalog entries | 51 |
| Catalog entries that map to at least one fork rule | 40 |
| Fork rules that no catalog entry mentions | 11 |
| Catalog entries with no fork rule (candidates to add) | 11 |

## Rules both have

| Our entry | Fork rule(s) | Fork category / severity | Note |
|---|---|---|---|
| AAD-T01 Default font everywhere | `overused-font` | slop / warning | Fork flags a list of overused families; our "no second voice" half is design-review only. |
| AAD-T02 Flat type hierarchy | `flat-type-hierarchy` | slop / warning |  |
| AAD-T03 Oversized hero headline | `oversized-h1` | slop / warning |  |
| AAD-T04 Eyebrow label above the headline | `hero-eyebrow-chip`, `kicker-above-heading` | slop / warning, slop / warning |  |
| AAD-T05 Italic serif display line | `italic-serif-display` | slop / warning |  |
| AAD-T06 Crushed or stretched tracking | `extreme-negative-tracking`, `wide-tracking` | slop / warning, quality / warning |  |
| AAD-T07 Tiny text | `tiny-text`, `undersized-ui-text` | quality / warning, quality / warning |  |
| AAD-T08 Line length out of range | `line-length` | quality / warning |  |
| AAD-T09 Cramped or loose line height | `tight-leading` | quality / warning | Fork covers tight leading only; our "loose heading leading" half is not covered. |
| AAD-T10 Orphan last line | `straggler`, `unbalanced-heading` | quality / advisory, quality / advisory |  |
| AAD-T11 Long all-caps or justified body | `all-caps-body`, `justified-text` | quality / warning, quality / warning |  |
| AAD-C01 Purple-to-blue gradient defaults | `ai-color-palette` | slop / warning |  |
| AAD-C02 Gradient text | `gradient-text` | slop / warning |  |
| AAD-C03 Glow and halo backgrounds | `radial-halo`, `radial-spotlight-glow`, `dark-glow` | slop / warning, slop / warning, slop / warning |  |
| AAD-C04 Neon on dark | `dark-glow`, `ai-color-palette` | slop / warning, slop / warning | Partial: the fork flags glow shadows and the AI palette, not "dark background plus several saturated accents" as one signal. |
| AAD-C05 Low contrast text | `low-contrast` | quality / warning |  |
| AAD-C06 Grey text on a colored surface | `gray-on-color` | quality / warning |  |
| AAD-C08 Beige by reflex | `cream-palette` | slop / warning |  |
| AAD-L02 Nested cards | `nested-cards` | slop / warning |  |
| AAD-L03 Monotone spacing | `monotonous-spacing` | slop / warning |  |
| AAD-L06 Numbered section labels with no sequence | `numbered-section-labels` | slop / advisory |  |
| AAD-L07 Content overflow or clipping | `text-overflow`, `clipped-overflow-container`, `text-occlusion` | quality / warning, quality / advisory, quality / warning | Fork splits overflow, clipping and occlusion into three rules. |
| AAD-V01 Colored side stripe on cards | `side-tab`, `border-accent-on-rounded` | slop / warning, slop / warning |  |
| AAD-V03 Hairline plus shadow | `gpt-thin-border-wide-shadow` | slop / advisory |  |
| AAD-V05 Icon tile above a heading | `icon-tile-stack` | slop / warning |  |
| AAD-M01 Bouncy or elastic easing | `bounce-easing` | slop / advisory |  |
| AAD-M02 Decorative motion loops | `pulsing-dot`, `blinking-cursor` | slop / warning, slop / advisory |  |
| AAD-M03 Auto-scrolling marquee | `marquee` | slop / warning |  |
| AAD-M04 Content hidden until animated | `content-hidden-at-rest` | quality / error |  |
| AAD-W01 Inflated marketing words | `marketing-buzzword` | slop / warning |  |
| AAD-W02 Slogan contrast pairs | `aphoristic-cadence` | slop / warning |  |
| AAD-W03 Dash-heavy sentences | `em-dash-overuse` | slop / advisory |  |
| AAD-W04 Repeated text in one component | `repeated-container-text` | quality / warning |  |
| AAD-I01 Placeholder-style art | `shape-assembled-illustration` | slop / advisory |  |
| AAD-I02 Broken or empty image | `broken-image` | quality / warning |  |
| AAD-Q01 Skipped heading level | `skipped-heading` | quality / warning |  |
| AAD-Q03 Runtime errors on load | `script-error` | quality / error |  |
| AAD-S01 Font outside the documented system | `design-system-font` | quality / warning |  |
| AAD-S02 Color outside the documented palette | `design-system-color` | quality / advisory |  |
| AAD-S03 Radius or size outside the documented scale | `design-system-radius`, `design-system-font-size` | quality / advisory, quality / advisory | Both need a DESIGN.md; fork splits radius and font size into two rules. |

## Rules only upstream has (not in our catalog)

These are in the fork already; consider them done. Listed so our catalog does not duplicate them later.

| Fork rule | Category / severity | What it covers |
|---|---|---|
| `organic-clip-path` | quality / warning | Organic contour drawn as clip-path |
| `buried-raster` | quality / warning | Raster buried under a wash or opacity |
| `hard-offset-shadow` | quality / advisory | Hard offset shadow |
| `edge-flush-cards` | quality / warning | Cards flush against the scroller edge |
| `first-viewport-column-overflow` | quality / warning | One column stretches the first viewport |
| `cramped-padding` | quality / warning | Cramped padding |
| `body-text-viewport-edge` | quality / warning | Body text touching viewport edge |
| `heading-rhythm` | quality / warning | Heading crowded against the previous block |
| `repeating-stripes-gradient` | slop / advisory | Repeating-gradient stripes |
| `codex-grid-background` | slop / advisory | Decorative grid-line background |
| `theater-slop-phrase` | slop / advisory | Theater framing copy |

## Rules only our catalog has (candidates to add)

| Our entry | What | Our severity guess | Feasibility |
|---|---|---|---|
| AAD-C07 More than one accent | palette discipline: more than one competing accent hue | medium | source: cluster resolved colors by hue |
| AAD-L01 Identical card grid | identical card grid | medium | source heuristic; the reference site treats it as design review only |
| AAD-L04 Hero metric block | hero metric block | low | review only |
| AAD-L05 Copy-paste page skeleton | copy-paste page skeleton | medium | review only |
| AAD-L08 Modal for a full task | modal used for a full task | medium | source: dialog with many controls or its own scroll |
| AAD-V02 Glass everywhere | glass everywhere (backdrop blur) | medium | source: count `backdrop-filter: blur` classes; reference treats as review only |
| AAD-V04 Bubble corners | bubble corners (very large radii on small elements) | low | source: radius above 28px on short elements |
| AAD-V06 Emoji as interface icons | emoji as interface icons | medium | source: emoji code points in buttons, nav, headings, list markers |
| AAD-V07 Mixed corner radii | mixed corner radii with no scale | low | source, works without DESIGN.md (the fork's radius rule needs one) |
| AAD-W05 Different words for one action | different words for one action | low | needs a synonym list; mostly review |
| AAD-Q02 Missing focus and label basics | missing focus style and accessible name on icon buttons | high | source: `outline: none` with no replacement; icon-only button with no name |

## Recommendation for task-46 (first rules to add)

Ranked by value and by how cheaply they can be detected from source alone:

1. **AAD-Q02**: focus style and accessible names. The only high-severity gap, and a plain accessibility defect.
2. **AAD-C07**: more than one accent. Our clearest differentiator; the fork has palette rules but no discipline count.
3. **AAD-V07**: mixed corner radii without a DESIGN.md. Useful on projects that have not run `document` yet.
4. **AAD-V06**: emoji as interface icons. Cheap, very low false-positive risk.
5. **AAD-V02**: glass everywhere. Source-detectable, and the fork only lists it as a design-review pattern.

Deferred: AAD-W05 (needs a synonym model), AAD-L01/L04/L05 (layout heuristics need fixtures first), AAD-L08, AAD-V04. AAD-S03 is covered by two fork rules already, so it is dropped from the first batch (the PRD's earlier suggestion included it and W05; this replaces them).

## Method and limits

- Names and descriptions were compared, not rule source code. A fork rule that looks equivalent may have a narrower trigger than our idea; check the Rust before relying on a "both" row.
- The catalog's `render`-only rules map to fork rules that also need a browser (URL scans); the engine says plainly when a `.css` scan skipped them.
- Counts are for engine 0.1.18 as built here. Re-run `anti-ai-design detect --list-rules --json` after any upstream sync.

## Status after task-46 (2026-11-05)

Implemented as the rule pack `crates/aad-rules` (six rule ids, because Q02 became two rules):

| Catalog entry | Rule id | Severity |
|---|---|---|
| AAD-Q02 (focus) | `aad-focus-removed` | warning |
| AAD-Q02 (accessible name) | `aad-icon-button-name` | warning |
| AAD-C07 | `aad-multiple-accents` | advisory |
| AAD-V07 | `aad-mixed-radii` | advisory |
| AAD-V06 | `aad-emoji-icons` | warning |
| AAD-V02 | `aad-glass-overuse` | advisory |

Tests: 25 unit tests and 5 engine-level tests in the crate, plus `tests/aad-rules.test.mjs` against
`tests/fixtures/aad/` (bad, clean and waived files). The binary lists 68 rules (62 built-in plus these six).
Heuristic thresholds are first guesses and are not yet tuned on real projects (task-49).
