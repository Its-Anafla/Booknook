// Page-level building blocks used by every view.

import { h } from '../utils.js';
import { icon } from '../icons.js';

export function pageHeader({ title, subtitle = null, actions = [] }) {
  const heading = h('h1', { class: 'page-title', tabindex: '-1', id: 'page-title' }, title);
  return h('header', { class: 'page-header' },
    h('div', { class: 'page-heading' }, heading, subtitle),
    actions.length ? h('div', { class: 'page-actions' }, ...actions) : null);
}

export function emptyState({ title, message, action = null, mood = 'shelf' }) {
  return h('div', { class: `empty empty--${mood}` },
    h('div', { class: 'empty-arch', 'aria-hidden': 'true', html: icon(mood === 'grave' ? 'grave' : 'shelf', 44) }),
    h('h2', { class: 'empty-title' }, title),
    h('p', { class: 'empty-message' }, message),
    action);
}

let segmentedCounter = 0;

/** A group of radio buttons styled as a segmented control. */
export function segmented({ label, options, value, onChange }) {
  const name = `seg-${++segmentedCounter}`;
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  for (const [optionValue, optionLabel] of options) {
    const input = h('input', { type: 'radio', name, value: optionValue, checked: optionValue === value });
    input.addEventListener('change', () => onChange(optionValue));
    group.append(h('label', {}, input, h('span', {}, optionLabel)));
  }
  return group;
}

export function loadingState(text) {
  return h('p', { class: 'loading', role: 'status' }, text);
}

export function errorState(message) {
  return h('div', { class: 'empty empty--error', role: 'alert' }, h('h2', { class: 'empty-title' }, message));
}
