// Plain-language meanings for the words the Studio shows. One place, so every screen explains them the same way.

export const SEVERITY = {
  error: {
    label: 'Error',
    means: 'Breaks something for real users, such as text nobody can read. Fix these first.',
  },
  warning: {
    label: 'Warning',
    means: 'A clear mark of generic or careless design. Worth fixing before you ship.',
  },
  advisory: {
    label: 'Advisory',
    means: 'A judgment call. It may be intentional, so look at it and decide.',
  },
};

export const CATEGORY = {
  slop: {
    label: 'Looks AI-made',
    topic: 'the AI-made look',
    means: 'Patterns that make an interface look generated: gradient text, glowing cards, stock colors.',
  },
  quality: {
    label: 'Craft and access',
    topic: 'craft and accessibility',
    means: 'Basic polish and accessibility: contrast, focus rings, sizes, spacing, labels.',
  },
};

export function categoryLabel(c) {
  return CATEGORY[c]?.label || (c ? c[0].toUpperCase() + c.slice(1) : '');
}

export function severityLabel(s) {
  return SEVERITY[s]?.label || (s ? s[0].toUpperCase() + s.slice(1) : '');
}

/** The step each screen belongs to. Rules is reference material, not a step. */
export const STEPS = [
  { id: 'scan', n: 1, label: 'Scan', hint: 'Choose what to check' },
  { id: 'results', n: 2, label: 'Findings', hint: 'See what was flagged and why' },
  { id: 'fixes', n: 3, label: 'Fixes', hint: 'Preview and apply safe fixes' },
];
