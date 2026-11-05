//! `anti-design detect --fix [--write]`: the safe-fix tier.
//!
//! Plain `detect` never reaches this module. With `--fix` the verb runs the normal
//! detector (so project config, inline `anti-design-disable` comments and DESIGN.md
//! all apply), keeps the findings that have a registered safe fix
//! (`anti_design_aad_rules::safe_fix`), and offers the rewrite only where a finding is.
//!
//! * No `--write`: dry run. A unified diff goes to stdout, a summary to stderr, and
//!   nothing on disk changes (no source file, no run log, no folder).
//! * `--write` (which implies `--fix`): the files are rewritten and every applied fix
//!   appends one line to `<cwd>/<CONTEXT_DIR>/<CHANGELOG_FILE>`. The log is append-only.
//! * Idempotence needs no bookkeeping: an applied fix removes its finding, so a second
//!   run finds nothing to change and logs nothing.
//!
//! Exit code: 0 when the run completed (preview or write), 1 when a file could not be
//! scanned, read or written, or the arguments are not valid in fix mode.

use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};

use anti_design_aad_rules::safe_fix::{fix_text, unified_diff, Applied, Scope};
use anti_design_common::Io;
use anti_design_detect::Engines;

/// The project folder the run log lives in. One constant, so the later rename to
/// `.anti-ai-design` is a one-line change. (Same value the live and context code use.)
pub const CONTEXT_DIR: &str = anti_design_live::paths::ANTI_DESIGN_DIR;
/// The run log's file name inside [`CONTEXT_DIR`].
pub const CHANGELOG_FILE: &str = "changelog.md";

/// Flags that switch `detect` into fix mode.
pub fn wants_fix(args: &[String]) -> bool {
    args.iter().any(|a| a == "--fix" || a == "--write")
}

/// Flags whose next argument is their value, so it is not a scan target.
const VALUE_FLAGS: &[&str] = &["--scope", "--viewport", "--target", "--cdp"];

struct FileChange {
    path: PathBuf,
    label: String,
    old: String,
    new: String,
    applied: Vec<Applied>,
}

/// Run fix mode. `args` are the arguments after `detect`, containing `--fix` and/or `--write`.
pub fn run(args: &[String], io: &mut Io, engines: &Engines) -> i32 {
    let write = args.iter().any(|a| a == "--write");

    // Fix mode needs real files, and a human-readable report.
    let mut detect_args: Vec<String> = vec!["--json".to_string()];
    let mut targets = 0usize;
    let mut skip_value = false;
    for a in args {
        if skip_value {
            skip_value = false;
            detect_args.push(a.clone());
            continue;
        }
        match a.as_str() {
            "--fix" | "--write" | "--quiet" | "--json" => {}
            "--github" | "--list-rules" | "--cdp" => {
                io.err(&format!("Error: {a} cannot be used with --fix or --write; they rewrite local files\n"));
                return 1;
            }
            f if VALUE_FLAGS.contains(&f) => {
                skip_value = true;
                detect_args.push(a.clone());
            }
            f if f.starts_with("--") => detect_args.push(a.clone()),
            t => {
                let lower = t.to_ascii_lowercase();
                if lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("file://") {
                    io.err("Error: --fix and --write rewrite local files; a URL cannot be fixed\n");
                    return 1;
                }
                targets += 1;
                detect_args.push(a.clone());
            }
        }
    }
    if targets == 0 {
        detect_args.push(".".to_string());
    }

    // The ordinary detector pass, captured.
    let (mut cap_io, cap) = Io::captured("", io.cwd.clone(), io.env.clone());
    let detect_code = anti_design_detect::run_detect(&detect_args, &mut cap_io, engines);
    let detect_err = String::from_utf8_lossy(&cap.stderr.borrow()).into_owned();
    let detect_out = String::from_utf8_lossy(&cap.stdout.borrow()).into_owned();
    if !detect_err.is_empty() {
        io.err(&detect_err);
    }
    let mut failed = detect_code == 1;
    let findings: Vec<serde_json::Value> = match serde_json::from_str(detect_out.trim()) {
        Ok(serde_json::Value::Array(v)) => v,
        _ => {
            if detect_out.trim().is_empty() && failed {
                Vec::new()
            } else {
                io.err("Error: could not read the detector's findings\n");
                return 1;
            }
        }
    };

    // Findings the fix registry answers to, grouped by file.
    let mut by_file: BTreeMap<String, Scope> = BTreeMap::new();
    let mut total_findings = 0usize;
    for f in &findings {
        if f.get("antipattern").and_then(|v| v.as_str()) != Some(anti_design_aad_rules::safe_fix::GRADIENT_TEXT) {
            continue;
        }
        let Some(file) = f.get("file").and_then(|v| v.as_str()) else { continue };
        total_findings += 1;
        let scope = by_file.entry(file.to_string()).or_default();
        let line = f.get("line").and_then(|v| v.as_f64()).unwrap_or(0.0);
        if line >= 1.0 {
            scope.lines.push(line as usize);
        } else {
            scope.whole_file = true;
        }
    }

    let mut changes: Vec<FileChange> = Vec::new();
    for (file, scope) in &by_file {
        let path = resolve(&io.cwd, file);
        let old = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                io.err(&format!("Error: cannot read {file}: {e}\n"));
                failed = true;
                continue;
            }
        };
        let ext = ext_of(&path);
        let outcome = fix_text(&old, &ext, scope);
        if outcome.applied.is_empty() || outcome.new_content == old {
            continue;
        }
        changes.push(FileChange { label: label_for(&io.cwd, &path), path, old, new: outcome.new_content, applied: outcome.applied });
    }

    for c in &changes {
        io.out(&unified_diff(&c.label, &c.old, &c.new));
    }

    let fixes: usize = changes.iter().map(|c| c.applied.len()).sum();
    if changes.is_empty() {
        io.err(&format!(
            "No safe fixes to apply{}.\n",
            if total_findings > 0 { format!(" ({} need a manual change)", noun(total_findings, "gradient-text finding", "gradient-text findings")) } else { String::new() }
        ));
        return i32::from(failed);
    }

    if !write {
        io.err(&format!(
            "{} in {} (dry run, nothing was changed). Run again with --write to apply.\n",
            noun(fixes, "safe fix", "safe fixes"),
            noun(changes.len(), "file", "files")
        ));
        return i32::from(failed);
    }

    // Write the files, then log what was actually written.
    let mut log_lines: Vec<String> = Vec::new();
    let stamp = utc_stamp();
    let mut written = 0usize;
    for c in &changes {
        match std::fs::write(&c.path, &c.new) {
            Ok(()) => {
                written += c.applied.len();
                for a in &c.applied {
                    log_lines.push(format!("- {stamp} | {} | {}:{} | {}\n", a.rule, c.label, a.line, a.detail));
                }
            }
            Err(e) => {
                io.err(&format!("Error: cannot write {}: {e}\n", c.label));
                failed = true;
            }
        }
    }
    if let Err(e) = append_log(&io.cwd, &log_lines) {
        io.err(&format!("Error: the fixes were written but the run log could not be updated: {e}\n"));
        failed = true;
    }
    io.err(&format!("Applied {} in {}. Logged to {CONTEXT_DIR}/{CHANGELOG_FILE}.\n", noun(written, "safe fix", "safe fixes"), noun(changes.len(), "file", "files")));
    i32::from(failed)
}

fn noun(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

fn resolve(cwd: &Path, file: &str) -> PathBuf {
    let p = Path::new(file);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        cwd.join(p)
    }
}

fn ext_of(path: &Path) -> String {
    path.extension().map(|e| format!(".{}", e.to_string_lossy().to_ascii_lowercase())).unwrap_or_default()
}

/// The path as shown in diffs and the log: relative to the cwd when inside it.
fn label_for(cwd: &Path, path: &Path) -> String {
    let inside = |c: &Path, p: &Path| p.strip_prefix(c).ok().map(|r| r.to_string_lossy().into_owned());
    // cwd and the finding's path may differ by a symlink (macOS /var vs /private/var).
    let rel = inside(cwd, path).or_else(|| inside(&cwd.canonicalize().ok()?, &path.canonicalize().ok()?));
    rel.unwrap_or_else(|| path.to_string_lossy().into_owned()).replace('\\', "/")
}

const CHANGELOG_HEADER: &str = "# Anti-AI Design changelog\n\nOne line per automatic fix applied with `detect --fix --write`: time (UTC) | rule | file:line | what changed.\nAppend-only. Delete lines only by hand.\n\n";

/// Append `lines` to the run log, creating the folder and the header on first use. Does
/// nothing (creates nothing) for an empty list.
fn append_log(cwd: &Path, lines: &[String]) -> std::io::Result<()> {
    if lines.is_empty() {
        return Ok(());
    }
    let dir = cwd.join(CONTEXT_DIR);
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(CHANGELOG_FILE);
    let is_new = !path.exists();
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&path)?;
    if is_new {
        f.write_all(CHANGELOG_HEADER.as_bytes())?;
    }
    for l in lines {
        f.write_all(l.as_bytes())?;
    }
    Ok(())
}

/// `2026-11-05T12:34:56Z` for the current time.
fn utc_stamp() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) as i64;
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}
