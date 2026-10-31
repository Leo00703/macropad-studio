/* editor-widgets.js — i controlli dell'editor per tipo di azione: media, mouse, firma, tenuto premuto e scelta del tipo. */
import { MP } from '../core/mp.js';
import { state } from '../core/state.js';
import { btn, el } from './dom.js';
import { dropdown } from './dropdown.js';
import { TYPE_ICONS, svgIcon } from './icons.js';
import { section } from './inspector.js';
import { commit, encOpts } from './store.js';

/* — editor nella scheda — */
export const MOUSE_CHOICES = [['Clic sx', { buttons: 1, wheel: 0 }], ['Clic centr.', { buttons: 4, wheel: 0 }], ['Clic dx', { buttons: 2, wheel: 0 }],
  ['Rotella ↑', { buttons: 0, wheel: 1 }], ['Rotella ↓', { buttons: 0, wheel: -1 }]];

export const MODS = [[1, 'Ctrl'], [2, 'Maiusc'], [4, 'Alt']];

export const segBtns = (items, isOn, onPick, label) => {
  const g = el('div', { class: 'eseg' + (items.length <= 3 ? ' g' + items.length : ''), role: 'group', 'aria-label': label || '' });
  items.forEach(([k, text]) => g.append(btn(text, '', () => onPick(k), { 'aria-pressed': String(isOn(k)) })));
  return g;
};

export function mediaEditor(a) {
  return [dropdown(Object.entries(MP.MEDIA).map(([u, name]) => [Number(u), name]), a.usage, (u) => { a.usage = u; commit(); }, 'Funzione multimediale')];
}

export function mouseEditor(a) {
  const click = a.wheel ? null : a.buttons & 4 ? 4 : a.buttons & 2 ? 2 : 1;
  const wheel = a.wheel ? Math.sign(a.wheel) : 0;
  const g = (cls, items, isOn, onPick, label) => {
    const seg = el('div', { class: 'eseg ' + cls, role: 'group', 'aria-label': label });
    items.forEach(([k, text]) => seg.append(btn(text, '', () => onPick(k), { 'aria-pressed': String(isOn(k)) })));
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

export function typeTiles(cur, onPick) {
  const wrap = el('div', { class: 'types', role: 'group', 'aria-label': 'Tipo di azione' });
  [['keys', 'Tastiera'], ['media', 'Media'], ['mouse', 'Mouse'], ['none', 'Nessuna']].forEach(([k, name]) => {
    const b = btn('', 'type', () => onPick(k), { 'aria-pressed': String(cur === k) });
    const ic = el('span', {}, svgIcon(TYPE_ICONS[k]));
    b.append(ic, el('span', {}, name));
    wrap.append(b);
  });
  return wrap;
}

export function signEditor(a, L, id) {
  const p = state.store.profile;
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

/* "Tenuto premuto": ripeti il comando finché è premuto oppure una volta sola per pressione.
   Tasti (una combinazione): Ripeti = tasto normale (ripetizione di Windows), Una volta = tocco (firma).
   Media e rotella: il ponte vede pressione e rilascio, quindi può ripetere (Ripeti) o inviare una volta sola. */
export function holdEditor(a, L, id) {
  if (!a || (a.t !== 'keys' && a.t !== 'media' && !(a.t === 'mouse' && a.wheel))) return null;
  const single = a.t === 'keys' && a.steps.length === 1 && !a.delay;
  if (a.t === 'keys' && !single) {
    if (!a.steps.length) return null;
    return section('Tenuto premuto', el('p', { class: 'hintx' }, 'Le macro con più tasti, o con una pausa, partono una volta sola per pressione.'));
  }
  const mode = a.hold === 'repeat' || a.hold === 'once' ? a.hold : 'auto';
  const set = (k) => { if (k === 'auto') delete a.hold; else a.hold = k; commit(); };
  const rp = MP.repeatOf(state.store.profile);
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
      : state.hosted.has(L + ':' + id) ? 'Una volta per pressione, eseguito dal ponte.' : 'Il pad invia una volta sola; un’eventuale ripetizione la gestisce Windows.';
  }
  return section('Tenuto premuto',
    segBtns([['auto', 'Automatico'], ['repeat', 'Ripeti'], ['once', 'Una volta']], (k) => mode === k, set, 'Tenuto premuto'),
    el('p', { class: 'hintx' }, hint));
}

export function hostNote(a, L, id) {
  if (!a || !state.hosted.has(L + ':' + id)) return null;
  return el('p', { class: 'note' }, el('b', {}, 'Eseguita dal PC'),
    'Questa azione compare su più controlli: il pad invia solo un codice identificativo e la esegue il ponte. Funziona con il ponte attivo, anche in Bluetooth.');
}
