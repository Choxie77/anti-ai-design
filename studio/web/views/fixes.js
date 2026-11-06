import { h, clear, plural, copyText } from '../ui.js';
import { compareRescan } from '../model.js';
import { unifiedDiff, splitDiff } from './diffview.js';

export function renderFixes(main, ctx) {
  const { engine, state, announce } = ctx;
  const scan = state.scan;
  let alive = true;
  const narrow = window.matchMedia('(max-width: 47.99rem)');

  const root = h('div', { class: 'screen' }, h('h1', { text: 'Safe fixes' }));
  main.append(root);

  if (!scan) {
    root.append(h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: 'Nothing to fix yet' }), h('p', { text: 'Scan a folder or snippet first. Fixes are previewed from the scan target.' }), h('a', { class: 'btn btn-primary', href: '#/scan', text: 'Go to Scan' })));
    return;
  }
  if (!state.fix || state.fix.scan !== scan) {
    state.fix = { scan, layout: 'unified', confirm: false, phase: 'idle', result: null, rescan: null, compare: null, changelog: null, error: null };
  }
  const fx = state.fix;
  const isSnippet = scan.kind === 'snippet';
  const body = h('div', { class: 'stack' });
  root.append(body);

  const onNarrow = () => alive && draw();
  narrow.addEventListener('change', onNarrow);

  function guarantee() {
    return h('p', { class: 'guarantee' }, h('strong', { text: 'Nothing is written until you apply.' }), ' ', isSnippet ? 'This is a pasted snippet: applying only produces fixed text for you to copy.' : 'This page shows a dry run. Applying edits the files shown below and appends a line per fix to the changelog.');
  }

  async function load(force) {
    fx.phase = 'loading';
    fx.error = null;
    draw();
    try {
      await ctx.ensurePreview(force);
      if (!alive) return;
      if (state.previewError) throw state.previewError;
      fx.phase = fx.phase === 'loading' ? 'ready' : fx.phase;
    } catch (err) {
      fx.phase = 'error';
      fx.error = err;
    }
    if (alive) draw();
  }

  async function apply() {
    const p = state.preview;
    fx.phase = 'applying';
    fx.confirm = false;
    draw();
    try {
      const input = { ...state.scanInput, confirm: true, diffId: p.diffId };
      const result = await engine.applyFixes(input);
      fx.result = result;
      const before = scan;
      const fixableBefore = new Set(state.fixable);
      let nextInput = state.scanInput;
      if (isSnippet && typeof result.fixed === 'string') {
        nextInput = { snippet: result.fixed, ext: state.scanInput.ext };
        state.scanForm.snippet = result.fixed;
      }
      const after = await engine.scan(nextInput);
      fx.compare = compareRescan(before.findings, after.findings, fixableBefore);
      fx.rescan = { before: before.summary.total, after: after.summary.total };
      if (!isSnippet) {
        try {
          fx.changelog = await engine.changelog();
        } catch {
          fx.changelog = null;
        }
      }
      fx.phase = 'done';
      // Make the rescan the current scan; the next preview is computed from it.
      ctx.setScan(after, nextInput);
      state.fix = fx;
      fx.scan = after;
      announce(`Applied ${plural(result.applied, 'fix', 'fixes')}`);
    } catch (err) {
      fx.phase = 'error';
      fx.error = err;
      announce('Applying failed');
    }
    if (alive) draw();
  }

  function layoutToggle() {
    const effective = narrow.matches ? 'unified' : fx.layout;
    if (narrow.matches) return null;
    const mk = (v, label) => {
      const id = `lay-${v}`;
      return h('span', { class: 'seg' }, h('input', { type: 'radio', name: 'layout', id, checked: effective === v, onchange: () => { fx.layout = v; draw(); } }), h('label', { for: id, text: label }));
    };
    return h('fieldset', { class: 'fs' }, h('legend', { class: 'label', text: 'Diff layout' }), h('div', { class: 'segs' }, mk('unified', 'Unified'), mk('split', 'Side by side')));
  }

  function diffs(files) {
    const split = !narrow.matches && fx.layout === 'split';
    return h(
      'div',
      { class: 'diffs' },
      files.map((f) =>
        h('section', { class: 'diff-file' }, h('h3', { class: 'group-title mono', text: f.file }), h('p', { class: 'meta', text: `${plural(f.deletions, 'line')} removed, ${plural(f.additions, 'line')} added` }), split ? splitDiff(f) : unifiedDiff(f)),
      ),
    );
  }

  function confirmPanel(p) {
    const cancel = h('button', { type: 'button', class: 'btn btn-quiet', text: 'Cancel', onclick: () => { fx.confirm = false; draw(); document.getElementById('apply-btn')?.focus(); } });
    const panel = h(
      'div',
      { class: 'confirm', role: 'group', 'aria-labelledby': 'confirm-h' },
      h('h2', { id: 'confirm-h', class: 'notice-title', text: isSnippet ? 'Produce the fixed snippet?' : `Write ${plural(p.fixCount, 'fix', 'fixes')} to ${plural(p.fileCount, 'file')}?` }),
      h('p', { text: isSnippet ? 'No file is touched. You get the fixed text back to copy.' : `This edits ${p.files.map((f) => f.file).join(', ')} under ${state.info?.root || 'the root'} and logs each change to .anti-ai-design/changelog.md. There is no undo button; the diff above is the record.` }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', text: isSnippet ? 'Yes, produce it' : 'Yes, write the changes', onclick: apply }), cancel),
    );
    setTimeout(() => panel.querySelector('button')?.focus(), 0);
    return panel;
  }

  function draw() {
    if (!alive) return;
    clear(body);
    const p = state.preview;
    if (fx.phase === 'idle') {
      load(false);
      return;
    }
    if (fx.phase === 'loading') {
      body.append(h('p', { class: 'loading', role: 'status', text: 'Reading the fixes the detector would make…' }));
      return;
    }
    if (fx.phase === 'applying') {
      body.append(h('p', { class: 'loading', role: 'status', text: 'Applying, then scanning again…' }));
      return;
    }
    if (fx.phase === 'error') {
      body.append(
        h('div', { class: 'notice notice-error', role: 'alert' }, h('h2', { class: 'notice-title', text: fx.error?.code === 'diff_changed' ? 'The files changed under the preview' : 'The fixes could not be completed' }), h('p', { text: fx.error?.message || 'Unknown error.' }), h('button', { type: 'button', class: 'btn btn-quiet', text: 'Preview again', onclick: () => { fx.phase = 'idle'; draw(); } })),
      );
      return;
    }
    if (fx.phase === 'done') return drawDone();

    if (!p || p.fixCount === 0) {
      body.append(
        guarantee(),
        h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: 'No safe fix for this scan' }), h('p', { text: 'The detector only rewrites code when the change is mechanical and cannot alter meaning. Today that covers gradient text. The findings on the Results screen need a person.' }), h('a', { class: 'btn btn-quiet', href: '#/results', text: 'Back to the findings' })),
      );
      return;
    }
    body.append(
      guarantee(),
      h('p', { class: 'lede' }, `${plural(p.fixCount, 'fix', 'fixes')} in ${plural(p.fileCount, 'file')}. Read the diff, then decide.`),
      layoutToggle(),
      diffs(p.files),
      fx.confirm
        ? confirmPanel(p)
        : h('div', { class: 'row' }, h('button', { id: 'apply-btn', type: 'button', class: 'btn btn-primary', text: `Apply ${plural(p.fixCount, 'fix', 'fixes')}`, onclick: () => { fx.confirm = true; draw(); } }), h('p', { class: 'help', text: 'You will be asked to confirm first.' })),
    );
  }

  function drawDone() {
    const r = fx.result;
    const gone = fx.compare.every((c) => c.gone);
    body.append(
      h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: isSnippet ? 'Fixed snippet ready' : `Applied ${plural(r.applied, 'fix', 'fixes')}` }), h('p', { text: isSnippet ? 'No file was written. Copy the fixed text below.' : `Written: ${r.written.join(', ') || 'nothing'}.` })),
    );
    if (isSnippet && typeof r.fixed === 'string') {
      const btn = h('button', { type: 'button', class: 'btn btn-quiet', text: 'Copy fixed snippet', onclick: async () => { const ok = await copyText(r.fixed); btn.textContent = ok ? 'Copied' : 'Copy failed'; } });
      body.append(h('pre', { class: 'plain mono', tabindex: '0', text: r.fixed }), btn);
    }
    if (fx.changelog?.exists) {
      body.append(
        h('section', {}, h('h2', { class: 'section-title', text: 'Changelog' }), h('p', { class: 'meta' }, h('code', { text: fx.changelog.path }), ` · last ${fx.changelog.entries.length} of ${fx.changelog.total}`), h('table', { class: 'log' }, h('thead', {}, h('tr', {}, ['When (UTC)', 'Rule', 'Where', 'Change'].map((t) => h('th', { scope: 'col', text: t })))), h('tbody', {}, fx.changelog.entries.map((e) => h('tr', {}, h('td', { class: 'mono', 'data-label': 'When (UTC)', text: e.time }), h('td', { class: 'mono', 'data-label': 'Rule', text: e.rule }), h('td', { class: 'mono', 'data-label': 'Where', text: e.where }), h('td', { 'data-label': 'Change', text: e.change })))))),
      );
    }
    body.append(
      h(
        'section',
        {},
        h('h2', { class: 'section-title', text: 'Scanned again' }),
        h('p', { class: gone ? 'verdict' : 'verdict verdict-open', text: gone ? `The fixed findings are gone. ${plural(fx.rescan.after, 'finding')} left, down from ${fx.rescan.before}.` : `Some fixed findings still show up. ${plural(fx.rescan.after, 'finding')} now, ${fx.rescan.before} before.` }),
        h('ul', { class: 'rule-list' }, fx.compare.map((c) => h('li', { class: 'tally-row2' }, h('code', { text: `${c.rule} · ${c.file}` }), ` ${c.gone ? 'not reported any more' : `still ${c.after} reported`} (was ${c.before})`))),
        h('div', { class: 'row' }, fx.rescan.after > 0 ? h('a', { class: 'btn btn-quiet', href: '#/results', text: 'See the remaining findings' }) : null, h('a', { class: 'btn btn-quiet', href: '#/scan', text: 'Scan something else' })),
      ),
    );
  }

  draw();
  return () => {
    alive = false;
    narrow.removeEventListener('change', onNarrow);
  };
}
