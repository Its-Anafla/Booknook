// The reading fields (status, year, month, grade, priority, recommended by, notes),
// shared by the "add reading" dialog and the optional first reading in the book form.
// Implements the status rules of FR-04 in the interface.

import { h, parseIntStrict, parseDecimal } from '../utils.js';
import { t, STATUSES, PRIORITIES, MONTHS } from '../strings.js';
import { rules } from '../validation.js';
import { field, select, showErrors, clearErrors } from './formKit.js';
import { confirmDialog } from './modal.js';
import { askEpitaph } from './bury.js';

let groupCounter = 0;

/**
 * @param reading     existing reading (edit) or null
 * @param allowNone   adds a "Not yet" choice, used by the first-reading section of the book form
 * @param bookTitle   used in the epitaph dialog
 */
export function createReadingFields({ reading = null, allowNone = false, bookTitle = () => '' } = {}) {
  const groupName = `status-${++groupCounter}`;
  const initialStatus = reading?.status ?? '';
  let previous = initialStatus;

  /* ---- status pills */
  const statusGroup = h('div', { class: 'pill-group', role: 'radiogroup', 'aria-label': t('reading.status') });
  const radios = new Map();
  const choices = allowNone ? [['', t('reading.none')], ...STATUSES.map((s) => [s, s])] : STATUSES.map((s) => [s, s]);
  for (const [value, label] of choices) {
    const input = h('input', { type: 'radio', name: groupName, value, checked: value === initialStatus });
    radios.set(value, input);
    statusGroup.append(h('label', { class: 'pill pill--choice' }, input, h('span', {}, label)));
  }
  const statusField = h('div', { class: 'field', dataset: { field: 'status' } },
    h('span', { class: 'field-label', id: `${groupName}-label` }, t('reading.status')),
    statusGroup,
    h('p', { class: 'error', role: 'alert' }));
  statusGroup.setAttribute('aria-labelledby', `${groupName}-label`);

  /* ---- other fields */
  const year = h('input', { type: 'text', name: 'yearRead', inputmode: 'numeric', autocomplete: 'off', value: reading?.yearRead ?? '' });
  const month = select('monthRead', MONTHS.map((name, i) => [i + 1, name]), { placeholder: t('common.notSet'), value: reading?.monthRead ?? '' });
  const grade = h('input', { type: 'text', name: 'grade', inputmode: 'decimal', autocomplete: 'off', placeholder: '0.0 - 10.0', value: reading?.grade ?? '' });
  const priority = select('priority', PRIORITIES, { placeholder: t('priority.unset'), value: reading?.priority ?? '' });
  const recommendedBy = h('input', { type: 'text', name: 'recommendedBy', autocomplete: 'off', maxlength: 120, value: reading?.recommendedBy ?? '' });
  const notes = h('textarea', { name: 'notes', rows: 3, maxlength: 2000 });
  notes.value = reading?.notes ?? '';

  const body = h('div', { class: 'reading-body' },
    h('div', { class: 'field-grid' },
      field({ name: 'yearRead', label: t('reading.year'), control: year, hint: t('reading.yearHint') }),
      field({ name: 'monthRead', label: t('reading.month'), control: month }),
      field({ name: 'grade', label: t('reading.grade'), control: grade, hint: t('reading.gradeHint') }),
      field({ name: 'priority', label: t('reading.priority'), control: priority }),
      field({ name: 'recommendedBy', label: t('reading.recommendedBy'), control: recommendedBy, className: 'field--span' })),
    field({ name: 'notes', label: t('reading.notes'), control: notes }));

  const root = h('div', { class: 'reading-fields', dataset: { status: initialStatus } }, statusField, body);

  /* ---- enabling fields according to the status */
  function applyStatus(status) {
    root.dataset.status = status;
    const toggle = (control, allowed) => {
      control.disabled = !allowed;
      control.closest('.field').classList.toggle('is-off', !allowed);
    };
    toggle(year, rules.allowsYearRead(status));
    toggle(month, rules.allowsMonthRead(status));
    toggle(grade, rules.allowsGrade(status));
    toggle(priority, rules.allowsPriority(status));
    const label = year.closest('.field').querySelector('label');
    label.querySelector('.req')?.remove();
    if (status === 'Read') label.append(h('span', { class: 'req', 'aria-hidden': 'true' }, ' *'));
  }

  function clearDisallowed(status) {
    if (!rules.allowsYearRead(status)) year.value = '';
    if (!rules.allowsMonthRead(status)) month.value = '';
    if (!rules.allowsGrade(status)) grade.value = '';
    if (!rules.allowsPriority(status)) priority.value = '';
  }

  // FR-04: moving to a status that can't hold a year or grade clears them, after the person confirms.
  async function handleStatusChange(next) {
    const losing = [];
    if (!rules.allowsYearRead(next) && year.value.trim()) losing.push(t('reading.year'));
    if (!rules.allowsMonthRead(next) && month.value) losing.push(t('reading.month'));
    if (!rules.allowsGrade(next) && grade.value.trim()) losing.push(t('reading.grade'));

    if (losing.length) {
      const ok = await confirmDialog({
        title: t('reading.clearTitle'),
        message: t('reading.clearMessage', { status: next || t('reading.none'), fields: losing.join(', ') }),
        confirmLabel: t('reading.clearConfirm'),
        tone: 'danger',
      });
      if (!ok) {
        radios.get(previous).checked = true;
        return;
      }
    }
    clearDisallowed(next);
    previous = next;
    applyStatus(next);

    // Abandoning a book opens the optional epitaph dialog; the text goes into the notes.
    if (next === 'Abandoned' && initialStatus !== 'Abandoned') {
      const epitaph = await askEpitaph({ title: bookTitle(), current: notes.value });
      if (epitaph !== null) notes.value = epitaph;
    }
  }

  for (const [value, input] of radios) input.addEventListener('change', () => handleStatusChange(value));
  applyStatus(initialStatus);

  return {
    el: root,
    getStatus: () => [...radios].find(([, input]) => input.checked)?.[0] ?? '',
    hasStatus() { return this.getStatus() !== ''; },
    /** True when this save sends the book to the graveyard. */
    becameAbandoned() { return this.getStatus() === 'Abandoned' && initialStatus !== 'Abandoned'; },
    /** Raw values: invalid typing becomes NaN so validation can reject it. */
    getValue() {
      const status = this.getStatus();
      return {
        status,
        yearRead: parseIntStrict(year.value),
        monthRead: month.value ? Number(month.value) : null,
        grade: parseDecimal(grade.value),
        recommendedBy: recommendedBy.value.trim() || null,
        priority: priority.value || null,
        notes: notes.value.trim() || null,
      };
    },
    showErrors: (errors, options) => showErrors(root, errors, options),
    clearErrors: () => clearErrors(root),
  };
}
