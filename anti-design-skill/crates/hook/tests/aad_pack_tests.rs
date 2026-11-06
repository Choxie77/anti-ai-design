//! The design hook runs the first-party `aad-*` rule pack once the binary has installed it,
//! the same way `detect` does. Lives in its own test binary because the installed pack is
//! process-wide state.

use anti_ai_design_hook::hook_lib::{detector_detect_text, HookScanOptions};

const CSS: &str = "button {\n  outline: none;\n}\n";

fn aad_ids(findings: &[anti_ai_design_core::findings::Finding]) -> Vec<String> {
    findings.iter().filter(|f| f.antipattern.starts_with("aad-")).map(|f| f.antipattern.clone()).collect()
}

#[test]
fn hook_scans_report_aad_findings_only_after_the_pack_is_installed() {
    let scan = HookScanOptions::default();
    assert!(
        aad_ids(&detector_detect_text(CSS, "styles.css", &scan)).is_empty(),
        "no pack installed yet: built-in output only"
    );

    anti_ai_design_aad_rules::install_default();
    let ids = aad_ids(&detector_detect_text(CSS, "styles.css", &scan));
    assert_eq!(ids, vec!["aad-focus-removed".to_string()]);
    assert!(
        aad_ids(&detector_detect_text("a { color: red; }\n", "styles.css", &scan)).is_empty(),
        "a clean file stays clean"
    );
    // the options the static HTML engine receives carry the same pack
    assert!(scan.to_scan_options().rule_pack.is_some());
}
