//! anti-design-hook: the design hook verbs (`hook`, `hook-before-edit`,
//! `hooks` / `hook-admin`), ported from `skill/scripts/hook.mjs`,
//! `hook-before-edit.mjs`, `hook-admin.mjs`, and `hook-lib.mjs`.
//!
//! The regex engine and design-system loader come from `anti-design-detect`;
//! the static HTML engine is reached through the `HtmlEngine` seam the `cli`
//! binary wires in (crates/html), so `.html` targets and configured
//! html-engine template extensions get the same DOM rules the JS applied.
//! The native-platform gate reads PRODUCT.md through `anti-design-context`'s
//! `resolve_context` / `extract_platform` (only the platform is observable,
//! so the rest of `loadContext` is skipped).

pub mod admin;
pub mod before_edit;
pub mod hook;
pub mod hook_claim;
pub mod hook_lib;
pub mod hook_sessions;
mod build_completion;
mod stop_baseline;
pub mod util;

use anti_design_common::Io;
use anti_design_detect::engines::HtmlEngine;

pub use hook_lib::Runtime;

fn runtime<'a>(io: &Io, html: &'a dyn HtmlEngine) -> Runtime<'a> {
    let cwd = io.cwd.to_string_lossy().into_owned();
    let provider = anti_design_context::provider::detect(&io.env, &cwd);
    Runtime::new(
        cwd,
        io.env.clone(),
        provider.command,
        &provider.self_raw,
        html,
    )
}

/// `anti-design hook` (PostToolUse per-edit pass + Stop deep pass). Exit 0.
pub fn run_hook(_args: &[String], io: &mut Io, html: &dyn HtmlEngine) -> i32 {
    let stdin = io.stdin().to_string();
    let rt = runtime(io, html);
    hook::run(&rt, &stdin, io)
}

/// `anti-design hook-before-edit` (the retired Cursor preToolUse gate, kept
/// for manifests not yet migrated to the post-edit hook). Exit 0.
pub fn run_hook_before_edit(_args: &[String], io: &mut Io, html: &dyn HtmlEngine) -> i32 {
    let stdin = io.stdin().to_string();
    let rt = runtime(io, html);
    before_edit::run(&rt, &stdin, io)
}

/// `anti-design hooks <action> [args]` (hook-admin.mjs).
pub fn run_hook_admin(args: &[String], io: &mut Io) -> i32 {
    static NONE: anti_design_detect::MissingHtmlEngine = anti_design_detect::MissingHtmlEngine;
    let rt = runtime(io, &NONE);
    admin::run(&rt, args, io)
}
