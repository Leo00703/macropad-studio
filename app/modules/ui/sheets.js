/* sheets.js — fogli ancorati ai pulsanti (invio, LED, impostazioni). */
import { $, btn, el } from './dom.js';
import { closeDropdowns } from './dropdown.js';
import { renderLeds } from './leds.js';
import { renderSend } from './send.js';
import { renderSettings } from './settings.js';

export function renderSheets() {
  if (!$('#send').hidden) renderSend();
  if (!$('#leds').hidden) renderLeds();
  if (!$('#settings').hidden) renderSettings();
}
export const closeBtn = (fn) => btn('✕', 'x2', fn, { 'aria-label': 'Chiudi' });
export const dotEl = (cls) => el('i', { class: 'dot ' + (cls || '') });
export function progressBar(p) {
  return el('div', { class: 'prog' }, el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.round(100 * p.i / p.n) + '%' })),
    el('span', {}, p.i + ' / ' + p.n + ' · ' + p.label));
}
/* posiziona un foglio sotto (o sopra) il pulsante che lo apre: la card nasce dove l'utente ha cliccato */
export function anchorSheet(box, anchor, where) {
  // limiti reali: sotto le barre in alto (titolo, layer) e sopra quelle in basso (connessioni, azioni recenti)
  const tops = ['.layers', '.brand'].map((q) => { const e = $(q); return e ? e.getBoundingClientRect().bottom : 0; });
  const topLimit = Math.max(66, ...tops.map((v) => v + 10));
  const bots = ['.conncard', '#last', '#diagBtn'].map((q) => { const e = $(q); const rr = e && e.getBoundingClientRect(); return rr && rr.width ? rr.top : innerHeight; });
  const botLimit = Math.min(...bots) - 10;
  const room = (from, to) => Math.max(150, Math.round(to - from - 44));          // 44 = padding del foglio
  if (innerWidth < 760) {                                                          // telefono: foglio a tutta larghezza
    box.style.cssText = 'left:12px;right:12px;width:auto;top:' + topLimit + 'px;bottom:auto;';
    box.style.setProperty('--smax', room(topLimit, botLimit) + 'px');
    return;
  }
  const r = anchor && anchor.getBoundingClientRect();
  if (!r || !r.width) { box.style.cssText = ''; box.style.setProperty('--smax', room(topLimit, botLimit) + 'px'); return; }
  if (where === 'above') {
    const base = Math.min(r.top, botLimit + 10);                                   // sopra anche alle azioni recenti, se impilate
    box.style.top = 'auto'; box.style.right = 'auto';
    box.style.bottom = Math.round(innerHeight - base + 12) + 'px';
    box.style.left = Math.max(12, Math.round(r.left)) + 'px';
    box.style.setProperty('--smax', room(topLimit, base - 12) + 'px');
  } else {
    const top = Math.round(Math.max(r.bottom + 12, topLimit));
    box.style.bottom = 'auto'; box.style.left = 'auto';
    box.style.top = top + 'px';
    box.style.right = Math.max(12, Math.round(innerWidth - r.right)) + 'px';
    box.style.setProperty('--smax', room(top, botLimit) + 'px');
  }
}
/* il contenuto dei fogli scorre da solo (senza barre visibili) se lo spazio non basta; la cornice resta intera */
export function fillSheet(box, kids) {
  const body = el('div', { class: 'sbody' }, ...kids);
  const fade = () => body.classList.toggle('more', body.scrollHeight - body.scrollTop - body.clientHeight > 4);   // sfumatura se c'è altro sotto
  body.addEventListener('scroll', fade, { passive: true });
  box.replaceChildren(body);
  requestAnimationFrame(fade);
}
export const hideSheets = (except) => { for (const id of ['#send', '#leds', '#settings']) if (id !== except) $(id).hidden = true; closeDropdowns(); };
