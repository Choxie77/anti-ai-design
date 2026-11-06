import { h, clear } from '../ui.js';
import { CHAPTERS, chapterFromHash, clampChapter } from '../tour-content.js';
import { SCENES, sevGlyph } from '../art.js';
import { setFlag } from '../onboarding.js';

const RAIL_LABELS = ['Problem', 'Proofreader', 'Scan', 'Findings', 'Fixes', 'Safety'];

export function renderTour(main, ctx) {
  const { state, announce, go } = ctx;
  let index = chapterFromHash(location.hash);
  let alive = true;

  const rail = h('ol', { class: 'tour-rail' });
  const stage = h('div', { class: 'tour-stage' });
  const controls = h('div', { class: 'tour-controls' });

  main.append(
    h(
      'div',
      { class: 'screen tour' },
      h('p', { class: 'tour-eyebrow' }, 'A short tour · about two minutes'),
      h('nav', { class: 'tour-railwrap', 'aria-label': 'Tour chapters' }, rail),
      stage,
      controls,
    ),
  );

  function finish(next) {
    setFlag('tour');
    if (next) next();
  }

  function drawRail() {
    clear(rail);
    CHAPTERS.forEach((c, i) => {
      const done = i < index;
      rail.append(
        h(
          'li',
          { class: `rail-item${i === index ? ' is-current' : ''}${done ? ' is-done' : ''}` },
          h('button', { type: 'button', class: 'rail-btn', 'aria-current': i === index ? 'step' : false, onclick: () => show(i) }, h('span', { class: 'rail-dot', 'aria-hidden': 'true', text: String(i + 1) }), h('span', { class: 'rail-label', text: RAIL_LABELS[i] || c.kicker })),
        ),
      );
    });
  }

  function legend(c, svgHolder) {
    if (!c.legend) return null;
    const list = h('ol', { class: 'legend-list' });
    const hot = (n, on) => {
      const root = svgHolder.querySelector('svg');
      if (!root) return;
      for (const id of [`note-${n}`, `mk-${n}`, `an-${n}`]) root.querySelector(`[id="${id}"]`)?.classList.toggle('is-hot', on);
    };
    c.legend.forEach(([t, d], i) => {
      const n = i + 1;
      list.append(
        h(
          'li',
          { class: 'legend-item' },
          h('button', { type: 'button', class: 'legend-btn', onmouseenter: () => hot(n, true), onmouseleave: () => hot(n, false), onfocus: () => hot(n, true), onblur: () => hot(n, false) }, h('span', { class: 'legend-n', 'aria-hidden': 'true', text: String(n) }), h('span', { class: 'legend-t', text: t })),
          h('p', { class: 'legend-d', text: d }),
        ),
      );
    });
    return h('section', { class: 'legend', 'aria-label': c.legendTitle }, h('h2', { class: 'legend-title', text: c.legendTitle }), list);
  }

  function terms(c) {
    if (!c.terms) return null;
    return h('dl', { class: 'terms' }, c.terms.flatMap(([t, d]) => [h('dt', { text: t }), h('dd', { text: d })]));
  }

  function severity(c) {
    if (!c.severity) return null;
    return h(
      'ul',
      { class: 'sev-key', 'aria-label': 'Severity levels' },
      c.severity.map(([k, label, d]) => h('li', { class: `sev-key-item sev-key-${k}` }, sevGlyph(k), h('span', {}, h('strong', { text: label }), ' ', d))),
    );
  }

  function art(c) {
    const holder = h('figure', { class: 'tour-art' });
    const build = () => {
      const svg = SCENES[c.scene](state.ruleCount);
      const old = holder.querySelector('svg');
      if (old) old.replaceWith(svg);
      else holder.prepend(svg);
    };
    build();
    holder.append(h('figcaption', {}, h('button', { type: 'button', class: 'linkish replay', onclick: build }, '↺ Replay the animation')));
    return holder;
  }

  function show(i, { focusHeading = false } = {}) {
    index = clampChapter(i);
    const c = CHAPTERS[index];
    history.replaceState(null, '', `#/welcome/${index + 1}`);
    document.title = `${c.kicker}: ${c.title} · Anti-AI Design Studio`;
    drawRail();
    const holder = art(c);
    // Head and extras are separate blocks so that on a phone the picture sits between them, right after the
    // headline, instead of below the whole key.
    clear(stage).append(
      h(
        'div',
        { class: 'tour-head' },
        h('p', { class: 'tour-kicker' }, h('span', { class: 'tour-count', text: `${index + 1} / ${CHAPTERS.length}` }), ' ', c.kicker),
        h('h1', { class: 'tour-title', id: 'tour-h', text: c.title, tabindex: '-1' }),
        c.body.map((p) => h('p', { class: 'tour-p', text: p })),
      ),
      holder,
      h(
        'div',
        { class: 'tour-extra' },
        terms(c),
        legend(c, holder),
        severity(c),
        c.tip ? h('p', { class: 'tour-tip' }, h('span', { class: 'tour-tip-k', text: 'Tip' }), ' ', c.tip) : null,
        c.final ? finalActions() : null,
      ),
    );
    drawControls();
    announce(`Chapter ${index + 1} of ${CHAPTERS.length}: ${c.title}`);
    if (focusHeading) document.getElementById('tour-h')?.focus();
    if (c.final) setFlag('tour');
  }

  function finalActions() {
    return h(
      'div',
      { class: 'tour-cta' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => finish(() => ctx.runSample()) }, 'Try it on a sample'),
      h('button', { type: 'button', class: 'btn', onclick: () => finish(() => go('scan')) }, 'Scan my own project'),
      h('p', { class: 'help', text: 'The sample is a few lines of real code with real problems in it. You will see a scan, its findings, and a fix, with a short walkthrough on each screen.' }),
    );
  }

  function drawControls() {
    const first = index === 0;
    const last = index === CHAPTERS.length - 1;
    clear(controls).append(
      h('button', { type: 'button', class: 'btn btn-quiet', disabled: first, onclick: () => show(index - 1) }, '← Back'),
      ...(last ? [] : [h('button', { type: 'button', class: 'btn btn-primary', id: 'tour-next', onclick: () => show(index + 1) }, index === 0 ? 'Show me →' : 'Next →')]),
      h('span', { class: 'tour-spacer' }),
      h('button', { type: 'button', class: 'linkish', onclick: () => finish(() => go('scan')) }, last ? 'Close tour' : 'Skip tour'),
    );
  }

  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' && index < CHAPTERS.length - 1) show(index + 1);
    else if (e.key === 'ArrowLeft' && index > 0) show(index - 1);
  }
  document.addEventListener('keydown', onKey);

  // The proofreader picture mentions how many rules exist; redraw it if the count arrives late.
  if (state.ruleCount == null) {
    ctx.engine
      .listRules()
      .then(({ rules }) => {
        state.ruleCount = rules.length;
        if (alive && CHAPTERS[index].scene === 'proofreader') stage.querySelector('.replay')?.click();
      })
      .catch(() => {});
  }

  show(index);
  return () => {
    alive = false;
    document.removeEventListener('keydown', onKey);
  };
}
