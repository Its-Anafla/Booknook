// FR-05: reading log. Click a column header to sort; missing values ("-") always stay at the bottom.

import { h, clear, formatGrade, pluralize, compareWithMissingLast, normalize } from '../utils.js';
import { t } from '../strings.js';
import { loadAll } from '../store.js';
import { buildContext, authorLine } from '../model.js';
import { icon } from '../icons.js';
import { createFilterBar, readingPassesFilters, hasActiveFilters } from './filters.js';
import { pageHeader, emptyState } from './page.js';
import { openBookDetail } from './bookDetail.js';
import { openReadingForm } from './readingForm.js';
import { removeReading } from './actions.js';

const COLUMNS = [
  { key: 'title', label: 'log.title', value: (r, b, a) => b.title },
  { key: 'authors', label: 'log.authors', value: (r, b, a) => a || null },
  { key: 'status', label: 'log.status', value: (r) => r.status },
  { key: 'year', label: 'log.year', value: (r) => (r.yearRead === undefined ? null : r.yearRead), numeric: true },
  { key: 'grade', label: 'log.grade', value: (r) => (r.grade === undefined ? null : r.grade), numeric: true },
];

const sort = { key: 'year', direction: -1 };

export async function renderLog(root) {
  const ctx = buildContext(await loadAll());
  const subtitle = h('p', { class: 'page-sub' });
  const tbody = h('tbody');
  const headRow = h('tr');
  const empty = h('div', { class: 'empty-host' });
  const table = h('table', { class: 'log' }, h('caption', { class: 'sr-only' }, t('log.caption')), h('thead', {}, headRow), tbody);

  root.append(pageHeader({ title: t('log.heading'), subtitle }),
    createFilterBar({ ctx, onChange: paint }),
    h('div', { class: 'table-wrap' }, table), empty);

  function buildHead() {
    clear(headRow);
    for (const column of COLUMNS) {
      const active = sort.key === column.key;
      const button = h('button', { type: 'button', class: 'sort-btn' }, t(column.label),
        h('span', { class: 'sort-mark', html: icon(active ? 'sort' : 'sort', 14), 'aria-hidden': 'true' }),
        active ? h('span', { class: 'sr-only' }, sort.direction === 1 ? t('log.ascending') : t('log.descending')) : null);
      button.addEventListener('click', () => {
        sort.direction = active ? -sort.direction : 1;
        sort.key = column.key;
        paint();
        headRow.querySelector(`[data-key="${column.key}"] button`)?.focus();
      });
      headRow.append(h('th', { scope: 'col', dataset: { key: column.key }, 'aria-sort': active ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none', class: active ? 'is-sorted' : '' }, button));
    }
    headRow.append(h('th', { scope: 'col', class: 'col-actions' }, h('span', { class: 'sr-only' }, t('log.actions'))));
  }

  function paint() {
    const rows = ctx.readings
      .filter((r) => ctx.booksById.has(r.bookId) && readingPassesFilters(r, ctx))
      .map((r) => ({ r, b: ctx.booksById.get(r.bookId), a: authorLine(ctx.booksById.get(r.bookId), ctx) }));
    const column = COLUMNS.find((c) => c.key === sort.key);
    rows.sort((x, y) => {
      const primary = compareWithMissingLast(column.value(x.r, x.b, x.a), column.value(y.r, y.b, y.a), sort.direction);
      if (primary) return primary;
      // Ties keep insertion order (FR-05: after the year, by ID ascending).
      return x.r.id - y.r.id;
    });

    subtitle.textContent = pluralize(rows.length, 'reading');
    buildHead();
    clear(tbody);
    clear(empty);
    table.parentElement.hidden = rows.length === 0;
    if (!rows.length) {
      empty.append(emptyState({ title: hasActiveFilters() ? t('log.noMatch.title') : t('log.empty.title'), message: hasActiveFilters() ? t('log.noMatch.message') : t('log.empty.message'), mood: 'log' }));
      return;
    }
    for (const { r, b, a } of rows) {
      const year = r.yearRead === null || r.yearRead === undefined ? '-' : String(r.yearRead);
      tbody.append(h('tr', {},
        h('th', { scope: 'row', class: 'cell-title' }, h('button', { type: 'button', class: 'link-btn', on: { click: () => openBookDetail(b.id) } }, b.title)),
        h('td', { class: 'cell-authors' }, a || '-'),
        h('td', {}, h('span', { class: `status status--${r.status.toLowerCase().replace(/\s+/g, '-')}` }, r.status)),
        h('td', { class: 'num' }, year),
        h('td', { class: 'num' }, formatGrade(r.grade)),
        h('td', { class: 'col-actions' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('reading.edit'), title: t('reading.edit'), html: icon('edit', 18), on: { click: () => openReadingForm({ book: b, reading: r }) } }),
          h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': t('reading.deleteShort'), title: t('reading.deleteShort'), html: icon('trash', 18), on: { click: () => removeReading(r, b) } }))));
    }
  }

  paint();
}
