// FR-08: combined filters + partial, case-insensitive text search.
// One shared state, so the shelf and the reading log filter the same way.

import { h, normalize, debounce, sortByName } from '../utils.js';
import { t, STATUSES, FORMS } from '../strings.js';
import { icon } from '../icons.js';
import { field, select } from './formKit.js';
import { searchHaystack, readingsOf } from '../model.js';

export const filterState = { text: '', status: '', year: '', author: '', form: '', theme: '' };

const SELECT_KEYS = ['status', 'year', 'author', 'form', 'theme'];

export const activeFilterCount = () => SELECT_KEYS.filter((key) => filterState[key] !== '').length;
export const hasActiveFilters = () => activeFilterCount() > 0 || filterState.text.trim() !== '';
const hasReadingFilters = () => filterState.status !== '' || filterState.year !== '';

export function resetFilters() {
  for (const key of ['text', ...SELECT_KEYS]) filterState[key] = '';
}

/** Book-level criteria: text, author, form, theme. */
export function bookMatches(book, ctx) {
  const text = normalize(filterState.text);
  if (text && !searchHaystack(book, ctx).includes(text)) return false;
  if (filterState.author && !book.authorIds.includes(Number(filterState.author))) return false;
  if (filterState.form && book.form !== filterState.form) return false;
  if (filterState.theme && !book.themeIds.includes(Number(filterState.theme))) return false;
  return true;
}

/** Reading-level criteria: status and year read. */
export function readingMatches(reading) {
  if (filterState.status && reading.status !== filterState.status) return false;
  if (filterState.year) {
    if (filterState.year === 'none') return reading.yearRead === null || reading.yearRead === undefined;
    if (reading.yearRead !== Number(filterState.year)) return false;
  }
  return true;
}

export function readingPassesFilters(reading, ctx) {
  const book = ctx.booksById.get(reading.bookId);
  return !!book && bookMatches(book, ctx) && readingMatches(reading);
}

/** A book passes if its own fields match and, when status/year filters are on, one of its readings does. */
export function bookPassesFilters(book, ctx) {
  if (!bookMatches(book, ctx)) return false;
  if (!hasReadingFilters()) return true;
  return readingsOf(book, ctx).some(readingMatches);
}

export { hasReadingFilters };

export function createFilterBar({ ctx, onChange, extra = null }) {
  const notify = () => onChange();

  const searchInput = h('input', {
    type: 'search', name: 'q', value: filterState.text, placeholder: t('filters.searchPlaceholder'),
    'aria-label': t('filters.search'), autocomplete: 'off', spellcheck: 'false',
  });
  searchInput.addEventListener('input', debounce(() => { filterState.text = searchInput.value; notify(); }, 120));

  const years = [...new Set(ctx.readings.map((r) => r.yearRead).filter((y) => y !== null && y !== undefined))].sort((a, b) => b - a);
  const themeList = sortByName(ctx.themes);
  const controls = {
    status: select('status', STATUSES, { placeholder: t('filters.any'), value: filterState.status }),
    year: select('year', [...years.map((y) => [y, String(y)]), ['none', t('filters.noYear')]], { placeholder: t('filters.any'), value: filterState.year }),
    author: select('author', sortByName(ctx.authors).map((a) => [a.id, a.name]), { placeholder: t('filters.any'), value: filterState.author }),
    form: select('form', FORMS, { placeholder: t('filters.any'), value: filterState.form }),
    theme: select('theme', themeList.map((x) => [x.id, x.name]), { placeholder: t('filters.any'), value: filterState.theme }),
  };
  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener('change', () => { filterState[key] = control.value; refreshBadge(); notify(); });
  }

  const badge = h('span', { class: 'badge' });
  const toggle = h('button', { type: 'button', class: 'btn btn--ghost', 'aria-expanded': 'false' },
    h('span', { class: 'btn-icon', html: icon('filter', 18) }), t('filters.title'), badge);
  const clearButton = h('button', { type: 'button', class: 'btn btn--ghost btn--small' }, t('filters.clear'));

  const panel = h('div', { class: 'filter-panel', id: 'filter-panel', hidden: activeFilterCount() === 0 },
    field({ name: 'status', label: t('filters.status'), control: controls.status }),
    field({ name: 'year', label: t('filters.year'), control: controls.year }),
    field({ name: 'author', label: t('filters.author'), control: controls.author }),
    field({ name: 'form', label: t('filters.form'), control: controls.form }),
    field({ name: 'theme', label: t('filters.theme'), control: controls.theme }),
    h('div', { class: 'filter-actions' }, clearButton));
  toggle.setAttribute('aria-controls', 'filter-panel');

  function refreshBadge() {
    const count = activeFilterCount();
    badge.textContent = count ? String(count) : '';
    badge.hidden = !count;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  }

  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; refreshBadge(); });
  clearButton.addEventListener('click', () => {
    resetFilters();
    searchInput.value = '';
    for (const control of Object.values(controls)) control.value = '';
    refreshBadge();
    notify();
  });
  refreshBadge();

  const bar = h('div', { class: 'filterbar' },
    h('div', { class: 'filterbar-row' },
      h('label', { class: 'search' }, h('span', { class: 'search-icon', html: icon('search', 18) }), searchInput),
      toggle,
      extra),
    panel);
  return bar;
}
