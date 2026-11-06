// A walkthrough laid over the real screen: one element at a time is lit up and a small card says what it is.
// Nothing here changes the page underneath; closing it leaves the screen exactly as it was.

import { h, reducedMotion } from './ui.js';

let active = null;

/**
 * @param {Array<{target: () => Element|null, title: string, body: string}>} steps
 * @param {{ onDone?: () => void, onClose?: () => void, doneLabel?: string }} opts
 */
export function startCoach(steps, opts = {}) {
  if (active) active.stop(false);
  const usable = steps.filter((s) => s.target());
  if (!usable.length) return null;

  let i = 0;
  let raf = 0;
  let current = null;
  const returnFocus = document.activeElement;

  const ring = h('div', { class: 'coach-ring', 'aria-hidden': 'true' });
  const count = h('p', { class: 'coach-count' });
  const title = h('h2', { class: 'coach-title', id: 'coach-t' });
  const body = h('p', { class: 'coach-body', id: 'coach-b' });
  const back = h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => go(i - 1) }, 'Back');
  const next = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => (i === usable.length - 1 ? finish() : go(i + 1)) });
  const skip = h('button', { type: 'button', class: 'linkish', onclick: () => stop(true) }, 'Stop the walkthrough');
  const card = h('div', { class: 'coach-card', role: 'dialog', 'aria-labelledby': 'coach-t', 'aria-describedby': 'coach-b' }, count, title, body, h('div', { class: 'coach-actions' }, back, next, skip));
  const root = h('div', { class: 'coach' }, ring, card);
  document.body.append(root);

  function place() {
    raf = 0;
    if (!current || !current.isConnected) return;
    const r = current.getBoundingClientRect();
    const pad = 8;
    const x = Math.max(r.left - pad, 4);
    const y = Math.max(r.top - pad, 4);
    ring.style.setProperty('--x', `${x}px`);
    ring.style.setProperty('--y', `${y}px`);
    ring.style.setProperty('--w', `${Math.min(r.width + pad * 2, window.innerWidth - x - 4)}px`);
    ring.style.setProperty('--h', `${Math.min(r.height + pad * 2, window.innerHeight - y - 4)}px`);
  }
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(place);
  };

  function go(n) {
    i = Math.min(Math.max(n, 0), usable.length - 1);
    const step = usable[i];
    current?.classList.remove('coach-target');
    current = step.target();
    if (!current) return finish();
    current.classList.add('coach-target');
    count.textContent = `${i + 1} of ${usable.length}`;
    title.textContent = step.title;
    body.textContent = step.body;
    back.disabled = i === 0;
    next.textContent = i === usable.length - 1 ? opts.doneLabel || 'Got it' : 'Next';
    current.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    place();
    next.focus({ preventScroll: true });
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('keydown', onKey, true);
    current?.classList.remove('coach-target');
    root.remove();
    if (active && active.root === root) active = null;
  }

  function stop(userClosed) {
    cleanup();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    if (userClosed) opts.onClose?.();
  }

  function finish() {
    cleanup();
    opts.onDone?.();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      stop(true);
    } else if (e.key === 'ArrowRight' && i < usable.length - 1) go(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
  }

  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  document.addEventListener('keydown', onKey, true);
  active = { root, stop };
  go(0);
  return { stop: () => stop(false) };
}

export function stopCoach() {
  active?.stop(false);
}
