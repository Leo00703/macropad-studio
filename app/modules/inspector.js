/* inspector.js — scheda ancorata al controllo selezionato. */
import { $, el } from './dom.js';
import { closeDropdowns } from './dropdown.js';
import { editorState, enterEdit, leaveEdit, renderEditor, stopRec } from './editor.js';
import { iconEl } from './icons.js';
import { NAME, dupGroups, iconNameFor, isUniqueEvent, kindFor, labelFor, shownLayer } from './labels.js';
import { hotOf } from './pad.js';
import { press, release, rotate } from './press.js';
import { ctrl, knobEl, state } from './state.js';

/* ---------- ispettore ancorato al controllo ---------- */
export const card = $('#inspector');
export function select(sel) {
  const same = state.sel && sel && state.sel.kind === sel.kind && state.sel.id === sel.id && state.sel.k === sel.k;
  state.sel = same ? null : sel;
  stopRec(true);
  if (!state.sel) { if (state.edit) leaveEdit(); } else editorState.act = 1;
  document.querySelectorAll('#pad .sel').forEach((e) => e.classList.remove('sel'));
  if (state.sel) {
    const target = state.sel.kind === 'key' ? ctrl.get(state.sel.id).el : knobEl[state.sel.k];
    target.classList.add('sel');
  }
  renderInspector();
}
/* "Ctrl+A" → due tasti; "Rotella ↑" resta testo */
function valueNode(label, empty) {
  if (!label) return el('span', { class: 'none' }, empty || '—');
  const isCombo = (g) => g !== '+' && g.includes('+') && g.split('+').every((p) => p.length);
  if (!label.split(' ').some(isCombo)) return el('span', {}, label);              // nessuna scorciatoia ("Volume +", "Rotella ↑")
  const wrap = el('span', { class: 'vals' });
  label.split(' ').forEach((grp, gi) => {
    if (gi) wrap.append(' ');
    // "Ctrl+A" → due tasti; un "+" isolato (es. "Volume +") o un segno finale restano testo
    const parts = grp.split('+');
    if (isCombo(grp)) parts.forEach((p, i) => { if (i) wrap.append(el('i', { class: 'plus' }, ' + ')); wrap.append(el('kbd', {}, p)); });
    else wrap.append(el('span', { class: grp === '+' ? '' : 'tail' }, grp));
  });
  return wrap;
}
const pad2 = (n) => String(n).padStart(2, '0');
const iconAndValue = (id, L, empty) => {
  const n = iconNameFor(id, L);
  return n ? [iconEl(n), valueNode(labelFor(id, L), empty)] : [valueNode(labelFor(id, L), empty)];
};
export const section = (label, ...kids) => el('section', { class: 'sec' }, el('span', { class: 'micro' }, label), ...kids);
export function renderInspector() {
  closeDropdowns();
  if (!state.sel) { card.classList.remove('in'); card.hidden = true; $('#link path').setAttribute('d', ''); $('#link circle').setAttribute('cx', -10); return; }
  if (state.edit) { renderEditor(); return; }
  const L = shownLayer();
  const dups = dupGroups(L);
  let kicker, title, body, ids;
  if (state.sel.kind === 'key') {
    const id = state.sel.id, n = state.layout.keys.indexOf(id) + 1;
    ids = [id];
    kicker = 'Tasto ' + pad2(n);
    title = 'Tasto ' + n;
    body = [
      section('Azione assegnata', el('div', { class: 'big' }, ...iconAndValue(id, L, 'Nessuna azione'))),
      section('Tutti i layer', el('ul', { class: 'rows' }, [1, 2, 3].map((k) =>
        el('li', { class: k === L ? 'cur' : '' }, el('span', { class: 'k' }, 'Layer ' + k + (k === L ? ' · attivo' : '')), el('div', { class: 'v' }, ...iconAndValue(id, k)))))),
    ];
  } else {
    const trio = state.layout.knobs[state.sel.k];
    ids = trio.slice();
    kicker = 'Encoder ' + pad2(state.sel.k + 1);
    title = 'Manopola ' + (state.sel.k + 1);
    body = [section('Azioni · Layer ' + L, el('ul', { class: 'rows' },
      [['↺  Sinistra', 0], ['Premi', 1], ['↻  Destra', 2]].map(([t, a]) =>
        el('li', {}, el('span', { class: 'k' }, t), el('div', { class: 'v' }, ...iconAndValue(trio[a], L))))))];
  }
  const kinds = [...new Set(ids.map((id) => kindFor(id, L)).filter(Boolean))];
  const here = ids.map((id) => state.sigs.find((x) => x.layer === L && x.id === id)).filter(Boolean);
  const uniqueAll = here.every((x) => x.signed || isUniqueEvent(x));
  const identity = !here.length ? null : here.every((x) => x.signed) ? 'Univoco' : uniqueAll ? 'Univoco · azione unica'
    : here.some((x) => x.signed) ? 'In parte univoco' : 'Per azione';
  const notes = [];
  for (const g of dups) {
    if (!ids.some((id) => g.ids.has(id))) continue;
    const others = [...g.ids].filter((id) => !ids.includes(id)).map(NAME);
    const list = others.length ? others : [...g.ids].map(NAME);
    notes.push(el('p', { class: 'note' }, el('b', {}, 'Azione duplicata'),
      (g.label || 'Questa azione') + ' è assegnata anche a ' + list.join(', ') + '. Il pad invia lo stesso messaggio, quindi la vista li accende insieme.'));
  }
  const close = el('button', { class: 'x', 'aria-label': 'Chiudi' }, '✕');
  close.addEventListener('click', () => select(state.sel));
  card.replaceChildren(
    el('header', {}, el('div', {}, el('span', { class: 'micro' }, kicker), el('h2', {}, title),
      el('div', { class: 'badges' }, el('span', { class: 'badge acc' }, 'Layer ' + L), ...kinds.map((k) => el('span', { class: 'badge' }, k)),
        identity ? el('span', { class: 'badge', title: identity === 'Per azione' ? 'Riconosciuto solo dall\'azione, che si ripete su altri controlli: si confonde. Lascia la firma su Automatica nel configuratore.'
        : identity === 'Univoco · azione unica' ? 'La sua azione non compare altrove nel profilo: l\'evento identifica controllo e layer, e tenuto premuto si ripete.'
        : 'Riconosciuto in modo univoco (controllo + layer) grazie alla firma F13–F21.' }, identity) : null)), close),
    el('div', { class: 'cscroll' }, ...body, ...notes),
    el('div', { class: 'foot' }, el('span', { class: 'micro' }, 'Layer ' + L), (() => {
      const b = el('button', { type: 'button', class: 'pbtn' }, 'Modifica');
      b.addEventListener('click', () => enterEdit());
      return b;
    })()));
  card.hidden = false;
  placeInspector();
  requestAnimationFrame(() => card.classList.add('in'));
}
export function placeInspector() {
  if (!state.sel || card.hidden) return;
  const target = state.sel.kind === 'key' ? hotOf(ctrl.get(state.sel.id)) : knobEl[state.sel.k].querySelector('.n-hot');
  const r = target.getBoundingClientRect();
  const pad = $('#pad .frost').getBoundingClientRect();
  // spazio realmente libero: sotto la barra dei layer/strumenti in alto e sopra la barra in basso
  const topBars = ['.layers', '.brand'].map((q) => { const e = $(q); return e && e.getBoundingClientRect().bottom; }).filter(Boolean);
  const botBars = ['.conncard', '#last', '#diagBtn'].map((q) => { const e = $(q); const rr = e && e.getBoundingClientRect(); return rr && rr.width ? rr.top : null; }).filter((v) => v != null);
  const topMin = Math.max(66, ...topBars.map((v) => v + 10));
  const botMax = Math.min(innerHeight - 8, ...botBars.map((v) => v - 10));
  card.classList.toggle('compact', botMax - topMin < 460);                                  // finestra bassa: intestazione compatta
  const hd = card.querySelector('header'), ft = card.querySelector('.foot'), sc = card.querySelector('.cscroll');
  if (sc) {
    const padY = card.classList.contains('compact') ? 30 : 40;
    const fixed = (hd ? hd.offsetHeight : 0) + (ft ? ft.offsetHeight : 0) + padY + 6;        // padding della scheda + margine
    card.style.setProperty('--cmax', Math.max(72, Math.floor(botMax - topMin - fixed)) + 'px');
  }
  const cw = card.offsetWidth || 280, chh = card.offsetHeight || 220;
  const gap = 24, m = 14, bottom = innerHeight - botMax;
  const cxm = r.left + r.width / 2, cym = r.top + r.height / 2;
  const leftFree = pad.left - m, rightFree = innerWidth - pad.right - m;
  const preferLeft = cxm < pad.left + pad.width / 2;
  const topFor = () => topMin;
  let side = null;
  if (preferLeft && leftFree >= cw + gap) side = 'left';
  else if (!preferLeft && rightFree >= cw + gap) side = 'right';
  else if (leftFree >= cw + gap) side = 'left';
  else if (rightFree >= cw + gap) side = 'right';
  const link = $('#link path'), dot = $('#link circle');
  if (!side) {                                    // finestra stretta: foglio in basso, senza collegamento
    card.style.left = Math.max(m, innerWidth - cw - m) + 'px';
    card.style.top = Math.max(topMin, botMax - chh) + 'px';
    link.setAttribute('d', ''); dot.setAttribute('cx', -10);
    return;
  }
  const x = side === 'left' ? pad.left - gap - cw : pad.right + gap;
  const top = topFor(side);
  const y = Math.max(topMin, Math.min(Math.max(top, cym - chh / 2), innerHeight - bottom - chh));   // mai sopra la barra in alto
  card.style.left = x + 'px';
  card.style.top = y + 'px';
  const sx = side === 'left' ? r.left - 4 : r.right + 4, sy = cym;
  const ex = side === 'left' ? x + cw : x, ey = Math.min(Math.max(y + 26, cym), y + chh - 26);
  const mx = (sx + ex) / 2;
  link.setAttribute('d', `M${sx} ${sy} C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}`);
  dot.setAttribute('cx', sx); dot.setAttribute('cy', sy);
}

/* ---------- interazione con il mouse (selezione e prova delle animazioni) ---------- */
export function attachInteraction() {
  document.querySelectorAll('#pad .key').forEach((g) => {
    const id = Number(g.dataset.id);
    g.addEventListener('pointerdown', () => { press('sim' + id, [{ id }]); });
    const up = () => release('sim' + id);
    g.addEventListener('pointerup', up); g.addEventListener('pointerleave', up);
    g.addEventListener('click', () => select({ kind: 'key', id }));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select({ kind: 'key', id }); } });
  });
  document.querySelectorAll('#pad .knob').forEach((g) => {
    const k = Number(g.dataset.knob);
    const trio = state.layout.knobs[k];
    g.addEventListener('pointerdown', () => { press('simk' + k, [{ id: trio[1] }]); });
    const up = () => release('simk' + k);
    g.addEventListener('pointerup', up); g.addEventListener('pointerleave', up);
    g.addEventListener('click', () => select({ kind: 'knob', k }));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select({ kind: 'knob', k }); } });
    g.addEventListener('wheel', (e) => { e.preventDefault(); rotate(k, e.deltaY < 0 ? -1 : 1); }, { passive: false });
  });
}
