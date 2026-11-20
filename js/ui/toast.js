import { h } from '../utils.js';

let region = null;

function ensureRegion() {
  if (!region) {
    region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  return region;
}

export function toast(message, { tone = 'ok', duration = 3200 } = {}) {
  const node = h('div', { class: `toast toast--${tone}` }, message);
  ensureRegion().append(node);
  setTimeout(() => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 250);
  }, duration);
}
