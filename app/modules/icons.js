/* icons.js — costruzione degli elementi SVG dei simboli (DOM). */
import { el, h } from './dom.js';
import { ICONS } from './icon-map.js';

/* icona SVG a partire da un elenco di forme [tag, attributi]: l'unico modo in cui si costruisce SVG (niente markup in stringhe) */
export const svgIcon = (shapes) => h('svg', { viewBox: '0 0 24 24', focusable: 'false' }, shapes.map(([tag, attrs]) => h(tag, attrs)));
/* icona come elemento HTML in linea (scheda, fogli) */
export function iconEl(name, cls) {
  const s = el('span', { class: 'vic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
  s.append(svgIcon((ICONS[name] || []).map(([kind, d]) => ['path', { class: kind, d }])));
  return s;
}

export const TYPE_ICONS = {
  keys: [['rect', { x: 2.5, y: 6, width: 19, height: 12, rx: 3 }], ['path', { d: 'M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7 14h10' }]],
  media: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M10.2 8.8l5 3.2-5 3.2z' }]],
  mouse: [['rect', { x: 6.5, y: 3, width: 11, height: 18, rx: 5.5 }], ['path', { d: 'M12 3v6.5' }]],
  none: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M6 18L18 6' }]],
};
