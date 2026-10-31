/* tags.js — etichette sul pad e riga dell'ultima azione. */
import { $, el } from './dom.js';
import { NAME, labelFor } from './labels.js';
import { hotOf } from './pad.js';
import { ctrl, state } from './state.js';

/* ---------- etichette sul pad e riga dell'ultima azione ---------- */
const tagEls = new Map();
const tagTimers = new Map();
function showTag(id, text) {
  const c = ctrl.get(id);
  if (!c || !text) return;
  const r = hotOf(c).getBoundingClientRect();
  const key = c.kind === 'knob' ? 'k' + c.knob : 'c' + id;
  let t = tagEls.get(key);
  if (!t) {
    t = el('div', { class: 'tag glass' });
    $('#tags').append(t);
    tagEls.set(key, t);
  }
  const prefix = c.kind === 'knob' ? (c.act === 0 ? '↺ ' : c.act === 2 ? '↻ ' : '') : '';
  t.textContent = prefix + text;
  const left = c.kind === 'knob';
  if (!t.classList.contains(left ? 'left' : 'up')) t.className = 'tag glass ' + (left ? 'left' : 'up');
  if (left) { t.style.left = (r.left - 14) + 'px'; t.style.top = (r.top + r.height / 2) + 'px'; }
  else { t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top - 6) + 'px'; }
  void t.offsetWidth;
  t.classList.add('on');
  clearTimeout(tagTimers.get(key));
  tagTimers.set(key, setTimeout(() => t.classList.remove('on'), 1300));
}
export function showTags(p) {
  if (!p || !p.hits.length) return;
  const label = p.sig && p.sig.label;
  for (const x of p.hits.slice(0, 2)) showTag(x.id, label || labelFor(x.id, p.layer) || (p.sig && p.sig.empty ? 'Nessuna azione' : ''));
}
/* ultime azioni come chip a pillola: la più recente è in evidenza; ripetizioni ravvicinate si fondono (×n) */
export const recents = [];
export function renderRecents() {
  const box = $('#last');
  box.classList.toggle('idle', recents.length === 0);
  if (!recents.length) {
    box.replaceChildren(el('div', { class: 'rchip glass now' }, el('b', {}, 'In attesa'),
      el('span', {}, state.bridge ? 'Premi un tasto del macropad' : 'Ponte non attivo · solo eventi di questa pagina')));
    return;
  }
  box.replaceChildren(...recents.map((r, i) => el('div', { class: 'rchip glass' + (i === 0 ? ' now' : '') },
    el('b', {}, r.title), r.sub ? el('span', {}, r.sub) : null, r.n > 1 ? el('span', { class: 'n' }, '×' + r.n) : null)));
}
export function note(p, raw) {
  let title, sub;
  if (p && p.hits.length) {
    const names = p.hits.map((x) => NAME(x.id));
    title = p.hits.length > 1 ? names.slice(0, 2).join(' oppure ') + (names.length > 2 ? ' …' : '') : names[0];
    sub = (p.sig && p.sig.label ? p.sig.label : (p.sig && p.sig.empty ? 'Senza azione' : '')) + ' · Layer ' + p.layer + (p.hits.length > 1 ? ' · stessa azione su più controlli' : '');
    showTags(p);
  } else { title = 'Evento non associato'; sub = raw || ''; }
  const now = performance.now(), top = recents[0];
  if (top && top.title === title && top.sub === sub && now - top.t < 2000) { top.n++; top.t = now; }
  else { recents.unshift({ title, sub, n: 1, t: now }); if (recents.length > 3) recents.length = 3; }
  renderRecents();
}
