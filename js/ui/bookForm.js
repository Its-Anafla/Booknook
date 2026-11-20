// Create / edit a book (FR-02), with authors and themes picked from existing records,
// "+ New Author" and new themes created on the fly (no leaving the form),
// plus the optional first reading / wishlist entry (FR-03).

import { h, sortByName, normalize, parseIntStrict, formatYear, debounce } from '../utils.js';
import { t, FORMS, MODES, CONTENTS, SUGGESTED_THEMES } from '../strings.js';
import { ApiError, getAuthors, getBooks, getCountries, getThemes, saveAuthor, saveBook, saveReading, saveTheme, deleteBook } from '../store.js';
import { validateAuthor, validateBook, validateReading, validateExtras } from '../validation.js';
import { getBookStyle, setBookStyle, collectionNames } from '../prefs.js';
import { notifyChange } from '../model.js';
import { icon } from '../icons.js';
import { openDialog, dialogFooter, button } from './modal.js';
import { field, fieldset, select, showErrors, clearErrors, colorPair } from './formKit.js';
import { createReadingFields } from './readingFields.js';
import { renderBook } from './bookView.js';
import { toast } from './toast.js';
import { buryBook } from './actions.js';

export async function openBookForm({ book = null } = {}) {
  const [authors, themes, countries, books] = await Promise.all([getAuthors(), getThemes(), getCountries(), getBooks()]);
  const editing = !!book;
  const style = book ? getBookStyle(book.id) : {};
  const state = {
    authors: [...authors],
    themes: [...themes],
    authorIds: new Set(book?.authorIds ?? []),
    themeIds: new Set(book?.themeIds ?? []),
  };
  const countryName = (id) => countries.find((c) => c.id === id)?.name ?? '';

  /* ---- title & year */
  const title = h('input', { type: 'text', name: 'title', maxlength: 200, autocomplete: 'off', value: book?.title ?? '' });
  const year = h('input', { type: 'text', name: 'publicationYear', inputmode: 'numeric', autocomplete: 'off', value: book?.publicationYear ?? '' });
  const yearPreview = h('span', { class: 'year-preview', 'aria-live': 'polite' });
  const updateYearPreview = () => {
    const value = parseIntStrict(year.value);
    yearPreview.textContent = Number.isInteger(value) && value !== 0 && value < 0 ? `= ${formatYear(value)}` : '';
  };
  year.addEventListener('input', updateYearPreview);
  updateYearPreview();

  const yearField = field({ name: 'publicationYear', label: t('book.year'), control: year, hint: t('book.yearHint') });
  yearField.insertBefore(yearPreview, yearField.querySelector('.error'));

  /* ---- authors */
  const chips = h('div', { class: 'chips', 'aria-live': 'polite' });
  const authorSearch = h('input', { type: 'search', placeholder: t('authors.filterPlaceholder'), 'aria-label': t('authors.filterPlaceholder'), autocomplete: 'off' });
  const authorList = h('div', { class: 'check-list', role: 'group', 'aria-label': t('book.authors') });
  const panelHost = h('div', { class: 'inline-panel-host' });
  const newAuthorButton = h('button', { type: 'button', class: 'btn btn--secondary btn--small', 'aria-expanded': 'false' },
    h('span', { class: 'btn-icon', html: icon('plus', 16) }), t('author.newQuick'));

  function renderAuthors() {
    const query = normalize(authorSearch.value);
    authorList.replaceChildren();
    for (const author of sortByName(state.authors)) {
      if (query && !normalize(author.name).includes(query) && !state.authorIds.has(author.id)) continue;
      const box = h('input', { type: 'checkbox', value: author.id, checked: state.authorIds.has(author.id) });
      box.addEventListener('change', () => {
        if (box.checked) state.authorIds.add(author.id); else state.authorIds.delete(author.id);
        renderChips();
      });
      const country = countryName(author.countryId);
      authorList.append(h('label', { class: 'check' }, box, h('span', {}, author.name), country ? h('small', {}, country) : null));
    }
    if (!authorList.childElementCount) authorList.append(h('p', { class: 'hint' }, t('authors.noneFound')));
  }

  function renderChips() {
    chips.replaceChildren();
    const selected = sortByName(state.authors.filter((a) => state.authorIds.has(a.id)));
    if (!selected.length) { chips.append(h('span', { class: 'hint' }, t('book.authorsNone'))); return; }
    for (const author of selected) {
      const remove = h('button', { type: 'button', 'aria-label': t('authors.removeChip', { name: author.name }), html: icon('close', 12) });
      remove.addEventListener('click', () => { state.authorIds.delete(author.id); renderAuthors(); renderChips(); });
      chips.append(h('span', { class: 'chip' }, author.name, remove));
    }
  }
  authorSearch.addEventListener('input', renderAuthors);
  authorSearch.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.preventDefault(); });

  function toggleNewAuthor(open) {
    panelHost.replaceChildren();
    newAuthorButton.setAttribute('aria-expanded', String(open));
    if (open) panelHost.append(buildNewAuthorPanel());
  }
  newAuthorButton.addEventListener('click', () => toggleNewAuthor(newAuthorButton.getAttribute('aria-expanded') !== 'true'));

  function buildNewAuthorPanel() {
    const name = h('input', { type: 'text', name: 'name', maxlength: 120, autocomplete: 'off' });
    const country = select('countryId', sortByName(countries).map((c) => [c.id, c.name]), { placeholder: t('common.notSet') });
    const birth = h('input', { type: 'date', name: 'birthDate' });
    const death = h('input', { type: 'date', name: 'deathDate' });
    const general = h('p', { class: 'form-error', role: 'alert' });
    const panel = h('div', { class: 'inline-panel', role: 'group', 'aria-label': t('author.newQuick') },
      general,
      h('div', { class: 'field-grid' },
        field({ name: 'name', label: t('author.name'), control: name, required: true, className: 'field--span' }),
        field({ name: 'countryId', label: t('author.nationality'), control: country }),
        field({ name: 'birthDate', label: t('author.birth'), control: birth }),
        field({ name: 'deathDate', label: t('author.death'), control: death })));

    const submit = async () => {
      clearErrors(panel);
      const draft = { name: name.value, countryId: country.value ? Number(country.value) : null, birthDate: birth.value || null, deathDate: death.value || null };
      const errors = validateAuthor(draft, { authors: state.authors, countries });
      if (errors.length) { showErrors(panel, errors); return; }
      try {
        const created = await saveAuthor(draft);
        state.authors.push(created);
        state.authorIds.add(created.id);
        authorSearch.value = '';
        renderAuthors();
        renderChips();
        toggleNewAuthor(false);
        toast(t('author.added', { name: created.name }));
      } catch (error) {
        if (error instanceof ApiError) showErrors(panel, error.errors.length ? error.errors : [{ field: 'name', message: error.message }]);
        else { console.error(error); general.textContent = t('err.unexpected'); }
      }
    };
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.tagName === 'INPUT') { event.preventDefault(); submit(); }
      if (event.key === 'Escape') { event.stopPropagation(); toggleNewAuthor(false); newAuthorButton.focus(); }
    });
    panel.append(h('div', { class: 'inline-panel-actions' },
      button(t('common.cancel'), { variant: 'ghost', onClick: () => toggleNewAuthor(false) }),
      button(t('author.addShort'), { variant: 'primary', onClick: submit })));
    queueMicrotask(() => name.focus());
    return panel;
  }

  /* ---- themes */
  const themeBox = h('div', { class: 'pill-group', role: 'group', 'aria-label': t('book.themes') });
  const newTheme = h('input', { type: 'text', maxlength: 60, placeholder: t('theme.newPlaceholder'), 'aria-label': t('theme.new'), autocomplete: 'off' });
  const themeError = h('p', { class: 'hint hint--error', role: 'alert' });

  function renderThemes() {
    themeBox.replaceChildren();
    for (const theme of sortByName(state.themes)) {
      const box = h('input', { type: 'checkbox', value: theme.id, checked: state.themeIds.has(theme.id) });
      box.addEventListener('change', () => { if (box.checked) state.themeIds.add(theme.id); else state.themeIds.delete(theme.id); });
      themeBox.append(h('label', { class: 'pill pill--toggle' }, box, h('span', {}, theme.name)));
    }
    const existing = new Set(state.themes.map((x) => normalize(x.name)));
    for (const suggestion of SUGGESTED_THEMES) {
      if (existing.has(normalize(suggestion))) continue;
      const add = h('button', { type: 'button', class: 'pill pill--suggest' }, `+ ${suggestion}`);
      add.addEventListener('click', () => addTheme(suggestion));
      themeBox.append(add);
    }
  }

  async function addTheme(name) {
    themeError.textContent = '';
    const clean = name.trim();
    if (!clean) { themeError.textContent = t('err.theme.required'); return; }
    const found = state.themes.find((x) => normalize(x.name) === normalize(clean));
    if (found) { state.themeIds.add(found.id); newTheme.value = ''; renderThemes(); return; }
    try {
      const created = await saveTheme({ name: clean });
      state.themes.push(created);
      state.themeIds.add(created.id);
      newTheme.value = '';
      renderThemes();
    } catch (error) {
      themeError.textContent = error instanceof ApiError ? (error.errors[0]?.message ?? error.message) : t('err.unexpected');
    }
  }
  const addThemeButton = button(t('theme.add'), { variant: 'secondary', onClick: () => addTheme(newTheme.value) });
  addThemeButton.classList.add('btn--small');
  newTheme.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addTheme(newTheme.value); } });

  /* ---- edition type */
  const hasCollection = !!style.collection;
  const standalone = h('input', { type: 'radio', name: 'edition', value: 'standalone', checked: !hasCollection });
  const series = h('input', { type: 'radio', name: 'edition', value: 'series', checked: hasCollection });
  const collection = h('input', { type: 'text', name: 'collection', maxlength: 80, autocomplete: 'off', list: 'collection-names', value: style.collection ?? '' });
  const collectionList = h('datalist', { id: 'collection-names' }, ...collectionNames().map((name) => h('option', { value: name })));
  const collectionField = field({ name: 'collection', label: t('edition.collectionName'), control: collection, hint: t('edition.collectionHint'), required: true });
  const syncEdition = () => { collectionField.hidden = !series.checked; };
  standalone.addEventListener('change', syncEdition);
  series.addEventListener('change', () => { syncEdition(); if (series.checked) collection.focus(); });
  syncEdition();

  /* ---- appearance (cover link, spine color) with a live preview */
  const cover = h('input', { type: 'url', name: 'coverUrl', autocomplete: 'off', placeholder: 'https://...', value: style.coverUrl ?? '' });
  const color = colorPair({ value: style.color ?? '', label: t('appearance.spineColor'), emptyLabel: t('appearance.usePalette'), onChange: () => updatePreview() });
  color.input.id = 'spine-color-hex';
  const previewHost = h('div', { class: 'preview-host', 'aria-hidden': 'true' });
  function updatePreview() {
    const draft = { id: book?.id ?? 0, title: title.value.trim() || t('appearance.sampleTitle'), authorIds: [] };
    previewHost.replaceChildren(
      renderBook(draft, { mode: 'covers', tag: 'div', authors: '', style: { coverUrl: cover.value.trim(), color: color.getValue() }, token: 'preview' }),
      renderBook(draft, { mode: 'spines', tag: 'div', authors: '', style: { coverUrl: '', color: color.getValue() }, token: 'preview' }));
  }
  const refreshPreview = debounce(updatePreview, 250);
  title.addEventListener('input', refreshPreview);
  cover.addEventListener('input', refreshPreview);

  /* ---- technical fields */
  const formSelect = select('form', FORMS, { placeholder: t('common.notSet'), value: book?.form ?? '' });
  const modeSelect = select('mode', MODES, { placeholder: t('common.notSet'), value: book?.mode ?? '' });
  const contentSelect = select('content', CONTENTS, { placeholder: t('common.notSet'), value: book?.content ?? '' });

  /* ---- first reading (new books only) */
  const readingFields = editing ? null : createReadingFields({ allowNone: true, bookTitle: () => title.value.trim() });

  /* ---- assemble */
  const generalError = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { id: 'book-form', novalidate: true, class: 'form' },
    generalError,
    h('div', { class: 'field-grid' },
      field({ name: 'title', label: t('book.title'), control: title, required: true, className: 'field--span' }),
      yearField),

    fieldset(t('book.authors'), { name: 'authorIds', hint: t('book.authorsHint') },
      chips,
      h('div', { class: 'authors-tools' }, authorSearch, newAuthorButton),
      panelHost,
      authorList),

    fieldset(t('book.themes'), { name: 'themeIds', hint: t('book.themesHint') },
      themeBox,
      h('div', { class: 'inline-add' }, newTheme, addThemeButton),
      themeError),

    fieldset(t('edition.title'), { name: 'edition', className: 'fieldset--edition' },
      h('div', { class: 'pill-group' },
        h('label', { class: 'pill pill--choice' }, standalone, h('span', {}, t('edition.standalone'))),
        h('label', { class: 'pill pill--choice' }, series, h('span', {}, t('edition.series')))),
      collectionField, collectionList),

    h('details', { class: 'collapse' },
      h('summary', {}, t('appearance.title')),
      h('div', { class: 'collapse-body appearance' },
        h('div', { class: 'appearance-fields' },
          field({ name: 'coverUrl', label: t('appearance.coverUrl'), control: cover, hint: t('appearance.coverHint') }),
          h('div', { class: 'field', dataset: { field: 'color' } },
            h('label', { for: 'spine-color-hex' }, t('appearance.spineColor')),
            color.el,
            h('p', { class: 'hint' }, t('appearance.spineHint')),
            h('p', { class: 'error', role: 'alert' }))),
        previewHost)),

    h('details', { class: 'collapse' },
      h('summary', {}, t('technical.title')),
      h('div', { class: 'collapse-body field-grid' },
        field({ name: 'form', label: t('book.form'), control: formSelect }),
        field({ name: 'mode', label: t('book.mode'), control: modeSelect }),
        field({ name: 'content', label: t('book.content'), control: contentSelect }))),

    readingFields
      ? fieldset(t('firstReading.title'), { name: 'firstReading', className: 'fieldset--reading', hint: t('firstReading.hint') }, readingFields.el)
      : null);

  updatePreview();
  renderAuthors();
  renderChips();
  renderThemes();

  const saveButton = button(t('common.save'), { variant: 'primary', type: 'submit', form: 'book-form' });
  const dlg = openDialog({
    title: editing ? t('book.edit') : t('book.add'),
    size: 'lg',
    body: form,
    footer: dialogFooter(button(t('common.cancel'), { onClick: () => dlg.close() }), saveButton),
  });
  title.focus();

  /* ---- submit */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    if (readingFields) readingFields.clearErrors();

    const draft = {
      ...(editing ? { id: book.id } : {}),
      title: title.value,
      authorIds: [...state.authorIds],
      publicationYear: parseIntStrict(year.value),
      form: formSelect.value || null,
      mode: modeSelect.value || null,
      content: contentSelect.value || null,
      themeIds: [...state.themeIds],
    };
    const extras = { coverUrl: cover.value.trim(), color: color.getValue(), collection: series.checked ? collection.value.trim() : '' };

    const bookErrors = [
      ...validateBook(draft, { books, authors: state.authors, themes: state.themes }),
      ...validateExtras(extras),
    ];
    if (series.checked && !extras.collection) bookErrors.push({ field: 'collection', message: t('err.collection.required') });

    let readingDraft = null;
    let readingErrors = [];
    if (readingFields?.hasStatus()) {
      readingDraft = readingFields.getValue();
      readingErrors = validateReading(readingDraft, { book: { publicationYear: draft.publicationYear } });
    }
    if (bookErrors.length || readingErrors.length) {
      showErrors(form, bookErrors, { focus: bookErrors.length > 0 });
      if (readingErrors.length) readingFields.showErrors(readingErrors, { focus: bookErrors.length === 0 });
      return;
    }

    let saved = null;
    try {
      saved = await saveBook(draft);
      setBookStyle(saved.id, extras);
      if (readingDraft) await saveReading({ ...readingDraft, bookId: saved.id });
    } catch (error) {
      if (saved && !editing) await deleteBook(saved.id).catch(() => {}); // never leave a half-saved book behind
      if (error instanceof ApiError && error.errors.length) showErrors(form, error.errors);
      else { console.error(error); generalError.textContent = error instanceof ApiError ? error.message : t('err.unexpected'); }
      return;
    }

    const buried = readingFields?.becameAbandoned();
    dlg.close();
    notifyChange();
    if (buried) await buryBook(saved.id);
    else toast(t('common.saved'));
  });
}
