// Parses the unified diff the engine prints for `detect --fix`.

/** @returns {Array<{file:string, additions:number, deletions:number, changedLines:number[], hunks:Array}>} */
export function parseUnifiedDiff(text) {
  const files = [];
  let cur = null;
  let hunk = null;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('--- ')) {
      cur = { file: stripLabel(raw.slice(4)), additions: 0, deletions: 0, changedLines: [], hunks: [] };
      files.push(cur);
      hunk = null;
      continue;
    }
    if (raw.startsWith('+++ ')) {
      if (cur) {
        const n = stripLabel(raw.slice(4));
        if (n && n !== '/dev/null') cur.file = n;
      }
      continue;
    }
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(raw);
    if (m && cur) {
      hunk = {
        oldStart: Number(m[1]),
        oldLines: m[2] === undefined ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newLines: m[4] === undefined ? 1 : Number(m[4]),
        lines: [],
      };
      cur.hunks.push(hunk);
      oldNo = hunk.oldStart;
      newNo = hunk.newStart;
      continue;
    }
    if (!hunk) continue;
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    const tag = raw[0];
    const body = raw.slice(1);
    if (tag === '-') {
      hunk.lines.push({ t: 'del', old: oldNo, text: body });
      cur.deletions += 1;
      cur.changedLines.push(oldNo);
      oldNo += 1;
    } else if (tag === '+') {
      hunk.lines.push({ t: 'add', new: newNo, text: body });
      cur.additions += 1;
      newNo += 1;
    } else if (tag === ' ') {
      hunk.lines.push({ t: 'ctx', old: oldNo, new: newNo, text: body });
      oldNo += 1;
      newNo += 1;
    }
  }
  return files.filter((f) => f.hunks.length > 0);
}

function stripLabel(label) {
  const l = label.trim();
  if (l.startsWith('a/') || l.startsWith('b/')) return l.slice(2);
  return l;
}
