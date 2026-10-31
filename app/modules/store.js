/* store.js — profilo in memoria, codifica dei pacchetti, confronto con quanto inviato al pad. */
import { pushHostmap } from './bridge.js';
import { $, storage } from './dom.js';
import { paintLabels } from './labels.js';
import { load } from './profile.js';
import { SEND } from './send.js';
import { renderSheets } from './sheets.js';
import { S, SENT_KEY, STORE } from './state.js';

export function ensureStore() {
  if (S.store) return S.store;
  S.store = { profile: { name: 'Profilo', signature: true, layers: [1, 2, 3].map(() => ({ controls: {}, led: { color: 4, mode: 1 } })) }, layout: S.layout };
  return S.store;
}
export const layerControls = (L) => { const lay = ensureStore().profile.layers[L - 1]; return lay.controls || (lay.controls = {}); };
export function encOpts() {
  const p = S.store.profile;
  const signature = !!p.signature;
  const plan = signature ? MP.signPlan(p, S.layout) : null;
  return { signature, signEmpty: signature && p.signEmpty !== false, plan,
    hosted: plan && p.hostActions !== false ? plan.hosted : null };
}
export const allIds = () => [...S.layout.keys, ...S.layout.knobs.flat()];
/* pacchetti di un controllo (senza "azzera"), in esadecimale; UNENCODABLE se non codificabile (es. macro troppo lunga):
   il motivo resta in encodeErrors e viene mostrato al momento dell'invio */
export const UNENCODABLE = '!non-codificabile';
export const encodeErrors = new Map();          // "layer:id" → messaggio dell'errore del protocollo
function controlHex(o, L, id) {
  const key = L + ':' + id;
  try {
    const a = S.store.profile.layers[L - 1].controls[id] || null;
    const hex = MP.encodeActionFrames(id, L, a, o).map((b) => MP.hex(b)).join('|');
    encodeErrors.delete(key);
    return hex;
  } catch (err) { encodeErrors.set(key, err.message); return UNENCODABLE; }
}
export function frameHexMap() {
  const o = encOpts(), out = {};
  for (let L = 1; L <= 3; L++) for (const id of allIds()) out[L + ':' + id] = controlHex(o, L, id);
  for (let L = 1; L <= 3; L++) {
    const led = S.store.profile.layers[L - 1].led;
    out['led:' + L] = led && typeof led.color === 'number' ? MP.hex(MP.led(L, led.color, led.mode | 0)) : '';
  }
  return out;
}
export const readSent = () => storage.read(SENT_KEY);
export const writeSent = (m) => storage.write(SENT_KEY, m);
/* controlli il cui codice è cambiato dall'ultimo invio. Al primo uso si assume che il pad coincida col profilo. */
export function updatePending(init) {
  if (!S.store) { SEND.pending = []; paintSendChip(); return; }
  const cur = frameHexMap();
  let snap = readSent();
  if (!snap) { if (!init) snap = {}; else { writeSent(cur); snap = cur; } }
  // chiavi nuove rispetto all'istantanea (es. i LED, aggiunti dopo): si assume che il pad le abbia già
  let grew = false;
  for (const k of Object.keys(cur)) if (snap[k] === undefined && Object.keys(snap).length) { snap[k] = cur[k]; grew = true; }
  if (grew) writeSent(snap);
  SEND.pending = Object.keys(cur).filter((k) => cur[k] !== (snap[k] || ''));
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
  storage.write(STORE, { profile: S.store.profile, layout: S.store.layout || S.layout });
  load(); paintLabels(); pushHostmap(false); updatePending();
}
