#!/usr/bin/perl -pi
# Second rename pass: anti-design -> anti-ai-design (run via rebrand2.sh, which picks the files).
# Byte mode on purpose: every pattern is ASCII. Longest / most specific rules first.
# Each rule is a no-op on its own output, so the whole file is idempotent.

# 1. Download-base and repository placeholders (real owner and repo).
s{\bOWNER/anti-design}{Choxie77/anti-design}g;

# 2. Placeholder domains. Keep the evil-host test shape (a look-alike host label followed by a suffix
#    and a userinfo @) pointing at a host that still resolves for the "trusted" label.
s{anti-design\.example\.evil\.test}{github.com.evil.test}g;
#    Full URLs keep their scheme (some tests assert that plain http is refused) and any path.
s{(https?)://(?:www\.)?anti-design\.(?:example|style)(?![\w.-])}{$1://github.com/Choxie77/anti-ai-design}gi;
#    Possessive prose ("anti-design.example's tab strip") names the product, not a URL.
s{\banti-design\.(?:example|style)'s}{Anti-AI Design's}g;
#    A host used as a plain word in a prose fixture (the CSS-in-prose fixture feeds a parser; a dotted host changes its output).
s{\banti-design\.(?:example|style) changelog}{Anti-AI Design changelog}g;
#    Any bare host left over.
s{\banti-design\.(?:example|style)(?![\w-])}{github.com/Choxie77/anti-ai-design}g;
s{Anti-Design\.Example}{github.com/Choxie77/anti-ai-design}g;

# 3. Identifier and name variants. `anti-design-skill` followed by a path separator, a quote or a space is
#    the name of the repository subfolder and stays; `anti-design-skills` (the crate) and
#    `anti-design-skill-bundle-v1` (the signing payload tag) do change.
s{anti-design(?!-skill(?![-\w]))}{anti-ai-design}g;
s{anti_design}{anti_ai_design}g;
s{antiDesign}{antiAiDesign}g;
s{AntiDesign}{AntiAiDesign}g;
s{ANTI_DESIGN}{ANTI_AI_DESIGN}g;
s{X-Anti-Design}{X-Anti-AI-Design}g;   # HTTP header names cannot hold a space
s{Anti-Design}{Anti-AI Design}g;
s{Anti Design}{Anti-AI Design}g;
