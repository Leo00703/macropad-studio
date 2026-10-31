/* recognition.js — riconoscimento degli eventi del pad (tasti, media, rotella, pulsanti). */
import { paintLink } from './bridge.js';
import { trace } from './diag.js';
import { MEDIA_NAME, isSigVk, modBit, modLabel, vkName } from './keymap.js';
import { isTurn, setDetected, shownLayer } from './labels.js';
import { chooseLayer, hitsInLayer, matchKeySignatures } from './matching.js';
import { clearChannel, press, release } from './press.js';
import { ctrl, state } from './state.js';
import { note, showTags } from './tags.js';

/* ---------- riconoscimento degli eventi ---------- */
/* Il layer FISICO del pad non viene comunicato: si deduce. Un evento che appartiene a un solo layer (ogni controllo
   firmato, o un'azione presente in un solo layer) lo stabilisce. Un evento ambiguo tra più layer si risolve con il
   layer fisico già noto — NON con quello visualizzato — e solo in mancanza si usa il layer scelto dall'utente. */
function learnLayer(n) {
  state.padLayer = n; state.padKnown = true;
  if (state.layerMode === 'auto') setDetected(n);
}
export function pick(cands) {
  if (!cands.length) return { hits: [], layer: shownLayer() };
  const layers = [...new Set(cands.map((c) => c.layer))];
  const layer = chooseLayer(layers, state);
  if (layers.length === 1) learnLayer(layer);
  return Object.assign(hitsInLayer(cands, layer), { layer });
}

/* Tastiera: più sequenze in parallelo (due controlli premuti insieme non si confondono).
   Ogni sequenza è un possibile "macro" in corso: tasti ricevuti finora + tasti ancora giù. */
let streams = [];
let streamSeq = 0;
const matchSeq = (seq) => matchKeySignatures(state.sigs, seq);
const seqName = (seq) => seq.map((b) => (modLabel(b.mods) ? modLabel(b.mods) + '+' : '') + vkName(b.vk)).join(' ');
/* Disambiguazione per durata: una ROTAZIONE della manopola ha pressione e rilascio nello stesso istante, un tasto o
   la pressione della manopola restano giù almeno ~60 ms (osservato: 78–170 ms). Il ponte usa un orologio ad alta
   risoluzione (QueryPerformanceCounter); con quello vecchio, a passi di 15,6 ms, 20 ms copre comunque un passo.
   Si applica solo quando la stessa azione è su controlli di ruolo diverso (es. Volume − su tasto 4 e su manopola ↺). */
const TURN_MAX_MS = 20;
const PENDING_MS = 30;
/* Timer di attesa con tolleranza: se il thread era occupato e il timer scatta in ritardo, i messaggi del ponte già
   arrivati potrebbero non essere ancora stati elaborati → si concede una seconda attesa breve. */
const GRACE_MS = 20;
const LATE_MS = 10;
function pendingTimer(fn) {
  const handle = { id: 0 };
  const due = performance.now() + PENDING_MS;
  handle.id = setTimeout(() => {
    if (performance.now() - due <= LATE_MS) { fn(); return; }              // puntuale: si decide ora
    handle.id = setTimeout(fn, GRACE_MS);                                   // in ritardo: un'ultima attesa breve
  }, PENDING_MS);
  return handle;
}
const roleOf = (id) => isTurn(ctrl.get(id)) ? 'turn' : 'hold';
const needsTiming = (hits) => new Set(hits.map((x) => roleOf(x.id))).size > 1;
function byRole(hits, role) {
  const f = hits.filter((x) => roleOf(x.id) === role);
  const use = f.length ? f : hits;
  return use.map((x) => ({ id: x.id, maybe: use.length > 1 }));
}

function resolveStream(st, role) {
  const pend = st.pending;
  if (!pend) return;
  st.pending = null;
  if (st.ptimer) clearTimeout(st.ptimer.id);
  const hits = byRole(pend.p.hits, role);
  press('kbd' + st.id, hits);
  note(Object.assign({}, pend.p, { hits }), null);
  st.matched = true; st.noted = true;
}
function updateStream(st, announce) {
  if (state.signed && st.seq.length < 2 && st.seq.every((b) => isSigVk(b.vk))) return;     // firma a metà: manca il secondo tasto
  const p = pick(matchSeq(st.seq));
  if (!p.hits.length) return;
  if (st.seq.length === 1 && needsTiming(p.hits)) {          // aspetta di sapere se è un impulso o una pressione
    st.pending = { p };
    if (st.ptimer) clearTimeout(st.ptimer.id);
    st.ptimer = pendingTimer(() => resolveStream(st, 'hold'));
    return;
  }
  press('kbd' + st.id, p.hits);
  // con la firma il primo tasto è solo un prefisso: l'azione si annuncia appena il controllo è identificato
  if (announce || !st.noted) { note(p, null); st.noted = true; }
  st.matched = true;
}
function endStream(st) {                 // idempotente
  if (st.ended) return;
  st.ended = true;
  clearTimeout(st.timer);
  if (st.pending) resolveStream(st, 'hold');
  if (!st.matched) note(null, 'Tasto ' + seqName(st.seq));
  release('kbd' + st.id);
  streams = streams.filter((x) => x !== st);
}
export function keyEvent(vk, down, t) {
  const m = modBit(vk);
  if (m) { state.modState = down ? (state.modState | m) : (state.modState & ~m); return; }
  if (down) {
    /* La fine di una sequenza si decide dai TIMESTAMP degli eventi (orologio del ponte), non dai timer della pagina:
       se il thread è occupato (animazioni, sfondo) un timer può scattare prima che i messaggi in coda siano stati
       letti e spezzare una firma a metà. I timer restano solo come pulizia tardiva. */
    for (const st of streams.slice()) if (!st.held.size && st.lastT != null && t - st.lastT > st.gap) endStream(st);
    for (const st of streams) if (st.held.has(vk)) return;                       // autoripetizione
    const ev = { vk, mods: state.modState };
    for (const st of streams) {                                                   // 1) prosegue una sequenza esistente
      if (matchSeq(st.seq.concat([ev])).length) {
        clearTimeout(st.timer);
        st.seq.push(ev); st.held.add(vk);
        updateStream(st, false);
        return;
      }
    }
    const st = { id: ++streamSeq, seq: [ev], held: new Set([vk]), timer: null, ptimer: null, matched: false, pending: null, t0: t };   // 2) nuova
    streams.push(st);
    updateStream(st, true);
  } else {
    for (const st of streams) {
      if (!st.held.has(vk)) continue;
      st.held.delete(vk);
      if (st.pending) resolveStream(st, (t - st.t0) <= TURN_MAX_MS ? 'turn' : 'hold');
      if (!st.held.size) {
        // sequenza completa (nessun passo atteso) → nessuna attesa; altrimenti la pausa programmata allunga l'attesa
        const cands = matchSeq(st.seq);
        const complete = cands.length > 0 && cands.every((s) => s.steps.length === st.seq.length);
        const gap = complete ? 0 : 90 + Math.max(0, ...cands.map((s) => s.delay));
        st.lastT = t; st.gap = gap;
        release('kbd' + st.id, false, gap);                                        // spegnimento visivo (annullato se la sequenza prosegue)
        clearTimeout(st.timer);
        st.timer = setTimeout(() => endStream(st), gap + 400);                     // pulizia tardiva
      }
    }
  }
}
let mediaPend = null;
function resolveMedia(role) {
  const m = mediaPend;
  if (!m) return;
  mediaPend = null;
  clearTimeout(m.timer.id);
  const hits = byRole(m.p.hits, role);
  press('media', hits, true);
  note(Object.assign({}, m.p, { hits }), null);
}
export function mediaEvent(usage, down, t) {
  if (down) {
    if (mediaPend) resolveMedia('hold');                     // il rilascio precedente non è mai arrivato
    const p = pick(state.sigs.filter((s) => s.kind === 'media' && s.usage === usage));
    if (!p.hits.length) { clearChannel('media'); note(null, MEDIA_NAME[usage] || 'Media 0x' + usage.toString(16)); return; }
    if (needsTiming(p.hits)) {
      mediaPend = { p, t0: t, timer: pendingTimer(() => resolveMedia('hold')) };
      return;
    }
    press('media', p.hits, true); note(p, null);
  } else {
    if (mediaPend) resolveMedia((t - mediaPend.t0) <= TURN_MAX_MS ? 'turn' : 'hold');
    release('media');
  }
}
/* La rotella del mouse è un impulso, senza "rilascio": un tasto tenuto la ripete. Il primo impulso mostra
   il tasto premuto per un attimo; se ne arriva un altro entro 700 ms si considera "tenuto" e resta premuto finché
   gli impulsi continuano (finestra = 1,8 × l'intervallo osservato, almeno 250 ms). */
const wheelPulse = { key: '', last: 0, timer: 0 };
export function wheelEvent(dir) {
  const p = pick(state.sigs.filter((s) => s.kind === 'wheel' && s.dir === dir && s.mods === (state.modState & 7)));
  if (!p.hits.length) { note(null, 'Rotella ' + (dir > 0 ? '↑' : '↓') + (state.modState & 7 ? ' con ' + modLabel(state.modState & 7) : '')); return; }
  const key = p.hits.map((x) => x.id).join(',');
  const now = performance.now();
  const gap = now - wheelPulse.last;
  const held = wheelPulse.timer && wheelPulse.key === key;          // la finestra precedente non è ancora scaduta
  clearTimeout(wheelPulse.timer);
  wheelPulse.key = key; wheelPulse.last = now;
  press('wheel', p.hits, true);
  if (!held) note(p, null); else showTags(p);
  const win = held ? Math.min(900, Math.max(250, gap * 1.8)) : 250;
  wheelPulse.timer = setTimeout(() => { wheelPulse.timer = 0; clearChannel('wheel'); }, win);
}
function buttonEvent(b, down) {
  if (!down) { release('btn'); return; }
  const p = pick(state.sigs.filter((s) => s.kind === 'button' && s.button === b));
  if (p.hits.length) { press('btn', p.hits); note(p, null); } else note(null, 'Pulsante ' + b);
}

export function onEvent(ev) {
  if (!ev) return;
  const t = typeof ev.t === 'number' ? ev.t : performance.now();
  trace(ev, t);
  if (ev.type === 'key') keyEvent(ev.vk, !!ev.down, t);
  else if (ev.type === 'media') mediaEvent(ev.usage, !!ev.down, t);
  else if (ev.type === 'wheel') wheelEvent(ev.delta > 0 ? 1 : -1);
  else if (ev.type === 'button') buttonEvent(ev.button, !!ev.down);
  else if (ev.type === 'status') { state.link = { usb: !!ev.usb, ble: !!ev.ble }; state.linkCap = true; paintLink(); }
}
