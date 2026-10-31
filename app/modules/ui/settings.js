/* settings.js — impostazioni, esportazione e importazione del profilo. */
import { MP } from '../core/mp.js';
import { state } from '../core/state.js';
import { $, btn, el } from './dom.js';
import { closeDropdowns } from './dropdown.js';
import { section } from './inspector.js';
import { buildPad } from './pad.js';
import { anchorSheet, closeBtn, fillSheet, hideSheets } from './sheets.js';
import { allIds, commit, encOpts, ensureStore } from './store.js';

/* — impostazioni e profilo — */
function coverage() {
  const o = encOpts();
  const c = { total: 0, signed: 0, hosted: 0, normal: 0, uniq: 0, empty: 0 };
  state.store.profile.layers.forEach((Ly, li) => allIds().forEach((id) => {
    const a = Ly.controls && Ly.controls[id];
    if (!a) { if (o.signEmpty) c.empty++; return; }
    if (a.t === 'clear') return;
    c.total++;
    const sg = MP.isSigned(a, o, id, li + 1);
    const host = !!(o.hosted && o.hosted.has((li + 1) + ':' + id));
    if (host) c.hosted++;
    else if (a.t === 'keys' && sg) c.signed++;
    else if (a.t === 'keys') c.normal++;
    else c.uniq++;
  }));
  return c;
}
const switchRow = (title, desc, on, set, disabled) => {
  const b = el('button', { type: 'button', class: 'switchbtn', role: 'switch', 'aria-checked': String(!!on), 'aria-label': title });
  if (disabled) b.setAttribute('disabled', '');
  b.addEventListener('click', () => set(!on));
  return el('div', { class: 'tgl' }, el('div', { class: 't' }, el('b', {}, title), el('small', {}, desc)), b);
};
function exportProfile() {
  const data = { app: 'macropad-studio', version: 1, profile: state.store.profile, layout: state.store.layout || state.layout };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'macropad-profilo.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importProfile(file) {
  try {
    const data = JSON.parse(await file.text());
    const p = data.profile;
    if (!p || !Array.isArray(p.layers) || p.layers.length !== 3) throw new Error('formato non riconosciuto');
    for (const Ly of p.layers) {
      Ly.controls = Ly.controls || {};
      for (const [id, a] of Object.entries(Ly.controls)) {
        if (a && a.t === 'keys') a.steps = Array.isArray(a.steps) ? a.steps : [];
        MP.encodeAction(Number(id), 1, a);          // valida: lancia se il contenuto non è codificabile
      }
    }
    const lay = data.layout && Array.isArray(data.layout.keys) && data.layout.keys.length === 9 ? data.layout : (state.store && state.store.layout) || state.layout;
    state.store = { profile: p, layout: lay };
    commit(); buildPad();
    SETT.msg = 'Profilo importato.'; SETT.err = false;
  } catch (e) { SETT.msg = 'Importazione non riuscita: ' + e.message; SETT.err = true; }
  renderSettings();
}
const SETT = { msg: '', err: false };
export function openSettings() {
  ensureStore();
  SETT.msg = ''; SETT.err = false;
  hideSheets('#settings');
  anchorSheet($('#settings'), $('#settingsBtn'));
  $('#settings').hidden = false;
  renderSettings();
}
export function renderSettings() {
  const box = $('#settings');
  closeDropdowns();
  if (!state.store) { box.hidden = true; return; }
  const p = state.store.profile;
  const set = (k, v) => { p[k] = v; if (!p.signature) p.signAll = false; commit(); renderSettings(); };
  const sigOn = !!p.signature;
  const c = coverage();
  const rpt = MP.repeatOf(p);
  const setRepeat = (patch) => { p.repeat = Object.assign({ delay: rpt.d, rate: rpt.r }, p.repeat || {}, patch); commit(); renderSettings(); };
  const numField = (label, value, min, max, on) => {
    const inp = el('input', { class: 'inp num', type: 'number', min: String(min), max: String(max), step: '10', value: String(value), 'aria-label': label });
    inp.addEventListener('change', () => on(Math.max(min, Math.min(max, Math.round(Number(inp.value) || value)))));
    return el('label', { class: 'numf' }, el('span', {}, label), inp);
  };
  const parts = [];
  if (c.normal) parts.push(c.normal + ' normali (tenuta nativa)');
  if (c.signed) parts.push(c.signed + ' con firma');
  if (c.hosted) parts.push(c.hosted + ' eseguite dal PC');
  if (c.uniq) parts.push(c.uniq + ' media/mouse unici');
  if (c.empty) parts.push(c.empty + ' senza azione (solo identità)');
  const fileIn = el('input', { type: 'file', accept: 'application/json,.json', hidden: '' });
  fileIn.addEventListener('change', () => { if (fileIn.files[0]) importProfile(fileIn.files[0]); });
  const kids = [el('div', { class: 'sh' }, el('span', { class: 'micro' }, 'Impostazioni'), closeBtn(() => { box.hidden = true; })),
    el('h3', {}, 'Identificazione dei controlli'),
    el('p', { class: 'lead' }, 'Come la vista live capisce quale controllo e quale layer stai usando.'),
    el('div', { class: 'tgls' },
      switchRow('Firma automatica', 'Aggiunge due tasti F13–F21 invisibili solo alle azioni che si ripetono su altri controlli. Funziona in USB.', sigOn, (v) => set('signature', v)),
      switchRow('Firma tutti i controlli a tastiera', 'Più sicuro per la vista live, ma ogni tasto diventa un tocco: niente ripetizione se tenuto.', !!p.signAll, (v) => set('signAll', v), !sigOn),
      switchRow('Media e mouse duplicati eseguiti dal PC', 'Uno resta nativo, gli altri inviano un codice identificativo e li esegue il ponte. Vale anche in Bluetooth.', p.hostActions !== false, (v) => set('hostActions', v), !sigOn),
      switchRow('Controlli senza azione', 'Inviano solo un codice multimediale riservato, così premerli rivela il layer. Invisibile alle app.', p.signEmpty !== false, (v) => set('signEmpty', v), !sigOn)),
    el('p', { class: 'fine' }, c.total + ' azioni: ' + (parts.join(' · ') || 'nessuna') + '.'),
    section('Ripetizione a tasto tenuto',
      el('div', { class: 'numrow' },
        numField('Attesa (ms)', rpt.d, 100, 2000, (v) => setRepeat({ delay: v })),
        numField('Intervallo (ms)', rpt.r, 30, 500, (v) => setRepeat({ rate: v }))),
      el('p', { class: 'fine' }, 'Vale per i controlli impostati su “Ripeti” che esegue il ponte (media e rotella). I tasti normali usano la ripetizione di Windows.')),
    section('Profilo',
      el('div', { class: 'row2' }, btn('Esporta', 'sbtn', exportProfile), btn('Importa…', 'sbtn', () => fileIn.click()), fileIn),
      el('p', { class: 'fine' }, 'Il profilo è salvato in questo browser. Il pad non si può rileggere: un file esportato è l’unico backup.'))];
  if (SETT.msg) kids.push(el('p', { class: 'hintx' + (SETT.err ? ' warnx' : '') }, SETT.msg));
  fillSheet(box, kids);
}
