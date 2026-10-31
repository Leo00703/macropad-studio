/* store.js — profilo in memoria, codifica dei pacchetti, confronto con quanto inviato al pad. */
import { pushHostmap } from './bridge.js';
import { $, storage } from './dom.js';
import { encodeOptions, frameHexMap, pendingKeys } from './frames.js';
import { paintLabels } from './labels.js';
import { load } from './profile.js';
import { SEND } from './send.js';
import { renderSheets } from './sheets.js';
import { SENT_KEY, STORE, state } from './state.js';

export function ensureStore() {
  if (state.store) return state.store;
  state.store = { profile: { name: 'Profilo', signature: true, layers: [1, 2, 3].map(() => ({ controls: {}, led: { color: 4, mode: 1 } })) }, layout: state.layout };
  return state.store;
}
export const layerControls = (L) => { const lay = ensureStore().profile.layers[L - 1]; return lay.controls || (lay.controls = {}); };
export const encOpts = () => encodeOptions(state.store.profile, state.layout);
export const allIds = () => [...state.layout.keys, ...state.layout.knobs.flat()];
/* motivo per cui un controllo non è codificabile ("layer:id" → messaggio), aggiornato a ogni confronto col pad */
export const encodeErrors = new Map();
export function currentFrameHexMap() {
  const { hex, errors } = frameHexMap(state.store.profile, state.layout);
  encodeErrors.clear();
  for (const [k, v] of errors) encodeErrors.set(k, v);
  return hex;
}
export const readSent = () => storage.read(SENT_KEY);
export const writeSent = (m) => storage.write(SENT_KEY, m);
/* controlli il cui codice è cambiato dall'ultimo invio. Al primo uso si assume che il pad coincida col profilo. */
export function updatePending(init) {
  if (!state.store) { SEND.pending = []; paintSendChip(); return; }
  const cur = currentFrameHexMap();
  let snap = readSent();
  if (!snap && init) { writeSent(cur); snap = cur; }          // primo uso: si assume che il pad coincida col profilo
  const r = pendingKeys(cur, snap);
  if (r.grew) writeSent(r.snap);
  SEND.pending = r.pending;
  paintSendChip();
  renderSheets();
}
export function paintSendChip() {
  const c = $('#chipSend');
  if (!c) return;
  const n = SEND.pending.length;
  c.className = 'chip clickable ' + (n ? 'warn' : 'ok');
  c.lastElementChild.textContent = n ? 'Da inviare al pad · ' + n : 'Pad aggiornato';
  c.title = n ? 'Ci sono controlli modificati non ancora scritti sul macropad. Clicca per inviarli.' : 'Il profilo coincide con quanto inviato al pad.';
}
export function commit() {
  storage.write(STORE, { profile: state.store.profile, layout: state.store.layout || state.layout });
  load(); paintLabels(); pushHostmap(false); updatePending();
}
