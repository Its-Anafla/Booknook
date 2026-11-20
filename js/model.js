// Derived data helpers shared by the views (lookups, labels, "which reading counts for a book").

import { normalize, formatYear, sortByName } from './utils.js';

export const DATA_CHANGED = 'data-changed';

/** Call after any create / update / delete so open views repaint. */
export function notifyChange() {
  document.dispatchEvent(new CustomEvent(DATA_CHANGED));
}

export const indexById = (list) => new Map(list.map((item) => [item.id, item]));

export function buildContext({ countries, authors, themes, books, readings }) {
  const readingsByBook = new Map();
  for (const reading of readings) {
    if (!readingsByBook.has(reading.bookId)) readingsByBook.set(reading.bookId, []);
    readingsByBook.get(reading.bookId).push(reading);
  }
  return {
    countries, authors, themes, books, readings,
    countriesById: indexById(countries),
    authorsById: indexById(authors),
    themesById: indexById(themes),
    booksById: indexById(books),
    readingsByBook,
  };
}

export const authorNames = (book, ctx) =>
  book.authorIds.map((id) => ctx.authorsById.get(id)?.name).filter(Boolean);

export const authorLine = (book, ctx) => {
  const names = authorNames(book, ctx);
  return names.length ? names.join(', ') : '';
};

export const themeNames = (book, ctx) =>
  sortByName(book.themeIds.map((id) => ctx.themesById.get(id)).filter(Boolean)).map((x) => x.name);

export const readingsOf = (book, ctx) => ctx.readingsByBook.get(book.id) ?? [];

/** The most recently added reading decides how a book is shown (badge on the shelf). */
export function latestReading(book, ctx) {
  const list = readingsOf(book, ctx);
  return list.length ? list.reduce((a, b) => (b.id > a.id ? b : a)) : null;
}

const SHELF_STATUSES = ['Reading', 'Paused', 'Read'];

/** On the main shelf: books with no readings yet, or at least one Reading / Paused / Read. */
export function belongsOnShelf(book, ctx) {
  const list = readingsOf(book, ctx);
  return list.length === 0 || list.some((r) => SHELF_STATUSES.includes(r.status));
}

/** In the graveyard: books whose latest reading is Abandoned. */
export function isBuried(book, ctx) {
  return latestReading(book, ctx)?.status === 'Abandoned';
}

export function describeBook(book, ctx) {
  const authors = authorLine(book, ctx);
  const year = book.publicationYear !== null && book.publicationYear !== undefined ? `, ${formatYear(book.publicationYear)}` : '';
  return `${book.title}${authors ? ` by ${authors}` : ''}${year}`;
}

export const searchHaystack = (book, ctx) => normalize(`${book.title} ${authorNames(book, ctx).join(' ')}`);
