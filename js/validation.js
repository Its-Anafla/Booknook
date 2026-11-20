// Pure validation rules from Section 4 of the assignment.
// Used twice on purpose: the forms call these for instant feedback, and store.js calls them
// again before saving (that is the job the server does in Delivery 2).
// Every function returns a list of { field, message }. Empty list = valid.

import { t, STATUSES, PRIORITIES, FORMS, MODES, CONTENTS } from './strings.js';
import { normalize, todayISO, currentYear, currentMonth, isHexColor } from './utils.js';

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
const err = (field, key, vars) => ({ field, message: t(key, vars) });

const GRADE_STATUSES = ['Read', 'Abandoned'];
const YEAR_STATUSES = ['Read', 'Abandoned'];

export const rules = {
  allowsYearRead: (status) => YEAR_STATUSES.includes(status),
  allowsMonthRead: (status) => status === 'Read',
  allowsGrade: (status) => GRADE_STATUSES.includes(status),
  allowsPriority: (status) => status === 'Want to read',
};

function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function validateAuthor(author, { authors = [], countries = [] } = {}) {
  const errors = [];
  const name = String(author.name ?? '').trim();

  if (!name) errors.push(err('name', 'err.name.required'));
  else if (authors.some((a) => a.id !== author.id && normalize(a.name) === normalize(name))) {
    errors.push(err('name', 'err.name.unique', { name }));
  }

  if (!isBlank(author.countryId) && !countries.some((c) => c.id === Number(author.countryId))) {
    errors.push(err('countryId', 'err.country.unknown'));
  }

  const birthOk = isBlank(author.birthDate) || isRealDate(author.birthDate);
  const deathOk = isBlank(author.deathDate) || isRealDate(author.deathDate);
  if (!birthOk) errors.push(err('birthDate', 'err.date.invalid'));
  if (!deathOk) errors.push(err('deathDate', 'err.date.invalid'));
  if (birthOk && !isBlank(author.birthDate) && author.birthDate > todayISO()) {
    errors.push(err('birthDate', 'err.birth.future'));
  }
  if (birthOk && deathOk && !isBlank(author.birthDate) && !isBlank(author.deathDate) && author.deathDate <= author.birthDate) {
    errors.push(err('deathDate', 'err.death.before'));
  }
  return errors;
}

export function validateBook(book, { books = [], authors = [], themes = [] } = {}) {
  const errors = [];
  const title = String(book.title ?? '').trim();

  if (!title) errors.push(err('title', 'err.title.required'));
  else {
    const original = books.find((b) => b.id === book.id);
    const titleChanged = !original || normalize(original.title) !== normalize(title);
    // Unique title is only enforced when the title is new or edited, so a seed book that
    // already shares a title with another one can still have its other fields edited.
    if (titleChanged && books.some((b) => b.id !== book.id && normalize(b.title) === normalize(title))) {
      errors.push(err('title', 'err.title.unique', { title }));
    }
  }

  const year = book.publicationYear;
  if (!isBlank(year)) {
    if (!Number.isInteger(year)) errors.push(err('publicationYear', 'err.year.integer'));
    else if (year === 0) errors.push(err('publicationYear', 'err.year.zero'));
    else if (year > currentYear()) errors.push(err('publicationYear', 'err.year.future'));
  }

  const checkList = (field, value, list) => {
    if (!isBlank(value) && !list.includes(value)) errors.push(err(field, 'err.list'));
  };
  checkList('form', book.form, FORMS);
  checkList('mode', book.mode, MODES);
  checkList('content', book.content, CONTENTS);

  if ((book.authorIds ?? []).some((id) => !authors.some((a) => a.id === id))) {
    errors.push(err('authorIds', 'err.author.unknown'));
  }
  if ((book.themeIds ?? []).some((id) => !themes.some((x) => x.id === id))) {
    errors.push(err('themeIds', 'err.theme.unknown'));
  }
  if (new Set(book.themeIds ?? []).size !== (book.themeIds ?? []).length) {
    errors.push(err('themeIds', 'err.theme.duplicate'));
  }
  return errors;
}

/** `book` is the book this reading belongs to (needed for the "not before publication" rule). */
export function validateReading(reading, { book = null } = {}) {
  const errors = [];
  const { status } = reading;

  if (!book) errors.push(err('bookId', 'err.reading.book'));
  if (!STATUSES.includes(status)) {
    errors.push(err('status', 'err.status.invalid'));
    return errors;
  }

  // Year read
  const year = reading.yearRead;
  if (isBlank(year)) {
    if (status === 'Read') errors.push(err('yearRead', 'err.yearRead.required'));
  } else if (!rules.allowsYearRead(status)) {
    errors.push(err('yearRead', 'err.yearRead.notAllowed'));
  } else if (!Number.isInteger(year) || year === 0) {
    errors.push(err('yearRead', 'err.yearRead.integer'));
  } else if (year > currentYear()) {
    errors.push(err('yearRead', 'err.yearRead.future'));
  } else if (book && Number.isInteger(book.publicationYear) && year < book.publicationYear) {
    errors.push(err('yearRead', 'err.yearRead.before', { year: book.publicationYear < 0 ? `${-book.publicationYear} BC` : book.publicationYear }));
  }

  // Month read (optional extension used by the monthly chart)
  const month = reading.monthRead;
  if (!isBlank(month)) {
    if (!rules.allowsMonthRead(status)) errors.push(err('monthRead', 'err.month.notAllowed'));
    else if (!Number.isInteger(month) || month < 1 || month > 12) errors.push(err('monthRead', 'err.month.range'));
    else if (isBlank(year)) errors.push(err('monthRead', 'err.month.needsYear'));
    else if (year === currentYear() && month > currentMonth()) errors.push(err('monthRead', 'err.month.future'));
  }

  // Grade
  const grade = reading.grade;
  if (!isBlank(grade)) {
    if (!rules.allowsGrade(status)) errors.push(err('grade', 'err.grade.notAllowed'));
    else if (typeof grade !== 'number' || Number.isNaN(grade) || grade < 0 || grade > 10 || (grade * 2) % 1 !== 0) {
      errors.push(err('grade', 'err.grade.range'));
    }
  }

  // Priority
  if (!isBlank(reading.priority)) {
    if (!rules.allowsPriority(status)) errors.push(err('priority', 'err.priority.notAllowed'));
    else if (!PRIORITIES.includes(reading.priority)) errors.push(err('priority', 'err.priority.invalid'));
  }
  return errors;
}

/** Presentation-only extras that live outside seed.json (cover link, spine color). */
export function validateExtras({ coverUrl, color }) {
  const errors = [];
  if (!isBlank(coverUrl)) {
    try {
      const url = new URL(String(coverUrl).trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      errors.push(err('coverUrl', 'err.cover.url'));
    }
  }
  if (!isBlank(color) && !isHexColor(color)) errors.push(err('color', 'err.color.hex'));
  return errors;
}
