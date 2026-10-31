/* editor.js — editor dell'azione di un controllo (tastiera, media, mouse, firma, tenuto premuto). */
import { btn, el } from './dom.js';
import { dropdown } from './dropdown.js';
import { TYPE_ICONS, svgIcon } from './icons.js';
import { card, placeInspector, renderInspector, section, select } from './inspector.js';
import { paintLabels, shownLayer } from './labels.js';
import { live } from './press.js';
import { pick, wheel } from './recognition.js';
import { SEND, framesFor, openSend } from './send.js';
import { S } from './state.js';
import { commit, encOpts, ensureStore, layerControls } from './store.js';
import { note } from './tags.js';

/* ---------- configuratore nella vista live ----------
   Si modifica l'azione del controllo selezionato nel layer mostrato; il profilo è salvato nel browser (localStorage)
   e le modifiche si inviano al pad via WebHID (USB) solo dopo conferma esplicita.
   Il modulo di protocollo (MP) è in protocol.js: funzioni pure, le stesse usate dai test e da tools/profile-frames.js. */
export const E = { act: 1, rec: null, prevMode: null, mods: 0 };      // act: azione scelta di una manopola (0 ↺, 1 premi, 2 ↻); rec: { mods } se si registra; mods: modificatori del selettore manuale
/* — editor nella scheda — */
const MOUSE_CHOICES = [['Clic sx', { buttons: 1, wheel: 0 }], ['Clic centr.', { buttons: 4, wheel: 0 }], ['Clic dx', { buttons: 2, wheel: 0 }],
  ['Rotella ↑', { buttons: 0, wheel: 1 }], ['Rotella ↓', { buttons: 0, wheel: -1 }]];
const MODS = [[1, 'Ctrl'], [2, 'Maiusc'], [4, 'Alt']];
export const segBtns = (items, isOn, pick, label) => {
  const g = el('div', { class: 'eseg' + (items.length <= 3 ? ' g' + items.length : ''), role: 'group', 'aria-label': label || '' });
  items.forEach(([k, text]) => g.append(btn(text, '', () => pick(k), { 'aria-pressed': String(isOn(k)) })));
  return g;
};
const curTarget = () => (S.sel.kind === 'key' ? S.sel.id : S.layout.knobs[S.sel.k][E.act]);
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
  E.prevMode = S.layerMode; S.layerMode = shownLayer();
  S.edit = true; E.act = 1;
  paintLabels();
}
export function leaveEdit() {
  stopRec(true);
  S.edit = false;
  if (E.prevMode != null) {
    S.layerMode = E.prevMode; E.prevMode = null;
    if (S.layerMode === 'auto' && S.padKnown) S.detected = S.padLayer;
  }
  paintLabels();
}
export function stopRec(silent) { if (E.rec) { E.rec = null; if (!silent) renderInspector(); } }
export function recKey(e, down) {
  const bit = MP.CODE_TO_MOD[e.code];
  if (bit) { E.rec.mods = down ? (E.rec.mods | bit) : (E.rec.mods & ~bit); return; }
  if (!down || e.repeat) return;
  const u = MP.CODE_TO_USAGE[e.code];
  if (!u || !S.sel) return;
  const a = layerControls(shownLayer())[curTarget()];
  if (!a || a.t !== 'keys' || a.steps.length >= MP.LIMITS.steps) return;
  a.steps.push({ mod: E.rec.mods, key: u });
  commit();
}
function keysEditor(a, L, id) {
  const steps = el('div', { class: 'steps' });
  if (!a.steps.length) steps.append(el('span', { class: 'hintx' }, E.rec ? 'Premi i tasti (anche sul pad)…' : 'Nessun tasto'));
  a.steps.forEach((s, i) => steps.append(el('span', { class: 'step' }, MP.stepLabel(s),
    btn('✕', '', () => { a.steps.splice(i, 1); commit(); }, { 'aria-label': 'Rimuovi' }))));
  const o = encOpts();
  const signed = !!(o.plan && o.plan.keys.has(L + ':' + id));
  const cap = MP.LIMITS.steps - (signed ? MP.SIG.STEPS : 0);
  const text = el('input', { class: 'inp', type: 'text', placeholder: 'Scrivi un testo (lettere, cifre, spazio)', 'aria-label': 'Testo da aggiungere' });
  const addText = () => {
    try { const add = MP.textToSteps(text.value); if (a.steps.length + add.length > MP.LIMITS.steps) throw new RangeError('Troppi tasti (massimo ' + MP.LIMITS.steps + ')'); a.steps.push(...add); commit(); }
    catch (err) { text.setCustomValidity(err.message); text.reportValidity(); setTimeout(() => text.setCustomValidity(''), 1800); }
  };
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } });
  // selettore manuale: modificatori + tasto dall'elenco (utile per i tasti che non si riescono a registrare)
  const modRow = el('div', { class: 'eseg g4', role: 'group', 'aria-label': 'Modificatori' });
  [[1, 'Ctrl'], [2, 'Maiusc'], [4, 'Alt'], [8, 'Win']].forEach(([bit, name]) =>
    modRow.append(btn(name, '', () => { E.mods ^= bit; renderInspector(); }, { 'aria-pressed': String(!!(E.mods & bit)) })));
  const keyItems = Object.keys(MP.KEY_LABELS).map(Number).sort((x, y) => x - y).map((u) => [u, MP.KEY_LABELS[u]]);
  const picker = dropdown(keyItems, null, (u) => {
    if (a.steps.length >= MP.LIMITS.steps) return;
    a.steps.push({ mod: E.mods, key: u }); E.mods = 0; commit();
  }, 'Tasto da aggiungere', E.mods ? 'Tasto con ' + MP.modLabel(E.mods) + '…' : 'Scegli un tasto…');
  const delay = el('input', { class: 'inp num', type: 'number', min: '0', max: String(MP.LIMITS.delayMs), step: '10', value: String(a.delay || 0), 'aria-label': 'Pausa in millisecondi' });
  delay.addEventListener('change', () => { a.delay = Math.max(0, Math.min(MP.LIMITS.delayMs, Math.round(Number(delay.value) || 0))); commit(); });
  const out = [
    steps,
    el('div', { class: 'row2' },
      btn(E.rec ? '■ Ferma' : '● Registra', 'sbtn' + (E.rec ? ' rec' : ''), () => { E.rec = E.rec ? null : { mods: 0 }; renderInspector(); }),
      btn('Svuota', 'sbtn', () => { a.steps.length = 0; commit(); })),
    el('span', { class: 'sub' }, 'Aggiungi un tasto'), modRow, el('div', { class: 'gap8' }, picker),
    el('span', { class: 'sub' }, 'Oppure scrivi un testo'), el('div', { class: 'row2 tight' }, text, btn('Aggiungi', 'sbtn', addText)),
    el('div', { class: 'row2 pause' }, el('span', { class: 'hintx' }, 'Pausa dopo i tasti (ms)'), delay),
  ];
  if (a.steps.length > cap) out.push(el('p', { class: 'hintx warnx' }, 'Troppi tasti' + (signed ? ' con la firma (massimo ' + cap + ')' : '') + ': il pacchetto non può essere inviato.'));
  if (S.store.profile.signature && a.steps.some((s) => s.key >= MP.SIG.BASE && s.key < MP.SIG.BASE + MP.SIG.RADIX))
    out.push(el('p', { class: 'hintx warnx' }, 'Usa già F13–F21: può confondersi con la firma.'));
  return out;
}
function mediaEditor(a) {
  return [dropdown(Object.entries(MP.MEDIA).map(([u, name]) => [Number(u), name]), a.usage, (u) => { a.usage = u; commit(); }, 'Funzione multimediale')];
}
function mouseEditor(a) {
  const click = a.wheel ? null : a.buttons & 4 ? 4 : a.buttons & 2 ? 2 : 1;
  const wheel = a.wheel ? Math.sign(a.wheel) : 0;
  const g = (cls, items, isOn, pick, label) => {
    const seg = el('div', { class: 'eseg ' + cls, role: 'group', 'aria-label': label });
    items.forEach(([k, text]) => seg.append(btn(text, '', () => pick(k), { 'aria-pressed': String(isOn(k)) })));
    return seg;
  };
  const out = [
    el('span', { class: 'sub' }, 'Clic'),
    g('g3', [[1, 'Sinistro'], [4, 'Centrale'], [2, 'Destro']], (k) => click === k, (k) => { Object.assign(a, { buttons: k, wheel: 0, mod: 0 }); commit(); }, 'Clic del mouse'),
    el('span', { class: 'sub' }, 'Rotella'),
    g('g2', [[1, '↑ Su'], [-1, '↓ Giù']], (k) => wheel === k, (k) => { Object.assign(a, { buttons: 0, wheel: k }); commit(); }, 'Rotella del mouse'),
  ];
  if (a.wheel) {
    const row = el('div', { class: 'eseg g3', role: 'group', 'aria-label': 'Modificatori' });
    MODS.forEach(([bit, name]) => row.append(btn(name, '', () => { a.mod = (a.mod || 0) ^ bit; commit(); }, { 'aria-pressed': String(!!((a.mod || 0) & bit)) })));
    out.push(el('span', { class: 'sub' }, 'Mentre tieni premuto'), row);
  }
  return out;
}
function typeTiles(cur, pick) {
  const wrap = el('div', { class: 'types', role: 'group', 'aria-label': 'Tipo di azione' });
  [['keys', 'Tastiera'], ['media', 'Media'], ['mouse', 'Mouse'], ['none', 'Nessuna']].forEach(([k, name]) => {
    const b = btn('', 'type', () => pick(k), { 'aria-pressed': String(cur === k) });
    const ic = el('span', {}, svgIcon(TYPE_ICONS[k]));
    b.append(ic, el('span', {}, name));
    wrap.append(b);
  });
  return wrap;
}
function signEditor(a, L, id) {
  const p = S.store.profile;
  if (!p.signature || !a || a.t !== 'keys') return null;
  const o = encOpts();
  const signedNow = !!(o.plan && o.plan.keys.has(L + ':' + id));
  const mode = a.sign === 'on' || a.sign === 'off' ? a.sign : 'auto';
  const set = (k) => { if (k === 'auto') delete a.sign; else a.sign = k; commit(); };
  return section('Firma',
    segBtns([['auto', 'Automatica'], ['on', 'Sempre'], ['off', 'Mai']], (k) => mode === k, set, 'Firma del controllo'),
    el('p', { class: 'hintx' }, signedNow
      ? 'Firmato: un tocco, riconosciuto sempre in modo univoco; non si ripete se tenuto premuto.'
      : 'Normale: segue la pressione (tenuto, si ripete) e la vista lo riconosce dall’azione' + (mode === 'off' ? ' (se è duplicata si confonde con l’altro controllo).' : '.')));
}
/* "Tenuto premuto": ripeti il comando finché è premuto oppure una volta sola per pressione.
   Tasti (una combinazione): Ripeti = tasto normale (ripetizione di Windows), Una volta = tocco (firma).
   Media e rotella: il ponte vede pressione e rilascio, quindi può ripetere (Ripeti) o inviare una volta sola. */
function holdEditor(a, L, id) {
  if (!a || (a.t !== 'keys' && a.t !== 'media' && !(a.t === 'mouse' && a.wheel))) return null;
  const single = a.t === 'keys' && a.steps.length === 1 && !a.delay;
  if (a.t === 'keys' && !single) {
    if (!a.steps.length) return null;
    return section('Tenuto premuto', el('p', { class: 'hintx' }, 'Le macro con più tasti, o con una pausa, partono una volta sola per pressione.'));
  }
  const mode = a.hold === 'repeat' || a.hold === 'once' ? a.hold : 'auto';
  const set = (k) => { if (k === 'auto') delete a.hold; else a.hold = k; commit(); };
  const rp = MP.repeatOf(S.store.profile);
  const o = encOpts();
  const signedNow = !!(o.plan && o.plan.keys.has(L + ':' + id));
  const needPc = 'Richiede il ponte attivo sul PC.';
  let hint;
  if (a.t === 'keys') {
    hint = mode === 'repeat' ? 'Tenuto premuto si ripete, come su una tastiera (ripetizione di Windows).'
      : mode === 'once' ? 'Un solo invio per pressione, anche se tieni premuto.'
      : signedNow ? 'Tocco unico (l’azione è ripetuta su un altro controllo): non si ripete se tenuto.' : 'Tenuto premuto si ripete, come su una tastiera.';
  } else {
    const what = a.t === 'media' ? 'il comando' : 'lo scatto';
    hint = mode === 'repeat' ? 'Il ponte ripete ' + what + ' finché tieni premuto (dopo ' + rp.d + ' ms, poi ogni ' + rp.r + ' ms). ' + needPc
      : mode === 'once' ? 'Una sola volta per pressione, anche se tieni premuto. ' + needPc
      : S.hosted.has(L + ':' + id) ? 'Una volta per pressione, eseguito dal ponte.' : 'Il pad invia una volta sola; un’eventuale ripetizione la gestisce Windows.';
  }
  return section('Tenuto premuto',
    segBtns([['auto', 'Automatico'], ['repeat', 'Ripeti'], ['once', 'Una volta']], (k) => mode === k, set, 'Tenuto premuto'),
    el('p', { class: 'hintx' }, hint));
}
function hostNote(a, L, id) {
  if (!a || !S.hosted.has(L + ':' + id)) return null;
  return el('p', { class: 'note' }, el('b', {}, 'Eseguita dal PC'),
    'Questa azione compare su più controlli: il pad invia solo un codice identificativo e la esegue il ponte. Funziona con il ponte attivo, anche in Bluetooth.');
}
export function renderEditor() {
  const L = shownLayer();
  const isKnob = S.sel.kind === 'knob';
  const id = curTarget();
  const a = (S.store && S.store.profile.layers[L - 1].controls || {})[id] || null;
  const close = btn('✕', 'x', () => select(S.sel), { 'aria-label': 'Chiudi' });
  const title = isKnob ? 'Manopola ' + (S.sel.k + 1) : 'Tasto ' + (S.layout.keys.indexOf(S.sel.id) + 1);
  const head = el('header', {}, el('div', {}, el('span', { class: 'micro' }, 'Modifica'), el('h2', {}, title),
    el('div', { class: 'badges' }, el('span', { class: 'badge acc' }, 'Layer ' + L), el('span', { class: 'badge' }, 'ID ' + id))), close);
  const kids = [];
  if (isKnob) kids.push(section('Quale azione', segBtns([[0, '↺ Sinistra'], [1, 'Premi'], [2, '↻ Destra']], (k) => E.act === k, (k) => { stopRec(true); E.act = k; renderInspector(); }, 'Azione della manopola')));
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
  else if (!off) kids.push(el('p', { class: 'hintx' }, 'Nessuna azione: premere il controllo non farà nulla' + (S.store.profile.signature && S.store.profile.signEmpty !== false ? ' (invia solo un codice riservato, così la vista live sa il layer).' : '.')));
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
