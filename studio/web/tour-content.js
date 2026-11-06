// What the tour says. Pure data, no DOM, so it can be checked in Node.
// Writing rule: assume the reader has never heard of this tool or of "linting". Short sentences, no jargon
// without an explanation next to it.

export const CHAPTERS = [
  {
    id: 'problem',
    scene: 'problem',
    kicker: 'The problem',
    title: 'Some websites look machine-made.',
    body: [
      'You have seen it: a purple-to-pink headline, cards that glow, a little pill above every title. None of it is wrong alone. Together it is the look of a page nobody designed.',
      'The Studio finds these marks in your code, so you can fix them before anyone else notices.',
    ],
    legendTitle: 'The marks circled in the picture',
    legend: [
      ['A pill above the headline', 'A tiny rounded label such as “New”. Nearly every generated landing page has one.'],
      ['Gradient text', 'Letters filled with a color blend. Decorative, and hard to read.'],
      ['An icon tile', 'A colored square with an icon, stacked above a heading.'],
      ['Glowing cards', 'A colored halo around a box. The default “cool” look of generated interfaces.'],
    ],
  },
  {
    id: 'proofreader',
    scene: 'proofreader',
    kicker: 'What it does',
    title: 'Think of it as a proofreader for design.',
    body: [
      'A proofreader reads a manuscript line by line and writes a note in the margin wherever something is off. The Studio does the same with your HTML, CSS and component code.',
      'It compares every line with a list of known marks. When one matches, you get a note that says what, where and why.',
    ],
    terms: [
      ['Detector', 'The program that does the reading. It runs on your computer.'],
      ['Rule', 'One known mark, such as “Gradient text”. The detector has dozens.'],
      ['Finding', 'One place where your code matches a rule.'],
    ],
  },
  {
    id: 'scan',
    scene: 'scan',
    step: 1,
    kicker: 'Step 1 · Scan',
    title: 'Point it at your code.',
    body: [
      'Choose your whole project, one folder, or paste a snippet. The detector opens each file and counts what it finds.',
      'A scan only reads. It cannot change a file, so you cannot break anything by scanning.',
    ],
    tip: 'Not sure where to start? The last page of this tour has a sample you can try in one click.',
  },
  {
    id: 'findings',
    scene: 'findings',
    step: 2,
    kicker: 'Step 2 · Findings',
    title: 'Every mark, explained.',
    body: ['Each finding is a small card. It tells you what was found, where, and why it matters, with the exact line of code underneath.'],
    legendTitle: 'Reading a finding',
    legend: [
      ['Name and severity', 'What the mark is, and how much it matters: Error, Warning or Advisory.'],
      ['Where', 'The file and line number, then the rule’s name and its kind.'],
      ['Why it matters', 'One or two sentences in plain words.'],
      ['What matched', 'The exact bit of code that triggered it.'],
      ['The code', 'The lines around it, with the flagged line shaded.'],
      ['Fix?', 'A tag appears when the Studio can fix it for you automatically.'],
    ],
    severity: [
      ['error', 'Error', 'Breaks something for real users. Fix first.'],
      ['warning', 'Warning', 'A clear mark of generic or careless design.'],
      ['advisory', 'Advisory', 'A judgment call. It may be intentional.'],
    ],
  },
  {
    id: 'fixes',
    scene: 'fixes',
    step: 3,
    kicker: 'Step 3 · Fixes',
    title: 'See the change before it happens.',
    body: [
      'When a fix is purely mechanical, the Studio shows it as a before and after. Nothing is written until you confirm.',
      'Afterwards it scans again to prove the mark is gone, and keeps a changelog of what it did.',
    ],
    tip: 'Most findings need a person to decide, so only mechanical fixes are offered automatically.',
  },
  {
    id: 'safe',
    scene: 'safe',
    kicker: 'Good to know',
    title: 'Everything stays on your computer.',
    body: ['Nothing is uploaded and nothing is tracked. The Studio can only see the folder you started it in.'],
    final: true,
  },
];

export const TOUR_STEPS = CHAPTERS.length;

/** Wrap an index into the chapter list's range (clamps; it does not loop). */
export function clampChapter(i) {
  const n = Number.isFinite(+i) ? Math.trunc(+i) : 0;
  return Math.min(Math.max(n, 0), CHAPTERS.length - 1);
}

/** `#/welcome/3` -> 2 (zero based). Anything unreadable starts at the first chapter. */
export function chapterFromHash(hash) {
  const m = /^#\/welcome\/(\d+)/.exec(hash || '');
  return m ? clampChapter(Number(m[1]) - 1) : 0;
}

/** The screens a first-time visitor is walked through after the tour, in order. */
export const COACH_ORDER = ['results', 'fixes'];
