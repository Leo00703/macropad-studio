/* effects.js — sfondo ambientale, vetro con rifrazione e texture procedurali. */
import { $, REDUCE_MOTION, h } from './dom.js';
import { ripple } from './pad.js';

/* ---------- 1: sfondo ambientale ----------
   Campo di punti con una lenta onda diagonale e un'onda che parte dal controllo usato.
   Opacità basse, nessun gradiente colorato; con "Riduci movimento" resta una griglia statica. */
export const Bg = (() => {
  const cv = $('#bg'), ctx = cv.getContext('2d');
  const STEP = 20, MAG_R = 210, PUSH = 9;
  let W = 0, H = 0, cx = 0, cy = 0, cols = 0, rows = 0, ox0 = 0, oy0 = 0;
  let dotRGB = [255, 255, 255], accRGB = [41, 151, 255], ledRGB = [52, 216, 107];
  let offX = new Float32Array(0), offY = new Float32Array(0);
  const mouse = { x: -9999, y: -9999, on: false, t: 0 };
  const ripples = [];
  let running = false, lastDraw = 0, settling = false;
  const nums = (v) => v.split(',').map((n) => Number(n.trim()));
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  function colors() {
    const cs = getComputedStyle(document.documentElement);
    const d = nums(cs.getPropertyValue('--dot-rgb') || ''), a = nums(cs.getPropertyValue('--accent-rgb') || '');
    if (d.length === 3 && d.every((v) => !isNaN(v))) dotRGB = d;
    if (a.length === 3 && a.every((v) => !isNaN(v))) accRGB = a;
    const l = hex(cs.getPropertyValue('--led')); if (l) ledRGB = l;
  }
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / STEP) + 1; rows = Math.ceil(H / STEP) + 1;
    ox0 = (W - (cols - 1) * STEP) / 2; oy0 = (H - (rows - 1) * STEP) / 2;
    offX = new Float32Array(cols * rows); offY = new Float32Array(cols * rows);
    const f = $('#pad .frost');
    const r = f ? f.getBoundingClientRect() : null;
    cx = r && r.width ? r.left + r.width / 2 : W / 2;
    cy = r && r.height ? r.top + r.height / 2 : H / 2;
    colors();
    draw(performance.now());
    kick();
  }
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    const R2 = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 0.95;
    const t = REDUCE_MOTION ? 0 : ts;
    const sweepPos = REDUCE_MOTION ? -9999 : ((ts / 38) % (W + H + 900)) - 450;
    const magnet = mouse.on && !REDUCE_MOTION;
    let maxOff = 0;
    for (let iy = 0; iy < rows; iy++) {
      const y = oy0 + iy * STEP, yn = y / H;
      for (let ix = 0; ix < cols; ix++) {
        const i = iy * cols + ix, x = ox0 + ix * STEP;
        // effetto del puntatore (come Stitch): repulsione morbida e dissolvenza, senza cambiare colore
        let tx = 0, ty = 0, mag = 0;
        if (magnet) {                                           // i punti si allontanano dal puntatore e si spengono
          const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
          if (d < MAG_R) {
            const k = 1 - d / MAG_R;
            mag = k * k * (3 - 2 * k);
            if (d > 0.01) { tx = dx / d * PUSH * mag; ty = dy / d * PUSH * mag; }
          }
        }
        offX[i] += (tx - offX[i]) * 0.17; offY[i] += (ty - offY[i]) * 0.17;
        const o = Math.abs(offX[i]) + Math.abs(offY[i]);
        if (o > maxOff) maxOff = o;
        const d0 = Math.hypot(x - cx, y - cy) / R2;
        let a = 0.07 + 0.16 * Math.max(0, 1 - d0 * d0);           // più fitto attorno al pad, svanisce ai bordi
        let r = 1.05;
        // aurora in basso: i punti prendono il colore del LED del layer
        const b1 = Math.exp(-Math.pow((yn - (0.80 + 0.05 * Math.sin(x * 0.0042 + t * 0.00035))) / 0.17, 2));
        const b2 = Math.exp(-Math.pow((yn - (0.96 + 0.04 * Math.sin(x * 0.0061 - t * 0.00028))) / 0.12, 2)) * 0.85;
        const f = Math.min(1, b1 + b2) * (0.55 + 0.45 * Math.sin(x * 0.0031 + t * 0.0002 + 1.3));
        let col = dotRGB;
        if (f > 0.02) { col = mix(dotRGB, ledRGB, Math.min(0.9, f * 0.95)); a += f * 0.26; }
        let boost = 0;
        if (!REDUCE_MOTION) {
          const p = (x + y) * 0.7071 - sweepPos * 0.7071;
          a += 0.06 * Math.exp(-(p * p) / 26000);
          for (const rp of ripples) {
            const dd = Math.hypot(x - rp.x, y - rp.y);
            const k = 1 - Math.abs(dd - rp.r) / 95;
            if (k > 0) boost = Math.max(boost, k * k * rp.fade * rp.s);
          }
        }
        if (boost > 0.015) {
          col = mix(col, accRGB, Math.min(1, boost * 1.1));
          a = Math.min(0.95, a + boost * 0.6);
          r += boost * 1.5;
        }
        if (mag > 0) { a *= 1 - 0.8 * mag; r *= 1 - 0.3 * mag; }
        ctx.fillStyle = 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x + offX[i], y + offY[i], r, 0, 6.2832); ctx.fill();
      }
    }
    settling = maxOff > 0.04;
  }
  function frame(ts) {
    if (document.hidden) { running = false; return; }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i], age = ts - rp.t0;
      rp.r = age * 0.62; rp.fade = Math.max(0, 1 - age / 1200);
      if (age > 1200) ripples.splice(i, 1);
    }
    const active = (mouse.on && ts - mouse.t < 1600) || ripples.length > 0 || settling;
    if (ts - lastDraw >= (active ? 14 : 66)) { lastDraw = ts; draw(ts); }
    requestAnimationFrame(frame);
  }
  function kick() { if (!running && !REDUCE_MOTION) { running = true; requestAnimationFrame(frame); } }
  function ripple(x, y, s) {
    if (REDUCE_MOTION) return;
    ripples.push({ x, y, s: s || 1, t0: performance.now(), r: 0, fade: 1 });
    if (ripples.length > 6) ripples.shift();
    kick();
  }
  function setLed(css) { const l = hex(css); if (l) { ledRGB = l; kick(); } }
  window.addEventListener('resize', size);
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; mouse.t = performance.now(); kick(); }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = false; kick(); });
  window.addEventListener('blur', () => { mouse.on = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors(); draw(performance.now()); });
  return { size, ripple, setLed };
})();
/* ---------- vetro con rifrazione ai bordi (solo Chromium) ----------
   Una mappa di spostamento per ogni superficie flottante: ai bordi lo sfondo viene "piegato" verso l'interno.
   Altrove resta un semplice blur con riflesso dal CSS. */
export const Glass = (() => {
  const ok = !!window.chrome && !matchMedia('(prefers-reduced-transparency: reduce)').matches;
  let defs = null, n = 0;
  function mapURL(w, hh, radius, bezel) {
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const g = c.getContext('2d');
    const img = g.createImageData(w, hh), d = img.data;
    const rr = Math.min(radius, w / 2, hh / 2);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5, py = y + 0.5;
        const qx = Math.abs(px - w / 2) - (w / 2 - rr), qy = Math.abs(py - hh / 2) - (hh / 2 - rr);
        const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
        const depth = -(out + Math.min(Math.max(qx, qy), 0) - rr);
        let dx = 0, dy = 0;
        if (depth < bezel) {
          let nx, ny;
          if (qx > 0 || qy > 0) { nx = Math.sign(px - w / 2) * Math.max(qx, 0) / (out || 1); ny = Math.sign(py - hh / 2) * Math.max(qy, 0) / (out || 1); }
          else if (qx > qy) { nx = Math.sign(px - w / 2); ny = 0; } else { nx = 0; ny = Math.sign(py - hh / 2); }
          const t = Math.max(0, 1 - depth / bezel);
          const m = t * t;
          dx = -nx * m; dy = -ny * m;
        }
        const i = (y * w + x) * 4;
        d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  function attach(elm, radius, bezel, scale) {
    if (!ok || !elm) return;
    if (!defs) {
      const svg = h('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute;pointer-events:none' });
      defs = h('defs'); svg.append(defs); document.body.append(svg);
    }
    const id = 'rf' + (++n);
    const image = h('feImage', { x: 0, y: 0, width: 10, height: 10, preserveAspectRatio: 'none', result: 'map' });
    const f = h('filter', { id, x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' },
      image,
      h('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: scale || 22, xChannelSelector: 'R', yChannelSelector: 'G' }));
    defs.append(f);
    let key = '', timer = 0;
    const apply = () => {
      const w = Math.round(elm.offsetWidth), hh = Math.round(elm.offsetHeight);
      if (!w || !hh || key === w + 'x' + hh) return;
      key = w + 'x' + hh;
      image.setAttribute('width', w); image.setAttribute('height', hh);
      image.setAttribute('href', mapURL(w, hh, radius, bezel || 18));
    };
    elm.style.setProperty('--rf', 'url(#' + id + ')');
    elm.classList.add('refract');
    new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 60); }).observe(elm);
    apply();
  }
  return { attach };
})();

/* ---------- 2: texture procedurali (una volta sola) ---------- */
export const Tex = (() => {
  let seed = 20261012;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function canvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; }
  /* acrilico satinato: grana finissima */
  function plateGrain() {
    const S2 = 192, c = canvas(S2, S2), g = c.getContext('2d');
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * S2, y = rnd() * S2, s = 2 + rnd() * 3;
      const light = rnd() > 0.5;
      g.fillStyle = (light ? 'rgba(255,255,255,' : 'rgba(60,70,84,') + (0.015 + rnd() * 0.035).toFixed(3) + ')';
      g.fillRect(x, y, s, s);
    }
    return c.toDataURL();
  }
  /* disco di alluminio tornito: due strisce speculari opposte che si allargano dal centro (riflesso conico) */
  function brushed(radius, hlDeg) {
    const px = Math.round(radius * 4), c = canvas(px, px), g = c.getContext('2d'), r = px / 2;
    g.translate(r, r);
    g.save();
    g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.clip();
    g.fillStyle = '#0a0b0d'; g.fillRect(-r, -r, px, px);
    if (g.createConicGradient) {
      g.rotate(hlDeg * Math.PI / 180);
      const cg = g.createConicGradient(0, 0, 0);
      const W = 'rgba(255,255,255,', B = 'rgba(120,150,185,', D = 'rgba(30,38,50,';
      const stops = [
        [0.000, W + '1)'], [0.010, B + '.75)'], [0.045, D + '.55)'], [0.16, D + '.12)'], [0.30, D + '0)'], [0.42, D + '.10)'],
        [0.455, D + '.45)'], [0.490, B + '.6)'], [0.500, W + '.85)'], [0.510, B + '.6)'], [0.545, D + '.45)'], [0.58, D + '.10)'],
        [0.70, D + '0)'], [0.84, D + '.12)'], [0.955, D + '.55)'], [0.990, B + '.75)'], [1.000, W + '1)'],
      ];
      for (const [p, col] of stops) cg.addColorStop(p, col);
      g.fillStyle = cg; g.fillRect(-r, -r, px, px);
      g.rotate(-hlDeg * Math.PI / 180);
    }
    // solchi circolari della tornitura
    for (let i = 0; i < 220; i++) {
      g.strokeStyle = 'rgba(255,255,255,' + (0.015 + rnd() * 0.045).toFixed(3) + ')';
      g.lineWidth = 0.6 + rnd();
      g.beginPath(); g.arc(0, 0, rnd() * r, 0, 6.2832); g.stroke();
    }
    // leggera vignettatura verso il bordo
    const vg = g.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.40)');
    g.fillStyle = vg; g.fillRect(-r, -r, px, px);
    g.restore();
    return c.toDataURL();
  }
  return { plateGrain: plateGrain(), brushed };
})();
