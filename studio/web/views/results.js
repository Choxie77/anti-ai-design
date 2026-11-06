import { h, clear, plural, cap, formatMs } from '../ui.js';
import { SEVERITY_ORDER, filterFindings, groupFindings } from '../model.js';
import { SEVERITY, CATEGORY, categoryLabel, severityLabel } from '../glossary.js';

export function codeBlock(ctxData, label, wholeFile = false) {
  if (!ctxData) {
    return h('p', { class: 'meta', text: wholeFile ? 'This applies to the file as a whole, so there is no single line to show.' : 'The code for this line cannot be shown. The file may be hidden, very large, or changed since the scan.' });
  }
  return h(
    'div',
    { class: 'code', role: 'group', tabindex: '0', 'aria-label': label },
    ctxData.lines.map((l) =>
      h(
        'div',
        { class: l.hit ? 'cl cl-hit' : 'cl' },
        h('span', { class: 'ln', text: String(l.n) }),
        h('span', { class: 'src' }, l.text === '' ? ' ' : l.text, l.hit ? h('span', { class: 'sr-only', text: ' (flagged line)' }) : null),
      ),
    ),
  );
}

export function sevChip(sev) {
  return h('span', { class: `sev sev-${sev}`, text: severityLabel(sev) });
}

function countRows(title, counts, total, order, glossary) {
  const keys = order || Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return h(
    'section',
    { class: 'tally', 'aria-label': title },
    h('p', { class: 'tally-title', 'aria-hidden': 'true', text: title }),
    h(
      'ul',
      { class: 'rule-list' },
      keys
        .filter((k) => counts[k])
        .map((k) => {
          const bar = h('span', { class: 'bar', 'aria-hidden': 'true' });
          bar.style.setProperty('--w', `${Math.max(4, Math.round((counts[k] / total) * 100))}%`);
          const g = glossary?.[k];
          return h('li', { class: 'tally-row' }, h('span', { class: 'tally-k', text: g?.label || cap(k) }), h('span', { class: 'tally-n', text: String(counts[k]) }), g ? h('span', { class: 'tally-d', text: g.means }) : null, bar);
        }),
    ),
  );
}

/** `index.html:7`, or just the file name when the finding covers the whole file. */
function place(f) {
  return f.line ? `${f.file}:${f.line}` : `${f.file} (whole file)`;
}

export function renderResults(main, ctx) {
  const { state, go } = ctx;
  const scan = state.scan;
  if (!scan) {
    main.append(
      h(
        'div',
        { class: 'screen' },
        h('h1', { text: 'Findings' }),
        h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: 'No scan yet' }), h('p', { text: 'Run a scan and the findings will be listed here, with the code around each one.' }), h('a', { class: 'btn btn-primary', href: '#/scan', text: 'Go to Scan' })),
      ),
    );
    return;
  }

  const { summary } = scan;
  const where = scan.kind === 'snippet' ? 'your snippet' : scan.target === '.' || scan.target === '' ? 'your whole project' : scan.target;
  const head = h(
    'div',
    { class: 'screen' },
    h('h1', { text: 'Findings' }),
    h('p', { class: 'meta' }, `Scanned `, h('code', { text: where }), ` in ${formatMs(scan.durationMs)}`, scan.skipped ? ` · ${plural(scan.skipped, 'finding')} outside the root hidden` : ''),
  );

  if (summary.total === 0) {
    head.append(
      h(
        'section',
        { class: 'notice' },
        h('h2', { class: 'notice-title', text: 'Nothing reported' }),
        h('p', { text: 'None of the detector’s rules matched. That says the rules found no marks, not that the design is good.' }),
        h('div', { class: 'row' }, h('a', { class: 'btn btn-primary', href: '#/scan', text: 'Scan something else' }), h('a', { class: 'btn btn-quiet', href: '#/rules', text: 'Read the rules' })),
      ),
    );
    main.append(head);
    return;
  }

  const view = (state.resultsView ||= { group: 'file', severities: new Set(SEVERITY_ORDER), category: 'all', query: '', fixableOnly: false });
  const categories = Object.keys(summary.byCategory).sort();

  head.append(
    h(
      'div',
      { class: 'ledger' },
      h(
        'div',
        { class: 'big-wrap' },
        h('p', { class: 'big' }, h('span', { class: 'big-n', text: String(summary.total) }), h('span', { class: 'big-l', text: ` ${summary.total === 1 ? 'finding' : 'findings'} in ${plural(summary.files, 'file')}` })),
        h('p', { class: 'help', text: 'A finding is one place where your code matches a known mark of generic or careless design.' }),
      ),
      countRows('How serious', summary.bySeverity, summary.total, SEVERITY_ORDER, SEVERITY),
      countRows('What kind', summary.byCategory, summary.total, null, CATEGORY),
    ),
  );

  const list = h('div', { class: 'groups' });
  const count = h('p', { class: 'meta', role: 'status' });
  const nextStep = h('div', { class: 'next', 'aria-live': 'polite' }, h('p', { class: 'meta', text: 'Checking which of these have a safe automatic fix…' }));

  function drawList() {
    const shown = filterFindings(scan.findings, view, state.fixable);
    clear(list);
    count.textContent = `Showing ${shown.length} of ${scan.findings.length}`;
    if (shown.length === 0) {
      list.append(h('div', { class: 'notice' }, h('h2', { class: 'notice-title', text: 'Nothing matches these filters' }), h('p', { text: 'Loosen a filter to see findings again.' })));
      return;
    }
    for (const g of groupFindings(shown, view.group)) {
      const byRule = view.group === 'rule';
      list.append(
        h(
          'section',
          { class: 'group' },
          h(
            'header',
            { class: 'group-head' },
            h('h2', { class: byRule ? 'group-title' : 'group-title mono', text: g.title }),
            h('p', { class: 'meta' }, byRule ? [sevChip(g.sample.severity), ` ${categoryLabel(g.sample.category)} · `, h('code', { text: g.key }), ' · '] : null, plural(g.items.length, 'finding')),
            byRule ? h('p', { class: 'why', text: g.sample.description }) : null,
          ),
          h('ol', { class: 'entries' }, g.items.map((f) => entry(f, byRule))),
        ),
      );
    }
  }

  function entry(f, byRule) {
    const fixable = state.fixable.has(f.id);
    return h(
      'li',
      { class: 'finding' },
      h(
        'div',
        { class: 'finding-head' },
        h('h3', { class: 'finding-title' }, byRule ? h('code', { text: place(f) }) : f.name),
        sevChip(f.severity),
        fixable ? h('a', { class: 'tag', href: '#/fixes', text: 'Can be fixed automatically' }) : null,
      ),
      h('p', { class: 'where' }, byRule ? null : [h('code', { text: place(f) }), ' · '], h('code', { text: f.rule }), ` · ${categoryLabel(f.category)}`),
      byRule ? null : h('p', { class: 'why', text: f.description }),
      f.snippet ? h('p', { class: 'note' }, 'What matched: ', h('code', { text: f.snippet })) : null,
      codeBlock(f.context, `Code around ${place(f)}`, !f.line),
    );
  }

  const sevButtons = SEVERITY_ORDER.filter((s) => summary.bySeverity[s]).map((s) => {
    const b = h('button', {
      type: 'button',
      class: 'toggle',
      'aria-pressed': String(view.severities.has(s)),
      text: `${severityLabel(s)} (${summary.bySeverity[s]})`,
      title: SEVERITY[s]?.means,
      onclick: () => {
        if (view.severities.has(s)) view.severities.delete(s);
        else view.severities.add(s);
        b.setAttribute('aria-pressed', String(view.severities.has(s)));
        drawList();
      },
    });
    return b;
  });

  const search = h('input', {
    class: 'field',
    type: 'search',
    id: 'q',
    value: view.query,
    placeholder: 'File name, rule, or a word',
    autocomplete: 'off',
    oninput: () => {
      view.query = search.value;
      drawList();
    },
  });
  const catSel = h(
    'select',
    {
      class: 'field',
      id: 'cat',
      onchange: () => {
        view.category = catSel.value;
        drawList();
      },
    },
    h('option', { value: 'all', text: 'All kinds' }),
    categories.map((c) => h('option', { value: c, text: categoryLabel(c) })),
  );
  catSel.value = view.category;
  const fixOnly = h('input', {
    type: 'checkbox',
    id: 'fixonly',
    checked: view.fixableOnly,
    onchange: () => {
      view.fixableOnly = fixOnly.checked;
      drawList();
    },
  });

  function groupRadio(value, label) {
    const id = `grp-${value}`;
    return h(
      'span',
      { class: 'seg' },
      h('input', {
        type: 'radio',
        name: 'group',
        id,
        checked: view.group === value,
        onchange: () => {
          view.group = value;
          drawList();
        },
      }),
      h('label', { for: id, text: label }),
    );
  }

  head.append(
    h(
      'form',
      { class: 'filters', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Filter findings' },
      h('fieldset', { class: 'fs' }, h('legend', { class: 'label', text: 'Organize by' }), h('div', { class: 'segs' }, groupRadio('file', 'File'), groupRadio('rule', 'Problem type'))),
      h('fieldset', { class: 'fs' }, h('legend', { class: 'label', text: 'How serious' }), h('div', { class: 'row' }, sevButtons)),
      h('div', { class: 'fs' }, h('label', { class: 'label', for: 'cat', text: 'Kind' }), catSel),
      h('div', { class: 'fs grow' }, h('label', { class: 'label', for: 'q', text: 'Search' }), search),
      h('div', { class: 'fs check' }, fixOnly, h('label', { for: 'fixonly', text: 'Only ones I can fix automatically' })),
    ),
    count,
    list,
  );
  // The next step goes right under the summary, before the long list.
  head.querySelector('.ledger').after(nextStep);
  main.append(head);
  drawList();

  // Which findings have a safe fix is only known after a dry run. Ask for it quietly.
  ctx.ensurePreview().then((p) => {
    if (!main.isConnected || state.scan !== scan) return;
    clear(nextStep);
    if (p && p.fixCount) {
      nextStep.append(
        h('p', { class: 'next-t', text: `${plural(state.fixable.size, 'finding')} can be fixed automatically.` }),
        h('p', { class: 'next-d', text: `You will see exactly what changes and confirm before anything is written.${p.fixCount !== state.fixable.size ? ' One change can clear more than one finding.' : ''} The other findings need a person to decide.` }),
        h('a', { class: 'btn btn-primary', href: '#/fixes', text: `Review ${plural(p.fixCount, 'fix', 'fixes')}` }),
      );
    } else if (p) {
      nextStep.append(
        h('p', { class: 'next-t', text: 'None of these can be fixed automatically.' }),
        h('p', { class: 'next-d', text: 'The detector only rewrites code when the change is mechanical and cannot alter meaning. Work through the list below by hand; each entry says what to change.' }),
      );
    } else {
      nextStep.append(h('p', { class: 'meta', text: 'Could not check for automatic fixes. The findings below are still accurate.' }));
    }
    drawList();
  });
}
