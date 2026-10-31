// Test di regressione nel browser: serve app/, apre live.html in Chrome headless (Node ≥ 22: usa il WebSocket integrato),
// esegue una sequenza fissa di eventi simulati e di clic e confronta lo stato dopo ogni passo con browser.snapshot.json.
//
//   node app/test/browser.mjs              confronta con l'istantanea (esce con 1 se qualcosa è cambiato)
//   node app/test/browser.mjs --update     riscrive l'istantanea (dopo un cambiamento voluto del comportamento)
//
// Chrome si cerca in: variabile CHROME, percorsi comuni di Windows/macOS/Linux. Non serve il macropad e non scrive nulla
// sul dispositivo: gli eventi del pad sono simulati con window.__live.onEvent (la pagina li espone con ?debug).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..');
const snapshotFile = path.join(here, 'browser.snapshot.json');
const update = process.argv.includes('--update');

// ---------------------------------------------------------------- server statico e Chrome
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.normalize(path.join(appDir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'live.html'));
  if (!file.startsWith(appDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;

const chromeCandidates = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chromePath = chromeCandidates.find((p) => fs.existsSync(p));
if (!chromePath) { console.error('Chrome non trovato: imposta la variabile CHROME.'); process.exit(2); }
const debugPort = 9222 + Math.floor(Math.random() * 500);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'macropad-browser-test-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + debugPort,
  '--user-data-dir=' + profileDir, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cleanup(code) {
  chrome.kill(); server.close();
  await sleep(300);
  fs.rmSync(profileDir, { recursive: true, force: true });
  process.exit(code);
}

let target = null;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch('http://127.0.0.1:' + debugPort + '/json')).json()).find((t) => t.type === 'page'); } catch (_) { await sleep(200); }
}
if (!target) { console.error('Impossibile collegarsi a Chrome.'); await cleanup(2); }

// ---------------------------------------------------------------- protocollo CDP minimo
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('eccezione: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  // il ponte non gira nel test: i suoi errori di rete e la favicon mancante sono attesi
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/ERR_CONNECTION_REFUSED|favicon/.test(m.params.entry.text + (m.params.entry.url || ''))) errors.push('log: ' + m.params.entry.text);
});
const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) errors.push('valutazione: ' + r.result.exceptionDetails.text + ' in ' + expression.slice(0, 60));
  return r.result?.result?.value;
};

// ---------------------------------------------------------------- profilo di prova: duplicati, firme, media, mouse, due layer
const K = (mod, key) => ({ mod, key });
const keys = (...steps) => ({ t: 'keys', steps, delay: 0 });
const profile = {
  name: 'Regressione', signature: true, signEmpty: true, hostActions: true,
  layers: [
    { controls: { 1: keys(K(0, 6), K(0, 12), K(0, 4), K(0, 18)), 2: keys(K(1, 4)), 3: keys(K(2, 4)), 4: { t: 'media', usage: 0xEA }, 5: { t: 'media', usage: 0xE9 }, 6: { t: 'media', usage: 0xE2 },
      7: { t: 'mouse', buttons: 0, wheel: 1, mod: 0 }, 8: { t: 'mouse', buttons: 0, wheel: -1, mod: 0 }, 9: { t: 'mouse', buttons: 0, wheel: 1, mod: 1 },
      13: { t: 'media', usage: 0xEA }, 14: { t: 'media', usage: 0xE2 }, 15: { t: 'media', usage: 0xE9 }, 16: keys(K(0, 0x4B)), 17: keys(K(0, 0x4A)), 18: keys(K(0, 0x4E)) }, led: { color: 4, mode: 1 } },
    { controls: { 1: { t: 'media', usage: 0xCD }, 2: { t: 'media', usage: 0xE2 }, 3: { t: 'media', usage: 0xEA }, 4: keys(K(0, 6), K(0, 12), K(0, 4), K(0, 18)) }, led: { color: 1, mode: 4 } },
    { controls: {}, led: { color: 5, mode: 2 } },
  ],
};
const layout = { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9], knobs: [[13, 14, 15], [16, 17, 18], [19, 20, 21]] };

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.navigate', { url: origin + '/live.html?debug' });
await sleep(1500);
await evaluate(`localStorage.clear(); localStorage.setItem('macropad-studio.v1', ${JSON.stringify(JSON.stringify({ profile, layout }))}); true`);
await send('Page.navigate', { url: origin + '/live.html?debug' });
await sleep(2000);

// ---------------------------------------------------------------- passi
const snapshots = {};
async function snap(label) {
  await sleep(180);
  const state = await evaluate(`(() => { const L = window.__live; const down = [...L.ctrl.values()].filter((c) => c.el.classList.contains('down')).map((c) => c.id).sort((a, b) => a - b);
    return JSON.stringify({ down, layer: L.state.padLayer, detected: L.state.detected, sigs: L.state.sigs.length,
      hosted: [...L.state.hosted.keys()].sort(), last: (document.querySelector('#last') || {}).innerText,
      chips: [...document.querySelectorAll('.chip')].map((c) => c.innerText).join('|'), inspector: (document.querySelector('#inspector') || {}).innerText,
      sheets: ['send', 'leds', 'settings'].map((i) => { const e = document.getElementById(i); return e ? e.innerText : ''; }).join('~') }); })()`);   // niente etichette a tempo né dimensioni dell'SVG: variano da una esecuzione all'altra
  snapshots[label] = { hash: crypto.createHash('sha1').update(String(state)).digest('hex').slice(0, 12), state: JSON.parse(state || 'null') };
}
const pad = (o) => evaluate(`window.__live.onEvent(${JSON.stringify(o)}); true`);
let t = 1000;
async function tapKey(vk, hold = 60) { await pad({ type: 'key', vk, down: true, t }); t += hold; await pad({ type: 'key', vk, down: false, t }); t += 400; }
async function tapMedia(usage, hold = 60) { await pad({ type: 'media', usage, down: true, t }); t += hold; await pad({ type: 'media', usage, down: false, t }); t += 400; }
async function clickAt(point, what) {
  if (!point) { errors.push('clic: non trovato ' + what); return; }
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: point[0], y: point[1], button: 'left', clickCount: 1 });
}
const center = `const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];`;
const clickSelector = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; ${center} })()`).then((p) => clickAt(p, sel));
const clickControl = (id) => evaluate(`(() => { const e = window.__live.ctrl.get(${id}).el; ${center} })()`).then((p) => clickAt(p, 'controllo ' + id));
const clickText = (text) => evaluate(`(() => { const e = [...document.querySelectorAll('button, .chip, .tile, li, [role=button]')].find((x) => x.offsetParent !== null && (x.innerText || '').trim().startsWith(${JSON.stringify(text)})); if (!e) return null; ${center} })()`).then((p) => clickAt(p, text));

await snap('iniziale');
for (const vk of [67, 73, 65, 79]) await tapKey(vk, 20);
await snap('ciao');
await pad({ type: 'key', vk: 17, down: true, t }); await tapKey(65, 40); await pad({ type: 'key', vk: 17, down: false, t }); t += 300;
await snap('ctrl+a');
await tapMedia(0xEA, 70); await snap('volume-');
await tapMedia(0xE9, 0); await snap('volume+ (impulso)');
await tapMedia(0xE2, 90); await snap('muto');
await tapMedia(0xCD, 80); await snap('play (layer 2)');
await pad({ type: 'wheel', delta: 120 }); await snap('rotella su');
await pad({ type: 'button', button: 'left', down: true }); await pad({ type: 'button', button: 'left', down: false }); await snap('clic');
for (const vk of [33, 36, 34]) await tapKey(vk, 50);
await snap('pagina su, home, pagina giù');
await tapKey(81, 30); await snap('tasto non mappato');
await pad({ type: 'status', usb: true, ble: false }); await snap('stato usb');
await pad({ type: 'status', usb: false, ble: true }); await snap('stato ble');
await clickControl(1); await snap('selezione tasto 1');
await clickText('Modifica'); await snap('modifica');
await clickText('Media'); await snap('tipo media');
await clickText('Mouse'); await snap('tipo mouse');
await clickText('Tastiera'); await snap('tipo tastiera');
await clickText('Fine'); await snap('fine');
for (const [id, label] of [['#settingsBtn', 'impostazioni'], ['#ledCard', 'led'], ['#chipSend', 'invio']]) {
  await clickSelector(id); await snap(label);
  await clickSelector(id); await snap(label + ' chiusi');
}
for (const layer of ['Layer 2', 'Layer 3', 'Layer 1', 'Auto']) { await clickText(layer); await snap('layer ' + layer); }

// ---------------------------------------------------------------- confronto
let failed = errors.length > 0;
for (const e of errors) console.log('ERRORE  ' + e);
if (update) {
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshots, null, 1) + '\n');
  console.log('istantanea riscritta: ' + Object.keys(snapshots).length + ' passi');
} else {
  const expected = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  for (const label of new Set([...Object.keys(expected), ...Object.keys(snapshots)])) {
    const a = expected[label], b = snapshots[label];
    if (a && b && a.hash === b.hash) { console.log('  ok  ' + label); continue; }
    failed = true;
    console.log('FAIL  ' + label);
    if (a && b) for (const k of Object.keys(a.state)) if (JSON.stringify(a.state[k]) !== JSON.stringify(b.state[k])) console.log('      ' + k + ': atteso ' + JSON.stringify(a.state[k]).slice(0, 120) + ' · ottenuto ' + JSON.stringify(b.state[k]).slice(0, 120));
  }
  console.log('\n' + Object.keys(snapshots).length + ' passi' + (failed ? ' — CI SONO DIFFERENZE' : ' identici all\'istantanea'));
}
ws.close();
await cleanup(failed ? 1 : 0);
