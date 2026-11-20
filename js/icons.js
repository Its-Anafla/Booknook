// Inline SVG icons (24x24, stroke based). Static, trusted markup.

const PATHS = {
  shelf: '<path d="M4 20V5a1 1 0 0 1 1-1h3v16"/><path d="M8 20V4h4v16"/><path d="m14.5 6.2 3.8-1.1 3 13.7-3.8 1"/><path d="M3 20h18"/>',
  wishlist: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
  log: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  authors: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.9.7 3 2.5 3 5.2"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  grave: '<path d="M6 21V10a6 6 0 0 1 12 0v11"/><path d="M3 21h18M12 8v6M9.5 10.5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.6-1.2-2.9 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4-4-7.5-9-7.5Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15.5" cy="7.5" r="1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  book: '<path d="M5 4h8a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h8"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  sort: '<path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5"/><path d="M4 4v4.5h4.5"/>',
  arrowLeft: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
};

export function icon(name, size = 20) {
  const body = PATHS[name] ?? '';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
