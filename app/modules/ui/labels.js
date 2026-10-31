/* labels.js — etichette dei controlli, layer mostrato e rilevamento dei duplicati. */
import { ICONS } from '../core/icon-map.js';
import { KIND_NAME } from '../core/signatures.js';
import { ctrl, knobEl, state } from '../core/state.js';
import { chips } from './bridge.js';
import { $, h } from './dom.js';
import { Bg } from './effects.js';
import { renderInspector } from './inspector.js';
import { ledInfo } from './profile.js';

/* ---------- etichette e layer ---------- */
export const shownLayer = () => (state.layerMode === 'auto' ? state.detected : state.layerMode);
export const iconNameFor = (id, L) => { const s = state.sigs.find((x) => x.layer === L && x.id === id); return s && s.icon ? s.icon : null; };
export const labelFor = (id, L) => { const s = state.sigs.find((x) => x.layer === L && x.id === id); return s ? s.label : ''; };
export const kindFor = (id, L) => { const s = state.sigs.find((x) => x.layer === L && x.id === id); return s ? (s.empty ? 'Senza azione' : KIND_NAME[s.kind]) : ''; };
const slotName = (id) => 'Tasto ' + (state.layout.keys.indexOf(id) + 1);
export const controlName = (id) => {
  const c = ctrl.get(id);
  if (!c) return 'Controllo ' + id;
  if (c.kind === 'key') return slotName(id);
  return 'Manopola ' + (c.knob + 1) + ' · ' + ['↺', 'premi', '↻'][c.act];
};
function setLedColor(css) { document.documentElement.style.setProperty('--led', css); Bg.setLed(css); }
let glowTimer = 0;
let lastGlowLayer = 0;
export function paintLabels() {
  const L = shownLayer();
  for (const c of ctrl.values()) {
    if (c.kind === 'key') {
      const t = labelFor(c.id, L), ic = iconNameFor(c.id, L);
      const cap = ic ? ((state.sigs.find((x) => x.layer === L && x.id === c.id) || {}).cap || '') : '';
      const short = t.length > 9 ? t.slice(0, 8) + '…' : t;
      c.label.textContent = ic ? cap : short;                        // simbolo al posto del testo, quando c'è (didascalia: modificatori)
      c.icon.replaceChildren();
      if (ic) for (const [k, d] of ICONS[ic]) c.icon.append(h('path', { class: k, d }));
      c.icon.setAttribute('transform', cap ? 'translate(0 -42) scale(3.1) translate(-12 -12)' : 'translate(0 -30) scale(3.6) translate(-12 -12)');
      c.label.setAttribute('y', ic && cap ? 32 : -17);
      c.label.setAttribute('font-size', ic ? 22 : short.length > 7 ? 22 : short.length > 5 ? 25 : 29);
      c.el.setAttribute('aria-label', slotName(c.id) + (t ? ': ' + t : ''));
    }
  }
  state.layout.knobs.forEach((trio, k) => {
    knobEl[k] && knobEl[k].setAttribute('aria-label', 'Manopola ' + (k + 1) + ': ' + trio.map((id, a) => ['sinistra', 'premi', 'destra'][a] + ' ' + (labelFor(id, L) || '—')).join(', '));
  });
  const info = ledInfo(L);
  document.querySelectorAll('#pad .led').forEach((e) => e.classList.toggle('on', Number(e.dataset.led) === L));
  if (lastGlowLayer !== L) {
    lastGlowLayer = L;
    const g = $('#pad .under');
    if (g) g.style.opacity = '0';
    clearTimeout(glowTimer);
    glowTimer = setTimeout(() => { setLedColor(info.css); if (g) g.style.opacity = ''; }, 220);
  } else setLedColor(info.css);
  document.querySelectorAll('#ledCard .item').forEach((it) => {
    const n = Number(it.dataset.n), li = ledInfo(n);
    it.style.setProperty('--c', li.css);
    it.classList.toggle('on', n === L);
    it.lastElementChild.textContent = 'L' + n + ' ' + li.name;
    it.title = 'Layer ' + n + ': LED ' + li.name.toLowerCase();
  });
  document.querySelectorAll('#layers button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === String(state.layerMode))));
  $('#layers [data-l="auto"]').textContent = state.layerMode === 'auto' ? 'Auto · ' + state.detected : 'Auto';
  chips();
  renderInspector();
}
export function setDetected(n) {
  if (state.detected === n) return;
  state.detected = n;
  paintLabels();
}

/* Azioni identiche su controlli dello stesso ruolo (due "pressioni" o due "rotazioni"): il pad invia esattamente lo
   stesso messaggio, quindi nessun software può dire quale sia stato usato. Si avvisa invece di indovinare. */
export const isTurn = (c) => c && c.kind === 'knob' && c.act !== 1;
const sigKey = (s) => s.kind === 'keys' ? 'k:' + s.steps.map((x) => x.mods + '.' + x.vk).join('/')
  : s.kind === 'media' ? 'm:' + s.usage : s.kind === 'wheel' ? 'w:' + s.dir + '.' + s.mods : 'b:' + s.button;
/* due azioni producono lo stesso evento? (per sequenze: uguali o una è l'inizio dell'altra) */
function eventClash(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'keys') {
    const n = Math.min(a.steps.length, b.steps.length);
    if (!n) return false;
    for (let i = 0; i < n; i++) if (a.steps[i].vk !== b.steps[i].vk || a.steps[i].mods !== b.steps[i].mods) return false;
    return true;
  }
  if (a.kind === 'media') return a.usage === b.usage;
  if (a.kind === 'wheel') return a.dir === b.dir && a.mods === b.mods;
  if (a.kind === 'button') return a.button === b.button;
  return false;
}
export const isUniqueEvent = (x) => !state.sigs.some((o) => o !== x && !(o.layer === x.layer && o.id === x.id) && eventClash(x, o));
export function dupGroups(L) {
  const groups = new Map();
  for (const s of state.sigs) {
    if (s.layer !== L || s.signed) continue;
    const c = ctrl.get(s.id);
    if (!c) continue;
    const k = sigKey(s) + '|' + (isTurn(c) ? 'turn' : 'hold');
    if (!groups.has(k)) groups.set(k, { label: s.label, ids: new Set() });
    groups.get(k).ids.add(s.id);
  }
  return [...groups.values()].filter((g) => g.ids.size > 1);
}

/* ---------- stati di pressione ---------- */
export const MIN_SHOW = 110;
