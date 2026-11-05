//! String-level guards over the two launchers (`skill/scripts/anti-design`,
//! `skill/scripts/anti-design.cmd`). The .cmd cannot be executed here (no Windows),
//! so this pins the shapes a dry parse depends on: asset/URL construction in
//! both launchers agrees with `engine_binary::asset_url`, the .cmd contains
//! no multi-line parenthesized blocks (the parse-time `%var%` expansion bug
//! that made its download path dead code), both launchers carry the
//! engine-probe handshake, and the .cmd verifies downloads via certutil.

use anti_design_skills::engine_binary::{asset_url, DEFAULT_DOWNLOAD_BASE};

/// The launchers ship next to the skill they power.
fn launcher_dir() -> String {
    format!("{}/../../skill/scripts", env!("CARGO_MANIFEST_DIR"))
}

fn launcher_file(name: &str) -> String {
    let path = format!("{}/{name}", launcher_dir());
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path}: {e}"))
}

#[test]
fn sh_launcher_asset_naming_matches_engine() {
    let sh = launcher_file("anti-design");
    // The composed URL is <base>/engine-v<version>/anti-design-<os>-<arch>[.exe].
    assert!(sh.contains(&format!("ANTI_DESIGN_DOWNLOAD_BASE:-{DEFAULT_DOWNLOAD_BASE}")));
    assert!(sh.contains(r#"asset="anti-design-$os-$arch""#));
    assert!(sh.contains(r#"url="$base/engine-v$version/$asset""#));
    // Windows-on-ARM fallback, same naming the engine computes.
    let win_x64 = asset_url(DEFAULT_DOWNLOAD_BASE, "V", "windows", "x64");
    assert!(win_x64.ends_with("/engine-vV/anti-design-windows-x64.exe"));
    assert!(sh.contains(r#"url="$base/engine-v$version/anti-design-windows-x64.exe""#));
    // The PATH and unversioned home candidates are probed.
    assert!(sh.contains("engine-probe"));
    assert!(sh.contains(r#"probe_ok "$home_bin""#));
    assert!(sh.contains("probe_ok anti-design"));
    // The final error must not recommend the npm package (it still serves 3.x).
    assert!(!sh.contains("npm i -g"));
    assert!(!sh.contains("npm install"));
}

#[test]
fn cmd_launcher_asset_naming_matches_engine() {
    let cmd = launcher_file("anti-design.cmd");
    assert!(cmd.contains(DEFAULT_DOWNLOAD_BASE));
    // URL construction: expanded on straight-line statements, no blocks.
    assert!(cmd.contains(r#"set "asset=anti-design-windows-%arch%.exe""#));
    assert!(cmd.contains(r#"set "url=%ANTI_DESIGN_DOWNLOAD_BASE%/engine-v%version%/%asset%""#));
    // arm64 falls back to the x64 asset (Windows on ARM runs x64 binaries).
    assert!(cmd.contains(r#"set "asset=anti-design-windows-x64.exe""#));
    assert!(cmd.contains(r#"if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "arch=arm64""#));
    // sha256 verification via certutil against the committed manifest.
    assert!(cmd.contains("certutil -hashfile"));
    assert!(cmd.contains("engine-checksums.txt"));
    // engine-probe handshake for PATH / unversioned home candidates.
    assert!(cmd.contains("engine-probe"));
    assert!(cmd.contains(r#"findstr /b /c:"anti-design-engine""#));
    assert!(!cmd.contains("npm i -g"));
}

#[test]
fn cmd_launcher_forwards_engine_exit_code() {
    // Bare `exit /b` drops the process exit code when this file is cmd.exe's
    // entry point (cmd /c, PowerShell, Node spawn). Forward %errorlevel%
    // after each engine invocation instead.
    let cmd = launcher_file("anti-design.cmd");
    for (i, line) in cmd.lines().enumerate() {
        assert_ne!(
            line.trim(),
            "exit /b",
            "anti-design.cmd line {}: bare exit /b drops the process code: {line}",
            i + 1
        );
    }
    let forward = "exit /b %errorlevel%";
    assert_eq!(
        cmd.matches(forward).count(),
        2,
        "PATH candidate and :run must both forward the engine exit code"
    );
}

#[test]
fn cmd_launcher_has_no_multiline_parenthesized_blocks() {
    // cmd.exe expands %var% inside a parenthesized block at parse time, so a
    // `set` + read-back inside one block silently reads the pre-block value
    // (rollout review S3: the download path could never fire). The launcher
    // is written as straight-line goto flow; keep it that way.
    let cmd = launcher_file("anti-design.cmd");
    for (i, line) in cmd.lines().enumerate() {
        assert!(
            !line.trim_end().ends_with('('),
            "anti-design.cmd line {}: opens a multi-line parenthesized block: {line}",
            i + 1
        );
    }
}

#[test]
fn launchers_fail_closed_on_missing_checksum() {
    // Triage C1: a freshly downloaded binary runs only after its hash matches
    // the digest committed in engine-checksums.txt (#813); nothing published
    // beside the binary is trusted. No recorded digest, or a machine with no
    // sha256 tool, refuses the download instead of running an unverified
    // binary; a mismatch stays fatal.
    let sh = launcher_file("anti-design");
    let cmd = launcher_file("anti-design.cmd");
    assert!(sh.contains("refusing the unverified download"));
    assert!(sh.contains(r#"manifest="$dir/engine-checksums.txt""#));
    assert!(sh.contains(r#"if [ -z "$actual" ]; then"#));
    assert!(cmd.contains("refusing the unverified download"));
    assert!(cmd.contains(r#"set "manifest=%~dp0engine-checksums.txt""#));
    assert!(cmd.contains("goto verify_refuse"));
    for text in [&sh, &cmd] {
        // The digest is resolved before any download, and the sidecar is gone.
        assert!(text.contains("no checksum for engine"));
        assert!(!text.contains(".sha256"));
        // Cached binaries are hashed once; the stamp records it.
        assert!(text.contains(".verified"));
        assert!(text.contains("cannot verify the cached engine"));
        assert!(text.contains("checksum mismatch downloading"));
    }
}

#[test]
fn launchers_reference_the_same_release_channel() {
    let sh = launcher_file("anti-design");
    let cmd = launcher_file("anti-design.cmd");
    for text in [&sh, &cmd] {
        assert!(text.contains("https://github.com/OWNER/anti-design/releases"));
    }
    // Spot-check the engine's own URL builder against the launcher template.
    assert_eq!(
        asset_url(DEFAULT_DOWNLOAD_BASE, "1.2.3", "darwin", "arm64"),
        format!("{DEFAULT_DOWNLOAD_BASE}/engine-v1.2.3/anti-design-darwin-arm64")
    );
}

#[test]
fn sh_launcher_exports_skill_dir_before_the_env_bin_exec() {
    // Regression: the launcher used to `exec "$ANTI_DESIGN_BIN"` BEFORE it
    // exported ANTI_DESIGN_SKILL_DIR/SELF, so a binary reached via ANTI_DESIGN_BIN
    // ran with no skill dir and could not inline reference/*.md or read its own
    // version (native platform refs and UPDATE_AVAILABLE silently vanished).
    // The skill-behavior suite caught it; the oracle could not (it sets the env
    // directly). Guard the ordering at the string level and functionally.
    let sh = launcher_file("anti-design");
    let export_pos = sh
        .find("export ANTI_DESIGN_SKILL_DIR ANTI_DESIGN_SELF")
        .expect("launcher exports the skill-dir env");
    let env_bin_exec = sh
        .find(r#"exec "${ANTI_DESIGN_BIN}""#)
        .expect("launcher execs ANTI_DESIGN_BIN");
    assert!(
        export_pos < env_bin_exec,
        "ANTI_DESIGN_SKILL_DIR must be exported before the ANTI_DESIGN_BIN exec"
    );
}

#[cfg(unix)]
#[test]
fn sh_launcher_passes_skill_dir_to_the_env_bin() {
    use std::os::unix::fs::PermissionsExt;
    let launcher = format!("{}/anti-design", launcher_dir());
    let dir = std::env::temp_dir().join(format!("anti-design-launcher-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    // A stub "engine binary" that just prints the skill dir it was handed.
    let stub = dir.join("stub");
    std::fs::write(&stub, "#!/bin/sh\nprintf 'SKILL_DIR=%s\\n' \"${ANTI_DESIGN_SKILL_DIR:-UNSET}\"\n").unwrap();
    std::fs::set_permissions(&stub, std::fs::Permissions::from_mode(0o755)).unwrap();
    let out = std::process::Command::new("sh")
        .arg(&launcher)
        .arg("context")
        .env("ANTI_DESIGN_BIN", &stub)
        .env_remove("ANTI_DESIGN_SKILL_DIR")
        .output()
        .expect("run launcher");
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("SKILL_DIR=") && !stdout.contains("SKILL_DIR=UNSET") && !stdout.contains("SKILL_DIR=\n"),
        "launcher must export a non-empty ANTI_DESIGN_SKILL_DIR to the ANTI_DESIGN_BIN binary; got: {stdout}"
    );
    let _ = std::fs::remove_dir_all(&dir);
}
