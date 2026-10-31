/* main.js — cablaggio: registra gli eventi della pagina (nell'ordine originale) e avvia l'app. */
import { hostedControls, sensorUsage } from './core/keymap.js';
import { STORE, ctrl, state } from './core/state.js';
import { connectBridge, pageKey, pushHostmap, watchHid } from './ui/bridge.js';
import { rawLog, toggleDiag } from './ui/diag.js';
import { $ } from './ui/dom.js';
import { closeDropdowns, ddOpen } from './ui/dropdown.js';
import { editorState, recKey } from './ui/editor.js';
import { Bg, Glass } from './ui/effects.js';
import { card, placeInspector, select } from './ui/inspector.js';
import { paintLabels } from './ui/labels.js';
import { openLeds } from './ui/leds.js';
import { buildPad, fitGrain } from './ui/pad.js';
import { load } from './ui/profile.js';
import { onEvent, wheelEvent } from './ui/recognition.js';
import { openSend } from './ui/send.js';
import { openSettings } from './ui/settings.js';
import { onCommit, updatePending } from './ui/store.js';

window.addEventListener('keydown', (e) => { if (editorState.rec) { e.preventDefault(); e.stopPropagation(); recKey(e, true); } }, true);
window.addEventListener('keyup', (e) => { if (editorState.rec) { e.preventDefault(); e.stopPropagation(); recKey(e, false); } }, true);

window.addEventListener('pointerdown', (e) => { if (ddOpen.size && !e.target.closest('.dd-list, .dd-head')) closeDropdowns(); }, true);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ddOpen.size) { e.stopPropagation(); closeDropdowns(); } }, true);
window.addEventListener('resize', closeDropdowns);
$('#stage').addEventListener('pointerdown', (e) => {
  if (state.sel && !e.target.closest('.key, .knob')) select(state.sel);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = ['#send', '#leds', '#settings'].filter((id) => !$(id).hidden);
    if (open.length) { open.forEach((id) => { $(id).hidden = true; }); return; }
    if (state.sel) select(state.sel);
    if (!$('#diag').hidden) toggleDiag(false);
  }
});
window.addEventListener('resize', () => { placeInspector(); });

$('#diagBtn').addEventListener('click', () => toggleDiag($('#diag').hidden));
$('#rawCopy').addEventListener('click', () => {
  const text = rawLog.slice().reverse().join('\n');
  const b = $('#rawCopy');
  // writeText restituisce una promessa: l'esito (anche un rifiuto del browser) si legge quando arriva
  Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(text))
    .then(() => { b.textContent = navigator.clipboard ? 'Copiato' : 'Non riuscito'; }, () => { b.textContent = 'Non riuscito'; });
  setTimeout(() => { b.textContent = 'Copia'; }, 1500);
});

window.addEventListener('keydown', (e) => { if (!e.repeat) pageKey(e, true); });
window.addEventListener('keyup', (e) => pageKey(e, false));
window.addEventListener('wheel', (e) => { if (!state.bridge && !e.target.closest('#pad .knob')) wheelEvent(e.deltaY < 0 ? 1 : -1); }, { passive: true });
window.addEventListener('storage', (e) => { if (e.key === STORE) { load(); buildPad(); pushHostmap(false); } });

document.querySelectorAll('#layers button').forEach((b) => b.addEventListener('click', () => {
  state.layerMode = b.dataset.l === 'auto' ? 'auto' : Number(b.dataset.l);
  paintLabels();
}));

$('#settingsBtn').addEventListener('click', openSettings);
$('#ledCard').addEventListener('click', openLeds);
$('#ledCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLeds(); } });
watchHid();
$('#chipSend').addEventListener('click', openSend);
$('#chipSend').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSend(); } });

/* ---------- avvio ---------- */
// dopo ogni modifica del profilo: si rileggono le firme, si ridisegnano le etichette, si aggiorna il ponte e il confronto col pad
onCommit(load);
onCommit(paintLabels);
onCommit(() => pushHostmap(false));
onCommit(() => updatePending());

load();
buildPad();
connectBridge();
updatePending(true);
Glass.attach(card, 12, 18, 24);
Glass.attach($('#diag'), 12, 16, 20);
new ResizeObserver(() => { fitGrain(); Bg.size(); placeInspector(); }).observe($('#stage'));
if (new URLSearchParams(location.search).has('debug')) window.__live = { state, onEvent, ctrl, load, buildPad, paintLabels, select, hostedControls, sensorUsage };
