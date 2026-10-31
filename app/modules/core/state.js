/* state.js — stato condiviso della pagina (profilo, layer, collegamento) e costanti di configurazione. */

export const BRIDGE = 'http://127.0.0.1:5174';
export const STORE = 'macropad-studio.v1';          // chiave del profilo salvato nel browser (localStorage)
/* ---------- stato ---------- */
export const DEFAULT_LAYOUT = { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9], knobs: [[13, 14, 15], [16, 17, 18], [19, 20, 21]] };
export const state = {
  store: null, layout: DEFAULT_LAYOUT, sigs: [],
  layerMode: 'auto', detected: 1,            // layer mostrato: 'auto' segue quello fisico, altrimenti 1..3
  padLayer: 1, padKnown: false,              // layer FISICO del pad, dedotto dagli eventi
  bridge: false, precise: false, hostCap: false, hostOk: null, linkCap: false, link: { usb: false, ble: false }, hidSeen: false,
  signed: false, signEmpty: false, plan: null, hosted: new Map(),
  modState: 0, sel: null, edit: false, rotCount: [0, 0, 0],
};
export const ctrl = new Map();          // id → { id, kind: 'key'|'knob', el, act?, knob?, spin? }
export const knobEl = [null, null, null];
export const knobAngle = [0, 0, 0];

export const SENT_KEY = 'macropad-studio.sent.v1';       // istantanea dei pacchetti noti al pad: confronto per sapere cosa va inviato
