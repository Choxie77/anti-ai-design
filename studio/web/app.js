import { createEngine } from './engine.js';
import { h, clear, plural } from './ui.js';
import { fixableIds } from './model.js';
import { renderScan } from './views/scan.js';
import { renderResults } from './views/results.js';
import { renderFixes } from './views/fixes.js';
import { renderRules } from './views/rules.js';

const ROUTES = [
  { id: 'scan', label: 'Scan', render: renderScan },
  { id: 'results', label: 'Findings', render: renderResults },
  { id: 'fixes', label: 'Fixes', render: renderFixes },
  { id: 'rules', label: 'Rules', render: renderRules },
];

function readToken() {
  const m = /(?:^|[#&])token=([a-f0-9]+)/.exec(location.hash);
  try {
    if (m) {
      sessionStorage.setItem('studio-token', m[1]);
      return m[1];
    }
    return sessionStorage.getItem('studio-token') || '';
  } catch {
    return m ? m[1] : '';
  }
}

const token = readToken();
const engine = createEngine({ kind: 'local', token });
const main = document.getElementById('main');
const nav = document.getElementById('nav');
const colophon = document.getElementById('colophon');
const statusEl = document.getElementById('status');

export const state = {
  info: null,
  infoError: null,
  scanForm: { mode: 'folder', path: '', ext: 'html', snippet: '' },
  scan: null, // last scan result
  scanInput: null, // what produced it
  preview: null,
  previewError: null,
  previewKey: null,
  fixable: new Set(),
  resultsView: null,
  fix: null,
};

function announce(msg) {
  statusEl.textContent = '';
  setTimeout(() => {
    statusEl.textContent = msg;
  }, 30);
}

/** Dry-run the fixes for the current scan; cached per scan. */
async function ensurePreview(force = false) {
  if (!state.scan || !state.scanInput) return null;
  if (!force && state.preview && state.previewKey === state.scan) return state.preview;
  const key = state.scan;
  try {
    const p = await engine.previewFixes(state.scanInput);
    if (state.scan !== key) return null;
    state.preview = p;
    state.previewError = null;
    state.previewKey = key;
    state.fixable = fixableIds(state.scan.findings, p.files);
  } catch (err) {
    if (state.scan !== key) return null;
    state.preview = null;
    state.previewError = err;
    state.previewKey = key;
    state.fixable = new Set();
  }
  drawNav();
  return state.preview;
}

function setScan(scan, input) {
  state.scan = scan;
  state.scanInput = input;
  state.preview = null;
  state.previewError = null;
  state.previewKey = null;
  state.fixable = new Set();
  drawNav();
}

function go(route) {
  if (location.hash === '#/' + route) route_();
  else location.hash = '#/' + route;
}

const ctx = { engine, state, go, announce, ensurePreview, setScan };

function current() {
  const id = /^#\/(\w+)/.exec(location.hash)?.[1];
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
}

function drawNav() {
  const cur = current();
  const resultCount = state.scan ? state.scan.summary.total : null;
  const fixCount = state.preview ? state.preview.fixCount : null;
  const stepItem = (r, i) => {
    let extra = null;
    if (r.id === 'results' && resultCount !== null) extra = h('span', { class: 'nav-count', text: String(resultCount) });
    if (r.id === 'fixes' && fixCount) extra = h('span', { class: 'nav-count', text: String(fixCount) });
    // Findings and Fixes are empty until a scan has run; say so instead of leaving a blank page.
    const waiting = !state.scan && (r.id === 'results' || r.id === 'fixes');
    return h(
      'li',
      { class: waiting ? 'nav-step is-waiting' : 'nav-step' },
      h(
        'a',
        { href: '#/' + r.id, 'aria-current': r.id === cur.id ? 'page' : false, class: 'nav-link' },
        h('span', { class: 'nav-n', 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { text: r.label }),
        extra,
        waiting ? h('span', { class: 'sr-only', text: ' (available after a scan)' }) : null,
      ),
    );
  };
  const rules = ROUTES.find((r) => r.id === 'rules');
  clear(nav).append(
    h('ol', { class: 'nav-list nav-steps' }, ROUTES.filter((r) => r.id !== 'rules').map(stepItem)),
    h(
      'ul',
      { class: 'nav-list nav-ref' },
      h('li', {}, h('a', { href: '#/rules', 'aria-current': rules.id === cur.id ? 'page' : false, class: 'nav-link', title: 'Reference: everything the detector checks' }, 'All rules')),
    ),
  );
}

function drawColophon() {
  clear(colophon);
  if (!state.info) {
    colophon.append(h('p', { class: 'meta', text: 'Everything runs on this computer. Nothing is uploaded and nothing is tracked.' }));
    return;
  }
  const e = state.info.engine;
  colophon.append(
    h('p', { class: 'meta' }, 'Project folder ', h('code', { text: state.info.root }), ' · the Studio can only read and change files inside it.'),
    h('p', { class: 'meta' }, 'Detector ', h('code', { text: e.found ? e.path : 'not found' }), e.version ? ` · version ${e.version}` : '', ' · Everything runs on this computer; nothing is uploaded.'),
  );
}

let cleanup = null;
function route_() {
  const route = current();
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  drawNav();
  clear(main);
  document.title = `${route.label} · Anti-AI Design Studio`;
  if (state.infoError) return renderBlocked(main, state.infoError);
  cleanup = route.render(main, ctx) || null;
  const heading = main.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: false });
  }
  window.scrollTo(0, 0);
}

function renderBlocked(el, err) {
  const noToken = err.code === 'bad_token' || err.status === 401 || !token;
  el.append(
    h(
      'section',
      { class: 'notice', 'aria-labelledby': 'blocked-h' },
      h('h1', { id: 'blocked-h', text: noToken ? 'This page needs the start-up link' : 'The Studio server is not answering' }),
      h('p', {
        text: noToken
          ? 'Every request carries a one-time token. Open the full address that the server printed in your terminal when it started; it ends in #token= and a long string.'
          : err.message,
      }),
      h('p', { class: 'meta', text: 'Start it with: node studio/server.mjs --root <folder>' }),
    ),
  );
}

async function boot() {
  // Drop the token from the address bar so it does not end up in a copied link.
  if (/token=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/scan');
  window.addEventListener('hashchange', route_);
  drawNav();
  drawColophon();
  try {
    state.info = await engine.info();
  } catch (err) {
    state.infoError = err;
  }
  drawColophon();
  route_();
}

boot();
