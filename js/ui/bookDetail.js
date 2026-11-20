// Book details: info, themes and every reading of the book, with add / edit / delete.

import { h, formatYear, formatGrade, pluralize } from '../utils.js';
import { t, MONTHS } from '../strings.js';
import { loadAll } from '../store.js';
import { buildContext, authorLine, themeNames, readingsOf, DATA_CHANGED } from '../model.js';
import { getBookStyle } from '../prefs.js';
import { renderBook } from './bookView.js';
import { openDialog, dialogFooter, button } from './modal.js';
import { openBookForm } from './bookForm.js';
import { openReadingForm } from './readingForm.js';
import { removeBook, removeReading, startReading, resumeReading } from './actions.js';
import { icon } from '../icons.js';

export async function openBookDetail(bookId) {
  const body = h('div', { class: 'detail' });
  const footer = dialogFooter();
  const dlg = openDialog({ title: '', size: 'lg', body, footer, className: 'dialog--detail' });

  const repaint = () => paint().catch(console.error);
  document.addEventListener(DATA_CHANGED, repaint);
  dlg.dialog.addEventListener('close', () => document.removeEventListener(DATA_CHANGED, repaint));

  async function paint() {
    const ctx = buildContext(await loadAll());
    const book = ctx.booksById.get(bookId);
    if (!book) { dlg.close(); return; }
    const authors = authorLine(book, ctx);
    const style = getBookStyle(book.id);
    const readings = [...readingsOf(book, ctx)].sort((a, b) => b.id - a.id);
    dlg.setTitle(book.title);

    const facts = [
      authors ? [t('book.authors'), authors] : [t('book.authors'), h('span', { class: 'muted' }, t('book.noAuthors'))],
      [t('book.year'), formatYear(book.publicationYear)],
      [t('book.form'), book.form ?? '-'],
      [t('book.mode'), book.mode ?? '-'],
      [t('book.content'), book.content ?? '-'],
      style.collection ? [t('edition.collectionName'), style.collection] : null,
    ].filter(Boolean);

    const themes = themeNames(book, ctx);
    body.replaceChildren(
      h('div', { class: 'detail-top' },
        h('div', { class: 'detail-cover' }, renderBook(book, { mode: 'covers', tag: 'div', authors })),
        h('div', { class: 'detail-info' },
          h('dl', { class: 'facts' }, ...facts.flatMap(([label, value]) => [h('dt', {}, label), h('dd', {}, value)])),
          themes.length ? h('ul', { class: 'pill-list', 'aria-label': t('book.themes') }, ...themes.map((name) => h('li', { class: 'pill pill--static' }, name))) : h('p', { class: 'muted' }, t('book.noThemes')))),
      h('section', { class: 'detail-readings', 'aria-labelledby': 'detail-readings-title' },
        h('div', { class: 'section-head' },
          h('h3', { id: 'detail-readings-title' }, t('reading.heading', { count: pluralize(readings.length, 'reading') })),
          button(t('reading.add'), { variant: 'secondary', iconName: 'plus', onClick: () => openReadingForm({ book }) })),
        readings.length
          ? h('ul', { class: 'reading-list' }, ...readings.map((reading) => readingItem(reading, book)))
          : h('p', { class: 'muted' }, t('reading.none.message'))));

    footer.replaceChildren(
      button(t('book.delete'), { variant: 'danger-ghost', iconName: 'trash', onClick: async () => { if (await removeBook(book)) dlg.close(); } }),
      h('span', { class: 'spacer' }),
      button(t('book.editShort'), { variant: 'primary', iconName: 'edit', onClick: () => openBookForm({ book }) }));
  }

  function readingItem(reading, book) {
    const when = reading.yearRead !== null && reading.yearRead !== undefined
      ? `${reading.monthRead ? `${MONTHS[reading.monthRead - 1]} ` : ''}${reading.yearRead}` : null;
    const meta = [
      when,
      reading.grade !== null && reading.grade !== undefined ? t('reading.gradeValue', { grade: formatGrade(reading.grade) }) : null,
      reading.priority ? t('reading.priorityValue', { priority: reading.priority }) : null,
      reading.recommendedBy ? t('reading.recommendedValue', { name: reading.recommendedBy }) : null,
    ].filter(Boolean);

    const actions = [];
    if (reading.status === 'Want to read') actions.push(button(t('reading.start'), { variant: 'ghost', iconName: 'play', onClick: () => startReading(reading) }));
    if (reading.status === 'Paused') actions.push(button(t('reading.resume'), { variant: 'ghost', iconName: 'play', onClick: () => resumeReading(reading, book) }));
    if (reading.status === 'Abandoned') actions.push(button(t('reading.giveChance'), { variant: 'ghost', iconName: 'play', onClick: () => resumeReading(reading, book) }));
    actions.push(
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('reading.edit'), title: t('reading.edit'), html: icon('edit', 18), on: { click: () => openReadingForm({ book, reading }) } }),
      h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': t('reading.deleteShort'), title: t('reading.deleteShort'), html: icon('trash', 18), on: { click: () => removeReading(reading, book) } }));

    return h('li', { class: 'reading-item' },
      h('div', { class: 'reading-main' },
        h('span', { class: `status status--${reading.status.toLowerCase().replace(/\s+/g, '-')}` }, reading.status),
        meta.length ? h('span', { class: 'reading-meta' }, meta.join('  |  ')) : null,
        reading.notes ? h('p', { class: 'reading-notes' }, reading.notes) : null),
      h('div', { class: 'reading-actions' }, ...actions));
  }

  await paint();
  return dlg;
}
