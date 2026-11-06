// Illustrations for the tour and the screens. Each function returns an <svg> built from plain shapes.
//
// How the animation works: every element that should "happen" gets a class such as `a-fade` or `a-draw`
// and a start delay (`vars: { d: '1.2s' }`). The CSS animates FROM a hidden state TO the element's normal
// style, so with reduced motion on (or CSS animation off) you simply see the finished picture.
// Colours come from CSS classes (see tour.css), so the pictures follow light and dark mode.

import { s } from './ui.js';

const W = 640;
const H = 400;

function scene(label, ...kids) {
  return s('svg', { class: 'scene', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, focusable: 'false' }, ...kids);
}

/** Add an animation class plus delay/duration to a props object. */
function an(kind, delay = 0, props = {}, dur) {
  const vars = { d: `${delay}s`, ...(dur ? { t: `${dur}s` } : {}), ...(props.vars || {}) };
  return { ...props, class: `${props.class ? props.class + ' ' : ''}a-${kind}`, vars };
}

/** A hand-drawn-ish proofreader's circle: a slightly open, slightly wobbly ellipse that draws itself on. */
function pen(cx, cy, rx, ry, delay, id) {
  const k = 0.552;
  // Start on the right, go round once, overshoot a little. The wobble is deterministic.
  const d =
    `M ${cx + rx} ${cy - 2} ` +
    `C ${cx + rx + 2} ${cy + ry * k} ${cx + rx * k} ${cy + ry + 3} ${cx} ${cy + ry} ` +
    `C ${cx - rx * k} ${cy + ry - 2} ${cx - rx - 3} ${cy + ry * k} ${cx - rx} ${cy} ` +
    `C ${cx - rx + 2} ${cy - ry * k} ${cx - rx * k} ${cy - ry - 2} ${cx} ${cy - ry} ` +
    `C ${cx + rx * k} ${cy - ry + 1} ${cx + rx + 4} ${cy - ry * k + 4} ${cx + rx - 6} ${cy - 10}`;
  return s('path', an('draw', delay, { d, pathLength: 1, class: 'pen', id }, 0.7));
}

function badge(x, y, n, delay, id) {
  // The outer group holds the position; only the inner group is animated, because a CSS transform
  // would replace the position attribute.
  return s(
    'g',
    { transform: `translate(${x} ${y})`, id },
    s('g', an('pop', delay, { class: 'badge' }), s('circle', { r: 13, class: 'f-red' }), s('text', { class: 'f-onred t-serif badge-n', 'text-anchor': 'middle', y: 5, text: String(n) })),
  );
}

function leader(x1, y1, x2, y2, delay) {
  return s('path', an('draw', delay, { d: `M ${x1} ${y1} L ${x2} ${y2}`, pathLength: 1, class: 'leader' }, 0.5));
}

function txt(x, y, text, cls = '', extra = {}) {
  return s('text', { x, y, class: cls, text, ...extra });
}

/** The generic "AI landing page", drawn as a specimen on its own dark panel. */
function specimenPage(x, y, w, h, delay) {
  const cx = x + w / 2;
  const g = (id, a, b) =>
    s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': a }), s('stop', { offset: 1, 'stop-color': b }));
  const cards = [0, 1, 2].map((i) => {
    const cxx = x + 22 + i * 124;
    return s(
      'g',
      an('fade', delay + 0.7 + i * 0.12),
      s('rect', { x: cxx, y: y + 218, width: 112, height: 92, rx: 14, fill: '#6366f1', opacity: 0.55, filter: 'url(#glow)' }),
      s('rect', { x: cxx, y: y + 218, width: 112, height: 92, rx: 14, fill: '#161a35', stroke: 'rgba(255,255,255,0.18)' }),
      s('rect', { x: cxx + 14, y: y + 232, width: 26, height: 26, rx: 8, fill: 'url(#gradSpec)' }),
      s('rect', { x: cxx + 14, y: y + 272, width: 70, height: 7, rx: 3.5, fill: 'rgba(255,255,255,0.55)' }),
      s('rect', { x: cxx + 14, y: y + 286, width: 50, height: 6, rx: 3, fill: 'rgba(255,255,255,0.28)' }),
    );
  });
  return s(
    'g',
    {},
    s('defs', {}, g('gradSpec', '#6366f1', '#ec4899'), s('filter', { id: 'glow', x: '-40%', y: '-40%', width: '180%', height: '180%' }, s('feGaussianBlur', { stdDeviation: 9 }))),
    s('rect', an('fade', delay, { x, y, width: w, height: h, rx: 6, fill: '#0e1127', stroke: 'var(--ink)', 'stroke-width': 1.5 })),
    s(
      'g',
      an('fade', delay + 0.2),
      s('rect', { x: cx - 74, y: y + 24, width: 148, height: 24, rx: 12, fill: 'rgba(255,255,255,0.07)', stroke: 'rgba(255,255,255,0.22)' }),
      txt(cx, y + 40.5, 'New: AI-powered', 'spec-chip', { 'text-anchor': 'middle' }),
    ),
    s(
      'g',
      an('fade', delay + 0.35),
      txt(cx, y + 92, 'Unleash the power', 'spec-h1', { 'text-anchor': 'middle', fill: 'url(#gradSpec)' }),
      txt(cx, y + 130, 'of seamless flow', 'spec-h1', { 'text-anchor': 'middle', fill: 'url(#gradSpec)' }),
    ),
    s(
      'g',
      an('fade', delay + 0.5),
      s('rect', { x: cx - 100, y: y + 150, width: 200, height: 7, rx: 3.5, fill: 'rgba(255,255,255,0.35)' }),
      s('rect', { x: cx - 70, y: y + 166, width: 140, height: 7, rx: 3.5, fill: 'rgba(255,255,255,0.22)' }),
      s('rect', { x: cx - 52, y: y + 184, width: 104, height: 24, rx: 12, fill: 'url(#gradSpec)' }),
    ),
    cards,
  );
}

/* 1. The problem: a generic page, then a proofreader marks it up. */
export function sceneProblem() {
  const px = 22;
  const py = 24;
  const pw = 388;
  const ph = 352;
  const notes = [
    { n: 1, label: 'headline pill', y: 70 },
    { n: 2, label: 'gradient text', y: 128 },
    { n: 3, label: 'icon tile', y: 252 },
    { n: 4, label: 'glowing cards', y: 300 },
  ];
  return scene(
    'A generic landing page with four tell-tale marks circled in red pen: a pill above the headline, gradient text, an icon tile, and glowing cards.',
    specimenPage(px, py, pw, ph, 0),
    pen(216, 70, 82, 19, 1.8, 'mk-1'),
    pen(216, 120, 150, 50, 2.5, 'mk-2'),
    pen(77, 274, 24, 24, 3.2, 'mk-3'),
    pen(216, 292, 192, 62, 3.9, 'mk-4'),
    leader(300, 70, 452, 70, 2.1),
    leader(364, 112, 452, 128, 2.8),
    leader(100, 266, 452, 252, 3.5),
    leader(408, 296, 452, 300, 4.2),
    ...notes.map((nt, i) => s('g', {}, badge(468, nt.y, nt.n, 2.2 + i * 0.7, `note-${nt.n}`), s('text', an('fade', 2.4 + i * 0.7, { x: 490, y: nt.y + 5, class: 't-note' }), nt.label))),
  );
}

/* 2. The proofreader: the detector reads top to bottom and notes what matches. */
export function sceneProofreader(ruleCount) {
  const lineY = (i) => 62 + i * 25;
  const flagged = new Map([
    [2, { text: 'background-clip: text;', rule: 'Gradient text', row: 0 }],
    [5, { text: 'box-shadow: 0 0 40px #6366f1;', rule: 'Glowing shadow', row: 1 }],
    [8, { text: 'color: #999; background: #aaa;', rule: 'Low contrast', row: 2 }],
  ]);
  const t0 = 0.9;
  const dur = 3.6;
  const at = (y) => t0 + ((y - 50) / 300) * dur;
  const widths = [90, 150, 0, 120, 70, 0, 110, 170, 0, 100, 60];
  const lines = [];
  for (let i = 0; i < 11; i++) {
    const y = lineY(i);
    const f = flagged.get(i);
    lines.push(
      txt(50, y + 4, String(i + 1), 't-mono t-soft t-ln', { 'text-anchor': 'end' }),
      f ? txt(62, y + 4, f.text, 't-mono t-code') : s('rect', { x: 62, y: y - 3, width: widths[i], height: 8, rx: 4, class: 'f-rule' }),
    );
    if (f) {
      lines.push(s('path', an('draw', at(y) + 0.15, { d: `M 60 ${y + 9} Q 120 ${y + 13} 250 ${y + 8}`, pathLength: 1, class: 'pen pen-thin' }, 0.4)));
    }
  }
  const rows = ['Gradient text', 'Glowing shadow', 'Low contrast', 'Gray on color', 'Tiny text'].map((name, i) => {
    const y = 78 + i * 46;
    const hit = [...flagged.values()].find((f) => f.row === i);
    const lineIdx = hit ? [...flagged.entries()].find(([, f]) => f === hit)[0] : null;
    const when = hit ? at(lineY(lineIdx)) + 0.25 : 0;
    return s(
      'g',
      {},
      s('rect', { x: 378, y: y - 18, width: 236, height: 36, rx: 3, class: hit ? 'row-hit' : 'row' }),
      s('circle', { cx: 400, cy: y, r: 6, class: hit ? 'f-red' : 'row-dot' }),
      hit ? s('circle', an('ping', when, { cx: 400, cy: y, r: 6, class: 'ping-ring' }, 0.9)) : null,
      txt(418, y + 5, name, hit ? 't-serif t-row t-bold' : 't-serif t-row t-soft'),
      hit ? s('path', an('draw', when - 0.05, { d: `M 330 ${lineY(lineIdx)} C 352 ${lineY(lineIdx)} 352 ${y} 378 ${y}`, pathLength: 1, class: 'leader' }, 0.5)) : null,
    );
  });
  return scene(
    'A page of code. A red band reads it from top to bottom. Whenever a line matches a known mark, the line is underlined and the matching rule on the right lights up.',
    s('rect', { x: 30, y: 30, width: 300, height: 340, rx: 4, class: 'f-paper s-ink' }),
    ...lines,
    s('g', an('sweep', t0, { class: 'sweep' }, dur), s('rect', { x: 31, y: 50, width: 298, height: 24, class: 'sweep-band' }), s('rect', { x: 31, y: 50, width: 298, height: 2, class: 'f-red' })),
    txt(378, 50, 'KNOWN MARKS', 't-label'),
    ...rows,
    txt(378, 328, ruleCount ? `…and ${Math.max(ruleCount - 5, 0)} more` : '…and many more', 't-serif t-soft t-row t-italic'),
    txt(378, 352, 'checked on every line', 't-serif t-soft t-small t-italic'),
  );
}

function fileIcon(x, y, delay, label, hits) {
  return s(
    'g',
    an('fade', delay, { class: 'file' }),
    s('path', { d: `M ${x} ${y} h 17 l 7 7 v 22 h -24 z`, class: 'f-paper s-ink' }),
    s('path', { d: `M ${x + 17} ${y} v 7 h 7`, class: 's-ink f-none' }),
    txt(x + 38, y + 21, label, 't-mono t-file'),
    hits === null ? null : s('g', { transform: `translate(${x + 214} ${y + 14})` }, s('g', an('pop', delay + 0.55, { class: 'count' }), s('circle', { r: 12, class: hits ? 'f-red' : 'f-deep s-rule' }), s('text', { class: hits ? 'f-onred t-serif badge-n' : 't-serif badge-n f-ink', 'text-anchor': 'middle', y: 5, text: hits ? String(hits) : '0' }))),
  );
}

/* 3. Scan: the detector opens each file in turn. Reads only. */
export function sceneScan() {
  const files = [
    { label: 'index.html', hits: 2 },
    { label: 'styles.css', hits: 1 },
    { label: 'App.jsx', hits: 1 },
    { label: 'logo.svg', hits: 0 },
  ];
  const y0 = 106;
  const step = 50;
  const lens = files.map((f, i) => s('rect', an('flash', 0.8 + i * 0.7, { x: 42, y: y0 + i * step - 8, width: 246, height: 44, rx: 3, class: 'lens' }, 0.8)));
  const pills = ['Gradient text', 'Glowing shadow', 'Low contrast', 'Tiny text'].map((t, i) => {
    const y = 84 + i * 42;
    return s('g', an('pop', 3.1 + i * 0.35, { class: 'pill-row' }), s('rect', { x: 372, y, width: 236, height: 32, rx: 3, class: 'row-hit' }), s('circle', { cx: 392, cy: y + 16, r: 6, class: 'f-red' }), txt(408, y + 21, t, 't-serif t-row'));
  });
  return scene(
    'A project folder. The detector looks at each file in turn and puts the number of findings next to it. A crossed-out pencil shows it never writes.',
    s('rect', { x: 28, y: 28, width: 272, height: 262, rx: 4, class: 'f-paper s-ink' }),
    s('g', an('fade', 0.1), s('path', { d: 'M 46 52 h 14 l 4 5 h 18 v 22 h -36 z', class: 'f-deep s-ink' }), txt(94, 72, 'my-project/', 't-serif t-bold t-row')),
    ...lens,
    ...files.map((f, i) => fileIcon(56, y0 + i * step, 0.4 + i * 0.12, f.label, f.hits)),
    s('path', an('draw', 3, { d: 'M 306 160 H 352', pathLength: 1, class: 'leader' }, 0.5)),
    s('path', an('fade', 3.3, { d: 'M 346 152 L 358 160 L 346 168', class: 's-red f-none arrow-head' })),
    s('rect', { x: 358, y: 28, width: 262, height: 262, rx: 4, class: 'f-paper s-ink' }),
    txt(372, 62, 'FINDINGS · 4', 't-label'),
    ...pills,
    s(
      'g',
      an('fade', 4.3),
      s('path', { d: 'M 28 332 h 592', class: 's-rule' }),
      // eye
      s('path', { d: 'M 58 358 Q 80 338 102 358 Q 80 378 58 358 Z', class: 's-ink f-none sw2' }),
      s('circle', { cx: 80, cy: 358, r: 6.5, class: 'f-ink' }),
      txt(116, 364, 'Reads every file', 't-serif t-lg'),
      // pencil, struck
      s('g', { transform: 'translate(386 358) rotate(-40)' }, s('rect', { x: -26, y: -6, width: 44, height: 12, class: 'f-deep s-ink' }), s('path', { d: 'M 18 -6 L 30 0 L 18 6 Z', class: 'f-ink' })),
      s('path', an('draw', 4.6, { d: 'M 360 380 L 414 336', pathLength: 1, class: 'pen sw3' }, 0.35)),
      txt(432, 364, 'Never writes', 't-serif t-lg'),
    ),
  );
}

/* 4. Findings: the anatomy of one finding, numbered. */
export function sceneFindings() {
  const markers = [
    { n: 1, y: 66, label: 'name, level' },
    { n: 2, y: 100, label: 'where' },
    { n: 3, y: 140, label: 'why' },
    { n: 4, y: 180, label: 'what matched' },
    { n: 5, y: 250, label: 'the code' },
    { n: 6, y: 331, label: 'fix?' },
  ];
  const code = [
    [3, '  font-size: 3rem;', false],
    [4, '  background: linear-gradient(90deg,', true],
    [5, '  background-clip: text;', false],
  ];
  return scene(
    'One finding card with six numbered parts: its name and severity, where it is, why it matters, what matched, the code with the flagged line shaded, and a tag saying it can be fixed automatically.',
    s(
      'g',
      an('fade', 0),
      s('rect', { x: 28, y: 28, width: 440, height: 346, rx: 3, class: 'f-paper s-ink sw15' }),
      txt(50, 72, 'Gradient text', 't-serif t-title'),
      s('rect', { x: 340, y: 50, width: 104, height: 26, rx: 2, class: 'f-none s-red' }),
      txt(392, 68, 'WARNING', 't-serif t-sev', { 'text-anchor': 'middle' }),
      txt(50, 104, 'styles.css:4 · gradient-text · Looks AI-made', 't-mono t-soft t-small'),
      txt(50, 134, 'Decorative rather than meaningful, and a common', 't-serif t-body'),
      txt(50, 154, 'mark of AI-made design. Use a solid color.', 't-serif t-body'),
      s('text', { x: 50, y: 184, class: 't-serif t-soft t-small' }, 'What matched: ', s('tspan', { class: 't-mono' }, 'background-clip: text + gradient')),
      s('rect', { x: 50, y: 198, width: 396, height: 104, rx: 2, class: 'f-deep s-rule' }),
      ...code.flatMap(([n, t, hit], i) => {
        const y = 224 + i * 30;
        return [hit ? s('rect', { x: 51, y: y - 17, width: 394, height: 26, class: 'hit-wash' }) : null, hit ? s('rect', { x: 51, y: y - 17, width: 3, height: 26, class: 'f-red' }) : null, txt(68, y, String(n), 't-mono t-soft t-small'), txt(92, y, t, 't-mono t-code2')];
      }),
      s('rect', { x: 50, y: 316, width: 222, height: 26, rx: 2, class: 'f-none s-soft tag-dash' }),
      txt(62, 334, 'Can be fixed automatically', 't-serif t-small t-bold'),
    ),
    ...markers.flatMap((m, i) => [leader(468, m.y, 506, m.y, 0.8 + i * 0.55), badge(522, m.y, m.n, 0.9 + i * 0.55, `an-${m.n}`), s('text', an('fade', 1 + i * 0.55, { x: 544, y: m.y + 5, class: 't-note t-note-sm' }), m.label)]),
    s('path', an('draw', 1.1, { d: 'M 340 82 L 444 82', pathLength: 1, class: 'pen pen-thin' }, 0.4)),
  );
}

/* 5. Fixes: preview the diff, confirm, check again. */
export function sceneFixes() {
  const rows = [
    ['ctx', '  font-size: 3rem;'],
    ['del', '  background: linear-gradient(90deg, #6366f1, #ec4899);'],
    ['del', '  -webkit-background-clip: text;'],
    ['del', '  background-clip: text;'],
    ['del', '  -webkit-text-fill-color: transparent;'],
    ['add', '  color: #6366f1;'],
  ];
  const diff = rows.map(([t, text], i) => {
    const y = 56 + i * 24;
    const mark = t === 'del' ? '−' : t === 'add' ? '+' : ' ';
    const g = s(
      'g',
      t === 'ctx' ? an('fade', 0.3) : t === 'del' ? an('strike', 1.4 + i * 0.12, { class: 'diff-del' }) : an('slide', 2.6, { class: 'diff-add' }),
      t !== 'ctx' ? s('rect', { x: 30, y: y - 16, width: 580, height: 22, class: t === 'del' ? 'row-del' : 'row-add' }) : null,
      txt(44, y, mark, 't-mono t-code2 t-bold'),
      txt(64, y, text, 't-mono t-code2'),
    );
    return g;
  });
  const steps = ['Preview', 'You confirm', 'Written + logged', 'Scanned again'];
  const flow = steps.map((t, i) => {
    const x = 30 + i * 150;
    return s(
      'g',
      an('lit', 3.4 + i * 0.7, { class: 'flow' }),
      s('rect', { x, y: 214, width: 136, height: 36, rx: 18, class: 'flow-pill' }),
      txt(x + 68, 237, t, 't-serif t-small t-bold', { 'text-anchor': 'middle' }),
      i < steps.length - 1 ? s('path', { d: `M ${x + 140} 232 h 6`, class: 's-ink f-none' }) : null,
    );
  });
  return scene(
    'A code change shown as a preview. Four lines are struck out and one line is added. Below it, four steps light up in order: preview, you confirm, written and logged, scanned again.',
    s('rect', { x: 30, y: 24, width: 580, height: 166, rx: 3, class: 'f-paper s-ink' }),
    ...diff,
    ...flow,
    // before / after
    s(
      'g',
      an('fade', 5.8),
      s('rect', { x: 30, y: 276, width: 270, height: 100, rx: 3, fill: '#0e1127', stroke: 'var(--ink)' }),
      txt(44, 296, 'BEFORE', 't-label t-label-dark'),
      txt(165, 346, 'Seamless flow', 'spec-h2', { 'text-anchor': 'middle', fill: 'url(#gradFix)' }),
      s('defs', {}, s('linearGradient', { id: 'gradFix', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': '#6366f1' }), s('stop', { offset: 1, 'stop-color': '#ec4899' }))),
      s('path', { d: 'M 312 326 h 16 M 322 318 l 8 8 l -8 8', class: 's-ink f-none sw2' }),
      s('rect', { x: 340, y: 276, width: 270, height: 100, rx: 3, class: 'f-paper s-ink' }),
      txt(354, 296, 'AFTER', 't-label'),
      txt(475, 346, 'Seamless flow', 'spec-h2 f-indigo', { 'text-anchor': 'middle' }),
    ),
  );
}

/* 6. Safe by design: the boundary of this computer. */
export function sceneSafe() {
  return scene(
    'Your computer, drawn as a boundary. Inside it, the Studio reads and changes only your project folder. A line toward the internet is stopped at the boundary with a red cross.',
    s('rect', { x: 28, y: 28, width: 384, height: 300, rx: 12, class: 'f-none s-ink boundary' }),
    txt(46, 56, 'THIS COMPUTER', 't-label'),
    // folder
    s(
      'g',
      an('fade', 0.3),
      s('path', { d: 'M 64 150 h 34 l 8 10 h 52 v 80 h -94 z', class: 'f-deep s-ink' }),
      txt(111, 266, 'your project', 't-serif t-row', { 'text-anchor': 'middle' }),
    ),
    // studio window
    s(
      'g',
      an('fade', 0.6),
      s('rect', { x: 250, y: 130, width: 140, height: 120, rx: 4, class: 'f-paper s-ink' }),
      s('path', { d: 'M 250 156 h 140', class: 's-ink' }),
      s('rect', { x: 264, y: 172, width: 70, height: 7, rx: 3.5, class: 'f-rule' }),
      s('rect', { x: 264, y: 188, width: 100, height: 7, rx: 3.5, class: 'f-rule' }),
      s('rect', { x: 264, y: 204, width: 50, height: 7, rx: 3.5, class: 'f-red' }),
      txt(320, 276, 'the Studio', 't-serif t-row', { 'text-anchor': 'middle' }),
    ),
    // packets travelling folder <-> studio
    s('path', { d: 'M 168 190 H 246', class: 's-ink f-none dash' }),
    s('circle', an('packet', 1, { r: 5, cx: 168, cy: 190, class: 'f-red' }, 2.4)),
    s('circle', an('packet', 2.2, { r: 5, cx: 168, cy: 190, class: 'f-ink' }, 2.4)),
    // the blocked path
    s('path', { d: 'M 390 170 H 470', class: 's-soft f-none dash' }),
    s('circle', an('blocked', 1.4, { r: 5, cx: 392, cy: 170, class: 'f-ink' }, 3)),
    s('g', { transform: 'translate(414 170)' }, s('g', an('cross', 1.4, {}, 3), s('path', { d: 'M -9 -9 L 9 9 M 9 -9 L -9 9', class: 's-red f-none sw3' }))),
    // cloud
    s(
      'g',
      an('fade', 0.9),
      s('path', { d: 'M 500 190 q -22 0 -22 -20 q 0 -20 24 -18 q 6 -24 36 -20 q 24 4 26 26 q 22 2 22 18 q 0 14 -20 14 z', class: 'f-deep s-soft' }),
      txt(540, 225, 'the internet', 't-serif t-row t-soft', { 'text-anchor': 'middle' }),
      txt(540, 247, 'nothing goes here', 't-serif t-small t-red t-italic', { 'text-anchor': 'middle' }),
    ),
    // guarantees
    ...[
      ['Only your chosen folder', 76],
      ['Reads before it writes', 296],
      ['You confirm every write', 480],
    ].map(([t, x], i) => s('g', an('fade', 2 + i * 0.4), s('circle', { cx: x - 22 + (i === 0 ? 0 : 0), cy: 366, r: 9, class: 'f-ink' }), s('path', { d: `M ${x - 26} 366 l 3 4 l 7 -8`, class: 's-paper f-none sw2' }), txt(x - 6, 372, t, 't-serif t-small'))),
  );
}

export const SCENES = {
  problem: sceneProblem,
  proofreader: sceneProofreader,
  scan: sceneScan,
  findings: sceneFindings,
  fixes: sceneFixes,
  safe: sceneSafe,
};

/* Small icons for the three-step strip on the Scan screen. 64 x 64, animate on hover. */
function icon(label, ...kids) {
  return s('svg', { class: 'mini', viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' }, ...kids);
}

export function miniScan() {
  return icon(
    'scan',
    s('rect', { x: 10, y: 8, width: 44, height: 48, rx: 3, class: 'f-paper s-ink sw2' }),
    s('rect', { x: 17, y: 18, width: 22, height: 4, rx: 2, class: 'f-rule' }),
    s('rect', { x: 17, y: 28, width: 30, height: 4, rx: 2, class: 'f-rule' }),
    s('rect', { x: 17, y: 38, width: 18, height: 4, rx: 2, class: 'f-rule' }),
    s('rect', { x: 10, y: 14, width: 44, height: 8, class: 'mini-sweep' }),
  );
}

export function miniFindings() {
  return icon(
    'findings',
    s('rect', { x: 10, y: 8, width: 44, height: 48, rx: 3, class: 'f-paper s-ink sw2' }),
    s('circle', { cx: 20, cy: 20, r: 4, class: 'f-red' }),
    s('rect', { x: 28, y: 18, width: 20, height: 4, rx: 2, class: 'f-rule' }),
    s('circle', { cx: 20, cy: 34, r: 4, class: 'f-red mini-pop' }),
    s('rect', { x: 28, y: 32, width: 16, height: 4, rx: 2, class: 'f-rule' }),
    s('circle', { cx: 20, cy: 48, r: 4, class: 'f-soft' }),
    s('rect', { x: 28, y: 46, width: 20, height: 4, rx: 2, class: 'f-rule' }),
  );
}

export function miniFixes() {
  return icon(
    'fixes',
    s('rect', { x: 8, y: 10, width: 48, height: 44, rx: 3, class: 'f-paper s-ink sw2' }),
    s('rect', { x: 12, y: 18, width: 40, height: 9, class: 'row-del' }),
    s('rect', { x: 17, y: 21, width: 26, height: 3, rx: 1.5, class: 'f-soft mini-strike' }),
    s('rect', { x: 12, y: 33, width: 40, height: 9, class: 'row-add' }),
    s('rect', { x: 17, y: 36, width: 16, height: 3, rx: 1.5, class: 'f-ink' }),
    s('path', { d: 'M 40 49 l 4 4 l 8 -9', class: 's-red f-none sw3 mini-check' }),
  );
}

export const MINI = { scan: miniScan, results: miniFindings, fixes: miniFixes };

/** A tick that draws itself, for "all done" moments. */
export function checkMark() {
  return s('svg', { class: 'check', viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false' }, s('circle', an('draw', 0, { cx: 24, cy: 24, r: 20, pathLength: 1, class: 's-ink f-none sw2' }, 0.6)), s('path', an('draw', 0.5, { d: 'M 14 25 l 7 7 l 14 -16', pathLength: 1, class: 's-red f-none sw3' }, 0.5)));
}

/** Severity glyphs: shape as well as colour, so the difference survives colour blindness. */
export function sevGlyph(sev) {
  const common = { class: 'glyph', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' };
  if (sev === 'error') return s('svg', common, s('circle', { cx: 8, cy: 8, r: 7, class: 'f-currentc' }), s('path', { d: 'M 5 5 L 11 11 M 11 5 L 5 11', class: 's-paperc f-none sw2' }));
  if (sev === 'warning') return s('svg', common, s('path', { d: 'M 8 1.5 L 15 14 H 1 Z', class: 'f-none s-currentc sw2' }), s('path', { d: 'M 8 6 V 10 M 8 12 V 12.2', class: 's-currentc f-none sw2' }));
  return s('svg', common, s('circle', { cx: 8, cy: 8, r: 6.2, class: 'f-none s-currentc sw2' }), s('path', { d: 'M 8 7 V 11.5 M 8 4.6 V 4.8', class: 's-currentc f-none sw2' }));
}
