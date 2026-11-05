# Slop catalog (baseline)

The generic design habits that make an interface read as "AI made this", plus a few plain quality defects
that usually come along with them. Written in our own words with our own IDs. The reference site's catalog
and the `appllama-app-design-skill` anti-slop section were used as inspiration for *which habits exist*; the
wording, IDs and detection ideas below are ours (see `docs/spec/originality.md`).

## How to read an entry

- **ID**: `AAD-<domain><nn>`. Domains: `T` type, `C` color, `L` layout, `V` visual details, `M` motion,
  `W` copy (words), `I` imagery, `Q` general quality, `S` design-system drift.
- **Kind**: `slop` = a stylistic default models reach for; `quality` = a usability or correctness defect.
- **Check**: `source` = static scan of code/CSS; `render` = needs a rendered page; `review` = needs judgment
  (reported only as a prompt for a human or an agent).
- **Severity guess**: `high` blocks use or is a strong tell, `medium` hurts polish, `low` is a hint. A
  finding is a reason to look, never a verdict: intentional use is allowed through ignores.

Totals: 51 entries below.

## Typography

### AAD-T01 Default font everywhere
- **Description:** the page is set in a stock default (Inter, Roboto, Arial, system-ui, Geist) with no
  second voice, so unrelated products look the same.
- **Detection idea:** collect `font-family` stacks; flag when the first family is on an overused list and
  no display/brand family is declared. Allow-list from DESIGN.md.
- **Kind / check / severity:** slop, source, medium.

### AAD-T02 Flat type hierarchy
- **Description:** headings, subheadings and body are within a small ratio of each other, so the page
  cannot be scanned.
- **Detection idea:** compute the ratio between the largest heading size and body size per page; flag
  below about 1.25, or when h1 to h3 sizes differ by less than 2px.
- **Kind / check / severity:** slop, source, medium.

### AAD-T03 Oversized hero headline
- **Description:** a long headline set at display size fills the first screen by itself.
- **Detection idea:** headline word count above about 12 combined with a size above about 4rem, or more
  than 3 wrapped lines at 1280px (render).
- **Kind / check / severity:** slop, source+render, medium.

### AAD-T04 Eyebrow label above the headline
- **Description:** a small pill or uppercase label sits above every section heading and repeats it.
- **Detection idea:** element with small, uppercase or tracked text directly before an h1/h2 inside the
  same container, repeated three or more times on a page.
- **Kind / check / severity:** slop, source, low.

### AAD-T05 Italic serif display line
- **Description:** one word or line in an italic serif dropped into a sans headline as a shortcut to
  "editorial".
- **Detection idea:** inline element inside a heading whose font-family is a serif and style is italic
  while the heading's own family is sans.
- **Kind / check / severity:** slop, source, low.

### AAD-T06 Crushed or stretched tracking
- **Description:** letter spacing so tight that glyphs touch, or so wide that body copy loses word shape.
- **Detection idea:** `letter-spacing` below about -0.05em on headings, or above about 0.1em on text
  longer than a short label.
- **Kind / check / severity:** quality, source, medium.

### AAD-T07 Tiny text
- **Description:** body or interface text under a readable size.
- **Detection idea:** computed font size below 14px for body, below 12px for any visible text; ignore
  decorative or legal micro-text only through explicit ignores.
- **Kind / check / severity:** quality, source, high.

### AAD-T08 Line length out of range
- **Description:** paragraphs wider than a comfortable measure, or columns so narrow that every line
  breaks mid-phrase.
- **Detection idea:** rendered characters per line of paragraphs; flag above about 80 or below about 35.
- **Kind / check / severity:** quality, render, medium.

### AAD-T09 Cramped or loose line height
- **Description:** multi-line text with leading under about 1.35, or headings with leading above 1.4.
- **Detection idea:** compare `line-height` against role (body vs heading).
- **Kind / check / severity:** quality, source, medium.

### AAD-T10 Orphan last line
- **Description:** a paragraph or heading ends with one lonely word.
- **Detection idea:** missing `text-wrap: pretty` on long paragraphs and `text-wrap: balance` on headings;
  render check for a last line under 15% of the width.
- **Kind / check / severity:** quality, source+render, low.

### AAD-T11 Long all-caps or justified body
- **Description:** paragraphs in capitals or justified text with uneven word gaps.
- **Detection idea:** `text-transform: uppercase` or `text-align: justify` on elements with more than
  about 12 words.
- **Kind / check / severity:** quality, source, medium.

## Color and contrast

### AAD-C01 Purple-to-blue gradient defaults
- **Description:** indigo, violet and electric blue gradients on buttons, headings or backgrounds.
- **Detection idea:** parse gradients; flag stops whose hue is roughly 240 to 290 degrees on primary
  surfaces, scored higher when two or more such gradients appear.
- **Kind / check / severity:** slop, source, high.

### AAD-C02 Gradient text
- **Description:** headline or number filled with a color gradient purely for flair.
- **Detection idea:** `background-clip: text` (or `-webkit-`) with a gradient and transparent text color.
- **Kind / check / severity:** slop, source, high.

### AAD-C03 Glow and halo backgrounds
- **Description:** radial glows, soft spotlights, blurred orbs behind content, neon box-shadows.
- **Detection idea:** radial-gradient with large blur radii and low alpha behind a section; box-shadows
  with zero offset, large blur and saturated color.
- **Kind / check / severity:** slop, source, medium.

### AAD-C04 Neon on dark
- **Description:** dark theme where accents are glowing cyan, magenta or lime on near-black.
- **Detection idea:** dark background (luminance below about 0.05) plus two or more saturated accents
  and glow shadows.
- **Kind / check / severity:** slop, source, medium.

### AAD-C05 Low contrast text
- **Description:** text that fails WCAG AA against its actual background.
- **Detection idea:** compute contrast ratio for resolved foreground/background pairs; fail below 4.5:1
  (3:1 for large text). Needs the real background, so prefer render; static scan for literal pairs.
- **Kind / check / severity:** quality, source+render, high.

### AAD-C06 Grey text on a colored surface
- **Description:** neutral grey copy placed on a tinted or saturated background, so it looks washed out.
- **Detection idea:** text color with saturation near zero on a background with saturation above about 0.3.
- **Kind / check / severity:** quality, source, medium.

### AAD-C07 More than one accent
- **Description:** several unrelated hues compete as "the" accent across buttons, links and badges.
- **Detection idea:** cluster all non-neutral colors by hue; flag more than one primary cluster plus
  semantic colors (success, warning, error). Inspired by a palette-count pre-flight.
- **Kind / check / severity:** slop, source, medium.

### AAD-C08 Beige by reflex
- **Description:** cream surfaces and warm greys chosen as a safe "tasteful" default with no link to the
  product.
- **Detection idea:** page background within a narrow warm-cream range plus the absence of any other
  declared brand color. Treat as a hint only.
- **Kind / check / severity:** slop, source, low.

## Layout and space

### AAD-L01 Identical card grid
- **Description:** three, four or six cards with the same icon, heading and two lines, all weighted equally.
- **Detection idea:** a grid or flex container with 3 to 6 siblings whose subtrees have the same tag
  structure and similar text lengths.
- **Kind / check / severity:** slop, source, medium.

### AAD-L02 Nested cards
- **Description:** a card inside a card inside a card; each layer adds padding and a shadow.
- **Detection idea:** depth of elements with border or shadow plus radius; flag three or more nested.
- **Kind / check / severity:** slop, source, medium.

### AAD-L03 Monotone spacing
- **Description:** the same gap between everything, so grouping is invisible.
- **Detection idea:** fewer than three distinct vertical gap values across a page's main sections, or one
  value covering more than about 80% of gaps.
- **Kind / check / severity:** slop, source, low.

### AAD-L04 Hero metric block
- **Description:** a huge number, a tiny label and a row of supporting stats used as the default hero.
- **Detection idea:** large-font numeric text with a small sibling label, followed by two or more similar
  stat items.
- **Kind / check / severity:** slop, review, low.

### AAD-L05 Copy-paste page skeleton
- **Description:** hero, logo strip, three features, stats, testimonial, CTA band, in that order.
- **Detection idea:** match the ordered section roles of a landing page against a known template list.
- **Kind / check / severity:** slop, review, medium.

### AAD-L06 Numbered section labels with no sequence
- **Description:** "01 / 02 / 03" decorations next to headings that are not steps.
- **Detection idea:** small numeric prefixes on headings where the content is not an ordered list or
  process.
- **Kind / check / severity:** slop, source, low.

### AAD-L07 Content overflow or clipping
- **Description:** text spills out of its box, the page scrolls sideways, or a menu is cut off by its
  container.
- **Detection idea:** render check comparing scroll and client sizes; `overflow: hidden` on an ancestor of
  an absolutely positioned popover.
- **Kind / check / severity:** quality, render, high.

### AAD-L08 Modal for a full task
- **Description:** a scrolling dialog holds a multi-column settings form that deserves its own page.
- **Detection idea:** dialog element containing more than about 8 form controls or its own scroll region.
- **Kind / check / severity:** slop, source, medium.

## Visual details

### AAD-V01 Colored side stripe on cards
- **Description:** a thick colored left border on every rounded card, with no status to communicate.
- **Detection idea:** `border-left` (or right) of 3px or more with color, together with a border radius.
- **Kind / check / severity:** slop, source, medium.

### AAD-V02 Glass everywhere
- **Description:** backdrop blur and translucent panels used as decoration, not to solve layering.
- **Detection idea:** `backdrop-filter: blur` on more than two element classes, or on elements with
  nothing visible behind them.
- **Kind / check / severity:** slop, source, medium.

### AAD-V03 Hairline plus shadow
- **Description:** a 1px border and a wide soft shadow both define the same surface.
- **Detection idea:** same rule declares a thin border and a box-shadow blur above about 20px.
- **Kind / check / severity:** slop, source, low.

### AAD-V04 Bubble corners
- **Description:** very large radii on small cards or inputs so everything is a pill or blob.
- **Detection idea:** `border-radius` above about 28px on elements shorter than about 160px.
- **Kind / check / severity:** slop, source, low.

### AAD-V05 Icon tile above a heading
- **Description:** a rounded square holding an icon, stacked above every feature title.
- **Detection idea:** card whose first child is a rounded, tinted container wrapping a single icon.
- **Kind / check / severity:** slop, source, medium.

### AAD-V06 Emoji as interface icons
- **Description:** emoji stand in for icons in navigation, buttons or feature lists.
- **Detection idea:** emoji code points in text nodes of buttons, nav items, headings and list markers.
- **Kind / check / severity:** slop, source, medium.

### AAD-V07 Mixed corner radii
- **Description:** unrelated radius values with no scale (4, 7, 10, 13, 18, 22) across one product.
- **Detection idea:** collect distinct radii; flag more than about five values or values that do not sit
  on a base step. Pairs with AAD-S03.
- **Kind / check / severity:** slop, source, low.

## Motion

### AAD-M01 Bouncy or elastic easing
- **Description:** overshoot springs on routine UI such as dialogs and menus.
- **Detection idea:** cubic-bezier with a control value above 1 or below 0 on transition/animation of
  common UI elements.
- **Kind / check / severity:** slop, source, low.

### AAD-M02 Decorative motion loops
- **Description:** pulsing status dots, floating badges, wiggling icons, blinking fake cursors.
- **Detection idea:** infinite animations on small elements that do not represent live activity.
- **Kind / check / severity:** slop, source, medium.

### AAD-M03 Auto-scrolling marquee
- **Description:** logos or text that scroll by themselves with no pause control.
- **Detection idea:** infinite translate animation on a wide inline track; absence of
  `prefers-reduced-motion` handling and of a pause control.
- **Kind / check / severity:** slop, source, medium.

### AAD-M04 Content hidden until animated
- **Description:** content starts at `opacity: 0` and relies on a script to appear.
- **Detection idea:** initial hidden state in CSS with no fallback, on elements that contain real content.
- **Kind / check / severity:** quality, source+render, high.

## Copy

### AAD-W01 Inflated marketing words
- **Description:** "supercharge", "world-class", "next-generation", "seamless" with no concrete claim.
- **Detection idea:** word list match in visible text, scored by density per 100 words.
- **Kind / check / severity:** slop, source, medium.

### AAD-W02 Slogan contrast pairs
- **Description:** "Not X. Y." and "Less X, more Y." repeated as a rhythm.
- **Detection idea:** regex for negation-then-claim sentence pairs; flag two or more per page.
- **Kind / check / severity:** slop, source, low.

### AAD-W03 Dash-heavy sentences
- **Description:** an em dash in nearly every sentence.
- **Detection idea:** count em dashes per 100 words; flag above about 1.5.
- **Kind / check / severity:** slop, source, low.

### AAD-W04 Repeated text in one component
- **Description:** the same label or sentence appears in several slots of the same card or field.
- **Detection idea:** identical normalized text nodes inside one container; label, placeholder and hint
  that say the same thing.
- **Kind / check / severity:** quality, source, medium.

### AAD-W05 Different words for one action
- **Description:** "Get started", "Start now", "Begin" used for the same intent across the product.
- **Detection idea:** cluster button labels by synonym groups; flag two or more labels from one group.
- **Kind / check / severity:** slop, review, low.

## Imagery

### AAD-I01 Placeholder-style art
- **Description:** scenes built from circles, blobs and rough hand-coded SVG that look unfinished.
- **Detection idea:** inline SVGs made only of a few primitives with no paths, or generic blob shapes.
- **Kind / check / severity:** slop, review, low.

### AAD-I02 Broken or empty image
- **Description:** missing, empty or placeholder `src`.
- **Detection idea:** `img` with empty src, `placeholder.*`, `via.placeholder`, or a failed load in render.
- **Kind / check / severity:** quality, source+render, high.

## General quality

### AAD-Q01 Skipped heading level
- **Description:** h1 followed by h3 with no h2.
- **Detection idea:** walk headings in document order and compare levels.
- **Kind / check / severity:** quality, source, medium.

### AAD-Q02 Missing focus and label basics
- **Description:** interactive elements with no visible focus style, icon buttons with no accessible name.
- **Detection idea:** `outline: none` without a replacement; `button` with only an icon child and no
  `aria-label` or text.
- **Kind / check / severity:** quality, source, high.

### AAD-Q03 Runtime errors on load
- **Description:** uncaught JavaScript errors that break controls.
- **Detection idea:** render check collecting console errors during load.
- **Kind / check / severity:** quality, render, high.

## Design-system drift

### AAD-S01 Font outside the documented system
- **Description:** a font family used in code that DESIGN.md does not list.
- **Detection idea:** compare used families against the DESIGN.md typography tokens.
- **Kind / check / severity:** quality, source, medium.

### AAD-S02 Color outside the documented palette
- **Description:** a color value not in the DESIGN.md palette (allow a small distance tolerance).
- **Detection idea:** nearest-token distance in a perceptual color space above a threshold.
- **Kind / check / severity:** quality, source, medium.

### AAD-S03 Radius or size outside the documented scale
- **Description:** corner radii or font sizes that are not steps in the documented scale.
- **Detection idea:** compare against DESIGN.md radius and type-size tokens.
- **Kind / check / severity:** quality, source, low.

## Open questions for later tasks

- Thresholds above are first guesses; task-21 (fixtures and accuracy test) should tune them against
  labelled good and bad examples.
- Rules marked `render` need a headless browser. The baseline stays dependency-free, so `render` rules
  are deferred and `source` rules ship first.
- Severity will be re-derived from the scoring model (task-20), not hard-coded per rule.
