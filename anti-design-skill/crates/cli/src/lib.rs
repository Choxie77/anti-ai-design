//! Native browser adapters, kept separate from the comp-verbs contract.
pub mod asset_capture;

pub mod capture_snapshot;

pub mod component_capture;

pub mod entry_capture;

pub mod capture_service;

pub mod reviewed_entry;

// Modified by Anti-Design contributors, 2026-11-05: the safe-fix tier
// (`anti-design detect --fix [--write]`), a new module; see docs/ours/safe-fix.md.
pub mod safe_fix;
