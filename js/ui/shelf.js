// The main view: a customizable bookshelf with drag-and-drop ordering.

import { h, clear, inkFor, pluralize } from '../utils.js';
import { t } from '../strings.js';
import { loadAll } from '../store.js';
import { buildContext, authorLine, latestReading, belongsOnShelf, notifyChange } from '../model.js';
import { getPrefs, updatePrefs, resolveOrder, saveOrder, getBookStyle, removeDecor } from '../prefs.js';
import { decorImage, decorWidth, decorHeight, decorLabel } from '../decor.js';
import { icon } from '../icons.js';
import { renderBook, COVER_SIZE, spineSize } from './bookView.js';
import { createFilterBar, bookPassesFilters, hasActiveFilters, hasReadingFilters, resetFilters } from './filters.js';
import { paintRows } from './shelfRows.js';
import { enableReorder } from './dragSort.js';
import { openBookDetail } from './bookDetail.js';
import { openBookForm } from './bookForm.js';
import { openCustomize } from './customize.js';
import { pageHeader, emptyState, segmented } from './page.js';
import { button } from './modal.js';
import { toast } from './toast.js';

const GAPS = { covers: 22, spines: 6 };

export async function renderShelf(root) {
  const ctx = buildContext(await loadAll());
  let pendingFocus = null;
  let lastWidth = 0;

  const subtitle = h('p', { class: 'page-sub' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const rowsEl = h('div', { class: 'shelf-rows' });
  const caseEl = h('section', { class: 'shelf-case', 'aria-label': t('shelf.label') }, rowsEl);
  const emptyHost = h('div', { class: 'empty-host' });

  /* ---- toolbar */
  const modeToggle = segmented({
    label: t('shelf.viewMode'),
    options: [['covers', t('shelf.covers')], ['spines', t('shelf.spines')]],
    value: getPrefs().viewMode,
    onChange: (mode) => { updatePrefs({ viewMode: mode }); paint(); },
  });
  const customizeButton = button(t('shelf.customize'), { variant: 'secondary', iconName: 'palette', onClick: () => openCustomize({ onChange: paint, currentOrder: () => resolveOrder(ctx.books) }) });
  const filterBar = createFilterBar({ ctx, onChange: () => paint(), extra: h('div', { class: 'toolbar-end' }, modeToggle, customizeButton) });

  const addButton = button(t('book.add'), { variant: 'primary', iconName: 'plus', onClick: () => openBookForm() });
  root.append(
    pageHeader({ title: t('shelf.title'), subtitle, actions: [addButton] }),
    filterBar, live, caseEl, emptyHost,
  );

  /* ---- which items are on the shelf, in which order */
  const collectionOf = (token) => {
    if (token[0] !== 'b') return null;
    const name = getBookStyle(Number(token.slice(1))).collection;
    return name ? { key: name.trim().toLowerCase(), label: name.trim() } : null;
  };

  function visibleTokens() {
    const filtering = hasActiveFilters();
    const tokens = [];
    for (const token of resolveOrder(ctx.books)) {
      if (token[0] === 'd') {
        if (!filtering) tokens.push(token);
        continue;
      }
      const book = ctx.booksById.get(Number(token.slice(1)));
      if (!book || !bookPassesFilters(book, ctx)) continue;
      // Unless the status/year filter asks for them, wishlist and graveyard books stay on their own pages.
      if (!hasReadingFilters() && !belongsOnShelf(book, ctx)) continue;
      tokens.push(token);
    }
    return groupSeries(tokens);
  }

  /** Books of the same series sit together, at the position of the first one. */
  function groupSeries(tokens) {
    const placed = new Set();
    const result = [];
    for (const token of tokens) {
      const series = collectionOf(token);
      if (!series) { result.push(token); continue; }
      if (placed.has(series.key)) continue;
      placed.add(series.key);
      result.push(...tokens.filter((other) => collectionOf(other)?.key === series.key));
    }
    return result;
  }

  /* ---- elements */
  function makeDecor(token) {
    const spec = getPrefs().decor[token];
    const remove = h('button', { type: 'button', class: 'decor-remove', 'aria-label': t('decor.remove', { name: decorLabel(spec.type) }), html: icon('close', 14) });
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeDecor(token);
      paint();
      toast(t('decor.removed', { name: decorLabel(spec.type) }));
    });
    return h('div', {
      class: 'shelf-item decor', tabindex: '0', role: 'group', dataset: { token, type: spec.type },
      'aria-label': t('decor.label', { name: decorLabel(spec.type) }),
      css: { '--w': `${decorWidth(spec.type)}px`, '--h': `${decorHeight(spec.type)}px` },
    }, decorImage(spec.type), remove);
  }

  function makeEntry(token, mode) {
    const series = collectionOf(token);
    const group = series ? { group: series.key, groupLabel: series.label } : {};
    if (token[0] === 'd') return { element: makeDecor(token), width: decorWidth(getPrefs().decor[token].type), ...group };
    const book = ctx.booksById.get(Number(token.slice(1)));
    const status = latestReading(book, ctx)?.status ?? null;
    return {
      element: renderBook(book, { mode, status, authors: authorLine(book, ctx) }),
      width: mode === 'spines' ? spineSize(book).width : COVER_SIZE.width,
      ...group,
    };
  }

  /* ---- paint */
  function applyLook() {
    const { shelf, viewMode } = getPrefs();
    caseEl.style.setProperty('--shelf-bg', shelf.bg);
    caseEl.style.setProperty('--wood', shelf.wood);
    caseEl.style.setProperty('--shelf-ink', inkFor(shelf.bg));
    caseEl.dataset.lights = shelf.lights ? 'on' : 'off';
    caseEl.dataset.mode = viewMode;
  }

  function paint() {
    applyLook();
    const mode = getPrefs().viewMode;
    const tokens = visibleTokens();
    const bookCount = tokens.filter((tk) => tk[0] === 'b').length;
    subtitle.textContent = pluralize(bookCount, 'book') + (hasActiveFilters() ? ` ${t('shelf.matching')}` : ` ${t('shelf.onShelf')}`);
    live.textContent = subtitle.textContent;

    clear(emptyHost);
    if (!tokens.length) {
      caseEl.hidden = true;
      emptyHost.append(buildEmpty());
      return;
    }
    caseEl.hidden = false;
    paintRows(rowsEl, tokens.map((token) => makeEntry(token, mode)), { gap: GAPS[mode] });
    lastWidth = caseEl.clientWidth;
    if (pendingFocus) {
      rowsEl.querySelector(`[data-token="${pendingFocus}"]`)?.focus();
      pendingFocus = null;
    }
  }

  function buildEmpty() {
    if (hasActiveFilters()) {
      return emptyState({
        title: t('shelf.noMatch.title'), message: t('shelf.noMatch.message'),
        action: button(t('filters.clear'), { onClick: () => { resetFilters(); notifyChange(); } }),
      });
    }
    if (!ctx.books.length) {
      return emptyState({ title: t('shelf.empty.title'), message: t('shelf.empty.message'), action: button(t('book.addFirst'), { variant: 'primary', iconName: 'plus', onClick: () => openBookForm() }) });
    }
    return emptyState({ title: t('shelf.nothingYet.title'), message: t('shelf.nothingYet.message') });
  }

  /* ---- interactions */
  rowsEl.addEventListener('click', (event) => {
    const book = event.target.closest('.book');
    if (book) openBookDetail(Number(book.dataset.bookId));
  });
  rowsEl.addEventListener('keydown', (event) => {
    const decor = event.target.closest?.('.decor');
    if (decor && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      decor.querySelector('.decor-remove').click();
    }
  });

  function moveToken(dragged, target, after) {
    const order = resolveOrder(ctx.books).filter((token) => token !== dragged);
    const index = order.indexOf(target);
    if (index < 0) return;
    order.splice(after ? index + 1 : index, 0, dragged);
    saveOrder(order);
    pendingFocus = dragged;
    paint();
  }

  const stopReorder = enableReorder(rowsEl, {
    onDrop: moveToken,
    onKeyboardMove: (token, direction) => {
      const shown = visibleTokens();
      const next = shown[shown.indexOf(token) + direction];
      if (next) moveToken(token, next, direction > 0);
    },
  });

  const observer = new ResizeObserver(() => {
    if (!caseEl.hidden && Math.abs(caseEl.clientWidth - lastWidth) > 1) paint();
  });
  observer.observe(caseEl);

  paint();
  return () => { observer.disconnect(); stopReorder(); };
}
