/* diag.js — registro grezzo degli eventi e pannello di diagnostica. */
import { MEDIA_NAME, vkName } from '../core/keymap.js';
import { $, btn } from './dom.js';

/* Registro degli eventi grezzi con intervalli: serve a tarare le soglie sul pad reale. */
export const rawLog = [];
const downAt = {};
let rawPrev = null;
export function trace(ev, t) {
  const code = ev.type === 'key' ? 'k' + ev.vk : ev.type === 'media' ? 'm' + ev.usage : ev.type === 'button' ? 'b' + ev.button : null;
  const name = ev.type === 'key' ? 'tasto ' + vkName(ev.vk) : ev.type === 'media' ? 'media ' + (MEDIA_NAME[ev.usage] || '0x' + ev.usage.toString(16))
    : ev.type === 'wheel' ? 'rotella ' + (ev.delta > 0 ? '↑' : '↓') : 'mouse ' + ev.button;
  let tail = '';
  if (code) {
    if (ev.down) { downAt[code] = t; tail = ' ↓'; }
    else { tail = ' ↑ ' + (downAt[code] != null ? (t - downAt[code]).toFixed(1) + ' ms giù' : ''); delete downAt[code]; }
  }
  const dt = rawPrev == null ? 0 : t - rawPrev;
  rawPrev = t;
  rawLog.unshift('+' + dt.toFixed(1).padStart(8) + ' ms  ' + name + tail);
  if (rawLog.length > 60) rawLog.pop();
  if (!$('#diag').hidden) $('#raw').textContent = rawLog.slice(0, 14).join('\n');
}
export function toggleDiag(open) {
  const box = $('#diag'), btn = $('#diagBtn');
  box.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) $('#raw').textContent = rawLog.length ? rawLog.slice(0, 14).join('\n') : 'nessun evento';
}
