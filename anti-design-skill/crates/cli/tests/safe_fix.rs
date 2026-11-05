//! `anti-design detect --fix [--write]`, the safe-fix tier, through the real binary:
//! dry run prints a diff and writes nothing, `--write` applies, a second run is a no-op,
//! and the run log gets exactly one entry per applied fix.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const GRADIENT_CSS: &str = ".hero h1 {\n  font-size: 3rem;\n  background: linear-gradient(90deg, #6366f1, #ec4899);\n  -webkit-background-clip: text;\n  background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n";
const FIXED_CSS: &str = ".hero h1 {\n  font-size: 3rem;\n  color: #6366f1;\n}\n";

/// A fresh project folder under the cargo target tmp dir.
fn project(name: &str) -> PathBuf {
    let dir = Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("safe_fix_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn aad(dir: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_anti-design"))
        .args(args)
        .current_dir(dir)
        .env("HOME", dir)
        .env("NO_COLOR", "1")
        .env("ANTI_DESIGN_NO_UPDATE_CHECK", "1")
        .output()
        .expect("run anti-design")
}

fn log_entries(dir: &Path) -> Vec<String> {
    let p = dir.join(".anti-design").join("changelog.md");
    fs::read_to_string(p).map(|s| s.lines().filter(|l| l.starts_with("- ")).map(str::to_string).collect()).unwrap_or_default()
}

#[test]
fn safe_fix_dry_run_prints_a_diff_and_changes_nothing() {
    let dir = project("dry");
    fs::write(dir.join("a.css"), GRADIENT_CSS).unwrap();
    let out = aad(&dir, &["detect", "--fix", "a.css"]);
    assert_eq!(out.status.code(), Some(0), "{}", String::from_utf8_lossy(&out.stderr));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.starts_with("--- a/a.css\n+++ b/a.css\n@@ "), "{stdout}");
    assert!(stdout.contains("-  background: linear-gradient(90deg, #6366f1, #ec4899);"), "{stdout}");
    assert!(stdout.contains("+  color: #6366f1;"), "{stdout}");
    assert!(String::from_utf8_lossy(&out.stderr).contains("dry run, nothing was changed"));
    assert_eq!(fs::read_to_string(dir.join("a.css")).unwrap(), GRADIENT_CSS, "dry run must not touch the file");
    assert!(!dir.join(".anti-design").exists(), "dry run must not create the log folder");
}

#[test]
fn safe_fix_write_applies_and_logs_one_entry() {
    let dir = project("write");
    fs::write(dir.join("a.css"), GRADIENT_CSS).unwrap();
    let out = aad(&dir, &["detect", "--write", "a.css"]);
    assert_eq!(out.status.code(), Some(0), "{}", String::from_utf8_lossy(&out.stderr));
    assert_eq!(fs::read_to_string(dir.join("a.css")).unwrap(), FIXED_CSS);
    let entries = log_entries(&dir);
    assert_eq!(entries.len(), 1, "{entries:?}");
    assert!(entries[0].contains("| gradient-text | a.css:3 | gradient text -> color #6366f1"), "{}", entries[0]);
    // The finding is really gone, not just hidden.
    let again = aad(&dir, &["detect", "--json", "a.css"]);
    assert_eq!(String::from_utf8_lossy(&again.stdout).trim(), "[]");
}

#[test]
fn safe_fix_second_run_is_a_no_op_and_adds_no_log_line() {
    let dir = project("twice");
    fs::write(dir.join("a.css"), GRADIENT_CSS).unwrap();
    assert_eq!(aad(&dir, &["detect", "--fix", "--write", "a.css"]).status.code(), Some(0));
    let after_first = fs::read_to_string(dir.join("a.css")).unwrap();
    let log_first = fs::read_to_string(dir.join(".anti-design/changelog.md")).unwrap();

    let second = aad(&dir, &["detect", "--fix", "--write", "a.css"]);
    assert_eq!(second.status.code(), Some(0));
    assert!(second.stdout.is_empty(), "no diff on the second run: {}", String::from_utf8_lossy(&second.stdout));
    assert!(String::from_utf8_lossy(&second.stderr).contains("No safe fixes to apply"));
    assert_eq!(fs::read_to_string(dir.join("a.css")).unwrap(), after_first);
    assert_eq!(fs::read_to_string(dir.join(".anti-design/changelog.md")).unwrap(), log_first, "the log is untouched");
    assert_eq!(log_entries(&dir).len(), 1);
}

#[test]
fn safe_fix_log_appends_across_different_files_without_rewriting() {
    let dir = project("append");
    fs::write(dir.join("a.css"), GRADIENT_CSS).unwrap();
    aad(&dir, &["detect", "--write", "a.css"]);
    let first = fs::read_to_string(dir.join(".anti-design/changelog.md")).unwrap();
    fs::write(dir.join("b.css"), GRADIENT_CSS).unwrap();
    aad(&dir, &["detect", "--write", "b.css"]);
    let second = fs::read_to_string(dir.join(".anti-design/changelog.md")).unwrap();
    assert!(second.starts_with(&first), "earlier lines must stay exactly as they were");
    assert_eq!(log_entries(&dir).len(), 2);
}

#[test]
fn safe_fix_html_file_with_style_block_and_tailwind() {
    let dir = project("html");
    let html = "<!doctype html>\n<html><head><style>\n.t { background-image: linear-gradient(to right, #7c3aed, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent; }\n</style></head>\n<body><h1 class=\"t\">Hi</h1>\n<h2 class=\"bg-clip-text bg-gradient-to-r from-sky-500 to-pink-500 text-transparent text-3xl\">Yo</h2>\n</body></html>\n";
    fs::write(dir.join("b.html"), html).unwrap();
    let out = aad(&dir, &["detect", "--write", "b.html"]);
    assert_eq!(out.status.code(), Some(0), "{}", String::from_utf8_lossy(&out.stderr));
    let fixed = fs::read_to_string(dir.join("b.html")).unwrap();
    assert!(fixed.contains(".t { color: #7c3aed; }"), "{fixed}");
    assert!(fixed.contains("class=\"text-3xl text-sky-500\"") || fixed.contains("class=\"text-sky-500 text-3xl\""), "{fixed}");
    assert!(!fixed.contains("bg-clip-text") && !fixed.contains("background-clip"), "{fixed}");
    assert_eq!(log_entries(&dir).len(), 2);
}

#[test]
fn safe_fix_waived_finding_is_left_alone() {
    let dir = project("waived");
    let css = format!("/* anti-design-disable gradient-text -- brand mark */\n{GRADIENT_CSS}");
    fs::write(dir.join("a.css"), &css).unwrap();
    let out = aad(&dir, &["detect", "--write", "a.css"]);
    assert_eq!(out.status.code(), Some(0));
    assert!(out.stdout.is_empty());
    assert_eq!(fs::read_to_string(dir.join("a.css")).unwrap(), css);
    assert!(!dir.join(".anti-design").exists());
}

#[test]
fn safe_fix_declines_an_unreadable_gradient_and_says_so() {
    let dir = project("decline");
    let css = ".a {\n  background: linear-gradient(transparent, #000) no-repeat;\n  background-clip: text;\n  color: transparent;\n}\n";
    fs::write(dir.join("a.css"), css).unwrap();
    let out = aad(&dir, &["detect", "--write", "a.css"]);
    assert_eq!(out.status.code(), Some(0));
    assert!(out.stdout.is_empty());
    assert_eq!(fs::read_to_string(dir.join("a.css")).unwrap(), css);
    assert!(String::from_utf8_lossy(&out.stderr).contains("need a manual change"));
}

#[test]
fn safe_fix_refuses_urls_and_json() {
    let dir = project("refuse");
    let url = aad(&dir, &["detect", "--fix", "https://example.com"]);
    assert_eq!(url.status.code(), Some(1));
    let json = aad(&dir, &["detect", "--fix", "--list-rules"]);
    assert_eq!(json.status.code(), Some(1));
}

#[test]
fn safe_fix_plain_detect_is_unchanged_and_never_writes() {
    let dir = project("plain");
    fs::write(dir.join("a.css"), GRADIENT_CSS).unwrap();
    let out = aad(&dir, &["detect", "a.css"]);
    assert_eq!(out.status.code(), Some(2));
    assert_eq!(fs::read_to_string(dir.join("a.css")).unwrap(), GRADIENT_CSS);
    assert!(!dir.join(".anti-design").exists());
}
