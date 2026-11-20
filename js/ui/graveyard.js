// The graveyard: a dark shelf (with cobwebs) for books whose latest reading is Abandoned.

import { h, clear, pluralize, hashString } from '../utils.js';
import { t } from '../strings.js';
import { loadAll } from '../store.js';
import { buildContext, authorLine, latestReading, isBuried } from '../model.js';
import { cobwebSvg } from '../decor.js';
import { renderBook, COVER_SIZE } from './bookView.js';
import { paintRows } from './shelfRows.js';
import { pageHeader, emptyState } from './page.js';
import { openBookDetail } from './bookDetail.js';
import { formatGrade } from '../utils.js';

export async function renderGraveyard(root) {
  const ctx = buildContext(await loadAll());
  const buried = ctx.books.filter((b) => isBuried(b, ctx))
    .map((book) => ({ book, reading: latestReading(book, ctx) }))
    .sort((a, b) => b.reading.id - a.reading.id);

  root.append(pageHeader({ title: t('grave.title'), subtitle: h('p', { class: 'page-sub' }, `${pluralize(buried.length, 'book')} ${t('grave.resting')}`) }));

  if (!buried.length) {
    root.append(emptyState({ title: t('grave.empty.title'), message: t('grave.empty.message'), mood: 'grave' }));
    return;
  }

  const rowsEl = h('div', { class: 'shelf-rows' });
  const crypt = h('section', { class: 'shelf-case shelf-case--crypt', 'aria-label': t('grave.label') },
    h('div', { class: 'crypt-web crypt-web--l', html: cobwebSvg(240), 'aria-hidden': 'true' }),
    h('div', { class: 'crypt-web crypt-web--r', html: cobwebSvg(240), 'aria-hidden': 'true' }),
    rowsEl);
  root.append(crypt);

  const entries = () => buried.map(({ book, reading }) => {
    const element = renderBook(book, { mode: 'covers', status: null, authors: authorLine(book, ctx) });
    element.style.setProperty('--tilt', `${((hashString(book.title) % 7) - 3) * 0.9}deg`);
    const meta = [reading.yearRead ? String(reading.yearRead) : null, reading.grade !== null && reading.grade !== undefined ? t('reading.gradeValue', { grade: formatGrade(reading.grade) }) : null].filter(Boolean).join('  |  ');
    const wrapper = h('div', { class: 'shelf-item relic' },
      element,
      h('p', { class: 'epitaph' }, reading.notes ? `“${reading.notes}”` : t('grave.noEpitaph')),
      meta ? h('p', { class: 'relic-meta' }, meta) : null);
    element.classList.remove('shelf-item');
    return { element: wrapper, width: COVER_SIZE.width + 14 };
  });

  const paint = () => paintRows(rowsEl, entries(), { gap: 26 });
  rowsEl.addEventListener('click', (event) => {
    const book = event.target.closest('.book');
    if (book) openBookDetail(Number(book.dataset.bookId));
  });
  const observer = new ResizeObserver(() => paint());
  observer.observe(crypt);
  paint();
  return () => observer.disconnect();
}
