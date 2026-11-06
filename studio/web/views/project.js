// Choosing which project to check, without a terminal. Four ways in, all ending at the same place:
//   1. "Choose folder": the computer's own folder window (the easiest, when the computer can show one)
//   2. drag the project folder onto the page
//   3. paste or type its path
//   4. browse the computer's folders in the page, or pick a recent project
import { h, clear, plural, nextId } from '../ui.js';

/** "12 files", "300+ files", "nothing to scan" for a folder-list row. */
function countLabel(files, more) {
  if (files === null || files === undefined) return '';
  if (files === 0) return 'nothing to scan';
  return `${files}${more ? '+' : ''} ${files === 1 ? 'file' : 'files'}`;
}

/** The last part of a path, whichever way the computer writes its slashes. */
function baseName(p) {
  return String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
}

function notice(err, kind = 'notice-error') {
  return h('div', { class: `notice ${kind}`, role: 'alert' }, h('p', { text: err.message || String(err) }));
}

/**
 * A browser for folders on this computer. Folders that hold something to scan show how many files, so the
 * project folders stand out from the rest.
 */
export function folderBrowser(ctx, { onUse }) {
  const { engine, state } = ctx;
  const el = h('div', { class: 'fb' });
  let req = 0;

  async function show(p) {
    const mine = ++req;
    let data;
    try {
      data = await engine.folders(p);
    } catch (err) {
      if (mine !== req) return;
      clear(el).append(notice(err));
      return;
    }
    if (mine !== req) return;
    draw(data);
  }

  function draw(d) {
    const n = d.scannable.files;
    const blocked = d.tooBroad || n === 0;
    const useBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: blocked, onclick: () => onUse(d.path) }, `Use ${d.name}`);
    const why = d.tooBroad
      ? 'That is a whole home folder or disk, far too much to check at once. Open the one folder that holds your project.'
      : n === 0
        ? 'Nothing the detector reads is directly in here. Open one of the folders below that has files.'
        : `${d.scannable.truncated ? 'At least ' : ''}${plural(n, 'file')} to check in here.`;
    clear(el).append(
      h(
        'div',
        { class: 'fb-chips', role: 'group', 'aria-label': 'Jump to' },
        d.shortcuts.map((s) => h('button', { type: 'button', class: 'chip', onclick: () => show(s.path) }, s.label)),
      ),
      h(
        'div',
        { class: 'fb-bar' },
        h('button', { type: 'button', class: 'btn btn-quiet', disabled: d.parent === null, onclick: () => show(d.parent) }, 'Up one level'),
        h('code', { class: 'fb-here', text: d.path }),
      ),
      h(
        'ul',
        { class: 'fb-list', 'aria-label': `Folders inside ${d.name}` },
        d.dirs.map((x) =>
          h(
            'li',
            {},
            h(
              'button',
              { type: 'button', class: x.files ? 'fb-row has-files' : 'fb-row', onclick: () => show(joinPath(d.path, x.name)) },
              h('span', { class: 'fb-name', text: x.name + '/' }),
              h('span', { class: 'fb-count', text: countLabel(x.files, x.more) }),
            ),
          ),
        ),
        d.dirs.length === 0 ? h('li', { class: 'meta fb-empty', text: 'No folders in here.' }) : null,
      ),
      h('div', { class: 'fb-foot' }, useBtn, h('p', { class: 'meta', role: 'status', text: why })),
    );
  }

  return {
    el,
    /** Starts beside the current project (to switch to a sibling), otherwise in the home folder. */
    async start() {
      let from = '';
      if (state.info.root) {
        try {
          from = (await engine.folders(state.info.root)).parent || '';
        } catch {
          from = '';
        }
      }
      return show(from);
    },
  };
}

function joinPath(dir, name) {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

/**
 * The "which project?" card.
 * @param ctx        the Studio context (engine, state, openProject)
 * @param opts.onOpened(result)  called after a project was opened
 * @param opts.onCancel          when given, a Cancel button is shown (there is already a project to go back to)
 * @returns {{el: HTMLElement, dispose: () => void}}
 */
export function projectChooser(ctx, { onOpened, onCancel }) {
  const { engine, state } = ctx;
  const ids = { path: nextId('proj-path'), head: nextId('proj-h') };
  let busy = false;
  let canPick = true; // turned off if this computer turns out to have no folder window
  let alive = true;

  const message = h('div', { class: 'slot', 'aria-live': 'polite' });
  const choices = h('div', { class: 'slot' });
  const browserSlot = h('div', { class: 'slot' });
  const pickBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => pick() }, 'Choose folder…');
  const browseBtn = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', onclick: () => toggleBrowser() }, 'Browse folders');
  const input = h('input', { id: ids.path, class: 'field mono', type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: '/Users/you/Desktop/my-website' });
  const openBtn = h('button', { type: 'submit', class: 'btn' }, 'Open');
  const drop = h('div', { class: 'dropzone', 'aria-hidden': 'true' }, h('span', { class: 'drop-t', text: 'Drop your project folder anywhere on this page' }));
  const el = h(
    'section',
    { class: 'choose', 'aria-labelledby': ids.head },
    h('h2', { class: 'choose-t', id: ids.head, text: 'Which project do you want to check?' }),
    h('p', { class: 'help', text: 'Pick the folder that holds your website or app. Choosing it only looks inside; nothing is changed or uploaded.' }),
    h('div', { class: 'choose-actions' }, pickBtn, browseBtn, onCancel ? h('button', { type: 'button', class: 'btn btn-quiet', onclick: onCancel }, 'Keep the current project') : null),
    drop,
    h(
      'form',
      {
        class: 'choose-path',
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          open(input.value);
        },
      },
      h('label', { for: ids.path, class: 'label', text: 'Or paste the folder’s path' }),
      h('div', { class: 'row' }, input, openBtn),
      h('p', { class: 'help', text: 'On a Mac, select the folder in Finder, press Option + Command + C, and paste here.' }),
    ),
    choices,
    message,
    browserSlot,
  );

  const browser = folderBrowser(ctx, { onUse: (p) => open(p) });
  browserSlot.hidden = true;
  browserSlot.append(browser.el);

  function setBusy(on, label) {
    busy = on;
    for (const b of [pickBtn, browseBtn, openBtn]) b.disabled = on;
    el.setAttribute('aria-busy', String(on));
    if (label !== undefined) pickBtn.textContent = label;
  }

  function drawRecent() {
    clear(choices);
    const recent = state.info?.recent || [];
    if (!recent.length) return;
    choices.append(
      h('p', { class: 'label', text: 'Recent projects' }),
      h(
        'ul',
        { class: 'fb-list recent' },
        recent.map((p) =>
          h('li', {}, h('button', { type: 'button', class: 'fb-row has-files', onclick: () => open(p) }, h('span', { class: 'fb-name', text: baseName(p) }), h('span', { class: 'fb-count', text: p }))),
        ),
      ),
    );
  }

  function toggleBrowser(force) {
    const show = force ?? browserSlot.hidden;
    browserSlot.hidden = !show;
    browseBtn.setAttribute('aria-expanded', String(show));
    browseBtn.textContent = show ? 'Hide folder list' : 'Browse folders';
    if (show) browser.start();
  }

  async function open(text) {
    if (busy) return;
    const typed = String(text ?? '').trim();
    clear(message);
    if (!typed) {
      message.append(notice(new Error('Type or paste a folder path first, or use “Choose folder…”.')));
      input.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await ctx.openProject(typed);
      if (!alive) return;
      onOpened(result);
    } catch (err) {
      if (!alive) return;
      setBusy(false);
      message.append(notice(err));
    }
  }

  async function pick() {
    if (busy) return;
    clear(message);
    setBusy(true, 'Waiting for the folder window…');
    message.append(h('p', { class: 'meta', role: 'status', text: 'A window asking for a folder should have opened on your computer. It can hide behind this one.' }));
    try {
      const r = await engine.pickFolder();
      if (!alive) return;
      clear(message);
      pickBtn.textContent = 'Choose folder…';
      setBusy(false);
      if (r.path) await open(r.path);
    } catch (err) {
      if (!alive) return;
      clear(message);
      pickBtn.textContent = 'Choose folder…';
      setBusy(false);
      if (err.code === 'no_dialog') {
        canPick = false;
        pickBtn.hidden = true;
        browseBtn.classList.add('btn-primary');
        message.append(notice(err, 'notice'));
        toggleBrowser(true);
      } else message.append(notice(err));
    }
  }

  // ---- dropping a folder -------------------------------------------------------------------------------
  // A browser never says where a dropped folder lives on disk, only its name. So the name is looked up near
  // the home folder; if several folders match, the person picks.
  async function openByName(name) {
    if (busy) return;
    setBusy(true);
    clear(message).append(h('p', { class: 'meta', role: 'status', text: `Looking for a folder called “${name}”…` }));
    let found;
    try {
      found = await engine.findFolder(name);
    } catch (err) {
      if (!alive) return;
      setBusy(false);
      clear(message).append(notice(err));
      return;
    }
    if (!alive) return;
    setBusy(false);
    clear(message);
    const withFiles = found.matches.filter((m) => m.files > 0);
    if (found.matches.length === 0) {
      message.append(notice(new Error(`Could not find a folder called “${name}” in your home folder. Browsers do not say where a dropped folder lives, so use “Choose folder…” or paste its path instead.`)));
    } else if (withFiles.length === 1 || found.matches.length === 1) {
      open((withFiles[0] || found.matches[0]).path);
    } else {
      const option = (m) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: m.files ? 'fb-row has-files' : 'fb-row', onclick: () => open(m.path) },
            h('span', { class: 'fb-name', text: m.path }),
            h('span', { class: 'fb-count', text: countLabel(m.files, false) }),
          ),
        );
      message.append(h('p', { class: 'label', text: `More than one folder is called “${name}”. Which one?` }), h('ul', { class: 'fb-list' }, found.matches.map(option)));
    }
  }

  /** Reads everything it needs from the drop synchronously (the browser clears it afterwards), then acts. */
  function onDrop(e) {
    if (!visible()) return; // e.g. the person switched to "Paste code" and dropped text into its box
    e.preventDefault();
    el.classList.remove('is-dragging');
    depth = 0;
    const dt = e.dataTransfer;
    if (!dt) return;
    const uri = (dt.getData('text/uri-list') || '').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
    const text = (uri || dt.getData('text/plain') || '').trim();
    if (text) return void open(text);
    const folders = [];
    let files = 0;
    for (const item of dt.items ? [...dt.items] : []) {
      const entry = item.kind === 'file' && typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry?.isDirectory) folders.push(entry.name);
      else if (item.kind === 'file') files += 1;
    }
    if (folders.length) return void openByName(folders[0]);
    clear(message).append(
      notice(new Error(files ? 'That is a file. Drop the folder that holds your project instead.' : 'That drop did not contain a folder. Use “Choose folder…” instead.')),
    );
  }

  // The drop works anywhere on the page, so a slightly missed drop does not make the browser open the folder.
  let depth = 0;
  const visible = () => el.isConnected && !el.closest('[hidden]');
  const hasFiles = (e) => visible() && [...(e.dataTransfer?.types || [])].some((t) => t === 'Files' || t === 'text/uri-list');
  const onEnter = (e) => {
    if (!hasFiles(e)) return;
    depth += 1;
    el.classList.add('is-dragging');
  };
  const onLeave = (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) el.classList.remove('is-dragging');
  };
  const onOver = (e) => {
    if (hasFiles(e)) e.preventDefault();
  };
  window.addEventListener('dragenter', onEnter);
  window.addEventListener('dragleave', onLeave);
  window.addEventListener('dragover', onOver);
  window.addEventListener('drop', onDrop);

  drawRecent();
  return {
    el,
    focus: () => (canPick ? pickBtn : browseBtn).focus(),
    dispose() {
      alive = false;
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    },
  };
}
