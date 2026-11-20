// Turns a flat list of shelf items into rows that fit the available width,
// each row with its string lights and wooden board. Series (collections) get a ribbon.

import { h, clear } from '../utils.js';

export const SHELF_PADDING = 30; // keep in sync with --shelf-pad in shelf.css
const GROUP_PADDING = 28; // space a series wrapper adds around its books

/**
 * @param container the `.shelf-rows` element
 * @param entries   [{ element, width, group?, groupLabel? }]
 */
export function paintRows(container, entries, { gap, minRows = 1 }) {
  const usable = container.clientWidth - SHELF_PADDING * 2 - 6;
  const rows = [];
  let row = [];
  let used = 0;
  let currentGroup = null;

  for (const entry of entries) {
    const enteringGroup = entry.group && entry.group !== currentGroup;
    let need = entry.width + (row.length ? gap : 0) + (enteringGroup ? GROUP_PADDING : 0);
    if (row.length && used + need > usable) {
      rows.push(row);
      row = [];
      used = 0;
      currentGroup = null;
      need = entry.width + (entry.group ? GROUP_PADDING : 0);
    }
    row.push(entry);
    used += need;
    currentGroup = entry.group ?? null;
  }
  if (row.length) rows.push(row);
  while (rows.length < minRows) rows.push([]);

  clear(container);
  for (const rowEntries of rows) container.append(buildRow(rowEntries));
  return rows.length;
}

function buildRow(entries) {
  const items = h('div', { class: 'shelf-items' });
  let segment = null;
  let segmentGroup = null;

  for (const entry of entries) {
    if (entry.group) {
      if (entry.group !== segmentGroup) {
        segment = h('div', { class: 'series' },
          h('span', { class: 'series-ribbon', title: entry.groupLabel }, h('span', { class: 'series-name' }, entry.groupLabel)));
        items.append(segment);
        segmentGroup = entry.group;
      }
      segment.append(entry.element);
    } else {
      segment = null;
      segmentGroup = null;
      items.append(entry.element);
    }
  }
  return h('div', { class: 'shelf-row' },
    h('div', { class: 'shelf-lights', 'aria-hidden': 'true' }),
    items,
    h('div', { class: 'shelf-board', 'aria-hidden': 'true' }));
}
