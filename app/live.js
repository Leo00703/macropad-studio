/* Macropad Studio: vista live e configuratore (logica e interfaccia).
   Caricato da live.html dopo protocol.js, che espone globalThis.MP.
   Le sezioni sono introdotte da commenti "---------- titolo ----------". */
(() => {
  'use strict';
  const BRIDGE = 'http://127.0.0.1:5174';
  const STORE = 'macropad-studio.v1';          // stesso profilo salvato dal configuratore (stessa origine)
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    for (const k of kids.flat()) if (k) n.append(k);
    return n;
  };
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  };
  const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- geometria misurata sulla foto dall'alto del prodotto reale ----------
     Unità = pixel della foto, con origine nell'angolo in alto a sinistra della piastra (foto: 95, 305).
     Sagoma: blocco tasti 1297 × 815 con angolo alto‑destra r=220, raccordo concavo r=140 e "coda" a capsula (r=200)
     attorno alla manopola grande. Le basi dei tasti sono quelle viste dall'alto (i cappucci sono in prospettiva). */
  const OUTLINE = 'M65 0H1077A220 220 0 0 1 1297 220V1152A200 200 0 0 1 897 1152V955A140 140 0 0 0 757 815H65A65 65 0 0 1 0 750V65A65 65 0 0 1 65 0Z';
  const KEY_X = [199, 441, 681], KEY_Y = [137, 389, 639];
  const KNOBS = [
    { x: 1097, y: 212, disc: 106, ring: 109, sk: { dx: 0, dy: 4, r: 119 }, hl: -50, mark: { a: -90, r0: 62, r1: 103, w: 9 } },
    { x: 1097, y: 614, disc: 106, ring: 109, sk: { dx: 0, dy: 4, r: 119 }, hl: -27, mark: { a: -90, r0: 62, r1: 103, w: 9 } },
    { x: 1097, y: 1152, disc: 152, ring: 0, bezel: 184, sk: null, hl: -9, mark: { a: -90, r0: 88, r1: 146, w: 11 }, big: true },
  ];
  const SCREWS = [[55, 53], [52, 750], [900, 800], [1242, 963]];
  // colori LED come nel configuratore (codice → css); di fabbrica: layer 1 verde, 2 e 3 bianchi (osservato)
  const LED_CSS = { 0: '#e6ebf2', 1: '#ff3b3b', 2: '#ff9a2e', 3: '#ffe14a', 4: '#34d86b', 5: '#2ee6e6', 6: '#3b6bff', 7: '#b25cff' };
  const LED_NAME = { 0: 'Bianco', 1: 'Rosso', 2: 'Arancio', 3: 'Giallo', 4: 'Verde', 5: 'Ciano', 6: 'Blu', 7: 'Viola' };
  const LED_DEFAULT = ['#34d86b', '#dfe6f0', '#dfe6f0'];

  /* ---------- simboli delle azioni ----------
     Griglia 24 × 24, tratto 1.9 con estremi arrotondati, stessa grammatica dei riquadri "Cosa fa". 'f' = pieno, 's' = tratto.
     Sui tasti sostituiscono il testo quando l'azione ha un simbolo riconoscibile; altrimenti resta il testo. */
  const SPK = 'M3 9.5h3.8L12 5v14l-5.2-4.5H3z';
  const MBODY = 'M12 3a5.5 5.5 0 0 1 5.5 5.5v7a5.5 5.5 0 0 1-11 0v-7A5.5 5.5 0 0 1 12 3z';
  const WBODY = 'M9 3a4.6 4.6 0 0 1 4.6 4.6v8.8a4.6 4.6 0 0 1-9.2 0V7.6A4.6 4.6 0 0 1 9 3z';
  const ICONS = {
    play_pause: [['f', 'M3.5 5.5v13l8.5-6.5z'], ['f', 'M15 5.5h2.7v13H15zM19.6 5.5h2.7v13h-2.7z']],
    vol_up: [['f', SPK], ['s', 'M16.5 12h5M19 9.5v5']],
    vol_down: [['f', SPK], ['s', 'M16.5 12h5']],
    mute: [['f', SPK], ['s', 'M16.5 9.5l5 5M21.5 9.5l-5 5']],
    next: [['f', 'M4.5 5.5v13l9.5-6.5z'], ['f', 'M16.8 5.5h2.7v13h-2.7z']],
    prev: [['f', 'M19.5 5.5v13L10 12z'], ['f', 'M4.5 5.5h2.7v13H4.5z']],
    click_left: [['f', 'M12 3a5.5 5.5 0 0 0-5.5 5.5v1.7H12z'], ['s', MBODY], ['s', 'M12 3v7.2M6.5 10.2h11']],
    click_right: [['f', 'M12 3a5.5 5.5 0 0 1 5.5 5.5v1.7H12z'], ['s', MBODY], ['s', 'M12 3v7.2M6.5 10.2h11']],
    click_mid: [['s', MBODY], ['f', 'M10.7 5.6h2.6v4.2h-2.6z'], ['s', 'M6.5 10.2h11']],
    wheel_up: [['s', WBODY], ['f', 'M7.8 6.4h2.4v3.8H7.8z'], ['s', 'M19 19V6.5M15.6 9.9L19 6.5l3.4 3.4']],
    wheel_down: [['s', WBODY], ['f', 'M7.8 6.4h2.4v3.8H7.8z'], ['s', 'M19 5v12.5M15.6 14.1L19 17.5l3.4-3.4']],
    arrow_right: [['s', 'M4 12h15M13 6l6 6-6 6']],
    arrow_left: [['s', 'M20 12H5M11 6l-6 6 6 6']],
    arrow_up: [['s', 'M12 20V5M6 11l6-6 6 6']],
    arrow_down: [['s', 'M12 4v15M6 13l6 6 6-6']],
    enter: [['s', 'M19.5 5v7.5H6.5M11 8l-4.5 4.5L11 17']],
    backspace: [['s', 'M9 6h11.5v12H9l-5.5-6z'], ['s', 'M12.8 9.6l4.8 4.8M17.6 9.6l-4.8 4.8']],
    delete: [['s', 'M15 6H3.5v12H15l5.5-6z'], ['s', 'M7 9.6l4.8 4.8M11.8 9.6L7 14.4']],
    tab: [['s', 'M3.5 12h13M12.5 7l5 5-5 5M20.5 6v12']],
    space: [['s', 'M4 10.5v5.5h16v-5.5']],
    copy: [['s', 'M9 9h11v11H9z'], ['s', 'M5 15V4h11']],
    paste: [['s', 'M6.5 5.5h11V20h-11z'], ['f', 'M9.5 3h5v4h-5z'], ['s', 'M9.8 11.5h4.4M9.8 15h4.4']],
    cut: [['s', 'M6 4.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM6 14.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z'], ['s', 'M8 8.4L20 18M8 15.6L20 6']],
    undo: [['s', 'M9 5.5L4 10.5l5 5M4.5 10.5H15a4.8 4.8 0 0 1 0 9.6h-3']],
    redo: [['s', 'M15 5.5l5 5-5 5M19.5 10.5H9a4.8 4.8 0 0 0 0 9.6h3']],
    save: [['s', 'M5 4h11l3 3v13H5z'], ['s', 'M8 4v5h7V4M8 20v-6h8v6']],
  };
  const MEDIA_ICON = { 0xCD: 'play_pause', 0xE9: 'vol_up', 0xEA: 'vol_down', 0xE2: 'mute', 0xB5: 'next', 0xB6: 'prev' };
  const NAV_ICON = { 0x4F: 'arrow_right', 0x50: 'arrow_left', 0x51: 'arrow_down', 0x52: 'arrow_up', 0x28: 'enter', 0x2A: 'backspace', 0x4C: 'delete', 0x2B: 'tab', 0x2C: 'space' };
  const CTRL_ICON = { 0x06: 'copy', 0x19: 'paste', 0x1B: 'cut', 0x1D: 'undo', 0x1C: 'redo', 0x16: 'save' };
  /* nome del simbolo per un'azione (o null: si mostra il testo) */
  function iconFor(a) {
    if (!a) return null;
    if (a.t === 'media') return MEDIA_ICON[a.usage] || null;
    if (a.t === 'mouse') {
      if (a.wheel) return a.wheel > 0 ? 'wheel_up' : 'wheel_down';          // con modificatori: simbolo + didascalia (iconCap)
      return a.buttons & 1 ? 'click_left' : a.buttons & 2 ? 'click_right' : a.buttons & 4 ? 'click_mid' : null;
    }
    if (a.t === 'keys' && a.steps && a.steps.length === 1 && !a.delay) {
      const s = a.steps[0], m = ((s.mod || 0) | ((s.mod || 0) >> 4)) & 0x0F;
      if (m === 0) return NAV_ICON[s.key] || null;
      if (m === 1) return CTRL_ICON[s.key] || null;
    }
    return null;
  }
  const iconCap = (a) => (a && a.t === 'mouse' && a.wheel && a.mod ? modLabel(hidMask(a.mod)) : '');
  const iconPathsHTML = (name) => (ICONS[name] || []).map(([k, d]) => '<path class="' + k + '" d="' + d + '"/>').join('');
  /* icona come elemento HTML in linea (scheda, fogli) */
  function iconEl(name, cls) {
    const s = el('span', { class: 'vic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + iconPathsHTML(name) + '</svg>';
    return s;
  }

  /* ---------- stato ---------- */
  const DEFAULT_LAYOUT = { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9], knobs: [[13, 14, 15], [16, 17, 18], [19, 20, 21]] };
  const S = { store: null, layout: DEFAULT_LAYOUT, sigs: [], layerMode: 'auto', detected: 1, bridge: false, precise: false, modState: 0, sel: null,
    signed: false, edit: false, link: { usb: false, ble: false }, linkCap: false, hidSeen: false, volumeAsKey: false, signEmpty: false, hosted: new Map(), plan: null, hostCap: false, hostOk: null, padLayer: 1, padKnown: false, rotCount: [0, 0, 0] };   // padLayer: layer FISICO del pad, dedotto dagli eventi
  const ctrl = new Map();          // id → { id, kind: 'key'|'knob', el, act?, knob?, spin? }
  const knobEl = [null, null, null];
  const knobAngle = [0, 0, 0];

  /* ---------- tabelle ---------- */
  const U2VK = {};
  for (let i = 0; i < 26; i++) U2VK[0x04 + i] = 65 + i;
  for (let i = 0; i < 9; i++) U2VK[0x1E + i] = 49 + i;
  U2VK[0x27] = 48;
  Object.assign(U2VK, { 0x28: 13, 0x29: 27, 0x2A: 8, 0x2B: 9, 0x2C: 32, 0x2D: 189, 0x2E: 187, 0x2F: 219, 0x30: 221, 0x31: 220, 0x33: 186,
    0x34: 222, 0x35: 192, 0x36: 188, 0x37: 190, 0x38: 191, 0x39: 20, 0x46: 44, 0x47: 145, 0x48: 19, 0x49: 45, 0x4A: 36, 0x4B: 33, 0x4C: 46,
    0x4D: 35, 0x4E: 34, 0x4F: 39, 0x50: 37, 0x51: 40, 0x52: 38, 0x53: 144, 0x54: 111, 0x55: 106, 0x56: 109, 0x57: 107, 0x58: 13,
    0x62: 96, 0x63: 110, 0x65: 93 });
  for (let i = 0; i < 12; i++) { U2VK[0x3A + i] = 112 + i; U2VK[0x68 + i] = 124 + i; }
  for (let i = 0; i < 9; i++) U2VK[0x59 + i] = 97 + i;
  Object.assign(U2VK, { 0x7F: 173, 0x80: 175, 0x81: 174 });          // Muto, Volume +, Volume − come tasti tastiera
  const VOL_KEY = { 0xE2: 173, 0xE9: 175, 0xEA: 174 };               // usage consumer → VK equivalente
  /* firma univoca (stessa regola di MP.signatureKeys nel configuratore): n = (layer−1)·24 + (id−1), cifre in base 9 → F13+… */
  const sigSteps = (id, layer) => { const n = (layer - 1) * 24 + (id - 1); return [{ vk: 124 + Math.floor(n / 9), mods: 0 }, { vk: 124 + (n % 9), mods: 0 }]; };
  const isSigVk = (vk) => vk >= 124 && vk <= 132;                    // F13–F21
  /* HOSTED-BEGIN — stessa logica di MP.hostedControls in protocol.js (app/test/protocol.test.js verifica che coincidano).
     Media e mouse non possono portare la firma: per ogni gruppo di azioni identiche UN controllo resta nativo (il pad
     la esegue e l'evento è univoco), gli altri inviano solo la firma e l'azione la esegue il ponte sul PC. */
  const HOST_VK = { 0xE2: 0xAD, 0xEA: 0xAE, 0xE9: 0xAF, 0xB5: 0xB0, 0xB6: 0xB1, 0xB7: 0xB2, 0xCD: 0xB3,
    0x18A: 0xB4, 0x183: 0xB5, 0x192: 0xB7, 0x221: 0xAA, 0x223: 0xAC, 0x224: 0xA6, 0x225: 0xA7, 0x226: 0xA9, 0x227: 0xA8, 0x22A: 0xAB };
  function hostActionOf(a) {
    if (!a) return null;
    if (a.t === 'media' && HOST_VK[a.usage]) return { group: 'm' + a.usage, act: { k: 'key', vk: HOST_VK[a.usage] } };
    if (a.t === 'mouse') {
      if (a.wheel) return { group: 'w' + Math.sign(a.wheel) + ':' + ((a.mod || 0) & 7), act: { k: 'wheel', d: a.wheel > 0 ? 120 : -120, m: (a.mod || 0) & 7 } };
      if (a.buttons) return { group: 'b' + (a.buttons & 7), act: { k: 'btn', b: a.buttons & 7 } };
    }
    return null;
  }
  /* ripetizione eseguita dal ponte per i controlli con "Ripeti": attesa prima della prima ripetizione e intervallo (ms) */
  const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  function repeatOf(profile) {
    const r = (profile && profile.repeat) || {};
    return { d: clampInt(r.delay, 100, 2000, 450), r: clampInt(r.rate, 30, 500, 70) };
  }
  function hostedControls(profile, layout) {
    const ids = [...layout.keys, ...layout.knobs.flat()];
    const groups = new Map();
    const out = new Map();
    profile.layers.forEach((L, li) => ids.forEach((id) => {
      const a = L.controls && L.controls[id];
      const h = hostActionOf(a);
      if (!h) return;
      // "tenuto premuto" scelto a mano: il controllo lo gestisce il ponte (vede pressione e rilascio) e non occupa il posto nativo
      if (a.hold === 'once') { out.set((li + 1) + ':' + id, h.act); return; }
      if (a.hold === 'repeat') { out.set((li + 1) + ':' + id, Object.assign({}, h.act, { rep: repeatOf(profile) })); return; }
      if (!groups.has(h.group)) groups.set(h.group, []);
      groups.get(h.group).push({ layer: li + 1, id, act: h.act, rank: id >= 13 ? ((id - 13) % 3 === 1 ? 2 : 0) : 1 });
    }));
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((x, y) => x.rank - y.rank || x.layer - y.layer || x.id - y.id);
      for (const c of list.slice(1)) out.set(c.layer + ':' + c.id, c.act);
    }
    return out;
  }
  /* identità "sensore" (usage consumer riservato, valido anche in Bluetooth): stessa tabella di MP.SENSOR_USAGES */
  const SENSOR_USAGES = [];
  for (const [a, b] of [[0x07, 0x1F], [0x49, 0x5F], [0x67, 0x7F]]) for (let u = a; u <= b && SENSOR_USAGES.length < 72; u++) SENSOR_USAGES.push(u);
  const sensorUsage = (id, layer) => SENSOR_USAGES[(layer - 1) * 24 + (id - 1)];
  /* Quali controlli a tastiera portano la firma (modalità automatica): solo quelli la cui azione si confonde con un altro
     controllo di qualunque layer. Gli altri sono "normali" (tenuta nativa) e si riconoscono dall'azione. */
  const normMod = (m) => ((m || 0) | ((m || 0) >> 4)) & 0x0F;
  const seqOf = (a) => (a.steps || []).filter((st) => st.key).map((st) => normMod(st.mod) + ':' + st.key);
  function seqClash(x, y) {
    const n = Math.min(x.length, y.length);
    if (!n) return false;
    for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  function signPlan(profile, layout) {
    const ids = [...layout.keys, ...layout.knobs.flat()];
    const all = !!profile.signAll;
    const items = [];
    profile.layers.forEach((L, li) => ids.forEach((id) => {
      const a = L.controls && L.controls[id];
      if (!a || a.t !== 'keys') return;
      const seq = seqOf(a);
      if (!seq.length) return;
      const rank = id < 13 ? 0 : ((id - 13) % 3 === 1 ? 1 : 2);
      // "tenuto premuto": Una volta = tocco (firma), Ripeti = tasto normale che segue la mano
      items.push({ key: (li + 1) + ':' + id, seq, rank, layer: li + 1, id, hold: a.hold, force: a.hold === 'once' ? 'on' : a.hold === 'repeat' ? 'off' : a.sign });
    }));
    items.sort((x, y) => x.rank - y.rank || x.layer - y.layer || x.id - y.id);
    const keys = new Set();
    const normal = [];
    for (const it of items) if (it.force === 'off' && (!all || it.hold === 'repeat')) normal.push(it.seq);
    for (const it of items) {
      if (it.hold === 'repeat') continue;                                       // la ripetizione esplicita vince su "firma tutto"
      if (all || it.force === 'on') keys.add(it.key);
      else if (it.force === 'off') continue;
      else if (normal.some((q) => seqClash(q, it.seq))) keys.add(it.key);
      else normal.push(it.seq);
    }
    return { keys, hosted: hostedControls(profile, layout) };
  }
  /* HOSTED-END */
  const CODE2VK = {};
  for (let i = 0; i < 26; i++) CODE2VK['Key' + String.fromCharCode(65 + i)] = 65 + i;
  for (let i = 0; i <= 9; i++) CODE2VK['Digit' + i] = 48 + i;
  for (let i = 1; i <= 24; i++) CODE2VK['F' + i] = 111 + i;
  Object.assign(CODE2VK, { Enter: 13, Escape: 27, Backspace: 8, Tab: 9, Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Insert: 45, Delete: 46 });
  const MEDIA_KEY = { AudioVolumeDown: 0xEA, AudioVolumeUp: 0xE9, AudioVolumeMute: 0xE2, MediaPlayPause: 0xCD, MediaTrackNext: 0xB5, MediaTrackPrevious: 0xB6 };
  const MEDIA_NAME = { 0xEA: 'Volume −', 0xE9: 'Volume +', 0xE2: 'Muto', 0xCD: 'Play/Pausa', 0xB5: 'Traccia succ.', 0xB6: 'Traccia prec.' };
  const KEY_NAME = { 8: '⌫', 9: 'Tab', 13: 'Invio', 27: 'Esc', 32: 'Spazio', 33: 'Pag↑', 34: 'Pag↓', 35: 'Fine', 36: 'Home', 37: '←', 38: '↑', 39: '→', 40: '↓',
    45: 'Ins', 46: 'Canc', 20: 'Bloc Maiusc', 173: 'Muto', 174: 'Volume −', 175: 'Volume +' };
  const vkName = (vk) => KEY_NAME[vk] || (vk >= 65 && vk <= 90 ? String.fromCharCode(vk) : vk >= 48 && vk <= 57 ? String.fromCharCode(vk)
    : vk >= 112 && vk <= 135 ? 'F' + (vk - 111) : vk >= 96 && vk <= 105 ? 'Num ' + (vk - 96) : '0x' + vk.toString(16).toUpperCase());
  function modBit(vk) { return (vk === 17 || vk === 162 || vk === 163) ? 1 : (vk === 16 || vk === 160 || vk === 161) ? 2 : (vk === 18 || vk === 164 || vk === 165) ? 4 : (vk === 91 || vk === 92) ? 8 : 0; }
  const hidMask = (m) => ((m & 0x11) ? 1 : 0) | ((m & 0x22) ? 2 : 0) | ((m & 0x44) ? 4 : 0) | ((m & 0x88) ? 8 : 0);
  const modLabel = (mask) => [mask & 1 && 'Ctrl', mask & 2 && 'Maiusc', mask & 4 && 'Alt', mask & 8 && 'Win'].filter(Boolean).join('+');

  /* ---------- profilo → firme riconoscibili ---------- */
  function summarize(a) {
    if (!a) return '';
    if (a.t === 'keys') {
      const parts = (a.steps || []).map((s) => (modLabel(hidMask(s.mod || 0)) ? modLabel(hidMask(s.mod)) + '+' : '') + (s.key ? vkName(U2VK[s.key] || 0) : ''));
      return parts.every((x) => x.length === 1) ? parts.join('') : parts.join(' ');
    }
    if (a.t === 'media') return MEDIA_NAME[a.usage] || 'Media';
    if (a.t === 'mouse') {
      const m = modLabel(hidMask(a.mod || 0));
      if (a.wheel) return (m ? m + '+' : '') + 'Rotella ' + (a.wheel > 0 ? '↑' : '↓');
      return a.buttons & 1 ? 'Clic sinistro' : a.buttons & 2 ? 'Clic destro' : a.buttons & 4 ? 'Clic centrale' : 'Mouse';
    }
    return '';
  }
  const KIND_NAME = { keys: 'Tastiera', media: 'Media', wheel: 'Rotella del mouse', button: 'Pulsante del mouse' };
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) { raw = null; }
    S.store = raw && raw.profile && Array.isArray(raw.profile.layers) ? raw : null;
    S.layout = raw && raw.layout && Array.isArray(raw.layout.keys) && raw.layout.keys.length === 9 ? raw.layout : DEFAULT_LAYOUT;
    S.sigs = [];
    S.hosted = new Map();
    S.plan = null;
    if (!S.store) return;
    S.signed = !!S.store.profile.signature;
    S.volumeAsKey = S.signed && !!S.store.profile.volumeAsKey;
    S.signEmpty = S.signed && S.store.profile.signEmpty !== false;
    S.plan = S.signed ? signPlan(S.store.profile, S.layout) : null;
    S.hosted = S.plan && S.store.profile.hostActions !== false ? S.plan.hosted : new Map();
    const ids = [...S.layout.keys, ...S.layout.knobs.flat()];
    S.store.profile.layers.forEach((L, li) => {
      for (const id of ids) {
        const a = L.controls && L.controls[id];
        if (!a) {
          // controllo senza azione ma con la sola firma: premerlo identifica comunque controllo e layer
          if (S.signEmpty) S.sigs.push({ layer: li + 1, id, label: '', delay: 0, signed: true, empty: true, kind: 'media', usage: sensorUsage(id, li + 1) });
          continue;
        }
        const base = { layer: li + 1, id, label: summarize(a), icon: iconFor(a), cap: iconCap(a), delay: a.delay || 0, signed: false };
        if (S.hosted.has((li + 1) + ':' + id) && (a.t === 'media' || a.t === 'mouse')) {
          // azione duplicata: il pad invia solo l'identità (usage riservato), l'azione la esegue il ponte sul PC
          S.sigs.push(Object.assign(base, { kind: 'media', usage: sensorUsage(id, li + 1), signed: true, hosted: true }));
          continue;
        }
        if (a.t === 'keys') {
          const user = (a.steps || []).filter((s) => s.key).map((s) => ({ vk: U2VK[s.key], mods: hidMask(s.mod || 0) }));
          if (user.length && user.every((s) => s.vk)) {
            // firma solo dove serve (azione ripetuta su altri controlli/layer); altrimenti il tasto è "normale"
            const sg = !!(S.plan && S.plan.keys.has((li + 1) + ':' + id));
            const steps = sg ? sigSteps(id, li + 1).concat(user) : user;
            S.sigs.push(Object.assign(base, { kind: 'keys', steps, signed: sg }));
          }
        } else if (a.t === 'media') {
          if (S.volumeAsKey && VOL_KEY[a.usage]) {
            S.sigs.push(Object.assign({}, base, { kind: 'keys', steps: sigSteps(id, li + 1).concat([{ vk: VOL_KEY[a.usage], mods: 0 }]), signed: true }));
          }
          // anche come evento media: Windows scarta i codici tastiera di volume, quindi se il pad è stato riportato al
          // tipo media (o l'opzione è spenta) il controllo si riconosce dall'evento media + layer + durata
          S.sigs.push(Object.assign({}, base, { kind: 'media', usage: a.usage }));
        } else if (a.t === 'mouse') {
          if (a.wheel) S.sigs.push(Object.assign(base, { kind: 'wheel', dir: Math.sign(a.wheel), mods: hidMask(a.mod || 0) }));
          else if (a.buttons) S.sigs.push(Object.assign(base, { kind: 'button', button: a.buttons & 1 ? 'left' : a.buttons & 2 ? 'right' : 'middle' }));
        }
      }
    });
  }
  /* mappa firma → azione per il ponte (endpoint /hostmap: accetta solo l'origine di questa pagina) */
  let hostSent = '';
  function pushHostmap(force) {
    if (!S.bridge || !S.hostCap) return;
    const entries = [];
    for (const [key, act] of S.hosted) {
      const [layer, id] = key.split(':').map(Number);
      entries.push(Object.assign({ u: sensorUsage(id, layer) }, act));
    }
    const body = JSON.stringify({ v: 1, entries });
    if (!force && body === hostSent && S.hostOk) return;
    hostSent = body;
    fetch(BRIDGE + '/hostmap', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { S.hostOk = !!(j && j.ok); chips(); })
      .catch(() => { S.hostOk = false; chips(); });
  }
  function ledInfo(L) {
    const lay = S.store && S.store.profile.layers[L - 1];
    const c = lay && lay.led && lay.led.color;
    const m = lay && lay.led ? lay.led.mode : 1;
    if (m === 5) return { css: LED_CSS[0], name: 'Bianco' };           // "Tutti bianchi": il colore scelto non conta
    return typeof c === 'number' && LED_CSS[c] ? { css: LED_CSS[c], name: LED_NAME[c] } : { css: LED_DEFAULT[L - 1] || LED_DEFAULT[1], name: L === 1 ? 'Verde' : 'Bianco' };
  }

  /* ---------- 1: sfondo ambientale ----------
     Campo di punti con una lenta onda diagonale e un'onda che parte dal controllo usato.
     Opacità basse, nessun gradiente colorato; con "Riduci movimento" resta una griglia statica. */
  const Bg = (() => {
    const cv = $('#bg'), ctx = cv.getContext('2d');
    const STEP = 20, MAG_R = 210, PUSH = 9;
    let W = 0, H = 0, cx = 0, cy = 0, cols = 0, rows = 0, ox0 = 0, oy0 = 0;
    let dotRGB = [255, 255, 255], accRGB = [41, 151, 255], ledRGB = [52, 216, 107];
    let offX = new Float32Array(0), offY = new Float32Array(0);
    const mouse = { x: -9999, y: -9999, on: false, t: 0 };
    const ripples = [];
    let running = false, lastDraw = 0, settling = false;
    const nums = (v) => v.split(',').map((n) => Number(n.trim()));
    const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    function colors() {
      const cs = getComputedStyle(document.documentElement);
      const d = nums(cs.getPropertyValue('--dot-rgb') || ''), a = nums(cs.getPropertyValue('--accent-rgb') || '');
      if (d.length === 3 && d.every((v) => !isNaN(v))) dotRGB = d;
      if (a.length === 3 && a.every((v) => !isNaN(v))) accRGB = a;
      const l = hex(cs.getPropertyValue('--led')); if (l) ledRGB = l;
    }
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / STEP) + 1; rows = Math.ceil(H / STEP) + 1;
      ox0 = (W - (cols - 1) * STEP) / 2; oy0 = (H - (rows - 1) * STEP) / 2;
      offX = new Float32Array(cols * rows); offY = new Float32Array(cols * rows);
      const f = $('#pad .frost');
      const r = f ? f.getBoundingClientRect() : null;
      cx = r && r.width ? r.left + r.width / 2 : W / 2;
      cy = r && r.height ? r.top + r.height / 2 : H / 2;
      colors();
      draw(performance.now());
      kick();
    }
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    function draw(ts) {
      ctx.clearRect(0, 0, W, H);
      const R2 = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 0.95;
      const t = REDUCE_MOTION ? 0 : ts;
      const sweepPos = REDUCE_MOTION ? -9999 : ((ts / 38) % (W + H + 900)) - 450;
      const magnet = mouse.on && !REDUCE_MOTION;
      let maxOff = 0;
      for (let iy = 0; iy < rows; iy++) {
        const y = oy0 + iy * STEP, yn = y / H;
        for (let ix = 0; ix < cols; ix++) {
          const i = iy * cols + ix, x = ox0 + ix * STEP;
          // effetto del puntatore (come Stitch): repulsione morbida e dissolvenza, senza cambiare colore
          let tx = 0, ty = 0, mag = 0;
          if (magnet) {                                           // i punti si allontanano dal puntatore e si spengono
            const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
            if (d < MAG_R) {
              const k = 1 - d / MAG_R;
              mag = k * k * (3 - 2 * k);
              if (d > 0.01) { tx = dx / d * PUSH * mag; ty = dy / d * PUSH * mag; }
            }
          }
          offX[i] += (tx - offX[i]) * 0.17; offY[i] += (ty - offY[i]) * 0.17;
          const o = Math.abs(offX[i]) + Math.abs(offY[i]);
          if (o > maxOff) maxOff = o;
          const d0 = Math.hypot(x - cx, y - cy) / R2;
          let a = 0.07 + 0.16 * Math.max(0, 1 - d0 * d0);           // più fitto attorno al pad, svanisce ai bordi
          let r = 1.05;
          // aurora in basso: i punti prendono il colore del LED del layer
          const b1 = Math.exp(-Math.pow((yn - (0.80 + 0.05 * Math.sin(x * 0.0042 + t * 0.00035))) / 0.17, 2));
          const b2 = Math.exp(-Math.pow((yn - (0.96 + 0.04 * Math.sin(x * 0.0061 - t * 0.00028))) / 0.12, 2)) * 0.85;
          const f = Math.min(1, b1 + b2) * (0.55 + 0.45 * Math.sin(x * 0.0031 + t * 0.0002 + 1.3));
          let col = dotRGB;
          if (f > 0.02) { col = mix(dotRGB, ledRGB, Math.min(0.9, f * 0.95)); a += f * 0.26; }
          let boost = 0;
          if (!REDUCE_MOTION) {
            const p = (x + y) * 0.7071 - sweepPos * 0.7071;
            a += 0.06 * Math.exp(-(p * p) / 26000);
            for (const rp of ripples) {
              const dd = Math.hypot(x - rp.x, y - rp.y);
              const k = 1 - Math.abs(dd - rp.r) / 95;
              if (k > 0) boost = Math.max(boost, k * k * rp.fade * rp.s);
            }
          }
          if (boost > 0.015) {
            col = mix(col, accRGB, Math.min(1, boost * 1.1));
            a = Math.min(0.95, a + boost * 0.6);
            r += boost * 1.5;
          }
          if (mag > 0) { a *= 1 - 0.8 * mag; r *= 1 - 0.3 * mag; }
          ctx.fillStyle = 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + a.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(x + offX[i], y + offY[i], r, 0, 6.2832); ctx.fill();
        }
      }
      settling = maxOff > 0.04;
    }
    function frame(ts) {
      if (document.hidden) { running = false; return; }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i], age = ts - rp.t0;
        rp.r = age * 0.62; rp.fade = Math.max(0, 1 - age / 1200);
        if (age > 1200) ripples.splice(i, 1);
      }
      const active = (mouse.on && ts - mouse.t < 1600) || ripples.length > 0 || settling;
      if (ts - lastDraw >= (active ? 14 : 66)) { lastDraw = ts; draw(ts); }
      requestAnimationFrame(frame);
    }
    function kick() { if (!running && !REDUCE_MOTION) { running = true; requestAnimationFrame(frame); } }
    function ripple(x, y, s) {
      if (REDUCE_MOTION) return;
      ripples.push({ x, y, s: s || 1, t0: performance.now(), r: 0, fade: 1 });
      if (ripples.length > 6) ripples.shift();
      kick();
    }
    function setLed(css) { const l = hex(css); if (l) { ledRGB = l; kick(); } }
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; mouse.t = performance.now(); kick(); }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.on = false; kick(); });
    window.addEventListener('blur', () => { mouse.on = false; });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors(); draw(performance.now()); });
    return { size, ripple, setLed };
  })();
  function hotOf(c) { return c.el.querySelector(c.kind === 'knob' ? '.n-hot' : '.k-face'); }
  function ripple(c, s) {
    const hot = hotOf(c);
    if (!hot) return;
    const r = hot.getBoundingClientRect();
    Bg.ripple(r.left + r.width / 2, r.top + r.height / 2, s);
  }

  /* ---------- vetro con rifrazione ai bordi (solo Chromium) ----------
     Una mappa di spostamento per ogni superficie flottante: ai bordi lo sfondo viene "piegato" verso l'interno.
     Altrove resta un semplice blur con riflesso dal CSS. */
  const Glass = (() => {
    const ok = !!window.chrome && !matchMedia('(prefers-reduced-transparency: reduce)').matches;
    let defs = null, n = 0;
    function mapURL(w, hh, radius, bezel) {
      const c = document.createElement('canvas');
      c.width = w; c.height = hh;
      const g = c.getContext('2d');
      const img = g.createImageData(w, hh), d = img.data;
      const rr = Math.min(radius, w / 2, hh / 2);
      for (let y = 0; y < hh; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5, py = y + 0.5;
          const qx = Math.abs(px - w / 2) - (w / 2 - rr), qy = Math.abs(py - hh / 2) - (hh / 2 - rr);
          const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
          const depth = -(out + Math.min(Math.max(qx, qy), 0) - rr);
          let dx = 0, dy = 0;
          if (depth < bezel) {
            let nx, ny;
            if (qx > 0 || qy > 0) { nx = Math.sign(px - w / 2) * Math.max(qx, 0) / (out || 1); ny = Math.sign(py - hh / 2) * Math.max(qy, 0) / (out || 1); }
            else if (qx > qy) { nx = Math.sign(px - w / 2); ny = 0; } else { nx = 0; ny = Math.sign(py - hh / 2); }
            const t = Math.max(0, 1 - depth / bezel);
            const m = t * t;
            dx = -nx * m; dy = -ny * m;
          }
          const i = (y * w + x) * 4;
          d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return c.toDataURL();
    }
    function attach(elm, radius, bezel, scale) {
      if (!ok || !elm) return;
      if (!defs) {
        const svg = h('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute;pointer-events:none' });
        defs = h('defs'); svg.append(defs); document.body.append(svg);
      }
      const id = 'rf' + (++n);
      const image = h('feImage', { x: 0, y: 0, width: 10, height: 10, preserveAspectRatio: 'none', result: 'map' });
      const f = h('filter', { id, x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' },
        image,
        h('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: scale || 22, xChannelSelector: 'R', yChannelSelector: 'G' }));
      defs.append(f);
      let key = '', timer = 0;
      const apply = () => {
        const w = Math.round(elm.offsetWidth), hh = Math.round(elm.offsetHeight);
        if (!w || !hh || key === w + 'x' + hh) return;
        key = w + 'x' + hh;
        image.setAttribute('width', w); image.setAttribute('height', hh);
        image.setAttribute('href', mapURL(w, hh, radius, bezel || 18));
      };
      elm.style.setProperty('--rf', 'url(#' + id + ')');
      elm.classList.add('refract');
      new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 60); }).observe(elm);
      apply();
    }
    return { attach };
  })();

  /* ---------- 2: texture procedurali (una volta sola) ---------- */
  const Tex = (() => {
    let seed = 20261012;
    const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    function canvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; }
    /* acrilico satinato: grana finissima */
    function plateGrain() {
      const S2 = 192, c = canvas(S2, S2), g = c.getContext('2d');
      for (let i = 0; i < 2600; i++) {
        const x = rnd() * S2, y = rnd() * S2, s = 2 + rnd() * 3;
        const light = rnd() > 0.5;
        g.fillStyle = (light ? 'rgba(255,255,255,' : 'rgba(60,70,84,') + (0.015 + rnd() * 0.035).toFixed(3) + ')';
        g.fillRect(x, y, s, s);
      }
      return c.toDataURL();
    }
    /* disco di alluminio tornito: due strisce speculari opposte che si allargano dal centro (riflesso conico) */
    function brushed(radius, hlDeg) {
      const px = Math.round(radius * 4), c = canvas(px, px), g = c.getContext('2d'), r = px / 2;
      g.translate(r, r);
      g.save();
      g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.clip();
      g.fillStyle = '#0a0b0d'; g.fillRect(-r, -r, px, px);
      if (g.createConicGradient) {
        g.rotate(hlDeg * Math.PI / 180);
        const cg = g.createConicGradient(0, 0, 0);
        const W = 'rgba(255,255,255,', B = 'rgba(120,150,185,', D = 'rgba(30,38,50,';
        const stops = [
          [0.000, W + '1)'], [0.010, B + '.75)'], [0.045, D + '.55)'], [0.16, D + '.12)'], [0.30, D + '0)'], [0.42, D + '.10)'],
          [0.455, D + '.45)'], [0.490, B + '.6)'], [0.500, W + '.85)'], [0.510, B + '.6)'], [0.545, D + '.45)'], [0.58, D + '.10)'],
          [0.70, D + '0)'], [0.84, D + '.12)'], [0.955, D + '.55)'], [0.990, B + '.75)'], [1.000, W + '1)'],
        ];
        for (const [p, col] of stops) cg.addColorStop(p, col);
        g.fillStyle = cg; g.fillRect(-r, -r, px, px);
        g.rotate(-hlDeg * Math.PI / 180);
      }
      // solchi circolari della tornitura
      for (let i = 0; i < 220; i++) {
        g.strokeStyle = 'rgba(255,255,255,' + (0.015 + rnd() * 0.045).toFixed(3) + ')';
        g.lineWidth = 0.6 + rnd();
        g.beginPath(); g.arc(0, 0, rnd() * r, 0, 6.2832); g.stroke();
      }
      // leggera vignettatura verso il bordo
      const vg = g.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.40)');
      g.fillStyle = vg; g.fillRect(-r, -r, px, px);
      g.restore();
      return c.toDataURL();
    }
    return { plateGrain: plateGrain(), brushed };
  })();

  /* ---------- 2: disegno del pad ---------- */
  const stopsOf = (arr) => arr.map(([o, c, a]) => h('stop', { offset: o, style: 'stop-color:' + c + (a != null ? ';stop-opacity:' + a : '') }));
  function buildPad() {
    const svg = $('#pad');
    S.sel = null;
    svg.replaceChildren();
    const pat = (id, w, hh, href) => h('pattern', { id, patternUnits: 'userSpaceOnUse', width: w, height: hh },
      h('image', { href, x: 0, y: 0, width: w, height: hh, style: 'image-rendering:pixelated' }));
    svg.append(h('defs', {},
      h('linearGradient', { id: 'plate', x1: 0, y1: 0, x2: 0.55, y2: 1 }, stopsOf([[0, 'var(--plate-1)'], [1, 'var(--plate-2)']])),
      h('linearGradient', { id: 'plateEdge', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fff', 0.55], [0.5, '#fff', 0.08], [1, '#000', 0.35]])),
      h('linearGradient', { id: 'chrome', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fbfcfd'], [0.45, '#8f969f'], [0.7, '#e9edf1'], [1, '#6a7078']])),
      h('radialGradient', { id: 'skirt', cx: '30%', cy: '70%', r: '80%' }, stopsOf([[0, '#2a2c31'], [1, '#0e0f11']])),
      h('radialGradient', { id: 'bezel', cx: '45%', cy: '40%', r: '75%' }, stopsOf([[0, '#1e1f23'], [0.75, '#0a0a0c'], [1, '#020203']])),
      h('linearGradient', { id: 'bezelHl', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fff', 0], [0.55, '#fff', 0.05], [1, '#fff', 0.38]])),
      h('linearGradient', { id: 'faceCyl', x1: 0, y1: 0, x2: 1, y2: 0 }, stopsOf([[0, '#000', 0.45], [0.16, '#000', 0.12], [0.5, '#c4d2e6', 0.025], [0.84, '#000', 0.12], [1, '#000', 0.45]])),
      h('linearGradient', { id: 'faceTop', x1: 0, y1: 0, x2: 0, y2: 1 }, stopsOf([[0, '#c4d6ee', 0.045], [0.30, '#c4d6ee', 0.01], [0.72, '#000', 0.10], [1, '#000', 0.34]])),
      h('linearGradient', { id: 'faceBevel', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fff', 0.16], [0.45, '#fff', 0.02], [1, '#000', 0.55]])),
      h('linearGradient', { id: 'slope', x1: 0, y1: 0, x2: 0, y2: 1 }, stopsOf([[0, '#121419'], [0.38, '#090a0c'], [1, '#030304']])),
      h('clipPath', { id: 'plateClip' }, h('path', { d: OUTLINE })),
      /* Grana dei tasti: rumore frattale (feTurbulence) convertito in toni di grigio molto scuri, ritagliato sulla forma.
         È la tecnica del "grain" del vetro satinato, ma in nero: nessun puntino chiaro, solo variazione tonale morbida.
         La frequenza si adatta alla scala (fitGrain) per mantenere un granello di ~1,6 pixel. */
      h('filter', { id: 'keyGrain', x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' },
        h('feTurbulence', { id: 'keyTurb', type: 'fractalNoise', baseFrequency: 0.3, numOctaves: 2, seed: 11, result: 't' }),
        h('feColorMatrix', { in: 't', type: 'matrix', values: '0.26 0 0 0 -0.075  0.26 0 0 0 -0.075  0.26 0 0 0 -0.075  0 0 0 0 0.92', result: 'g' }),
        h('feComposite', { in: 'g', in2: 'SourceGraphic', operator: 'in' })),
      pat('grainPlate', 192, 192, Tex.plateGrain)));

    // ombra a terra, luce LED sotto il pad, strati inferiori (base nera, PCB, spaziatore acrilico)
    svg.append(h('path', { class: 'shadow', d: OUTLINE, transform: 'translate(16 58)' }));
    svg.append(h('path', { class: 'under', d: OUTLINE, transform: 'translate(0 26)' }));
    svg.append(h('path', { class: 'stack-base', d: OUTLINE, transform: 'translate(0 30)' }));
    svg.append(h('path', { class: 'stack-pcb', d: OUTLINE, transform: 'translate(0 20)' }));
    svg.append(h('path', { class: 'stack-clear', d: OUTLINE, transform: 'translate(0 11)' }));
    // piastra acrilica satinata
    svg.append(h('path', { class: 'frost', d: OUTLINE }));
    svg.append(h('path', { d: OUTLINE, fill: 'url(#grainPlate)' }));
    svg.append(h('path', { class: 'frost-edge', d: OUTLINE }));
    // luce LED lungo il bordo del pad (dentro la sagoma)
    svg.append(h('g', { 'clip-path': 'url(#plateClip)', 'aria-hidden': 'true' },
      h('path', { class: 'edge-glow', d: OUTLINE }), h('path', { class: 'edge-line', d: OUTLINE })));

    // componenti visibili in trasparenza sotto la piastra (posizioni dalla foto)
    const ghost = h('g', { 'aria-hidden': 'true' },
      h('path', { class: 'under-plate', d: 'M365 8h95l-8 22h-80z' }),
      h('path', { class: 'under-plate', d: 'M645 13h95l-8 22h-80z' }),
      h('rect', { class: 'under-plate', x: 897, y: 57, width: 48, height: 38, rx: 9 }),
      h('rect', { class: 'under-plate out', x: 897, y: 57, width: 48, height: 38, rx: 9 }),
      [[873, 43], [970, 43], [873, 95], [970, 95]].map(([x, y]) => h('circle', { class: 'under-plate', cx: x, cy: y, r: 7, opacity: 0.2 })),
      h('rect', { class: 'led-pill', x: 820, y: 358, width: 70, height: 118, rx: 26 }),
      [1, 2, 3].map((n, i) => h('circle', { class: 'led', 'data-led': n, cx: 855, cy: 400 + i * 25, r: 7.5 })),
      [1, 2, 3].map((n, i) => h('text', { class: 'led-n', x: 902, y: 405 + i * 25 }, 'L' + n)),
      h('circle', { class: 'under-plate', cx: 985, cy: 556, r: 9, opacity: 0.28 }),
      [0, 1, 2].map((i) => h('rect', { class: 'under-plate', x: 1244, y: 300 + i * 82, width: 24, height: 60, rx: 8, opacity: 0.14 })));
    svg.append(ghost);

    // viti a croce
    for (const [x, y] of SCREWS) {
      svg.append(h('g', { transform: `translate(${x} ${y})` },
        h('circle', { class: 'screw-bg', r: 17 }),
        h('path', { class: 'screw-x', d: 'M-8 -2.5L8 2.5M-2.5 -8L2.5 8' })));
    }

    ctrl.clear();
    S.layout.keys.forEach((id, slot) => {
      const cx = KEY_X[slot % 3], cy = KEY_Y[Math.floor(slot / 3)];
      const label = h('text', { class: 'k-label', y: -17 });
      const icon = h('g', { class: 'k-icon', transform: 'translate(0 -30) scale(3.6) translate(-12 -12)' });
      const g = h('g', { class: 'key', transform: `translate(${cx} ${cy})`, 'data-id': id, tabindex: 0, role: 'button' },
        h('rect', { class: 'k-led', x: -114, y: -116, width: 228, height: 240, rx: 38 }),
        h('rect', { class: 'k-shadow', x: -104, y: -98, width: 214, height: 232, rx: 22 }),
        h('path', { class: 'k-base', d: 'M-69 -101H69L95 -82V101H-95V-82Z' }),
        h('path', { d: 'M-69 -101H69L95 -82V101H-95V-82Z', fill: 'url(#slope)' }),
        h('path', { d: 'M-69 -101H69L95 -82V101H-95V-82Z', fill: '#000', filter: 'url(#keyGrain)', opacity: 0.85 }),
        h('path', { class: 'k-base-hl', d: 'M-69 -101H69L95 -82' }),
        h('path', { class: 'k-edge', d: 'M-95 -82V101M95 -82V101' }),
        h('g', { class: 'k-top' },
          h('rect', { class: 'k-face', x: -73, y: -108, width: 146, height: 163, rx: 13 }),
          h('rect', { x: -73, y: -108, width: 146, height: 163, rx: 13, fill: '#000', filter: 'url(#keyGrain)' }),
          h('rect', { x: -73, y: -108, width: 146, height: 163, rx: 13, fill: 'url(#faceTop)' }),
          h('rect', { x: -73, y: -108, width: 146, height: 163, rx: 13, fill: 'url(#faceCyl)' }),
          h('rect', { class: 'k-bevel', x: -71.5, y: -106.5, width: 143, height: 160, rx: 12 }),
          h('path', { class: 'k-lip-sh', d: 'M-66 58Q0 67 66 58' }),
          h('path', { class: 'k-lip', d: 'M-66 52Q0 61 66 52' }),
          h('rect', { class: 'k-glow', x: -73, y: -108, width: 146, height: 163, rx: 13 }),
          icon,
          label,
          h('text', { class: 'k-num', x: -61, y: -86 }, String(slot + 1))),
        h('rect', { class: 'k-sel', x: -114, y: -120, width: 228, height: 240, rx: 24 }));
      svg.append(g);
      ctrl.set(id, { id, kind: 'key', el: g, label, icon, slot });
    });

    S.layout.knobs.forEach((trio, k) => {
      const K = KNOBS[k];
      const arrow = h('text', { class: 'n-arrow', y: -((K.bezel || K.disc + 6) + 30) });
      const spin = [];
      const body = h('g', { class: 'n-body' });
      if (K.sk) {
        const ribs = h('g', { class: 'n-spin' });
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          ribs.append(h('line', { class: 'n-rib', x1: c * (K.sk.r - 24), y1: s * (K.sk.r - 24), x2: c * (K.sk.r - 5), y2: s * (K.sk.r - 5) }));
        }
        spin.push(ribs);
        body.append(h('g', { transform: `translate(${K.sk.dx} ${K.sk.dy})` }, h('circle', { class: 'n-skirt', r: K.sk.r }), ribs));
      } else {
        body.append(h('circle', { class: 'n-bezel', r: K.bezel }),
          h('circle', { class: 'n-bezel-hl', r: K.bezel - 4 }),
          h('circle', { class: 'n-step', r: K.disc + 8 }));
      }
      const m = K.mark, ma = m.a * Math.PI / 180;
      const mark = h('g', { class: 'n-spin' },
        h('line', { class: 'n-mark', style: `stroke-width:${m.w}`, x1: Math.cos(ma) * m.r0, y1: Math.sin(ma) * m.r0, x2: Math.cos(ma) * m.r1, y2: Math.sin(ma) * m.r1 }));
      spin.push(mark);
      const dim = K.disc;
      body.append(h('g', {},
        h('circle', { class: 'n-disc-bg', r: dim }),
        h('image', { href: Tex.brushed(dim, K.hl), x: -dim, y: -dim, width: dim * 2, height: dim * 2 }),
        K.ring ? h('circle', { class: 'n-ring', r: K.ring }) : h('circle', { class: 'n-ring', r: dim + 1, style: 'stroke-width:3' }),
        mark,
        h('circle', { class: 'n-hot', r: dim, fill: 'transparent' })));
      const g = h('g', { class: 'knob', transform: `translate(${K.x} ${K.y})`, 'data-knob': k, tabindex: 0, role: 'button' },
        h('ellipse', { class: 'n-shadow', cx: 16, cy: 26, rx: (K.bezel || K.sk.r) + 4, ry: (K.bezel || K.sk.r) - 4 }),
        body,
        h('circle', { class: 'n-sel', r: (K.bezel || K.sk.r) + 16 }), arrow);
      svg.append(g);
      knobEl[k] = g;
      [0, 1, 2].forEach((act) => ctrl.set(trio[act], { id: trio[act], kind: 'knob', knob: k, act, el: g, spin, arrow }));
    });
    attachInteraction();
    paintLabels();
    fitGrain();
    Bg.size();
  }

  function fitGrain() {
    const pad = $('#pad'), t = $('#keyTurb');
    if (!pad || !t) return;
    const hpx = pad.getBoundingClientRect().height;
    if (!hpx) return;
    const cssPerUnit = hpx / 1440;                              // pixel CSS per unità del viewBox
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // cicli per unità = (cicli per pixel dispositivo) × (pixel dispositivo per unità); periodo ≈ 1,7 pixel
    t.setAttribute('baseFrequency', (cssPerUnit * dpr / 1.7).toFixed(4));
  }

  /* ---------- etichette e layer ---------- */
  const shownLayer = () => (S.layerMode === 'auto' ? S.detected : S.layerMode);
  const iconNameFor = (id, L) => { const s = S.sigs.find((x) => x.layer === L && x.id === id); return s && s.icon ? s.icon : null; };
  const labelFor = (id, L) => { const s = S.sigs.find((x) => x.layer === L && x.id === id); return s ? s.label : ''; };
  const kindFor = (id, L) => { const s = S.sigs.find((x) => x.layer === L && x.id === id); return s ? (s.empty ? 'Senza azione' : KIND_NAME[s.kind]) : ''; };
  const slotName = (id) => 'Tasto ' + (S.layout.keys.indexOf(id) + 1);
  const NAME = (id) => {
    const c = ctrl.get(id);
    if (!c) return 'Controllo ' + id;
    if (c.kind === 'key') return slotName(id);
    return 'Manopola ' + (c.knob + 1) + ' · ' + ['↺', 'premi', '↻'][c.act];
  };
  function setLedColor(css) { document.documentElement.style.setProperty('--led', css); Bg.setLed(css); }
  let glowTimer = 0, lastGlowLayer = 0;
  function paintLabels() {
    const L = shownLayer();
    for (const c of ctrl.values()) {
      if (c.kind === 'key') {
        const t = labelFor(c.id, L), ic = iconNameFor(c.id, L);
        const cap = ic ? ((S.sigs.find((x) => x.layer === L && x.id === c.id) || {}).cap || '') : '';
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
    S.layout.knobs.forEach((trio, k) => {
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
    document.querySelectorAll('#layers button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === String(S.layerMode))));
    $('#layers [data-l="auto"]').textContent = S.layerMode === 'auto' ? 'Auto · ' + S.detected : 'Auto';
    chips();
    renderInspector();
  }
  function setDetected(n) {
    if (S.detected === n) return;
    S.detected = n;
    paintLabels();
  }

  /* Azioni identiche su controlli dello stesso ruolo (due "pressioni" o due "rotazioni"): il pad invia esattamente lo
     stesso messaggio, quindi nessun software può dire quale sia stato usato. Si avvisa invece di indovinare. */
  const isTurn = (c) => c && c.kind === 'knob' && c.act !== 1;
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
  const isUniqueEvent = (x) => !S.sigs.some((o) => o !== x && !(o.layer === x.layer && o.id === x.id) && eventClash(x, o));
  function dupGroups(L) {
    const groups = new Map();
    for (const s of S.sigs) {
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
  const MIN_SHOW = 110;
  const live = {};        // canale → { ids:Set, since }   (un canale = una sorgente: tastiera, media, rotella…)
  /* Le classi "premuto" si DERIVANO dai canali attivi a ogni cambio: nessun controllo può restare bloccato.
     Le rotazioni non "premono" mai la manopola: la fanno solo girare (vedi rotate). */
  function render() {
    const down = new Set();
    for (const st of Object.values(live)) for (const id of st.ids) { const c = ctrl.get(id); if (c && !isTurn(c)) down.add(c.el); }
    for (const c of ctrl.values()) c.el.classList.toggle('down', down.has(c.el));
  }
  function clearChannel(ch) {
    if (!live[ch]) return;
    delete live[ch];
    render();
  }
  /* tick = true: ogni chiamata è un NUOVO scatto (impulso), anche se il controllo era già nel canale */
  function press(ch, hits, tick) {
    const prev = live[ch] ? live[ch].ids : new Set();
    // un controllo già rilasciato che resta acceso solo per il tempo minimo di visibilità si spegne subito se ne arriva
    // un altro: con tocchi alternati veloci non si vedono due controlli accesi insieme (i tenuti restano, per gli accordi)
    for (const k of Object.keys(live)) if (k !== ch && live[k].released) delete live[k];
    live[ch] = { ids: new Set(hits.map((x) => x.id)), since: performance.now() };
    render();
    for (const x of hits) {
      const c = ctrl.get(x.id);
      if (!c) continue;
      if (isTurn(c)) { if (tick || !prev.has(x.id)) rotate(c.knob, c.act === 0 ? -1 : 1); }
      else if (!prev.has(x.id)) ripple(c, 1);
    }
  }
  function release(ch, force, minWait) {
    const st = live[ch];
    if (!st) return;
    st.released = true;
    const wait = force ? 0 : Math.max(minWait || 0, MIN_SHOW - (performance.now() - st.since));
    setTimeout(() => { if (live[ch] === st) clearChannel(ch); }, wait);
  }
  const turnTimer = [null, null, null];
  function rotate(k, dir) {
    knobAngle[k] += dir * 18;
    S.rotCount[k]++;                                  // contatore per le verifiche (nessun effetto sull'interfaccia)
    const any = [...ctrl.values()].find((c) => c.kind === 'knob' && c.knob === k);
    if (!any) return;
    for (const s of any.spin) s.style.transform = `rotate(${knobAngle[k]}deg)`;
    any.el.classList.add('turn');
    any.arrow.textContent = dir < 0 ? '↺' : '↻';
    any.arrow.classList.remove('go'); void any.arrow.getBoundingClientRect(); any.arrow.classList.add('go');
    clearTimeout(turnTimer[k]);
    turnTimer[k] = setTimeout(() => any.el.classList.remove('turn'), 150);
    ripple(any, 0.55);
  }

  /* ---------- riconoscimento degli eventi ---------- */
  /* Il layer FISICO del pad non viene comunicato: si deduce. Un evento che appartiene a un solo layer (ogni controllo
     firmato, o un'azione presente in un solo layer) lo stabilisce. Un evento ambiguo tra più layer si risolve con il
     layer fisico già noto — NON con quello visualizzato — e solo in mancanza si usa il layer scelto dall'utente. */
  function learnLayer(n) {
    S.padLayer = n; S.padKnown = true;
    if (S.layerMode === 'auto') setDetected(n);
  }
  function pick(cands) {
    if (!cands.length) return { hits: [], layer: shownLayer() };
    const layers = [...new Set(cands.map((c) => c.layer))];
    let use = cands, layer;
    if (layers.length === 1) { layer = layers[0]; learnLayer(layer); }
    else if (S.padKnown && layers.includes(S.padLayer)) layer = S.padLayer;
    else if (S.layerMode !== 'auto' && layers.includes(S.layerMode)) layer = S.layerMode;       // suggerimento dell'utente
    else if (layers.includes(S.detected)) layer = S.detected;
    else layer = layers[0];
    use = cands.filter((c) => c.layer === layer);
    const ids = [...new Set(use.map((c) => c.id))];
    return { hits: ids.map((id) => ({ id, maybe: ids.length > 1 })), layer, sig: use[0] };
  }

  /* Tastiera: più sequenze in parallelo (due controlli premuti insieme non si confondono).
     Ogni sequenza è un possibile "macro" in corso: tasti ricevuti finora + tasti ancora giù. */
  let streams = [], streamSeq = 0;
  const matchSeq = (seq) => S.sigs.filter((s) => s.kind === 'keys' && seq.length <= s.steps.length &&
    seq.every((b, i) => s.steps[i].vk === b.vk && s.steps[i].mods === b.mods));
  const seqName = (seq) => seq.map((b) => (modLabel(b.mods) ? modLabel(b.mods) + '+' : '') + vkName(b.vk)).join(' ');
  /* Disambiguazione per durata: una ROTAZIONE della manopola ha pressione e rilascio nello stesso istante, un tasto o
     la pressione della manopola restano giù almeno ~60 ms (osservato: 78–170 ms). Il ponte usa un orologio ad alta
     risoluzione (QueryPerformanceCounter); con quello vecchio, a passi di 15,6 ms, 20 ms copre comunque un passo.
     Si applica solo quando la stessa azione è su controlli di ruolo diverso (es. Volume − su tasto 4 e su manopola ↺). */
  const TURN_MAX_MS = 20, PENDING_MS = 30;
  /* Timer di attesa con tolleranza: se il thread era occupato e il timer scatta in ritardo, i messaggi del ponte già
     arrivati potrebbero non essere ancora stati elaborati → si concede una seconda attesa breve. */
  function pendingTimer(fn) {
    const hd = { id: 0 };
    const due = performance.now() + PENDING_MS;
    const arm = (grace) => {
      hd.id = setTimeout(() => {
        if (!grace && performance.now() - due > 10) { arm(true); return; }
        fn();
      }, grace ? 20 : PENDING_MS);
    };
    arm(false);
    return hd;
  }
  const roleOf = (id) => isTurn(ctrl.get(id)) ? 'turn' : 'hold';
  const needsTiming = (hits) => new Set(hits.map((x) => roleOf(x.id))).size > 1;
  function byRole(hits, role) {
    const f = hits.filter((x) => roleOf(x.id) === role);
    const use = f.length ? f : hits;
    return use.map((x) => ({ id: x.id, maybe: use.length > 1 }));
  }

  function resolveStream(st, role) {
    const pend = st.pending;
    if (!pend) return;
    st.pending = null;
    if (st.ptimer) clearTimeout(st.ptimer.id);
    const hits = byRole(pend.p.hits, role);
    press('kbd' + st.id, hits);
    note(Object.assign({}, pend.p, { hits }), null);
    st.matched = true; st.noted = true;
  }
  function updateStream(st, announce) {
    if (S.signed && st.seq.length < 2 && st.seq.every((b) => isSigVk(b.vk))) return;     // firma a metà: manca il secondo tasto
    const p = pick(matchSeq(st.seq));
    if (!p.hits.length) return;
    if (st.seq.length === 1 && needsTiming(p.hits)) {          // aspetta di sapere se è un impulso o una pressione
      st.pending = { p };
      if (st.ptimer) clearTimeout(st.ptimer.id);
      st.ptimer = pendingTimer(() => resolveStream(st, 'hold'));
      return;
    }
    press('kbd' + st.id, p.hits);
    // con la firma il primo tasto è solo un prefisso: l'azione si annuncia appena il controllo è identificato
    if (announce || !st.noted) { note(p, null); st.noted = true; }
    st.matched = true;
  }
  function endStream(st) {                 // idempotente
    if (st.ended) return;
    st.ended = true;
    clearTimeout(st.timer);
    if (st.pending) resolveStream(st, 'hold');
    if (!st.matched) note(null, 'Tasto ' + seqName(st.seq));
    release('kbd' + st.id);
    streams = streams.filter((x) => x !== st);
  }
  function keyEvent(vk, down, t) {
    const m = modBit(vk);
    if (m) { S.modState = down ? (S.modState | m) : (S.modState & ~m); return; }
    if (down) {
      /* La fine di una sequenza si decide dai TIMESTAMP degli eventi (orologio del ponte), non dai timer della pagina:
         se il thread è occupato (animazioni, sfondo) un timer può scattare prima che i messaggi in coda siano stati
         letti e spezzare una firma a metà. I timer restano solo come pulizia tardiva. */
      for (const st of streams.slice()) if (!st.held.size && st.lastT != null && t - st.lastT > st.gap) endStream(st);
      for (const st of streams) if (st.held.has(vk)) return;                       // autoripetizione
      const ev = { vk, mods: S.modState };
      for (const st of streams) {                                                   // 1) prosegue una sequenza esistente
        if (matchSeq(st.seq.concat([ev])).length) {
          clearTimeout(st.timer);
          st.seq.push(ev); st.held.add(vk);
          updateStream(st, false);
          return;
        }
      }
      const st = { id: ++streamSeq, seq: [ev], held: new Set([vk]), timer: null, ptimer: null, matched: false, pending: null, t0: t };   // 2) nuova
      streams.push(st);
      updateStream(st, true);
    } else {
      for (const st of streams) {
        if (!st.held.has(vk)) continue;
        st.held.delete(vk);
        if (st.pending) resolveStream(st, (t - st.t0) <= TURN_MAX_MS ? 'turn' : 'hold');
        if (!st.held.size) {
          // sequenza completa (nessun passo atteso) → nessuna attesa; altrimenti la pausa programmata allunga l'attesa
          const cands = matchSeq(st.seq);
          const complete = cands.length > 0 && cands.every((s) => s.steps.length === st.seq.length);
          const gap = complete ? 0 : 90 + Math.max(0, ...cands.map((s) => s.delay));
          st.lastT = t; st.gap = gap;
          release('kbd' + st.id, false, gap);                                        // spegnimento visivo (annullato se la sequenza prosegue)
          clearTimeout(st.timer);
          st.timer = setTimeout(() => endStream(st), gap + 400);                     // pulizia tardiva
        }
      }
    }
  }
  let mediaPend = null;
  function resolveMedia(role) {
    const m = mediaPend;
    if (!m) return;
    mediaPend = null;
    clearTimeout(m.timer.id);
    const hits = byRole(m.p.hits, role);
    press('media', hits, true);
    note(Object.assign({}, m.p, { hits }), null);
  }
  function mediaEvent(usage, down, t) {
    if (down) {
      if (mediaPend) resolveMedia('hold');                     // il rilascio precedente non è mai arrivato
      const p = pick(S.sigs.filter((s) => s.kind === 'media' && s.usage === usage));
      if (!p.hits.length) { clearChannel('media'); note(null, MEDIA_NAME[usage] || 'Media 0x' + usage.toString(16)); return; }
      if (needsTiming(p.hits)) {
        mediaPend = { p, t0: t, timer: pendingTimer(() => resolveMedia('hold')) };
        return;
      }
      press('media', p.hits, true); note(p, null);
    } else {
      if (mediaPend) resolveMedia((t - mediaPend.t0) <= TURN_MAX_MS ? 'turn' : 'hold');
      release('media');
    }
  }
  /* La rotella del mouse è un impulso, senza "rilascio": un tasto tenuto la ripete. Il primo impulso mostra
     il tasto premuto per un attimo; se ne arriva un altro entro 700 ms si considera "tenuto" e resta premuto finché
     gli impulsi continuano (finestra = 1,8 × l'intervallo osservato, almeno 250 ms). */
  const wheel = { key: '', last: 0, timer: 0 };
  function wheelEvent(dir) {
    const p = pick(S.sigs.filter((s) => s.kind === 'wheel' && s.dir === dir && s.mods === (S.modState & 7)));
    if (!p.hits.length) { note(null, 'Rotella ' + (dir > 0 ? '↑' : '↓') + (S.modState & 7 ? ' con ' + modLabel(S.modState & 7) : '')); return; }
    const key = p.hits.map((x) => x.id).join(',');
    const now = performance.now();
    const gap = now - wheel.last;
    const held = wheel.timer && wheel.key === key;          // la finestra precedente non è ancora scaduta
    clearTimeout(wheel.timer);
    wheel.key = key; wheel.last = now;
    press('wheel', p.hits, true);
    if (!held) note(p, null); else showTags(p);
    const win = held ? Math.min(900, Math.max(250, gap * 1.8)) : 250;
    wheel.timer = setTimeout(() => { wheel.timer = 0; clearChannel('wheel'); }, win);
  }
  function buttonEvent(b, down) {
    if (!down) { release('btn'); return; }
    const p = pick(S.sigs.filter((s) => s.kind === 'button' && s.button === b));
    if (p.hits.length) { press('btn', p.hits); note(p, null); } else note(null, 'Pulsante ' + b);
  }

  /* Registro degli eventi grezzi con intervalli: serve a tarare le soglie sul pad reale. */
  const rawLog = [], downAt = {};
  let rawPrev = null;
  function trace(ev, t) {
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
  function onEvent(ev) {
    if (!ev) return;
    const t = typeof ev.t === 'number' ? ev.t : performance.now();
    trace(ev, t);
    if (ev.type === 'key') keyEvent(ev.vk, !!ev.down, t);
    else if (ev.type === 'media') mediaEvent(ev.usage, !!ev.down, t);
    else if (ev.type === 'wheel') wheelEvent(ev.delta > 0 ? 1 : -1);
    else if (ev.type === 'button') buttonEvent(ev.button, !!ev.down);
    else if (ev.type === 'status') { S.link = { usb: !!ev.usb, ble: !!ev.ble }; S.linkCap = true; paintLink(); }
  }

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
  function showTags(p) {
    if (!p || !p.hits.length) return;
    const label = p.sig && p.sig.label;
    for (const x of p.hits.slice(0, 2)) showTag(x.id, label || labelFor(x.id, p.layer) || (p.sig && p.sig.empty ? 'Nessuna azione' : ''));
  }
  /* ultime azioni come chip a pillola: la più recente è in evidenza; ripetizioni ravvicinate si fondono (×n) */
  const recents = [];
  function renderRecents() {
    const box = $('#last');
    box.classList.toggle('idle', recents.length === 0);
    if (!recents.length) {
      box.replaceChildren(el('div', { class: 'rchip glass now' }, el('b', {}, 'In attesa'),
        el('span', {}, S.bridge ? 'Premi un tasto del macropad' : 'Ponte non attivo · solo eventi di questa pagina')));
      return;
    }
    box.replaceChildren(...recents.map((r, i) => el('div', { class: 'rchip glass' + (i === 0 ? ' now' : '') },
      el('b', {}, r.title), r.sub ? el('span', {}, r.sub) : null, r.n > 1 ? el('span', { class: 'n' }, '×' + r.n) : null)));
  }
  function note(p, raw) {
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

  /* ---------- configuratore nella vista live ----------
     Si modifica l'azione del controllo selezionato nel layer mostrato; il profilo è salvato nel browser (localStorage)
     e le modifiche si inviano al pad via WebHID (USB) solo dopo conferma esplicita.
     Il modulo di protocollo (MP) è in protocol.js: funzioni pure, le stesse usate dai test e da tools/profile-frames.js. */
  const E = { act: 1, rec: null, prevMode: null, mods: 0 };      // act: azione scelta di una manopola (0 ↺, 1 premi, 2 ↻); rec: { mods } se si registra; mods: modificatori del selettore manuale
  const SENT_KEY = 'macropad-studio.sent.v1';       // istantanea dei pacchetti noti al pad: confronto per sapere cosa va inviato
  const SEND = { pending: [], busy: false, dev: null, msg: '', err: false, done: false, progress: null };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function ensureStore() {
    if (S.store) return S.store;
    S.store = { profile: { name: 'Profilo', signature: true, layers: [1, 2, 3].map(() => ({ controls: {}, led: { color: 4, mode: 1 } })) }, layout: S.layout };
    return S.store;
  }
  const layerControls = (L) => { const lay = ensureStore().profile.layers[L - 1]; return lay.controls || (lay.controls = {}); };
  function encOpts() {
    const p = S.store.profile;
    const signature = !!p.signature;
    const plan = signature ? MP.signPlan(p, S.layout) : null;
    return { mouseAlt: !!S.layout.mouseAlt, signature, volumeAsKey: !!p.volumeAsKey, signEmpty: signature && p.signEmpty !== false, plan,
      hosted: plan && p.hostActions !== false ? plan.hosted : null };
  }
  const allIds = () => [...S.layout.keys, ...S.layout.knobs.flat()];
  /* pacchetti di un controllo (senza "azzera"), in esadecimale; 'ERR' se non codificabile (es. macro troppo lunga) */
  function controlHex(o, L, id) {
    try {
      const a = S.store.profile.layers[L - 1].controls[id] || null;
      return MP.encodeActionFrames(id, L, a, o).map((b) => MP.hex(b)).join('|');
    } catch (_) { return 'ERR'; }
  }
  function frameHexMap() {
    const o = encOpts(), out = {};
    for (let L = 1; L <= 3; L++) for (const id of allIds()) out[L + ':' + id] = controlHex(o, L, id);
    for (let L = 1; L <= 3; L++) {
      const led = S.store.profile.layers[L - 1].led;
      out['led:' + L] = led && typeof led.color === 'number' ? MP.hex(MP.led(L, led.color, led.mode | 0)) : '';
    }
    return out;
  }
  const readSent = () => { try { return JSON.parse(localStorage.getItem(SENT_KEY) || 'null'); } catch (_) { return null; } };
  const writeSent = (m) => { try { localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch (_) { /* storage non disponibile */ } };
  /* controlli il cui codice è cambiato dall'ultimo invio. Al primo uso si assume che il pad coincida col profilo. */
  function updatePending(init) {
    if (!MP || !S.store) { SEND.pending = []; paintSendChip(); return; }
    const cur = frameHexMap();
    let snap = readSent();
    if (!snap) { if (!init) snap = {}; else { writeSent(cur); snap = cur; } }
    // chiavi nuove rispetto all'istantanea (es. i LED, aggiunti dopo): si assume che il pad le abbia già
    let grew = false;
    for (const k of Object.keys(cur)) if (snap[k] === undefined && Object.keys(snap).length) { snap[k] = cur[k]; grew = true; }
    if (grew) writeSent(snap);
    SEND.pending = Object.keys(cur).filter((k) => cur[k] !== (snap[k] || ''));
    paintSendChip();
    renderSheets();
  }
  function paintSendChip() {
    const c = $('#chipSend');
    if (!c) return;
    const n = SEND.pending.length;
    c.className = 'chip clickable ' + (n ? 'warn' : 'ok');
    c.lastElementChild.textContent = n ? 'Da inviare al pad · ' + n : 'Pad aggiornato';
    c.title = n ? 'Ci sono controlli modificati non ancora scritti sul macropad. Clicca per inviarli.' : 'Il profilo coincide con quanto inviato al pad.';
    c.hidden = !MP;
  }
  function commit() {
    try { localStorage.setItem(STORE, JSON.stringify({ profile: S.store.profile, layout: S.store.layout || S.layout })); } catch (_) { /* storage non disponibile */ }
    load(); paintLabels(); pushHostmap(false); updatePending();
  }

  /* — editor nella scheda — */
  const MOUSE_CHOICES = [['Clic sx', { buttons: 1, wheel: 0 }], ['Clic centr.', { buttons: 4, wheel: 0 }], ['Clic dx', { buttons: 2, wheel: 0 }],
    ['Rotella ↑', { buttons: 0, wheel: 1 }], ['Rotella ↓', { buttons: 0, wheel: -1 }]];
  const MODS = [[1, 'Ctrl'], [2, 'Maiusc'], [4, 'Alt']];
  const btn = (text, cls, fn, attrs) => { const b = el('button', Object.assign({ type: 'button', class: cls }, attrs || {}), text); b.addEventListener('click', fn); return b; };
  const segBtns = (items, isOn, pick, label) => {
    const g = el('div', { class: 'eseg' + (items.length <= 3 ? ' g' + items.length : ''), role: 'group', 'aria-label': label || '' });
    items.forEach(([k, text]) => g.append(btn(text, '', () => pick(k), { 'aria-pressed': String(isOn(k)) })));
    return g;
  };
  const curTarget = () => (S.sel.kind === 'key' ? S.sel.id : S.layout.knobs[S.sel.k][E.act]);
  function setType(L, id, type) {
    stopRec(true);
    const c = layerControls(L);
    if (type === 'none') delete c[id];
    else if (type === 'keys') c[id] = { t: 'keys', steps: [], delay: 0 };
    else if (type === 'media') c[id] = { t: 'media', usage: 0xCD };
    else if (type === 'mouse') c[id] = { t: 'mouse', buttons: 1, wheel: 0, mod: 0 };
    else if (type === 'clear') c[id] = { t: 'clear' };
    commit();
  }
  /* in modifica la vista resta sul layer che si sta modificando (niente salti se il pad cambia layer); all'uscita si
     ripristina la modalità precedente (Auto = segue il layer fisico) */
  function enterEdit() {
    ensureStore();
    E.prevMode = S.layerMode; S.layerMode = shownLayer();
    S.edit = true; E.act = 1;
    paintLabels();
  }
  function leaveEdit() {
    stopRec(true);
    S.edit = false;
    if (E.prevMode != null) {
      S.layerMode = E.prevMode; E.prevMode = null;
      if (S.layerMode === 'auto' && S.padKnown) S.detected = S.padLayer;
    }
    paintLabels();
  }
  function stopRec(silent) { if (E.rec) { E.rec = null; if (!silent) renderInspector(); } }
  function recKey(e, down) {
    const bit = MP.CODE_TO_MOD[e.code];
    if (bit) { E.rec.mods = down ? (E.rec.mods | bit) : (E.rec.mods & ~bit); return; }
    if (!down || e.repeat) return;
    const u = MP.CODE_TO_USAGE[e.code];
    if (!u || !S.sel) return;
    const a = layerControls(shownLayer())[curTarget()];
    if (!a || a.t !== 'keys' || a.steps.length >= MP.LIMITS.steps) return;
    a.steps.push({ mod: E.rec.mods, key: u });
    commit();
  }
  window.addEventListener('keydown', (e) => { if (E.rec) { e.preventDefault(); e.stopPropagation(); recKey(e, true); } }, true);
  window.addEventListener('keyup', (e) => { if (E.rec) { e.preventDefault(); e.stopPropagation(); recKey(e, false); } }, true);

  function keysEditor(a, L, id) {
    const steps = el('div', { class: 'steps' });
    if (!a.steps.length) steps.append(el('span', { class: 'hintx' }, E.rec ? 'Premi i tasti (anche sul pad)…' : 'Nessun tasto'));
    a.steps.forEach((s, i) => steps.append(el('span', { class: 'step' }, MP.stepLabel(s),
      btn('✕', '', () => { a.steps.splice(i, 1); commit(); }, { 'aria-label': 'Rimuovi' }))));
    const o = encOpts();
    const signed = !!(o.plan && o.plan.keys.has(L + ':' + id));
    const cap = MP.LIMITS.steps - (signed ? MP.SIG.STEPS : 0);
    const text = el('input', { class: 'inp', type: 'text', placeholder: 'Scrivi un testo (lettere, cifre, spazio)', 'aria-label': 'Testo da aggiungere' });
    const addText = () => {
      try { const add = MP.textToSteps(text.value); if (a.steps.length + add.length > MP.LIMITS.steps) throw new RangeError('Troppi tasti (massimo ' + MP.LIMITS.steps + ')'); a.steps.push(...add); commit(); }
      catch (err) { text.setCustomValidity(err.message); text.reportValidity(); setTimeout(() => text.setCustomValidity(''), 1800); }
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } });
    // selettore manuale: modificatori + tasto dall'elenco (utile per i tasti che non si riescono a registrare)
    const modRow = el('div', { class: 'eseg g4', role: 'group', 'aria-label': 'Modificatori' });
    [[1, 'Ctrl'], [2, 'Maiusc'], [4, 'Alt'], [8, 'Win']].forEach(([bit, name]) =>
      modRow.append(btn(name, '', () => { E.mods ^= bit; renderInspector(); }, { 'aria-pressed': String(!!(E.mods & bit)) })));
    const keyItems = Object.keys(MP.KEY_LABELS).map(Number).sort((x, y) => x - y).map((u) => [u, MP.KEY_LABELS[u]]);
    const picker = dropdown(keyItems, null, (u) => {
      if (a.steps.length >= MP.LIMITS.steps) return;
      a.steps.push({ mod: E.mods, key: u }); E.mods = 0; commit();
    }, 'Tasto da aggiungere', E.mods ? 'Tasto con ' + MP.modLabel(E.mods) + '…' : 'Scegli un tasto…');
    const delay = el('input', { class: 'inp num', type: 'number', min: '0', max: String(MP.LIMITS.delayMs), step: '10', value: String(a.delay || 0), 'aria-label': 'Pausa in millisecondi' });
    delay.addEventListener('change', () => { a.delay = Math.max(0, Math.min(MP.LIMITS.delayMs, Math.round(Number(delay.value) || 0))); commit(); });
    const out = [
      steps,
      el('div', { class: 'row2' },
        btn(E.rec ? '■ Ferma' : '● Registra', 'sbtn' + (E.rec ? ' rec' : ''), () => { E.rec = E.rec ? null : { mods: 0 }; renderInspector(); }),
        btn('Svuota', 'sbtn', () => { a.steps.length = 0; commit(); })),
      el('span', { class: 'sub' }, 'Aggiungi un tasto'), modRow, el('div', { class: 'gap8' }, picker),
      el('span', { class: 'sub' }, 'Oppure scrivi un testo'), el('div', { class: 'row2 tight' }, text, btn('Aggiungi', 'sbtn', addText)),
      el('div', { class: 'row2 pause' }, el('span', { class: 'hintx' }, 'Pausa dopo i tasti (ms)'), delay),
    ];
    if (a.steps.length > cap) out.push(el('p', { class: 'hintx warnx' }, 'Troppi tasti' + (signed ? ' con la firma (massimo ' + cap + ')' : '') + ': il pacchetto non può essere inviato.'));
    if (S.store.profile.signature && a.steps.some((s) => s.key >= MP.SIG.BASE && s.key < MP.SIG.BASE + MP.SIG.RADIX))
      out.push(el('p', { class: 'hintx warnx' }, 'Usa già F13–F21: può confondersi con la firma.'));
    return out;
  }
  /* elenco a discesa nello stile dell'interfaccia. La lista è flottante (fuori dalla scheda): aprendola la scheda non
     cambia altezza; si chiude con un clic fuori, Esc, scorrimento o ridimensionamento. */
  const ddOpen = new Set();
  function closeDropdowns() { for (const c of [...ddOpen]) c(); }
  window.addEventListener('pointerdown', (e) => { if (ddOpen.size && !e.target.closest('.dd-list, .dd-head')) closeDropdowns(); }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ddOpen.size) { e.stopPropagation(); closeDropdowns(); } }, true);
  window.addEventListener('resize', closeDropdowns);
  function dropdown(items, cur, pick, label, placeholder) {
    const wrap = el('div', { class: 'dd' });
    const now = items.find((i) => i[0] === cur);
    const list = el('div', { class: 'dd-list', role: 'listbox' });
    let close = () => {};
    const head = btn(now ? now[1] : (placeholder || items[0][1]), 'dd-head', () => {
      if (ddOpen.has(close)) { close(); return; }
      closeDropdowns();
      const r = head.getBoundingClientRect();
      list.style.width = Math.round(r.width) + 'px'; list.style.left = Math.round(r.left) + 'px';
      const below = innerHeight - r.bottom - 14, above = r.top - 14;
      const up = below < 190 && above > below;
      list.style.maxHeight = Math.max(130, Math.min(300, up ? above : below)) + 'px';
      if (up) { list.style.top = 'auto'; list.style.bottom = Math.round(innerHeight - r.top + 6) + 'px'; }
      else { list.style.bottom = 'auto'; list.style.top = Math.round(r.bottom + 6) + 'px'; }
      document.body.append(list);
      wrap.classList.add('open'); head.setAttribute('aria-expanded', 'true');
      ddOpen.add(close);
      const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }, { 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label || '' });
    close = () => { ddOpen.delete(close); list.remove(); wrap.classList.remove('open'); head.setAttribute('aria-expanded', 'false'); };
    items.forEach(([k, text]) => list.append(btn(text, 'dd-item' + (k === cur ? ' on' : ''), () => { close(); pick(k); },
      { role: 'option', 'aria-selected': String(k === cur) })));
    wrap.append(head);
    return wrap;
  }
  function mediaEditor(a) {
    return [dropdown(Object.entries(MP.MEDIA).map(([u, name]) => [Number(u), name]), a.usage, (u) => { a.usage = u; commit(); }, 'Funzione multimediale')];
  }
  function mouseEditor(a) {
    const click = a.wheel ? null : a.buttons & 4 ? 4 : a.buttons & 2 ? 2 : 1;
    const wheel = a.wheel ? Math.sign(a.wheel) : 0;
    const g = (cls, items, isOn, pick, label) => {
      const seg = el('div', { class: 'eseg ' + cls, role: 'group', 'aria-label': label });
      items.forEach(([k, text]) => seg.append(btn(text, '', () => pick(k), { 'aria-pressed': String(isOn(k)) })));
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
  const TYPE_ICONS = {
    keys: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7 14h10"/></svg>',
    media: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.8l5 3.2-5 3.2z"/></svg>',
    mouse: '<svg viewBox="0 0 24 24"><rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 3v6.5"/></svg>',
    none: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/></svg>',
  };
  function typeTiles(cur, pick) {
    const wrap = el('div', { class: 'types', role: 'group', 'aria-label': 'Tipo di azione' });
    [['keys', 'Tastiera'], ['media', 'Media'], ['mouse', 'Mouse'], ['none', 'Nessuna']].forEach(([k, name]) => {
      const b = btn('', 'type', () => pick(k), { 'aria-pressed': String(cur === k) });
      const ic = el('span', {}); ic.innerHTML = TYPE_ICONS[k];
      b.append(ic, el('span', {}, name));
      wrap.append(b);
    });
    return wrap;
  }
  function signEditor(a, L, id) {
    const p = S.store.profile;
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
  function holdEditor(a, L, id) {
    if (!a || (a.t !== 'keys' && a.t !== 'media' && !(a.t === 'mouse' && a.wheel))) return null;
    const single = a.t === 'keys' && a.steps.length === 1 && !a.delay;
    if (a.t === 'keys' && !single) {
      if (!a.steps.length) return null;
      return section('Tenuto premuto', el('p', { class: 'hintx' }, 'Le macro con più tasti, o con una pausa, partono una volta sola per pressione.'));
    }
    const mode = a.hold === 'repeat' || a.hold === 'once' ? a.hold : 'auto';
    const set = (k) => { if (k === 'auto') delete a.hold; else a.hold = k; commit(); };
    const rp = MP.repeatOf(S.store.profile);
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
        : S.hosted.has(L + ':' + id) ? 'Una volta per pressione, eseguito dal ponte.' : 'Il pad invia una volta sola; un’eventuale ripetizione la gestisce Windows.';
    }
    return section('Tenuto premuto',
      segBtns([['auto', 'Automatico'], ['repeat', 'Ripeti'], ['once', 'Una volta']], (k) => mode === k, set, 'Tenuto premuto'),
      el('p', { class: 'hintx' }, hint));
  }
  function hostNote(a, L, id) {
    if (!a || !S.hosted.has(L + ':' + id)) return null;
    return el('p', { class: 'note' }, el('b', {}, 'Eseguita dal PC'),
      'Questa azione compare su più controlli: il pad invia solo un codice identificativo e la esegue il ponte. Funziona con il ponte attivo, anche in Bluetooth.');
  }
  function renderEditor() {
    const L = shownLayer();
    const isKnob = S.sel.kind === 'knob';
    const id = curTarget();
    const a = (S.store && S.store.profile.layers[L - 1].controls || {})[id] || null;
    const close = btn('✕', 'x', () => select(S.sel), { 'aria-label': 'Chiudi' });
    const title = isKnob ? 'Manopola ' + (S.sel.k + 1) : 'Tasto ' + (S.layout.keys.indexOf(S.sel.id) + 1);
    const head = el('header', {}, el('div', {}, el('span', { class: 'micro' }, 'Modifica'), el('h2', {}, title),
      el('div', { class: 'badges' }, el('span', { class: 'badge acc' }, 'Layer ' + L), el('span', { class: 'badge' }, 'ID ' + id))), close);
    const kids = [];
    if (isKnob) kids.push(section('Quale azione', segBtns([[0, '↺ Sinistra'], [1, 'Premi'], [2, '↻ Destra']], (k) => E.act === k, (k) => { stopRec(true); E.act = k; renderInspector(); }, 'Azione della manopola')));
    const cur = a ? a.t : 'none';
    const off = cur === 'clear';
    const typeSec = [typeTiles(cur, (k) => setType(L, id, k))];
    if (off) typeSec.push(el('p', { class: 'hintx' }, 'Disattivato: il controllo non invia nulla, nemmeno il codice identificativo (non rivela il layer).'),
      el('div', { class: 'row2' }, btn('Riattiva', 'sbtn', () => setType(L, id, 'none'))));
    else typeSec.push(el('div', { class: 'row2' }, btn('Disattiva del tutto', 'linkbtn', () => setType(L, id, 'clear'),
      { title: 'Invia un pacchetto vuoto: il controllo non fa più nulla.' })));
    kids.push(section('Cosa fa', ...typeSec));
    if (a && a.t === 'keys') kids.push(section('Tasti', ...keysEditor(a, L, id)));
    else if (a && a.t === 'media') kids.push(section('Funzione', ...mediaEditor(a)));
    else if (a && a.t === 'mouse') kids.push(section('Mouse', ...mouseEditor(a)));
    else if (!off) kids.push(el('p', { class: 'hintx' }, 'Nessuna azione: premere il controllo non farà nulla' + (S.store.profile.signature && S.store.profile.signEmpty !== false ? ' (invia solo un codice riservato, così la vista live sa il layer).' : '.')));
    const hd = holdEditor(a, L, id); if (hd) kids.push(hd);
    const sg = signEditor(a, L, id); if (sg) kids.push(sg);
    const hn = hostNote(a, L, id); if (hn) kids.push(hn);
    // dettagli tecnici: i pacchetti che verrebbero inviati per questo controllo
    try {
      const fr = framesFor(L, id);
      kids.push(el('details', { class: 'dtl' }, el('summary', {}, 'Dettagli tecnici'),
        el('pre', {}, fr.map((f) => f.label + '\n' + MP.hex(f.bytes, 0, 24) + ' …').join('\n\n'))));
    } catch (_) { /* macro non codificabile: l'avviso è già nell'editor */ }
    const n = SEND.pending.length;
    const send = btn(n ? 'Invia al pad · ' + n : 'Pad aggiornato', 'pbtn', () => openSend(), n ? {} : { disabled: '' });
    // il contenuto scorre da solo (senza barre visibili) se la finestra è bassa; intestazione e piede restano fissi
    const sc = el('div', { class: 'cscroll' }, ...kids);
    const fade = () => sc.classList.toggle('more', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 4);   // sfumatura in basso se c'è altro sotto
    sc.addEventListener('scroll', fade, { passive: true });
    card.replaceChildren(head, sc, el('div', { class: 'foot' }, btn('Fine', 'sbtn', () => leaveEdit()), send));
    requestAnimationFrame(fade);
    card.hidden = false;
    placeInspector();
    requestAnimationFrame(() => card.classList.add('in'));
  }

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
  /* pacchetti di un controllo come li invia il configuratore: "azzera" + azione (il firmware conserva il tipo vecchio) */
  function framesFor(L, id) {
    const a = S.store.profile.layers[L - 1].controls[id] || null;
    const list = MP.encodeActionFrames(id, L, a, encOpts());
    const name = NAME(id) + ' · L' + L;
    const out = [];
    if (!(a && a.t === 'clear')) out.push({ label: name + ' · azzera', bytes: MP.clear(id, L) });
    list.forEach((b, i) => out.push({ label: name + (list.length > 1 ? (i === 0 ? ' · tasti' : ' · pausa') : ''), bytes: b }));
    return out;
  }
  const pendingName = (k) => {
    if (k.startsWith('led:')) return 'LED · Layer ' + k.slice(4);
    const [L, id] = k.split(':').map(Number);
    return NAME(id) + ' · L' + L;
  };
  async function sendKeys(keys) {
    const cur = frameHexMap();
    const frames = [];
    for (const k of keys) {
      if (cur[k] === 'ERR') throw new Error('«' + pendingName(k) + '» non è codificabile (macro troppo lunga?).');
      if (k.startsWith('led:')) {
        const L = Number(k.slice(4)), led = S.store.profile.layers[L - 1].led;
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
  async function runSend(all, keysIn) {
    if (SEND.busy) return;
    SEND.busy = true; SEND.err = false; SEND.msg = ''; SEND.done = false; renderSheets();
    try {
      const cur = frameHexMap();
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
  function renderSheets() {
    if (!$('#send').hidden) renderSend();
    if (!$('#leds').hidden) renderLeds();
    if (!$('#settings').hidden) renderSettings();
  }
  const closeBtn = (fn) => btn('✕', 'x2', fn, { 'aria-label': 'Chiudi' });
  const dotEl = (cls) => el('i', { class: 'dot ' + (cls || '') });
  function progressBar(p) {
    return el('div', { class: 'prog' }, el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.round(100 * p.i / p.n) + '%' })),
      el('span', {}, p.i + ' / ' + p.n + ' · ' + p.label));
  }
  /* posiziona un foglio sotto (o sopra) il pulsante che lo apre: la card nasce dove l'utente ha cliccato */
  function anchorSheet(box, anchor, where) {
    // limiti reali: sotto le barre in alto (titolo, layer) e sopra quelle in basso (connessioni, azioni recenti)
    const tops = ['.layers', '.brand'].map((q) => { const e = $(q); return e ? e.getBoundingClientRect().bottom : 0; });
    const topLimit = Math.max(66, ...tops.map((v) => v + 10));
    const bots = ['.conncard', '#last', '#diagBtn'].map((q) => { const e = $(q); const rr = e && e.getBoundingClientRect(); return rr && rr.width ? rr.top : innerHeight; });
    const botLimit = Math.min(...bots) - 10;
    const room = (from, to) => Math.max(150, Math.round(to - from - 44));          // 44 = padding del foglio
    if (innerWidth < 760) {                                                          // telefono: foglio a tutta larghezza
      box.style.cssText = 'left:12px;right:12px;width:auto;top:' + topLimit + 'px;bottom:auto;';
      box.style.setProperty('--smax', room(topLimit, botLimit) + 'px');
      return;
    }
    const r = anchor && anchor.getBoundingClientRect();
    if (!r || !r.width) { box.style.cssText = ''; box.style.setProperty('--smax', room(topLimit, botLimit) + 'px'); return; }
    if (where === 'above') {
      const base = Math.min(r.top, botLimit + 10);                                   // sopra anche alle azioni recenti, se impilate
      box.style.top = 'auto'; box.style.right = 'auto';
      box.style.bottom = Math.round(innerHeight - base + 12) + 'px';
      box.style.left = Math.max(12, Math.round(r.left)) + 'px';
      box.style.setProperty('--smax', room(topLimit, base - 12) + 'px');
    } else {
      const top = Math.round(Math.max(r.bottom + 12, topLimit));
      box.style.bottom = 'auto'; box.style.left = 'auto';
      box.style.top = top + 'px';
      box.style.right = Math.max(12, Math.round(innerWidth - r.right)) + 'px';
      box.style.setProperty('--smax', room(top, botLimit) + 'px');
    }
  }
  /* il contenuto dei fogli scorre da solo (senza barre visibili) se lo spazio non basta; la cornice resta intera */
  function fillSheet(box, kids) {
    const body = el('div', { class: 'sbody' }, ...kids);
    const fade = () => body.classList.toggle('more', body.scrollHeight - body.scrollTop - body.clientHeight > 4);   // sfumatura se c'è altro sotto
    body.addEventListener('scroll', fade, { passive: true });
    box.replaceChildren(body);
    requestAnimationFrame(fade);
  }
  const hideSheets = (except) => { for (const id of ['#send', '#leds', '#settings']) if (id !== except) $(id).hidden = true; closeDropdowns(); };
  function openSend() {
    SEND.msg = ''; SEND.err = false; SEND.done = false;
    hideSheets('#send');
    anchorSheet($('#send'), $('.conncard'), 'above');
    $('#send').hidden = false;
    renderSend();
  }
  function renderSend() {
    const box = $('#send');
    closeDropdowns();
    if (!MP || !S.store) { box.hidden = true; return; }
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

  /* — LED — */
  const LED_COLOR_LIST = [[1, 'Rosso', '#ff3b3b'], [2, 'Arancio', '#ff9a2e'], [3, 'Giallo', '#ffe14a'], [4, 'Verde', '#34d86b'],
    [5, 'Ciano', '#2ee6e6'], [6, 'Blu', '#3b6bff'], [7, 'Viola', '#b25cff'], [0, 'Bianco', '#e6ebf2']];
  /* effetti verificati sul pad reale (15/10/2026). I modi 6–9 e 12–15 si comportano come il 4 (alias): non sono elencati. */
  const LED_MODES = [[0, 'Spento', 'Tutti i LED spenti.'],
    [1, 'Fisso', 'Retroilluminazione sempre accesa nel colore scelto.'],
    [2, 'Sequenza 1 → 9', 'Spenti; a ogni pressione, di qualunque tasto, i LED si accendono uno dopo l’altro dal tasto 1 al 9.'],
    [3, 'Sequenza 9 → 1', 'Come la precedente, ma dal tasto 9 al 1.'],
    [4, 'Tasto premuto', 'Spenti; il tasto che premi si accende e si spegne piano in circa mezzo secondo, alla pressione e al rilascio.'],
    [5, 'Tutti bianchi', 'Tutti i LED accesi di bianco: il colore scelto non conta.'],
    [10, 'Andata e ritorno 1 → 4', 'Spenti; a ogni pressione, di qualunque tasto, i LED si accendono dal tasto 1 al 4 e poi tornano indietro fino al 1.'],
    [11, 'Tasto premuto, netto', 'Come “Tasto premuto”, ma il tasto si accende e si spegne di colpo, senza dissolvenza.']];
  const LEDE = { layer: null };
  const ledOf = (L) => {
    const led = S.store && S.store.profile.layers[L - 1].led;
    return led && typeof led.color === 'number' ? { color: led.color, mode: led.mode | 0, set: true } : { color: L === 1 ? 4 : 0, mode: 1, set: false };
  };
  function openLeds() {
    if (!MP) return;
    ensureStore();
    LEDE.layer = shownLayer();
    SEND.msg = ''; SEND.err = false; SEND.done = false;
    hideSheets('#leds');
    anchorSheet($('#leds'), $('#ledCard'));
    $('#leds').hidden = false;
    renderLeds();
  }
  function setLedField(L, patch) {
    const cur = ledOf(L);
    S.store.profile.layers[L - 1].led = { color: patch.color != null ? patch.color : cur.color, mode: patch.mode != null ? patch.mode : cur.mode };
    commit();
  }
  function renderLeds() {
    const box = $('#leds');
    closeDropdowns();
    if (!MP || !S.store) { box.hidden = true; return; }
    const L = LEDE.layer || shownLayer();
    const cur = ledOf(L);
    const key = 'led:' + L;
    const dirty = SEND.pending.includes(key);
    const st = linkState();
    const kids = [el('div', { class: 'sh' }, el('span', { class: 'micro' }, 'LED'), closeBtn(() => { box.hidden = true; }))];
    kids.push(el('h3', {}, 'Luci del macropad'));
    kids.push(segBtns([[1, 'Layer 1'], [2, 'Layer 2'], [3, 'Layer 3']], (k) => k === L, (k) => { LEDE.layer = k; renderLeds(); }, 'Layer da modificare'));
    const sw = el('div', { class: 'swatches' + (cur.mode === 5 ? ' dim' : ''), role: 'group', 'aria-label': 'Colore' });
    LED_COLOR_LIST.forEach(([v, name, css]) => {
      const b = btn('', 'sw', () => setLedField(L, { color: v }), { 'aria-pressed': String(cur.color === v), title: name, 'aria-label': name });
      b.style.setProperty('--c', css);
      sw.append(b);
    });
    const colName = (LED_COLOR_LIST.find((c) => c[0] === cur.color) || [])[1] || '—';
    kids.push(section('Colore · ' + (cur.mode === 5 ? 'non usato in questo effetto' : colName), sw));
    const mode = LED_MODES.find((m) => m[0] === cur.mode);
    kids.push(section('Effetto',
      dropdown(LED_MODES.map(([v, name]) => [v, name]), cur.mode, (v) => setLedField(L, { mode: v }), 'Effetto LED', mode ? null : 'Modo ' + cur.mode),
      el('p', { class: 'desc' }, mode ? mode[2] : 'Valore non documentato (si comporta come “Tasto premuto”).')));
    const foot = [];
    foot.push(el('p', { class: 'fine' }, 'Colore ed effetto valgono per tutto il layer: il pad non ha un colore per singolo LED. In Bluetooth i LED dei tasti restano spenti; per cambiarli serve il cavo USB.'));
    if (SEND.busy && SEND.progress) foot.push(progressBar(SEND.progress));
    if (SEND.msg) foot.push(el('p', { class: 'hintx' + (SEND.err ? ' warnx' : '') }, (SEND.done && !SEND.err ? '✓ ' : '') + SEND.msg));
    if (st === 'ble') foot.push(el('p', { class: 'hintx warnx' }, 'Collegato solo in wireless: serve il cavo USB.'));
    const go = btn(SEND.busy ? 'Invio in corso…' : dirty ? 'Invia LED del layer ' + L : 'LED aggiornati', 'pbtn', () => runSend(false, [key]));
    if (SEND.busy || !dirty || st === 'ble' || st === 'off') go.setAttribute('disabled', '');
    foot.push(el('div', { class: 'row2 actions' }, go));
    kids.push(el('div', { class: 'sec' }, ...foot));
    fillSheet(box, kids);
  }

  /* — impostazioni e profilo — */
  function coverage() {
    const o = encOpts();
    const c = { total: 0, signed: 0, hosted: 0, normal: 0, uniq: 0, empty: 0 };
    S.store.profile.layers.forEach((Ly, li) => allIds().forEach((id) => {
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
    const data = { app: 'macropad-studio', version: 1, profile: S.store.profile, layout: S.store.layout || S.layout };
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
      const lay = data.layout && Array.isArray(data.layout.keys) && data.layout.keys.length === 9 ? data.layout : (S.store && S.store.layout) || S.layout;
      S.store = { profile: p, layout: lay };
      commit(); buildPad();
      SETT.msg = 'Profilo importato.'; SETT.err = false;
    } catch (e) { SETT.msg = 'Importazione non riuscita: ' + e.message; SETT.err = true; }
    renderSettings();
  }
  const SETT = { msg: '', err: false };
  function openSettings() {
    if (!MP) return;
    ensureStore();
    SETT.msg = ''; SETT.err = false;
    hideSheets('#settings');
    anchorSheet($('#settings'), $('#settingsBtn'));
    $('#settings').hidden = false;
    renderSettings();
  }
  function renderSettings() {
    const box = $('#settings');
    closeDropdowns();
    if (!MP || !S.store) { box.hidden = true; return; }
    const p = S.store.profile;
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

  /* — stato del collegamento — */
  const LINK_TEXT = {
    usb: ['USB', 'Collegato via USB: si può programmare.'],
    ble: ['Wireless', 'Collegato via Bluetooth: i controlli funzionano, ma per programmare serve il cavo USB.'],
    off: ['Non collegato', 'Nessun macropad rilevato (né USB né Bluetooth).'],
    unknown: ['Stato ignoto', 'Il ponte non è attivo, quindi non posso sapere come è collegato il pad.'],
  };
  function linkState() {
    if (S.bridge && S.linkCap) return S.link.usb ? 'usb' : S.link.ble ? 'ble' : 'off';
    if (S.hidSeen) return 'usb';
    return 'unknown';
  }
  function paintLink() {
    const st = linkState();
    const p = $('#linkPill');
    if (!p) return;
    p.className = 'linkpill ' + st;
    p.lastElementChild.textContent = LINK_TEXT[st][0];
    const old = S.bridge && !S.linkCap ? ' (il ponte è una versione vecchia: riavvialo per vedere lo stato del collegamento)' : '';
    p.title = LINK_TEXT[st][1] + old;
    p.setAttribute('aria-label', 'Macropad: ' + LINK_TEXT[st][0]);
    if (!$('#send').hidden || !$('#leds').hidden) renderSheets();
  }
  /* senza ponte: se il pad è già stato autorizzato per WebHID e presente, è collegato via USB */
  function watchHid() {
    if (!('hid' in navigator)) return;
    const check = async () => {
      try {
        const list = await navigator.hid.getDevices();
        S.hidSeen = list.some((d) => d.vendorId === 0x1189);
      } catch (_) { S.hidSeen = false; }
      paintLink();
    };
    navigator.hid.addEventListener('connect', check);
    navigator.hid.addEventListener('disconnect', () => { SEND.dev = null; check(); });
    check();
  }

  /* ---------- ispettore ancorato al controllo ---------- */
  const card = $('#inspector');
  function select(sel) {
    const same = S.sel && sel && S.sel.kind === sel.kind && S.sel.id === sel.id && S.sel.k === sel.k;
    S.sel = same ? null : sel;
    stopRec(true);
    if (!S.sel) { if (S.edit) leaveEdit(); } else E.act = 1;
    document.querySelectorAll('#pad .sel').forEach((e) => e.classList.remove('sel'));
    if (S.sel) {
      const target = S.sel.kind === 'key' ? ctrl.get(S.sel.id).el : knobEl[S.sel.k];
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
  const section = (label, ...kids) => el('section', { class: 'sec' }, el('span', { class: 'micro' }, label), ...kids);
  function renderInspector() {
    closeDropdowns();
    if (!S.sel) { card.classList.remove('in'); card.hidden = true; $('#link path').setAttribute('d', ''); $('#link circle').setAttribute('cx', -10); return; }
    if (S.edit && MP) { renderEditor(); return; }
    const L = shownLayer();
    const dups = dupGroups(L);
    let kicker, title, body, ids;
    if (S.sel.kind === 'key') {
      const id = S.sel.id, n = S.layout.keys.indexOf(id) + 1;
      ids = [id];
      kicker = 'Tasto ' + pad2(n);
      title = 'Tasto ' + n;
      body = [
        section('Azione assegnata', el('div', { class: 'big' }, ...iconAndValue(id, L, 'Nessuna azione'))),
        section('Tutti i layer', el('ul', { class: 'rows' }, [1, 2, 3].map((k) =>
          el('li', { class: k === L ? 'cur' : '' }, el('span', { class: 'k' }, 'Layer ' + k + (k === L ? ' · attivo' : '')), el('div', { class: 'v' }, ...iconAndValue(id, k)))))),
      ];
    } else {
      const trio = S.layout.knobs[S.sel.k];
      ids = trio.slice();
      kicker = 'Encoder ' + pad2(S.sel.k + 1);
      title = 'Manopola ' + (S.sel.k + 1);
      body = [section('Azioni · Layer ' + L, el('ul', { class: 'rows' },
        [['↺  Sinistra', 0], ['Premi', 1], ['↻  Destra', 2]].map(([t, a]) =>
          el('li', {}, el('span', { class: 'k' }, t), el('div', { class: 'v' }, ...iconAndValue(trio[a], L))))))];
    }
    const kinds = [...new Set(ids.map((id) => kindFor(id, L)).filter(Boolean))];
    const here = ids.map((id) => S.sigs.find((x) => x.layer === L && x.id === id)).filter(Boolean);
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
    close.addEventListener('click', () => select(S.sel));
    card.replaceChildren(
      el('header', {}, el('div', {}, el('span', { class: 'micro' }, kicker), el('h2', {}, title),
        el('div', { class: 'badges' }, el('span', { class: 'badge acc' }, 'Layer ' + L), ...kinds.map((k) => el('span', { class: 'badge' }, k)),
          identity ? el('span', { class: 'badge', title: identity === 'Per azione' ? 'Riconosciuto solo dall\'azione, che si ripete su altri controlli: si confonde. Lascia la firma su Automatica nel configuratore.'
          : identity === 'Univoco · azione unica' ? 'La sua azione non compare altrove nel profilo: l\'evento identifica controllo e layer, e tenuto premuto si ripete.'
          : 'Riconosciuto in modo univoco (controllo + layer) grazie alla firma F13–F21.' }, identity) : null)), close),
      el('div', { class: 'cscroll' }, ...body, ...notes),
      el('div', { class: 'foot' }, el('span', { class: 'micro' }, 'Layer ' + L), (() => {
        const b = el('button', { type: 'button', class: 'pbtn' }, 'Modifica');
        if (!MP) { b.setAttribute('disabled', ''); b.title = 'Il modulo di protocollo non è stato caricato (apri la pagina da http://localhost:5173).'; }
        b.addEventListener('click', () => enterEdit());
        return b;
      })()));
    card.hidden = false;
    placeInspector();
    requestAnimationFrame(() => card.classList.add('in'));
  }
  function placeInspector() {
    if (!S.sel || card.hidden) return;
    const target = S.sel.kind === 'key' ? hotOf(ctrl.get(S.sel.id)) : knobEl[S.sel.k].querySelector('.n-hot');
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
  function attachInteraction() {
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
      const trio = S.layout.knobs[k];
      g.addEventListener('pointerdown', () => { press('simk' + k, [{ id: trio[1] }]); });
      const up = () => release('simk' + k);
      g.addEventListener('pointerup', up); g.addEventListener('pointerleave', up);
      g.addEventListener('click', () => select({ kind: 'knob', k }));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select({ kind: 'knob', k }); } });
      g.addEventListener('wheel', (e) => { e.preventDefault(); rotate(k, e.deltaY < 0 ? -1 : 1); }, { passive: false });
    });
  }
  $('#stage').addEventListener('pointerdown', (e) => {
    if (S.sel && !e.target.closest('.key, .knob')) select(S.sel);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = ['#send', '#leds', '#settings'].filter((id) => !$(id).hidden);
      if (open.length) { open.forEach((id) => { $(id).hidden = true; }); return; }
      if (S.sel) select(S.sel);
      if (!$('#diag').hidden) toggleDiag(false);
    }
  });
  window.addEventListener('resize', () => { placeInspector(); });

  /* ---------- stato del ponte e diagnostica ---------- */
  function chips() {
    const cb = $('#chipBridge'), cp = $('#chipProfile');
    paintSendChip(); paintLink();
    const needHost = S.hosted.size > 0;
    const hostBad = S.bridge && S.precise && needHost && (!S.hostCap || S.hostOk === false);
    cb.className = 'chip ' + (S.bridge && S.precise && !hostBad ? 'ok' : 'warn');
    cb.lastElementChild.textContent = !S.bridge ? 'Ponte non attivo' : !S.precise ? 'Ponte vecchio · riavvialo'
      : hostBad ? 'Ponte da aggiornare' : needHost ? 'Ponte · ' + S.hosted.size + ' azioni dal PC' : 'Ponte collegato';
    cb.title = !S.bridge ? 'Senza il ponte la pagina riceve solo i tasti mentre è in primo piano e non distingue il pad dalla tastiera.'
      : !S.precise ? 'Tempi imprecisi: chiudi la finestra del ponte e rilancia start.cmd.'
      : hostBad ? 'Il profilo ha ' + S.hosted.size + ' controlli con azione duplicata che il ponte deve eseguire: chiudi la finestra del ponte e rilancia start.cmd.'
      : needHost ? 'Eventi del solo macropad. Il ponte esegue sul PC ' + S.hosted.size + ' azioni media/mouse duplicate (i controlli inviano solo un codice identificativo).'
      : 'Eventi del solo macropad, anche in background.';
    const n = S.sigs.filter((x) => !x.empty).length;
    const d = dupGroups(shownLayer()).length;
    cp.className = 'chip ' + (n && !d ? 'ok' : 'warn');
    const sg = S.sigs.filter((x) => x.signed && !x.empty).length;
    cp.lastElementChild.textContent = n ? n + ' azioni' + (sg ? ' · ' + sg + ' firmate' : '') + (d ? ' · ' + d + (d === 1 ? ' duplicata' : ' duplicate') : '') : 'Nessun profilo';
    cp.title = n ? 'Azioni riconoscibili nel profilo salvato dal configuratore.' + (sg ? ' Le firmate (F13–F21) sono univoche per controllo e layer.' : '') + (d ? ' Alcune azioni identiche sono su più controlli e non si distinguono.' : '') : 'Apri il configuratore e salva un profilo.';
    $('#diagHelp').textContent = S.bridge
      ? 'Intervalli tra gli eventi e durata di ogni pressione, misurati dal ponte. Servono a tarare le soglie rotazione/pressione.'
      : 'Il ponte non è attivo: avvia start.cmd (o tools\\PadBridge.ps1) per vedere il pad anche in background.';
    if (!recents.length) renderRecents();
  }
  function toggleDiag(open) {
    const box = $('#diag'), btn = $('#diagBtn');
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) $('#raw').textContent = rawLog.length ? rawLog.slice(0, 14).join('\n') : 'nessun evento';
  }
  $('#diagBtn').addEventListener('click', () => toggleDiag($('#diag').hidden));
  $('#rawCopy').addEventListener('click', () => {
    const text = rawLog.slice().reverse().join('\n');
    const b = $('#rawCopy');
    try { navigator.clipboard.writeText(text); b.textContent = 'Copiato'; } catch (_) { b.textContent = 'Non riuscito'; }
    setTimeout(() => { b.textContent = 'Copia'; }, 1500);
  });

  /* ---------- ponte e fallback dalla pagina ---------- */
  let es = null;
  function connectBridge() {
    try { es = new EventSource(BRIDGE + '/events'); } catch (_) { setTimeout(connectBridge, 4000); return; }
    es.addEventListener('hello', (e) => {
      let d = null;
      try { d = JSON.parse(e.data); } catch (_) { /* ponte molto vecchio */ }
      S.bridge = true; S.precise = !!(d && d.precise); S.hostCap = !!(d && d.host);
      S.linkCap = !!(d && d.link); S.link = { usb: !!(d && d.usb), ble: !!(d && d.ble) };
      chips(); paintLink();
      pushHostmap(true);
    });
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch (_) { /* riga non valida */ } };
    es.onerror = () => { S.bridge = false; S.precise = false; S.hostCap = false; S.hostOk = null; S.linkCap = false; chips(); paintLink(); es.close(); setTimeout(connectBridge, 3000); };
  }
  function pageKey(e, down) {
    if (E.rec) return;
    if (S.bridge || (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.target && e.target.closest && e.target.closest('.key, .knob') && (e.key === 'Enter' || e.key === ' ')) return;
    if (MEDIA_KEY[e.key]) { mediaEvent(MEDIA_KEY[e.key], down, e.timeStamp); return; }
    const vk = CODE2VK[e.code] || ({ ControlLeft: 17, ControlRight: 17, ShiftLeft: 16, ShiftRight: 16, AltLeft: 18, AltRight: 18, MetaLeft: 91, MetaRight: 92 })[e.code];
    if (vk) keyEvent(vk, down, e.timeStamp);
  }
  window.addEventListener('keydown', (e) => { if (!e.repeat) pageKey(e, true); });
  window.addEventListener('keyup', (e) => pageKey(e, false));
  window.addEventListener('wheel', (e) => { if (!S.bridge && !e.target.closest('#pad .knob')) wheelEvent(e.deltaY < 0 ? 1 : -1); }, { passive: true });
  window.addEventListener('storage', (e) => { if (e.key === STORE) { load(); buildPad(); pushHostmap(false); } });

  document.querySelectorAll('#layers button').forEach((b) => b.addEventListener('click', () => {
    S.layerMode = b.dataset.l === 'auto' ? 'auto' : Number(b.dataset.l);
    paintLabels();
  }));

  $('#settingsBtn').addEventListener('click', openSettings);
  $('#ledCard').addEventListener('click', openLeds);
  $('#ledCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLeds(); } });
  watchHid();
  $('#chipSend').addEventListener('click', openSend);
  $('#chipSend').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSend(); } });

  /* ---------- avvio ---------- */
  load();
  buildPad();
  connectBridge();
  updatePending(true);
  Glass.attach(card, 12, 18, 24);
  Glass.attach($('#diag'), 12, 16, 20);
  new ResizeObserver(() => { fitGrain(); Bg.size(); placeInspector(); }).observe($('#stage'));
  window.__live = { S, onEvent, ctrl, load, buildPad, paintLabels, select, hostedControls, sensorUsage };
})();
