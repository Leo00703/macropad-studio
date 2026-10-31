/* signatures.js — dal profilo alle "firme" che la vista live sa riconoscere. Funzioni pure: nessun DOM, nessuno stato condiviso. */
import { iconCap, iconFor } from './icon-map.js';
import { MEDIA_NAME, U2VK, hidMask, modLabel, sensorUsage, sigSteps, signPlan, vkName } from './keymap.js';

/* testo breve di un'azione, per le etichette sul pad */
export function summarize(a) {
  if (!a) return '';
  if (a.t === 'keys') {
    const parts = (a.steps || []).map((s) => (modLabel(hidMask(s.mod || 0)) ? modLabel(hidMask(s.mod)) + '+' : '') + (s.key ? vkName(U2VK[s.key] || 0) : ''));
    return parts.every((x) => x.length === 1) ? parts.join('') : parts.join(' ');
  }
  if (a.t === 'media') return MEDIA_NAME[a.usage] || 'Media';
  if (a.t === 'mouse') {
    const m = modLabel(hidMask(a.mod || 0));
    if (a.wheel) return (m ? m + '+' : '') + 'Rotella ' + (a.wheel > 0 ? '↑' : '↓');
    const click = BUTTONS.find((b) => a.buttons & b.bit);
    return click ? click.name : 'Mouse';
  }
  return '';
}
/* pulsanti del mouse: bit HID, nome per le etichette e nome per le firme */
const BUTTONS = [{ bit: 1, name: 'Clic sinistro', key: 'left' }, { bit: 2, name: 'Clic destro', key: 'right' }, { bit: 4, name: 'Clic centrale', key: 'middle' }];
export const KIND_NAME = { keys: 'Tastiera', media: 'Media', wheel: 'Rotella del mouse', button: 'Pulsante del mouse' };

/* la firma riconoscibile di UN controllo in un layer (o null se non produce eventi riconoscibili) */
function signatureFor(a, layer, id, { plan, hosted, signEmpty }) {
  if (!a) {
    // controllo senza azione ma con la sola firma: premerlo identifica comunque controllo e layer
    return signEmpty ? { layer, id, label: '', delay: 0, signed: true, empty: true, kind: 'media', usage: sensorUsage(id, layer) } : null;
  }
  const base = { layer, id, label: summarize(a), icon: iconFor(a), cap: iconCap(a), delay: a.delay || 0, signed: false };
  if (hosted.has(layer + ':' + id) && (a.t === 'media' || a.t === 'mouse')) {
    // azione duplicata: il pad invia solo l'identità (usage riservato), l'azione la esegue il ponte sul PC
    return Object.assign(base, { kind: 'media', usage: sensorUsage(id, layer), signed: true, hosted: true });
  }
  if (a.t === 'keys') {
    const user = (a.steps || []).filter((s) => s.key).map((s) => ({ vk: U2VK[s.key], mods: hidMask(s.mod || 0) }));
    if (!user.length || !user.every((s) => s.vk)) return null;
    // firma solo dove serve (azione ripetuta su altri controlli/layer); altrimenti il tasto è "normale"
    const sg = !!(plan && plan.keys.has(layer + ':' + id));
    return Object.assign(base, { kind: 'keys', steps: sg ? sigSteps(id, layer).concat(user) : user, signed: sg });
  }
  // Windows scarta i codici tastiera di volume (0x7F–0x81): il controllo media si riconosce dall'evento media + layer + durata
  if (a.t === 'media') return Object.assign(base, { kind: 'media', usage: a.usage });
  if (a.t === 'mouse') {
    if (a.wheel) return Object.assign(base, { kind: 'wheel', dir: Math.sign(a.wheel), mods: hidMask(a.mod || 0) });
    if (a.buttons) return Object.assign(base, { kind: 'button', button: (BUTTONS.find((b) => a.buttons & b.bit) || BUTTONS[2]).key });
  }
  return null;
}

/* Dal profilo salvato e dal suo layout: opzioni di firma, piano di firma, azioni eseguite dal ponte e firme riconoscibili. */
export function deriveSignatures(store, layout) {
  const profile = store.profile;
  const signed = !!profile.signature;
  const signEmpty = signed && profile.signEmpty !== false;
  const plan = signed ? signPlan(profile, layout) : null;
  const hosted = plan && profile.hostActions !== false ? plan.hosted : new Map();
  const ids = [...layout.keys, ...layout.knobs.flat()];
  const sigs = [];
  profile.layers.forEach((L, li) => {
    for (const id of ids) {
      const sig = signatureFor(L.controls && L.controls[id], li + 1, id, { plan, hosted, signEmpty });
      if (sig) sigs.push(sig);
    }
  });
  return { signed, signEmpty, plan, hosted, sigs };
}
