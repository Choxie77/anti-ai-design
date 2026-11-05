import { h, clear, plural, cap } from '../ui.js';

export function renderRules(main, ctx) {
  const { engine, state } = ctx;
  const view = (state.rulesView ||= { query: '', firstParty: false, severity: 'all' });
  const list = h('ol', { class: 'entries rules' });
  const count = h('p', { class: 'meta', role: 'status' });
  const body = h('div', { class: 'screen' }, h('h1', { text: 'Rules' }), h('p', { class: 'lede', text: 'Every check the detector runs. First-party rules are the ones written for Anti-AI Design; the rest come from the upstream engine.' }));
  main.append(body);

  function draw(rules) {
    const q = view.query.trim().toLowerCase();
    const shown = rules.filter(
      (r) =>
        (!view.firstParty || r.firstParty) &&
        (view.severity === 'all' || r.severity === view.severity) &&
        (!q || `${r.id} ${r.name} ${r.description} ${r.category} ${r.scopes.join(' ')}`.toLowerCase().includes(q)),
    );
    count.textContent = `${plural(shown.length, 'rule')} shown of ${rules.length}`;
    clear(list);
    if (!shown.length) list.append(h('li', { class: 'notice' }, h('p', { text: 'No rule matches. Try fewer words.' })));
    for (const r of shown) {
      list.append(
        h(
          'li',
          { class: 'finding rule' },
          h('div', { class: 'finding-head' }, h('h2', { class: 'finding-title', text: r.name }), h('span', { class: `sev sev-${r.severity}`, text: cap(r.severity) }), r.firstParty ? h('span', { class: 'tag tag-first', text: 'First-party' }) : h('span', { class: 'tag', text: 'Upstream' })),
          h('p', { class: 'where' }, h('code', { text: r.id }), ` · ${cap(r.category)}`, r.scopes.length ? ` · applies to ${r.scopes.join(', ')}` : ''),
          h('p', { class: 'why', text: r.description }),
        ),
      );
    }
  }

  const search = h('input', { class: 'field', id: 'rq', type: 'search', value: view.query, placeholder: 'Name, id or words', autocomplete: 'off' });
  const sev = h(
    'select',
    { class: 'field', id: 'rs' },
    ['all', 'error', 'warning', 'advisory'].map((s) => h('option', { value: s, text: s === 'all' ? 'Any severity' : cap(s) })),
  );
  sev.value = view.severity;
  const first = h('input', { type: 'checkbox', id: 'rf', checked: view.firstParty });

  engine
    .listRules()
    .then(({ rules }) => {
      if (!main.isConnected) return;
      const firstCount = rules.filter((r) => r.firstParty).length;
      const redraw = () => {
        view.query = search.value;
        view.severity = sev.value;
        view.firstParty = first.checked;
        draw(rules);
      };
      search.addEventListener('input', redraw);
      sev.addEventListener('change', redraw);
      first.addEventListener('change', redraw);
      body.append(
        h(
          'form',
          { class: 'filters', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Filter rules' },
          h('div', { class: 'fs grow' }, h('label', { class: 'label', for: 'rq', text: 'Search' }), search),
          h('div', { class: 'fs' }, h('label', { class: 'label', for: 'rs', text: 'Severity' }), sev),
          h('div', { class: 'fs check' }, first, h('label', { for: 'rf', text: `First-party only (${firstCount})` })),
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
