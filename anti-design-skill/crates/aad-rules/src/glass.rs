//! `aad-glass-overuse`: backdrop blur used on many surfaces.

use crate::util::{excerpt, is_markup, is_style, is_unknown, line_at};
use crate::ROW_GLASS;
use anti_ai_design_core::findings::{finding_for, Finding};
use once_cell::sync::Lazy;
use regex::Regex;

/// `backdrop-filter: ... blur(` with an optional vendor prefix, and Tailwind `backdrop-blur`.
static BLUR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(-webkit-)?backdrop-filter\s*:[^;}{]*blur\(|(?:^|[\s:'\x22`])backdrop-blur(?:-[a-z0-9\[\]\.]+)?\b").unwrap()
});

/// Three or more blurred surfaces in one file reads as a style, not as a layering fix.
const MIN_COUNT: usize = 3;

pub fn check(content: &str, file_path: &str, ext: &str) -> Vec<Finding> {
    if !(is_style(ext) || is_markup(ext) || is_unknown(ext)) {
        return Vec::new();
    }
    // The `-webkit-` twin of a declaration is the same surface.
    let hits: Vec<_> = BLUR.captures_iter(content).filter(|c| c.get(1).is_none()).map(|c| c.get(0).unwrap()).collect();
    if hits.len() < MIN_COUNT {
        return Vec::new();
    }
    vec![finding_for(
        &crate::ROWS[ROW_GLASS],
        file_path,
        &format!("{} blurred surfaces, first: {}", hits.len(), excerpt(hits[0].as_str())),
        line_at(content, hits[0].start()),
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn three_blurred_surfaces_are_flagged() {
        let css = ".nav { backdrop-filter: blur(12px); }\n.card { backdrop-filter: blur(8px); }\n.modal { -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }\n";
        let f = check(css, "a.css", ".css");
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].antipattern, "aad-glass-overuse");
        assert!(f[0].snippet.starts_with("3 blurred"), "{}", f[0].snippet);
    }

    #[test]
    fn one_or_two_stay_quiet() {
        let css = ".nav { backdrop-filter: blur(12px); }\n.card { -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }\n";
        assert!(check(css, "a.css", ".css").is_empty());
    }

    #[test]
    fn tailwind_tokens_count() {
        let html = r#"<div class="backdrop-blur-md"></div><div class="bg-white/10 backdrop-blur"></div><div class="x backdrop-blur-xl"></div>"#;
        assert_eq!(check(html, "a.html", ".html").len(), 1);
    }
}
