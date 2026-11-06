// The Field Guide: one specimen per well-known mark, each tied to the detector rule(s) that catch it.
// Pure data. The rule ids are checked against the real engine in tests/onboarding.test.mjs.

export const SPECIMENS = [
  {
    id: 'gradient-text',
    rules: ['gradient-text'],
    title: 'Gradient text',
    tell: 'A color blend inside the letters looks fancy, but it is decoration, not meaning. It also lowers contrast wherever the blend turns light. It is on nearly every generated landing page.',
    instead: 'Use one solid color from your palette. Let size and weight make the heading stand out.',
    fixable: true,
  },
  {
    id: 'glow',
    rules: ['dark-glow'],
    title: 'Glowing shadows',
    tell: 'A colored halo around a card is the default “cool” effect of generated interfaces. When everything glows, nothing stands out.',
    instead: 'Use a soft, neutral shadow that suggests height, or skip the shadow and draw a clear border.',
  },
  {
    id: 'glass',
    rules: ['aad-glass-overuse'],
    title: 'Frosted glass everywhere',
    tell: 'Blurred, see-through panels look modern once. On every surface they make text harder to read and every screen feel the same.',
    instead: 'Use solid surfaces. Keep blur for the one thing that really floats, such as a menu.',
  },
  {
    id: 'contrast',
    rules: ['low-contrast'],
    title: 'Low-contrast text',
    tell: 'Gray text on a slightly different gray is hard or impossible to read for many people. The accessibility guideline (WCAG) asks for at least 4.5 to 1 for body text.',
    instead: 'Pick text and background colors that are clearly apart, and measure the ratio.',
  },
  {
    id: 'icon-tile',
    rules: ['icon-tile-stack'],
    title: 'Icon tile above a heading',
    tell: 'A colored rounded square with an icon, stacked over a heading and one line of text, repeated three times. It is the stock “features” section.',
    instead: 'Lead with the words. If you need an icon, put it inline, and only when it adds meaning.',
  },
  {
    id: 'pill',
    rules: ['hero-eyebrow-chip'],
    title: 'Pill above the headline',
    tell: 'A small rounded label such as “New” or “AI-powered” above the main headline. It puts a layer between the reader and your message, and everyone has one.',
    instead: 'Say the main thing in the headline. If something is truly new, say so where it matters.',
  },
  {
    id: 'emoji',
    rules: ['aad-emoji-icons'],
    title: 'Emoji as icons',
    tell: 'Emoji look different on every device and cannot be styled to match your type. Used as interface icons they read as a shortcut.',
    instead: 'Use one consistent icon set, or plain text.',
  },
  {
    id: 'side-tab',
    rules: ['side-tab'],
    title: 'Colored side-tab cards',
    tell: 'A thick colored stripe down one side of a rounded card is a common way to say “note”. It repeats until it means nothing.',
    instead: 'Set a note apart with a label, a light tint or spacing, and keep corners and accents consistent.',
  },
  {
    id: 'focus',
    rules: ['aad-focus-removed'],
    title: 'Hidden keyboard focus',
    tell: 'Removing the focus outline hides where keyboard users are on the page. Press Tab on each side and watch for where you are.',
    instead: 'Keep a visible focus ring, or replace it with a clear one of your own.',
    interactive: true,
  },
  {
    id: 'tiny',
    rules: ['tiny-text'],
    title: 'Tiny body text',
    tell: 'Text at 10 to 12 pixels strains most readers, and on a phone it is close to unreadable.',
    instead: 'Keep body text near 16 pixels and give it room to breathe.',
  },
];

/** The specimen that illustrates a detector rule, if there is one. */
export function specimenForRule(ruleId) {
  return SPECIMENS.find((s) => s.rules.includes(ruleId)) || null;
}

export function specimenById(id) {
  return SPECIMENS.find((s) => s.id === id) || null;
}
