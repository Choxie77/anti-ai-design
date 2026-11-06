import { h, clear, plural, copyText, nextId, s, reducedMotion } from '../ui.js';
import { EngineError, canSwitchProject, serverIsOutdated, STALE_SERVER } from '../engine.js';
import { CATEGORY } from '../glossary.js';
import { SAMPLE, SAMPLE_EXT } from '../sample.js';
import { MINI } from '../art.js';
import { SCANNED_KINDS, SKIPPED_FOLDERS } from './results.js';
import { projectChooser } from './project.js';

/** The last part of a path, whichever way the computer writes its slashes. */
function baseName(p) {
  return String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
}

/** A page of code being read by a red band. Used while a scan runs. */
export function readingAnimation(lines) {
  const widths = [70, 120, 90, 150, 60, 110, 130, 80];
  return h(
    'div',
    { class: 'reading', 'aria-hidden': 'true' },
    s(
      'svg',
      { viewBox: '0 0 200 96', class: 'reading-svg', focusable: 'false' },
      s('rect', { x: 1, y: 1, width: 198, height: 94, rx: 3, class: 'f-paper s-ink' }),
      ...widths.map((w, i) => s('rect', { x: 14, y: 10 + i * 10.5, width: w, height: 5, rx: 2.5, class: 'f-rule' })),
      s('g', { class: 'a-sweep sweep reading-sweep', vars: {} }, s('rect', { x: 2, y: 6, width: 196, height: 14, class: 'sweep-band' }), s('rect', { x: 2, y: 6, width: 196, height: 1.5, class: 'f-red' })),
    ),
    h('p', { class: 'reading-t', text: lines ? `Reading ${plural(lines, 'line')} of code…` : 'Reading your code…' }),
  );
}

/** "This will read 14 files (9 CSS, 4 HTML, 1 JSX)", or a plain explanation of why a folder has nothing to read. */
function scanSummary(sc, where) {
  const label = (ext) => ext.replace(/^\./, '').toUpperCase();
  if (sc.files === 0) {
    return h(
      'div',
      { class: 'notice notice-error', role: 'status' },
      h('p', { class: 'notice-title', text: 'Nothing to scan in here' }),
      h('p', { text: `There are no ${SCANNED_KINDS} in ${where}${sc.skippedDirs?.length ? `, apart from ${sc.skippedDirs.join(', ')}, which are skipped` : ''}. Pick the folder that holds your front-end code, or go back up a level.` }),
    );
  }
  const parts = Object.entries(sc.byExt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, n]) => `${n} ${label(ext)}`);
  return h(
    'p',
    { class: 'meta scan-summary', role: 'status' },
    h('strong', { text: `${sc.truncated ? 'At least ' : ''}${plural(sc.files, 'file')} will be read` }),
    ` in `,
    h('code', { text: where }),
    ` (${parts.join(', ')}${Object.keys(sc.byExt).length > 5 ? ', …' : ''}).`,
    sc.skippedDirs?.length ? ` ${sc.skippedDirs.join(', ')} ${sc.skippedDirs.length === 1 ? 'is' : 'are'} skipped.` : '',
  );
}

export function renderScan(main, ctx) {
  const { engine, state, go, announce } = ctx;
  const form = state.scanForm;
  const info = state.info;
  const engineOk = info?.engine?.found;
  const ids = { path: nextId('path'), ext: nextId('ext'), code: nextId('code'), err: nextId('err') };
  let busy = false;
  let alive = true;
  let browseReq = 0;
  let scannable = null; // what the detector would read in the chosen folder, from the last browse
  let chooser = null; // the "which project?" card while it is on screen
  const canSwitch = canSwitchProject(info);

  const errorSlot = h('div', { class: 'slot', id: ids.err });
  const readingSlot = h('div', { class: 'slot reading-slot' });
  const folderBody = h('div', { class: 'stack' });
  const projectSlot = h('div', { class: 'slot project-slot' });
  const summarySlot = h('div', { class: 'slot', 'aria-live': 'polite' });
  const snippetBody = h('div', { class: 'stack' });
  const browseList = h('div', { class: 'browse', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' });

  const pathInput = h('input', {
    id: ids.path,
    class: 'field mono',
    type: 'text',
    value: form.path,
    placeholder: 'Leave empty to scan the whole project',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'path-help',
    onchange: () => {
      form.path = pathInput.value.trim();
      loadBrowse();
      sync();
    },
  });

  const extSelect = h(
    'select',
    { id: ids.ext, class: 'field', onchange: () => (form.ext = extSelect.value) },
    (info?.snippetExts || ['html', 'css', 'jsx', 'tsx']).map((e) => h('option', { value: e, selected: e === form.ext }, e)),
  );
  extSelect.value = form.ext;

  const code = h('textarea', {
    id: ids.code,
    class: 'field mono code-in',
    rows: '12',
    spellcheck: 'false',
    autocapitalize: 'off',
    placeholder: 'Paste markup, styles or component code',
    oninput: () => (form.snippet = code.value),
  });
  code.value = form.snippet;

  function modeRadio(value, label) {
    const id = nextId('mode');
    return h(
      'span',
      { class: 'seg' },
      h('input', {
        type: 'radio',
        name: 'mode',
        id,
        value,
        checked: form.mode === value,
        onchange: () => {
          form.mode = value;
          sync();
        },
      }),
      h('label', { for: id, text: label }),
    );
  }

  function sync() {
    folderBody.hidden = form.mode !== 'folder';
    snippetBody.hidden = form.mode !== 'snippet';
    const noProject = !info?.root;
    scopeBox.hidden = noProject || choosing || form.mode !== 'folder';
    summarySlot.hidden = noProject || choosing;
    submit.textContent = form.mode === 'folder' ? (noProject ? 'Choose a project first' : form.path.trim() ? (/\.[a-z0-9]+$/i.test(form.path.trim()) ? 'Scan this file' : 'Scan this folder') : 'Scan whole project') : 'Scan this code';
    submit.hidden = form.mode === 'folder' && choosing; // one thing to do at a time: pick the project first
    submit.disabled = busy || !engineOk || (form.mode === 'folder' && (noProject || (scannable !== null && scannable.files === 0)));
  }

  async function loadBrowse() {
    if (!info?.root) return;
    const req = ++browseReq;
    let data;
    try {
      data = await engine.browse(form.path);
    } catch (err) {
      if (!alive || req !== browseReq) return;
      scannable = err.status === 404 ? { files: 0, byExt: {}, skippedDirs: [], missing: true } : null;
      sync();
      const msg = err.code === 'not_a_folder' ? 'That is a single file. Only that file will be scanned.' : err.status === 404 ? 'No file or folder with that name in your project.' : err.message;
      clear(browseList);
      clear(summarySlot).append(h('p', { class: err.status === 404 ? 'notice notice-error' : 'meta', role: 'status', text: msg }));
      return;
    }
    if (!alive || req !== browseReq) return;
    const here = data.path || 'the project';
    scannable = data.scannable || null;
    sync();
    const where = data.path || 'the project folder';
    // What will be read stays in view under the project; the folder list (for narrowing the scan) is tucked away.
    clear(summarySlot).append(scannable ? scanSummary(scannable, where) : h('p', { class: 'meta' }, 'Inside ', h('code', { text: where }), `: ${plural(data.fileCount, 'file')}, ${plural(data.dirs.length, 'folder')}.`));
    clear(browseList).append(
      data.dirs.length || data.parent !== null ? h('p', { class: 'meta', text: 'Click a folder to limit the scan to it.' }) : null,
      h(
        'ul',
        { class: 'rule-list', 'aria-label': `Folders inside ${here}` },
        data.parent !== null
          ? h('li', {}, h('button', { type: 'button', class: 'linkish', onclick: () => pick(data.parent) }, 'Back up one level'))
          : null,
        data.dirs.map((d) => {
          const skip = (data.skippedDirs || []).includes(d);
          return h('li', {}, h('button', { type: 'button', class: 'linkish mono', onclick: () => pick(data.path ? `${data.path}/${d}` : d) }, d + '/'), skip ? h('span', { class: 'meta', text: ' (not scanned: dependencies and build output)' }) : null);
        }),
        data.dirs.length === 0 ? h('li', { class: 'meta', text: 'No subfolders here.' }) : null,
      ),
    );
  }

  function pick(p) {
    form.path = p;
    pathInput.value = p;
    loadBrowse();
    sync();
  }

  function showError(err) {
    clear(errorSlot);
    if (!err) return;
    const missing = err.code === 'engine_not_found';
    errorSlot.append(
      h(
        'div',
        { class: 'notice notice-error', role: 'alert' },
        h('h2', { class: 'notice-title', text: missing ? 'The detector has not been built yet' : 'The scan did not finish' }),
        h('p', { text: err.message }),
        missing && err.details?.buildCommand ? h('pre', { class: 'plain mono', text: err.details.buildCommand }) : null,
        err.details?.stderr ? h('pre', { class: 'plain mono', text: err.details.stderr }) : null,
      ),
    );
  }

  async function onSubmit(e, { minMs = 0 } = {}) {
    if (e) e.preventDefault();
    if (busy) return;
    let input;
    if (form.mode === 'snippet') {
      if (!form.snippet.trim()) {
        showError(new EngineError('empty_snippet', 'Paste some code first, or use the example to see how it works.'));
        code.focus();
        return;
      }
      input = { snippet: form.snippet, ext: form.ext };
    } else {
      form.path = pathInput.value.trim();
      input = { target: form.path || '.' };
    }
    busy = true;
    showError(null);
    submit.textContent = 'Scanning…';
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    announce('Scanning');
    clear(readingSlot).append(readingAnimation(input.snippet ? input.snippet.split('\n').length : 0));
    try {
      const started = Date.now();
      const scan = await engine.scan(input);
      // Guided runs wait a moment so the reading animation can play once; normal scans never wait.
      const wait = reducedMotion() ? 0 : minMs - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      ctx.setScan(scan, input);
      announce(`Scan finished: ${plural(scan.summary.total, 'finding')}`);
      go('results');
    } catch (err) {
      if (!alive) return;
      busy = false;
      clear(readingSlot);
      submit.removeAttribute('aria-busy');
      sync();
      showError(err);
      announce('Scan failed');
    }
  }

  // Which project: a bar once one is chosen, the chooser card until then (or when the person wants another).
  function drawProject() {
    chooser?.dispose();
    chooser = null;
    clear(projectSlot);
    if (info?.root && !choosing) {
      if (serverIsOutdated(info)) projectSlot.append(h('div', { class: 'notice notice-error', role: 'alert' }, h('p', { class: 'notice-title', text: 'Restart the Studio to switch projects' }), h('p', { text: STALE_SERVER })));
      projectSlot.append(
        h(
          'div',
          { class: 'proj-bar' },
          h('div', { class: 'proj-id' }, h('p', { class: 'label', text: 'Project' }), h('p', { class: 'proj-name', text: baseName(info.root) }), h('code', { class: 'proj-path', text: info.root })),
          canSwitch ? h('button', { type: 'button', class: 'btn', onclick: () => ((choosing = true), drawProject(), sync()) }, 'Change project') : null,
        ),
      );
      return;
    }
    chooser = projectChooser(ctx, {
      onCancel: info?.root ? () => ((choosing = false), drawProject(), sync()) : null,
      onOpened: (r) => {
        choosing = false;
        form.path = r.focus || '';
        pathInput.value = form.path;
        scannable = null;
        drawProject();
        loadBrowse();
        sync();
        announce(`Opened ${r.name}. ${plural(r.scannable.files, 'file')} will be read.`);
        if (!submit.disabled) submit.focus();
      },
    });
    projectSlot.append(chooser.el);
  }

  const scopeBox = h(
    'details',
    { class: 'scope', open: Boolean(form.path) },
    h('summary', { text: 'Only check part of the project (optional)' }),
    h('div', { class: 'stack scope-body' }, h('label', { for: ids.path, class: 'label', text: 'A folder or file inside the project' }), h('p', { id: 'path-help', class: 'help', text: 'Type a path inside your project, such as src/styles, or pick a folder below. Files outside the project are never read.' }), pathInput, browseList),
  );
  folderBody.append(projectSlot, summarySlot, scopeBox);
  snippetBody.append(
    h('div', { class: 'row' }, h('label', { for: ids.ext, class: 'label', text: 'What kind of code is it?' }), extSelect),
    h('label', { for: ids.code, class: 'label', text: 'Your code' }),
    code,
    h(
      'p',
      { class: 'help' },
      h('button', {
        type: 'button',
        class: 'linkish',
        text: 'Fill in a sample with real problems in it',
        onclick: () => {
          form.snippet = SAMPLE;
          form.ext = SAMPLE_EXT;
          code.value = SAMPLE;
          extSelect.value = SAMPLE_EXT;
        },
      }),
      ' Pasted code is held in a private temporary folder and deleted right after the scan.',
    ),
  );

  const engineNotice = engineOk
    ? null
    : h(
        'div',
        { class: 'notice notice-error', role: 'alert' },
        h('h2', { class: 'notice-title', text: 'The detector was not found' }),
        h('p', { text: info?.engine?.error || 'The Studio looked for the detector program next to this repository and on your PATH, and found nothing it could run.' }),
        h('p', { class: 'meta', text: 'Build it once from the repository folder, then reload this page:' }),
        h('pre', { class: 'plain mono', text: info?.buildCommand || '' }),
        h('button', { type: 'button', class: 'btn btn-quiet', text: 'Copy the build command', onclick: () => copyText(info?.buildCommand || '') }),
      );

  const how = h(
    'ol',
    { class: 'how', 'aria-label': 'How the Studio works' },
    [
      ['Scan', 'The detector reads your code. A scan never changes a file.', 'scan'],
      ['Findings', 'Each mark is listed with the reason it matters and the exact line of code.', 'results'],
      ['Fixes', 'Only mechanical fixes are offered. You see the change first and confirm it.', 'fixes'],
    ].map(([t, d, key], i) => h('li', { class: 'how-step' }, h('span', { class: 'how-art' }, MINI[key]()), h('div', {}, h('p', { class: 'how-t' }, h('span', { class: 'how-n', 'aria-hidden': 'true', text: `${i + 1}` }), t), h('p', { class: 'how-d', text: d })))),
  );

  const checks = h('p', { class: 'meta checks' });
  engine
    .listRules()
    .then(({ rules }) => {
      if (!alive) return;
      const by = {};
      for (const r of rules) by[r.category] = (by[r.category] || 0) + 1;
      const parts = Object.keys(CATEGORY)
        .filter((k) => by[k])
        .map((k) => `${by[k]} on ${CATEGORY[k].topic}`);
      checks.append(`${rules.length} checks: ${parts.join(', ')}. `, h('a', { href: '#/rules', text: 'See every check' }), '.');
    })
    .catch(() => {});

  const startHere = h(
    'section',
    { class: 'start-here', 'aria-labelledby': 'sh-h' },
    h('div', { class: 'start-copy' }, h('h2', { class: 'start-t', id: 'sh-h', text: 'New here?' }), h('p', { class: 'start-d', text: 'Take a short illustrated tour, or try the Studio on a small sample. Nothing in your project is touched either way.' })),
    h('div', { class: 'start-actions' }, h('button', { type: 'button', class: 'btn btn-primary', disabled: !engineOk, onclick: () => ctx.runSample() }, 'Try it on a sample'), h('a', { class: 'btn', href: '#/welcome', text: 'Take the tour' }), h('a', { class: 'btn btn-quiet', href: '#/guide', text: 'Browse the field guide' })),
  );

  main.append(
    h(
      'div',
      { class: 'screen' },
      h('h1', { text: 'Scan your project' }),
      h('p', { class: 'lede', text: 'The detector reads your HTML, CSS and component code and flags what makes an interface look machine-generated, plus basic craft and accessibility slips.' }),
      startHere,
      how,
      engineNotice,
      h(
        'form',
        { class: 'panel', onsubmit: onSubmit, novalidate: true },
        h(
          'fieldset',
          { class: 'panel-body' },
          h('legend', { class: 'label', text: 'What do you want to check?' }),
          h('div', { class: 'segs' }, modeRadio('folder', 'My project'), modeRadio('snippet', 'Paste code')),
          folderBody,
          snippetBody,
        ),
        h('div', { class: 'panel-foot' }, errorSlot, readingSlot, submit, h('p', { class: 'help', text: 'Reading only. You will review the results before anything can be fixed.' })),
        checks,
      ),
    ),
  );

  let choosing = Boolean(state.choosing) && canSwitch;
  state.choosing = false;
  drawProject();
  sync();
  if (engineOk) loadBrowse();
  // "Try it on a sample" lands here with the sample filled in and asks for the scan to run itself.
  if (state.autoRun && engineOk) {
    state.autoRun = false;
    setTimeout(() => alive && onSubmit(null, { minMs: 1600 }), 350);
  }
  return () => {
    alive = false;
    chooser?.dispose();
  };
}
