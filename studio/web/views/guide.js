import { h, nextId } from '../ui.js';
import { SPECIMENS, specimenById } from '../guide-content.js';

// Each builder returns [aiFace, consideredFace]: the same content twice, built the machine-made way
// and the considered way. The faces are styled by .sp-* classes in tour.css and use fixed colours on purpose,
// so a specimen looks the same in light and dark mode.
const PLATES = {
  'gradient-text': () => [[h('p', { class: 'sp-grad', text: 'Ship faster' }), h('p', { class: 'sp-sub-dark', text: 'Collaboration, simplified.' })], [h('p', { class: 'sp-solid', text: 'Ship faster' }), h('p', { class: 'sp-sub', text: 'Collaboration, simplified.' })]],
  glow: () => [
    [h('div', { class: 'sp-row' }, ['Fast', 'Secure'].map((t) => h('div', { class: 'sp-card sp-glow' }, h('b', { text: t }), h('span', { text: 'Built in' }))))],
    [h('div', { class: 'sp-row' }, ['Fast', 'Secure'].map((t) => h('div', { class: 'sp-card sp-elev' }, h('b', { text: t }), h('span', { text: 'Built in' }))))],
  ],
  glass: () => [
    [h('div', { class: 'sp-glassbg' }, h('div', { class: 'sp-glassbox' }, h('b', { text: 'Weekly report' }), h('span', { text: 'Opens 4.2k' })), h('div', { class: 'sp-glassbox' }, h('b', { text: 'New signups' }), h('span', { text: 'Up 12%' })))],
    [h('div', { class: 'sp-row' }, h('div', { class: 'sp-solidbox' }, h('b', { text: 'Weekly report' }), h('span', { text: 'Opens 4.2k' })), h('div', { class: 'sp-solidbox' }, h('b', { text: 'New signups' }), h('span', { text: 'Up 12%' })))],
  ],
  contrast: () => [
    [h('button', { type: 'button', class: 'sp-btn sp-lowc', tabindex: '-1', text: 'Get started' }), h('p', { class: 'sp-ratio sp-ratio-bad', text: 'Contrast 1.2 : 1' })],
    [h('button', { type: 'button', class: 'sp-btn sp-highc', tabindex: '-1', text: 'Get started' }), h('p', { class: 'sp-ratio', text: 'Contrast 15.3 : 1' })],
  ],
  'icon-tile': () => [
    [h('div', { class: 'sp-feature' }, h('span', { class: 'sp-tile', 'aria-hidden': 'true' }), h('b', { text: 'Lightning fast' }), h('span', { text: 'Everything loads in an instant.' }))],
    [h('div', { class: 'sp-feature sp-feature-plain' }, h('b', { text: 'Saves as you type' }), h('span', { text: 'Every change is kept on your device first.' }))],
  ],
  pill: () => [
    [h('span', { class: 'sp-pill', text: 'New: AI-powered' }), h('p', { class: 'sp-h', text: 'Plan your week' })],
    [h('p', { class: 'sp-h sp-h-ok', text: 'Plan your week in five minutes' }), h('p', { class: 'sp-sub', text: 'Drag tasks onto days. Done.' })],
  ],
  emoji: () => [
    [h('ul', { class: 'sp-list' }, ['🚀 Fast', '🔒 Secure', '⚡ Smart'].map((t) => h('li', { text: t })))],
    [h('ul', { class: 'sp-list sp-list-ok' }, ['Fast', 'Secure', 'Smart'].map((t) => h('li', { text: t })))],
  ],
  'side-tab': () => [
    [h('div', { class: 'sp-sidetab' }, h('b', { text: 'Heads up' }), h('span', { text: 'Your trial ends in 3 days.' }))],
    [h('div', { class: 'sp-note' }, h('b', { text: 'Heads up' }), h('span', { text: 'Your trial ends in 3 days.' }))],
  ],
  focus: () => [
    [h('div', { class: 'sp-row' }, h('button', { type: 'button', class: 'sp-btn sp-nofocus', text: 'Save' }), h('button', { type: 'button', class: 'sp-btn sp-nofocus', text: 'Share' }))],
    [h('div', { class: 'sp-row' }, h('button', { type: 'button', class: 'sp-btn sp-withfocus', text: 'Save' }), h('button', { type: 'button', class: 'sp-btn sp-withfocus', text: 'Share' }))],
  ],
  tiny: () => [
    [h('p', { class: 'sp-tiny', text: 'By continuing you agree to the terms and the privacy policy, which explain how we handle your data and what we may share.' })],
    [h('p', { class: 'sp-normal', text: 'By continuing you agree to the terms and the privacy policy, which explain how we handle your data.' })],
  ],
};

// Light faces for specimens whose problem needs a light background to show.
const LIGHT_AI = new Set(['contrast', 'tiny', 'focus']);

function specimenCard(sp, index) {
  const name = nextId('mode');
  const radio = (value, label) => {
    const id = nextId('m');
    return h(
      'span',
      { class: 'seg' },
      h('input', { type: 'radio', name, id, value, checked: value === 'ai', onchange: () => set(value) }),
      h('label', { for: id, text: label }),
    );
  };
  const [ai, ok] = PLATES[sp.id]();
  const plate = h(
    'div',
    sp.interactive ? { class: 'plate' } : { class: 'plate', 'aria-hidden': 'true' },
    h('div', { class: `plate-face plate-ai${LIGHT_AI.has(sp.id) ? ' is-light' : ''}` }, ai),
    h('div', { class: 'plate-face plate-ok' }, ok),
  );
  const card = h(
    'article',
    { class: 'specimen', id: `sp-${sp.id}`, 'data-mode': 'ai', 'aria-labelledby': `sp-h-${sp.id}` },
    h('header', { class: 'specimen-head' }, h('span', { class: 'specimen-n', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }), h('h2', { class: 'specimen-title', id: `sp-h-${sp.id}`, text: sp.title })),
    plate,
    h('fieldset', { class: 'specimen-flip' }, h('legend', { class: 'sr-only', text: `Show ${sp.title} as` }), h('div', { class: 'segs' }, radio('ai', 'AI-made'), radio('ok', 'Considered'))),
    h('div', { class: 'specimen-text' }, h('h3', { class: 'specimen-k', text: 'Why it gives itself away' }), h('p', { text: sp.tell }), h('h3', { class: 'specimen-k', text: 'Instead' }), h('p', { text: sp.instead })),
    h('p', { class: 'meta specimen-rules' }, 'Caught by ', sp.rules.map((r, i) => [i ? ', ' : null, h('code', { text: r })]), sp.fixable ? h('span', { class: 'tag specimen-fix', text: 'Can be fixed automatically' }) : null),
  );
  function set(v) {
    card.dataset.mode = v;
    for (const r of card.querySelectorAll('input[type=radio]')) r.checked = r.value === v;
  }
  card.setMode = set;
  return card;
}

export function renderGuide(main, ctx) {
  const cards = SPECIMENS.map(specimenCard);
  const flipAll = (mode) => cards.forEach((c) => c.setMode(mode));
  const globalName = nextId('all');
  const gradio = (value, label, checked) => {
    const id = nextId('g');
    return h('span', { class: 'seg' }, h('input', { type: 'radio', name: globalName, id, value, checked, onchange: () => flipAll(value) }), h('label', { for: id, text: label }));
  };

  main.append(
    h(
      'div',
      { class: 'screen guide' },
      h('h1', { text: 'Field guide: spot the AI-made look' }),
      h('p', { class: 'lede', text: 'Each plate below shows one well-known mark, first the way it usually appears and then a more considered version. Flip any plate, or flip them all.' }),
      h('div', { class: 'guide-bar' }, h('fieldset', { class: 'fs' }, h('legend', { class: 'label', text: 'Show every plate as' }), h('div', { class: 'segs' }, gradio('ai', 'AI-made', true), gradio('ok', 'Considered', false))), h('p', { class: 'meta', text: 'The detector looks for every one of these in your code, and the rule names under each plate are the ones it uses.' })),
      h('div', { class: 'specimens' }, cards),
      h('p', { class: 'help' }, 'Want the full story? ', h('a', { href: '#/welcome', text: 'Take the tour' }), ' or ', h('a', { href: '#/scan', text: 'scan your own code' }), '.'),
    ),
  );

  // Deep link, e.g. #/guide/gradient-text from a finding. Runs after the router has scrolled to the top.
  const wanted = /^#\/guide\/([\w-]+)/.exec(location.hash)?.[1];
  const target = wanted && specimenById(wanted) ? main.querySelector(`#sp-${wanted}`) : null;
  if (target) {
    setTimeout(() => {
      target.scrollIntoView({ block: 'center' });
      target.classList.add('is-linked');
      target.querySelector('h2')?.setAttribute('tabindex', '-1');
      target.querySelector('h2')?.focus({ preventScroll: true });
    }, 30);
  }
}
