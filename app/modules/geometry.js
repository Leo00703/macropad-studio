/* geometry.js — geometria misurata sulla foto del prodotto e colori dei LED. */

/* ---------- geometria misurata sulla foto dall'alto del prodotto reale ----------
   Unità = pixel della foto, con origine nell'angolo in alto a sinistra della piastra (foto: 95, 305).
   Sagoma: blocco tasti 1297 × 815 con angolo alto‑destra r=220, raccordo concavo r=140 e "coda" a capsula (r=200)
   attorno alla manopola grande. Le basi dei tasti sono quelle viste dall'alto (i cappucci sono in prospettiva). */
export const OUTLINE = 'M65 0H1077A220 220 0 0 1 1297 220V1152A200 200 0 0 1 897 1152V955A140 140 0 0 0 757 815H65A65 65 0 0 1 0 750V65A65 65 0 0 1 65 0Z';
export const KEY_X = [199, 441, 681];
export const KEY_Y = [137, 389, 639];
export const KNOBS = [
  { x: 1097, y: 212, disc: 106, ring: 109, sk: { dx: 0, dy: 4, r: 119 }, hl: -50, mark: { a: -90, r0: 62, r1: 103, w: 9 } },
  { x: 1097, y: 614, disc: 106, ring: 109, sk: { dx: 0, dy: 4, r: 119 }, hl: -27, mark: { a: -90, r0: 62, r1: 103, w: 9 } },
  { x: 1097, y: 1152, disc: 152, ring: 0, bezel: 184, sk: null, hl: -9, mark: { a: -90, r0: 88, r1: 146, w: 11 }, big: true },
];
export const SCREWS = [[55, 53], [52, 750], [900, 800], [1242, 963]];
// colori LED come nel configuratore (codice → css); di fabbrica: layer 1 verde, 2 e 3 bianchi (osservato)
export const LED_CSS = { 0: '#e6ebf2', 1: '#ff3b3b', 2: '#ff9a2e', 3: '#ffe14a', 4: '#34d86b', 5: '#2ee6e6', 6: '#3b6bff', 7: '#b25cff' };
export const LED_NAME = { 0: 'Bianco', 1: 'Rosso', 2: 'Arancio', 3: 'Giallo', 4: 'Verde', 5: 'Ciano', 6: 'Blu', 7: 'Viola' };
export const LED_DEFAULT = ['#34d86b', '#dfe6f0', '#dfe6f0'];
