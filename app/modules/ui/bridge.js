/* bridge.js — ponte locale (eventi, stato del collegamento, mappa delle azioni eseguite dal PC) e WebHID. */
import { CODE2VK, MEDIA_KEY, sensorUsage } from '../core/keymap.js';
import { BRIDGE, state } from '../core/state.js';
import { $, parseJSON } from './dom.js';
import { editorState } from './editor.js';
import { dupGroups, shownLayer } from './labels.js';
import { keyEvent, mediaEvent, onEvent } from './recognition.js';
import { SEND } from './send.js';
import { renderSheets } from './sheets.js';
import { paintSendChip } from './store.js';
import { recents, renderRecents } from './tags.js';

/* mappa firma → azione per il ponte (endpoint /hostmap: accetta solo l'origine di questa pagina) */
let hostSent = '';
export function pushHostmap(force) {
  if (!state.bridge || !state.hostCap) return;
  const entries = [];
  for (const [key, act] of state.hosted) {
    const [layer, id] = key.split(':').map(Number);
    entries.push(Object.assign({ u: sensorUsage(id, layer) }, act));
  }
  const body = JSON.stringify({ v: 1, entries });
  if (!force && body === hostSent && state.hostOk) return;
  hostSent = body;
  fetch(BRIDGE + '/hostmap', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { state.hostOk = !!(j && j.ok); chips(); })
    .catch((err) => { warnOnce('mappa delle azioni dal PC non inviata al ponte', err); state.hostOk = false; chips(); });
}
/* — stato del collegamento — */
const LINK_TEXT = {
  usb: ['USB', 'Collegato via USB: si può programmare.'],
  ble: ['Wireless', 'Collegato via Bluetooth: i controlli funzionano, ma per programmare serve il cavo USB.'],
  off: ['Non collegato', 'Nessun macropad rilevato (né USB né Bluetooth).'],
  unknown: ['Stato ignoto', 'Il ponte non è attivo, quindi non posso sapere come è collegato il pad.'],
};
export function linkState() {
  if (state.bridge && state.linkCap) return state.link.usb ? 'usb' : state.link.ble ? 'ble' : 'off';
  if (state.hidSeen) return 'usb';
  return 'unknown';
}
export function paintLink() {
  const st = linkState();
  const p = $('#linkPill');
  if (!p) return;
  p.className = 'linkpill ' + st;
  p.lastElementChild.textContent = LINK_TEXT[st][0];
  const old = state.bridge && !state.linkCap ? ' (il ponte è una versione vecchia: riavvialo per vedere lo stato del collegamento)' : '';
  p.title = LINK_TEXT[st][1] + old;
  p.setAttribute('aria-label', 'Macropad: ' + LINK_TEXT[st][0]);
  if (!$('#send').hidden || !$('#leds').hidden) renderSheets();
}
/* senza ponte: se il pad è già stato autorizzato per WebHID e presente, è collegato via USB */
export function watchHid() {
  if (!('hid' in navigator)) return;
  const check = async () => {
    try {
      const list = await navigator.hid.getDevices();
      state.hidSeen = list.some((d) => d.vendorId === 0x1189);
    } catch (err) { warnOnce('WebHID non disponibile', err); state.hidSeen = false; }
    paintLink();
  };
  navigator.hid.addEventListener('connect', check);
  navigator.hid.addEventListener('disconnect', () => { SEND.dev = null; check(); });
  check();
}

/* ---------- stato del ponte e diagnostica ---------- */
export function chips() {
  const cb = $('#chipBridge'), cp = $('#chipProfile');
  paintSendChip(); paintLink();
  const needHost = state.hosted.size > 0;
  const hostBad = state.bridge && state.precise && needHost && (!state.hostCap || state.hostOk === false);
  cb.className = 'chip ' + (state.bridge && state.precise && !hostBad ? 'ok' : 'warn');
  cb.lastElementChild.textContent = !state.bridge ? 'Ponte non attivo' : !state.precise ? 'Ponte vecchio · riavvialo'
    : hostBad ? 'Ponte da aggiornare' : needHost ? 'Ponte · ' + state.hosted.size + ' azioni dal PC' : 'Ponte collegato';
  cb.title = !state.bridge ? 'Senza il ponte la pagina riceve solo i tasti mentre è in primo piano e non distingue il pad dalla tastiera.'
    : !state.precise ? 'Tempi imprecisi: chiudi la finestra del ponte e rilancia start.cmd.'
    : hostBad ? 'Il profilo ha ' + state.hosted.size + ' controlli con azione duplicata che il ponte deve eseguire: chiudi la finestra del ponte e rilancia start.cmd.'
    : needHost ? 'Eventi del solo macropad. Il ponte esegue sul PC ' + state.hosted.size + ' azioni media/mouse duplicate (i controlli inviano solo un codice identificativo).'
    : 'Eventi del solo macropad, anche in background.';
  const n = state.sigs.filter((x) => !x.empty).length;
  const d = dupGroups(shownLayer()).length;
  cp.className = 'chip ' + (n && !d ? 'ok' : 'warn');
  const sg = state.sigs.filter((x) => x.signed && !x.empty).length;
  cp.lastElementChild.textContent = n ? n + ' azioni' + (sg ? ' · ' + sg + ' firmate' : '') + (d ? ' · ' + d + (d === 1 ? ' duplicata' : ' duplicate') : '') : 'Nessun profilo';
  cp.title = n
    ? 'Azioni riconoscibili nel profilo salvato nel browser.'
      + (sg ? ' Le firmate (F13–F21) sono univoche per controllo e layer.' : '')
      + (d ? ' Alcune azioni identiche sono su più controlli e non si distinguono.' : '')
    : 'Modifica un controllo per creare il profilo.';
  $('#diagHelp').textContent = state.bridge
    ? 'Intervalli tra gli eventi e durata di ogni pressione, misurati dal ponte. Servono a tarare le soglie rotazione/pressione.'
    : 'Il ponte non è attivo: avvia start.cmd (o tools\\PadBridge.ps1) per vedere il pad anche in background.';
  if (!recents.length) renderRecents();
}
/* ---------- ponte e fallback dalla pagina ---------- */
let es = null;
export function connectBridge() {
  try { es = new EventSource(BRIDGE + '/events'); } catch (err) { warnOnce('EventSource non disponibile', err); setTimeout(connectBridge, 4000); return; }
  es.addEventListener('hello', (e) => {
    const d = parseJSON(e.data, 'messaggio hello del ponte illeggibile (ponte molto vecchio?)');
    state.bridge = true; state.precise = !!(d && d.precise); state.hostCap = !!(d && d.host);
    state.linkCap = !!(d && d.link); state.link = { usb: !!(d && d.usb), ble: !!(d && d.ble) };
    chips(); paintLink();
    pushHostmap(true);
  });
  es.onmessage = (m) => { const ev = parseJSON(m.data, 'evento del ponte non valido'); if (ev) onEvent(ev); };
  es.onerror = () => { state.bridge = false; state.precise = false; state.hostCap = false; state.hostOk = null; state.linkCap = false; chips(); paintLink(); es.close(); setTimeout(connectBridge, 3000); };
}
export function pageKey(e, down) {
  if (editorState.rec) return;
  if (state.bridge || (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return;
  if (e.target && e.target.closest && e.target.closest('.key, .knob') && (e.key === 'Enter' || e.key === ' ')) return;
  if (MEDIA_KEY[e.key]) { mediaEvent(MEDIA_KEY[e.key], down, e.timeStamp); return; }
  const vk = CODE2VK[e.code] || ({ ControlLeft: 17, ControlRight: 17, ShiftLeft: 16, ShiftRight: 16, AltLeft: 18, AltRight: 18, MetaLeft: 91, MetaRight: 92 })[e.code];
  if (vk) keyEvent(vk, down, e.timeStamp);
}
