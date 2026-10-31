# Strumenti

Windows PowerShell 5.1 (`Add-Type` con compilatore C# 5) e Node.js. Gli strumenti di analisi in sola lettura stanno in
[`research/`](research/README.md).

| File | Cosa fa |
|---|---|
| `lib/PadDevice.ps1` | Funzione condivisa `Resolve-PadBleAddress` (vedi sotto). |
| `PadBridge.ps1` | **Ponte** locale: pubblica solo gli eventi del macropad su `127.0.0.1:5174/events` (SSE) per la vista live. Passivo, filtrato per VID, accetta solo l'origine dell'app. **Dalla v3 esegue** i controlli media/mouse con azione duplicata (solo se la pagina gli invia la mappa con `POST /hostmap`): tasti media/browser, un tick di rotella, un clic, con ripetizione opzionale a tasto tenuto; `-NoHost` lo disattiva. Si avvia con `start.cmd` nella radice. |
| `PadWrite.ps1` | Invia pacchetti all'interfaccia vendor (pagina `0xFF00`, report ID 3). **Senza `-Write` è una prova a secco.** |
| `profile-frames.js` | Converte un profilo esportato dall'app nei pacchetti del pad, con **lo stesso** modulo `app/protocol.js`. |
| `RawInputPad.ps1` | Cattura **passiva** degli eventi del macropad (per VID/indirizzo), con interfaccia; gli altri dispositivi sono solo contati e scartati. 45 s, nessun file. |

## Indirizzo Bluetooth del pad

Per riconoscere il collegamento wireless il ponte (e gli script BLE in `research/`) hanno bisogno dell'indirizzo BLE del pad.
Non è scritto nel codice: viene preso, in quest'ordine, da

1. `-BleAddress` (ponte e `RawInputPad.ps1`) oppure `-Address` (script BLE), 12 cifre esadecimali, con o senza `:`;
2. la variabile d'ambiente `MACROPAD_BLE_ADDRESS`;
3. la ricerca per nome fra i dispositivi già associati a Windows (`MINI_KEYBOARD`).

Se non lo trova, il ponte lavora solo in USB. Nessun altro dispositivo viene enumerato.

## Scrittura sul pad da riga di comando (USB)

* `profile-frames.js` — opzioni: `--signature` / `--no-signature`, `--sign-all`, `--no-host-actions`, `--no-sign-empty`, `--no-clear`,
  `--layers 1,2,3`. Senza opzioni usa le impostazioni salvate nel profilo.
* `PadWrite.ps1` — **senza `-Write` è una prova a secco** (trova il pad e stampa i pacchetti); con `-Write -IUnderstand` scrive.
  È configurazione (macro/LED), non firmware. Parametri: `-FramesFile`, `-GapMs` (pausa fra i pacchetti, predefinita 150 ms: a 40 ms il firmware perde gli ultimi).

```powershell
node tools\profile-frames.js "$env:USERPROFILE\Downloads\<profilo>.json" > $env:TEMP\frames.json
powershell -NoProfile -ExecutionPolicy Bypass -File tools\PadWrite.ps1 -FramesFile $env:TEMP\frames.json            # prova a secco
powershell -NoProfile -ExecutionPolicy Bypass -File tools\PadWrite.ps1 -FramesFile $env:TEMP\frames.json -Write -IUnderstand
```

## Grafo di conoscenza per gli agenti (opzionale)

Il repository funziona anche senza. Con [graphify](https://github.com/Graphify-Labs/graphify) (`uv tool install graphifyy`)
si genera in locale `graphify-out/` (grafo del codice e dei documenti, ignorato da git) così gli agenti rispondono con una query
invece di rileggere i file. Esclusioni in `.graphifyignore`.

| Comando | Cosa fa |
|---|---|
| `graphify update .` | aggiorna il grafo dopo modifiche al codice (solo AST, nessuna API) |
| `graphify extract . --code-only --force` poi `graphify cluster-only . --no-label` | ricostruzione completa e rapporto `GRAPH_REPORT.md` |
| `graphify query "domanda"` · `explain "X"` · `path "A" "B"` | interrogazione del grafo |
