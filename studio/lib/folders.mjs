// Helping a person point the Studio at a project without a terminal: understand the path they typed or
// dropped, list folders to pick from, look for a folder by name, ask the operating system's own folder
// dialog, and remember recent projects.
//
// Everything here is about *choosing* a folder. Reading and changing files inside the chosen project is
// still guarded by security.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HttpError } from './security.mjs';
import { inspectProject, SKIP_DIRS } from './project.mjs';

/** Folders in a home directory that are never somebody's project and are slow to look through. */
const HOME_NOISE = new Set(['Library', 'Applications', 'Movies', 'Music', 'Pictures', 'Public', 'AppData', 'Application Data', 'Creative Cloud Files']);
/** Places people keep projects; offered as shortcuts when they exist. */
const SHORTCUTS = ['Desktop', 'Documents', 'Downloads', 'Developer', 'Projects', 'Sites', 'Code', 'dev', 'repos', 'work'];
const MAX_RECENT = 8;

/**
 * Turn what a person typed, pasted or dropped into the absolute paths it could mean, best guess first.
 * Handles quotes, `file://` links, `~`, backslash-escaped spaces (what a terminal drag produces) and
 * names relative to the current project or the home folder.
 * @returns {string[]}
 */
export function pathCandidates(input, { home = os.homedir(), bases = [] } = {}) {
  let t = String(input ?? '').trim();
  if (!t || t.length > 4096 || t.includes('\0')) return [];
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1).trim();
  if (/^file:\/\//i.test(t)) {
    try {
      t = fileURLToPath(t);
    } catch {
      return [];
    }
  } else if (path.sep === '/') {
    t = t.replace(/\\(.)/g, '$1');
  }
  if (!t) return [];
  if (t === '~' || t.startsWith('~/') || t.startsWith('~\\')) t = path.join(home, t.slice(1));
  if (path.isAbsolute(t)) return [path.normalize(t)];
  const out = [];
  for (const base of [...bases, home, path.join(home, 'Desktop'), path.join(home, 'Documents')]) {
    if (!base) continue;
    const p = path.resolve(base, t);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * The first candidate that exists, as a real path. A file counts too: the caller decides what to do with it.
 * Throws a 404 that says what to try next.
 */
export function resolveTyped(input, opts) {
  const cands = pathCandidates(input, opts);
  if (cands.length === 0) throw new HttpError(400, 'bad_path', 'Type or paste a folder path first.');
  for (const c of cands) {
    try {
      const real = fs.realpathSync(c);
      return { real, isFile: fs.statSync(real).isFile() };
    } catch {
      /* try the next one */
    }
  }
  throw new HttpError(404, 'not_found', `There is no folder at "${String(input).trim().slice(0, 200)}". Check the spelling, or use "Choose folder" to pick it.`);
}

/** The whole disk and the whole home folder are not projects; scanning them would read everything. */
export function isTooBroad(realPath, home = os.homedir()) {
  if (realPath === path.parse(realPath).root) return true;
  try {
    return realPath === fs.realpathSync(home);
  } catch {
    return realPath === home;
  }
}

function visibleDirs(real, home) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(real, { withFileTypes: true });
  } catch {
    return out;
  }
  const atHome = real === home;
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.includes(e.name) || (atHome && HOME_NOISE.has(e.name))) continue;
    let isDir = e.isDirectory();
    if (e.isSymbolicLink()) {
      try {
        isDir = fs.statSync(path.join(real, e.name)).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) out.push(e.name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * What the in-page folder browser shows for one folder: its sub-folders with a quick count of the files a
 * scan would read in each (so the project folders stand out), and where it can go from here.
 */
export function listFolders(real, { home = os.homedir(), maxMs = 900 } = {}) {
  let realHome = home;
  try {
    realHome = fs.realpathSync(home);
  } catch {
    /* keep as given */
  }
  const deadline = Date.now() + maxMs;
  const names = visibleDirs(real, realHome).slice(0, 300);
  const dirs = names.map((name) => {
    if (Date.now() > deadline) return { name, files: null, more: false };
    const r = inspectProject(path.join(real, name), { maxFiles: 300, maxMs: 40 });
    return { name, files: r.files, more: r.truncated };
  });
  const parent = path.dirname(real);
  return {
    path: real,
    name: path.basename(real) || real,
    parent: parent === real ? null : parent,
    home: realHome,
    scannable: inspectProject(real),
    tooBroad: isTooBroad(real, realHome),
    dirs,
    shortcuts: shortcutsFor(realHome),
  };
}

export function shortcutsFor(home) {
  const out = [{ label: 'Home', path: home }];
  for (const name of SHORTCUTS) {
    const p = path.join(home, name);
    try {
      if (fs.statSync(p).isDirectory()) out.push({ label: name, path: fs.realpathSync(p) });
    } catch {
      /* not there */
    }
  }
  return out;
}

/**
 * Folders called `name` somewhere near the home folder. A dropped folder reaches the page as a bare name
 * (browsers never reveal where it came from), so this is how the Studio finds the real one.
 * Folders that hold something to scan come first.
 */
export function findFolders(name, { home = os.homedir(), maxMs = 1500, maxDepth = 4, limit = 8 } = {}) {
  if (typeof name !== 'string' || !name || name.length > 255 || /[\\/\0]/.test(name) || name === '.' || name === '..') {
    throw new HttpError(400, 'bad_name', 'That is not a folder name.');
  }
  let realHome = home;
  try {
    realHome = fs.realpathSync(home);
  } catch {
    /* keep as given */
  }
  const wanted = name.toLowerCase();
  const deadline = Date.now() + maxMs;
  const found = [];
  let level = [realHome];
  for (let depth = 0; depth <= maxDepth && level.length && Date.now() < deadline; depth++) {
    const next = [];
    for (const dir of level) {
      if (Date.now() > deadline) break;
      for (const child of visibleDirs(dir, realHome)) {
        const full = path.join(dir, child);
        if (child.toLowerCase() === wanted) found.push(full);
        next.push(full);
      }
    }
    level = next;
  }
  const withCounts = found.slice(0, 40).map((p) => ({ path: p, files: inspectProject(p, { maxFiles: 500, maxMs: 80 }).files, depth: path.relative(realHome, p).split(path.sep).length }));
  withCounts.sort((a, b) => Number(b.files > 0) - Number(a.files > 0) || a.depth - b.depth || a.path.localeCompare(b.path));
  return withCounts.slice(0, limit);
}

// ---- the operating system's own folder dialog ------------------------------------------------------------

const DIALOG_PROMPT = 'Choose the folder that holds your website or app';
const DIALOG_MS = 10 * 60 * 1000;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: DIALOG_MS, maxBuffer: 64 * 1024, windowsHide: true }, (err, stdout, stderr) => resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') }));
  });
}

/**
 * Ask the operating system for a folder, the way any app's "Open folder" does. Works because this server
 * runs on the same computer as the person using it.
 * @returns {Promise<{path:string}|{cancelled:true}>}
 */
export async function pickFolderNative({ platform = process.platform, exec = run } = {}) {
  const none = new HttpError(501, 'no_dialog', 'This computer cannot show a folder dialog from here. Browse for the folder in the page, or paste its path.');
  if (platform === 'darwin') {
    const r = await exec('osascript', ['-e', 'tell me to activate', '-e', `POSIX path of (choose folder with prompt "${DIALOG_PROMPT}")`]);
    if (r.err) {
      if (/-128|cancel/i.test(r.stderr)) return { cancelled: true }; // the person pressed Cancel
      throw none;
    }
    const p = r.stdout.trim();
    return p ? { path: p } : { cancelled: true };
  }
  if (platform === 'win32') {
    const script = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '${DIALOG_PROMPT}'; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }`;
    const r = await exec('powershell', ['-NoProfile', '-STA', '-Command', script]);
    if (r.err && r.err.code === 'ENOENT') throw none;
    const p = r.stdout.trim();
    return p ? { path: p } : { cancelled: true };
  }
  for (const [cmd, args] of [
    ['zenity', ['--file-selection', '--directory', `--title=${DIALOG_PROMPT}`]],
    ['kdialog', ['--getexistingdirectory', os.homedir(), '--title', DIALOG_PROMPT]],
  ]) {
    const r = await exec(cmd, args);
    if (r.err && r.err.code === 'ENOENT') continue;
    const p = r.stdout.trim();
    return p ? { path: p } : { cancelled: true };
  }
  throw none;
}

// ---- recent projects ------------------------------------------------------------------------------------

/** Recent project folders from the state file; anything that no longer exists is dropped. */
export function readRecent(file) {
  if (!file) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (Array.isArray(data?.recent) ? data.recent : []).filter((p) => typeof p === 'string' && isDir(p)).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Put `project` first in the list and save it (when there is a file to save to). Never throws. */
export function rememberRecent(file, list, project) {
  const next = [project, ...list.filter((p) => p !== project)].slice(0, MAX_RECENT);
  if (file) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ recent: next }, null, 2) + '\n', { mode: 0o600 });
    } catch {
      /* remembering is a courtesy; a read-only home folder must not stop the Studio */
    }
  }
  return next;
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Where the state file lives when the server is started normally. */
export function defaultStateFile(home = os.homedir()) {
  return path.join(home, '.anti-ai-design', 'studio.json');
}
