# Macropad Studio

Web app (live view + configurator) and tools for a generic **9-key + 3-knob** macropad (USB `1189:8833`, BLE `MINI_KEYBOARD`,
Jieli SoC). UI language, code comments and in-depth docs are **Italian**; the READMEs are English/Italian.

## Where things are
| Path | Contents |
|---|---|
| `app/live.html`, `app/live.css`, `app/live.js` | page, styles and the entry point (loads `modules/main.js`) |
| `app/modules/` | the app as ES modules. `core/` is pure and DOM-free (`mp`, `state`, `keymap`, `icon-map`, `signatures`, `matching`, `frames`, `geometry`) and must never import `ui/`; `ui/` has the DOM code (`pad`, `recognition`, `editor`, `inspector`, `send`, `leds`, `settings`, `bridge`…); `main.js` wires the page events. After moving code between modules, imports are easy to get wrong: reload the page with `?debug` and watch the console |
| `app/protocol.js` | protocol (pure functions → `globalThis.MP`): packets, automatic signing, "sensor" identity, host-executed actions |
| `app/test/` | `protocol.test.js` (protocol, plus a guard that the modules keep no copy of protocol logic) and `modules.test.mjs` (pure modules); run both with `npm test` in `app/` |
| `tools/PadBridge.ps1` | local bridge: pad-only Raw Input → SSE on `127.0.0.1:5174`, runs "host" actions, USB/wireless status |
| `tools/PadWrite.ps1`, `tools/profile-frames.js` | CLI writes (dry run by default) and profile → packets |
| `tools/RawInputPad.ps1` | passive capture of pad events (diagnostics) |
| `tools/research/` | read-only reverse-engineering helpers (IL dump, HID/USB/GATT probes) |
| `docs/PROTOCOL.md` | protocol spec and **hardware verifications** (source of truth) · `DEVELOPMENT-LOG.md` history/decisions · `HARDWARE.md` · `BLUETOOTH.md` · `ANALYSIS.md` · `DESIGN.md` |
| `start.cmd` | launcher: bridge + local server (port 5173) + browser |

## Working rules
- The pad is **write-only**: every write overwrites that control's configuration. Do not write to the device (`PadWrite -Write`,
  WebHID send) unless the user asked; program over USB only (Bluetooth cannot program it).
- Touch **only** devices with `VID_1189` (or the pad's BLE address); do not enumerate or open other peripherals.
- Facts about the firmware are the ones verified in `docs/PROTOCOL.md`. Anything else is a hypothesis: say so.
- Protocol logic (encoding, signing plan, host actions, sensor identity) lives only in `protocol.js`; the modules use it through the global `MP`.
- No dependencies: plain HTML/JS; Node only for tests and `tools/profile-frames.js`.
- Never commit machine-specific data: BLE address, USB serial, local paths, vendor binaries (see `.gitignore`).

## Optional: knowledge graph (graphify)
`graphify-out/` and `.claude/` are generated locally and git-ignored. If `graphify-out/graph.json` exists, prefer
`graphify query "<question>"`, `graphify path "<A>" "<B>"` or `graphify explain "<concept>"` over grepping raw files; after code
changes run `graphify update .` (AST only, no API cost); after doc changes `/graphify --update`. Details in `tools/README.md`.
