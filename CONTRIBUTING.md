# Contributing to Macropad Studio

Thanks for your interest! This is a small, dependency-free project, and most useful contributions are not code at all:
**reports from other hardware** and **corrections to the protocol notes** are worth as much as a pull request.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

| You have… | Do this |
|---|---|
| A macropad that is **not** the `1189:8833` unit used so far | Open a [hardware report](https://github.com/Leo00703/macropad-studio/issues/new?template=hardware_report.yml). Even "it does not work" is valuable; see [#8](https://github.com/Leo00703/macropad-studio/issues/8) |
| A bug | Open a [bug report](https://github.com/Leo00703/macropad-studio/issues/new?template=bug_report.yml) |
| An idea | Check the [Roadmap](README.md#roadmap) first, then open a [feature request](https://github.com/Leo00703/macropad-studio/issues/new?template=feature_request.yml) |
| A question | Start from the [docs](docs/README.md); if it is still open, file an issue labelled `question` |
| A vulnerability | **Do not** open an issue: follow [SECURITY.md](SECURITY.md) |

Issues labelled [`good first issue`](https://github.com/Leo00703/macropad-studio/labels/good%20first%20issue) and
[`help wanted`](https://github.com/Leo00703/macropad-studio/labels/help%20wanted) are the best places to start.
Comment on the issue before starting larger work so nobody duplicates it.

## Ground rules

These come from how the pad behaves and are not negotiable:

1. **The pad is write-only.** Every write overwrites that control's configuration in flash. Never add code that writes to the
   device without an explicit user action, and keep `tools/PadWrite.ps1` a dry run by default.
2. **Touch only the pad.** Tools may open only devices whose ID contains `VID_1189` (or the pad's own BLE address).
3. **Facts vs. hypotheses.** What was verified on hardware lives in [`docs/PROTOCOL.md`](docs/PROTOCOL.md). Anything else must be
   labelled as a hypothesis (the docs use **[DA VERIFICARE]**, "to be verified").
4. **One copy of the protocol.** Encoding, signing, host actions and sensor identity live only in `app/protocol.js`;
   UI modules use it through the global `MP`. A test fails if a module re-implements it.
5. **No dependencies** in the app: plain HTML, CSS and ES modules, no build step. Node is for tests only.
6. **No machine-specific data** in commits: BLE addresses, USB serial numbers, local paths, vendor binaries (see `.gitignore`).

## Development setup

You need Node.js ≥ 18 (≥ 22 for the browser test) and, for the full experience, Windows 10/11 with Chrome or Edge.
No `npm install` is needed.

```bash
git clone https://github.com/Leo00703/macropad-studio.git
cd macropad-studio

(cd app && npm test)                  # protocol examples, signing plan, one-copy guard, pure modules
(cd app && npm run test:browser)      # headless-Chrome regression (29 steps vs. browser.snapshot.json)
node tools/profile-frames.js app/profiles/diagnostico-layer1.json   # profile → packets, no device needed

(cd app && npm run serve)             # then open http://localhost:5173/live.html?debug
```

Open the page with `?debug` while developing: it exposes `window.__live` and makes missing imports easy to spot in the console.
The page works on any OS with a Chromium browser; only the **bridge** (`tools/PadBridge.ps1`) needs Windows PowerShell 5.1.

### Where code goes

| Path | Rule |
|---|---|
| `app/protocol.js` | Pure functions, no DOM, no HID. Covered by `app/test/protocol.test.js` |
| `app/modules/core/` | Pure and DOM-free; **must never import `ui/`**. Covered by `app/test/modules.test.mjs` |
| `app/modules/ui/` | DOM code. Each feature registers its own page listeners in an `init…` function called from `main.js` |
| `tools/` | PowerShell and Node tools; keep research helpers read-only in `tools/research/` |
| `docs/` | Documentation. Update [`PROTOCOL.md`](docs/PROTOCOL.md) first when behaviour on hardware changes |

If you change behaviour the browser test observes, review the diff and refresh the snapshot on purpose:
`npm run test:browser -- --update`.

## Pull requests

1. Fork, then branch from `main` (`fix/short-name`, `feat/short-name`, `docs/short-name`).
2. Keep a PR to **one concern**; small PRs get reviewed faster.
3. Add or update tests when you change `protocol.js` or a `core/` module.
4. For anything that touches the protocol, include the **hex packets** and, if you have a pad, **what you observed on it**
   (what you sent, what changed, firmware/board markings).
5. Update the docs and the [CHANGELOG](CHANGELOG.md) (`Unreleased` section) when users would notice the change.
6. Make sure `npm test` passes; CI also parses and compiles the PowerShell tools on Windows.

Commit messages: a short imperative summary (`Fix wheel repeat on layer 2`), optionally prefixed with a type
(`fix:`, `feat:`, `docs:`, `test:`, `ci:`, `refactor:`). The history is squashed or merged as-is; no strict format is enforced.

## Language

The UI strings, code comments and in-depth docs are currently **Italian**; the READMEs, issue templates and community files are
English. Contributions in either language are welcome, and translating the UI and docs is an open task
([#7](https://github.com/Leo00703/macropad-studio/issues/7)). Please write new top-level or community documentation in English.

## License

By contributing you agree that your work is released under the project's [MIT license](LICENSE).
Do not submit code copied from GPL-licensed projects or from the manufacturer's software.
