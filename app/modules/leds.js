/* leds.js — pannello dei LED per layer. */
import { linkState } from './bridge.js';
import { $, btn, el } from './dom.js';
import { closeDropdowns, dropdown } from './dropdown.js';
import { segBtns } from './editor.js';
import { section } from './inspector.js';
import { shownLayer } from './labels.js';
import { SEND, runSend } from './send.js';
import { anchorSheet, closeBtn, fillSheet, hideSheets, progressBar } from './sheets.js';
import { state } from './state.js';
import { commit, ensureStore } from './store.js';

/* — LED — */
const LED_COLOR_LIST = [[1, 'Rosso', '#ff3b3b'], [2, 'Arancio', '#ff9a2e'], [3, 'Giallo', '#ffe14a'], [4, 'Verde', '#34d86b'],
  [5, 'Ciano', '#2ee6e6'], [6, 'Blu', '#3b6bff'], [7, 'Viola', '#b25cff'], [0, 'Bianco', '#e6ebf2']];
/* effetti verificati sul pad reale (15/10/2026). I modi 6–9 e 12–15 si comportano come il 4 (alias): non sono elencati. */
const LED_MODES = [[0, 'Spento', 'Tutti i LED spenti.'],
  [1, 'Fisso', 'Retroilluminazione sempre accesa nel colore scelto.'],
  [2, 'Sequenza 1 → 9', 'Spenti; a ogni pressione, di qualunque tasto, i LED si accendono uno dopo l’altro dal tasto 1 al 9.'],
  [3, 'Sequenza 9 → 1', 'Come la precedente, ma dal tasto 9 al 1.'],
  [4, 'Tasto premuto', 'Spenti; il tasto che premi si accende e si spegne piano in circa mezzo secondo, alla pressione e al rilascio.'],
  [5, 'Tutti bianchi', 'Tutti i LED accesi di bianco: il colore scelto non conta.'],
  [10, 'Andata e ritorno 1 → 4', 'Spenti; a ogni pressione, di qualunque tasto, i LED si accendono dal tasto 1 al 4 e poi tornano indietro fino al 1.'],
  [11, 'Tasto premuto, netto', 'Come “Tasto premuto”, ma il tasto si accende e si spegne di colpo, senza dissolvenza.']];
const LEDE = { layer: null };
const ledOf = (L) => {
  const led = state.store && state.store.profile.layers[L - 1].led;
  return led && typeof led.color === 'number' ? { color: led.color, mode: led.mode | 0, set: true } : { color: L === 1 ? 4 : 0, mode: 1, set: false };
};
export function openLeds() {
  ensureStore();
  LEDE.layer = shownLayer();
  SEND.msg = ''; SEND.err = false; SEND.done = false;
  hideSheets('#leds');
  anchorSheet($('#leds'), $('#ledCard'));
  $('#leds').hidden = false;
  renderLeds();
}
function setLedField(L, patch) {
  const cur = ledOf(L);
  state.store.profile.layers[L - 1].led = { color: patch.color != null ? patch.color : cur.color, mode: patch.mode != null ? patch.mode : cur.mode };
  commit();
}
export function renderLeds() {
  const box = $('#leds');
  closeDropdowns();
  if (!state.store) { box.hidden = true; return; }
  const L = LEDE.layer || shownLayer();
  const cur = ledOf(L);
  const key = 'led:' + L;
  const dirty = SEND.pending.includes(key);
  const st = linkState();
  const kids = [el('div', { class: 'sh' }, el('span', { class: 'micro' }, 'LED'), closeBtn(() => { box.hidden = true; }))];
  kids.push(el('h3', {}, 'Luci del macropad'));
  kids.push(segBtns([[1, 'Layer 1'], [2, 'Layer 2'], [3, 'Layer 3']], (k) => k === L, (k) => { LEDE.layer = k; renderLeds(); }, 'Layer da modificare'));
  const sw = el('div', { class: 'swatches' + (cur.mode === 5 ? ' dim' : ''), role: 'group', 'aria-label': 'Colore' });
  LED_COLOR_LIST.forEach(([v, name, css]) => {
    const b = btn('', 'sw', () => setLedField(L, { color: v }), { 'aria-pressed': String(cur.color === v), title: name, 'aria-label': name });
    b.style.setProperty('--c', css);
    sw.append(b);
  });
  const colName = (LED_COLOR_LIST.find((c) => c[0] === cur.color) || [])[1] || '—';
  kids.push(section('Colore · ' + (cur.mode === 5 ? 'non usato in questo effetto' : colName), sw));
  const mode = LED_MODES.find((m) => m[0] === cur.mode);
  kids.push(section('Effetto',
    dropdown(LED_MODES.map(([v, name]) => [v, name]), cur.mode, (v) => setLedField(L, { mode: v }), 'Effetto LED', mode ? null : 'Modo ' + cur.mode),
    el('p', { class: 'desc' }, mode ? mode[2] : 'Valore non documentato (si comporta come “Tasto premuto”).')));
  const foot = [];
  foot.push(el('p', { class: 'fine' }, 'Colore ed effetto valgono per tutto il layer: il pad non ha un colore per singolo LED. In Bluetooth i LED dei tasti restano spenti; per cambiarli serve il cavo USB.'));
  if (SEND.busy && SEND.progress) foot.push(progressBar(SEND.progress));
  if (SEND.msg) foot.push(el('p', { class: 'hintx' + (SEND.err ? ' warnx' : '') }, (SEND.done && !SEND.err ? '✓ ' : '') + SEND.msg));
  if (st === 'ble') foot.push(el('p', { class: 'hintx warnx' }, 'Collegato solo in wireless: serve il cavo USB.'));
  const go = btn(SEND.busy ? 'Invio in corso…' : dirty ? 'Invia LED del layer ' + L : 'LED aggiornati', 'pbtn', () => runSend(false, [key]));
  if (SEND.busy || !dirty || st === 'ble' || st === 'off') go.setAttribute('disabled', '');
  foot.push(el('div', { class: 'row2 actions' }, go));
  kids.push(el('div', { class: 'sec' }, ...foot));
  fillSheet(box, kids);
}
