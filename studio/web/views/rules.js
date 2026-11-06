import { h, clear, plural } from '../ui.js';
import { SEVERITY, CATEGORY, categoryLabel, severityLabel } from '../glossary.js';
import { specimenForRule } from '../guide-content.js';

export function renderRules(main, ctx) {
  const { engine, state } = ctx;
  const view = (state.rulesView ||= { query: '', firstParty: false, severity: 'all', category: 'all' });
  const list = h('ol', { class: 'entries rules' });
  const count = h('p', { class: 'meta', role: 'status' });
  const body = h('div', { class: 'screen' }, h('h1', { text: 'All rules' }), h('p', { class: 'lede', text: 'Every check the detector can run, and what each one looks for. A finding on the Findings screen is a rule that matched your code. This page is for reference; you do not need it to scan.' }), h('dl', { class: 'glossary' }, Object.values(CATEGORY).flatMap((c) => [h('dt', { text: c.label }), h('dd', { text: c.means })]), Object.values(SEVERITY).flatMap((c) => [h('dt', { text: c.label }), h('dd', { text: c.means })])));
  main.append(body);

  function draw(rules) {
    const q = view.query.trim().toLowerCase();
    const shown = rules.filter(
      (r) =>
        (!view.firstParty || r.firstParty) &&
        (view.severity === 'all' || r.severity === view.severity) &&
        (view.category === 'all' || r.category === view.category) &&
        (!q || `${r.id} ${r.name} ${r.description} ${r.category} ${r.scopes.join(' ')}`.toLowerCase().includes(q)),
    );
    count.textContent = `Showing ${shown.length} of ${plural(rules.length, 'rule')}`;
    clear(list);
    if (!shown.length) list.append(h('li', { class: 'notice' }, h('p', { text: 'No rule matches. Try fewer or different words.' })));
    for (const r of shown) {
      list.append(
        h(
          'li',
          { class: 'finding rule' },
          h('div', { class: 'finding-head' }, h('h2', { class: 'finding-title', text: r.name }), h('span', { class: `sev sev-${r.severity}`, text: severityLabel(r.severity) }), r.firstParty ? h('span', { class: 'tag tag-first', title: 'Written for Anti-AI Design', text: 'Anti-AI Design' }) : h('span', { class: 'tag', title: 'Comes with the underlying detection engine', text: 'Core engine' })),
          h('p', { class: 'where' }, h('code', { text: r.id }), ` · ${categoryLabel(r.category)}`, r.scopes.length ? ` · checks ${r.scopes.join(', ')}` : ''),
          h('p', { class: 'why', text: r.description }),
          specimenForRule(r.id) ? h('p', { class: 'meta' }, h('a', { href: `#/guide/${specimenForRule(r.id).id}`, text: 'See this one side by side with a better version' })) : null,
        ),
      );
    }
  }

  const search = h('input', { class: 'field', id: 'rq', type: 'search', value: view.query, placeholder: 'A word, like “gradient” or “contrast”', autocomplete: 'off' });
  const sev = h(
    'select',
    { class: 'field', id: 'rs' },
    ['all', 'error', 'warning', 'advisory'].map((s) => h('option', { value: s, text: s === 'all' ? 'Any' : severityLabel(s) })),
  );
  sev.value = view.severity;
  const cat = h('select', { class: 'field', id: 'rc' }, h('option', { value: 'all', text: 'Any' }), Object.entries(CATEGORY).map(([k, c]) => h('option', { value: k, text: c.label })));
  cat.value = view.category;
  const first = h('input', { type: 'checkbox', id: 'rf', checked: view.firstParty });

  engine
    .listRules()
    .then(({ rules }) => {
      if (!main.isConnected) return;
      const firstCount = rules.filter((r) => r.firstParty).length;
      const redraw = () => {
        view.query = search.value;
        view.severity = sev.value;
        view.category = cat.value;
        view.firstParty = first.checked;
        draw(rules);
      };
      search.addEventListener('input', redraw);
      sev.addEventListener('change', redraw);
      cat.addEventListener('change', redraw);
      first.addEventListener('change', redraw);
      body.append(
        h(
          'form',
          { class: 'filters', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Filter rules' },
          h('div', { class: 'fs grow' }, h('label', { class: 'label', for: 'rq', text: 'Search' }), search),
          h('div', { class: 'fs' }, h('label', { class: 'label', for: 'rc', text: 'Kind' }), cat),
          h('div', { class: 'fs' }, h('label', { class: 'label', for: 'rs', text: 'How serious' }), sev),
          h('div', { class: 'fs check' }, first, h('label', { for: 'rf', text: `Only rules written for Anti-AI Design (${firstCount})` })),
        ),
        count,
        list,
      );
      draw(rules);
    })
    .catch((err) => {
      if (!main.isConnected) return;
      body.append(h('div', { class: 'notice notice-error', role: 'alert' }, h('h2', { class: 'notice-title', text: 'The rule list did not load' }), h('p', { text: err.message }), err.details?.buildCommand ? h('pre', { class: 'plain mono', text: err.details.buildCommand }) : null));
    });
}
