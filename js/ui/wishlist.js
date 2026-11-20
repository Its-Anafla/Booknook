// FR-09: readings with status "Want to read", ordered High > Medium > Low > Unset.

import { h, clear, pluralize } from '../utils.js';
import { t, PRIORITIES } from '../strings.js';
import { loadAll } from '../store.js';
import { buildContext, authorLine } from '../model.js';
import { icon } from '../icons.js';
import { renderBook } from './bookView.js';
import { button } from './modal.js';
import { pageHeader, emptyState } from './page.js';
import { openBookDetail } from './bookDetail.js';
import { openBookForm } from './bookForm.js';
import { openReadingForm } from './readingForm.js';
import { removeReading, startReading } from './actions.js';

const LEVELS = [...PRIORITIES, null];

export async function renderWishlist(root) {
  const ctx = buildContext(await loadAll());
  const wanted = ctx.readings.filter((r) => r.status === 'Want to read' && ctx.booksById.has(r.bookId));
  const rank = (r) => (r.priority ? PRIORITIES.indexOf(r.priority) : PRIORITIES.length);
  wanted.sort((a, b) => rank(a) - rank(b) || ctx.booksById.get(a.bookId).title.localeCompare(ctx.booksById.get(b.bookId).title, 'en', { sensitivity: 'base' }));

  root.append(pageHeader({
    title: t('wishlist.title'),
    subtitle: h('p', { class: 'page-sub' }, pluralize(wanted.length, 'book') + ` ${t('wishlist.waiting')}`),
    actions: [button(t('book.add'), { variant: 'primary', iconName: 'plus', onClick: () => openBookForm() })],
  }));

  if (!wanted.length) {
    root.append(emptyState({ title: t('wishlist.empty.title'), message: t('wishlist.empty.message'), mood: 'wishlist' }));
    return;
  }

  for (const level of LEVELS) {
    const group = wanted.filter((r) => (r.priority ?? null) === level);
    if (!group.length) continue;
    const name = level ?? t('priority.unset');
    root.append(h('section', { class: 'wish-group', 'aria-label': t('wishlist.group', { priority: name }) },
      h('h2', { class: 'wish-heading' }, h('span', { class: `priority priority--${(level ?? 'unset').toLowerCase()}` }, name), h('span', { class: 'muted' }, pluralize(group.length, 'book'))),
      h('ul', { class: 'wish-list' }, ...group.map((reading) => wishItem(reading)))));
  }

  function wishItem(reading) {
    const book = ctx.booksById.get(reading.bookId);
    const authors = authorLine(book, ctx);
    const cover = renderBook(book, { mode: 'covers', tag: 'div', authors, token: `w${reading.id}` });
    return h('li', { class: 'wish' },
      h('button', { type: 'button', class: 'wish-cover', 'aria-label': t('wishlist.open', { title: book.title }), on: { click: () => openBookDetail(book.id) } }, cover),
      h('div', { class: 'wish-info' },
        h('p', { class: 'wish-title' }, book.title),
        h('p', { class: 'wish-author' }, authors || t('book.noAuthors')),
        h('p', { class: 'wish-rec' }, reading.recommendedBy ? t('wishlist.recommendedBy', { name: reading.recommendedBy }) : t('wishlist.noRecommendation')),
        reading.notes ? h('p', { class: 'wish-notes' }, reading.notes) : null),
      h('div', { class: 'wish-actions' },
        button(t('reading.start'), { variant: 'secondary', iconName: 'play', onClick: () => startReading(reading) }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('reading.edit'), title: t('reading.edit'), html: icon('edit', 18), on: { click: () => openReadingForm({ book, reading }) } }),
        h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': t('reading.deleteShort'), title: t('reading.deleteShort'), html: icon('trash', 18), on: { click: () => removeReading(reading, book) } })));
  }
}
