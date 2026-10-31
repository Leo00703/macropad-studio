/* profile.js — profilo → firme riconoscibili, riepilogo delle azioni, colore LED del layer. */
import { storage } from './dom.js';
import { LED_CSS, LED_DEFAULT, LED_NAME } from './geometry.js';
import { deriveSignatures } from './signatures.js';
import { DEFAULT_LAYOUT, STORE, state } from './state.js';

/* ---------- profilo → firme riconoscibili ---------- */
export function load() {
  const raw = storage.read(STORE);
  state.store = raw && raw.profile && Array.isArray(raw.profile.layers) ? raw : null;
  state.layout = raw && raw.layout && Array.isArray(raw.layout.keys) && raw.layout.keys.length === 9 ? raw.layout : DEFAULT_LAYOUT;
  if (!state.store) { state.sigs = []; state.hosted = new Map(); state.plan = null; return; }
  const d = deriveSignatures(state.store, state.layout);
  Object.assign(state, { signed: d.signed, signEmpty: d.signEmpty, plan: d.plan, hosted: d.hosted, sigs: d.sigs });
}
export function ledInfo(L) {
  const lay = state.store && state.store.profile.layers[L - 1];
  const c = lay && lay.led && lay.led.color;
  const m = lay && lay.led ? lay.led.mode : 1;
  if (m === 5) return { css: LED_CSS[0], name: 'Bianco' };           // "Tutti bianchi": il colore scelto non conta
  if (typeof c === 'number' && LED_CSS[c]) return { css: LED_CSS[c], name: LED_NAME[c] };
  return { css: LED_DEFAULT[L - 1] || LED_DEFAULT[1], name: L === 1 ? 'Verde' : 'Bianco' };   // di fabbrica: layer 1 verde, 2 e 3 bianchi
}
