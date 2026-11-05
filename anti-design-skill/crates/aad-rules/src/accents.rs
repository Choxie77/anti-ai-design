//! `aad-multiple-accents`: several unrelated accent hues competing in one file.

use crate::util::{excerpt, is_markup, is_style, is_unknown, line_at};
use crate::ROW_ACCENTS;
use anti_design_core::findings::{finding_for, Finding};
use once_cell::sync::Lazy;
use regex::Regex;

static HEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"[\s:,(]#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b").unwrap());
static RGB: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\brgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})").unwrap());
static HSL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bhsla?\(\s*(-?\d+(?:\.\d+)?)(?:deg)?[\s,]+(\d+(?:\.\d+)?)%[\s,]+(\d+(?:\.\d+)?)%").unwrap()
});

/// A color counts as an accent when it is clearly colored, not near black, white or grey.
const MIN_SATURATION: f64 = 0.45;
const MIN_LIGHTNESS: f64 = 0.2;
const MAX_LIGHTNESS: f64 = 0.85;
/// Hues within this many degrees of a cluster's first hue belong to it.
const CLUSTER_DEGREES: f64 = 20.0;
/// A hue must be used this often to count; one-off colors are not a competing accent.
const MIN_USES: usize = 2;
/// More than two non-status accent hues is a palette without a lead.
const MAX_ACCENTS: usize = 2;

struct Color {
    hue: f64,
    offset: usize,
    text: String,
}

/// Reds, greens and ambers carry error, success and warning meaning; they are not "the accent".
fn is_status_hue(h: f64) -> bool {
    h >= 350.0 || h <= 12.0 || (95.0..=155.0).contains(&h) || (38.0..=58.0).contains(&h)
}

fn hsl(r: f64, g: f64, b: f64) -> (f64, f64, f64) {
    let (r, g, b) = (r / 255.0, g / 255.0, b / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;
    if (max - min).abs() < f64::EPSILON {
        return (0.0, 0.0, l);
    }
    let d = max - min;
    let s = if l > 0.5 { d / (2.0 - max - min) } else { d / (max + min) };
    let h = if (max - r).abs() < f64::EPSILON {
        ((g - b) / d) % 6.0
    } else if (max - g).abs() < f64::EPSILON {
        (b - r) / d + 2.0
    } else {
        (r - g) / d + 4.0
    };
    (((h * 60.0) + 360.0) % 360.0, s, l)
}

fn push(colors: &mut Vec<Color>, offset: usize, text: &str, (h, s, l): (f64, f64, f64)) {
    if s >= MIN_SATURATION && (MIN_LIGHTNESS..=MAX_LIGHTNESS).contains(&l) && !is_status_hue(h) {
        colors.push(Color { hue: h, offset, text: text.to_string() });
    }
}

fn collect(content: &str) -> Vec<Color> {
    let mut colors = Vec::new();
    for c in HEX.captures_iter(content) {
        let m = c.get(1).unwrap();
        let hex = m.as_str();
        let full: String = if hex.len() == 3 { hex.chars().flat_map(|ch| [ch, ch]).collect() } else { hex.to_string() };
        let v = |i: usize| u8::from_str_radix(&full[i..i + 2], 16).unwrap_or(0) as f64;
        push(&mut colors, m.start(), &format!("#{hex}"), hsl(v(0), v(2), v(4)));
    }
    for c in RGB.captures_iter(content) {
        let m = c.get(0).unwrap();
        let n = |i: usize| c[i].parse::<f64>().unwrap_or(0.0).min(255.0);
        push(&mut colors, m.start(), m.as_str(), hsl(n(1), n(2), n(3)));
    }
    for c in HSL.captures_iter(content) {
        let m = c.get(0).unwrap();
        let h: f64 = c[1].parse().unwrap_or(0.0);
        let s: f64 = c[2].parse::<f64>().unwrap_or(0.0) / 100.0;
        let l: f64 = c[3].parse::<f64>().unwrap_or(0.0) / 100.0;
        push(&mut colors, m.start(), m.as_str(), (((h % 360.0) + 360.0) % 360.0, s, l));
    }
    colors.sort_by_key(|c| c.offset);
    colors
}

fn hue_distance(a: f64, b: f64) -> f64 {
    let d = (a - b).abs() % 360.0;
    d.min(360.0 - d)
}

pub fn check(content: &str, file_path: &str, ext: &str) -> Vec<Finding> {
    if !(is_style(ext) || is_markup(ext) || is_unknown(ext)) {
        return Vec::new();
    }
    let colors = collect(content);
    // Cluster in first-seen order: each hue joins the first cluster within reach.
    let mut clusters: Vec<(f64, Vec<&Color>)> = Vec::new();
    for c in &colors {
        match clusters.iter_mut().find(|(h, _)| hue_distance(*h, c.hue) <= CLUSTER_DEGREES) {
            Some((_, members)) => members.push(c),
            None => clusters.push((c.hue, vec![c])),
        }
    }
    let used: Vec<_> = clusters.iter().filter(|(_, m)| m.len() >= MIN_USES).collect();
    if used.len() <= MAX_ACCENTS {
        return Vec::new();
    }
    let hues: Vec<String> = used.iter().map(|(h, _)| format!("{}°", h.round())).collect();
    let samples: Vec<&str> = used.iter().map(|(_, m)| m[0].text.as_str()).collect();
    // Report at the first color that belongs to a counted hue.
    let first = used.iter().map(|(_, m)| m[0].offset).min().unwrap_or(0);
    vec![finding_for(
        &crate::ROWS[ROW_ACCENTS],
        file_path,
        &excerpt(&format!("{} accent hues ({}), e.g. {}", used.len(), hues.join(", "), samples.join(", "))),
        line_at(content, first),
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn css(colors: &[&str]) -> String {
        colors.iter().map(|c| format!(".a {{ color: {c}; }}\n")).collect()
    }

    #[test]
    fn three_competing_accent_hues_are_flagged() {
        // violet x2, orange x2, teal x2
        let f = check(&css(&["#6d28d9", "#7c3aed", "#ea580c", "#f97316", "#0d9488", "#14b8a6"]), "a.css", ".css");
        assert_eq!(f.len(), 1, "{f:?}");
        assert_eq!(f[0].antipattern, "aad-multiple-accents");
        assert!(f[0].snippet.starts_with("3 accent hues"), "{}", f[0].snippet);
    }

    #[test]
    fn one_accent_and_status_colors_are_fine() {
        // blue accent, red error, green success, amber warning, greys
        let f = check(&css(&["#2563eb", "#1d4ed8", "#dc2626", "#16a34a", "#f59e0b", "#6b7280", "#111827", "#ffffff"]), "a.css", ".css");
        assert!(f.is_empty(), "{f:?}");
    }

    #[test]
    fn one_off_colors_do_not_count() {
        let f = check(&css(&["#2563eb", "#1d4ed8", "#9333ea", "#0d9488"]), "a.css", ".css");
        assert!(f.is_empty(), "{f:?}");
    }

    #[test]
    fn rgb_and_hsl_notations_are_read() {
        let src = ".a{color:rgb(37,99,235)}.b{color:rgb(30,80,220)}.c{color:hsl(280 70% 50%)}.d{color:hsl(285 65% 45%)}.e{color:hsl(175, 70%, 40%)}.f{color:hsl(170, 75%, 35%)}";
        assert_eq!(check(src, "a.css", ".css").len(), 1);
    }

    #[test]
    fn anchors_and_ids_are_not_colors() {
        let html = r##"<a href="#abc">x</a><a href="#bad">y</a><a href="#fed">z</a><div id="#add"></div>"##;
        assert!(check(html, "a.html", ".html").is_empty());
    }
}
