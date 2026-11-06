import { h } from '../ui.js';
import { splitRows } from '../model.js';

const SIGN = { add: '+', del: '−', ctx: ' ' };

export function unifiedDiff(file) {
  return h(
    'div',
    { class: 'diff-wrap', tabindex: '0', role: 'group', 'aria-label': `Unified diff of ${file.file}` },
    h(
      'table',
      { class: 'diff' },
      h('caption', { class: 'sr-only', text: `Changes to ${file.file}` }),
      file.hunks.map((hunk) => [
        h('tbody', {}, h('tr', { class: 'hunk' }, h('td', { colspan: '4', text: `Lines ${hunk.oldStart}–${hunk.oldStart + hunk.oldLines - 1}` }))),
        h(
          'tbody',
          {},
          hunk.lines.map((l) =>
            h(
              'tr',
              { class: `d-${l.t}` },
              h('td', { class: 'dn', text: l.old ?? '' }),
              h('td', { class: 'dn', text: l.new ?? '' }),
              h('td', { class: 'ds' }, h('span', { 'aria-hidden': 'true', text: SIGN[l.t] }), h('span', { class: 'sr-only', text: l.t === 'add' ? 'added' : l.t === 'del' ? 'removed' : 'unchanged' })),
              h('td', { class: 'dt', text: l.text }),
            ),
          ),
        ),
      ]),
    ),
  );
}

export function splitDiff(file) {
  return h(
    'div',
    { class: 'diff-wrap', tabindex: '0', role: 'group', 'aria-label': `Side by side diff of ${file.file}` },
    h(
      'table',
      { class: 'diff diff-split' },
      h('caption', { class: 'sr-only', text: `Before and after for ${file.file}` }),
      h('thead', {}, h('tr', {}, h('th', { colspan: '2', scope: 'colgroup', text: 'Before' }), h('th', { colspan: '2', scope: 'colgroup', text: 'After' }))),
      file.hunks.map((hunk) =>
        h(
          'tbody',
          {},
          splitRows(hunk).map((r) =>
            h(
              'tr',
              {},
              h('td', { class: 'dn', text: r.left?.old ?? '' }),
              h('td', { class: r.left ? (r.left.t === 'del' ? 'dt d-del' : 'dt') : 'dt d-empty', text: r.left?.text ?? '' }),
              h('td', { class: 'dn', text: r.right?.new ?? '' }),
              h('td', { class: r.right ? (r.right.t === 'add' ? 'dt d-add' : 'dt') : 'dt d-empty', text: r.right?.text ?? '' }),
            ),
          ),
        ),
      ),
    ),
  );
}
