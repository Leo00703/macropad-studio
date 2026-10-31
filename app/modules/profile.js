/* profile.js — profilo → firme riconoscibili, riepilogo delle azioni, colore LED del layer. */
import { storage } from './dom.js';
import { LED_CSS, LED_DEFAULT, LED_NAME } from './geometry.js';
import { iconCap, iconFor } from './icons.js';
import { MEDIA_NAME, U2VK, hidMask, modLabel, sensorUsage, sigSteps, signPlan, vkName } from './keymap.js';
import { wheel } from './recognition.js';
import { DEFAULT_LAYOUT, S, STORE } from './state.js';

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
export const KIND_NAME = { keys: 'Tastiera', media: 'Media', wheel: 'Rotella del mouse', button: 'Pulsante del mouse' };
export function load() {
  const raw = storage.read(STORE);
  S.store = raw && raw.profile && Array.isArray(raw.profile.layers) ? raw : null;
  S.layout = raw && raw.layout && Array.isArray(raw.layout.keys) && raw.layout.keys.length === 9 ? raw.layout : DEFAULT_LAYOUT;
  S.sigs = [];
  S.hosted = new Map();
  S.plan = null;
  if (!S.store) return;
  S.signed = !!S.store.profile.signature;
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
        // Windows scarta i codici tastiera di volume (0x7F–0x81): il controllo media si riconosce dall'evento media + layer + durata
        S.sigs.push(Object.assign({}, base, { kind: 'media', usage: a.usage }));
      } else if (a.t === 'mouse') {
        if (a.wheel) S.sigs.push(Object.assign(base, { kind: 'wheel', dir: Math.sign(a.wheel), mods: hidMask(a.mod || 0) }));
        else if (a.buttons) S.sigs.push(Object.assign(base, { kind: 'button', button: a.buttons & 1 ? 'left' : a.buttons & 2 ? 'right' : 'middle' }));
      }
    }
  });
}
export function ledInfo(L) {
  const lay = S.store && S.store.profile.layers[L - 1];
  const c = lay && lay.led && lay.led.color;
  const m = lay && lay.led ? lay.led.mode : 1;
  if (m === 5) return { css: LED_CSS[0], name: 'Bianco' };           // "Tutti bianchi": il colore scelto non conta
  if (typeof c === 'number' && LED_CSS[c]) return { css: LED_CSS[c], name: LED_NAME[c] };
  return { css: LED_DEFAULT[L - 1] || LED_DEFAULT[1], name: L === 1 ? 'Verde' : 'Bianco' };   // di fabbrica: layer 1 verde, 2 e 3 bianchi
}
