// How a single book is drawn: a front cover (image or generated), or a spine.

import { h, hashString, inkFor, isHexColor, expandHex } from '../utils.js';
import { getPrefs, getBookStyle, PALETTES, NEUTRAL_SPINE } from '../prefs.js';
import { icon } from '../icons.js';

export const COVER_SIZE = { width: 112, height: 168 };

/** Spine colour: the book's own colour wins, then the chosen palette, then a neutral tone. */
export function spineColorFor(book, styleOverride = null) {
  const style = styleOverride ?? getBookStyle(book.id);
  if (style.color && isHexColor(style.color)) return expandHex(style.color);
  const prefs = getPrefs();
  if (prefs.spineMode === 'palette') {
    const colors = (PALETTES[prefs.palette] ?? Object.values(PALETTES)[0]).colors;
    return colors[hashString(`${book.title}#${book.id}`) % colors.length];
  }
  return NEUTRAL_SPINE;
}

/**
 * Spine size. Long titles get a taller spine and, when needed, wrap onto 2 or 3 columns,
 * so the whole title stays readable instead of being cut off.
 */
export function spineSize(book) {
  const hash = hashString(book.title);
  const CHAR = 8.8; // approximate width of one character of the vertical title, in px
  const MAX_LINE = 215; // longest single column of title text we accept
  const longestWord = Math.max(...book.title.split(/\s+/).map((w) => w.length));
  const total = book.title.length * CHAR * 1.06;
  let lines = 1;
  while (lines < 3 && total / lines + (lines > 1 ? CHAR * 4 : 0) > MAX_LINE) lines++;
  const lineLength = Math.max(longestWord * CHAR, total / lines + (lines > 1 ? CHAR * 4 : 0));
  const height = Math.min(272, Math.max(150 + (hash % 26), Math.ceil(lineLength) + 44));
  const width = lines === 1 ? 42 + (hash % 8) : lines === 2 ? 58 + (hash % 6) : 74 + (hash % 6);
  return { width, height, lines };
}

const STATUS_ICON = { Read: 'check', Reading: 'book', Paused: 'pause' };

function statusBadge(status) {
  if (!STATUS_ICON[status]) return null;
  return h('span', { class: `book-badge book-badge--${status.toLowerCase()}`, html: icon(STATUS_ICON[status], 14), title: status });
}

/**
 * @param opts.mode 'covers' | 'spines'
 * @param opts.status latest reading status (for the little badge)
 * @param opts.authors author line, already joined
 * @param opts.style optional { coverUrl, color } to preview unsaved values
 */
export function renderBook(book, { mode = 'covers', status = null, authors = '', style = null, tag = 'button', token = `b${book.id}` } = {}) {
  const look = style ?? getBookStyle(book.id);
  const color = spineColorFor(book, look);
  const ink = inkFor(color);
  const label = `${book.title}${authors ? `, by ${authors}` : ''}${status ? `. ${status}` : ''}`;
  const common = {
    class: `shelf-item book book--${mode === 'spines' ? 'spine' : 'cover'}`,
    dataset: { token, bookId: String(book.id) },
    'aria-label': label,
    title: label,
  };
  if (tag === 'button') common.type = 'button';

  if (mode === 'spines') {
    const { width, height, lines } = spineSize(book);
    return h(
      tag,
      { ...common, css: { '--spine': color, '--ink': ink, '--w': `${width}px`, '--h': `${height}px`, '--lines': lines }, dataset: { token, bookId: String(book.id), lines: String(lines) } },
      h('span', { class: 'spine-body' },
        h('span', { class: 'spine-title' }, book.title),
        authors ? h('span', { class: 'spine-author' }, authors) : null),
      status && STATUS_ICON[status] ? h('span', { class: `spine-ribbon spine-ribbon--${status.toLowerCase()}` }) : null,
    );
  }

  const face = h('span', { class: 'book-face' });
  const text = h('span', { class: 'book-text' },
    h('span', { class: 'book-title' }, book.title),
    authors ? h('span', { class: 'book-author' }, authors) : null);
  face.append(text);

  if (look.coverUrl) {
    face.classList.add('has-cover');
    const image = h('img', { class: 'book-img', src: look.coverUrl, alt: '', loading: 'lazy', draggable: 'false', referrerpolicy: 'no-referrer' });
    // If the link is broken we fall back to the generated cover right away.
    image.addEventListener('error', () => {
      image.remove();
      face.classList.remove('has-cover');
    });
    face.prepend(image);
  }

  return h(
    tag,
    { ...common, css: { '--spine': color, '--ink': ink } },
    face,
    statusBadge(status),
  );
}
