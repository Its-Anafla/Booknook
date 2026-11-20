// Form building blocks: labeled fields, per-field error messages, color picker pair.

import { h, $, $$, isHexColor, expandHex } from '../utils.js';
import { t } from '../strings.js';

let fieldCounter = 0;

/** A labeled field wrapper. `data-field` matches the field names used by the validators and the API errors. */
export function field({ name, label, control, hint = null, required = false, className = '' }) {
  const id = `field-${name}-${++fieldCounter}`;
  control.id = control.id || id;
  const hintId = hint ? `${control.id}-hint` : null;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return h(
    'div',
    { class: `field ${className}`.trim(), dataset: { field: name } },
    h('label', { for: control.id }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    control,
    hint ? h('p', { class: 'hint', id: hintId }, hint) : null,
    h('p', { class: 'error', role: 'alert' }),
  );
}

export function fieldset(legend, { name = null, className = '', hint = null } = {}, ...children) {
  return h(
    'fieldset',
    { class: `fieldset ${className}`.trim(), dataset: name ? { field: name } : {} },
    h('legend', {}, legend),
    hint ? h('p', { class: 'hint' }, hint) : null,
    ...children,
    h('p', { class: 'error', role: 'alert' }),
  );
}

export function select(name, options, { value = '', placeholder = null } = {}) {
  const node = h('select', { name });
  if (placeholder !== null) node.append(h('option', { value: '' }, placeholder));
  for (const option of options) {
    const [val, label] = Array.isArray(option) ? option : [option, option];
    node.append(h('option', { value: String(val) }, label));
  }
  node.value = value === null || value === undefined ? '' : String(value);
  return node;
}

export function clearErrors(root) {
  for (const node of $$('[data-field]', root)) {
    const message = $(':scope > .error', node);
    if (message) message.textContent = '';
    node.classList.remove('has-error');
    for (const control of $$('input, select, textarea', node)) control.removeAttribute('aria-invalid');
  }
  const general = $('.form-error', root);
  if (general) general.textContent = '';
}

export function showFieldError(root, fieldName, message) {
  const wrapper = $(`[data-field="${fieldName}"]`, root);
  if (!wrapper) return false;
  const slot = $(':scope > .error', wrapper);
  if (slot) slot.textContent = message;
  wrapper.classList.add('has-error');
  for (const control of $$('input, select, textarea', wrapper)) control.setAttribute('aria-invalid', 'true');
  return true;
}

/**
 * Shows each error next to its field (the same `errors` list the API returns).
 * Errors without a matching field go to the general message at the top of the form.
 */
export function showErrors(root, errors, { focus = true } = {}) {
  clearErrors(root);
  let first = null;
  const leftovers = [];
  for (const { field: name, message } of errors) {
    if (showFieldError(root, name, message)) {
      first ??= $(`[data-field="${name}"]`, root);
    } else {
      leftovers.push(message);
    }
  }
  const general = $('.form-error', root);
  if (general && leftovers.length) general.textContent = leftovers.join(' ');
  if (focus) {
    const target = first ? $('input:not([disabled]), select:not([disabled]), textarea, button', first) : null;
    target?.focus();
    first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/** Color picker + hex text box. Empty value means "no custom color". */
export function colorPair({ value = '', fallback = '#9C8B6E', onChange = () => {}, label = '', allowEmpty = true, emptyLabel = t('common.clear') } = {}) {
  const picker = h('input', { type: 'color', value: isHexColor(value) ? expandHex(value) : fallback, 'aria-label': label || t('color.pick') });
  const text = h('input', { type: 'text', value: value || '', placeholder: '#RRGGBB', maxlength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': label ? `${label} (hex code)` : t('color.hex'), class: 'color-hex' });
  const clearButton = allowEmpty
    ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', on: { click: () => { text.value = ''; onChange(''); } } }, emptyLabel)
    : null;

  picker.addEventListener('input', () => {
    text.value = picker.value.toUpperCase();
    onChange(text.value);
  });
  text.addEventListener('input', () => {
    const typed = text.value.trim();
    if (isHexColor(typed)) picker.value = expandHex(typed);
    onChange(typed);
  });

  return {
    el: h('div', { class: 'color-pair' }, picker, text, clearButton),
    input: text,
    getValue: () => text.value.trim(),
    setValue: (next) => {
      text.value = next || '';
      if (isHexColor(next)) picker.value = expandHex(next);
    },
  };
}
