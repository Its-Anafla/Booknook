// Shelf decorations. The pictures live in the assets/ folder (transparent WebP files).
// To add a new one: drop the image in assets/ and add a line to DECOR_TYPES.
// width/height are the size on the shelf in pixels (keep the image proportions).

import { h } from './utils.js';

export const DECOR_TYPES = [
  { type: 'plant-philodendron', label: 'Philodendron', file: 'assets/plant-philodendron.webp', width: 142, height: 118 },
  { type: 'hourglass', label: 'Hourglass', file: 'assets/hourglass.webp', width: 58, height: 132 },
  { type: 'trunk', label: 'Treasure trunk', file: 'assets/trunk.webp', width: 140, height: 84 },
  { type: 'globe', label: 'Globe', file: 'assets/globe.webp', width: 98, height: 146 },
  { type: 'bust', label: 'Bust', file: 'assets/bust.webp', width: 69, height: 118 },
  { type: 'statue-fragment', label: 'Statue fragment', file: 'assets/statue-fragment.webp', width: 88, height: 112 },
  { type: 'plant-pothos', label: 'Pothos', file: 'assets/plant-pothos.webp', width: 140, height: 128 },
  { type: 'plant-peperomia', label: 'Peperomia', file: 'assets/plant-peperomia.webp', width: 107, height: 120 },
  { type: 'candle-holder', label: 'Candlestick', file: 'assets/candle-holder.webp', width: 48, height: 136 },
  { type: 'plant-fern', label: 'Fern', file: 'assets/plant-fern.webp', width: 143, height: 104 },
  { type: 'candle-pillar', label: 'Pillar candle', file: 'assets/candle-pillar.webp', width: 36, height: 92 },
  { type: 'candle-jar', label: 'Jar candle', file: 'assets/candle-jar.webp', width: 69, height: 84 },
];

export const isDecorType = (type) => DECOR_TYPES.some((d) => d.type === type);
const spec = (type) => DECOR_TYPES.find((d) => d.type === type);

export const decorWidth = (type) => spec(type)?.width ?? 90;
export const decorHeight = (type) => spec(type)?.height ?? 110;
export const decorLabel = (type) => spec(type)?.label ?? type;

export function decorImage(type) {
  return h('img', { src: spec(type)?.file ?? '', alt: '', draggable: 'false', decoding: 'async' });
}

/** A cobweb for the top-left corner. Mirror it with CSS (scaleX(-1)) for the right corner. */
export function cobwebSvg(size = 220) {
  const angles = [0, 18, 36, 54, 72, 90];
  const rings = [0.22, 0.42, 0.62, 0.82, 1];
  const round = (n) => Math.round(n * 10) / 10;
  const point = (angle, radius) => [round(Math.cos((angle * Math.PI) / 180) * radius * size), round(Math.sin((angle * Math.PI) / 180) * radius * size)];
  let path = '';
  for (const angle of angles) path += `M0 0L${point(angle, 1).join(' ')}`;
  for (const ring of rings) {
    for (let i = 0; i < angles.length - 1; i++) {
      const [x1, y1] = point(angles[i], ring);
      const [x2, y2] = point(angles[i + 1], ring);
      const [cx, cy] = point((angles[i] + angles[i + 1]) / 2, ring * 0.8);
      path += `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`;
    }
  }
  return `<svg class="cobweb" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`;
}
