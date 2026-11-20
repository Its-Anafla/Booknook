// App shell: header, navigation (hash routes), footer reset button, and repainting when data changes.

import { h, $, debounce } from './utils.js';
import { t } from './strings.js';
import { icon } from './icons.js';
import { resetData } from './store.js';
import { resetPrefs } from './prefs.js';
import { DATA_CHANGED, notifyChange } from './model.js';
import { resetFilters } from './ui/filters.js';
import { confirmDialog, alertDialog } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { errorState, loadingState } from './ui/page.js';
import { renderShelf } from './ui/shelf.js';
import { renderWishlist } from './ui/wishlist.js';
import { renderLog } from './ui/log.js';
import { renderAuthors } from './ui/authors.js';
import { renderStats } from './ui/stats.js';
import { renderGraveyard } from './ui/graveyard.js';

const ROUTES = [
  { path: 'shelf', label: 'nav.shelf', icon: 'shelf', render: renderShelf },
  { path: 'wishlist', label: 'nav.wishlist', icon: 'wishlist', render: renderWishlist },
  { path: 'log', label: 'nav.log', icon: 'log', render: renderLog },
  { path: 'authors', label: 'nav.authors', icon: 'authors', render: renderAuthors },
  { path: 'stats', label: 'nav.stats', icon: 'stats', render: renderStats },
  { path: 'graveyard', label: 'nav.graveyard', icon: 'grave', render: renderGraveyard },
];

const main = $('#main');
let cleanup = null;
let renderToken = 0;
let currentPath = null;

function currentRoute() {
  const path = window.location.hash.replace(/^#\/?/, '') || 'shelf';
  return ROUTES.find((r) => r.path === path) ?? ROUTES[0];
}

function buildShell() {
  $('#brand').replaceChildren(
    h('span', { class: 'brand-mark', 'aria-hidden': 'true', html: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 29V14a11 11 0 0 1 22 0v15"/><path d="M3 29h26"/><path d="M11 29V17M16 29V12M21 29V18"/></svg>' }),
    h('span', { class: 'brand-name' }, t('app.name')));
  $('#nav').replaceChildren(...ROUTES.map((route) =>
    h('a', { href: `#/${route.path}`, class: 'nav-link', dataset: { route: route.path } },
      h('span', { class: 'nav-icon', html: icon(route.icon, 22) }), h('span', { class: 'nav-label' }, t(route.label)))));
  $('#skip-link').textContent = t('app.skip');
  $('#footer-note').textContent = t('app.footer');
  const reset = $('#reset-button');
  reset.replaceChildren(h('span', { class: 'btn-icon', html: icon('reset', 16) }), t('reset.button'));
  reset.addEventListener('click', onReset);
}

async function onReset() {
  const ok = await confirmDialog({ title: t('reset.title'), message: t('reset.message'), confirmLabel: t('reset.confirm'), tone: 'danger' });
  if (!ok) return;
  try {
    await resetData();
    resetPrefs();
    resetFilters();
    notifyChange();
    toast(t('reset.done'));
  } catch (error) {
    console.error(error);
    await alertDialog({ title: t('err.cantDo'), message: t('reset.failed') });
  }
}

/** Moving to another page must not leave a dialog from the previous page open. */
function closeAllDialogs() {
  for (const dialog of document.querySelectorAll('dialog.dialog')) dialog.close();
}

async function render({ routeChanged = false } = {}) {
  const route = currentRoute();
  const token = ++renderToken;
  if (routeChanged) closeAllDialogs();
  const scroll = window.scrollY;
  cleanup?.();
  cleanup = null;

  for (const link of document.querySelectorAll('.nav-link')) {
    const active = link.dataset.route === route.path;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  document.body.dataset.view = route.path;
  document.title = `${t(route.label)} | ${t('app.name')}`;

  // The view is attached before it renders so it can measure its width (the shelf needs that).
  const root = h('div', { class: 'view' }, loadingState(t('app.loading')));
  main.replaceChildren(root);
  root.replaceChildren();
  let result = null;
  try {
    result = await route.render(root);
  } catch (error) {
    console.error(error);
    if (token === renderToken) root.replaceChildren(errorState(t('app.loadError')));
  }
  if (token !== renderToken) { result?.(); return; }
  cleanup = typeof result === 'function' ? result : null;

  if (routeChanged) {
    window.scrollTo(0, 0);
    $('#page-title', main)?.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, scroll);
  }
  currentPath = route.path;
}

buildShell();
window.addEventListener('hashchange', () => render({ routeChanged: true }));
document.addEventListener(DATA_CHANGED, debounce(() => render(), 30));
render({ routeChanged: true });
