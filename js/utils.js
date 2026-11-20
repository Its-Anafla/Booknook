// Small helpers shared by every module. No app logic lives here.

const PROPERTY_ATTRS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'open', 'required', 'readOnly']);

/**
 * Tiny element factory.
 *   h('button', { class: 'btn', on: { click: fn }, css: { '--x': '1' } }, 'Label')
 * `html` is for trusted, static markup only (our own SVG strings).
 */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'on') for (const [name, fn] of Object.entries(value)) node.addEventListener(name, fn);
    else if (key === 'css') for (const [prop, val] of Object.entries(value)) node.style.setProperty(prop, val);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (PROPERTY_ATTRS.has(key)) node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function clear(node) {
  node.replaceChildren();
  return node;
}

/** Lowercase, trimmed, accent-free text for case-insensitive comparisons. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Stable 32-bit hash, used to pick colors and sizes that never change between renders. */
export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function formatYear(year) {
  if (year === null || year === undefined || Number.isNaN(year)) return '-';
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

export function formatGrade(grade) {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return '-';
  return Number(grade).toFixed(1);
}

/** '' -> null, '-429' -> -429, anything else that is not a whole number -> NaN (rejected by validation). */
export function parseIntStrict(text) {
  const value = String(text ?? '').trim();
  if (value === '') return null;
  return /^-?\d+$/.test(value) ? Number(value) : NaN;
}

/** '' -> null, '7,5' or '7.5' -> 7.5, garbage -> NaN. */
export function parseDecimal(text) {
  const value = String(text ?? '').trim().replace(',', '.');
  if (value === '') return null;
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
}

export function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value ?? '').trim());
}

export function expandHex(value) {
  const v = String(value).trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  return v;
}

/** Readable text color (dark or light) for a given background hex. */
export function inkFor(hex) {
  const c = expandHex(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.38 ? '#1f2a1c' : '#f7f2e4';
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const currentYear = () => new Date().getFullYear();
export const currentMonth = () => new Date().getMonth() + 1;

/** Compare for sorting: null/undefined/NaN go last, whatever the direction. */
export function compareWithMissingLast(a, b, direction = 1) {
  const missingA = a === null || a === undefined || a === '' || Number.isNaN(a);
  const missingB = b === null || b === undefined || b === '' || Number.isNaN(b);
  if (missingA && missingB) return 0;
  if (missingA) return 1;
  if (missingB) return -1;
  if (typeof a === 'string' || typeof b === 'string') {
    return direction * String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
  }
  return direction * (a - b);
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function pluralize(count, singular, plural = singular + 's') {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function formatDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
