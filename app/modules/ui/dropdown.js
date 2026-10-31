/* dropdown.js — elenco a discesa nello stile dell'interfaccia. */
import { btn, el } from './dom.js';
import { pick } from './recognition.js';

/* elenco a discesa nello stile dell'interfaccia. La lista è flottante (fuori dalla scheda): aprendola la scheda non
   cambia altezza; si chiude con un clic fuori, Esc, scorrimento o ridimensionamento. */
export const ddOpen = new Set();
export function closeDropdowns() { for (const c of [...ddOpen]) c(); }
export function dropdown(items, cur, pick, label, placeholder) {
  const wrap = el('div', { class: 'dd' });
  const now = items.find((i) => i[0] === cur);
  const list = el('div', { class: 'dd-list', role: 'listbox' });
  let close = () => {};
  const head = btn(now ? now[1] : (placeholder || items[0][1]), 'dd-head', () => {
    if (ddOpen.has(close)) { close(); return; }
    closeDropdowns();
    const r = head.getBoundingClientRect();
    list.style.width = Math.round(r.width) + 'px'; list.style.left = Math.round(r.left) + 'px';
    const below = innerHeight - r.bottom - 14, above = r.top - 14;
    const up = below < 190 && above > below;
    list.style.maxHeight = Math.max(130, Math.min(300, up ? above : below)) + 'px';
    if (up) { list.style.top = 'auto'; list.style.bottom = Math.round(innerHeight - r.top + 6) + 'px'; }
    else { list.style.bottom = 'auto'; list.style.top = Math.round(r.bottom + 6) + 'px'; }
    document.body.append(list);
    wrap.classList.add('open'); head.setAttribute('aria-expanded', 'true');
    ddOpen.add(close);
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }, { 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label || '' });
  close = () => { ddOpen.delete(close); list.remove(); wrap.classList.remove('open'); head.setAttribute('aria-expanded', 'false'); };
  items.forEach(([k, text]) => list.append(btn(text, 'dd-item' + (k === cur ? ' on' : ''), () => { close(); pick(k); },
    { role: 'option', 'aria-selected': String(k === cur) })));
  wrap.append(head);
  return wrap;
}

/* un clic fuori, Esc o il ridimensionamento chiudono gli elenchi aperti */
export function initDropdowns() {
  window.addEventListener('pointerdown', (e) => { if (ddOpen.size && !e.target.closest('.dd-list, .dd-head')) closeDropdowns(); }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ddOpen.size) { e.stopPropagation(); closeDropdowns(); } }, true);
  window.addEventListener('resize', closeDropdowns);
}
