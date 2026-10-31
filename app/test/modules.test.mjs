// Test dei moduli puri della vista live (app/modules): nessun DOM, si eseguono con Node.
// Uso: node app/test/modules.test.mjs   (oppure npm test, da app/)
import assert from 'node:assert';
import { createRequire } from 'node:module';

createRequire(import.meta.url)('../protocol.js');            // espone il globale MP, come fa live.html

const { deriveSignatures, summarize } = await import('../modules/signatures.js');
const { matchKeySignatures, chooseLayer, hitsInLayer } = await import('../modules/matching.js');
const { frameHexMap, pendingKeys, UNENCODABLE } = await import('../modules/frames.js');
const { iconFor } = await import('../modules/icon-map.js');
const { hidMask, modBit, vkName } = await import('../modules/keymap.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { process.exitCode = 1; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

const LAYOUT = { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9], knobs: [[13, 14, 15], [16, 17, 18], [19, 20, 21]] };
const keys = (...steps) => ({ t: 'keys', steps: steps.map(([mod, key]) => ({ mod, key })), delay: 0 });
const prof = (layers, extra = {}) => ({ profile: Object.assign({ layers: layers.map((controls) => ({ controls, led: { color: 4, mode: 1 } })) }, extra), layout: LAYOUT });
const sigOf = (sigs, layer, id) => sigs.find((s) => s.layer === layer && s.id === id);

// ---- etichette e simboli ----
test('summarize: tasto singolo, scorciatoia, testo, media, rotella', () => {
  assert.strictEqual(summarize(keys([1, 0x04])), 'Ctrl+A');
  assert.strictEqual(summarize(keys([0, 0x06], [0, 0x0C], [0, 0x04], [0, 0x12])), 'CIAO');
  assert.strictEqual(summarize({ t: 'media', usage: 0xEA }), 'Volume −');
  assert.strictEqual(summarize({ t: 'mouse', wheel: 1, mod: 1 }), 'Ctrl+Rotella ↑');
  assert.strictEqual(summarize({ t: 'mouse', buttons: 2 }), 'Clic destro');
  assert.strictEqual(summarize(null), '');
});
test('iconFor: media, mouse, frecce e scorciatoie note; il resto resta testo', () => {
  assert.strictEqual(iconFor({ t: 'media', usage: 0xEA }), 'vol_down');
  assert.strictEqual(iconFor({ t: 'mouse', wheel: 1 }), 'wheel_up');
  assert.strictEqual(iconFor(keys([0, 0x4F])), 'arrow_right');
  assert.strictEqual(iconFor(keys([1, 0x06])), 'copy');
  assert.strictEqual(iconFor(keys([0, 0x04])), null);
  assert.strictEqual(iconFor(keys([0, 0x06], [0, 0x0C])), null);
});
test('modificatori: sinistro e destro sono equivalenti; vkName', () => {
  assert.strictEqual(hidMask(0x11), 1);
  assert.strictEqual(hidMask(0x22), 2);
  assert.strictEqual(modBit(162), 1);
  assert.strictEqual(modBit(65), 0);
  assert.strictEqual(vkName(65), 'A');
  assert.strictEqual(vkName(124), 'F13');
});

// ---- dal profilo alle firme ----
test('firme: azioni uniche restano normali (tenuta nativa), una per controllo con azione', () => {
  const { profile, layout } = prof([{ 1: keys([0, 0x04]), 2: keys([0, 0x05]), 4: { t: 'media', usage: 0xEA } }, {}, {}], { signature: true, signEmpty: false });
  const d = deriveSignatures({ profile }, layout);
  assert.strictEqual(d.sigs.length, 3);
  assert.strictEqual(sigOf(d.sigs, 1, 1).signed, false);
  assert.strictEqual(sigOf(d.sigs, 1, 1).kind, 'keys');
  assert.strictEqual(d.hosted.size, 0);
});
test('firme: la stessa azione in due layer → una resta normale, l\'altra porta la firma F13–F21 in testa', () => {
  const { profile, layout } = prof([{ 1: keys([0, 0x04]) }, { 3: keys([0, 0x04]) }, {}], { signature: true, signEmpty: false });
  const d = deriveSignatures({ profile }, layout);
  const normal = sigOf(d.sigs, 1, 1), signed = sigOf(d.sigs, 2, 3);
  assert.strictEqual(normal.signed, false);
  assert.strictEqual(normal.steps.length, 1);
  assert.strictEqual(signed.signed, true);
  assert.strictEqual(signed.steps.length, 3);                                  // 2 tasti di firma + A
  assert.ok(signed.steps.slice(0, 2).every((s) => s.vk >= 124 && s.vk <= 132));
});
test('firme: media duplicati → uno nativo, l\'altro riconosciuto dall\'identità "sensore" ed eseguito dal ponte', () => {
  const { profile, layout } = prof([{ 4: { t: 'media', usage: 0xEA }, 13: { t: 'media', usage: 0xEA } }, {}, {}], { signature: true, signEmpty: false });
  const d = deriveSignatures({ profile }, layout);
  assert.deepStrictEqual([...d.hosted.keys()], ['1:4']);                       // la rotazione (13) resta nativa
  const hosted = sigOf(d.sigs, 1, 4), native = sigOf(d.sigs, 1, 13);
  assert.strictEqual(hosted.hosted, true);
  assert.strictEqual(hosted.usage, MP.sensorUsage(4, 1));
  assert.strictEqual(native.usage, 0xEA);
  assert.ok(!native.hosted);
});
test('firme: controlli vuoti con la sola identità, se richiesto; senza firma nessuna firma e nessun piano', () => {
  const on = deriveSignatures(prof([{ 1: keys([0, 0x04]) }, {}, {}], { signature: true }), LAYOUT);
  assert.strictEqual(on.sigs.filter((s) => s.empty).length, 3 * 18 - 1);
  assert.strictEqual(sigOf(on.sigs, 3, 21).usage, MP.sensorUsage(21, 3));
  const off = deriveSignatures(prof([{ 1: keys([0, 0x04]) }, {}, {}], { signature: false }), LAYOUT);
  assert.strictEqual(off.plan, null);
  assert.strictEqual(off.sigs.length, 1);
  assert.strictEqual(off.signed, false);
});
test('firme: mouse (rotella e pulsanti) e azioni non riconoscibili', () => {
  const { profile, layout } = prof([{ 7: { t: 'mouse', wheel: -1, mod: 2 }, 8: { t: 'mouse', buttons: 4 }, 9: { t: 'mouse', buttons: 0, wheel: 0 }, 1: { t: 'clear' }, 2: keys([0, 0]) }, {}, {}]);
  const d = deriveSignatures({ profile }, layout);
  const w = sigOf(d.sigs, 1, 7), b = sigOf(d.sigs, 1, 8);
  assert.deepStrictEqual([w.kind, w.dir, w.mods], ['wheel', -1, 2]);
  assert.deepStrictEqual([b.kind, b.button], ['button', 'middle']);
  assert.strictEqual(sigOf(d.sigs, 1, 9), undefined);
  assert.strictEqual(sigOf(d.sigs, 1, 1), undefined);
  assert.strictEqual(sigOf(d.sigs, 1, 2), undefined);
});

// ---- riconoscimento ----
test('matchKeySignatures: una sequenza parziale combacia con l\'inizio di una firma', () => {
  const { profile, layout } = prof([{ 1: keys([0, 0x04]), 2: keys([0, 0x05], [0, 0x06]) }, { 3: keys([0, 0x04]) }, {}], { signature: true, signEmpty: false });
  const sigs = deriveSignatures({ profile }, layout).sigs;
  const a = { vk: 65, mods: 0 };
  assert.deepStrictEqual(matchKeySignatures(sigs, [a]).map((s) => s.id), [1]);                       // la A normale; quella del layer 2 è firmata
  assert.deepStrictEqual(matchKeySignatures(sigs, [{ vk: 66, mods: 0 }]).map((s) => s.id), [2]);     // inizio di B C
  assert.deepStrictEqual(matchKeySignatures(sigs, [{ vk: 66, mods: 0 }, { vk: 67, mods: 0 }]).map((s) => s.id), [2]);
  assert.deepStrictEqual(matchKeySignatures(sigs, [{ vk: 90, mods: 0 }]), []);
  assert.deepStrictEqual(matchKeySignatures(sigs, [{ vk: 66, mods: 1 }]), []);                       // modificatori diversi
});
test('chooseLayer: un solo layer vince; poi layer fisico, scelta dell\'utente, rilevato, primo', () => {
  const ctx = { padKnown: false, padLayer: 1, layerMode: 'auto', detected: 2 };
  assert.strictEqual(chooseLayer([3], ctx), 3);
  assert.strictEqual(chooseLayer([1, 2, 3], ctx), 2);                                                  // rilevato
  assert.strictEqual(chooseLayer([1, 3], ctx), 1);                                                     // nessuno dei due: il primo
  assert.strictEqual(chooseLayer([1, 3], Object.assign({}, ctx, { layerMode: 3 })), 3);               // scelta dell'utente
  assert.strictEqual(chooseLayer([1, 3], Object.assign({}, ctx, { layerMode: 3, padKnown: true, padLayer: 1 })), 1);   // il fisico ha la precedenza
  assert.strictEqual(chooseLayer([2, 3], Object.assign({}, ctx, { padKnown: true, padLayer: 1 })), 2);                 // fisico non fra i candidati
});
test('hitsInLayer: "maybe" quando più controlli condividono l\'evento', () => {
  const cands = [{ layer: 1, id: 4 }, { layer: 1, id: 13 }, { layer: 2, id: 4 }];
  assert.deepStrictEqual(hitsInLayer(cands, 1).hits, [{ id: 4, maybe: true }, { id: 13, maybe: true }]);
  assert.deepStrictEqual(hitsInLayer(cands, 2).hits, [{ id: 4, maybe: false }]);
  assert.deepStrictEqual(hitsInLayer(cands, 3).hits, []);
});

// ---- pacchetti e confronto col pad ----
test('frameHexMap: una voce per controllo × layer e per LED; i controlli vuoti hanno stringa vuota', () => {
  const { profile, layout } = prof([{ 1: keys([0, 0x04]) }, {}, {}], { signature: true, signEmpty: false });
  const { hex, errors } = frameHexMap(profile, layout);
  assert.strictEqual(Object.keys(hex).length, 3 * 18 + 3);
  assert.ok(hex['1:1'].startsWith('FE 01 01 01'));
  assert.strictEqual(hex['2:5'], '');
  assert.ok(hex['led:1'].startsWith('FE B0 01 08'));
  assert.strictEqual(errors.size, 0);
});
test('frameHexMap: una macro troppo lunga è UNENCODABLE con il suo motivo, gli altri controlli non ne risentono', () => {
  const long = keys(...Array.from({ length: 19 }, () => [0, 0x04]));
  const { profile, layout } = prof([{ 1: long, 2: keys([0, 0x05]) }, {}, {}]);
  const { hex, errors } = frameHexMap(profile, layout);
  assert.strictEqual(hex['1:1'], UNENCODABLE);
  assert.ok(/Troppe pressioni/.test(errors.get('1:1')));
  assert.ok(hex['1:2'].startsWith('FE 02 01 01'));
});
test('pendingKeys: nessuna istantanea → tutto ciò che non è vuoto; identica → niente; chiavi nuove già sul pad', () => {
  const cur = { '1:1': 'AA', '1:2': '', 'led:1': 'LL' };
  assert.deepStrictEqual(pendingKeys(cur, null).pending, ['1:1', 'led:1']);
  assert.deepStrictEqual(pendingKeys(cur, Object.assign({}, cur)).pending, []);
  const r = pendingKeys({ '1:1': 'BB', 'led:1': 'LL', 'led:2': 'MM' }, { '1:1': 'AA', 'led:1': 'LL' });
  assert.deepStrictEqual(r.pending, ['1:1']);                       // led:2 è nuova: si assume già sul pad
  assert.strictEqual(r.grew, true);
  assert.strictEqual(r.snap['led:2'], 'MM');
});

console.log('\n' + passed + ' test superati' + (process.exitCode ? ' — CI SONO FALLIMENTI' : ''));
