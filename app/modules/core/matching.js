/* matching.js — abbinamento fra gli eventi ricevuti e le firme del profilo. Funzioni pure: nessun DOM, nessuno stato condiviso. */

/* firme a tastiera compatibili con la sequenza di tasti ricevuta finora (la sequenza può essere solo l'inizio della firma) */
export const matchKeySignatures = (sigs, seq) => sigs.filter((s) => s.kind === 'keys' && seq.length <= s.steps.length &&
  seq.every((b, i) => s.steps[i].vk === b.vk && s.steps[i].mods === b.mods));

/* Layer scelto per un evento che appartiene a uno o più layer (`layers`, senza duplicati).
   Un evento di un solo layer lo stabilisce. Se è ambiguo si usa, in quest'ordine: il layer FISICO già noto (NON quello
   visualizzato), il layer scelto dall'utente, quello rilevato, il primo. ctx = { padKnown, padLayer, layerMode, detected }. */
export function chooseLayer(layers, ctx) {
  if (layers.length === 1) return layers[0];
  if (ctx.padKnown && layers.includes(ctx.padLayer)) return ctx.padLayer;
  if (ctx.layerMode !== 'auto' && layers.includes(ctx.layerMode)) return ctx.layerMode;
  if (layers.includes(ctx.detected)) return ctx.detected;
  return layers[0];
}

/* controlli colpiti nel layer scelto; `maybe` se l'evento non basta a distinguerli */
export function hitsInLayer(cands, layer) {
  const use = cands.filter((c) => c.layer === layer);
  const ids = [...new Set(use.map((c) => c.id))];
  return { hits: ids.map((id) => ({ id, maybe: ids.length > 1 })), sig: use[0] };
}
