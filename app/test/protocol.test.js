'use strict';
// Test del modulo di protocollo (app/protocol.js).
// Esecuzione: node test/protocol.test.js   (nessuna dipendenza)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MP = require('../protocol.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}
const hexOf = (b, n) => MP.hex(b, 0, n);
const padded = (s) => s.split(' ').concat(Array(64).fill('00')).slice(0, 64).join(' ');

console.log('Protocollo 1189:883x');

test('esempio: tasto 1, layer 1, "A"', () => {
  assert.strictEqual(MP.hex(MP.keys(1, 1, [{ mod: 0, key: 0x04 }])), padded('FE 01 01 01 00 00 00 00 00 01 00 04'));
});
test('esempio: tasto 2, layer 1, Ctrl+C', () => {
  assert.strictEqual(MP.hex(MP.keys(2, 1, [{ mod: 0x01, key: 0x06 }])), padded('FE 02 01 01 00 00 00 00 00 01 01 06'));
});
test('esempio: manopola 1 pressione (ID 14), Play/Pausa', () => {
  assert.strictEqual(MP.knobId(0, 1), 14);
  assert.strictEqual(MP.hex(MP.media(14, 1, 0xCD)), padded('FE 0E 01 02 00 00 00 00 00 01 00 CD'));
});
test('esempio: tasto 3, layer 2, "ciao" → pacchetto tasti (tipo 1)', () => {
  const steps = MP.textToSteps('ciao');
  assert.strictEqual(MP.hex(MP.keys(3, 2, steps)), padded('FE 03 02 01 00 00 00 00 00 04 00 06 00 0C 00 04 00 12'));
});
test('esempio: pausa di 50 ms = pacchetto SEPARATO di tipo 5, senza coppie e count 0', () => {
  assert.strictEqual(MP.hex(MP.delay(3, 2, 50)), padded('FE 03 02 05 32 00 00 00 00 00'));
});
test('azione tastiera con pausa → due pacchetti nell\'ordine tasti, pausa', () => {
  const a = { t: 'keys', steps: MP.textToSteps('ciao'), delay: 50 };
  const f = MP.encodeActionFrames(3, 2, a);
  assert.strictEqual(f.length, 2);
  assert.deepStrictEqual([f[0][3], f[1][3]], [1, 5]);
  assert.strictEqual(f[1][4], 50);
});
test('senza pausa un solo pacchetto; con delayReset anche "pausa 0"', () => {
  const base = { t: 'keys', steps: [{ mod: 0, key: 4 }], delay: 0 };
  assert.strictEqual(MP.encodeActionFrames(1, 1, base).length, 1);
  const f = MP.encodeActionFrames(1, 1, Object.assign({}, base, { delayReset: true }));
  assert.deepStrictEqual([f.length, f[1][3], f[1][4], f[1][5]], [2, 5, 0, 0]);
});
test('media, mouse e "disattiva" restano a un solo pacchetto', () => {
  for (const a of [{ t: 'media', usage: 0xCD }, { t: 'mouse', buttons: 1 }, { t: 'clear' }]) {
    assert.strictEqual(MP.encodeActionFrames(1, 1, a).length, 1);
  }
});
test('esempio: LED layer 1, verde (4), modo 1', () => {
  assert.strictEqual(MP.hex(MP.led(1, 4, 1)), padded('FE B0 01 08 00 00 00 00 00 01 01 41'));
});
test('delay: 6000 ms = 0x1770 little-endian', () => {
  const b = MP.delay(1, 1, 6000);
  assert.strictEqual(b[4], 0x70); assert.strictEqual(b[5], 0x17); assert.strictEqual(b[3], 5);
});
test('il pacchetto tasti ha sempre tipo 1 e delay 0', () => {
  const b = MP.keys(1, 1, [{ mod: 0, key: 4 }]);
  assert.deepStrictEqual([b[3], b[4], b[5]], [1, 0, 0]);
});
test('"disattiva" invia tipo 0 e count 0', () => {
  const b = MP.clear(5, 3);
  assert.deepStrictEqual([b[0], b[1], b[2], b[3], b[9]], [0xFE, 5, 3, 0, 0]);
});

console.log('Conteggio coppie');
test('solo modificatore alla prima coppia → count 0 (come l\'app ufficiale)', () => {
  assert.strictEqual(MP.keys(1, 1, [{ mod: 0x01, key: 0 }])[9], 0);
});
test('count = indice dell\'ultima coppia non vuota', () => {
  assert.strictEqual(MP.pairCount([0, 4, 0, 0, 0, 5]), 3);
  assert.strictEqual(MP.pairCount([0, 4, 2, 0]), 2);
  assert.strictEqual(MP.pairCount([]), 0);
});
test('18 pressioni sono ammesse, 19 no', () => {
  const s = Array.from({ length: 18 }, () => ({ mod: 0, key: 4 }));
  assert.strictEqual(MP.keys(1, 1, s)[9], 18);
  assert.throws(() => MP.keys(1, 1, s.concat([{ mod: 0, key: 4 }])), RangeError);
});

console.log('Mouse e media (secondo l\'app ufficiale)');
test('mouse: click sinistro → payload [0,1,0,0,0,0], count 1', () => {
  const b = MP.mouse(1, 1, { buttons: MP.MOUSE_BTN.LEFT });
  assert.strictEqual(hexOf(b.slice(9), 8), '01 00 01 00 00 00 00 00');
  assert.strictEqual(b[3], 3);
});
test('mouse: rotella su → count 3', () => {
  const b = MP.mouse(1, 1, { wheel: 1 });
  assert.strictEqual(b[9], 3); assert.strictEqual(b[14], 1);
});
test('mouse: rotella giù con Ctrl → 0xFF e modificatore 1', () => {
  const b = MP.mouse(1, 1, { wheel: -1, mod: 1 });
  assert.strictEqual(b[14], 0xFF); assert.strictEqual(b[15], 1);
});
test('media: usage > 0xFF aggiunge il byte alto e count 2', () => {
  const b = MP.media(1, 1, 0x192);
  assert.deepStrictEqual([b[9], b[10], b[11], b[12]], [2, 0, 0x92, 0x01]);
});

console.log('Validazione');
test('layer fuori range', () => {
  assert.throws(() => MP.keys(1, 0, []), RangeError);
  assert.throws(() => MP.keys(1, 4, []), RangeError);
});
test('ID fuori range', () => {
  assert.throws(() => MP.keys(0, 1, []), RangeError);
  assert.throws(() => MP.keys(22, 1, []), RangeError);
  assert.doesNotThrow(() => MP.keys(21, 1, []));
});
test('delay fuori range', () => {
  assert.throws(() => MP.delay(1, 1, 6001), RangeError);
});
test('numerazione manopole 13..21', () => {
  const ids = [];
  for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) ids.push(MP.knobId(k, a));
  assert.deepStrictEqual(ids, [13, 14, 15, 16, 17, 18, 19, 20, 21]);
});
test('ogni pacchetto è lungo 64 byte', () => {
  assert.strictEqual(MP.keys(1, 1, []).length, 64);
  assert.strictEqual(MP.led(3, 7, 5).length, 64);
});

console.log('Tabelle tasti');
test('usage ufficiali = docs/keycodes.tsv', () => {
  const tsv = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'keycodes.tsv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const fromDoc = [...new Set(tsv.map((l) => parseInt(l.split('\t')[1], 16)))].sort((a, b) => a - b);
  assert.deepStrictEqual([...MP.OFFICIAL_USAGES], fromDoc);
});
test('ogni event.code mappato ha un\'etichetta', () => {
  for (const [code, u] of Object.entries(MP.CODE_TO_USAGE)) assert(MP.KEY_LABELS[u], code + ' → 0x' + u.toString(16) + ' senza etichetta');
});
test('textToSteps: maiuscole con Shift, carattere non supportato lancia', () => {
  assert.deepStrictEqual(MP.textToSteps('Aa'), [{ mod: 2, key: 4 }, { mod: 0, key: 4 }]);
  assert.throws(() => MP.textToSteps('é'), RangeError);
});

console.log('Firma univoca');
test('firma: tutte le 54 combinazioni (controllo × layer) sono distinte e decodificabili', () => {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const seen = new Set();
  for (const layer of [1, 2, 3]) for (const id of ids) {
    const [k1, k2] = MP.signatureKeys(id, layer);
    assert(k1 >= 0x68 && k1 <= 0x68 + 7, 'primo tasto fuori da F13–F20');
    assert(k2 >= 0x68 && k2 <= 0x68 + 8, 'secondo tasto fuori da F13–F21');
    const key = k1 + ':' + k2;
    assert(!seen.has(key), 'firma duplicata ' + key);
    seen.add(key);
    assert.deepStrictEqual(MP.decodeSignature(k1, k2), { id, layer });
  }
  assert.strictEqual(seen.size, 54);
});
test('firma: tasti e usage fuori dallo schema non si decodificano', () => {
  assert.strictEqual(MP.decodeSignature(0x04, 0x05), null);
  assert.strictEqual(MP.decodeSignature(0x68 + 8, 0x68), null);
});
test('firma: va in TESTA alla macro e non altera il resto', () => {
  const a = { t: 'keys', steps: [{ mod: 1, key: 0x04 }], delay: 0 };
  const sig = MP.signatureKeys(3, 2);
  const out = MP.withSignature(3, 2, a, { signature: true });
  assert.deepStrictEqual(out.steps, [{ mod: 0, key: sig[0] }, { mod: 0, key: sig[1] }, { mod: 1, key: 0x04 }]);
  assert.deepStrictEqual(a.steps, [{ mod: 1, key: 0x04 }], "l'azione originale non deve cambiare");
  assert.strictEqual(MP.withSignature(3, 2, a, { signature: false }), a);
});
test('firma: macro troppo lunga → errore esplicito; macro vuota non viene firmata', () => {
  const long = { t: 'keys', steps: Array(17).fill({ mod: 0, key: 0x04 }) };
  assert.throws(() => MP.withSignature(1, 1, long, { signature: true }), RangeError);
  const empty = { t: 'keys', steps: [] };
  assert.strictEqual(MP.withSignature(1, 1, empty, { signature: true }), empty);
});
test('firma: media e mouse (non eseguiti dal PC) restano invariati', () => {
  const vol = { t: 'media', usage: 0xEA };
  assert.strictEqual(MP.withSignature(4, 1, vol, { signature: true }), vol);
  const mouse = { t: 'mouse', buttons: 0, wheel: 1, mod: 0 };
  assert.strictEqual(MP.withSignature(7, 1, mouse, { signature: true }), mouse);
});
test('firma: il pacchetto inviato contiene firma + azione (count = passi)', () => {
  const frames = MP.encodeActionFrames(2, 1, { t: 'keys', steps: [{ mod: 1, key: 0x04 }] }, { signature: true });
  assert.strictEqual(frames.length, 1);
  const sig = MP.signatureKeys(2, 1);
  const h2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');
  assert.strictEqual(MP.hex(frames[0]), padded('FE 02 01 01 00 00 00 00 00 03 00 ' + h2(sig[0]) + ' 00 ' + h2(sig[1]) + ' 01 04'));
});
test('firma: controllo senza azione → solo firma, se richiesto; "disattiva" resta muto', () => {
  // identità "sensore": usage consumer riservato (le F13–F21 non arrivano in Bluetooth)
  const a = MP.withSignature(5, 3, null, { signature: true, signEmpty: true });
  assert.deepStrictEqual(a, { t: 'media', usage: MP.sensorUsage(5, 3) });
  assert.strictEqual(MP.withSignature(5, 3, null, { signature: true }), null);
  const clear = { t: 'clear' };
  assert.strictEqual(MP.withSignature(5, 3, clear, { signature: true, signEmpty: true }), clear);
  const frames = MP.encodeActionFrames(5, 3, null, { signature: true, signEmpty: true });
  assert.strictEqual(frames.length, 1);
  assert.strictEqual(frames[0][3], MP.TYPE.MEDIA);
  assert.strictEqual(frames[0][9], 1, 'un solo usage');
  assert.strictEqual(frames[0][11], MP.sensorUsage(5, 3));
  assert.deepStrictEqual(MP.encodeActionFrames(5, 3, null, { signature: true }), []);
});
test('isSigned riflette cosa viene davvero firmato', () => {
  assert.strictEqual(MP.isSigned({ t: 'keys', steps: [{ mod: 0, key: 4 }] }, { signature: true }), true);
  assert.strictEqual(MP.isSigned({ t: 'keys', steps: [{ mod: 0, key: 4 }] }, { signature: false }), false);
  assert.strictEqual(MP.isSigned({ t: 'media', usage: 0xEA }, { signature: true }), false);
  assert.strictEqual(MP.isSigned({ t: 'mouse', wheel: 1 }, { signature: true }), false);
});

/* ---- azioni media/mouse "eseguite dal PC" ---- */
const LAYOUT = { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9], knobs: [[13, 14, 15], [16, 17, 18], [19, 20, 21]] };
const prof = (l1, l2, l3) => ({ layers: [{ controls: l1 || {} }, { controls: l2 || {} }, { controls: l3 || {} }] });
const volDown = { t: 'media', usage: 0xEA }, volUp = { t: 'media', usage: 0xE9 }, mute = { t: 'media', usage: 0xE2 };

test('host: un solo controllo con quell\'azione → resta nativo', () => {
  const h = MP.hostedControls(prof({ 4: volDown, 5: volUp }, { 2: mute }), LAYOUT);
  assert.strictEqual(h.size, 0);
});
test('host: azione duplicata → resta nativo uno solo; si preferisce la rotazione, poi il tasto, poi la pressione', () => {
  // Volume − su tasto 4 (L1), rotazione ↺ manopola 1 (L1) e tasto 3 (L2): nativa la rotazione
  let h = MP.hostedControls(prof({ 4: volDown, 13: volDown }, { 3: volDown }), LAYOUT);
  assert.deepStrictEqual([...h.keys()].sort(), ['1:4', '2:3']);
  assert.deepStrictEqual(h.get('1:4'), { k: 'key', vk: 0xAE });
  // Muto su tasto 6, pressione manopola 1 e tasto 2 (L2): nativo il tasto 6 di L1 (layer e id più bassi tra i tasti)
  h = MP.hostedControls(prof({ 6: mute, 14: mute }, { 2: mute }), LAYOUT);
  assert.deepStrictEqual([...h.keys()].sort(), ['1:14', '2:2']);
});
test('host: rotella e pulsanti del mouse duplicati; usage non eseguibile → resta com\'è', () => {
  const w = { t: 'mouse', buttons: 0, wheel: 1, mod: 1 };
  const h = MP.hostedControls(prof({ 7: w, 8: { t: 'mouse', buttons: 1 } }, { 7: w, 8: { t: 'mouse', buttons: 1 } }), LAYOUT);
  assert.deepStrictEqual([...h.keys()].sort(), ['2:7', '2:8']);
  assert.deepStrictEqual(h.get('2:7'), { k: 'wheel', d: 120, m: 1 });
  assert.deepStrictEqual(h.get('2:8'), { k: 'btn', b: 1 });
  const odd = { t: 'media', usage: 0x9999 };
  assert.strictEqual(MP.hostedControls(prof({ 1: odd, 2: odd }), LAYOUT).size, 0);
});
test('host: il controllo eseguito dal PC invia SOLO la sua identità (usage consumer riservato)', () => {
  const o = { signature: true, hosted: MP.hostedControls(prof({ 4: volDown, 13: volDown }), LAYOUT) };
  const f = MP.encodeActionFrames(4, 1, volDown, o);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0][3], MP.TYPE.MEDIA);
  assert.strictEqual(f[0][11], MP.sensorUsage(4, 1));
  assert.notStrictEqual(f[0][11], 0xEA);
  // il controllo nativo resta un normale pacchetto media
  const n = MP.encodeActionFrames(13, 1, volDown, o);
  assert.strictEqual(n[0][3], MP.TYPE.MEDIA);
  assert.strictEqual(n[0][11], 0xEA);
  assert.strictEqual(MP.isSigned(volDown, o, 4, 1), true);
  assert.strictEqual(MP.isSigned(volDown, o, 13, 1), false);
});
/* ---- piano di firma automatico ---- */
const kA = { t: 'keys', steps: [{ mod: 0, key: 0x04 }] }, kB = { t: 'keys', steps: [{ mod: 0, key: 0x05 }] };
const kAB = { t: 'keys', steps: [{ mod: 0, key: 0x04 }, { mod: 0, key: 0x05 }] };
const ctrlA = { t: 'keys', steps: [{ mod: 0x01, key: 0x04 }] }, rctrlA = { t: 'keys', steps: [{ mod: 0x10, key: 0x04 }] };

test('piano: azioni uniche → nessuna firma (tasti normali, tenuta nativa)', () => {
  const p = MP.signPlan(prof({ 1: kA, 2: kB, 13: ctrlA }, { 1: kAB }), LAYOUT);
  // kA è inizio di kAB → conflitto: il secondo (kAB) prende la firma, kA resta normale
  assert.deepStrictEqual([...p.keys].sort(), ['2:1']);
});
test('piano: stessa azione in due layer → uno normale, l\'altro firmato (layer sempre corretto)', () => {
  const p = MP.signPlan(prof({ 1: kA }, { 1: kA }, { 5: kA }), LAYOUT);
  assert.deepStrictEqual([...p.keys].sort(), ['2:1', '3:5']);
  assert.strictEqual(p.keys.has('1:1'), false);          // resta normale il primo (layer più basso)
});
test('piano: Ctrl sinistro e destro sono la stessa azione; preferenza ai tasti sulla rotazione', () => {
  const p = MP.signPlan(prof({ 15: ctrlA, 3: rctrlA }), LAYOUT);
  assert.deepStrictEqual([...p.keys], ['1:15']);
});
test('piano: forzature per controllo e "firma tutto"', () => {
  const on = { t: 'keys', steps: kA.steps, sign: 'on' }, off = { t: 'keys', steps: kA.steps, sign: 'off' };
  assert.deepStrictEqual([...MP.signPlan(prof({ 1: on, 2: kB }), LAYOUT).keys], ['1:1']);
  // due controlli identici, uno forzato "mai": resta normale, l'altro si firma
  const q = MP.signPlan(prof({ 1: kA, 2: off }), LAYOUT);
  assert.deepStrictEqual([...q.keys], ['1:1']);
  const all = MP.signPlan(Object.assign(prof({ 1: kA, 2: kB }), { signAll: true }), LAYOUT);
  assert.deepStrictEqual([...all.keys].sort(), ['1:1', '1:2']);
});
test('piano: la macro viene firmata solo se nel piano; senza piano si firma sempre (compatibilità)', () => {
  const plan = MP.signPlan(prof({ 1: kA, 2: kA }), LAYOUT);
  const o = { signature: true, plan };
  assert.strictEqual(MP.encodeActionFrames(1, 1, kA, o)[0][9], 1);               // normale: una coppia
  assert.strictEqual(MP.encodeActionFrames(2, 1, kA, o)[0][9], 3);               // firmato: 2 + 1
  assert.strictEqual(MP.encodeActionFrames(1, 1, kA, { signature: true })[0][9], 3);
  assert.strictEqual(MP.isSigned(kA, o, 1, 1), false);
  assert.strictEqual(MP.isSigned(kA, o, 2, 1), true);
});
test('sensore: 72 usage riservati distinti, mai quelli che Windows interpreta; decodifica inversa', () => {
  const seen = new Set();
  const assigned = new Set([0x20, 0x21, 0x22, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x80, 0xB0, 0xB5, 0xB6, 0xCD, 0xE2, 0xE9, 0xEA, 0x192, 0x18A, 0x183]);
  for (let layer = 1; layer <= 3; layer++) for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21]) {
    const u = MP.sensorUsage(id, layer);
    assert(!seen.has(u), 'usage ripetuto ' + u);
    seen.add(u);
    assert(!assigned.has(u) && u > 0 && u < 0x80, 'usage non riservato ' + u);
    assert.deepStrictEqual(MP.decodeSensor(u), { layer, id });
  }
  assert.strictEqual(MP.decodeSensor(0xEA), null);
  assert.strictEqual(MP.SENSOR_USAGES.length, 72);
});
test('hold: tasto singolo → "Una volta" firma (tocco), "Ripeti" resta normale anche se duplicato', () => {
  const once = { t: 'keys', steps: kA.steps, hold: 'once' }, rep = { t: 'keys', steps: kA.steps, hold: 'repeat' };
  const p = MP.signPlan(prof({ 1: once, 2: kB, 3: rep, 4: rep }), LAYOUT);
  assert.deepStrictEqual([...p.keys].sort(), ['1:1']);           // 3 e 4 sono uguali ma entrambi "Ripeti": restano normali (scelta esplicita)
  const all = MP.signPlan(Object.assign(prof({ 1: kB, 2: rep }), { signAll: true }), LAYOUT);
  assert.deepStrictEqual([...all.keys], ['1:1']);                // "firma tutto" non toglie la ripetizione esplicita
});
test('hold: media/mouse con scelta esplicita sono eseguiti dal ponte; "Ripeti" porta la ripetizione', () => {
  const v = { t: 'media', usage: 0xE9, hold: 'repeat' }, v2 = { t: 'media', usage: 0xEA, hold: 'once' };
  const h = MP.hostedControls(prof({ 4: v, 5: v2, 6: mute }), LAYOUT);
  assert.deepStrictEqual([...h.keys()].sort(), ['1:4', '1:5']);   // 6 resta nativo (unico)
  assert.deepStrictEqual(h.get('1:4'), { k: 'key', vk: 0xAF, rep: { d: 450, r: 70 } });
  assert.deepStrictEqual(h.get('1:5'), { k: 'key', vk: 0xAE });
  const q = Object.assign(prof({ 4: v }), { repeat: { delay: 300, rate: 50 } });
  assert.deepStrictEqual(MP.hostedControls(q, LAYOUT).get('1:4').rep, { d: 300, r: 50 });
  const bad = Object.assign(prof({ 4: v }), { repeat: { delay: 5, rate: 99999 } });
  assert.deepStrictEqual(MP.hostedControls(bad, LAYOUT).get('1:4').rep, { d: 100, r: 500 });   // limiti
});
test('hold: un controllo con scelta esplicita non occupa il posto "nativo" del gruppo', () => {
  const v = { t: 'media', usage: 0xE9, hold: 'once' };
  const h = MP.hostedControls(prof({ 4: v, 5: { t: 'media', usage: 0xE9 } }), LAYOUT);
  assert.deepStrictEqual([...h.keys()], ['1:4']);                 // il tasto 5 resta nativo
});

test('vista live: usa il modulo di protocollo, nessuna copia della logica', () => {
  const live = fs.readFileSync(path.join(__dirname, '..', 'live.js'), 'utf8');
  for (const name of ['hostedControls', 'signPlan', 'sensorUsage', 'repeatOf', 'hostActionOf'])
    assert(!new RegExp('(function|const)\s+' + name + '\b').test(live), name + ' è duplicata in live.js: usare MP.' + name);
  assert(!/HOSTED-BEGIN/.test(live), 'blocco HOSTED duplicato in live.js');
});

console.log('\n' + passed + ' test superati' + (process.exitCode ? ' — CI SONO FALLIMENTI' : ''));
