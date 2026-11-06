//! `aad-emoji-icons`: emoji standing in for icons in buttons, links, headings and lists.

use crate::util::{excerpt, is_markup, is_unknown, line_at};
use crate::ROW_EMOJI;
use anti_ai_design_core::findings::{finding_for, Finding};
use once_cell::sync::Lazy;
use regex::Regex;

/// Pictographic emoji, minus the typographic marks people use as plain symbols
/// (check marks, stars used for ratings, arrows, copyright signs).
const EMOJI: &str = r"[\x{1F300}-\x{1FAFF}\x{2600}-\x{2604}\x{2607}-\x{26FF}\x{2705}\x{2708}-\x{270D}\x{270F}\x{2728}\x{2733}\x{2734}\x{2744}\x{2747}\x{274C}\x{274E}\x{2753}-\x{2755}\x{2757}\x{2763}\x{2764}\x{2795}-\x{2797}\x{27A1}\x{27B0}\x{27BF}\x{2B05}-\x{2B07}\x{2B50}\x{2B55}]";

/// An interface element whose first visible content is an emoji.
static CHROME: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"<(?:button|a|li|h[1-6]|summary|th|dt|label|[A-Z][A-Za-z0-9]*(?:Button|Link|Item|Tab|Title|Heading|Label|Badge|Chip|Trigger))\b[^>]*>\s*(?:<[a-z][^>]*>\s*)*{EMOJI}"
    ))
    .expect("emoji chrome pattern")
});

/// Below this many chrome emoji in one file the use reads as content, not as icons.
const MIN_COUNT: usize = 3;

pub fn check(content: &str, file_path: &str, ext: &str) -> Vec<Finding> {
    if !(is_markup(ext) || is_unknown(ext)) {
        return Vec::new();
    }
    let hits: Vec<_> = CHROME.find_iter(content).collect();
    if hits.len() < MIN_COUNT {
        return Vec::new();
    }
    let first = &hits[0];
    vec![finding_for(
        &crate::ROWS[ROW_EMOJI],
        file_path,
        &format!("{} emoji used as icons, first: {}", hits.len(), excerpt(first.as_str())),
        line_at(content, first.start()),
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(src: &str) -> Vec<Finding> {
        check(src, "page.html", ".html")
    }

    #[test]
    fn flags_three_emoji_in_buttons_links_and_headings() {
        let src = "<nav>\n<a href=\"/\">🏠 Home</a>\n<button>🚀 Launch</button>\n<h2>✨ Features</h2>\n</nav>";
        let f = run(src);
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].antipattern, "aad-emoji-icons");
        assert_eq!(f[0].line, 2.0);
    }

    #[test]
    fn two_emoji_stay_quiet() {
        assert!(run("<button>🚀 Go</button><a href=\"#\">🏠 Home</a>").is_empty());
    }

    #[test]
    fn plain_symbols_and_paragraph_emoji_stay_quiet() {
        let src = "<li>✓ Included</li><li>★ Rated</li><li>→ Next</li><li>© 2026</li><p>🎉 We moved!</p><p>🎉</p>";
        assert!(run(src).is_empty());
    }

    #[test]
    fn jsx_components_count() {
        let src = "<NavLink to=\"/\">🏠 Home</NavLink>\n<IconButton>🔍</IconButton>\n<TabItem>⚙️ Settings</TabItem>";
        assert_eq!(check(src, "Nav.tsx", ".tsx").len(), 1);
    }

    #[test]
    fn stylesheets_are_skipped() {
        assert!(check("<button>🚀</button><button>🚀</button><button>🚀</button>", "a.css", ".css").is_empty());
    }
}
