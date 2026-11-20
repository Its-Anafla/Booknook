// ALL data access lives in this file (Section 6 of the assignment).
// Every function is async and uses the same JSON shapes as seed.json, so in Delivery 2 only this
// module is rewritten to call the REST API (`fetch('/api/books')`, ...). Nothing else should change.
//
// Errors use the same structure the API will send:
//   { status: 400, message: 'Validation failed', errors: [{ field, message }] }
//   { status: 404 | 409, message: '...', errors: [] }

import { t } from './strings.js';
import { validateAuthor, validateBook, validateReading } from './validation.js';
import { normalize, pluralize } from './utils.js';

const SEED_URL = 'data/seed.json';
const KEY_PREFIX = 'rt.';
const COLLECTIONS = ['countries', 'authors', 'themes', 'books', 'readings'];
const SEEDED_FLAG = `${KEY_PREFIX}seeded`;

export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/* ------------------------------------------------------------------ low level */

const read = (name) => JSON.parse(localStorage.getItem(KEY_PREFIX + name) ?? '[]');
const write = (name, list) => localStorage.setItem(KEY_PREFIX + name, JSON.stringify(list));
const nextId = (list) => list.reduce((max, item) => Math.max(max, item.id), 0) + 1;

let ready = null;

async function loadSeed() {
  const response = await fetch(SEED_URL);
  if (!response.ok) throw new Error(`Could not load ${SEED_URL} (${response.status})`);
  const seed = await response.json();
  for (const name of COLLECTIONS) write(name, seed[name] ?? []);
  localStorage.setItem(SEEDED_FLAG, '1');
}

/** First visit: copy seed.json into localStorage. Later visits never touch the seed again. */
function ensureReady() {
  if (!ready) {
    ready = (async () => {
      if (localStorage.getItem(SEEDED_FLAG) !== '1') await loadSeed();
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

function failValidation(errors) {
  throw new ApiError(400, t('err.validationFailed'), errors);
}

function findOrThrow(list, id, label) {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ApiError(404, `${label} ${id} not found`);
  return item;
}

/* ------------------------------------------------------------------ countries & themes */

export async function getCountries() {
  await ensureReady();
  return read('countries');
}

export async function getThemes() {
  await ensureReady();
  return read('themes');
}

export async function saveTheme(theme) {
  await ensureReady();
  const themes = read('themes');
  const name = String(theme.name ?? '').trim();
  if (!name) failValidation([{ field: 'name', message: t('err.theme.required') }]);
  if (themes.some((x) => x.id !== theme.id && normalize(x.name) === normalize(name))) {
    throw new ApiError(409, t('err.theme.exists', { name }));
  }
  if (theme.id) {
    const existing = findOrThrow(themes, theme.id, 'Theme');
    existing.name = name;
    write('themes', themes);
    return { ...existing };
  }
  const created = { id: nextId(themes), name };
  write('themes', [...themes, created]);
  return created;
}

/* ------------------------------------------------------------------ authors */

export async function getAuthors() {
  await ensureReady();
  return read('authors');
}

export async function saveAuthor(author) {
  await ensureReady();
  const authors = read('authors');
  const countries = read('countries');
  const name = String(author.name ?? '').trim();
  if (name && authors.some((a) => a.id !== author.id && normalize(a.name) === normalize(name))) {
    throw new ApiError(409, t('err.name.unique', { name }));
  }
  const errors = validateAuthor(author, { authors, countries });
  if (errors.length) failValidation(errors);

  const clean = {
    name: author.name.trim(),
    countryId: author.countryId ?? null,
    birthDate: author.birthDate || null,
    deathDate: author.deathDate || null,
  };
  if (author.id) {
    const existing = findOrThrow(authors, author.id, 'Author');
    Object.assign(existing, clean);
    write('authors', authors);
    return { ...existing };
  }
  const created = { id: nextId(authors), ...clean };
  write('authors', [...authors, created]);
  return created;
}

/** 409 when the author is linked to books, listing their titles. */
export async function deleteAuthor(id) {
  await ensureReady();
  const authors = read('authors');
  findOrThrow(authors, id, 'Author');
  const linked = read('books').filter((b) => b.authorIds.includes(id));
  if (linked.length) {
    throw new ApiError(409, t('err.author.linked', {
      count: pluralize(linked.length, 'book'),
      titles: linked.map((b) => b.title).join(', '),
    }));
  }
  write('authors', authors.filter((a) => a.id !== id));
}

/* ------------------------------------------------------------------ books */

export async function getBooks() {
  await ensureReady();
  return read('books');
}

export async function saveBook(book) {
  await ensureReady();
  const books = read('books');
  const ctx = { books, authors: read('authors'), themes: read('themes') };
  const errors = validateBook(book, ctx);
  if (errors.length) failValidation(errors);

  const clean = {
    title: book.title.trim(),
    authorIds: [...(book.authorIds ?? [])],
    publicationYear: book.publicationYear ?? null,
    form: book.form || null,
    mode: book.mode || null,
    content: book.content || null,
    themeIds: [...(book.themeIds ?? [])].sort((a, b) => a - b),
  };
  if (book.id) {
    const existing = findOrThrow(books, book.id, 'Book');
    Object.assign(existing, clean);
    write('books', books);
    return { ...existing };
  }
  const created = { id: nextId(books), ...clean };
  write('books', [...books, created]);
  return created;
}

/** Deleting a book also deletes its readings. Returns how many were removed. */
export async function deleteBook(id) {
  await ensureReady();
  const books = read('books');
  findOrThrow(books, id, 'Book');
  const readings = read('readings');
  const remaining = readings.filter((r) => r.bookId !== id);
  write('books', books.filter((b) => b.id !== id));
  write('readings', remaining);
  return { deletedReadings: readings.length - remaining.length };
}

/* ------------------------------------------------------------------ readings */

export async function getReadings() {
  await ensureReady();
  return read('readings');
}

export async function getReadingsByBook(bookId) {
  await ensureReady();
  return read('readings').filter((r) => r.bookId === bookId);
}

export async function saveReading(reading) {
  await ensureReady();
  const readings = read('readings');
  const book = read('books').find((b) => b.id === reading.bookId) ?? null;
  const errors = validateReading(reading, { book });
  if (errors.length) failValidation(errors);

  const clean = {
    bookId: reading.bookId,
    status: reading.status,
    yearRead: reading.yearRead ?? null,
    grade: reading.grade ?? null,
    recommendedBy: reading.recommendedBy?.trim() || null,
    priority: reading.priority || null,
    notes: reading.notes?.trim() || null,
  };
  // Optional extension (not in seed.json): month of reading, used by the monthly chart.
  if (reading.monthRead) clean.monthRead = reading.monthRead;

  if (reading.id) {
    const existing = findOrThrow(readings, reading.id, 'Reading');
    delete existing.monthRead;
    Object.assign(existing, clean);
    write('readings', readings);
    return { ...existing };
  }
  const created = { id: nextId(readings), ...clean };
  write('readings', [...readings, created]);
  return created;
}

export async function deleteReading(id) {
  await ensureReady();
  const readings = read('readings');
  findOrThrow(readings, id, 'Reading');
  write('readings', readings.filter((r) => r.id !== id));
}

/* ------------------------------------------------------------------ everything at once & reset */

/** Convenience for views that need the whole picture. Built only from the public async functions above. */
export async function loadAll() {
  const [countries, authors, themes, books, readings] = await Promise.all([
    getCountries(), getAuthors(), getThemes(), getBooks(), getReadings(),
  ]);
  return { countries, authors, themes, books, readings };
}

/** FR-07: wipe our localStorage keys and load seed.json again (IDs start from 1 again). */
export async function resetData() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(KEY_PREFIX)) localStorage.removeItem(key);
  }
  ready = null;
  await ensureReady();
}
