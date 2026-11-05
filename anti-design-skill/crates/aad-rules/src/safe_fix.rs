//! The safe-fix tier: mechanical, behaviour-preserving rewrites for detector findings.
//!
//! Everything here is a pure function over text. Nothing reads or writes a file,
//! runs the detector or knows about the command line; `crates/cli/src/safe_fix.rs`
//! does that. A fix is "safe" when it is a plain text rewrite that needs no taste
//! decision and can be checked by reading the diff. When a fix is not sure, it
//! declines and the finding stays advice.
//!
//! Fixes in this tier:
//!
//! * [`GRADIENT_TEXT`] (`gradient-text`), in two shapes: a CSS rule or `style`
//!   attribute that paints text through `background-clip: text`, and a Tailwind class
//!   list (`bg-clip-text bg-gradient-to-r from-X ... text-transparent`).
//!   Both become a solid colour.

use once_cell::sync::Lazy;
use regex::Regex;

/// Registry id of the rule the gradient-text fixes answer to.
pub const GRADIENT_TEXT: &str = "gradient-text";

/// Which parts of a file the detector reported a finding for. A fix is only allowed
/// where the finding is, so project ignores and inline waivers keep working.
#[derive(Debug, Clone, Default)]
pub struct Scope {
    /// The detector reported the rule with no line (static HTML scans do): anywhere
    /// in the file counts.
    pub whole_file: bool,
    /// 1-based lines the detector reported.
    pub lines: Vec<usize>,
}

impl Scope {
    /// Whether a span covering `first..=last` (1-based lines) is covered.
    fn covers(&self, first: usize, last: usize) -> bool {
        self.whole_file || self.lines.iter().any(|l| *l >= first && *l <= last)
    }
}

/// One applied change, for the report and the run log.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Applied {
    pub rule: &'static str,
    /// 1-based line where the changed span starts.
    pub line: usize,
    /// Plain-language description, for example `gradient text -> color #6366f1`.
    pub detail: String,
}

/// The result of running the fixes over one file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixOutcome {
    pub new_content: String,
    pub applied: Vec<Applied>,
}

#[derive(Debug)]
struct Edit {
    start: usize,
    end: usize,
    replacement: String,
}

/// Run every safe fix in this tier over `content`. `ext` is the lowercase extension
/// with its dot (`.css`, `.html`, ...). Files with no applicable fix come back
/// unchanged with an empty `applied`.
pub fn fix_text(content: &str, ext: &str, scope: &Scope) -> FixOutcome {
    let mut applied = Vec::new();
    let mut edits: Vec<Edit> = Vec::new();
    if matches!(ext, ".css" | ".scss" | ".sass" | ".less" | ".html" | ".htm" | ".vue" | ".svelte" | ".astro" | ".jsx" | ".tsx" | ".js" | ".ts" | ".php") {
        let masked = mask_comments(content);
        gradient_css(content, &masked, scope, &mut edits, &mut applied);
        gradient_tailwind(content, &masked, scope, &mut edits, &mut applied);
    }
    let mut new_content = content.to_string();
    // Two deletions can claim the same space between declarations; merge them first.
    edits.sort_by_key(|e| (e.start, e.end));
    let mut merged: Vec<Edit> = Vec::new();
    for e in edits {
        match merged.last_mut() {
            Some(prev) if e.start < prev.end && prev.replacement.is_empty() && e.replacement.is_empty() => prev.end = prev.end.max(e.end),
            _ => merged.push(e),
        }
    }
    let mut edits = merged;
    // Apply from the end so earlier offsets stay valid.
    edits.reverse();
    for e in &edits {
        new_content.replace_range(e.start..e.end, &e.replacement);
    }
    applied.sort_by_key(|a| a.line);
    FixOutcome { new_content, applied }
}

/// `content` with comments overwritten by spaces (newlines and byte length kept), so a
/// commented-out rule is never fixed and offsets still index the original.
fn mask_comments(content: &str) -> String {
    static COMMENT: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?s)/\*.*?\*/|<!--.*?-->").unwrap());
    let mut bytes = content.as_bytes().to_vec();
    for m in COMMENT.find_iter(content) {
        for b in &mut bytes[m.start()..m.end()] {
            if *b != b'\n' {
                *b = b' ';
            }
        }
    }
    // Whole comments (whole chars) became ASCII spaces, so the bytes are still valid UTF-8.
    String::from_utf8(bytes).unwrap_or_else(|_| content.to_string())
}

fn line_of(content: &str, offset: usize) -> usize {
    content.as_bytes()[..offset.min(content.len())].iter().filter(|b| **b == b'\n').count() + 1
}

// ---------------------------------------------------------------------------
// gradient text, CSS
// ---------------------------------------------------------------------------

/// One `name: value` declaration inside a block, with its byte span in the file
/// (the span includes the trailing `;` when there is one).
struct Decl {
    start: usize,
    end: usize,
    name: String,
    value: String,
}

fn declarations(content: &str, inner_start: usize, inner_end: usize) -> Vec<Decl> {
    let text = &content[inner_start..inner_end];
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut depth = 0i32;
    let mut quote: Option<u8> = None;
    let mut seg_start = 0usize;
    let push = |s: usize, e: usize, out: &mut Vec<Decl>| {
        let seg = &text[s..e];
        let body = seg.trim_end_matches(';');
        if let Some(colon) = body.find(':') {
            let name = body[..colon].trim().to_ascii_lowercase();
            if !name.is_empty() && !name.contains(char::is_whitespace) {
                out.push(Decl { start: inner_start + s, end: inner_start + e, name, value: body[colon + 1..].trim().to_string() });
            }
        }
    };
    for (i, &b) in bytes.iter().enumerate() {
        match quote {
            Some(q) => {
                if b == q {
                    quote = None;
                }
            }
            None => match b {
                b'"' | b'\'' => quote = Some(b),
                b'(' => depth += 1,
                b')' => depth -= 1,
                b';' if depth <= 0 => {
                    // Leading whitespace belongs to the previous gap, not this declaration.
                    let lead = text[seg_start..i + 1].len() - text[seg_start..i + 1].trim_start().len();
                    push(seg_start + lead, i + 1, &mut out);
                    seg_start = i + 1;
                }
                _ => {}
            },
        }
    }
    if seg_start < text.len() && !text[seg_start..].trim().is_empty() {
        let tail = &text[seg_start..];
        let lead = tail.len() - tail.trim_start().len();
        let trail = tail.trim_end().len();
        push(seg_start + lead, seg_start + trail, &mut out);
    }
    out
}

static GRADIENT_FN: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^(?:repeating-)?(?:linear|radial|conic)-gradient\(").unwrap());

/// Split `s` on commas at paren depth 0.
fn split_top_level(s: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut depth = 0i32;
    let mut start = 0;
    for (i, c) in s.char_indices() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => {
                out.push(&s[start..i]);
                start = i + 1;
            }
            _ => {}
        }
    }
    out.push(&s[start..]);
    out
}

/// The text between the `(` that opens the call at the start of `s` and its matching
/// `)`, plus whatever follows the `)`. `None` when parentheses do not balance.
fn call_args(s: &str) -> Option<(&str, &str)> {
    let open = s.find('(')?;
    let mut depth = 0i32;
    for (i, c) in s[open..].char_indices() {
        match c {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    return Some((&s[open + 1..open + i], &s[open + i + 1..]));
                }
            }
            _ => {}
        }
    }
    None
}

static HEX_COLOR: Lazy<Regex> = Lazy::new(|| Regex::new(r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$").unwrap());
static NAMED_COLOR: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[a-zA-Z]{3,20}$").unwrap());
static COLOR_FN: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|var)\(").unwrap());
static ANGLE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^-?\d*\.?\d+(?:deg|grad|rad|turn)$").unwrap());

/// Words that are not colours but can stand where a colour stop would, or that make the
/// fix pointless (a transparent first stop would hide the text).
const NOT_A_COLOR: &[&str] = &["transparent", "currentcolor", "inherit", "initial", "unset", "none", "auto", "circle", "ellipse", "closest", "farthest", "at", "to", "in", "from"];

/// The first colour stop of a gradient's argument list, as written, or `None` when it
/// cannot be told for certain.
fn first_color_stop(args: &str) -> Option<String> {
    let parts = split_top_level(args);
    for part in parts {
        let p = part.trim();
        if p.is_empty() {
            return None;
        }
        let first_word = p.split_whitespace().next()?;
        let lower = first_word.to_ascii_lowercase();
        // The leading direction / shape / colour-space argument is not a colour stop.
        let is_prelude = lower == "to"
            || lower == "in"
            || lower == "from"
            || lower == "at"
            || ANGLE.is_match(&lower)
            || matches!(lower.as_str(), "circle" | "ellipse" | "closest-side" | "closest-corner" | "farthest-side" | "farthest-corner");
        if is_prelude {
            continue;
        }
        let color = if COLOR_FN.is_match(p) {
            let (_, rest) = call_args(p)?;
            p[..p.len() - rest.len()].trim().to_string()
        } else {
            first_word.to_string()
        };
        let lc = color.to_ascii_lowercase();
        let ok = HEX_COLOR.is_match(&color) || COLOR_FN.is_match(&color) || (NAMED_COLOR.is_match(&color) && !NOT_A_COLOR.contains(&lc.as_str()));
        return if ok { Some(color) } else { None };
    }
    None
}

/// `Some(color)` when `value` is exactly one gradient function (optionally
/// `!important`) with a readable first colour stop.
fn solid_from_gradient(value: &str) -> Option<(String, bool)> {
    let v = value.trim();
    if !GRADIENT_FN.is_match(v) {
        return None;
    }
    let (args, rest) = call_args(v)?;
    let rest = rest.trim();
    let important = rest.eq_ignore_ascii_case("!important");
    if !rest.is_empty() && !important {
        return None;
    }
    first_color_stop(args).map(|c| (c, important))
}

fn is_transparent(value: &str) -> bool {
    let v = value.trim().trim_end_matches("!important").trim().to_ascii_lowercase().replace(' ', "");
    v == "transparent" || v == "rgba(0,0,0,0)" || v == "#0000" || v == "#00000000"
}

fn gradient_css(original: &str, masked: &str, scope: &Scope, edits: &mut Vec<Edit>, applied: &mut Vec<Applied>) {
    static BLOCK: Lazy<Regex> = Lazy::new(|| Regex::new(r"\{[^{}]*\}").unwrap());
    static STYLE_ATTR: Lazy<Regex> = Lazy::new(|| Regex::new(r#"(?is)\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')"#).unwrap());

    let mut spans: Vec<(usize, usize)> = Vec::new();
    for m in BLOCK.find_iter(masked) {
        spans.push((m.start() + 1, m.end() - 1));
    }
    for c in STYLE_ATTR.captures_iter(masked) {
        if let Some(g) = c.get(1).or_else(|| c.get(2)) {
            spans.push((g.start(), g.end()));
        }
    }
    for (s, e) in spans {
        // Work on the masked text for structure, but cut the original's bytes.
        let decls = declarations(masked, s, e);
        if let Some(fix) = plan_gradient_block(original, &decls) {
            let (first, last) = (line_of(original, s), line_of(original, e));
            if !scope.covers(first, last) {
                continue;
            }
            let line = line_of(original, fix.line_offset);
            applied.push(Applied { rule: GRADIENT_TEXT, line, detail: fix.detail });
            edits.extend(fix.edits);
        }
    }
}

struct BlockFix {
    edits: Vec<Edit>,
    detail: String,
    line_offset: usize,
}

fn plan_gradient_block(original: &str, decls: &[Decl]) -> Option<BlockFix> {
    let clip: Vec<&Decl> = decls.iter().filter(|d| (d.name == "background-clip" || d.name == "-webkit-background-clip") && d.value.trim().to_ascii_lowercase().starts_with("text")).collect();
    if clip.is_empty() {
        return None;
    }
    let grads: Vec<&Decl> = decls.iter().filter(|d| (d.name == "background" || d.name == "background-image") && GRADIENT_FN.is_match(d.value.trim())).collect();
    // One gradient declaration, and no other background fill that the fix would leave behind.
    if grads.len() != 1 {
        return None;
    }
    let other_bg = decls.iter().any(|d| (d.name == "background" || d.name == "background-image" || d.name == "background-color") && !std::ptr::eq(d, grads[0]));
    if other_bg {
        return None;
    }
    let (color, important) = solid_from_gradient(&grads[0].value)?;

    let mut remove: Vec<&Decl> = clip;
    let mut keep_existing_color = false;
    for d in decls {
        match d.name.as_str() {
            "-webkit-text-fill-color" | "-moz-text-fill-color" => {
                if !is_transparent(&d.value) {
                    return None;
                }
                remove.push(d);
            }
            "color" => {
                if is_transparent(&d.value) {
                    remove.push(d);
                } else {
                    keep_existing_color = true;
                }
            }
            _ => {}
        }
    }

    let mut edits = Vec::new();
    let g = grads[0];
    if keep_existing_color {
        remove.push(g);
    } else {
        let imp = if important { " !important" } else { "" };
        edits.push(Edit { start: g.start, end: g.end, replacement: format!("color: {color}{imp};") });
    }
    for d in &remove {
        edits.push(delete_span(original, d.start, d.end));
    }
    let detail = if keep_existing_color {
        "gradient text -> the color the rule already sets".to_string()
    } else {
        format!("gradient text -> color {color}")
    };
    Some(BlockFix { edits, detail, line_offset: g.start })
}

/// Deleting a declaration also takes its line when nothing else is on it, and otherwise the
/// spaces after it, so no empty line or double space is left behind.
fn delete_span(original: &str, start: usize, end: usize) -> Edit {
    let line_start = original[..start].rfind('\n').map_or(0, |i| i + 1);
    let line_end = original[end..].find('\n').map_or(original.len(), |i| end + i);
    let before_blank = original[line_start..start].trim().is_empty();
    let after_blank = original[end..line_end].trim().is_empty();
    if before_blank && after_blank {
        let take_newline = if line_end < original.len() { 1 } else { 0 };
        return Edit { start: line_start, end: line_end + take_newline, replacement: String::new() };
    }
    let mut e = end;
    while original.as_bytes().get(e).is_some_and(|b| *b == b' ' || *b == b'\t') {
        e += 1;
    }
    // Nothing followed it but the end of the container: take the space before it instead.
    let mut st = start;
    if e == end && matches!(original.as_bytes().get(e), None | Some(b'"' | b'\'' | b'}')) {
        while st > 0 && matches!(original.as_bytes()[st - 1], b' ' | b'\t') {
            st -= 1;
        }
    }
    Edit { start: st, end: e, replacement: String::new() }
}

// ---------------------------------------------------------------------------
// gradient text, Tailwind
// ---------------------------------------------------------------------------

fn gradient_tailwind(original: &str, masked: &str, scope: &Scope, edits: &mut Vec<Edit>, applied: &mut Vec<Applied>) {
    static CLASS_ATTR: Lazy<Regex> = Lazy::new(|| Regex::new(r#"(?is)\b(?:class|className)\s*=\s*(?:"([^"{}]*)"|'([^'{}]*)')"#).unwrap());
    static COLOR_TOKEN: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(?:[a-z]+-\d{2,3}|white|black|\[#?[0-9a-fA-F]{3,8}\])$").unwrap());
    static TEXT_COLOR: Lazy<Regex> = Lazy::new(|| Regex::new(r"^text-(?:[a-z]+-\d{2,3}|white|black|\[#?[0-9a-fA-F]{3,8}\])$").unwrap());

    for c in CLASS_ATTR.captures_iter(masked) {
        let Some(g) = c.get(1).or_else(|| c.get(2)) else { continue };
        let value = g.as_str();
        let tokens: Vec<&str> = value.split_whitespace().collect();
        if !tokens.contains(&"bg-clip-text") {
            continue;
        }
        let is_gradient = |t: &&str| t.starts_with("bg-gradient-to-");
        if !tokens.iter().any(is_gradient) {
            continue;
        }
        // Variants (`dark:from-x`, `hover:...`) make the intent depend on state; leave to a human.
        let involved = |t: &&str| *t == "bg-clip-text" || *t == "text-transparent" || t.starts_with("bg-gradient-to-") || t.contains("from-") || t.contains("via-") || t.contains("to-");
        if tokens.iter().filter(|t| involved(t)).any(|t| t.contains(':')) {
            continue;
        }
        let from: Vec<&&str> = tokens.iter().filter(|t| t.starts_with("from-")).collect();
        if from.len() != 1 {
            continue;
        }
        let color = &from[0]["from-".len()..];
        if !COLOR_TOKEN.is_match(color) {
            continue;
        }
        let has_text_color = tokens.iter().any(|t| TEXT_COLOR.is_match(t));
        let mut out: Vec<String> = Vec::new();
        for t in &tokens {
            if *t == "bg-clip-text" || *t == "text-transparent" || t.starts_with("bg-gradient-to-") || t.starts_with("via-") || t.starts_with("to-") {
                continue;
            }
            if t.starts_with("from-") {
                if !has_text_color {
                    out.push(format!("text-{color}"));
                }
                continue;
            }
            out.push((*t).to_string());
        }
        let (first, last) = (line_of(original, g.start()), line_of(original, g.end()));
        if !scope.covers(first, last) {
            continue;
        }
        // Keep the original's own separator style when it was a single line of single spaces.
        let replacement = out.join(" ");
        edits.push(Edit { start: g.start(), end: g.end(), replacement });
        applied.push(Applied { rule: GRADIENT_TEXT, line: first, detail: if has_text_color { "gradient text classes removed (kept the text color class)".to_string() } else { format!("gradient text -> text-{color}") } });
    }
}

// ---------------------------------------------------------------------------
// unified diff
// ---------------------------------------------------------------------------

/// A unified diff of `old` to `new` with three lines of context, labelled with `label`
/// (`--- a/<label>`, `+++ b/<label>`). Empty when nothing differs. Files of any size are
/// handled; a pair of very large differing regions falls back to one replace hunk.
pub fn unified_diff(label: &str, old: &str, new: &str) -> String {
    if old == new {
        return String::new();
    }
    let a: Vec<&str> = old.split_inclusive('\n').collect();
    let b: Vec<&str> = new.split_inclusive('\n').collect();
    let mut pre = 0;
    while pre < a.len() && pre < b.len() && a[pre] == b[pre] {
        pre += 1;
    }
    let mut suf = 0;
    while suf < a.len() - pre && suf < b.len() - pre && a[a.len() - 1 - suf] == b[b.len() - 1 - suf] {
        suf += 1;
    }
    let (ma, mb) = (&a[pre..a.len() - suf], &b[pre..b.len() - suf]);
    // Edit script over the differing middle: (tag, line index into a or b).
    let mut ops: Vec<(char, usize)> = Vec::new();
    for i in 0..pre {
        ops.push((' ', i));
    }
    if ma.len().saturating_mul(mb.len()) > 4_000_000 {
        (0..ma.len()).for_each(|i| ops.push(('-', pre + i)));
        (0..mb.len()).for_each(|j| ops.push(('+', pre + j)));
    } else {
        let (n, m) = (ma.len(), mb.len());
        let mut lcs = vec![vec![0u32; m + 1]; n + 1];
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                lcs[i][j] = if ma[i] == mb[j] { lcs[i + 1][j + 1] + 1 } else { lcs[i + 1][j].max(lcs[i][j + 1]) };
            }
        }
        let (mut i, mut j) = (0, 0);
        while i < n || j < m {
            if i < n && j < m && ma[i] == mb[j] {
                ops.push((' ', pre + i));
                i += 1;
                j += 1;
            } else if i < n && (j == m || lcs[i + 1][j] >= lcs[i][j + 1]) {
                ops.push(('-', pre + i));
                i += 1;
            } else {
                ops.push(('+', pre + j));
                j += 1;
            }
        }
    }
    for k in 0..suf {
        ops.push((' ', a.len() - suf + k));
    }
    // Each op's index points into `a` for ' ' and '-' and into `b` for '+'.
    let mut out = format!("--- a/{label}\n+++ b/{label}\n");
    const CTX: usize = 3;
    // Positions (1-based) of each op in old and new.
    let mut old_no = Vec::with_capacity(ops.len());
    let mut new_no = Vec::with_capacity(ops.len());
    let (mut oi, mut ni) = (1usize, 1usize);
    for (tag, _) in &ops {
        old_no.push(oi);
        new_no.push(ni);
        match tag {
            ' ' => {
                oi += 1;
                ni += 1;
            }
            '-' => oi += 1,
            _ => ni += 1,
        }
    }
    let changed: Vec<usize> = ops.iter().enumerate().filter(|(_, (t, _))| *t != ' ').map(|(i, _)| i).collect();
    let mut k = 0;
    while k < changed.len() {
        let mut lo = changed[k].saturating_sub(CTX);
        let mut hi = changed[k];
        let mut last = k;
        while last + 1 < changed.len() && changed[last + 1] <= hi + 2 * CTX + 1 {
            last += 1;
            hi = changed[last];
        }
        hi = (hi + CTX).min(ops.len() - 1);
        lo = lo.min(hi);
        let (mut oc, mut nc) = (0, 0);
        let mut body = String::new();
        for &(tag, pos) in &ops[lo..=hi] {
            let text = if tag == '+' { b[pos] } else { a[pos] };
            match tag {
                ' ' => {
                    oc += 1;
                    nc += 1;
                }
                '-' => oc += 1,
                _ => nc += 1,
            }
            body.push(tag);
            body.push_str(text);
            if !text.ends_with('\n') {
                body.push_str("\n\\ No newline at end of file\n");
            }
        }
        let (ostart, nstart) = (if oc == 0 { old_no[lo] - 1 } else { old_no[lo] }, if nc == 0 { new_no[lo] - 1 } else { new_no[lo] });
        out.push_str(&format!("@@ -{},{} +{},{} @@\n{}", ostart, oc, nstart, nc, body));
        k = last + 1;
    }
    out
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn whole() -> Scope {
        Scope { whole_file: true, lines: vec![] }
    }

    #[test]
    fn safe_fix_css_block_becomes_solid_color() {
        let css = ".hero h1 {\n  font-size: 3rem;\n  background: linear-gradient(90deg, #6366f1, #ec4899);\n  -webkit-background-clip: text;\n  background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n";
        let out = fix_text(css, ".css", &whole());
        assert_eq!(out.new_content, ".hero h1 {\n  font-size: 3rem;\n  color: #6366f1;\n}\n");
        assert_eq!(out.applied.len(), 1);
        assert_eq!(out.applied[0].line, 3);
    }

    #[test]
    fn safe_fix_one_line_rule_and_style_attribute() {
        let html = "<style>.t { background-image: linear-gradient(to right, #7c3aed, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent; }</style>\n<p style=\"background: linear-gradient(red, blue); -webkit-background-clip: text; color: transparent\">x</p>\n";
        let out = fix_text(html, ".html", &whole());
        assert_eq!(out.applied.len(), 2);
        assert!(out.new_content.contains(".t { color: #7c3aed; }"), "{}", out.new_content);
        assert!(out.new_content.contains("style=\"color: red;"), "{}", out.new_content);
    }

    #[test]
    fn safe_fix_keeps_existing_color_and_radial_prelude() {
        let css = ".a {\n  color: #111;\n  background: radial-gradient(circle at top, rgb(1, 2, 3) 10%, blue);\n  background-clip: text;\n}\n.b { background: radial-gradient(circle at top, rgb(1, 2, 3) 10%, blue); background-clip: text; -webkit-text-fill-color: transparent; }\n";
        let out = fix_text(css, ".css", &whole());
        assert!(out.new_content.starts_with(".a {\n  color: #111;\n}\n"), "{}", out.new_content);
        assert!(out.new_content.contains(".b { color: rgb(1, 2, 3); }"), "{}", out.new_content);
    }

    #[test]
    fn safe_fix_declines_when_unsure() {
        // layered background, transparent first stop, unreadable stop, no gradient, commented out
        let cases = [
            ".a { background: linear-gradient(red, blue) no-repeat; background-clip: text; }",
            ".a { background: linear-gradient(transparent, blue); background-clip: text; }",
            ".a { background-image: linear-gradient(var-ish!, blue); background-clip: text; }",
            ".a { background: url(x.png); background-clip: text; }",
            ".a { background: linear-gradient(red, blue); background-clip: text; background-color: #fff; }",
            "/* .a { background: linear-gradient(red, blue); background-clip: text; } */",
            ".a { background: linear-gradient(red, blue); background-clip: text; -webkit-text-fill-color: #fff; }",
        ];
        for c in cases {
            let out = fix_text(c, ".css", &whole());
            assert!(out.applied.is_empty(), "should decline: {c}");
            assert_eq!(out.new_content, c);
        }
    }

    #[test]
    fn safe_fix_respects_finding_lines() {
        let css = ".a { background: linear-gradient(red, blue); background-clip: text; }\n\n.b { background: linear-gradient(green, blue); background-clip: text; }\n";
        let only_b = Scope { whole_file: false, lines: vec![3] };
        let out = fix_text(css, ".css", &only_b);
        assert_eq!(out.applied.len(), 1);
        assert!(out.new_content.starts_with(".a { background: linear-gradient(red, blue)"));
        assert!(out.new_content.contains(".b { color: green; }"));
        assert!(fix_text(css, ".css", &Scope::default()).applied.is_empty());
    }

    #[test]
    fn safe_fix_tailwind_classes() {
        let html = "<h2 class=\"bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 text-transparent text-3xl font-bold\">Yo</h2>\n<h3 class=\"dark:from-red-500 bg-clip-text bg-gradient-to-r from-purple-500 text-transparent\">no</h3>\n";
        let out = fix_text(html, ".html", &whole());
        assert_eq!(out.applied.len(), 1);
        assert!(out.new_content.starts_with("<h2 class=\"text-3xl font-bold text-purple-500\">Yo</h2>") || out.new_content.starts_with("<h2 class=\"text-purple-500 text-3xl font-bold\">Yo</h2>"), "{}", out.new_content);
        assert!(out.new_content.contains("dark:from-red-500 bg-clip-text"));
    }

    #[test]
    fn safe_fix_is_idempotent() {
        let css = "a { background: linear-gradient(red, blue); background-clip: text; color: transparent; }\n";
        let once = fix_text(css, ".css", &whole());
        assert_eq!(once.applied.len(), 1);
        let twice = fix_text(&once.new_content, ".css", &whole());
        assert!(twice.applied.is_empty());
        assert_eq!(twice.new_content, once.new_content);
    }

    #[test]
    fn safe_fix_diff_is_unified() {
        let old = "a\nb\nc\nd\ne\nf\ng\nh\n";
        let new = "a\nb\nc\nX\ne\nf\ng\nh\n";
        let d = unified_diff("f.txt", old, new);
        assert_eq!(d, "--- a/f.txt\n+++ b/f.txt\n@@ -1,7 +1,7 @@\n a\n b\n c\n-d\n+X\n e\n f\n g\n");
        assert_eq!(unified_diff("f.txt", old, old), "");
        let del = unified_diff("f.txt", "x\ny\nz\n", "x\nz\n");
        assert!(del.contains("@@ -1,3 +1,2 @@\n x\n-y\n z\n"), "{del}");
    }
}
