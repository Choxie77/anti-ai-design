// What this browser has already been shown. Kept in localStorage; every access is guarded because it can
// be missing or blocked (private windows, blocked site data). The Studio works the same without it.

const KEY = 'studio-onboarding-v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

// If storage is blocked we still remember for the life of this page, so the tour is not forced twice.
let memory = null;

export function getFlags() {
  return memory || read();
}

export function setFlag(name, value = true) {
  const next = { ...getFlags(), [name]: value };
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* blocked: the in-memory copy above is enough for this visit */
  }
  return next;
}

export function resetFlags() {
  memory = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const hasSeenTour = () => !!getFlags().tour;
export const hasSeenCoach = (screen) => !!getFlags()[`coach-${screen}`];
