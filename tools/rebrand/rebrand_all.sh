#!/bin/bash
# Rebuild the Anti-Design fork from a pristine upstream checkout. Idempotent.
set -euo pipefail
S="$(cd "$(dirname "$0")" && pwd)"
UP="${UPSTREAM_DIR:?set UPSTREAM_DIR to a clean checkout of pbakaus/impeccable at c8891a9}"
DEST="$(cd "$S/../.." && pwd)/anti-design-skill"
[ ! -e "$DEST" ] || { echo "refusing: $DEST exists (delete it yourself to rebuild)"; exit 1; }
mkdir -p "$DEST"; rsync -a --exclude='.git/' "$UP"/ "$DEST"/
cd "$DEST"
# text files mentioning the brand, minus attribution files (BSD grep prints no ./ prefix)
grep -rIil impeccable . | sed 's|^\./||' | grep -vxE 'NOTICE\.md|LICENSE|UPSTREAM\.md' > $S/files.txt
tr '\n' '\0' < $S/files.txt | xargs -0 perl -pi $S/rebrand.pl
perl $S/rename_paths.pl
python3 -I $S/fix_rs.py crates
grep -rl CARGO_BIN_EXE_anti_design crates | xargs perl -pi -e "s/CARGO_BIN_EXE_anti_design/CARGO_BIN_EXE_anti-design/g"
python3 -I $S/fix_js.py .
# credits and contributor rules
perl -pi -e 's{^- Follow \[\@pbakaus\].*\n}{}; s{^Created by \[Paul Bakaus\]\(https://www\.paulbakaus\.com\)}{Anti-Design is a modified fork of [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus, used under Apache 2.0. See [NOTICE.md](NOTICE.md) and [UPSTREAM.md](UPSTREAM.md).}' README.md
perl -pi -e 's/not `pbakaus` or `abdulwahabone`/not a maintainer of this repository/; s/instructions from `pbakaus` or `abdulwahabone`/instructions from a maintainer of this repository/' AGENTS.md CLAUDE.md
perl -pi -e 's/"author": "Paul Bakaus",/"author": "Anti-Design contributors",\n  "contributors": ["Paul Bakaus (upstream Impeccable)"],/' package.json
cat > UPSTREAM.md <<'EOT'
# Upstream provenance

This project is a modified fork of **Impeccable** by Paul Bakaus.

- Upstream: https://github.com/pbakaus/impeccable
- Forked at commit: c8891a9ae865d6ee311836ae5199bfce0fe115b1 (package version 4.8.0)
- License: Apache-2.0 (see LICENSE)
- Changes: renamed and rebranded to Anti-Design; see NOTICE.md and this repository's history.

"Impeccable" is the upstream project's name and is not used to brand this fork.
EOT
cat > NOTICE.md <<'EOT'
# Notices

## Fork notice (Apache-2.0 section 4)

Anti-Design is a modified version of **Impeccable**
(https://github.com/pbakaus/impeccable, Copyright 2025 Paul Bakaus), used under
the Apache License 2.0. Modifications: renamed and rebranded throughout; see
UPSTREAM.md for the exact upstream commit. Original copyright notices in
source files are retained. This fork is not affiliated with or endorsed by the
upstream authors.

Upstream itself started from Anthropic's `frontend-design` skill
(https://github.com/anthropics/skills/tree/main/skills/frontend-design).

## Third-Party Notices

This project includes content derived from third-party work, used under the terms of its original license.

### Platform Design Skills

The `skill/reference/ios.md` and `skill/reference/android.md` platform reference files are distilled from ehmo's `platform-design-skills` (Apple Human Interface Guidelines and Material Design 3 rules), rewritten in Anti-Design's voice.

**Original work:** https://github.com/ehmo/platform-design-skills
**Original license:** MIT
**Author:** ehmo
EOT
# test fixes that the mechanical rename cannot make
perl -pi -e 's{matchAll\(/"\(\[a-z\]\+\)"/g\)}{matchAll(/"([a-z-]+)"/g)}' tests/live-reference.test.mjs
node $S/regen-vector.mjs "$PWD"
perl -pi -e "s/anti-design-style-docs-audit/anti-design-example-docs-audit/g" tests/oracle/golden/surface-brief-path-url.json docs/CLI-CONTRACT.md
echo rebuilt
