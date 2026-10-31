/* dom.js — helper per il DOM, archiviazione locale e JSON. */

const NS = 'http://www.w3.org/2000/svg';
export const $ = (s, r = document) => r.querySelector(s);
export const h = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const k of kids.flat()) if (k) n.append(k);
  return n;
};
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
export const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* localStorage può mancare (finestra privata, dati bloccati) e un JSON può essere corrotto: la pagina funziona lo stesso,
   ma l'anomalia si segnala una volta in console invece di sparire in un catch vuoto. */
const warnOnce = (() => { const seen = new Set(); return (what, err) => { if (!seen.has(what)) { seen.add(what); console.warn(what + ':', err); } }; })();
export const parseJSON = (text, what) => { try { return JSON.parse(text); } catch (err) { warnOnce(what, err); return null; } };
export const storage = {
  read(key) { try { return parseJSON(localStorage.getItem(key) || 'null', 'dati salvati illeggibili (' + key + ')'); } catch (err) { warnOnce('localStorage non disponibile', err); return null; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { warnOnce('localStorage non disponibile', err); } },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const btn = (text, cls, fn, attrs) => { const b = el('button', Object.assign({ type: 'button', class: cls }, attrs || {}), text); b.addEventListener('click', fn); return b; };
