'use strict';
// Converte un profilo esportato dal configuratore (JSON) nei pacchetti da inviare al pad, usando ESATTAMENTE il
// modulo di protocollo app/protocol.js (lo stesso della vista live). Non tocca il dispositivo: stampa JSON.
//
//   node tools/profile-frames.js <profilo.json> [--signature|--no-signature]
//        [--no-host-actions] [--sign-all] [--layers 1,2,3]
//
// Con la firma attiva i controlli SENZA azione ricevono la sola firma (disattivabile con --no-sign-empty).
// Uscita: array JSON di { label, hex } con hex = 64 byte del payload (il pad li riceve come report ID 3).
const fs = require('fs');

const MP = require('../app/protocol.js');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('uso: node tools/profile-frames.js <profilo.json> [--signature|--no-signature] [--layers 1,2,3]'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const profile = data.profile || data;
if (!profile || !Array.isArray(profile.layers) || profile.layers.length !== 3) { console.error('profilo non valido: servono 3 layer'); process.exit(2); }
const layout = data.layout && Array.isArray(data.layout.keys) && data.layout.keys.length === 9
  ? data.layout : { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9], knobs: [[13, 14, 15], [16, 17, 18], [19, 20, 21]] };

const li = args.indexOf('--layers');
const layers = li >= 0 ? args[li + 1].split(',').map(Number) : [1, 2, 3];
const opts = {
  signature: args.includes('--signature') ? true : args.includes('--no-signature') ? false : !!profile.signature,
  signEmpty: !args.includes('--no-sign-empty') && profile.signEmpty !== false,
};
if (!opts.signature) opts.signEmpty = false;
// media/mouse con azione duplicata: solo firma sul pad, azione eseguita dal ponte (PadBridge, /hostmap)
// piano di firma automatico: solo le azioni a tastiera che si confondono con altre ricevono la firma (--sign-all: tutte)
opts.plan = opts.signature ? MP.signPlan(Object.assign({}, profile, { signAll: args.includes('--sign-all') || !!profile.signAll }), layout) : null;
opts.hosted = opts.plan && !args.includes('--no-host-actions') && profile.hostActions !== false ? opts.plan.hosted : null;

const ids = [...layout.keys, ...layout.knobs.flat()];
const name = (id) => (id <= 12 ? 'Tasto ' + id : 'Manopola ' + (Math.floor((id - 13) / 3) + 1) + ' · ' + ['↺', 'premi', '↻'][(id - 13) % 3]);
const out = [];
for (const n of layers) {
  const L = profile.layers[n - 1];
  if (L.led) out.push({ label: 'LED · L' + n, hex: MP.hex(MP.led(n, L.led.color, L.led.mode)) });
  for (const id of ids) {
    const a = (L.controls && L.controls[id]) || null;
    const list = MP.encodeActionFrames(id, n, a, opts);
    // al cambio di tipo il firmware conserva quello vecchio se non si azzera prima (come fa l'app ufficiale)
    if (opts.signature && !args.includes('--no-clear') && list.length && !(a && a.t === 'clear')) {
      out.push({ label: name(id) + ' · L' + n + ' · azzera', hex: MP.hex(MP.clear(id, n)) });
    }
    list.forEach((bytes, i) => out.push({ label: name(id) + ' · L' + n + (list.length > 1 ? (i === 0 ? ' · tasti' : ' · pausa') : ''), hex: MP.hex(bytes) }));
  }
}
// l'ultimo pacchetto di una scrittura lunga può andare perso sul pad reale: lo si ripete (è idempotente)
if (out.length) out.push({ label: out[out.length - 1].label + ' · ripasso', hex: out[out.length - 1].hex });
const options = Object.assign({}, opts, { plan: undefined, signedKeys: opts.plan ? [...opts.plan.keys].sort() : [], hosted: opts.hosted ? [...opts.hosted.keys()].sort() : [] });
process.stdout.write(JSON.stringify({ options, count: out.length, frames: out }, null, 1) + '\n');
