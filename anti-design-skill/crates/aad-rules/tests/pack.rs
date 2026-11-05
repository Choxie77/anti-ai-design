//! The Anti-AI Design pack through the real text engine: rows resolve, findings
//! appear after the built-ins, inline ignores waive them, and a run without the
//! pack is unchanged.

use anti_design_aad_rules::{install_default, PACK, ROWS};
use anti_design_core::registry::get_antipattern;
use anti_design_core::rule_pack::{default_pack, RulePack};
use anti_design_detect::detect_text::{detect_text, TextOptions};

const CSS: &str = "button {\n  outline: none;\n}\n";

fn scan(src: &str, path: &str, with_pack: bool) -> Vec<String> {
    let pack: Option<&'static dyn RulePack> = if with_pack { Some(&PACK) } else { None };
    detect_text(src, path, &TextOptions { inline_ignores: true, rule_pack: pack, ..Default::default() })
        .into_iter()
        .map(|f| f.antipattern)
        .collect()
}

#[test]
fn install_registers_every_row() {
    install_default();
    assert!(default_pack().is_some());
    for row in ROWS {
        assert!(row.id.starts_with("aad-"), "{}", row.id);
        let found = get_antipattern(row.id).unwrap_or_else(|| panic!("{} not registered", row.id));
        assert_eq!(found.name, row.name);
    }
    // Installing twice is harmless.
    install_default();
}

#[test]
fn findings_come_from_the_pack_only_when_it_is_passed() {
    install_default();
    assert!(scan(CSS, "/app/a.css", true).contains(&"aad-focus-removed".to_string()));
    assert!(!scan(CSS, "/app/a.css", false).iter().any(|id| id.starts_with("aad-")));
}

#[test]
fn inline_ignore_waives_a_pack_rule() {
    install_default();
    let src = "/* anti-design-disable aad-focus-removed: custom ring drawn by the component */\nbutton {\n  outline: none;\n}\n";
    assert!(!scan(src, "/app/a.css", true).contains(&"aad-focus-removed".to_string()));
}

#[test]
fn html_files_are_covered_through_the_text_hook() {
    install_default();
    let html = "<!doctype html><html><body>\n<button><svg viewBox=\"0 0 8 8\"><path d=\"M0 0\"/></svg></button>\n</body></html>\n";
    assert!(scan(html, "/app/index.html", true).contains(&"aad-icon-button-name".to_string()));
}

#[test]
fn clean_markup_has_no_pack_findings() {
    install_default();
    let html = "<button aria-label=\"Close\" class=\"btn\"><svg viewBox=\"0 0 8 8\"><path d=\"M0 0\"/></svg></button>\n";
    assert!(!scan(html, "/app/index.html", true).iter().any(|id| id.starts_with("aad-")));
}
