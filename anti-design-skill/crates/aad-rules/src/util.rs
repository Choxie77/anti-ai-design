//! Small helpers shared by the rules.

/// 1-based line number of a byte offset.
pub fn line_at(content: &str, offset: usize) -> f64 {
    let end = offset.min(content.len());
    (content.as_bytes()[..end].iter().filter(|b| **b == b'\n').count() + 1) as f64
}

/// A one-line, length-limited excerpt for a finding.
pub fn excerpt(text: &str) -> String {
    let flat: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() <= 120 {
        flat
    } else {
        let cut: String = flat.chars().take(117).collect();
        format!("{cut}...")
    }
}

/// Files that carry markup (HTML-like templates and JSX).
pub fn is_markup(ext: &str) -> bool {
    matches!(
        ext,
        ".html" | ".htm" | ".vue" | ".svelte" | ".astro" | ".jsx" | ".tsx" | ".js" | ".mdx"
    )
}

/// Files that carry stylesheets.
pub fn is_style(ext: &str) -> bool {
    matches!(ext, ".css" | ".scss" | ".sass" | ".less")
}

/// Text that arrives without a file extension (standard input).
pub fn is_unknown(ext: &str) -> bool {
    ext.is_empty()
}

/// Skip minified or generated files: one very long line.
pub fn looks_minified(content: &str) -> bool {
    content.lines().any(|l| l.len() > 20_000)
}
