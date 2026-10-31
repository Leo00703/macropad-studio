/* icons.js — libreria di simboli SVG per le azioni. */
import { el, h } from './dom.js';
import { hidMask, modLabel } from './keymap.js';

/* ---------- simboli delle azioni ----------
   Griglia 24 × 24, tratto 1.9 con estremi arrotondati, stessa grammatica dei riquadri "Cosa fa". 'f' = pieno, 's' = tratto.
   Sui tasti sostituiscono il testo quando l'azione ha un simbolo riconoscibile; altrimenti resta il testo. */
const SPK = 'M3 9.5h3.8L12 5v14l-5.2-4.5H3z';
const MBODY = 'M12 3a5.5 5.5 0 0 1 5.5 5.5v7a5.5 5.5 0 0 1-11 0v-7A5.5 5.5 0 0 1 12 3z';
const WBODY = 'M9 3a4.6 4.6 0 0 1 4.6 4.6v8.8a4.6 4.6 0 0 1-9.2 0V7.6A4.6 4.6 0 0 1 9 3z';
export const ICONS = {
  play_pause: [['f', 'M3.5 5.5v13l8.5-6.5z'], ['f', 'M15 5.5h2.7v13H15zM19.6 5.5h2.7v13h-2.7z']],
  vol_up: [['f', SPK], ['s', 'M16.5 12h5M19 9.5v5']],
  vol_down: [['f', SPK], ['s', 'M16.5 12h5']],
  mute: [['f', SPK], ['s', 'M16.5 9.5l5 5M21.5 9.5l-5 5']],
  next: [['f', 'M4.5 5.5v13l9.5-6.5z'], ['f', 'M16.8 5.5h2.7v13h-2.7z']],
  prev: [['f', 'M19.5 5.5v13L10 12z'], ['f', 'M4.5 5.5h2.7v13H4.5z']],
  click_left: [['f', 'M12 3a5.5 5.5 0 0 0-5.5 5.5v1.7H12z'], ['s', MBODY], ['s', 'M12 3v7.2M6.5 10.2h11']],
  click_right: [['f', 'M12 3a5.5 5.5 0 0 1 5.5 5.5v1.7H12z'], ['s', MBODY], ['s', 'M12 3v7.2M6.5 10.2h11']],
  click_mid: [['s', MBODY], ['f', 'M10.7 5.6h2.6v4.2h-2.6z'], ['s', 'M6.5 10.2h11']],
  wheel_up: [['s', WBODY], ['f', 'M7.8 6.4h2.4v3.8H7.8z'], ['s', 'M19 19V6.5M15.6 9.9L19 6.5l3.4 3.4']],
  wheel_down: [['s', WBODY], ['f', 'M7.8 6.4h2.4v3.8H7.8z'], ['s', 'M19 5v12.5M15.6 14.1L19 17.5l3.4-3.4']],
  arrow_right: [['s', 'M4 12h15M13 6l6 6-6 6']],
  arrow_left: [['s', 'M20 12H5M11 6l-6 6 6 6']],
  arrow_up: [['s', 'M12 20V5M6 11l6-6 6 6']],
  arrow_down: [['s', 'M12 4v15M6 13l6 6 6-6']],
  enter: [['s', 'M19.5 5v7.5H6.5M11 8l-4.5 4.5L11 17']],
  backspace: [['s', 'M9 6h11.5v12H9l-5.5-6z'], ['s', 'M12.8 9.6l4.8 4.8M17.6 9.6l-4.8 4.8']],
  delete: [['s', 'M15 6H3.5v12H15l5.5-6z'], ['s', 'M7 9.6l4.8 4.8M11.8 9.6L7 14.4']],
  tab: [['s', 'M3.5 12h13M12.5 7l5 5-5 5M20.5 6v12']],
  space: [['s', 'M4 10.5v5.5h16v-5.5']],
  copy: [['s', 'M9 9h11v11H9z'], ['s', 'M5 15V4h11']],
  paste: [['s', 'M6.5 5.5h11V20h-11z'], ['f', 'M9.5 3h5v4h-5z'], ['s', 'M9.8 11.5h4.4M9.8 15h4.4']],
  cut: [['s', 'M6 4.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM6 14.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z'], ['s', 'M8 8.4L20 18M8 15.6L20 6']],
  undo: [['s', 'M9 5.5L4 10.5l5 5M4.5 10.5H15a4.8 4.8 0 0 1 0 9.6h-3']],
  redo: [['s', 'M15 5.5l5 5-5 5M19.5 10.5H9a4.8 4.8 0 0 0 0 9.6h3']],
  save: [['s', 'M5 4h11l3 3v13H5z'], ['s', 'M8 4v5h7V4M8 20v-6h8v6']],
};
const MEDIA_ICON = { 0xCD: 'play_pause', 0xE9: 'vol_up', 0xEA: 'vol_down', 0xE2: 'mute', 0xB5: 'next', 0xB6: 'prev' };
const NAV_ICON = { 0x4F: 'arrow_right', 0x50: 'arrow_left', 0x51: 'arrow_down', 0x52: 'arrow_up', 0x28: 'enter', 0x2A: 'backspace', 0x4C: 'delete', 0x2B: 'tab', 0x2C: 'space' };
const CTRL_ICON = { 0x06: 'copy', 0x19: 'paste', 0x1B: 'cut', 0x1D: 'undo', 0x1C: 'redo', 0x16: 'save' };
/* nome del simbolo per un'azione (o null: si mostra il testo) */
export function iconFor(a) {
  if (!a) return null;
  if (a.t === 'media') return MEDIA_ICON[a.usage] || null;
  if (a.t === 'mouse') {
    if (a.wheel) return a.wheel > 0 ? 'wheel_up' : 'wheel_down';          // con modificatori: simbolo + didascalia (iconCap)
    return a.buttons & 1 ? 'click_left' : a.buttons & 2 ? 'click_right' : a.buttons & 4 ? 'click_mid' : null;
  }
  if (a.t === 'keys' && a.steps && a.steps.length === 1 && !a.delay) {
    const s = a.steps[0], m = ((s.mod || 0) | ((s.mod || 0) >> 4)) & 0x0F;
    if (m === 0) return NAV_ICON[s.key] || null;
    if (m === 1) return CTRL_ICON[s.key] || null;
  }
  return null;
}
export const iconCap = (a) => (a && a.t === 'mouse' && a.wheel && a.mod ? modLabel(hidMask(a.mod)) : '');
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
