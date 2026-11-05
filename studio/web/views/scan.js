import { h, clear, plural, copyText, nextId } from '../ui.js';
import { EngineError } from '../engine.js';

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
    placeholder: 'Leave empty to scan the whole root',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'path-help',
    onchange: () => {
      form.path = pathInput.value.trim();
      loadBrowse();
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
    submit.textContent = form.mode === 'folder' ? 'Scan folder' : 'Scan snippet';
    submit.disabled = busy || !engineOk;
  }

  async function loadBrowse() {
    const req = ++browseReq;
    let data;
    try {
      data = await engine.browse(form.path);
    } catch (err) {
      if (!alive || req !== browseReq) return;
      const msg = err.code === 'not_a_folder' ? 'This is a single file. It will be scanned on its own.' : err.status === 404 ? 'No such file or folder under the root.' : err.message;
      clear(browseList).append(h('p', { class: 'meta', text: msg }));
      return;
    }
    if (!alive || req !== browseReq) return;
    const here = data.path || 'the root';
    clear(browseList).append(
      h('p', { class: 'meta' }, 'In ', h('code', { text: data.path || '.' }), ` · ${plural(data.fileCount, 'file')}, ${plural(data.dirs.length, 'folder')}`),
      h(
        'ul',
        { class: 'rule-list', 'aria-label': `Folders inside ${here}` },
        data.parent !== null
          ? h('li', {}, h('button', { type: 'button', class: 'linkish', onclick: () => pick(data.parent) }, 'Up one level'))
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
  }

  function showError(err) {
    clear(errorSlot);
    if (!err) return;
    const missing = err.code === 'engine_not_found';
    errorSlot.append(
      h(
        'div',
        { class: 'notice notice-error', role: 'alert' },
        h('h2', { class: 'notice-title', text: missing ? 'The detector is not built' : 'The scan did not finish' }),
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
        showError(new EngineError('empty_snippet', 'Paste some code first, or load the example.'));
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
    h('label', { for: ids.path, class: 'label', text: 'Folder or file under the root' }),
    h('p', { id: 'path-help', class: 'help', text: 'A path relative to the root, such as src/styles. Nothing outside the root can be read.' }),
    pathInput,
    browseList,
  );
  snippetBody.append(
    h('div', { class: 'row' }, h('label', { for: ids.ext, class: 'label', text: 'Type' }), extSelect),
    h('label', { for: ids.code, class: 'label', text: 'Code' }),
    code,
    h(
      'p',
      { class: 'help' },
      h('button', {
        type: 'button',
        class: 'linkish',
        text: 'Load the gradient-text example',
        onclick: () => {
          form.snippet = EXAMPLE;
          form.ext = 'css';
          code.value = EXAMPLE;
          extSelect.value = 'css';
        },
      }),
      ' · pasted code is written to a private temporary folder and deleted straight after the scan.',
    ),
  );

  const engineNotice = engineOk
    ? null
    : h(
        'div',
        { class: 'notice notice-error', role: 'alert' },
        h('h2', { class: 'notice-title', text: 'Engine not found' }),
        h('p', { text: info?.engine?.error || 'The Studio looked for the detector next to this repository and on your PATH and found nothing it could run.' }),
        h('p', { class: 'meta', text: 'Build it from the repository root, then reload this page:' }),
        h('pre', { class: 'plain mono', text: info?.buildCommand || '' }),
        h('button', { type: 'button', class: 'btn btn-quiet', text: 'Copy the build command', onclick: () => copyText(info?.buildCommand || '') }),
      );

  main.append(
    h(
      'div',
      { class: 'screen' },
      h('h1', { text: 'Scan a project' }),
      h('p', { class: 'lede', text: 'Point the detector at a folder or paste a snippet. It reads the code, marks what looks machine-made, and tells you which marks it can fix safely.' }),
      engineNotice,
      h(
        'form',
        { class: 'folio', onsubmit: onSubmit, novalidate: true },
        h(
          'div',
          { class: 'folio-row' },
          h('div', { class: 'margin' }, h('p', { class: 'step', 'aria-hidden': 'true', text: '1' }), h('p', { class: 'margin-note', text: 'What to read' })),
          h(
            'fieldset',
            { class: 'folio-main' },
            h('legend', { class: 'label', text: 'Source' }),
            h('div', { class: 'segs' }, modeRadio('folder', 'A folder'), modeRadio('snippet', 'A pasted snippet')),
            folderBody,
            snippetBody,
          ),
        ),
        h(
          'div',
          { class: 'folio-row' },
          h('div', { class: 'margin' }, h('p', { class: 'step', 'aria-hidden': 'true', text: '2' }), h('p', { class: 'margin-note', text: 'Go' })),
          h(
            'div',
            { class: 'folio-main' },
            errorSlot,
            submit,
            h('p', { class: 'help', text: 'A scan only reads. Fixes are a separate step and are previewed first.' }),
          ),
        ),
      ),
    ),
  );

  sync();
  if (engineOk) loadBrowse();
  return () => {
    alive = false;
  };
}
