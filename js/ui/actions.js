// Actions that touch data and then tell the interface to repaint (shared by several views).

import { h } from '../utils.js';
import { t } from '../strings.js';
import { ApiError, deleteBook, deleteReading, saveReading, getBooks, getAuthors, getReadingsByBook } from '../store.js';
import { notifyChange } from '../model.js';
import { forgetBook } from '../prefs.js';
import { confirmDialog, alertDialog } from './modal.js';
import { toast } from './toast.js';
import { playBurial } from './bury.js';

export async function reportError(error) {
  if (error instanceof ApiError) {
    await alertDialog({ title: t('err.cantDo'), message: error.errors.length ? error.errors.map((e) => e.message).join(' ') : error.message });
  } else {
    console.error(error);
    await alertDialog({ title: t('err.cantDo'), message: t('err.unexpected') });
  }
}

export async function removeReading(reading, book) {
  const ok = await confirmDialog({
    title: t('reading.deleteTitle'),
    message: t('reading.deleteMessage', { title: book.title, status: reading.status }),
    confirmLabel: t('common.delete'),
    tone: 'danger',
  });
  if (!ok) return false;
  try {
    await deleteReading(reading.id);
    toast(t('common.deleted'));
    notifyChange();
    return true;
  } catch (error) {
    await reportError(error);
    return false;
  }
}

/** FR-03: deleting a book also deletes its readings, and the confirmation says how many. */
export async function removeBook(book) {
  const count = (await getReadingsByBook(book.id)).length;
  const ok = await confirmDialog({
    title: t('book.deleteTitle'),
    message: t('book.deleteMessage', { title: book.title }),
    details: h('p', { class: 'dialog-note' }, count === 0 ? t('book.deleteNoReadings') : t('book.deleteReadings', { count })),
    confirmLabel: t('book.deleteConfirm'),
    tone: 'danger',
  });
  if (!ok) return false;
  try {
    await deleteBook(book.id);
    forgetBook(book.id);
    toast(t('common.deleted'));
    notifyChange();
    return true;
  } catch (error) {
    await reportError(error);
    return false;
  }
}

/** Wishlist -> Reading in one click. Priority is cleared, recommendation and notes stay. */
export async function startReading(reading) {
  try {
    await saveReading({ ...reading, status: 'Reading', priority: null });
    toast(t('reading.started'));
    notifyChange();
  } catch (error) {
    await reportError(error);
  }
}

/** Paused / Abandoned -> Reading again. Year and grade are cleared after confirmation (FR-04). */
export async function resumeReading(reading, book) {
  const losing = [];
  if (reading.yearRead !== null && reading.yearRead !== undefined) losing.push(t('reading.year'));
  if (reading.grade !== null && reading.grade !== undefined) losing.push(t('reading.grade'));
  if (losing.length) {
    const ok = await confirmDialog({
      title: t('reading.clearTitle'),
      message: t('reading.clearMessage', { status: 'Reading', fields: losing.join(', ') }),
      confirmLabel: t('reading.clearConfirm'),
      tone: 'danger',
    });
    if (!ok) return;
  }
  try {
    await saveReading({ ...reading, status: 'Reading', yearRead: null, monthRead: null, grade: null, priority: null });
    toast(t('reading.resumed', { title: book.title }));
    notifyChange();
  } catch (error) {
    await reportError(error);
  }
}

/** Plays the farewell animation and opens the graveyard. */
export async function buryBook(bookId) {
  const [books, authors] = await Promise.all([getBooks(), getAuthors()]);
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  const names = book.authorIds.map((id) => authors.find((a) => a.id === id)?.name).filter(Boolean).join(', ');
  for (const dialog of document.querySelectorAll('dialog.dialog')) dialog.close();
  await playBurial(book, names);
  window.location.hash = '#/graveyard';
  notifyChange();
}
