//! Anti-AI Design first-party rules.
//!
//! The engine in this workspace ships its own built-in rules. These six rows are
//! ours: they are added through the engine's rule-pack extension point
//! (`anti_ai_design_core::rule_pack`), so they live in their own crate and never touch
//! the built-in rule code. Ids start with `aad-` so they are easy to tell apart.
//! All of them run in the text engine, which also covers `.html` files, and are
//! waivable with `anti-ai-design-disable` like any built-in rule.
//!
//! Heuristics are deliberately conservative and, where a rule can be a matter of
//! taste (accent count, radius scale, glass), reported as advisories.

mod accents;
mod emoji;
mod focus;
mod glass;
mod radii;
pub mod safe_fix;
mod util;

use anti_ai_design_core::findings::Finding;
use anti_ai_design_core::registry::Antipattern;
use anti_ai_design_core::rule_pack::RulePack;

pub(crate) const ROW_EMOJI: usize = 0;
pub(crate) const ROW_FOCUS: usize = 1;
pub(crate) const ROW_ICON_BUTTON: usize = 2;
pub(crate) const ROW_ACCENTS: usize = 3;
pub(crate) const ROW_RADII: usize = 4;
pub(crate) const ROW_GLASS: usize = 5;

const fn row(
    id: &'static str,
    category: &'static str,
    severity: Option<&'static str>,
    name: &'static str,
    description: &'static str,
) -> Antipattern {
    Antipattern { id, category, scopes: None, severity, name, description, skill_section: None, skill_guideline: None }
}

/// The pack's registry rows, in `ROW_*` order.
pub static ROWS: &[Antipattern] = &[
    row(
        "aad-emoji-icons",
        "slop",
        None,
        "Emoji used as interface icons",
        "Emoji stand in for icons in buttons, links, headings or lists. They render differently on every platform and ignore your type and color. Use one icon set, or plain words.",
    ),
    row(
        "aad-focus-removed",
        "quality",
        None,
        "Focus outline removed with no replacement",
        "The default focus ring is switched off and nothing else shows which control has keyboard focus. Add a visible :focus-visible style (a ring, an outline or a color change) before removing the default.",
    ),
    row(
        "aad-icon-button-name",
        "quality",
        None,
        "Icon-only button with no accessible name",
        "A button that contains only an icon has no text for a screen reader to announce. Give it an aria-label (or visible text, or a title inside the svg).",
    ),
    row(
        "aad-multiple-accents",
        "slop",
        Some("advisory"),
        "Several competing accent colors",
        "Three or more unrelated, clearly colored hues are each used more than once. Pick one accent for actions and active states, let neutrals carry the rest, and keep red, green and amber for status.",
    ),
    row(
        "aad-mixed-radii",
        "slop",
        Some("advisory"),
        "Corner radii without a scale",
        "Many different corner radii, or several odd values, with no scale behind them. Choose a small set (for example 4, 8, 12, 16) and a rule for where each applies.",
    ),
    row(
        "aad-glass-overuse",
        "slop",
        Some("advisory"),
        "Backdrop blur on many surfaces",
        "Three or more surfaces use a backdrop blur. Blur solves a real layering problem (content scrolling under a bar); as a style on every card it is decoration.",
    ),
];

/// Files bigger than this are not scanned: they are almost always generated.
const MAX_BYTES: usize = 600_000;

#[derive(Debug)]
pub struct AadPack;

/// The pack value the binary installs.
pub static PACK: AadPack = AadPack;

/// Register the rows and make this the pack the `anti-ai-design` CLI runs. Call once at startup.
pub fn install_default() {
    anti_ai_design_core::rule_pack::install_default(&PACK);
}

impl RulePack for AadPack {
    fn registry(&self) -> &'static [Antipattern] {
        ROWS
    }

    fn check_text(&self, content: &str, file_path: &str, ext: &str) -> Vec<Finding> {
        if content.len() > MAX_BYTES || util::looks_minified(content) {
            return Vec::new();
        }
        let mut out = Vec::new();
        out.extend(emoji::check(content, file_path, ext));
        out.extend(focus::check(content, file_path, ext));
        out.extend(accents::check(content, file_path, ext));
        out.extend(radii::check(content, file_path, ext));
        out.extend(glass::check(content, file_path, ext));
        out
    }
}
