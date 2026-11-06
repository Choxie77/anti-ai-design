// The detector reports some findings (all the ones it finds in HTML pages, and the ones that come from a
// stylesheet the page links) without a line number. Without a line the Studio would show "whole file" and
// the person would have to hunt. This finds the most likely line from what the detector said it matched.
//
// It is a best guess, never a fact: callers must label the result as "likely".

const PURPLE_HEX = /#(?:6366f1|818cf8|4f46e5|4338ca|8b5cf6|a78bfa|7c3aed|6d28d9|a855f7|c084fc|9333ea|7e22ce|d946ef|ec4899|06b6d4|22d3ee|0891b2)\b/i;
const HUE_WORDS = /\b(?:purple|violet|indigo|fuchsia|cyan)(?:-\d{2,3})?\b/i;
const HEX = /#[0-9a-f]{3,8}\b/gi;

const lower = (s) => String(s || '').toLowerCase();
const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const hexes = (s) => (String(s || '').match(HEX) || []).map(lower);

/** Candidate line numbers (1-based) for one finding, best first. `generic` means no rule-specific pattern matched. */
function candidates(rule, snippet, lines) {
  const snip = String(snippet || '');
  const out = [];
  const add = (test, weight = 0) => {
    for (let i = 0; i < lines.length; i++) if (test(lines[i], i)) out.push({ n: i + 1, weight });
  };
  const has = (re) => (l) => re.test(l);
  const hasAll = (...res) => (l) => res.every((r) => r.test(l));

  switch (rule) {
    case 'gradient-text':
      add(hasAll(/background-clip\s*:\s*text|bg-clip-text/i, /gradient/i), 3);
      add(has(/background-clip\s*:\s*text|bg-clip-text/i), 2);
      add(has(/text-fill-color\s*:\s*transparent/i), 1);
      break;
    case 'overused-font': {
      const name = /:\s*(.+)$/.exec(snip)?.[1]?.trim() || '';
      const first = name.split(',')[0].replace(/['"]/g, '').trim();
      if (first) {
        const nameRe = new RegExp(`(?:^|[^a-z])${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[ +_-]*')}(?:[^a-z]|$)`, 'i');
        add(hasAll(/font-family|font\s*:|fonts\.googleapis|fonts\.bunny|@import|font-\[|font-face/i, nameRe), 2);
        add(has(nameRe), 1);
      }
      break;
    }
    case 'ai-color-palette':
      add(hasAll(/gradient/i, new RegExp(`${PURPLE_HEX.source}|${HUE_WORDS.source}`, 'i')), 3);
      add(has(PURPLE_HEX), 2);
      add(has(HUE_WORDS), 1);
      break;
    case 'dark-glow': {
      const hs = hexes(snip);
      for (const h of hs) add(hasAll(/shadow/i, new RegExp(h, 'i')), 3);
      add(has(/(?:box|text)-shadow\s*:[^;]*(?:rgba?|#)/i), 2);
      add(has(/shadow/i), 1);
      break;
    }
    case 'low-contrast': {
      // "text #000000 on #0b0b1a": the background is the one a person actually wrote.
      const hs = hexes(snip).reverse();
      for (const h of hs) add(hasAll(/color|background|bg-/i, new RegExp(h, 'i')), 2);
      for (const h of hs) add(has(new RegExp(h, 'i')), 1);
      break;
    }
    case 'marketing-buzzword': {
      const quote = /"([^"]+)"/.exec(snip)?.[1] || '';
      const words = quote.split(/\s+/).filter(Boolean);
      // The detector truncates its quote at both ends, so try the longest run of whole words first.
      for (let len = Math.min(words.length, 5); len >= 2; len--) {
        for (let s = 0; s + len <= words.length; s++) {
          const phrase = lower(words.slice(s, s + len).join(' '));
          add((l) => lower(stripTags(l)).includes(phrase), len);
        }
        if (out.length) break;
      }
      break;
    }
    default:
      break;
  }

  let generic = false;
  if (!out.length) {
    generic = true;
    // Generic: a colour the detector quoted, or the quoted text itself.
    for (const h of hexes(snip)) add(has(new RegExp(h, 'i')), 1);
    const flat = lower(snip).replace(/\s+/g, ' ').trim();
    if (!out.length && flat.length >= 6) add((l) => lower(l).replace(/\s+/g, ' ').includes(flat), 1);
  }
  return { generic, list: out.sort((a, b) => b.weight - a.weight || a.n - b.n) };
}

/**
 * @param {{rule:string, snippet:string}} finding
 * @param {{rel:string, lines:string[], via?:string}[]} files  the file the engine named first, then files it links
 * @param {Set<string>} used  `rule|rel:line` keys already handed out, so repeated findings spread over repeated lines
 * @returns {{rel:string, line:number, via:string|null}|null}
 */
export function locateFinding(finding, files, used) {
  // Rule-specific matches anywhere beat a loose match in the first file: a colour quoted by the detector
  // also appears in the page's own inline styles, but the glow it names lives in the stylesheet.
  for (const pass of [false, true]) {
    const all = [];
    files.forEach((f, order) => {
      const c = candidates(finding.rule, finding.snippet, f.lines);
      if (c.generic !== pass) return;
      for (const x of c.list) all.push({ ...x, f, order });
    });
    if (!all.length) continue;
    all.sort((a, b) => b.weight - a.weight || a.order - b.order || a.n - b.n);
    const top = all.filter((x) => x.weight === all[0].weight);
    const pick = top.find((x) => !used.has(`${finding.rule}|${x.f.rel}:${x.n}`)) || top[0];
    used.add(`${finding.rule}|${pick.f.rel}:${pick.n}`);
    return { rel: pick.f.rel, line: pick.n, via: pick.f.via || null };
  }
  return null;
}

/** Stylesheets an HTML page links to (`<link rel="stylesheet" href>`), as hrefs. Remote ones are left out. */
export function linkedStylesheets(htmlLines) {
  const text = htmlLines.join('\n');
  const out = [];
  for (const m of text.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
    out.push(href.split(/[?#]/)[0]);
  }
  return out;
}
