// Presentation preferences: shelf look, drag-and-drop order, decorations, cover links and spine colors.
// These are NOT part of the assignment's data model (seed.json stays untouched), so they live here,
// separate from store.js, under their own localStorage key.

import { isDecorType } from './decor.js';

const KEY = 'rtui.prefs';

export const PALETTES = {
  'green-brown': { label: 'Green & Brown', colors: ['#532A09', '#7B4618', '#915C27', '#AD8042', '#BFAB67', '#BFC882', '#A4B75C', '#647332', '#3E4C22', '#2E401C'] },
  'pink-white': { label: 'Pink & White', colors: ['#590D22', '#800F2F', '#A4133C', '#C9184A', '#FF4D6D', '#FF758F', '#FF8FA3', '#FFB3C1', '#FFCCD5', '#FFF0F3'] },
  red: { label: 'Red', colors: ['#2B0000', '#4F0000', '#740000', '#980000', '#B50000', '#D30000', '#EB1D1D', '#F50F0F', '#FF0000'] },
  blue: { label: 'Blue', colors: ['#012A4A', '#013A63', '#01497C', '#014F86', '#2A6F97', '#2C7DA0', '#468FAF', '#61A5C2', '#89C2D9', '#A9D6E5'] },
  pastel: { label: 'Pastel', colors: ['#FEC5BB', '#FCD5CE', '#FAE1DD', '#F8EDEB', '#E8E8E4', '#D8E2DC', '#ECE4DB', '#FFE5D9', '#FFD7BA', '#FEC89A'] },
};
const DEFAULT_PALETTE = 'green-brown';

export const SHELF_BACKGROUNDS = [
  { value: '#314A37', label: 'Moss' },
  { value: '#8FA588', label: 'Sage' },
  { value: '#E4D8BC', label: 'Linen' },
  { value: '#4A3424', label: 'Walnut' },
  { value: '#1F2B30', label: 'Midnight' },
];

export const WOODS = [
  { value: '#7A5233', label: 'Oak' },
  { value: '#523520', label: 'Walnut' },
  { value: '#B08A5B', label: 'Birch' },
  { value: '#3E2A1B', label: 'Ebony' },
];

export const NEUTRAL_SPINE = '#9C8B6E';

const defaults = () => ({
  viewMode: 'covers', // 'covers' | 'spines'
  shelf: { bg: '#314A37', wood: '#7A5233', lights: true },
  palette: DEFAULT_PALETTE,
  spineMode: 'palette', // 'palette' | 'custom'
  order: [], // ['b12', 'd1', 'b3', ...] books and decorations, in shelf order
  decor: {}, // { d1: { type: 'plant' } }
  nextDecorId: 1,
  bookStyle: {}, // { [bookId]: { coverUrl, color, collection } }
});

let cache = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const base = defaults();
    if (!saved) return base;
    const merged = { ...base, ...saved, shelf: { ...base.shelf, ...saved.shelf } };
    if (!PALETTES[merged.palette]) merged.palette = DEFAULT_PALETTE; // palette from an older version
    return merged;
  } catch {
    return defaults();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: preferences just won't persist */
  }
}

export function getPrefs() {
  if (!cache) cache = load();
  return cache;
}

export function updatePrefs(patch) {
  const prefs = getPrefs();
  for (const [key, value] of Object.entries(patch)) {
    prefs[key] = key === 'shelf' ? { ...prefs.shelf, ...value } : value;
  }
  persist();
  return prefs;
}

export function resetPrefs() {
  cache = defaults();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ---- per-book extras */

export function getBookStyle(bookId) {
  return getPrefs().bookStyle[bookId] ?? {};
}

export function setBookStyle(bookId, style) {
  const prefs = getPrefs();
  const clean = Object.fromEntries(Object.entries(style).filter(([, v]) => v !== '' && v !== null && v !== undefined));
  if (Object.keys(clean).length) prefs.bookStyle[bookId] = clean;
  else delete prefs.bookStyle[bookId];
  persist();
}

export function forgetBook(bookId) {
  const prefs = getPrefs();
  delete prefs.bookStyle[bookId];
  prefs.order = prefs.order.filter((token) => token !== `b${bookId}`);
  persist();
}

export function collectionNames() {
  const names = new Set();
  for (const style of Object.values(getPrefs().bookStyle)) if (style.collection) names.add(style.collection);
  return [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/* ---- decorations */

export function addDecor(type) {
  const prefs = getPrefs();
  const id = `d${prefs.nextDecorId++}`;
  prefs.decor[id] = { type };
  prefs.order = [...prefs.order, id];
  persist();
  return id;
}

export function removeDecor(id) {
  const prefs = getPrefs();
  delete prefs.decor[id];
  prefs.order = prefs.order.filter((token) => token !== id);
  persist();
}

/**
 * Full shelf order as tokens. Keeps the saved order, drops things that no longer exist
 * and appends new books at the end (by id).
 */
export function resolveOrder(books) {
  const prefs = getPrefs();
  // Decorations from older versions (drawn, not photos) are dropped here.
  for (const [id, spec] of Object.entries(prefs.decor)) if (!isDecorType(spec.type)) delete prefs.decor[id];
  const known = new Set([...books.map((b) => `b${b.id}`), ...Object.keys(prefs.decor)]);
  const order = prefs.order.filter((token) => known.has(token));
  const placed = new Set(order);
  for (const book of [...books].sort((a, b) => a.id - b.id)) {
    if (!placed.has(`b${book.id}`)) order.push(`b${book.id}`);
  }
  return order;
}

export function saveOrder(order) {
  updatePrefs({ order });
}
