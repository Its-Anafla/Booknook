// Shelf customization drawer: background, wood, spine palette, string lights and decorations.
// It stays open beside the shelf, so every change can be seen right away.

import { h, isHexColor } from '../utils.js';
import { t } from '../strings.js';
import { getPrefs, updatePrefs, addDecor, PALETTES, SHELF_BACKGROUNDS, WOODS } from '../prefs.js';
import { DECOR_TYPES, decorImage } from '../decor.js';
import { openDialog } from './modal.js';
import { colorPair } from './formKit.js';
import { toast } from './toast.js';

let openInstance = null;

export function openCustomize({ onChange, currentOrder }) {
  if (openInstance) { openInstance.close(); }
  const prefs = () => getPrefs();
  const apply = (patch) => { updatePrefs(patch); onChange(); };

  /* ---- swatch rows (radio-like) */
  function swatches({ name, label, options, current, pick }) {
    const row = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label });
    for (const option of options) {
      const input = h('input', { type: 'radio', name, value: option.value, checked: current().toLowerCase() === option.value.toLowerCase() });
      input.addEventListener('change', () => pick(option.value));
      row.append(h('label', { class: 'swatch', title: option.label }, input, h('span', { class: 'swatch-dot', css: { '--c': option.value } }), h('span', { class: 'sr-only' }, option.label)));
    }
    return row;
  }

  const bgRow = swatches({ name: 'shelf-bg', label: t('custom.background'), options: SHELF_BACKGROUNDS, current: () => prefs().shelf.bg, pick: (value) => { apply({ shelf: { bg: value } }); bgColor.setValue(''); } });
  const bgColor = colorPair({
    value: '', label: t('custom.customColor'), allowEmpty: false,
    onChange: (value) => {
      if (!isHexColor(value)) return;
      apply({ shelf: { bg: value.length === 4 ? `#${[...value.slice(1)].map((c) => c + c).join('')}` : value } });
      bgRow.querySelectorAll('input').forEach((input) => { input.checked = false; });
    },
  });
  const woodRow = swatches({ name: 'shelf-wood', label: t('custom.wood'), options: WOODS, current: () => prefs().shelf.wood, pick: (value) => apply({ shelf: { wood: value } }) });

  /* ---- spines: palette or each spine on its own */
  const paletteList = h('div', { class: 'palettes', role: 'radiogroup', 'aria-label': t('custom.palette') });
  for (const [key, palette] of Object.entries(PALETTES)) {
    const input = h('input', { type: 'radio', name: 'palette', value: key, checked: prefs().palette === key });
    input.addEventListener('change', () => apply({ palette: key, spineMode: 'palette' }));
    paletteList.append(h('label', { class: 'palette' }, input,
      h('span', { class: 'palette-name' }, palette.label),
      h('span', { class: 'palette-colors', 'aria-hidden': 'true' }, ...palette.colors.map((c) => h('i', { css: { '--c': c } })))));
  }
  const modePalette = h('input', { type: 'radio', name: 'spine-mode', value: 'palette', checked: prefs().spineMode === 'palette' });
  const modeCustom = h('input', { type: 'radio', name: 'spine-mode', value: 'custom', checked: prefs().spineMode === 'custom' });
  const syncMode = () => { paletteList.classList.toggle('is-off', modeCustom.checked); customHint.hidden = !modeCustom.checked; };
  const customHint = h('p', { class: 'hint' }, t('custom.ownColorsHint'));
  modePalette.addEventListener('change', () => { apply({ spineMode: 'palette' }); syncMode(); });
  modeCustom.addEventListener('change', () => { apply({ spineMode: 'custom' }); syncMode(); });

  /* ---- lights */
  const lights = h('input', { type: 'checkbox', name: 'lights', checked: prefs().shelf.lights });
  lights.addEventListener('change', () => apply({ shelf: { lights: lights.checked } }));

  /* ---- decorations */
  const decorGrid = h('div', { class: 'decor-grid' });
  for (const { type, label } of DECOR_TYPES) {
    const add = h('button', { type: 'button', class: 'decor-pick' },
      h('span', { class: 'decor-thumb', 'aria-hidden': 'true' }, decorImage(type)),
      h('span', {}, label));
    add.addEventListener('click', () => {
      updatePrefs({ order: currentOrder() }); // pin the current book order first, so the new item lands after the books
      addDecor(type);
      onChange();
      toast(t('decor.added', { name: label }));
    });
    decorGrid.append(add);
  }

  const section = (title, ...children) => h('section', { class: 'drawer-section' }, h('h3', {}, title), ...children);
  const content = h('div', { class: 'drawer' },
    section(t('custom.background'), bgRow, h('div', { class: 'color-line' }, h('span', {}, t('custom.customColor')), bgColor.el)),
    section(t('custom.wood'), woodRow),
    section(t('custom.spines'),
      h('div', { class: 'mode-choice' },
        h('label', { class: 'check' }, modePalette, h('span', {}, t('custom.usePalette'))),
        h('label', { class: 'check' }, modeCustom, h('span', {}, t('custom.ownColors')))),
      paletteList, customHint),
    section(t('custom.lights'), h('label', { class: 'check' }, lights, h('span', {}, t('custom.lightsLabel')))),
    section(t('custom.decor'), h('p', { class: 'hint' }, t('custom.decorHint')), decorGrid));
  syncMode();

  const dlg = openDialog({
    title: t('custom.title'), body: content, size: 'drawer', className: 'dialog--drawer', modal: false,
    onClose: () => { openInstance = null; },
  });
  openInstance = dlg;
  dlg.dialog.querySelector('input:checked, button')?.focus();
  return dlg;
}
