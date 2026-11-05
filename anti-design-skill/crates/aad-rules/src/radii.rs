//! `aad-mixed-radii`: corner radii that follow no scale.

use crate::util::{excerpt, is_markup, is_style, is_unknown, line_at};
use crate::ROW_RADII;
use anti_design_core::findings::{finding_for, Finding};
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::BTreeSet;

static DECL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\bborder(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;}{]+)").unwrap());
static TAILWIND: Lazy<Regex> = Lazy::new(|| Regex::new(r"\brounded(?:-[a-z]{1,2})?-\[(\d+(?:\.\d+)?)(px|rem)\]").unwrap());

/// Six different radii is too many for any scale.
const MANY: usize = 6;
/// Four different radii, with this many odd pixel values, reads as unplanned.
const FEW: usize = 4;
const ODD: usize = 2;

/// Radii at or above this are "fully round" (pills, circles), not a step on the scale.
const PILL: f64 = 999.0;

fn to_px(num: &str, unit: &str) -> Option<f64> {
    let n: f64 = num.parse().ok()?;
    match unit {
        "px" => Some(n),
        "rem" | "em" => Some(n * 16.0),
        _ => None,
    }
}

fn radii_in(value: &str, set: &mut BTreeSet<u32>) {
    for tok in value.split_whitespace() {
        if tok.starts_with("var(") || tok.contains('%') || tok.starts_with("calc(") || tok == "/" {
            continue;
        }
        let split = tok.find(|c: char| c.is_ascii_alphabetic()).unwrap_or(tok.len());
        let (num, unit) = tok.split_at(split);
        if let Some(px) = to_px(num, unit) {
            if px > 0.0 && px < PILL {
                // Half-pixel steps are one step.
                set.insert((px * 2.0).round() as u32);
            }
        }
    }
}

pub fn check(content: &str, file_path: &str, ext: &str) -> Vec<Finding> {
    if !(is_style(ext) || is_markup(ext) || is_unknown(ext)) {
        return Vec::new();
    }
    let mut set = BTreeSet::new();
    let mut first: Option<(usize, String)> = None;
    for c in DECL.captures_iter(content) {
        let m = c.get(0).unwrap();
        radii_in(&c[1], &mut set);
        first.get_or_insert((m.start(), m.as_str().to_string()));
    }
    for c in TAILWIND.captures_iter(content) {
        let m = c.get(0).unwrap();
        if let Some(px) = to_px(&c[1], &c[2]) {
            if px > 0.0 && px < PILL {
                set.insert((px * 2.0).round() as u32);
            }
        }
        first.get_or_insert((m.start(), m.as_str().to_string()));
    }
    let odd = set.iter().filter(|h| **h % 2 == 0 && (**h / 2) % 2 == 1).count();
    if !(set.len() >= MANY || (set.len() >= FEW && odd >= ODD)) {
        return Vec::new();
    }
    let list: Vec<String> = set.iter().map(|h| format!("{}", *h as f64 / 2.0)).collect();
    let (at, _) = first.unwrap_or((0, String::new()));
    vec![finding_for(
        &crate::ROWS[ROW_RADII],
        file_path,
        &excerpt(&format!("{} radii in px: {}", set.len(), list.join(", "))),
        line_at(content, at),
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn css(radii: &[&str]) -> String {
        radii.iter().map(|r| format!(".a {{ border-radius: {r}; }}\n")).collect()
    }

    #[test]
    fn six_distinct_radii_are_flagged() {
        let f = check(&css(&["4px", "6px", "8px", "10px", "12px", "16px"]), "a.css", ".css");
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].antipattern, "aad-mixed-radii");
        assert!(f[0].snippet.contains("6 radii"), "{}", f[0].snippet);
    }

    #[test]
    fn a_tidy_scale_is_fine() {
        assert!(check(&css(&["4px", "8px", "12px", "16px", "9999px", "50%", "0"]), "a.css", ".css").is_empty());
    }

    #[test]
    fn a_few_odd_values_are_flagged() {
        let f = check(&css(&["3px", "5px", "8px", "13px"]), "a.css", ".css");
        assert_eq!(f.len(), 1);
    }

    #[test]
    fn rem_and_shorthand_values_are_read() {
        let f = check(&css(&["0.25rem", "0.5rem 1rem", "7px", "11px", "20px"]), "a.css", ".css");
        assert_eq!(f.len(), 1, "{f:?}");
    }

    #[test]
    fn variables_and_pills_are_ignored() {
        assert!(check(&css(&["var(--r1)", "var(--r2)", "9999px", "50%", "100%", "999px"]), "a.css", ".css").is_empty());
    }

    #[test]
    fn tailwind_arbitrary_radii_count() {
        let html = r#"<a class="rounded-[3px]"></a><a class="rounded-[5px]"></a><a class="rounded-[7px]"></a><a class="rounded-[9px]"></a><a class="rounded-t-[11px]"></a>"#;
        assert_eq!(check(html, "a.html", ".html").len(), 1);
    }
}
