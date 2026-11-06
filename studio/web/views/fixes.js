import { h, clear, plural, copyText } from '../ui.js';
import { compareRescan } from '../model.js';
import { unifiedDiff, splitDiff } from './diffview.js';
import { startCoach } from '../coach.js';
import { setFlag } from '../onboarding.js';
import { checkMark } from '../art.js';

/** Two bars that show how far the finding count dropped. */
function scoreVisual(before, after) {
  const bar = (label, n, cls) => {
    const fill = h('span', { class: `score-bar ${cls}` });
    fill.style.setProperty('--w', `${before ? Math.max(n ? 4 : 0, Math.round((n / before) * 100)) : 0}%`);
    return h('div', { class: 'score-row' }, h('span', { class: 'score-k', text: label }), h('span', { class: 'score-track' }, fill), h('span', { class: 'score-n', text: String(n) }));
  };
  return h('figure', { class: 'score', 'aria-label': `Findings before the fix: ${before}. After: ${after}.` }, after < before ? checkMark() : null, h('div', { class: 'score-rows' }, bar('Before', before, 'is-before'), bar('After', after, 'is-after')));
}

export function renderFixes(main, ctx) {
  const { engine, state, announce } = ctx;
  const scan = state.scan;
  let alive = true;
  const narrow = window.matchMedia('(max-width: 47.99rem)');

  const root = h('div', { class: 'screen' }, h('h1', { text: 'Fixes' }));
  main.append(root);

  if (!scan) {
    root.append(h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: 'Run a scan first' }), h('p', { text: 'Fixes come from a scan. Once you have scanned your project, any finding the detector can fix safely shows up here as a before-and-after.' }), h('a', { class: 'btn btn-primary', href: '#/scan', text: 'Go to Scan' })));
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
    return h('p', { class: 'guarantee' }, h('strong', { text: 'Nothing has been changed yet.' }), ' ', isSnippet ? 'This is pasted code, so applying only gives you fixed text to copy. No file is touched.' : 'Below is a preview. If you apply it, only the files shown are edited, and each change is recorded in a changelog.');
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
      h('h2', { id: 'confirm-h', class: 'notice-title', text: isSnippet ? 'Get the fixed code?' : `Write ${plural(p.fixCount, 'fix', 'fixes')} to ${plural(p.fileCount, 'file')}?` }),
      h('p', { text: isSnippet ? 'No file is touched. You get the fixed text back to copy.' : `This edits ${p.files.map((f) => f.file).join(', ')} under ${state.info?.root || 'the root'} and logs each change to .anti-ai-design/changelog.md. There is no undo button; the diff above is the record.` }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', text: isSnippet ? 'Yes, give me the fixed code' : 'Yes, change these files', onclick: apply }), cancel),
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
      body.append(h('p', { class: 'loading', role: 'status', text: 'Working out what the fixes would change…' }));
      return;
    }
    if (fx.phase === 'applying') {
      body.append(h('p', { class: 'loading', role: 'status', text: 'Applying the fixes, then scanning again to check…' }));
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
        h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: 'Nothing here can be fixed automatically' }), h('p', { text: 'The detector only rewrites code when the change is mechanical and cannot alter meaning. Today that covers gradient text. Everything else needs a person to decide, and the Findings screen says what to change.' }), h('a', { class: 'btn btn-quiet', href: '#/results', text: 'Back to Findings' })),
      );
      return;
    }
    body.append(
      guarantee(),
      h('p', { class: 'lede' }, `${plural(p.fixCount, 'fix', 'fixes')} in ${plural(p.fileCount, 'file')}. Read what would change, then decide.`),
      h('button', { type: 'button', class: 'btn btn-quiet walk', onclick: () => startWalk() }, 'Walk me through this page'),
      h('p', { class: 'help legend' }, 'How to read it: lines starting with ', h('code', { text: '−' }), ' are removed, lines starting with ', h('code', { text: '+' }), ' are added, and unmarked lines are unchanged context.'),
      layoutToggle(),
      diffs(p.files),
      fx.confirm
        ? confirmPanel(p)
        : h('div', { class: 'row' }, h('button', { id: 'apply-btn', type: 'button', class: 'btn btn-primary', text: `Apply ${plural(p.fixCount, 'fix', 'fixes')}`, onclick: () => { fx.confirm = true; draw(); } }), h('p', { class: 'help', text: 'You will be asked to confirm before anything is written.' })),
    );
    // Arriving from the sample walkthrough: explain this screen once, then leave the choice to the person.
    if (state.guide === 'fixes' && !fx.coached) {
      fx.coached = true;
      setTimeout(() => alive && startWalk(), 450);
    }
  }

  function startWalk() {
    const step = (sel, title, text) => ({ target: () => body.querySelector(sel), title, body: text });
    const done = () => {
      setFlag('coach-fixes');
      state.guide = null;
    };
    startCoach(
      [
        step('.guarantee', 'Nothing has changed yet', isSnippet ? 'This is only a preview. Because this is pasted code, applying it never touches a file: you just get fixed text back.' : 'This is only a preview. If you apply it, only the files shown here are edited.'),
        step('.legend', 'How to read the change', 'Lines starting with − are removed. Lines starting with + are added. Unmarked lines are unchanged context so you can see where you are.'),
        step('.diffs', 'The before and after', 'Here the gradient is swapped for one solid color. It is a mechanical change that cannot alter what the code means, which is why it is safe to automate.'),
        step('#apply-btn', 'You decide', 'Pressing this asks you to confirm first. Go ahead and try it: the Studio will then scan again and show that the mark is gone.'),
      ],
      { doneLabel: 'Got it', onDone: done, onClose: done },
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
        h('h2', { class: 'section-title', text: 'Checked again after the fix' }),
        scoreVisual(fx.rescan.before, fx.rescan.after),
        h('p', { class: gone ? 'verdict' : 'verdict verdict-open', text: gone ? `The fixed findings are gone. ${plural(fx.rescan.after, 'finding')} left, down from ${fx.rescan.before}.` : `Some fixed findings still show up. ${plural(fx.rescan.after, 'finding')} now, ${fx.rescan.before} before.` }),
        h('ul', { class: 'rule-list' }, fx.compare.map((c) => h('li', { class: 'tally-row2' }, h('code', { text: `${c.rule} · ${c.file}` }), ` ${c.gone ? 'not reported any more' : `still ${c.after} reported`} (was ${c.before})`))),
        h('div', { class: 'row' }, fx.rescan.after > 0 ? h('a', { class: 'btn btn-quiet', href: '#/results', text: 'See what is left' }) : null, h('a', { class: 'btn btn-quiet', href: '#/scan', text: 'Scan something else' })),
      ),
    );
  }

  draw();
  return () => {
    alive = false;
    narrow.removeEventListener('change', onNarrow);
  };
}
