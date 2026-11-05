//! `aad-focus-removed` and `aad-icon-button-name`: two basic keyboard and
//! screen-reader defects that generated interfaces ship with.

use crate::util::{excerpt, is_markup, is_style, is_unknown, line_at};
use crate::{ROW_FOCUS, ROW_ICON_BUTTON};
use anti_design_core::findings::{finding_for, Finding};
use once_cell::sync::Lazy;
use regex::Regex;

/// At most this many outline findings per file, so one global reset does not flood a report.
const MAX_PER_FILE: usize = 3;

static OUTLINE_OFF: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\boutline\s*:\s*(?:none|0)\b|\boutline-width\s*:\s*0\b").unwrap());

/// A focus rule and its declarations: `selector { body }`.
static FOCUS_BLOCK: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"([^{}]*:focus(?:-visible)?[^{}]*)\{([^{}]*)\}").unwrap());

/// Declarations that give a focused control a visible state.
static FOCUS_STYLE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)box-shadow|border(?:-color)?\s*:|background(?:-color)?\s*:|text-decoration|outline\s*:\s*(?:[1-9]|thin|medium|thick|auto|\w+\s+(?:solid|dashed|dotted))|outline-(?:color|style)|outline-width\s*:\s*[1-9]|filter\s*:",
    )
    .unwrap()
});

static CLASS_ATTR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})"#).unwrap()
});

static ICON_BUTTON: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?is)<button\b([^>]*)>\s*(?:<svg\b[^>]*>.*?</svg>|<i\b[^>]*>\s*</i>|<img\b[^>]*>)\s*</button>",
    )
    .unwrap()
});

static ALT_TEXT: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?i)\balt\s*=\s*(?:"[^"]+"|'[^']+'|\{)"#).unwrap());

pub fn check(content: &str, file_path: &str, ext: &str) -> Vec<Finding> {
    let mut out = Vec::new();
    if is_style(ext) || is_markup(ext) || is_unknown(ext) {
        css_outline(content, file_path, &mut out);
    }
    if is_markup(ext) || is_unknown(ext) {
        tailwind_outline(content, file_path, &mut out);
        icon_buttons(content, file_path, &mut out);
    }
    out
}

fn css_outline(content: &str, file_path: &str, out: &mut Vec<Finding>) {
    let mut count = 0;
    for m in OUTLINE_OFF.find_iter(content) {
        let before = &content[..m.start()];
        let Some(open) = before.rfind('{') else { continue };
        if before[open..].contains('}') {
            continue;
        }
        let sel_start = before[..open].rfind(['}', ';', '{']).map(|i| i + 1).unwrap_or(0);
        let mut selector = before[sel_start..open].trim();
        // Inside HTML the "selector" can start after a tag or on an earlier line; keep the last line.
        if let Some(i) = selector.rfind('>') {
            selector = selector[i + 1..].trim();
        }
        if let Some(i) = selector.rfind('\n') {
            selector = selector[i + 1..].trim();
        }
        // The standard "hide the ring for the mouse only" pattern, and controls that are off.
        if selector.contains(":not(:focus-visible)")
            || selector.contains(":not(:focus)")
            || selector.contains(":disabled")
            || selector.contains("[disabled]")
            || selector.contains("::-moz-focus-inner")
            || selector.starts_with('@')
        {
            continue;
        }
        if has_focus_replacement(content) {
            continue;
        }
        out.push(finding_for(
            &crate::ROWS[ROW_FOCUS],
            file_path,
            &excerpt(&format!("{selector} {{ {} }}", m.as_str())),
            line_at(content, m.start()),
        ));
        count += 1;
        if count >= MAX_PER_FILE {
            break;
        }
    }
}

/// Some `:focus` or `:focus-visible` rule in the file sets a visible style.
fn has_focus_replacement(content: &str) -> bool {
    FOCUS_BLOCK.captures_iter(content).any(|c| {
        let selector = &c[1];
        !selector.contains(":not(:focus") && FOCUS_STYLE.is_match(&c[2])
    })
}

fn tailwind_outline(content: &str, file_path: &str, out: &mut Vec<Finding>) {
    for caps in CLASS_ATTR.captures_iter(content) {
        let whole = caps.get(0).unwrap();
        let classes = caps.get(1).or(caps.get(2)).or(caps.get(3)).map(|m| m.as_str()).unwrap_or("");
        let tokens: Vec<&str> = classes.split_whitespace().collect();
        let removes = tokens.iter().any(|t| {
            let last = t.rsplit(':').next().unwrap_or(t);
            matches!(last, "outline-none" | "outline-0") && (t.contains("focus") || *t == last)
        });
        if !removes {
            continue;
        }
        let replaced = tokens.iter().any(|t| {
            (t.contains("focus:") || t.contains("focus-visible:"))
                && !matches!(t.rsplit(':').next().unwrap_or(t), "outline-none" | "outline-0" | "outline")
        });
        if replaced {
            continue;
        }
        out.push(finding_for(
            &crate::ROWS[ROW_FOCUS],
            file_path,
            &excerpt(whole.as_str()),
            line_at(content, whole.start()),
        ));
    }
}

fn icon_buttons(content: &str, file_path: &str, out: &mut Vec<Finding>) {
    for caps in ICON_BUTTON.captures_iter(content) {
        let whole = caps.get(0).unwrap();
        let text = whole.as_str();
        let attrs = &caps[1];
        let named = attrs.contains("aria-label")
            || attrs.contains("aria-labelledby")
            || attrs.contains("title=")
            || attrs.contains("{...")
            || text.contains("<title")
            || ALT_TEXT.is_match(text);
        if named {
            continue;
        }
        out.push(finding_for(
            &crate::ROWS[ROW_ICON_BUTTON],
            file_path,
            &excerpt(text),
            line_at(content, whole.start()),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(src: &str, ext: &str) -> Vec<String> {
        check(src, "x", ext).into_iter().map(|f| f.antipattern).collect()
    }

    #[test]
    fn flags_outline_none_without_a_focus_style() {
        let css = "button {\n  outline: none;\n  background: #111;\n}\n";
        assert_eq!(ids(css, ".css"), vec!["aad-focus-removed"]);
    }

    #[test]
    fn a_focus_visible_rule_with_a_ring_is_a_replacement() {
        let css = "button { outline: none; }\nbutton:focus-visible { box-shadow: 0 0 0 3px #4af; }\n";
        assert!(ids(css, ".css").is_empty());
    }

    #[test]
    fn mouse_only_reset_pattern_is_fine() {
        let css = ".btn:focus:not(:focus-visible) { outline: none; }\n";
        assert!(ids(css, ".css").is_empty());
    }

    #[test]
    fn tailwind_outline_none_needs_a_focus_utility() {
        let bad = r#"<input class="rounded border focus:outline-none">"#;
        let ok = r#"<input class="rounded border focus:outline-none focus:ring-2 focus:ring-blue-500">"#;
        assert_eq!(ids(bad, ".html"), vec!["aad-focus-removed"]);
        assert!(ids(ok, ".html").is_empty());
    }

    #[test]
    fn icon_only_button_needs_a_name() {
        let bad = r#"<button class="x"><svg viewBox="0 0 24 24"><path d="M1 1"/></svg></button>"#;
        assert_eq!(ids(bad, ".html"), vec!["aad-icon-button-name"]);
        for ok in [
            r#"<button aria-label="Close"><svg><path d="M1"/></svg></button>"#,
            r#"<button title="Close"><svg><path d="M1"/></svg></button>"#,
            r#"<button><svg><title>Close</title><path d="M1"/></svg></button>"#,
            r#"<button><svg></svg> Close</button>"#,
            r#"<button><img src="x.png" alt="Close"></button>"#,
        ] {
            assert!(ids(ok, ".html").is_empty(), "{ok}");
        }
        assert_eq!(ids(r#"<button><img src="x.png"></button>"#, ".html"), vec!["aad-icon-button-name"]);
    }

    #[test]
    fn line_numbers_point_at_the_problem() {
        let src = "<div>\n<button><i class=\"fa fa-x\"></i></button>\n</div>";
        let f = check(src, "a.html", ".html");
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].line, 2.0);
    }
}
