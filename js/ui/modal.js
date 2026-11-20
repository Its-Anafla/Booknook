// Dialog helpers built on the native <dialog> element (focus trap, Esc, backdrop for free).

import { h } from '../utils.js';
import { t } from '../strings.js';
import { icon } from '../icons.js';

let dialogCounter = 0;

/**
 * Opens a modal dialog. Returns { dialog, body, close, setTitle }.
 * `footer` (optional) stays pinned at the bottom while the body scrolls.
 */
export function openDialog({ title, body, footer = null, size = 'md', className = '', onClose = null, modal = true }) {
  const titleId = `dialog-title-${++dialogCounter}`;
  const heading = h('h2', { class: 'dialog-title', id: titleId }, title);
  const closeButton = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), html: icon('close') });
  const content = h('div', { class: 'dialog-body' }, body);
  const dialog = h(
    'dialog',
    { class: `dialog dialog--${size} ${className}`.trim(), 'aria-labelledby': titleId },
    h('header', { class: 'dialog-header' }, heading, closeButton),
    content,
    footer,
  );

  const close = () => dialog.close();
  closeButton.addEventListener('click', close);

  // Close on backdrop click, but not when a text selection started inside and ended outside.
  let pressedOnBackdrop = false;
  dialog.addEventListener('pointerdown', (event) => { pressedOnBackdrop = event.target === dialog; });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && pressedOnBackdrop && modal) close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  if (!modal) {
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  }

  document.body.append(dialog);
  if (modal) dialog.showModal();
  else dialog.show();

  return { dialog, body: content, close, setTitle: (text) => { heading.textContent = text; } };
}

export function dialogFooter(...buttons) {
  return h('footer', { class: 'dialog-footer' }, ...buttons);
}

export function button(label, { variant = 'secondary', type = 'button', onClick, form, iconName } = {}) {
  return h(
    'button',
    { type, class: `btn btn--${variant}`, form, on: onClick ? { click: onClick } : {} },
    iconName ? h('span', { class: 'btn-icon', html: icon(iconName, 18) }) : null,
    label,
  );
}

/** Resolves true when the person confirms, false for anything else (cancel, Esc, backdrop). */
export function confirmDialog({ title, message, details = null, confirmLabel = t('common.confirm'), cancelLabel = t('common.cancel'), tone = 'primary' }) {
  return new Promise((resolve) => {
    let answer = false;
    const confirm = button(confirmLabel, { variant: tone === 'danger' ? 'danger' : 'primary', onClick: () => { answer = true; dlg.close(); } });
    const cancel = button(cancelLabel, { onClick: () => dlg.close() });
    const dlg = openDialog({
      title,
      size: 'sm',
      body: [h('p', { class: 'dialog-message' }, message), details],
      footer: dialogFooter(cancel, confirm),
      onClose: () => resolve(answer),
    });
    confirm.focus();
  });
}

export function alertDialog({ title, message, buttonLabel = t('common.ok') }) {
  return new Promise((resolve) => {
    const ok = button(buttonLabel, { variant: 'primary', onClick: () => dlg.close() });
    const dlg = openDialog({
      title,
      size: 'sm',
      body: h('p', { class: 'dialog-message' }, message),
      footer: dialogFooter(ok),
      onClose: resolve,
    });
    ok.focus();
  });
}
