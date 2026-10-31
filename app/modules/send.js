/* send.js — invio al pad via WebHID. */
import { chips, linkState } from './bridge.js';
import { $, btn, el, sleep } from './dom.js';
import { closeDropdowns } from './dropdown.js';
import { UNENCODABLE } from './frames.js';
import { controlName } from './labels.js';
import { MP } from './mp.js';
import { anchorSheet, closeBtn, dotEl, fillSheet, hideSheets, progressBar, renderSheets } from './sheets.js';
import { state } from './state.js';
import { currentFrameHexMap, encOpts, encodeErrors, readSent, updatePending, writeSent } from './store.js';

export const SEND = { pending: [], busy: false, dev: null, msg: '', err: false, done: false, progress: null };
/* — invio al pad (WebHID) — */
const isCfg = (d) => d.vendorId === MP.VENDOR_ID && d.collections.some((c) => c.usagePage === 0xFF00);
async function hidConnect() {
  if (!('hid' in navigator)) throw new Error('WebHID non è disponibile in questo browser (serve Chrome o Edge).');
  let dev = (await navigator.hid.getDevices()).find(isCfg);
  if (!dev) dev = (await navigator.hid.requestDevice({ filters: [{ vendorId: MP.VENDOR_ID, usagePage: 0xFF00 }] })).find(isCfg);
  if (!dev) throw new Error('Nessun dispositivo selezionato.');
  if (!dev.opened) await dev.open();
  if (!MP.VERIFIED_PIDS.includes(dev.productId)) throw new Error('PID 0x' + dev.productId.toString(16) + ' non verificato: scrittura bloccata.');
  SEND.dev = dev;
  return dev;
}
/* pacchetti di un controllo come li scrive l'editor: "azzera" + azione (il firmware conserva il tipo vecchio) */
export function framesFor(L, id) {
  const a = state.store.profile.layers[L - 1].controls[id] || null;
  const list = MP.encodeActionFrames(id, L, a, encOpts());
  const name = controlName(id) + ' · L' + L;
  const out = [];
  if (!(a && a.t === 'clear')) out.push({ label: name + ' · azzera', bytes: MP.clear(id, L) });
  list.forEach((b, i) => out.push({ label: name + (list.length > 1 ? (i === 0 ? ' · tasti' : ' · pausa') : ''), bytes: b }));
  return out;
}
const pendingName = (k) => {
  if (k.startsWith('led:')) return 'LED · Layer ' + k.slice(4);
  const [L, id] = k.split(':').map(Number);
  return controlName(id) + ' · L' + L;
};
async function sendKeys(keys) {
  const cur = currentFrameHexMap();
  const frames = [];
  for (const k of keys) {
    if (cur[k] === UNENCODABLE) throw new Error('«' + pendingName(k) + '» non è codificabile: ' + (encodeErrors.get(k) || 'errore sconosciuto') + '.');
    if (k.startsWith('led:')) {
      const L = Number(k.slice(4)), led = state.store.profile.layers[L - 1].led;
      if (led) frames.push({ label: 'LED · L' + L, bytes: MP.led(L, led.color, led.mode) });
    } else {
      const [L, id] = k.split(':').map(Number);
      frames.push(...framesFor(L, id));
    }
  }
  if (!frames.length) return 0;
  // i LED prima dei controlli e ripasso dell'ultimo pacchetto: sul pad reale l'ultimo di una scrittura lunga può perdersi
  frames.sort((x, y) => (y.label.startsWith('LED') ? 1 : 0) - (x.label.startsWith('LED') ? 1 : 0));
  frames.push({ label: frames[frames.length - 1].label, bytes: frames[frames.length - 1].bytes });
  const dev = SEND.dev && SEND.dev.opened ? SEND.dev : await hidConnect();
  let i = 0;
  for (const f of frames) {
    SEND.progress = { i: ++i, n: frames.length, label: f.label };
    renderSheets();
    await dev.sendReport(MP.REPORT_ID, f.bytes);
    await sleep(150);                                  // il firmware salva in flash a ogni pacchetto
  }
  const snap = readSent() || {};
  for (const k of keys) snap[k] = cur[k];
  writeSent(snap);
  return frames.length;
}
/* keys: elenco di chiavi da inviare; all = riscrive tutto (tranne i controlli senza azione) */
export async function runSend(all, keysIn) {
  if (SEND.busy) return;
  SEND.busy = true; SEND.err = false; SEND.msg = ''; SEND.done = false; renderSheets();
  try {
    const cur = currentFrameHexMap();
    const keys = keysIn || (all ? Object.keys(cur).filter((k) => cur[k] !== '') : SEND.pending.slice());
    const n = await sendKeys(keys);
    SEND.done = true;
    SEND.msg = n ? 'Inviati ' + n + ' pacchetti · ' + keys.length + (keys.length === 1 ? ' voce' : ' voci') : 'Niente da inviare.';
  } catch (e) {
    SEND.err = true;
    SEND.msg = e && e.name === 'NotFoundError' ? 'Nessun dispositivo selezionato.' : (e.message || String(e));
  }
  SEND.busy = false; SEND.progress = null;
  updatePending();
  renderSheets();
}
export function openSend() {
  SEND.msg = ''; SEND.err = false; SEND.done = false;
  hideSheets('#send');
  anchorSheet($('#send'), $('.conncard'), 'above');
  $('#send').hidden = false;
  renderSend();
}
export function renderSend() {
  const box = $('#send');
  closeDropdowns();
  if (!state.store) { box.hidden = true; return; }
  const n = SEND.pending.length;
  const st = linkState();
  const connected = !!(SEND.dev && SEND.dev.opened);
  const kids = [el('div', { class: 'sh' }, el('span', { class: 'micro' }, 'Invio al macropad'), closeBtn(() => { box.hidden = true; }))];
  if (SEND.done && !SEND.err) {
    kids.push(el('div', { class: 'okmark', 'aria-hidden': 'true' }, '✓'),
      el('h3', {}, n ? 'Inviato, restano ' + n + ' da inviare' : 'Pad aggiornato'),
      el('p', { class: 'lead' }, SEND.msg),
      el('div', { class: 'row2 actions' }, btn('Fatto', 'pbtn', () => { box.hidden = true; })));
    fillSheet(box, kids);
    return;
  }
  kids.push(el('h3', {}, n ? n + (n === 1 ? ' modifica da inviare' : ' modifiche da inviare') : 'Tutto aggiornato'));
  if (n) {
    const chips = el('div', { class: 'tags2' });
    SEND.pending.slice(0, 8).forEach((k) => chips.append(el('span', { class: 'tg' }, pendingName(k))));
    if (n > 8) chips.append(el('span', { class: 'tg more' }, '+' + (n - 8)));
    kids.push(chips);
  } else kids.push(el('p', { class: 'lead' }, 'Il profilo coincide con quanto inviato al pad.'));
  const stText = connected ? 'Macropad collegato via USB · pronto'
    : st === 'usb' ? 'Macropad collegato via USB'
    : st === 'ble' ? 'Solo wireless: per programmare serve il cavo USB'
    : st === 'off' ? 'Macropad non collegato'
    : 'Collega il cavo USB per programmare';
  kids.push(el('div', { class: 'linkrow ' + (connected || st === 'usb' ? 'usb' : st === 'ble' ? 'ble' : st === 'off' ? 'off' : '') }, dotEl(), el('span', {}, stText)));
  if (SEND.busy && SEND.progress) kids.push(progressBar(SEND.progress));
  if (SEND.err && SEND.msg) kids.push(el('p', { class: 'hintx warnx' }, SEND.msg));
  const blocked = st === 'ble' || st === 'off';
  const label = SEND.busy ? 'Invio in corso…' : !n ? 'Niente da inviare' : (connected || st === 'usb' ? 'Invia al pad' : 'Collega e invia');
  const go = btn(label, 'pbtn', () => runSend(false));
  if (SEND.busy || !n || blocked) go.setAttribute('disabled', '');
  const row = el('div', { class: 'row2 actions' }, go);
  if (!SEND.busy) row.append(btn('Riscrivi tutto', 'linkbtn', () => runSend(true), { title: 'Riscrive sul pad tutti i controlli con un’azione e i LED' }));
  kids.push(row);
  kids.push(el('p', { class: 'fine' }, 'I controlli indicati vengono sovrascritti sul dispositivo; il pad non si può rileggere, quindi il vecchio contenuto non si recupera.'));
  fillSheet(box, kids);
}
