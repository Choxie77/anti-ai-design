//! `anti-ai-design` binary: verb router.
//!
//! Every skill script and CLI subcommand is a verb here. Verb crates expose
//! `run(args: &[String], io: &mut Io) -> i32` (exit code) and never call
//! `std::process::exit` themselves, so this file is the single place exit codes
//! and stream flushing are decided (contract: docs/CLI-CONTRACT.md in the
//! public repo). Verb names are the JS script basenames; a few carry aliases
//! (`signals` for context-signals, `hooks` for hook-admin).

use std::io::Write;

use anti_ai_design_common::Io;

mod font_render;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

fn main() {
    // Modified by Anti-AI Design contributors, 2026-11-05: register the first-party Anti-AI
    // Design rules (crates/aad-rules) so `detect` and `--list-rules` include them.
    // ANTI_AI_DESIGN_BUILTIN_ONLY=1 leaves them out, so the oracle keeps pinning the
    // built-in rules byte for byte (tests/oracle/lib.mjs sets it).
    if std::env::var_os("ANTI_AI_DESIGN_BUILTIN_ONLY").map_or(true, |v| v.is_empty() || v == "0") {
        anti_ai_design_aad_rules::install_default();
    }
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut io = Io::stdio();
    let code = run(&args, &mut io);
    let _ = io.stdout.flush();
    let _ = io.stderr.flush();
    std::process::exit(code);
}

fn run(args: &[String], io: &mut Io) -> i32 {
    // cli/bin/cli.js dispatch: help / version / detect / ignores / skills verbs
    let Some(verb) = args.first().map(String::as_str) else {
        io.out(anti_ai_design_detect::ROOT_USAGE);
        return 0;
    };
    let rest = &args[1..];
    match verb {
        "--help" | "-h" => {
            io.out(anti_ai_design_detect::ROOT_USAGE);
            0
        }
        "--version" | "-v" => {
            // The installed skill's version, the number `npx anti-ai-design update` moves;
            // the npm shim answers --version itself, so this reaches direct runs only.
            let cwd = io.cwd.to_string_lossy().into_owned();
            let version = anti_ai_design_context::context_cli::installed_skill_version(&io.env, &cwd)
                .unwrap_or_else(|| format!("{VERSION}+engine"));
            io.out(&format!("{version}\n"));
            0
        }
        // Launcher handshake: a cheap discriminator so the launchers can tell
        // this engine apart from the retired 3.x npm CLI (which answers any
        // unknown verb with `Unknown command`, exit 1) before exec'ing a
        // candidate found on PATH or in the unversioned user cache. Kept out
        // of --help on purpose; not part of the user-facing contract.
        "engine-probe" => {
            io.out(&format!("anti-ai-design-engine {VERSION}\n"));
            0
        }
        // Modified by Anti-AI Design contributors, 2026-11-05: `--fix` / `--write` route to the
        // safe-fix tier; every other `detect` call is untouched.
        "detect" if anti_ai_design::safe_fix::wants_fix(rest) => anti_ai_design::safe_fix::run(rest, io, &engines()),
        "detect" => anti_ai_design_detect::run_detect(rest, io, &engines()),
        "ignores" | "ignore" => anti_ai_design_detect::run_ignores(rest, io),
        "skills" => anti_ai_design_skills::run(rest, io),
        "help" | "install" | "link" | "update" | "check" => anti_ai_design_skills::run(args, io),
        // skill scripts
        "context" => anti_ai_design_context::run_context(rest, io),
        "pin" => anti_ai_design_context::run_pin(rest, io),
        "detect-csp" => anti_ai_design_context::run_detect_csp(rest, io),
        "palette" => anti_ai_design_context::run_palette(rest, io),
        "surface-brief" => anti_ai_design_context::run_surface_brief(rest, io),
        "critique-storage" => anti_ai_design_context::run_critique_storage(rest, io),
        "embed-prompt" => anti_ai_design_context::run_embed_prompt(rest, io),
        "signals" | "context-signals" => anti_ai_design_context::run_signals(rest, io),
        "doctor" => anti_ai_design_context::run_doctor(rest, io),
        "concept-seed" => anti_ai_design_context::run_concept_seed(rest, io),
        "telemetry" => anti_ai_design_context::run_telemetry(rest, io),
        "generate-image" => anti_ai_design_context::run_generate_image(rest, io),
        "serve-question" => anti_ai_design_context::run_serve_question(rest, io),
        "component-review" => anti_ai_design_context::component_review::run_with_capturer(rest, io, Some(&mut anti_ai_design::component_capture::NativeComponentCapturer)),
        // comp-fidelity verbs (crates/comp-verbs over crates/comp)
        "comp-spec" => anti_ai_design_comp_verbs::run_comp_spec(rest, io),
        "comp-diff" => anti_ai_design_comp_verbs::run_comp_diff(rest, io),
        "font-match" => {
            let mut renderer = font_render::CdpFontRenderer::from_process_env();
            anti_ai_design_comp_verbs::run_font_match(rest, io, &mut renderer)
        }
        "capture-server" => {
            match anti_ai_design::capture_service::serve(rest) { Ok(()) => 0, Err(e) => { io.err(&format!("Native capture service: {e}\n")); 1 } }
        }
        "build-phase" => {
            // Inject the organic-clip-path CSS scanner (a rule that lives in the
            // closed `core` crate) so comp-verbs stays core-free.
            let organic = |html: &str| -> Vec<(Option<String>, String)> {
                anti_ai_design_core::checks::css_scan::scan_css_text_for_organic_clip_path(html)
                    .into_iter()
                    .map(|f| (f.selector, f.snippet))
                    .collect()
            };
            match anti_ai_design::capture_service::RemoteEntryRenderer::from_env(&io.env) {
                Ok(Some(renderer)) => anti_ai_design_comp_verbs::build_phase::run_with_renderer(rest, io, &organic, Some(&renderer)),
                Ok(None) => { let renderer=anti_ai_design::reviewed_entry::ReviewedEntryRenderer::local(&io.cwd,io.home().as_deref()); anti_ai_design_comp_verbs::build_phase::run_with_renderer(rest, io, &organic, Some(&renderer)) },
                Err(e) => { io.err(&format!("Native capture service: {e}\n")); 1 }
            }
        }
        "hook" => anti_ai_design_hook::run_hook(rest, io, engines().html),
        "hook-before-edit" => anti_ai_design_hook::run_hook_before_edit(rest, io, engines().html),
        "hooks" | "hook-admin" => anti_ai_design_hook::run_hook_admin(rest, io),
        v if v.starts_with("live") => anti_ai_design_live::run(v, rest, io),
        // `npx anti-ai-design src/` shorthand: a path-shaped, flag, URL, or existing
        // first arg is a detect target (cli.js looksLikeDetectTarget).
        v if anti_ai_design_detect::looks_like_detect_target(v, &io.cwd.to_string_lossy()) => {
            if anti_ai_design::safe_fix::wants_fix(args) {
                return anti_ai_design::safe_fix::run(args, io, &engines());
            }
            anti_ai_design_detect::run_detect(args, io, &engines())
        }
        "init" => {
            io.err(anti_ai_design_detect::INIT_MESSAGE);
            1
        }
        other => {
            io.err(&format!(
                "Unknown command: \"{other}\"\n\nTo see a list of supported commands, run:\n  anti-ai-design --help\n"
            ));
            1
        }
    }
}

/// The engines wired into `anti-ai-design detect`: the static HTML engine
/// (crates/html). The browser engine (crates/browser) plugs in here once it
/// lands; until then URL scans report the puppeteer message.
fn engines() -> anti_ai_design_detect::Engines<'static> {
    static HTML: anti_ai_design_html::StaticHtmlEngine = anti_ai_design_html::StaticHtmlEngine {
        // The shipped binary's extra rules are text rules (crates/aad-rules), which the
        // static engine already runs on raw HTML through the scan options' rule pack.
        static_rule_pack: None,
    };
    anti_ai_design_detect::Engines {
        html: &HTML,
        url: Some(url_engine()),
    }
}

// --- browser engine (crates/browser) -------------------------------------
/// The URL engine, built once from the process environment (browser
/// discovery reads `ANTI_AI_DESIGN_BROWSER` / `PUPPETEER_EXECUTABLE_PATH` /
/// `CHROME_PATH`, sandbox flags read `CI`).
fn url_engine() -> &'static anti_ai_design_browser::BrowserEngine {
    static ENGINE: std::sync::OnceLock<anti_ai_design_browser::BrowserEngine> =
        std::sync::OnceLock::new();
    ENGINE.get_or_init(anti_ai_design_browser::BrowserEngine::from_process_env)
}
// -------------------------------------------------------------------------
