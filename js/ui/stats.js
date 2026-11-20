// Reading statistics: books read per year / per month, a year-by-month grid and the best rated books.

import { h, clear, formatGrade, pluralize } from '../utils.js';
import { t, MONTHS } from '../strings.js';
import { loadAll } from '../store.js';
import { buildContext, authorLine } from '../model.js';
import { pageHeader, emptyState, segmented } from './page.js';
import { select, field } from './formKit.js';
import { openBookDetail } from './bookDetail.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const view = { mode: 'year', year: null };

function svgEl(name, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

function niceStep(max) {
  if (max <= 5) return 1;
  const raw = max / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
}

/** Accessible bar chart drawn as SVG. Bars can be clicked or focused with the keyboard. */
function barChart({ labels, values, selected = -1, onSelect = null, summary }) {
  const W = 720; const H = 300; const left = 34; const right = 10; const top = 16; const bottom = 34;
  const max = Math.max(1, ...values);
  const step = niceStep(max);
  const top$ = Math.ceil(max / step) * step;
  const plotW = W - left - right; const plotH = H - top - bottom;
  const band = plotW / labels.length; const barW = Math.min(46, band * 0.62);
  const y = (v) => top + plotH - (v / top$) * plotH;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': summary });
  for (let v = 0; v <= top$; v += step) {
    svg.append(svgEl('line', { x1: left, x2: W - right, y1: y(v), y2: y(v), class: 'chart-grid' }));
    const label = svgEl('text', { x: left - 8, y: y(v) + 4, class: 'chart-tick', 'text-anchor': 'end' });
    label.textContent = v;
    svg.append(label);
  }
  values.forEach((value, i) => {
    const x = left + band * i + (band - barW) / 2;
    const clickable = onSelect && value > 0;
    const group = svgEl('g', { class: `chart-bar${i === selected ? ' is-selected' : ''}${clickable ? ' is-clickable' : ''}` });
    if (clickable) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${labels[i]}: ${pluralize(value, 'book')}. ${t('stats.drill')}`);
      group.addEventListener('click', () => onSelect(i));
      group.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } });
    }
    const title = svgEl('title'); title.textContent = `${labels[i]}: ${pluralize(value, 'book')}`;
    group.append(title);
    group.append(svgEl('rect', { x, y: value ? y(value) : y(0) - 2, width: barW, height: value ? y(0) - y(value) : 2, rx: 5, class: value ? 'bar' : 'bar bar--zero' }));
    if (value) {
      const count = svgEl('text', { x: x + barW / 2, y: y(value) - 6, class: 'chart-value', 'text-anchor': 'middle' });
      count.textContent = value;
      group.append(count);
    }
    const name = svgEl('text', { x: x + barW / 2, y: H - 12, class: 'chart-label', 'text-anchor': 'middle' });
    name.textContent = labels[i];
    group.append(name);
    svg.append(group);
  });
  return svg;
}

export async function renderStats(root) {
  const ctx = buildContext(await loadAll());
  const reads = ctx.readings.filter((r) => r.status === 'Read' && ctx.booksById.has(r.bookId));

  root.append(pageHeader({ title: t('stats.title'), subtitle: h('p', { class: 'page-sub' }, t('stats.subtitle')) }));
  if (!reads.length) {
    root.append(emptyState({ title: t('stats.empty.title'), message: t('stats.empty.message'), mood: 'stats' }));
    return;
  }

  const withYear = reads.filter((r) => Number.isInteger(r.yearRead));
  const years = [...new Set(withYear.map((r) => r.yearRead))].sort((a, b) => a - b);
  const countYear = (year) => withYear.filter((r) => r.yearRead === year).length;
  const graded = reads.filter((r) => typeof r.grade === 'number');
  const average = graded.length ? graded.reduce((sum, r) => sum + r.grade, 0) / graded.length : null;
  const bestYear = years.reduce((best, year) => (best === null || countYear(year) > countYear(best) ? year : best), null);

  const tile = (value, label) => h('div', { class: 'tile' }, h('p', { class: 'tile-value' }, value), h('p', { class: 'tile-label' }, label));
  root.append(h('div', { class: 'tiles' },
    tile(String(reads.length), t('stats.totalRead')),
    tile(average === null ? '-' : formatGrade(average), t('stats.averageGrade')),
    tile(bestYear === null ? '-' : `${bestYear}`, bestYear === null ? t('stats.busiestYear') : t('stats.busiestYearCount', { count: pluralize(countYear(bestYear), 'book') }))));

  /* ---- chart */
  if (view.year === null || !years.includes(view.year)) view.year = years[years.length - 1] ?? null;
  const chartHost = h('div', { class: 'chart-host' });
  const chartTitle = h('h2', { class: 'section-title' });
  const yearSelect = select('year', years.map((y) => [y, String(y)]), { value: view.year ?? '' });
  const yearField = field({ name: 'year', label: t('stats.year'), control: yearSelect, className: 'field--compact' });
  yearSelect.addEventListener('change', () => { view.year = Number(yearSelect.value); paintChart(); });
  const modes = segmented({ label: t('stats.mode'), options: [['year', t('stats.byYear')], ['month', t('stats.byMonth')]], value: view.mode, onChange: (m) => { view.mode = m; paintChart(); } });
  const back = h('p', { class: 'hint' });

  root.append(h('section', { class: 'panel', 'aria-labelledby': 'chart-title' },
    h('div', { class: 'panel-head' }, chartTitle, h('div', { class: 'panel-tools' }, modes, yearField)),
    chartHost, back));
  chartTitle.id = 'chart-title';

  function paintChart() {
    clear(chartHost);
    yearField.hidden = view.mode !== 'month';
    if (view.mode === 'year') {
      chartTitle.textContent = t('stats.perYear');
      const labels = years.map(String);
      const values = years.map(countYear);
      chartHost.append(barChart({
        labels, values, summary: t('stats.chartSummaryYear', { list: labels.map((l, i) => `${l}: ${values[i]}`).join(', ') }),
        onSelect: (i) => { view.year = years[i]; view.mode = 'month'; modes.querySelector('input[value="month"]').checked = true; yearSelect.value = String(view.year); paintChart(); },
      }));
      back.textContent = t('stats.drillHint');
      if (withYear.length < reads.length) back.textContent += ` ${t('stats.noYearNote', { count: pluralize(reads.length - withYear.length, 'reading') })}`;
      return;
    }
    chartTitle.textContent = t('stats.perMonth', { year: view.year });
    const inYear = withYear.filter((r) => r.yearRead === view.year);
    const values = MONTHS.map((_, i) => inYear.filter((r) => r.monthRead === i + 1).length);
    const unknown = inYear.filter((r) => !r.monthRead).length;
    const labels = [...MONTHS.map((m) => m.slice(0, 3)), t('stats.noMonth')];
    const all = [...values, unknown];
    chartHost.append(barChart({ labels, values: all, summary: t('stats.chartSummaryMonth', { year: view.year, list: labels.map((l, i) => `${l}: ${all[i]}`).join(', ') }) }));
    back.textContent = unknown ? t('stats.noMonthNote') : '';
  }
  paintChart();

  /* ---- year x month grid */
  const maxCell = Math.max(1, ...years.flatMap((y) => [...MONTHS.map((_, i) => withYear.filter((r) => r.yearRead === y && r.monthRead === i + 1).length), withYear.filter((r) => r.yearRead === y && !r.monthRead).length]));
  const grid = h('table', { class: 'heat' },
    h('caption', { class: 'sr-only' }, t('stats.gridCaption')),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('stats.year')), ...MONTHS.map((m) => h('th', { scope: 'col' }, m.slice(0, 3))), h('th', { scope: 'col' }, t('stats.noMonth')))),
    h('tbody', {}, ...[...years].reverse().map((year) => {
      const cells = [...MONTHS.map((_, i) => withYear.filter((r) => r.yearRead === year && r.monthRead === i + 1).length), withYear.filter((r) => r.yearRead === year && !r.monthRead).length];
      return h('tr', {}, h('th', { scope: 'row' }, year), ...cells.map((n) => h('td', { class: 'heat-cell', dataset: { level: n === 0 ? '0' : String(Math.min(4, Math.ceil((n / maxCell) * 4))) }, title: pluralize(n, 'book') }, n || '')));
    })));
  root.append(h('section', { class: 'panel', 'aria-labelledby': 'grid-title' },
    h('div', { class: 'panel-head' }, h('h2', { class: 'section-title', id: 'grid-title' }, t('stats.gridTitle'))),
    h('div', { class: 'table-wrap' }, grid)));

  /* ---- best rated */
  const top = [...graded].sort((a, b) => b.grade - a.grade || (b.yearRead ?? 0) - (a.yearRead ?? 0)).slice(0, 10);
  if (top.length) {
    root.append(h('section', { class: 'panel', 'aria-labelledby': 'top-title' },
      h('div', { class: 'panel-head' }, h('h2', { class: 'section-title', id: 'top-title' }, t('stats.topTitle'))),
      h('ol', { class: 'top-list' }, ...top.map((r) => {
        const book = ctx.booksById.get(r.bookId);
        return h('li', {}, h('button', { type: 'button', class: 'link-btn', on: { click: () => openBookDetail(book.id) } }, book.title),
          h('span', { class: 'muted' }, authorLine(book, ctx)), h('strong', {}, formatGrade(r.grade)));
      }))));
  }
}
