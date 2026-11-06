// What the detector will actually look at inside a project, so the Studio can say so before a scan
// and can tell "nothing found" apart from "nothing was scanned".
//
// This mirrors the engine's own walker (anti-design-skill/crates/detect/src/file_system.rs):
// the same extensions, the same skipped folder names, hidden folders left out. If the engine's lists
// change, `tests/project.test.mjs` compares them against the engine source when it is present.
import fs from 'node:fs';
import path from 'node:path';

export const SCANNABLE_EXTS = ['.html', '.htm', '.css', '.scss', '.sass', '.less', '.jsx', '.tsx', '.js', '.ts', '.mjs', '.cjs', '.vue', '.svelte', '.astro', '.blade.php'];
export const SKIP_DIRS = ['node_modules', 'dist', 'build', '__pycache__'];
export const HIDDEN_SOURCE_DIRS = ['.vitepress', '.vuepress', '.storybook'];

const MAX_FILES = 20000;
const MAX_MS = 1500;

/** `.blade.php` counts as one extension; everything else is the last dot-suffix. */
export function scannableExt(name) {
  const lower = name.toLowerCase();
  for (const ext of SCANNABLE_EXTS) if (ext.indexOf('.', 1) > 0 && lower.endsWith(ext)) return ext;
  const ext = path.extname(lower);
  return SCANNABLE_EXTS.includes(ext) ? ext : null;
}

/**
 * Walk `start` (a real path inside `root`) and count the files a scan would read.
 * Symbolic links are not followed, so a link can never lead the walk out of the project or into a loop.
 * @returns {{files:number, byExt:Record<string,number>, skippedDirs:string[], truncated:boolean}}
 */
export function inspectProject(start, { maxFiles = MAX_FILES, maxMs = MAX_MS } = {}) {
  const byExt = {};
  const skipped = new Set();
  let files = 0;
  let truncated = false;
  const deadline = Date.now() + maxMs;
  const stack = [start];
  let st;
  try {
    st = fs.statSync(start);
  } catch {
    return { files: 0, byExt, skippedDirs: [], truncated: false };
  }
  if (st.isFile()) {
    const ext = scannableExt(path.basename(start));
    return ext ? { files: 1, byExt: { [ext]: 1 }, skippedDirs: [], truncated: false } : { files: 0, byExt, skippedDirs: [], truncated: false };
  }
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.includes(e.name)) skipped.add(e.name);
        else if (e.name.startsWith('.') && !HIDDEN_SOURCE_DIRS.includes(e.name)) continue;
        else stack.push(path.join(dir, e.name));
      } else if (e.isFile()) {
        const ext = scannableExt(e.name);
        if (!ext) continue;
        files += 1;
        byExt[ext] = (byExt[ext] || 0) + 1;
      }
      if (files >= maxFiles || Date.now() > deadline) {
        truncated = true;
        stack.length = 0;
        break;
      }
    }
  }
  return { files, byExt, skippedDirs: [...skipped].sort(), truncated };
}
