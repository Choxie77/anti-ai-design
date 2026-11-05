# Upstream provenance

Anti-AI Design is a modified fork of **Impeccable** by Paul Bakaus.

| | |
|---|---|
| Upstream project | https://github.com/pbakaus/impeccable |
| Forked at commit | `c8891a9ae865d6ee311836ae5199bfce0fe115b1` |
| Upstream package version | 4.8.0 |
| Upstream license | Apache License 2.0 (`LICENSE`, "Copyright 2025 Paul Bakaus") |
| This fork | https://github.com/Choxie77/anti-ai-design |
| License of this fork | Apache License 2.0, unchanged |
| Fork commit | `69aea44` ("feat: fork Impeccable 4.8.0 as Anti-Design") |

The upstream history is not part of this repository. Commit `c8891a9` is the upstream state we started from; the first commit here is the renamed copy of it.

## What was copied

The whole tree under `anti-design-skill/` started as a copy of upstream at the commit above: the skill sources (`skill/`), the Rust detection engine (`crates/`), the Node launcher (`cli/`), the build scripts (`scripts/`), the generated per-tool skill folders (`.claude/`, `.cursor/`, `.agents/` and the rest), the browser extension, the editor plugins, the tests and fixtures, the sample project in `demos/landing-demo/`, and the documents in `docs/`. Files in that tree that we have not rewritten are upstream's, with upstream's copyright and attribution headers kept where they exist (for example the header of `browser-bundle/00-header.js`).

## What we changed

1. **Rename and rebrand (commit `69aea44`).** A scripted pass, kept in `tools/rebrand/` at the repository root, replaced the upstream name with "Anti-Design" in text files and in file and folder names, and renamed the command, package and skill folder to match. It replaced the upstream website, repository and download URLs with placeholders, so nothing in the tree points at the upstream project's services. It also rewrote the author and contributor fields in `package.json`, removed upstream-specific maintainer rules, and wrote the first versions of this file and of `NOTICE.md`. A few tests needed hand fixes that the scripted rename could not make. The script needs a clean upstream checkout at `c8891a9` and refuses to overwrite an existing fork directory, so the rename can be reproduced.
2. **Branding and marketing pass (2026-11-05).** We deleted the two upstream README comparison images that were in `docs/images/` and the README's link to an upstream case study about a third-party project, and replaced them with our own text and an original diagram (`docs/images/overview.svg`). We rewrote `README.md`, `README.npm.md`, `PRODUCT.md`, `DESIGN.md`, `NOTICE.md` and this file in our own words. The rest of the tree is not touched by this pass.
3. **Later work.** Everything after the fork commit, including our own detector rules and anything else added or edited, is recorded in this repository's git history (`git log`, `git blame`).

## Where modifications are marked

- Here and in [NOTICE.md](NOTICE.md): a statement that the project is modified, and what the main modifications are.
- In the git history, starting with the fork commit, whose message describes the rename.
- In `tools/rebrand/`, which is the exact record of the rename.
- Upstream copyright and attribution headers are kept as they were.

We do not currently add a per-file "modified" line to files touched by the scripted rename, because that pass touched most of the tree. A file whose content we change in substance after the rename should get a short notice in its own header, in that file's comment style, naming the change and the date. Files we write from scratch carry no upstream header.

## Names and trademarks

"Impeccable" is the upstream project's name and is not used to brand this fork. We mention it only to say where the code comes from. This fork is not affiliated with or endorsed by the upstream authors.
