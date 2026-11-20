// FR-01: manage authors. An author linked to a book can't be deleted (409 with the book titles).

import { h, clear, formatDate, normalize, pluralize, sortByName, debounce } from '../utils.js';
import { t } from '../strings.js';
import { ApiError, loadAll, saveAuthor, deleteAuthor } from '../store.js';
import { validateAuthor } from '../validation.js';
import { buildContext, notifyChange } from '../model.js';
import { icon } from '../icons.js';
import { openDialog, dialogFooter, button, confirmDialog, alertDialog } from './modal.js';
import { field, select, showErrors, clearErrors } from './formKit.js';
import { pageHeader, emptyState } from './page.js';
import { toast } from './toast.js';

let searchText = '';

export async function renderAuthors(root) {
  const ctx = buildContext(await loadAll());
  const booksByAuthor = new Map();
  for (const book of ctx.books) {
    for (const id of book.authorIds) {
      if (!booksByAuthor.has(id)) booksByAuthor.set(id, []);
      booksByAuthor.get(id).push(book);
    }
  }

  const list = h('ul', { class: 'author-list' });
  const subtitle = h('p', { class: 'page-sub' });
  const search = h('input', { type: 'search', placeholder: t('authors.searchPlaceholder'), 'aria-label': t('authors.search'), value: searchText, autocomplete: 'off' });
  search.addEventListener('input', debounce(() => { searchText = search.value; paint(); }, 120));

  root.append(
    pageHeader({
      title: t('authors.title'), subtitle,
      actions: [button(t('author.add'), { variant: 'primary', iconName: 'plus', onClick: () => openAuthorForm({ ctx }) })],
    }),
    h('div', { class: 'filterbar' }, h('div', { class: 'filterbar-row' }, h('label', { class: 'search' }, h('span', { class: 'search-icon', html: icon('search', 18) }), search))),
    list);

  function paint() {
    const query = normalize(searchText);
    const shown = sortByName(ctx.authors).filter((a) => !query || normalize(a.name).includes(query));
    subtitle.textContent = pluralize(shown.length, 'author');
    clear(list);
    if (!shown.length) {
      list.append(h('li', {}, emptyState({
        title: ctx.authors.length ? t('authors.noMatch') : t('authors.empty.title'),
        message: ctx.authors.length ? t('authors.noMatchHint') : t('authors.empty.message'),
      })));
      return;
    }
    for (const author of shown) list.append(authorRow(author));
  }

  function authorRow(author) {
    const books = booksByAuthor.get(author.id) ?? [];
    const country = ctx.countriesById.get(author.countryId)?.name ?? t('author.unknownCountry');
    const dates = author.birthDate || author.deathDate ? `${author.birthDate ? formatDate(author.birthDate) : '?'} - ${author.deathDate ? formatDate(author.deathDate) : t('author.present')}` : null;
    return h('li', { class: 'author' },
      h('div', { class: 'author-mark', 'aria-hidden': 'true' }, author.name.trim()[0]?.toUpperCase() ?? '?'),
      h('div', { class: 'author-main' },
        h('p', { class: 'author-name' }, author.name),
        h('p', { class: 'author-meta' }, [country, dates].filter(Boolean).join('  |  '))),
      h('p', { class: 'author-books', title: books.map((b) => b.title).join(', ') }, books.length ? pluralize(books.length, 'book') : t('author.noBooks')),
      h('div', { class: 'author-actions' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('author.editAria', { name: author.name }), html: icon('edit', 18), on: { click: () => openAuthorForm({ ctx, author }) } }),
        h('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': t('author.deleteAria', { name: author.name }), html: icon('trash', 18), on: { click: () => removeAuthor(author) } })));
  }

  async function removeAuthor(author) {
    const ok = await confirmDialog({ title: t('author.deleteTitle'), message: t('author.deleteMessage', { name: author.name }), confirmLabel: t('common.delete'), tone: 'danger' });
    if (!ok) return;
    try {
      await deleteAuthor(author.id);
      toast(t('common.deleted'));
      notifyChange();
    } catch (error) {
      // 409: still linked to books. The message lists their titles.
      await alertDialog({ title: error instanceof ApiError && error.status === 409 ? t('author.cantDelete') : t('err.cantDo'), message: error.message });
    }
  }

  paint();
}

function openAuthorForm({ ctx, author = null }) {
  const editing = !!author;
  const name = h('input', { type: 'text', name: 'name', maxlength: 120, autocomplete: 'off', value: author?.name ?? '' });
  const country = select('countryId', sortByName(ctx.countries).map((c) => [c.id, c.name]), { placeholder: t('common.notSet'), value: author?.countryId ?? '' });
  const birth = h('input', { type: 'date', name: 'birthDate', value: author?.birthDate ?? '' });
  const death = h('input', { type: 'date', name: 'deathDate', value: author?.deathDate ?? '' });
  const general = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { id: 'author-form', novalidate: true, class: 'form' }, general,
    field({ name: 'name', label: t('author.name'), control: name, required: true }),
    field({ name: 'countryId', label: t('author.nationality'), control: country, hint: t('author.nationalityHint') }),
    h('div', { class: 'field-grid' },
      field({ name: 'birthDate', label: t('author.birth'), control: birth }),
      field({ name: 'deathDate', label: t('author.death'), control: death })));

  const dlg = openDialog({
    title: editing ? t('author.edit') : t('author.add'),
    size: 'sm', body: form,
    footer: dialogFooter(button(t('common.cancel'), { onClick: () => dlg.close() }), button(t('common.save'), { variant: 'primary', type: 'submit', form: 'author-form' })),
  });
  name.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    const draft = {
      ...(editing ? { id: author.id } : {}),
      name: name.value,
      countryId: country.value ? Number(country.value) : null,
      birthDate: birth.value || null,
      deathDate: death.value || null,
    };
    const errors = validateAuthor(draft, { authors: ctx.authors, countries: ctx.countries });
    if (errors.length) { showErrors(form, errors); return; }
    try {
      await saveAuthor(draft);
      dlg.close();
      toast(t('common.saved'));
      notifyChange();
    } catch (error) {
      if (error instanceof ApiError) showErrors(form, error.errors.length ? error.errors : [{ field: 'name', message: error.message }]);
      else { console.error(error); general.textContent = t('err.unexpected'); }
    }
  });
}
