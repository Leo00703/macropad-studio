/* Protocollo "esteso" della famiglia 1189:883x — specifica in docs/PROTOCOL.md.
   Funzioni pure: nessun accesso a DOM o HID, così si testano con Node.
   Forma: IIFE con dichiarazioni `function` (leggibili anche dagli strumenti AST) che espone il modulo come globalThis.MP. */
(function (root) {
  'use strict';
  /* Forme dei dati (solo documentazione, nessun controllo a runtime)
     @typedef {{ mod?: number, key?: number }} Step               una pressione: bitmask dei modificatori HID + usage tastiera
     @typedef {{ t: 'keys', steps: Step[], delay?: number, delayReset?: boolean, hold?: 'repeat'|'once', sign?: 'on'|'off' }} KeysAction
     @typedef {{ t: 'media', usage: number, hold?: 'repeat'|'once' }} MediaAction
     @typedef {{ t: 'mouse', buttons?: number, wheel?: number, mod?: number, hold?: 'repeat'|'once' }} MouseAction
     @typedef {{ t: 'clear' }} ClearAction                          "Disattiva": il controllo non emette nulla
     @typedef {KeysAction|MediaAction|MouseAction|ClearAction} Action
     @typedef {{ controls: Object<number, Action>, led?: { color: number, mode: number } }} Layer
     @typedef {{ layers: Layer[], signature?: boolean, signAll?: boolean, signEmpty?: boolean, hostActions?: boolean, repeat?: { delay?: number, rate?: number } }} Profile
     @typedef {{ keys: number[], knobs: number[][] }} Layout   ID dei 9 tasti e dei 3 × 3 controlli delle manopole
     @typedef {{ signature?: boolean, signEmpty?: boolean,
                 plan?: { keys: Set<string> }, hosted?: Map<string, object> }} EncodeOptions   chiavi dei Set/Map = "layer:id" */
  const VENDOR_ID = 0x1189;
  const VERIFIED_PIDS = [0x8833];                    // PID per cui la decompilazione dell'app ufficiale è stata verificata
  const REPORT_ID = 3;
  const PAYLOAD_LEN = 64;
  const CMD_BIND = 0xFE;
  const LED_ID = 0xB0;
  const TYPE = Object.freeze({ CLEAR: 0, KEYS: 1, MEDIA: 2, MOUSE: 3, KEYS_DELAY: 5, LED: 8 });
  const MOD = Object.freeze({ LCTRL: 0x01, LSHIFT: 0x02, LALT: 0x04, LGUI: 0x08, RCTRL: 0x10, RSHIFT: 0x20, RALT: 0x40, RGUI: 0x80 });
  const LIMITS = Object.freeze({ layers: 3, steps: 18, delayMs: 6000 });
  const KNOB_BASE = 13;
  const MOUSE_BTN = Object.freeze({ LEFT: 1, RIGHT: 2, MIDDLE: 4 });

  const MEDIA = Object.freeze({
    0xCD: 'Play/Pausa', 0xB5: 'Traccia succ.', 0xB6: 'Traccia prec.',
    0xE2: 'Muto', 0xE9: 'Volume +', 0xEA: 'Volume −',
  });
  const LED_COLORS = Object.freeze([
    { v: 1, name: 'Rosso', css: '#ff3b3b' }, { v: 2, name: 'Arancio', css: '#ff9a2e' },
    { v: 3, name: 'Giallo', css: '#ffe14a' }, { v: 4, name: 'Verde', css: '#34d86b' },
    { v: 5, name: 'Ciano', css: '#2ee6e6' }, { v: 6, name: 'Blu', css: '#3b6bff' },
    { v: 7, name: 'Viola', css: '#b25cff' },
  ]);

  function isControlId(id) { return Number.isInteger(id) && id >= 1 && id <= 21; }
  function knobId(knob, action) { return KNOB_BASE + knob * 3 + action; }   // action: 0 ↺, 1 premi, 2 ↻

  /* count = indice (base 1) dell'ultima coppia non vuota; una coppia 0 con solo modificatore conta 0 */
  function pairCount(payload) {
    let count = 0;
    for (let i = 0; i < LIMITS.steps; i++) {
      const mod = payload[2 * i] || 0, key = payload[2 * i + 1] || 0;
      if (i === 0) { if (key) count = 1; }
      else if (mod || key) count = i + 1;
    }
    return count;
  }

  /* count: se omesso si calcola con pairCount (regola dell'app ufficiale) */
  /** @param {number} controlId 1–21 (tasti 1–9, manopole 13–21) o LED_ID  @param {number} layer 1–3  @param {number} type uno di TYPE
   *  @param {number} delayMs 0–6000  @param {number[]} payload coppie (modificatore, usage)…  @param {number} [count] numero di coppie  @returns {Uint8Array} 64 byte */
  function frame(controlId, layer, type, delayMs, payload, count) {
    if (!Number.isInteger(layer) || layer < 1 || layer > LIMITS.layers) throw new RangeError('Il layer deve essere 1, 2 o 3');
    if (!isControlId(controlId) && controlId !== LED_ID) throw new RangeError('ID controllo non valido: ' + controlId);
    if (payload.length > LIMITS.steps * 2) throw new RangeError('Troppe pressioni (massimo ' + LIMITS.steps + ')');
    if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > LIMITS.delayMs) throw new RangeError('Il delay deve essere 0–6000 ms');
    const b = new Uint8Array(PAYLOAD_LEN);
    b[0] = CMD_BIND; b[1] = controlId; b[2] = layer; b[3] = type;
    b[4] = delayMs & 0xFF; b[5] = (delayMs >> 8) & 0xFF;
    b[9] = count === undefined ? pairCount(payload) : count;
    b.set(payload.map((v) => v & 0xFF), 10);
    return b;
  }

  function keys(id, layer, steps) {
    return frame(id, layer, TYPE.KEYS, 0, steps.flatMap((s) => [s.mod || 0, s.key || 0]));
  }
  /* La pausa è un pacchetto SEPARATO di tipo 5 (solo ritardo, nessuna coppia), da inviare DOPO quello dei tasti.
     Verificato su hardware: un unico pacchetto tipo 5 con le coppie lasciava attiva la vecchia combinazione.
     Nell'app ufficiale la pagina "Delay" azzera le coppie (Page_change_Clear → Set_Key_Init) prima di inviarlo. */
  function delay(id, layer, ms) { return frame(id, layer, TYPE.KEYS_DELAY, ms, []); }
  function media(id, layer, usage) {
    return frame(id, layer, TYPE.MEDIA, 0, usage > 0xFF ? [0, usage & 0xFF, usage >> 8] : [0, usage]);
  }
  /* posizioni dell'app ufficiale, verificate sul pad: [0, bottoni, 0, 0, rotella, modificatori] */
  function mouse(id, layer, m) {
    return frame(id, layer, TYPE.MOUSE, 0, [0, m.buttons || 0, 0, 0, (m.wheel || 0) & 0xFF, m.mod || 0]);
  }
  function led(layer, color, mode) {
    return frame(LED_ID, layer, TYPE.LED, 0, [layer, ((color & 0x0F) << 4) | (mode & 0x0F)]);
  }
  function clear(id, layer) { return frame(id, layer, TYPE.CLEAR, 0, []); }

  function encodeAction(id, layer, a) {
    switch (a && a.t) {
      case 'keys': return keys(id, layer, a.steps || []);
      case 'media': return media(id, layer, a.usage);
      case 'mouse': return mouse(id, layer, a);
      case 'clear': return clear(id, layer);
      default: return null;
    }
  }

  /* ---- firma univoca ----
     Due tasti F13–F21 in TESTA alla macro codificano (layer, controllo): n = (layer−1)·24 + (id−1) ∈ 0…71, in base 9
     → F13+⌊n/9⌋, F13+n%9. Nessuna app li usa; la vista live li legge e sa quale controllo e quale layer sono, anche
     con azioni identiche. Poiché la macro è memorizzata nel pad, funziona in USB e in Bluetooth.
     Solo per i controlli di tipo tastiera: Volume/Muto come usage tastiera 0x7F–0x81 non funzionano (Windows li scarta). */
  const SIG = Object.freeze({ BASE: 0x68, RADIX: 9, STEPS: 2 });
  function signatureKeys(controlId, layer) {
    if (!isControlId(controlId)) throw new RangeError('ID controllo non valido: ' + controlId);
    if (!Number.isInteger(layer) || layer < 1 || layer > LIMITS.layers) throw new RangeError('Il layer deve essere 1, 2 o 3');
    const n = (layer - 1) * 24 + (controlId - 1);
    return [SIG.BASE + Math.floor(n / SIG.RADIX), SIG.BASE + (n % SIG.RADIX)];
  }
  function decodeSignature(k1, k2) {
    const a = k1 - SIG.BASE, b = k2 - SIG.BASE;
    if (a < 0 || a > 7 || b < 0 || b >= SIG.RADIX) return null;
    const n = a * SIG.RADIX + b;
    if (n > 71) return null;
    return { layer: Math.floor(n / 24) + 1, id: (n % 24) + 1 };
  }
  /* ---- identità "sensore": usage consumer RISERVATO, uno per (layer, controllo) ----
     Misurato su hardware: in Bluetooth i tasti F13–F21 della firma NON arrivano (il descrittore HID wireless li scarta),
     mentre i report consumer (media) sì, anche con valori sconosciuti perché Raw Input consegna i byte grezzi. Per i
     controlli che non possono portare la firma tastiera (media/mouse duplicati, controlli senza azione) l'identità è
     quindi un usage consumer riservato, che Windows non interpreta: vale in USB e in wireless. 72 valori = 3 layer × 24. */
  const SENSOR_USAGES = [];
  for (const [a, b] of [[0x07, 0x1F], [0x49, 0x5F], [0x67, 0x7F]]) for (let u = a; u <= b && SENSOR_USAGES.length < 72; u++) SENSOR_USAGES.push(u);
  function sensorUsage(controlId, layer) {
    if (!isControlId(controlId)) throw new RangeError('ID controllo non valido: ' + controlId);
    if (!Number.isInteger(layer) || layer < 1 || layer > LIMITS.layers) throw new RangeError('Il layer deve essere 1, 2 o 3');
    return SENSOR_USAGES[(layer - 1) * 24 + (controlId - 1)];
  }
  function decodeSensor(usage) {
    const i = SENSOR_USAGES.indexOf(usage);
    return i < 0 ? null : { layer: Math.floor(i / 24) + 1, id: (i % 24) + 1 };
  }
  /* azione effettivamente inviata: con opts.signature aggiunge la firma (solo se l'azione emette tasti) */
  /** @param {number} id  @param {number} layer  @param {Action|null} a  @param {EncodeOptions} [opts]  @returns {Action|null} l'azione che il pad riceve davvero (con firma o identità, se richiesto) */
  function withSignature(id, layer, a, opts) {
    if (!opts || !opts.signature) return a;
    const sig = signatureKeys(id, layer).map((key) => ({ mod: 0, key }));
    // controllo SENZA azione: con signEmpty emette solo l'identità (usage riservato), così premerlo rivela comunque il layer fisico
    if (!a) return opts.signEmpty ? { t: 'media', usage: sensorUsage(id, layer) } : a;
    if (a.t === 'keys') {
      if (!(a.steps || []).length) return a;
      if (opts.plan && !opts.plan.keys.has(layer + ':' + id)) return a;   // automatico: azione unica → normale (tenuta nativa)
      const steps = sig.concat(a.steps);
      if (steps.length > LIMITS.steps) throw new RangeError('Con la firma restano ' + (LIMITS.steps - SIG.STEPS) + ' pressioni disponibili');
      return Object.assign({}, a, { steps });
    }
    // azione media/mouse duplicata: il pad invia SOLO la firma e la esegue il ponte sul PC (vedi hostedControls)
    if (opts.hosted && opts.hosted.has(layer + ':' + id) && (a.t === 'media' || a.t === 'mouse')) return { t: 'media', usage: sensorUsage(id, layer) };
    return a;
  }
  /* true se il controllo, con queste opzioni, emette una firma (id/layer servono per i controlli "eseguiti dal PC") */
  /** @param {Action|null} a  @param {EncodeOptions} [opts]  @param {number} [id]  @param {number} [layer]  @returns {boolean} true se il controllo emette una firma */
  function isSigned(a, opts, id, layer) {
    if (!opts || !opts.signature) return false;
    if (!a) return !!opts.signEmpty;                                              // controllo vuoto: emette l'identità "sensore"
    const key = layer + ':' + id;
    const signsKeys = a.t === 'keys' && (a.steps || []).length > 0 && (!opts.plan || id == null || opts.plan.keys.has(key));
    const signsHosted = !!(opts.hosted && id != null && opts.hosted.has(key));   // media/mouse eseguiti dal ponte: solo identità
    return signsKeys || signsHosted;
  }

  /* ---- azioni "eseguite dal PC" ----
     Media e mouse non possono portare la firma: il pad emette UN solo report per pressione (provato su hardware, anche con
     più usage nel frame). Due controlli con la stessa azione sarebbero quindi indistinguibili, e il cambio di layer
     (silenzioso) passerebbe inosservato. Soluzione: per ogni gruppo di azioni identiche UN controllo resta nativo (il pad
     la esegue da solo e, essendo l'unico a emettere quell'evento, è univoco anche per layer); gli altri inviano SOLO la
     firma e l'azione la esegue il ponte sul PC (tools/PadBridge.ps1, endpoint /hostmap).
     La vista live (live.js) usa direttamente MP.hostedControls: la logica esiste in un solo posto. */
  const HOST_VK = Object.freeze({ 0xE2: 0xAD, 0xEA: 0xAE, 0xE9: 0xAF, 0xB5: 0xB0, 0xB6: 0xB1, 0xB7: 0xB2, 0xCD: 0xB3,
    0x18A: 0xB4, 0x183: 0xB5, 0x192: 0xB7, 0x221: 0xAA, 0x223: 0xAC, 0x224: 0xA6, 0x225: 0xA7, 0x226: 0xA9, 0x227: 0xA8, 0x22A: 0xAB });
  function hostAction(a) {
    if (!a) return null;
    if (a.t === 'media' && HOST_VK[a.usage]) return { group: 'm' + a.usage, act: { k: 'key', vk: HOST_VK[a.usage] } };
    if (a.t === 'mouse') {
      if (a.wheel) return { group: 'w' + Math.sign(a.wheel) + ':' + ((a.mod || 0) & 7), act: { k: 'wheel', d: a.wheel > 0 ? 120 : -120, m: (a.mod || 0) & 7 } };
      if (a.buttons) return { group: 'b' + (a.buttons & 7), act: { k: 'btn', b: a.buttons & 7 } };
    }
    return null;
  }
  /* ripetizione eseguita dal ponte per i controlli con "Ripeti": attesa prima della prima ripetizione e intervallo (ms) */
  function clampInt(v, lo, hi, d) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
  function repeatOf(profile) {
    const r = (profile && profile.repeat) || {};
    return { d: clampInt(r.delay, 100, 2000, 450), r: clampInt(r.rate, 30, 500, 70) };
  }
  /* → Map "layer:id" → azione da eseguire sul PC, solo per i controlli NON nativi */
  /** @param {Profile} profile  @param {Layout} layout  @returns {Map<string, object>} "layer:id" → azione che esegue il ponte */
  function hostedControls(profile, layout) {
    const ids = [...layout.keys, ...layout.knobs.flat()];
    const groups = new Map();
    const out = new Map();
    profile.layers.forEach((L, li) => ids.forEach((id) => {
      const a = L.controls && L.controls[id];
      const h = hostAction(a);
      if (!h) return;
      // "tenuto premuto" scelto a mano: il controllo lo gestisce il ponte (vede pressione e rilascio) e non occupa il posto nativo
      if (a.hold === 'once') { out.set((li + 1) + ':' + id, h.act); return; }
      if (a.hold === 'repeat') { out.set((li + 1) + ':' + id, Object.assign({}, h.act, { rep: repeatOf(profile) })); return; }
      if (!groups.has(h.group)) groups.set(h.group, []);
      // preferenza per restare nativo: rotazioni, poi tasti, poi pressioni di manopola; a parità layer e ID più bassi
      groups.get(h.group).push({ layer: li + 1, id, act: h.act, rank: id >= KNOB_BASE ? ((id - KNOB_BASE) % 3 === 1 ? 2 : 0) : 1 });
    }));
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((x, y) => x.rank - y.rank || x.layer - y.layer || x.id - y.id);
      for (const c of list.slice(1)) out.set(c.layer + ':' + c.id, c.act);
    }
    return out;
  }

  /* ---- piano di firma (modalità "automatico") ----
     La firma costa la tenuta del tasto (la macro diventa un tocco di ~6 ms, niente ripetizione di Windows), perciò la si
     mette SOLO dove serve: un controllo a tastiera la riceve se la sua azione si confonde con quella di un altro controllo,
     in QUALUNQUE layer (stessa sequenza, oppure una è l'inizio dell'altra). Gli altri restano "normali": un tasto a una
     coppia segue la mano (tenuta, ripetizione) e la vista live lo riconosce — e ne deduce il layer — dall'azione stessa.
     Per controllo: a.sign = 'on' (sempre) | 'off' (mai); assente = automatico. profile.signAll firma tutto.
     La vista live (live.js) usa direttamente MP.signPlan: la logica esiste in un solo posto. */
  function normMod(m) { return ((m || 0) | ((m || 0) >> 4)) & 0x0F; }          // sinistra/destra equivalenti
  function seqOf(a) { return (a.steps || []).filter((st) => st.key).map((st) => normMod(st.mod) + ':' + st.key); }
  function seqClash(x, y) {
    const n = Math.min(x.length, y.length);
    if (!n) return false;
    for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false;
    return true;                                                                // uguali, oppure una è prefisso dell'altra
  }
  /** @param {Profile} profile  @param {Layout} layout  @returns {{ keys: Set<string>, hosted: Map<string, object> }} controlli da firmare e azioni del ponte */
  function signPlan(profile, layout) {
    const ids = [...layout.keys, ...layout.knobs.flat()];
    const all = !!profile.signAll;
    const items = [];
    profile.layers.forEach((L, li) => ids.forEach((id) => {
      const a = L.controls && L.controls[id];
      if (!a || a.t !== 'keys') return;
      const seq = seqOf(a);
      if (!seq.length) return;
      // resta normale chi viene prima: tasti, poi pressione di manopola, poi rotazione; a parità layer e ID più bassi
      const rank = id < KNOB_BASE ? 0 : ((id - KNOB_BASE) % 3 === 1 ? 1 : 2);
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

  /* Tutti i pacchetti necessari per un'azione, nell'ordine di invio.
     Tastiera: pacchetto tasti + (se pausa > 0, oppure se si chiede di azzerarla) pacchetto pausa. */
  /** @param {number} id  @param {number} layer  @param {Action|null} a  @param {EncodeOptions} [opts]  @returns {Uint8Array[]} pacchetti nell'ordine di invio (vuoto se non c'è nulla da scrivere) */
  function encodeActionFrames(id, layer, a, opts) {
    a = withSignature(id, layer, a, opts);
    const first = encodeAction(id, layer, a, opts);
    if (!first) return [];
    if (a.t === 'keys' && ((a.delay || 0) > 0 || a.delayReset)) return [first, delay(id, layer, a.delay || 0)];
    return [first];
  }

  /* ---- tasti HID (pagina 0x07) ---- */
  const KEY_LABELS = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => { KEY_LABELS[0x04 + i] = c; });
  '1234567890'.split('').forEach((c, i) => { KEY_LABELS[0x1E + i] = c; });
  Object.assign(KEY_LABELS, {
    0x28: 'Invio', 0x29: 'Esc', 0x2A: 'Backspace', 0x2B: 'Tab', 0x2C: 'Spazio', 0x2D: '-', 0x2E: '=', 0x2F: '[', 0x30: ']',
    0x31: '\\', 0x33: ';', 0x34: "'", 0x35: '`', 0x36: ',', 0x37: '.', 0x38: '/', 0x39: 'Bloc Maiusc',
    0x46: 'Stamp', 0x47: 'Bloc Scorr', 0x48: 'Pausa', 0x49: 'Ins', 0x4A: 'Home', 0x4B: 'Pag↑', 0x4C: 'Canc', 0x4D: 'Fine',
    0x4E: 'Pag↓', 0x4F: '→', 0x50: '←', 0x51: '↓', 0x52: '↑', 0x53: 'Bloc Num', 0x54: 'Num /', 0x55: 'Num *',
    0x56: 'Num −', 0x57: 'Num +', 0x62: 'Num 0', 0x63: 'Num .', 0x65: 'Menu',
  });
  for (let i = 0; i < 12; i++) KEY_LABELS[0x3A + i] = 'F' + (i + 1);
  for (let i = 0; i < 9; i++) KEY_LABELS[0x59 + i] = 'Num ' + (i + 1);
  /* usage offerti dall'app ufficiale: gli altri (F13–F24, Num Invio…) sono "non verificati" */
  const OFFICIAL_USAGES = Object.freeze(Object.keys(KEY_LABELS).map(Number).sort((a, b) => a - b));
  Object.assign(KEY_LABELS, { 0x32: '# (ISO)', 0x58: 'Num Invio', 0x64: '\\ (ISO)' });
  for (let i = 0; i < 12; i++) KEY_LABELS[0x68 + i] = 'F' + (13 + i);

  const CODE_TO_USAGE = {};
  for (let i = 0; i < 26; i++) CODE_TO_USAGE['Key' + String.fromCharCode(65 + i)] = 0x04 + i;
  for (let i = 1; i <= 9; i++) CODE_TO_USAGE['Digit' + i] = 0x1E + i - 1;
  CODE_TO_USAGE.Digit0 = 0x27;
  Object.assign(CODE_TO_USAGE, {
    Enter: 0x28, Escape: 0x29, Backspace: 0x2A, Tab: 0x2B, Space: 0x2C, Minus: 0x2D, Equal: 0x2E, BracketLeft: 0x2F,
    BracketRight: 0x30, Backslash: 0x31, IntlHash: 0x32, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35, Comma: 0x36,
    Period: 0x37, Slash: 0x38, CapsLock: 0x39, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48, Insert: 0x49,
    Home: 0x4A, PageUp: 0x4B, Delete: 0x4C, End: 0x4D, PageDown: 0x4E, ArrowRight: 0x4F, ArrowLeft: 0x50,
    ArrowDown: 0x51, ArrowUp: 0x52, NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55, NumpadSubtract: 0x56,
    NumpadAdd: 0x57, NumpadEnter: 0x58, NumpadDecimal: 0x63, IntlBackslash: 0x64, ContextMenu: 0x65,
  });
  for (let i = 1; i <= 12; i++) CODE_TO_USAGE['F' + i] = 0x3A + i - 1;
  for (let i = 13; i <= 24; i++) CODE_TO_USAGE['F' + i] = 0x68 + i - 13;
  for (let i = 1; i <= 9; i++) CODE_TO_USAGE['Numpad' + i] = 0x59 + i - 1;
  CODE_TO_USAGE.Numpad0 = 0x62;
  const CODE_TO_MOD = {
    ControlLeft: MOD.LCTRL, ShiftLeft: MOD.LSHIFT, AltLeft: MOD.LALT, MetaLeft: MOD.LGUI,
    ControlRight: MOD.RCTRL, ShiftRight: MOD.RSHIFT, AltRight: MOD.RALT, MetaRight: MOD.RGUI,
  };

  const MOD_NAMES = [[0x01, 'Ctrl'], [0x02, 'Shift'], [0x04, 'Alt'], [0x08, 'Win'], [0x10, 'Ctrl dx'], [0x20, 'Shift dx'], [0x40, 'Alt dx'], [0x80, 'Win dx']];
  function modLabel(m) { return MOD_NAMES.filter(([bit]) => m & bit).map(([, n]) => n).join('+'); }
  function keyLabel(u) { return KEY_LABELS[u] || ('0x' + u.toString(16).toUpperCase().padStart(2, '0')); }
  function stepLabel(s) {
    const m = modLabel(s.mod || 0), k = s.key ? keyLabel(s.key) : '';
    return m && k ? m + '+' + k : (m || k || '∅');
  }

  /* testo semplice → passi (solo lettere, cifre, spazio, a capo; la tastiera host interpreta le posizioni) */
  function textToSteps(text) {
    const steps = [];
    for (const ch of text) {
      if (/[a-z]/.test(ch)) steps.push({ mod: 0, key: 0x04 + ch.charCodeAt(0) - 97 });
      else if (/[A-Z]/.test(ch)) steps.push({ mod: MOD.LSHIFT, key: 0x04 + ch.charCodeAt(0) - 65 });
      else if (/[1-9]/.test(ch)) steps.push({ mod: 0, key: 0x1E + ch.charCodeAt(0) - 49 });
      else if (ch === '0') steps.push({ mod: 0, key: 0x27 });
      else if (ch === ' ') steps.push({ mod: 0, key: 0x2C });
      else if (ch === '\n') steps.push({ mod: 0, key: 0x28 });
      else throw new RangeError('Carattere non supportato: ' + JSON.stringify(ch));
    }
    return steps;
  }

  function hex(bytes, from = 0, to = bytes.length) {
    return Array.from(bytes.slice(from, to), (v) => v.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  }

  root.MP = Object.freeze({
    VENDOR_ID, VERIFIED_PIDS, REPORT_ID, PAYLOAD_LEN, CMD_BIND, LED_ID, TYPE, MOD, LIMITS, KNOB_BASE, MOUSE_BTN,
    MEDIA, LED_COLORS, KEY_LABELS, OFFICIAL_USAGES, CODE_TO_USAGE, CODE_TO_MOD,
    isControlId, knobId, pairCount, frame, keys, delay, media, mouse, led, clear, encodeAction, encodeActionFrames,
    SIG, signatureKeys, decodeSignature, SENSOR_USAGES, sensorUsage, decodeSensor, withSignature, isSigned, HOST_VK, hostAction, hostedControls, repeatOf, signPlan,
    modLabel, keyLabel, stepLabel, textToSteps, hex,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MP;   // Node: test e strumenti da riga di comando
})(typeof globalThis !== 'undefined' ? globalThis : this);
