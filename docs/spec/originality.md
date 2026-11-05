# Fork provenance, licensing and originality rules

**Decision (2026-11-05): we build on a fork.** The project is a modified fork of Impeccable by Paul Bakaus,
kept in `anti-design-skill/`. This replaces the earlier "own code, no vendoring" stance. The fork is allowed
because the upstream license (Apache-2.0) permits modification and redistribution under conditions, listed
below. Everything we add, and everything user-facing that is not required to stay, should still be ours.

## Facts about the fork

| Item | Value |
|---|---|
| Upstream | https://github.com/pbakaus/impeccable (Copyright 2025 Paul Bakaus) |
| Forked at | commit `c8891a9ae865d6ee311836ae5199bfce0fe115b1`, package version 4.8.0 (see `anti-design-skill/UPSTREAM.md`) |
| License | Apache-2.0 (`anti-design-skill/LICENSE`) |
| Notices | `anti-design-skill/NOTICE.md` (fork notice; also credits Anthropic's `frontend-design` skill and MIT-licensed `platform-design-skills` by ehmo for the iOS/Android reference files) |
| Current fork name | **Anti-Design** (package `anti-design`, bin name `anti-design`; the bin name is what users type) |
| Our product name | **Anti-AI Design** (the original brief). Reconcile with the fork's name: open decision, see below |
| npm availability | `anti-design` and `anti-ai-design` were both unpublished (404) when checked on 2026-11-05; `aad` is taken |
| Runtime | Rust engine in `crates/` (one static binary, also the detector), Node shim in `cli/`, skill sources in `skill/`, Bun build scripts in `scripts/` |
| Rule count | upstream documents 62 detector rules; our own catalog (`docs/research/slop-catalog.md`) lists 51 candidates, to be compared in a gap analysis |

## Apache-2.0 obligations we must keep meeting

1. **Keep** `LICENSE` and give every recipient a copy (the npm `files` list already includes it).
2. **Retain** all copyright, patent, trademark and attribution notices in source files we keep.
3. **Mark changes.** Files we modify must carry a prominent notice that we changed them. For a rename-only
   change, `NOTICE.md` and `UPSTREAM.md` cover it; for any substantive edit, add a short "Modified by
   Anti-Design contributors, <date>" line in the file header (or the file's comment style), and keep the
   upstream header.
4. **Keep the NOTICE text** in distributions and extend it when we add third-party material.
5. **Our additions** may carry our own copyright line and can be licensed as we choose, but the
   distribution as a whole stays Apache-2.0 compatible.
6. **No endorsement or trademark use.** We do not use the upstream name "Impeccable" as our brand, and we
   do not imply affiliation. Mentioning where the code came from is fine and required.

## What we must not carry over (branding, marketing and content)

These are not code, and the license does not give us the right to present them as ours:

- The upstream name, logo, slash command name `/impeccable`, tagline and site identity.
- Marketing prose, case studies (the "Neo Mirai" case), gallery and README comparison images
  (`docs/images/readme-with.webp`, `readme-without.webp`) and example sites. Replace with our own, or remove.
- Public URLs and accounts. 220 files in the fork still hold the placeholders `github.com/OWNER/anti-design`
  and `anti-design.example`; the engine download base points at the placeholder, so installs cannot work
  until it names a real release location.
- Their raw captured pages in `docs/research/raw/`: private research only. They must not be published or
  packaged (keep them out of the npm `files` list).
- Their changelog and release history as ours. Our releases start our own history.

Where we keep upstream docs that describe behavior (`CLI-CONTRACT.md`, `ENGINE.md`), they stay under
Apache-2.0 with the original notices, and we edit them as we change behavior.

## Rules for new work in the fork

1. New rules, commands and docs are written in our words. Use our own rule IDs in the `AAD-` family for
   rules we add, so our additions are identifiable and separable from upstream rules.
2. Do not rephrase upstream prose to hide its origin. Either keep it with notices, or write new text.
3. Third-party material needs its license recorded in `NOTICE.md`. The MIT-licensed
   `appllama-app-design-skill` in `.claude/skills/` informed our catalog ideas (accent-hue count, radius
   scale); no text was reused. If text is reused, keep its license notice.
4. Keep upstream-derived and our additions easy to tell apart: our files go under clearly named paths
   (for example `crates/core/src/aad_*.rs`, `docs/ours/`), and substantive edits to upstream files stay
   small and marked.
5. When syncing from upstream later, merge by commit and keep `UPSTREAM.md` accurate.
6. Review checklist for every change that touches branding, docs or templates: "Does this still present
   upstream branding or claims as ours?"

## Open decisions (waiting on the owner)

1. **Product name.** Keep the fork's `anti-design` (`.anti-design/` folder, `/anti-design` command), or
   rename to `anti-ai-design` everywhere. A rename touches many files and generated harness folders, so it
   is a separate task.
2. **GitHub owner and release location.** Needed to replace `OWNER` and to host engine binaries.
3. **Toolchain.** Building the engine needs Rust (`rustup`/`cargo`) and Bun, which are not installed on this
   machine. Installing them changes the system, so it needs the owner's approval.
4. **Our license line** for our own additions (default: Apache-2.0, the same as the fork).

## Baseline we still keep from the earlier decisions

- Dry-run by default for any command that edits source; `--write` applies. (Check whether the fork already
  behaves this way before changing anything.)
- An append-only run log of automatic changes. The fork's behavior here is not yet known.
- Rule IDs for our additions: `AAD-<domain letter><two digits>` as in the slop catalog.
