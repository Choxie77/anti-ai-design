// Pure functions over scan and fix data. No DOM, so they are testable in Node.

export const SEVERITY_ORDER = ['error', 'warning', 'advisory'];

const sevRank = (s) => {
  const i = SEVERITY_ORDER.indexOf(s);
  return i === -1 ? SEVERITY_ORDER.length : i;
};

export function sortFindings(findings) {
  return [...findings].sort(
    (a, b) => sevRank(a.severity) - sevRank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  );
}

/** Ids of findings that sit on a line the dry-run diff deletes or rewrites. */
export function fixableIds(findings, previewFiles) {
  const byFile = new Map((previewFiles || []).map((f) => [f.file, new Set(f.changedLines)]));
  const out = new Set();
  for (const f of findings) {
    const lines = byFile.get(f.file);
    if (lines && lines.has(f.line)) out.add(f.id);
  }
  return out;
}

export function filterFindings(findings, filters, fixable = new Set()) {
  const q = (filters.query || '').trim().toLowerCase();
  return findings.filter((f) => {
    if (filters.severities && !filters.severities.has(f.severity)) return false;
    if (filters.category && filters.category !== 'all' && f.category !== filters.category) return false;
    if (filters.fixableOnly && !fixable.has(f.id)) return false;
    if (q && !`${f.rule} ${f.name} ${f.file} ${f.snippet} ${f.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** @param {'file'|'rule'} by */
export function groupFindings(findings, by) {
  const groups = new Map();
  for (const f of sortFindings(findings)) {
    const key = by === 'rule' ? f.rule : f.file;
    if (!groups.has(key)) groups.set(key, { key, title: by === 'rule' ? f.name : f.file, sample: f, items: [] });
    groups.get(key).items.push(f);
  }
  const list = [...groups.values()];
  if (by === 'rule') list.sort((a, b) => sevRank(a.sample.severity) - sevRank(b.sample.severity) || b.items.length - a.items.length);
  else list.sort((a, b) => a.key.localeCompare(b.key));
  return list;
}

/**
 * After applying fixes, compare per (rule, file): how many fixable findings
 * there were before and how many findings of that rule remain in that file.
 */
export function compareRescan(before, after, fixable) {
  const key = (f) => `${f.rule}\u0000${f.file}`;
  const was = new Map();
  for (const f of before) {
    if (!fixable.has(f.id)) continue;
    const k = key(f);
    if (!was.has(k)) was.set(k, { rule: f.rule, name: f.name, file: f.file, before: 0 });
    was.get(k).before += 1;
  }
  const now = new Map();
  for (const f of after) now.set(key(f), (now.get(key(f)) || 0) + 1);
  return [...was.entries()].map(([k, v]) => ({ ...v, after: now.get(k) || 0, gone: !now.has(k) }));
}

/** Pair deletions with additions so a diff can be shown side by side. */
export function splitRows(hunk) {
  const rows = [];
  let dels = [];
  let adds = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) rows.push({ left: dels[i] || null, right: adds[i] || null });
    dels = [];
    adds = [];
  };
  for (const l of hunk.lines) {
    if (l.t === 'del') dels.push(l);
    else if (l.t === 'add') adds.push(l);
    else {
      flush();
      rows.push({ left: l, right: l });
    }
  }
  flush();
  return rows;
}
