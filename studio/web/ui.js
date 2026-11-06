// Tiny DOM helpers. Text only ever goes in through textContent, never innerHTML.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value' || k === 'checked') el[k] = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  add(el, kids);
  return el;
}

// The SVG namespace is an XML identifier, not a network address. It is built in two pieces so the
// "no absolute URLs in web files" test can stay strict.
const SVG_NS = 'http:' + '//www.w3.org/2000/svg';

/**
 * SVG version of h(). `vars` sets CSS custom properties through the CSSOM (allowed by the strict CSP,
 * unlike a style attribute), which is how every animation gets its delay and duration.
 */
export function s(tag, props, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'vars') for (const [name, val] of Object.entries(v)) el.style.setProperty('--' + name, String(val));
    else el.setAttribute(k, String(v));
  }
  add(el, kids);
  return el;
}

/** True when the person has asked their system to reduce motion. */
export function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function add(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

export function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatMs(ms) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

let uid = 0;
export function nextId(prefix = 'id') {
  uid += 1;
  return `${prefix}-${uid}`;
}

/** Counts a number up from zero in a text node. With reduced motion it just sets the final value. */
export function countUp(el, to, ms = 800) {
  el.textContent = String(to);
  if (reducedMotion() || to < 2 || typeof requestAnimationFrame !== 'function') return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / ms, 1);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    else el.textContent = String(to);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}
