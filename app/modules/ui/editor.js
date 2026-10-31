/* editor.js — editor dell'azione di un controllo (tastiera, media, mouse, firma, tenuto premuto). */
import { MP } from '../core/mp.js';
import { state } from '../core/state.js';
import { btn, el } from './dom.js';
import { dropdown } from './dropdown.js';
import { holdEditor, hostNote, mediaEditor, mouseEditor, segBtns, signEditor, typeTiles } from './editor-widgets.js';
import { card, placeInspector, renderInspector, section, select } from './inspector.js';
import { paintLabels, shownLayer } from './labels.js';
import { SEND, framesFor, openSend } from './send.js';
import { commit, encOpts, ensureStore, layerControls } from './store.js';

/* ---------- editor nella vista live ----------
   Si modifica l'azione del controllo selezionato nel layer mostrato; il profilo è salvato nel browser (localStorage)
   e le modifiche si inviano al pad via WebHID (USB) solo dopo conferma esplicita.
   Il modulo di protocollo (MP) è in protocol.js: funzioni pure, le stesse usate dai test e da tools/profile-frames.js. */
/* act: azione scelta di una manopola (0 ↺, 1 premi, 2 ↻); rec: { mods } mentre si registra; prevMode: modalità del layer prima della modifica;
   mods: modificatori del selettore manuale */
export const editorState = { act: 1, rec: null, prevMode: null, mods: 0 };
const curTarget = () => (state.sel.kind === 'key' ? state.sel.id : state.layout.knobs[state.sel.k][editorState.act]);
function setType(L, id, type) {
  stopRec(true);
  const c = layerControls(L);
  if (type === 'none') delete c[id];
  else if (type === 'keys') c[id] = { t: 'keys', steps: [], delay: 0 };
  else if (type === 'media') c[id] = { t: 'media', usage: 0xCD };
  else if (type === 'mouse') c[id] = { t: 'mouse', buttons: 1, wheel: 0, mod: 0 };
  else if (type === 'clear') c[id] = { t: 'clear' };
  commit();
}
/* in modifica la vista resta sul layer che si sta modificando (niente salti se il pad cambia layer); all'uscita si
   ripristina la modalità precedente (Auto = segue il layer fisico) */
export function enterEdit() {
  ensureStore();
  editorState.prevMode = state.layerMode; state.layerMode = shownLayer();
  state.edit = true; editorState.act = 1;
  paintLabels();
}
export function leaveEdit() {
  stopRec(true);
  state.edit = false;
  if (editorState.prevMode != null) {
    state.layerMode = editorState.prevMode; editorState.prevMode = null;
    if (state.layerMode === 'auto' && state.padKnown) state.detected = state.padLayer;
  }
  paintLabels();
}
export function stopRec(silent) { if (editorState.rec) { editorState.rec = null; if (!silent) renderInspector(); } }
export function recKey(e, down) {
  const bit = MP.CODE_TO_MOD[e.code];
  if (bit) { editorState.rec.mods = down ? (editorState.rec.mods | bit) : (editorState.rec.mods & ~bit); return; }
  if (!down || e.repeat) return;
  const u = MP.CODE_TO_USAGE[e.code];
  if (!u || !state.sel) return;
  const a = layerControls(shownLayer())[curTarget()];
  if (!a || a.t !== 'keys' || a.steps.length >= MP.LIMITS.steps) return;
  a.steps.push({ mod: editorState.rec.mods, key: u });
  commit();
}
function keysEditor(a, L, id) {
  const steps = el('div', { class: 'steps' });
  if (!a.steps.length) steps.append(el('span', { class: 'hintx' }, editorState.rec ? 'Premi i tasti (anche sul pad)…' : 'Nessun tasto'));
  a.steps.forEach((s, i) => steps.append(el('span', { class: 'step' }, MP.stepLabel(s),
    btn('✕', '', () => { a.steps.splice(i, 1); commit(); }, { 'aria-label': 'Rimuovi' }))));
  const o = encOpts();
  const signed = !!(o.plan && o.plan.keys.has(L + ':' + id));
  const cap = MP.LIMITS.steps - (signed ? MP.SIG.STEPS : 0);
  const text = el('input', { class: 'inp', type: 'text', placeholder: 'Scrivi un testo (lettere, cifre, spazio)', 'aria-label': 'Testo da aggiungere' });
  const addText = () => {
    try {
      const add = MP.textToSteps(text.value);
      if (a.steps.length + add.length > MP.LIMITS.steps) throw new RangeError('Troppi tasti (massimo ' + MP.LIMITS.steps + ')');
      a.steps.push(...add);
      commit();
    }
    catch (err) { text.setCustomValidity(err.message); text.reportValidity(); setTimeout(() => text.setCustomValidity(''), 1800); }
  };
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } });
  // selettore manuale: modificatori + tasto dall'elenco (utile per i tasti che non si riescono a registrare)
  const modRow = el('div', { class: 'eseg g4', role: 'group', 'aria-label': 'Modificatori' });
  [[1, 'Ctrl'], [2, 'Maiusc'], [4, 'Alt'], [8, 'Win']].forEach(([bit, name]) =>
    modRow.append(btn(name, '', () => { editorState.mods ^= bit; renderInspector(); }, { 'aria-pressed': String(!!(editorState.mods & bit)) })));
  const keyItems = Object.keys(MP.KEY_LABELS).map(Number).sort((x, y) => x - y).map((u) => [u, MP.KEY_LABELS[u]]);
  const picker = dropdown(keyItems, null, (u) => {
    if (a.steps.length >= MP.LIMITS.steps) return;
    a.steps.push({ mod: editorState.mods, key: u }); editorState.mods = 0; commit();
  }, 'Tasto da aggiungere', editorState.mods ? 'Tasto con ' + MP.modLabel(editorState.mods) + '…' : 'Scegli un tasto…');
  const delay = el('input', { class: 'inp num', type: 'number', min: '0', max: String(MP.LIMITS.delayMs), step: '10', value: String(a.delay || 0), 'aria-label': 'Pausa in millisecondi' });
  delay.addEventListener('change', () => { a.delay = Math.max(0, Math.min(MP.LIMITS.delayMs, Math.round(Number(delay.value) || 0))); commit(); });
  const out = [
    steps,
    el('div', { class: 'row2' },
      btn(editorState.rec ? '■ Ferma' : '● Registra', 'sbtn' + (editorState.rec ? ' rec' : ''), () => { editorState.rec = editorState.rec ? null : { mods: 0 }; renderInspector(); }),
      btn('Svuota', 'sbtn', () => { a.steps.length = 0; commit(); })),
    el('span', { class: 'sub' }, 'Aggiungi un tasto'), modRow, el('div', { class: 'gap8' }, picker),
    el('span', { class: 'sub' }, 'Oppure scrivi un testo'), el('div', { class: 'row2 tight' }, text, btn('Aggiungi', 'sbtn', addText)),
    el('div', { class: 'row2 pause' }, el('span', { class: 'hintx' }, 'Pausa dopo i tasti (ms)'), delay),
  ];
  if (a.steps.length > cap) out.push(el('p', { class: 'hintx warnx' }, 'Troppi tasti' + (signed ? ' con la firma (massimo ' + cap + ')' : '') + ': il pacchetto non può essere inviato.'));
  if (state.store.profile.signature && a.steps.some((s) => s.key >= MP.SIG.BASE && s.key < MP.SIG.BASE + MP.SIG.RADIX))
    out.push(el('p', { class: 'hintx warnx' }, 'Usa già F13–F21: può confondersi con la firma.'));
  return out;
}
export function renderEditor() {
  const L = shownLayer();
  const isKnob = state.sel.kind === 'knob';
  const id = curTarget();
  const a = (state.store && state.store.profile.layers[L - 1].controls || {})[id] || null;
  const close = btn('✕', 'x', () => select(state.sel), { 'aria-label': 'Chiudi' });
  const title = isKnob ? 'Manopola ' + (state.sel.k + 1) : 'Tasto ' + (state.layout.keys.indexOf(state.sel.id) + 1);
  const head = el('header', {}, el('div', {}, el('span', { class: 'micro' }, 'Modifica'), el('h2', {}, title),
    el('div', { class: 'badges' }, el('span', { class: 'badge acc' }, 'Layer ' + L), el('span', { class: 'badge' }, 'ID ' + id))), close);
  const kids = [];
  if (isKnob) {
    const choices = [[0, '↺ Sinistra'], [1, 'Premi'], [2, '↻ Destra']];
    const pickAct = (k) => { stopRec(true); editorState.act = k; renderInspector(); };
    kids.push(section('Quale azione', segBtns(choices, (k) => editorState.act === k, pickAct, 'Azione della manopola')));
  }
  const cur = a ? a.t : 'none';
  const off = cur === 'clear';
  const typeSec = [typeTiles(cur, (k) => setType(L, id, k))];
  if (off) typeSec.push(el('p', { class: 'hintx' }, 'Disattivato: il controllo non invia nulla, nemmeno il codice identificativo (non rivela il layer).'),
    el('div', { class: 'row2' }, btn('Riattiva', 'sbtn', () => setType(L, id, 'none'))));
  else typeSec.push(el('div', { class: 'row2' }, btn('Disattiva del tutto', 'linkbtn', () => setType(L, id, 'clear'),
    { title: 'Invia un pacchetto vuoto: il controllo non fa più nulla.' })));
  kids.push(section('Cosa fa', ...typeSec));
  if (a && a.t === 'keys') kids.push(section('Tasti', ...keysEditor(a, L, id)));
  else if (a && a.t === 'media') kids.push(section('Funzione', ...mediaEditor(a)));
  else if (a && a.t === 'mouse') kids.push(section('Mouse', ...mouseEditor(a)));
  else if (!off) {
    const p = state.store.profile;
    const sendsCode = p.signature && p.signEmpty !== false;
    kids.push(el('p', { class: 'hintx' }, 'Nessuna azione: premere il controllo non farà nulla'
      + (sendsCode ? ' (invia solo un codice riservato, così la vista live sa il layer).' : '.')));
  }
  const hd = holdEditor(a, L, id); if (hd) kids.push(hd);
  const sg = signEditor(a, L, id); if (sg) kids.push(sg);
  const hn = hostNote(a, L, id); if (hn) kids.push(hn);
  // dettagli tecnici: i pacchetti che verrebbero inviati per questo controllo
  try {
    const fr = framesFor(L, id);
    kids.push(el('details', { class: 'dtl' }, el('summary', {}, 'Dettagli tecnici'),
      el('pre', {}, fr.map((f) => f.label + '\n' + MP.hex(f.bytes, 0, 24) + ' …').join('\n\n'))));
  } catch (err) { kids.push(el('p', { class: 'hintx' }, 'Dettagli tecnici non disponibili: ' + err.message)); }
  const n = SEND.pending.length;
  const send = btn(n ? 'Invia al pad · ' + n : 'Pad aggiornato', 'pbtn', () => openSend(), n ? {} : { disabled: '' });
  // il contenuto scorre da solo (senza barre visibili) se la finestra è bassa; intestazione e piede restano fissi
  const sc = el('div', { class: 'cscroll' }, ...kids);
  const fade = () => sc.classList.toggle('more', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 4);   // sfumatura in basso se c'è altro sotto
  sc.addEventListener('scroll', fade, { passive: true });
  card.replaceChildren(head, sc, el('div', { class: 'foot' }, btn('Fine', 'sbtn', () => leaveEdit()), send));
  requestAnimationFrame(fade);
  card.hidden = false;
  placeInspector();
  requestAnimationFrame(() => card.classList.add('in'));
}

/* durante la registrazione di una macro i tasti della pagina vanno all'editor, non alla pagina (fase di cattura) */
export function initEditor() {
  window.addEventListener('keydown', (e) => { if (editorState.rec) { e.preventDefault(); e.stopPropagation(); recKey(e, true); } }, true);
  window.addEventListener('keyup', (e) => { if (editorState.rec) { e.preventDefault(); e.stopPropagation(); recKey(e, false); } }, true);
}
