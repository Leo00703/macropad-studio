/* main.js — cablaggio: registra gli eventi della pagina (nell'ordine originale) e avvia l'app. */
import { hostedControls, sensorUsage } from './core/keymap.js';
import { STORE, ctrl, state } from './core/state.js';
import { connectBridge, initPageInput, pushHostmap, watchHid } from './ui/bridge.js';
import { initDiagnostics, toggleDiag } from './ui/diag.js';
import { $ } from './ui/dom.js';
import { initDropdowns } from './ui/dropdown.js';
import { initEditor } from './ui/editor.js';
import { Bg } from './ui/effects.js';
import { initInspector, placeInspector, select } from './ui/inspector.js';
import { paintLabels } from './ui/labels.js';
import { buildPad, fitGrain } from './ui/pad.js';
import { load } from './ui/profile.js';
import { onEvent } from './ui/recognition.js';
import { initSheetButtons } from './ui/sheets.js';
import { onCommit, updatePending } from './ui/store.js';

// Registrazione degli eventi della pagina. L'ordine conta: gli ascoltatori di tastiera partono in quest'ordine
// (registrazione della macro e Esc negli elenchi in fase di cattura, poi Esc generale, poi i tasti della pagina).
initEditor();
initDropdowns();
initInspector();
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = ['#send', '#leds', '#settings'].filter((id) => !$(id).hidden);
  if (open.length) { open.forEach((id) => { $(id).hidden = true; }); return; }
  if (state.sel) select(state.sel);
  if (!$('#diag').hidden) toggleDiag(false);
});
initDiagnostics();
initPageInput();
// profilo modificato in un'altra scheda del browser
window.addEventListener('storage', (e) => { if (e.key === STORE) { load(); buildPad(); pushHostmap(false); } });
document.querySelectorAll('#layers button').forEach((b) => b.addEventListener('click', () => {
  state.layerMode = b.dataset.l === 'auto' ? 'auto' : Number(b.dataset.l);
  paintLabels();
}));
initSheetButtons();
watchHid();

// dopo ogni modifica del profilo: si rileggono le firme, si ridisegnano le etichette, si aggiorna il ponte e il confronto col pad
onCommit(load);
onCommit(paintLabels);
onCommit(() => pushHostmap(false));
onCommit(() => updatePending());

load();
buildPad();
connectBridge();
updatePending(true);
new ResizeObserver(() => { fitGrain(); Bg.size(); placeInspector(); }).observe($('#stage'));
if (new URLSearchParams(location.search).has('debug')) window.__live = { state, onEvent, ctrl, load, buildPad, paintLabels, select, hostedControls, sensorUsage };
