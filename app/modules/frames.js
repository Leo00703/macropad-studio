/* frames.js — pacchetti da inviare al pad per un profilo e confronto con quanto già inviato. Funzioni pure: nessun DOM. */

/* valore di un controllo che non si può codificare (es. macro troppo lunga); il motivo sta in `errors` */
export const UNENCODABLE = '!non-codificabile';

/* opzioni di codifica ricavate dal profilo */
export function encodeOptions(profile, layout) {
  const signature = !!profile.signature;
  const plan = signature ? MP.signPlan(profile, layout) : null;
  return { signature, signEmpty: signature && profile.signEmpty !== false, plan, hosted: plan && profile.hostActions !== false ? plan.hosted : null };
}

/* pacchetti di un controllo (senza "azzera"), in esadecimale e separati da "|" */
export function controlHex(profile, opts, layer, id) {
  const a = profile.layers[layer - 1].controls[id] || null;
  return MP.encodeActionFrames(id, layer, a, opts).map((b) => MP.hex(b)).join('|');
}

/* → { hex: { "layer:id" | "led:layer": esadecimale | UNENCODABLE }, errors: Map "layer:id" → messaggio } per tutto il profilo */
export function frameHexMap(profile, layout) {
  const opts = encodeOptions(profile, layout);
  const ids = [...layout.keys, ...layout.knobs.flat()];
  const hex = {}, errors = new Map();
  for (let L = 1; L <= 3; L++) {
    for (const id of ids) {
      const key = L + ':' + id;
      try { hex[key] = controlHex(profile, opts, L, id); } catch (err) { errors.set(key, err.message); hex[key] = UNENCODABLE; }
    }
  }
  for (let L = 1; L <= 3; L++) {
    const led = profile.layers[L - 1].led;
    hex['led:' + L] = led && typeof led.color === 'number' ? MP.hex(MP.led(L, led.color, led.mode | 0)) : '';
  }
  return { hex, errors };
}

/* Controlli il cui codice è cambiato rispetto all'istantanea dell'ultimo invio (`snap`, può essere null).
   Le chiavi nuove rispetto all'istantanea (es. i LED, aggiunti dopo) si considerano già sul pad. → { pending, snap, grew } */
export function pendingKeys(cur, snap) {
  const known = snap || {};
  let grew = false;
  for (const k of Object.keys(cur)) if (known[k] === undefined && Object.keys(known).length) { known[k] = cur[k]; grew = true; }
  return { pending: Object.keys(cur).filter((k) => cur[k] !== (known[k] || '')), snap: known, grew };
}
