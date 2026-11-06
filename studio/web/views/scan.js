import { h, clear, plural, copyText, nextId } from '../ui.js';
import { EngineError } from '../engine.js';
import { CATEGORY } from '../glossary.js';

const EXAMPLE = `.hero h1 {
  font-size: 3rem;
  background: linear-gradient(90deg, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
`;

export function renderScan(main, ctx) {
  const { engine, state, go, announce } = ctx;
  const form = state.scanForm;
  const info = state.info;
  const engineOk = info?.engine?.found;
  const ids = { path: nextId('path'), ext: nextId('ext'), code: nextId('code'), err: nextId('err') };
  let busy = false;
  let alive = true;
  let browseReq = 0;

  const errorSlot = h('div', { class: 'slot', id: ids.err });
  const folderBody = h('div', { class: 'stack' });
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
    submit.textContent = form.mode === 'folder' ? (form.path.trim() ? 'Scan this folder' : 'Scan whole project') : 'Scan this code';
    submit.disabled = busy || !engineOk;
  }

  async function loadBrowse() {
    const req = ++browseReq;
    let data;
    try {
      data = await engine.browse(form.path);
    } catch (err) {
      if (!alive || req !== browseReq) return;
      const msg = err.code === 'not_a_folder' ? 'That is a single file. Only that file will be scanned.' : err.status === 404 ? 'No file or folder with that name in your project.' : err.message;
      clear(browseList).append(h('p', { class: 'meta', text: msg }));
      return;
    }
    if (!alive || req !== browseReq) return;
    const here = data.path || 'the project';
    clear(browseList).append(
      h('p', { class: 'meta' }, 'Inside ', h('code', { text: data.path || 'the project folder' }), `: ${plural(data.fileCount, 'file')}, ${plural(data.dirs.length, 'folder')}. Click a folder to limit the scan to it.`),
      h(
        'ul',
        { class: 'rule-list', 'aria-label': `Folders inside ${here}` },
        data.parent !== null
          ? h('li', {}, h('button', { type: 'button', class: 'linkish', onclick: () => pick(data.parent) }, 'Back up one level'))
          : null,
        data.dirs.map((d) =>
          h('li', {}, h('button', { type: 'button', class: 'linkish mono', onclick: () => pick(data.path ? `${data.path}/${d}` : d) }, d + '/')),
        ),
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

  async function onSubmit(e) {
    e.preventDefault();
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
    try {
      const scan = await engine.scan(input);
      if (!alive) return;
      ctx.setScan(scan, input);
      announce(`Scan finished: ${plural(scan.summary.total, 'finding')}`);
      go('results');
    } catch (err) {
      if (!alive) return;
      busy = false;
      submit.removeAttribute('aria-busy');
      sync();
      showError(err);
      announce('Scan failed');
    }
  }

  folderBody.append(
    h('label', { for: ids.path, class: 'label', text: 'Limit to a folder or file (optional)' }),
    h('p', { id: 'path-help', class: 'help', text: 'Type a path inside your project, such as src/styles, or pick a folder below. Files outside the project are never read.' }),
    pathInput,
    browseList,
  );
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
        text: 'Fill in a small example',
        onclick: () => {
          form.snippet = EXAMPLE;
          form.ext = 'css';
          code.value = EXAMPLE;
          extSelect.value = 'css';
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
      ['Scan', 'The detector reads your code. A scan never changes a file.'],
      ['Findings', 'Each mark is listed with the reason it matters and the exact line of code.'],
      ['Fixes', 'Only mechanical fixes are offered. You see the change first and confirm it.'],
    ].map(([t, d], i) => h('li', { class: 'how-step' }, h('span', { class: 'how-n', 'aria-hidden': 'true', text: String(i + 1) }), h('div', {}, h('p', { class: 'how-t', text: t }), h('p', { class: 'how-d', text: d })))),
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

  main.append(
    h(
      'div',
      { class: 'screen' },
      h('h1', { text: 'Scan your project' }),
      h('p', { class: 'lede', text: 'The detector reads your HTML, CSS and component code and flags what makes an interface look machine-generated, plus basic craft and accessibility slips.' }),
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
        h('div', { class: 'panel-foot' }, errorSlot, submit, h('p', { class: 'help', text: 'Reading only. You will review the results before anything can be fixed.' })),
        checks,
      ),
    ),
  );

  sync();
  if (engineOk) loadBrowse();
  return () => {
    alive = false;
  };
}
