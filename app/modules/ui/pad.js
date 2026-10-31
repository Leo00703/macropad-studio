/* pad.js — disegno del pad (SVG) e animazione dei controlli. */
import { KEY_X, KEY_Y, KNOBS, OUTLINE, SCREWS } from '../core/geometry.js';
import { ctrl, knobEl, state } from '../core/state.js';
import { $, h } from './dom.js';
import { Bg, Tex } from './effects.js';
import { attachInteraction } from './inspector.js';
import { paintLabels } from './labels.js';

export function hotOf(c) { return c.el.querySelector(c.kind === 'knob' ? '.n-hot' : '.k-face'); }
export function ripple(c, s) {
  const hot = hotOf(c);
  if (!hot) return;
  const r = hot.getBoundingClientRect();
  Bg.ripple(r.left + r.width / 2, r.top + r.height / 2, s);
}

/* ---------- 2: disegno del pad ---------- */
const stopsOf = (arr) => arr.map(([o, c, a]) => h('stop', { offset: o, style: 'stop-color:' + c + (a != null ? ';stop-opacity:' + a : '') }));
/* gradienti, filtri e motivi usati dal disegno */
function buildDefs(svg) {
  const pat = (id, w, hh, href) => h('pattern', { id, patternUnits: 'userSpaceOnUse', width: w, height: hh },
    h('image', { href, x: 0, y: 0, width: w, height: hh, style: 'image-rendering:pixelated' }));
  svg.append(h('defs', {},
    h('linearGradient', { id: 'plate', x1: 0, y1: 0, x2: 0.55, y2: 1 }, stopsOf([[0, 'var(--plate-1)'], [1, 'var(--plate-2)']])),
    h('linearGradient', { id: 'plateEdge', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fff', 0.55], [0.5, '#fff', 0.08], [1, '#000', 0.35]])),
    h('linearGradient', { id: 'chrome', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fbfcfd'], [0.45, '#8f969f'], [0.7, '#e9edf1'], [1, '#6a7078']])),
    h('radialGradient', { id: 'skirt', cx: '30%', cy: '70%', r: '80%' }, stopsOf([[0, '#2a2c31'], [1, '#0e0f11']])),
    h('radialGradient', { id: 'bezel', cx: '45%', cy: '40%', r: '75%' }, stopsOf([[0, '#1e1f23'], [0.75, '#0a0a0c'], [1, '#020203']])),
    h('linearGradient', { id: 'bezelHl', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fff', 0], [0.55, '#fff', 0.05], [1, '#fff', 0.38]])),
    h('linearGradient', { id: 'faceCyl', x1: 0, y1: 0, x2: 1, y2: 0 }, stopsOf([[0, '#000', 0.45], [0.16, '#000', 0.12], [0.5, '#c4d2e6', 0.025], [0.84, '#000', 0.12], [1, '#000', 0.45]])),
    h('linearGradient', { id: 'faceTop', x1: 0, y1: 0, x2: 0, y2: 1 }, stopsOf([[0, '#c4d6ee', 0.045], [0.30, '#c4d6ee', 0.01], [0.72, '#000', 0.10], [1, '#000', 0.34]])),
    h('linearGradient', { id: 'faceBevel', x1: 0, y1: 0, x2: 1, y2: 1 }, stopsOf([[0, '#fff', 0.16], [0.45, '#fff', 0.02], [1, '#000', 0.55]])),
    h('linearGradient', { id: 'slope', x1: 0, y1: 0, x2: 0, y2: 1 }, stopsOf([[0, '#121419'], [0.38, '#090a0c'], [1, '#030304']])),
    h('clipPath', { id: 'plateClip' }, h('path', { d: OUTLINE })),
    /* Grana dei tasti: rumore frattale (feTurbulence) convertito in toni di grigio molto scuri, ritagliato sulla forma.
       È la tecnica del "grain" del vetro satinato, ma in nero: nessun puntino chiaro, solo variazione tonale morbida.
       La frequenza si adatta alla scala (fitGrain) per mantenere un granello di ~1,6 pixel. */
    h('filter', { id: 'keyGrain', x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' },
      h('feTurbulence', { id: 'keyTurb', type: 'fractalNoise', baseFrequency: 0.3, numOctaves: 2, seed: 11, result: 't' }),
      h('feColorMatrix', { in: 't', type: 'matrix', values: '0.26 0 0 0 -0.075  0.26 0 0 0 -0.075  0.26 0 0 0 -0.075  0 0 0 0 0.92', result: 'g' }),
      h('feComposite', { in: 'g', in2: 'SourceGraphic', operator: 'in' })),
    pat('grainPlate', 192, 192, Tex.plateGrain)));
}

/* ombra, strati inferiori, piastra acrilica, componenti in trasparenza e viti */
function buildPlate(svg) {
  // ombra a terra, luce LED sotto il pad, strati inferiori (base nera, PCB, spaziatore acrilico)
  svg.append(h('path', { class: 'shadow', d: OUTLINE, transform: 'translate(16 58)' }));
  svg.append(h('path', { class: 'under', d: OUTLINE, transform: 'translate(0 26)' }));
  svg.append(h('path', { class: 'stack-base', d: OUTLINE, transform: 'translate(0 30)' }));
  svg.append(h('path', { class: 'stack-pcb', d: OUTLINE, transform: 'translate(0 20)' }));
  svg.append(h('path', { class: 'stack-clear', d: OUTLINE, transform: 'translate(0 11)' }));
  // piastra acrilica satinata
  svg.append(h('path', { class: 'frost', d: OUTLINE }));
  svg.append(h('path', { d: OUTLINE, fill: 'url(#grainPlate)' }));
  svg.append(h('path', { class: 'frost-edge', d: OUTLINE }));
  // luce LED lungo il bordo del pad (dentro la sagoma)
  svg.append(h('g', { 'clip-path': 'url(#plateClip)', 'aria-hidden': 'true' },
    h('path', { class: 'edge-glow', d: OUTLINE }), h('path', { class: 'edge-line', d: OUTLINE })));

  // componenti visibili in trasparenza sotto la piastra (posizioni dalla foto)
  const ghost = h('g', { 'aria-hidden': 'true' },
    h('path', { class: 'under-plate', d: 'M365 8h95l-8 22h-80z' }),
    h('path', { class: 'under-plate', d: 'M645 13h95l-8 22h-80z' }),
    h('rect', { class: 'under-plate', x: 897, y: 57, width: 48, height: 38, rx: 9 }),
    h('rect', { class: 'under-plate out', x: 897, y: 57, width: 48, height: 38, rx: 9 }),
    [[873, 43], [970, 43], [873, 95], [970, 95]].map(([x, y]) => h('circle', { class: 'under-plate', cx: x, cy: y, r: 7, opacity: 0.2 })),
    h('rect', { class: 'led-pill', x: 820, y: 358, width: 70, height: 118, rx: 26 }),
    [1, 2, 3].map((n, i) => h('circle', { class: 'led', 'data-led': n, cx: 855, cy: 400 + i * 25, r: 7.5 })),
    [1, 2, 3].map((n, i) => h('text', { class: 'led-n', x: 902, y: 405 + i * 25 }, 'L' + n)),
    h('circle', { class: 'under-plate', cx: 985, cy: 556, r: 9, opacity: 0.28 }),
    [0, 1, 2].map((i) => h('rect', { class: 'under-plate', x: 1244, y: 300 + i * 82, width: 24, height: 60, rx: 8, opacity: 0.14 })));
  svg.append(ghost);

  // viti a croce
  for (const [x, y] of SCREWS) {
    svg.append(h('g', { transform: `translate(${x} ${y})` },
      h('circle', { class: 'screw-bg', r: 17 }),
      h('path', { class: 'screw-x', d: 'M-8 -2.5L8 2.5M-2.5 -8L2.5 8' })));
  }
}

/* un tasto: ombra, base, cappuccio con grana, etichetta e simbolo; si registra in ctrl */
function buildKey(svg, id, slot) {
  const cx = KEY_X[slot % 3], cy = KEY_Y[Math.floor(slot / 3)];
  const label = h('text', { class: 'k-label', y: -17 });
  const icon = h('g', { class: 'k-icon', transform: 'translate(0 -30) scale(3.6) translate(-12 -12)' });
  const g = h('g', { class: 'key', transform: `translate(${cx} ${cy})`, 'data-id': id, tabindex: 0, role: 'button' },
    h('rect', { class: 'k-led', x: -114, y: -116, width: 228, height: 240, rx: 38 }),
    h('rect', { class: 'k-shadow', x: -104, y: -98, width: 214, height: 232, rx: 22 }),
    h('path', { class: 'k-base', d: 'M-69 -101H69L95 -82V101H-95V-82Z' }),
    h('path', { d: 'M-69 -101H69L95 -82V101H-95V-82Z', fill: 'url(#slope)' }),
    h('path', { d: 'M-69 -101H69L95 -82V101H-95V-82Z', fill: '#000', filter: 'url(#keyGrain)', opacity: 0.85 }),
    h('path', { class: 'k-base-hl', d: 'M-69 -101H69L95 -82' }),
    h('path', { class: 'k-edge', d: 'M-95 -82V101M95 -82V101' }),
    h('g', { class: 'k-top' },
      h('rect', { class: 'k-face', x: -73, y: -108, width: 146, height: 163, rx: 13 }),
      h('rect', { x: -73, y: -108, width: 146, height: 163, rx: 13, fill: '#000', filter: 'url(#keyGrain)' }),
      h('rect', { x: -73, y: -108, width: 146, height: 163, rx: 13, fill: 'url(#faceTop)' }),
      h('rect', { x: -73, y: -108, width: 146, height: 163, rx: 13, fill: 'url(#faceCyl)' }),
      h('rect', { class: 'k-bevel', x: -71.5, y: -106.5, width: 143, height: 160, rx: 12 }),
      h('path', { class: 'k-lip-sh', d: 'M-66 58Q0 67 66 58' }),
      h('path', { class: 'k-lip', d: 'M-66 52Q0 61 66 52' }),
      h('rect', { class: 'k-glow', x: -73, y: -108, width: 146, height: 163, rx: 13 }),
      icon,
      label,
      h('text', { class: 'k-num', x: -61, y: -86 }, String(slot + 1))),
    h('rect', { class: 'k-sel', x: -114, y: -120, width: 228, height: 240, rx: 24 }));
  svg.append(g);
  ctrl.set(id, { id, kind: 'key', el: g, label, icon, slot });
}

/* una manopola con le sue tre azioni (↺, premi, ↻); si registra in ctrl e knobEl */
function buildKnob(svg, trio, k) {
  const K = KNOBS[k];
  const arrow = h('text', { class: 'n-arrow', y: -((K.bezel || K.disc + 6) + 30) });
  const spin = [];
  const body = h('g', { class: 'n-body' });
  if (K.sk) {
    const ribs = h('g', { class: 'n-spin' });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      ribs.append(h('line', { class: 'n-rib', x1: c * (K.sk.r - 24), y1: s * (K.sk.r - 24), x2: c * (K.sk.r - 5), y2: s * (K.sk.r - 5) }));
    }
    spin.push(ribs);
    body.append(h('g', { transform: `translate(${K.sk.dx} ${K.sk.dy})` }, h('circle', { class: 'n-skirt', r: K.sk.r }), ribs));
  } else {
    body.append(h('circle', { class: 'n-bezel', r: K.bezel }),
      h('circle', { class: 'n-bezel-hl', r: K.bezel - 4 }),
      h('circle', { class: 'n-step', r: K.disc + 8 }));
  }
  const m = K.mark, ma = m.a * Math.PI / 180;
  const mark = h('g', { class: 'n-spin' },
    h('line', { class: 'n-mark', style: `stroke-width:${m.w}`, x1: Math.cos(ma) * m.r0, y1: Math.sin(ma) * m.r0, x2: Math.cos(ma) * m.r1, y2: Math.sin(ma) * m.r1 }));
  spin.push(mark);
  const dim = K.disc;
  body.append(h('g', {},
    h('circle', { class: 'n-disc-bg', r: dim }),
    h('image', { href: Tex.brushed(dim, K.hl), x: -dim, y: -dim, width: dim * 2, height: dim * 2 }),
    K.ring ? h('circle', { class: 'n-ring', r: K.ring }) : h('circle', { class: 'n-ring', r: dim + 1, style: 'stroke-width:3' }),
    mark,
    h('circle', { class: 'n-hot', r: dim, fill: 'transparent' })));
  const g = h('g', { class: 'knob', transform: `translate(${K.x} ${K.y})`, 'data-knob': k, tabindex: 0, role: 'button' },
    h('ellipse', { class: 'n-shadow', cx: 16, cy: 26, rx: (K.bezel || K.sk.r) + 4, ry: (K.bezel || K.sk.r) - 4 }),
    body,
    h('circle', { class: 'n-sel', r: (K.bezel || K.sk.r) + 16 }), arrow);
  svg.append(g);
  knobEl[k] = g;
  [0, 1, 2].forEach((act) => ctrl.set(trio[act], { id: trio[act], kind: 'knob', knob: k, act, el: g, spin, arrow }));
}

export function buildPad() {
  const svg = $('#pad');
  state.sel = null;
  svg.replaceChildren();
  buildDefs(svg);
  buildPlate(svg);
  ctrl.clear();
  state.layout.keys.forEach((id, slot) => buildKey(svg, id, slot));
  state.layout.knobs.forEach((trio, k) => buildKnob(svg, trio, k));
  attachInteraction();
  paintLabels();
  fitGrain();
  Bg.size();
}

export function fitGrain() {
  const pad = $('#pad'), t = $('#keyTurb');
  if (!pad || !t) return;
  const hpx = pad.getBoundingClientRect().height;
  if (!hpx) return;
  const cssPerUnit = hpx / 1440;                              // pixel CSS per unità del viewBox
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // cicli per unità = (cicli per pixel dispositivo) × (pixel dispositivo per unità); periodo ≈ 1,7 pixel
  t.setAttribute('baseFrequency', (cssPerUnit * dpr / 1.7).toFixed(4));
}
