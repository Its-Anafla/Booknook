// Dialog to add or edit one reading of a book (FR-03, FR-04, FR-06).

import { h, $ } from '../utils.js';
import { t } from '../strings.js';
import { ApiError, saveReading } from '../store.js';
import { validateReading } from '../validation.js';
import { notifyChange } from '../model.js';
import { openDialog, dialogFooter, button } from './modal.js';
import { showErrors, clearErrors } from './formKit.js';
import { createReadingFields } from './readingFields.js';
import { toast } from './toast.js';
import { buryBook } from './actions.js';

export function openReadingForm({ book, reading = null, presetStatus = null }) {
  const editing = !!reading;
  const fields = createReadingFields({
    reading: reading ?? (presetStatus ? { status: presetStatus } : null),
    bookTitle: () => book.title,
  });
  const generalError = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { id: 'reading-form', novalidate: true, class: 'form' }, generalError, fields.el);

  const save = button(t('common.save'), { variant: 'primary', type: 'submit', form: 'reading-form' });
  const dlg = openDialog({
    title: editing ? t('reading.edit') : t('reading.add'),
    body: [h('p', { class: 'dialog-context' }, book.title), form],
    footer: dialogFooter(button(t('common.cancel'), { onClick: () => dlg.close() }), save),
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    if (!fields.hasStatus()) {
      showErrors(form, [{ field: 'status', message: t('err.status.required') }]);
      return;
    }
    const payload = { ...(editing ? { id: reading.id } : {}), bookId: book.id, ...fields.getValue() };
    const errors = validateReading(payload, { book });
    if (errors.length) { showErrors(form, errors); return; }

    try {
      await saveReading(payload);
      const buried = fields.becameAbandoned();
      dlg.close();
      notifyChange();
      if (buried) await buryBook(book.id);
      else toast(t('common.saved'));
    } catch (error) {
      if (error instanceof ApiError) showErrors(form, error.errors.length ? error.errors : [{ field: '', message: error.message }]);
      else { console.error(error); generalError.textContent = t('err.unexpected'); }
    }
  });

  $('input[type="radio"]:checked, input[type="radio"]', form)?.focus();
  return dlg;
}
