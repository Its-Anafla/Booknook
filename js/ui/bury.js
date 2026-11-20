// The abandon flow: an optional epitaph, then a short animation that sends the book to the graveyard shelf.

import { h, prefersReducedMotion } from '../utils.js';
import { t } from '../strings.js';
import { cobwebSvg } from '../decor.js';
import { renderBook } from './bookView.js';
import { openDialog, dialogFooter, button } from './modal.js';

/**
 * Optional modal asking why the book was left behind.
 * Resolves with the text (possibly empty) when saved, or null when skipped.
 */
export function askEpitaph({ title, current = '' }) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('textarea', { rows: 4, maxlength: 240, name: 'epitaph', placeholder: t('bury.placeholder') });
    input.value = current;
    const counter = h('p', { class: 'hint' }, t('bury.counter', { count: current.length }));
    input.addEventListener('input', () => { counter.textContent = t('bury.counter', { count: input.value.length }); });

    const skip = button(t('bury.skip'), { onClick: () => dlg.close() });
    const save = button(t('bury.save'), { variant: 'primary', onClick: () => { result = input.value; dlg.close(); } });
    const dlg = openDialog({
      title: t('bury.title'),
      size: 'sm',
      className: 'dialog--grave',
      body: [
        h('p', { class: 'dialog-message' }, t('bury.message', { title })),
        h('label', { class: 'sr-only', for: 'epitaph-input' }, t('bury.label')),
        Object.assign(input, { id: 'epitaph-input' }),
        counter,
      ],
      footer: dialogFooter(skip, save),
      onClose: () => resolve(result),
    });
    input.focus();
  });
}

/** Full-screen farewell. Resolves when the animation is over. */
export function playBurial(book, authors = '') {
  return new Promise((resolve) => {
    const reduced = prefersReducedMotion();
    const web = (side) => h('div', { class: `burial-web burial-web--${side}`, html: cobwebSvg(260) });
    const stage = h('div', { class: 'burial-stage' },
      h('div', { class: 'burial-book' }, renderBook(book, { mode: 'covers', tag: 'div', authors })),
      h('p', { class: 'burial-line' }, t('bury.laidToRest')),
      h('p', { class: 'burial-title' }, book.title));
    const overlay = h('div', { class: `burial${reduced ? ' is-reduced' : ''}`, role: 'status', 'aria-live': 'assertive' },
      h('div', { class: 'burial-fog', 'aria-hidden': 'true' }),
      web('left'), web('right'), stage);
    document.body.append(overlay);
    setTimeout(() => {
      overlay.classList.add('is-leaving');
      setTimeout(() => { overlay.remove(); resolve(); }, 380);
    }, reduced ? 900 : 2900);
  });
}
