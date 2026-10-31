/* keymap.js — tabelle tasto ↔ codici, nomi dei tasti e modificatori. */

/* ---------- tabelle ---------- */
export const U2VK = {};
for (let i = 0; i < 26; i++) U2VK[0x04 + i] = 65 + i;
for (let i = 0; i < 9; i++) U2VK[0x1E + i] = 49 + i;
U2VK[0x27] = 48;
Object.assign(U2VK, { 0x28: 13, 0x29: 27, 0x2A: 8, 0x2B: 9, 0x2C: 32, 0x2D: 189, 0x2E: 187, 0x2F: 219, 0x30: 221, 0x31: 220, 0x33: 186,
  0x34: 222, 0x35: 192, 0x36: 188, 0x37: 190, 0x38: 191, 0x39: 20, 0x46: 44, 0x47: 145, 0x48: 19, 0x49: 45, 0x4A: 36, 0x4B: 33, 0x4C: 46,
  0x4D: 35, 0x4E: 34, 0x4F: 39, 0x50: 37, 0x51: 40, 0x52: 38, 0x53: 144, 0x54: 111, 0x55: 106, 0x56: 109, 0x57: 107, 0x58: 13,
  0x62: 96, 0x63: 110, 0x65: 93 });
for (let i = 0; i < 12; i++) { U2VK[0x3A + i] = 112 + i; U2VK[0x68 + i] = 124 + i; }
for (let i = 0; i < 9; i++) U2VK[0x59 + i] = 97 + i;
/* firma univoca (stessa regola di MP.signatureKeys nel configuratore): n = (layer−1)·24 + (id−1), cifre in base 9 → F13+… */
export const sigSteps = (id, layer) => { const n = (layer - 1) * 24 + (id - 1); return [{ vk: 124 + Math.floor(n / 9), mods: 0 }, { vk: 124 + (n % 9), mods: 0 }]; };
export const isSigVk = (vk) => vk >= 124 && vk <= 132;                    // F13–F21
/* Logica del protocollo (piano di firma, azioni eseguite dal PC, identità "sensore"): esiste solo in protocol.js. */
export const { signPlan, hostedControls, sensorUsage } = MP;
export const CODE2VK = {};
for (let i = 0; i < 26; i++) CODE2VK['Key' + String.fromCharCode(65 + i)] = 65 + i;
for (let i = 0; i <= 9; i++) CODE2VK['Digit' + i] = 48 + i;
for (let i = 1; i <= 24; i++) CODE2VK['F' + i] = 111 + i;
Object.assign(CODE2VK, { Enter: 13, Escape: 27, Backspace: 8, Tab: 9, Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Insert: 45, Delete: 46 });
export const MEDIA_KEY = { AudioVolumeDown: 0xEA, AudioVolumeUp: 0xE9, AudioVolumeMute: 0xE2, MediaPlayPause: 0xCD, MediaTrackNext: 0xB5, MediaTrackPrevious: 0xB6 };
export const MEDIA_NAME = { 0xEA: 'Volume −', 0xE9: 'Volume +', 0xE2: 'Muto', 0xCD: 'Play/Pausa', 0xB5: 'Traccia succ.', 0xB6: 'Traccia prec.' };
const KEY_NAME = { 8: '⌫', 9: 'Tab', 13: 'Invio', 27: 'Esc', 32: 'Spazio', 33: 'Pag↑', 34: 'Pag↓', 35: 'Fine', 36: 'Home', 37: '←', 38: '↑', 39: '→', 40: '↓',
  45: 'Ins', 46: 'Canc', 20: 'Bloc Maiusc', 173: 'Muto', 174: 'Volume −', 175: 'Volume +' };
export const vkName = (vk) => KEY_NAME[vk] || (vk >= 65 && vk <= 90 ? String.fromCharCode(vk) : vk >= 48 && vk <= 57 ? String.fromCharCode(vk)
  : vk >= 112 && vk <= 135 ? 'F' + (vk - 111) : vk >= 96 && vk <= 105 ? 'Num ' + (vk - 96) : '0x' + vk.toString(16).toUpperCase());
/* codice tasto virtuale → bit del modificatore (1 Ctrl, 2 Maiusc, 4 Alt, 8 Win); 0 se non è un modificatore */
const MOD_BIT = { 17: 1, 162: 1, 163: 1, 16: 2, 160: 2, 161: 2, 18: 4, 164: 4, 165: 4, 91: 8, 92: 8 };
export const modBit = (vk) => MOD_BIT[vk] || 0;
export const hidMask = (m) => ((m & 0x11) ? 1 : 0) | ((m & 0x22) ? 2 : 0) | ((m & 0x44) ? 4 : 0) | ((m & 0x88) ? 8 : 0);
export const modLabel = (mask) => [mask & 1 && 'Ctrl', mask & 2 && 'Maiusc', mask & 4 && 'Alt', mask & 8 && 'Win'].filter(Boolean).join('+');
