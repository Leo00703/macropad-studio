/* press.js — stati di pressione e rotazione dei controlli. */
import { ctrl, knobAngle, state } from '../core/state.js';
import { MIN_SHOW, isTurn } from './labels.js';
import { ripple } from './pad.js';

const live = {};        // canale → { ids:Set, since }   (un canale = una sorgente: tastiera, media, rotella…)
/* Le classi "premuto" si DERIVANO dai canali attivi a ogni cambio: nessun controllo può restare bloccato.
   Le rotazioni non "premono" mai la manopola: la fanno solo girare (vedi rotate). */
function render() {
  const down = new Set();
  for (const st of Object.values(live)) for (const id of st.ids) { const c = ctrl.get(id); if (c && !isTurn(c)) down.add(c.el); }
  for (const c of ctrl.values()) c.el.classList.toggle('down', down.has(c.el));
}
export function clearChannel(ch) {
  if (!live[ch]) return;
  delete live[ch];
  render();
}
/* tick = true: ogni chiamata è un NUOVO scatto (impulso), anche se il controllo era già nel canale */
export function press(ch, hits, tick) {
  const prev = live[ch] ? live[ch].ids : new Set();
  // un controllo già rilasciato che resta acceso solo per il tempo minimo di visibilità si spegne subito se ne arriva
  // un altro: con tocchi alternati veloci non si vedono due controlli accesi insieme (i tenuti restano, per gli accordi)
  for (const k of Object.keys(live)) if (k !== ch && live[k].released) delete live[k];
  live[ch] = { ids: new Set(hits.map((x) => x.id)), since: performance.now() };
  render();
  for (const x of hits) {
    const c = ctrl.get(x.id);
    if (!c) continue;
    if (isTurn(c)) { if (tick || !prev.has(x.id)) rotate(c.knob, c.act === 0 ? -1 : 1); }
    else if (!prev.has(x.id)) ripple(c, 1);
  }
}
export function release(ch, force, minWait) {
  const st = live[ch];
  if (!st) return;
  st.released = true;
  const wait = force ? 0 : Math.max(minWait || 0, MIN_SHOW - (performance.now() - st.since));
  setTimeout(() => { if (live[ch] === st) clearChannel(ch); }, wait);
}
const turnTimer = [null, null, null];
export function rotate(k, dir) {
  knobAngle[k] += dir * 18;
  state.rotCount[k]++;                                  // contatore per le verifiche (nessun effetto sull'interfaccia)
  const any = [...ctrl.values()].find((c) => c.kind === 'knob' && c.knob === k);
  if (!any) return;
  for (const s of any.spin) s.style.transform = `rotate(${knobAngle[k]}deg)`;
  any.el.classList.add('turn');
  any.arrow.textContent = dir < 0 ? '↺' : '↻';
  any.arrow.classList.remove('go'); void any.arrow.getBoundingClientRect(); any.arrow.classList.add('go');
  clearTimeout(turnTimer[k]);
  turnTimer[k] = setTimeout(() => any.el.classList.remove('turn'), 150);
  ripple(any, 0.55);
}
