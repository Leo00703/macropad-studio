# Macropad Studio – app

Vista live e configuratore per il macropad **9 tasti + 3 manopole** (USB `1189:8833`). Un'unica pagina
[`live.html`](live.html) (con [`live.js`](live.js)) mostra il pad in tempo reale, lo configura e lo programma via **WebHID**; il
protocollo è in [`protocol.js`](protocol.js) (funzioni pure, testate). Nessuna dipendenza, nessuna fase di build.

> Il macropad non si può leggere: ogni invio sovrascrive la configurazione di quel controllo e layer. Il profilo salvato
> nel browser (esportabile in JSON) è l'unica copia.

## Avvio

| Modo | Come |
|---|---|
| **Vista live completa (consigliato)** | doppio clic su [`../start.cmd`](../start.cmd): avvia il ponte (eventi del solo macropad), un server locale e la pagina `http://localhost:5173/live.html` |
| Solo browser, senza ponte | `python -m http.server 5173 --bind 127.0.0.1 --directory app` dalla radice del repository, poi `http://localhost:5173/live.html`; senza ponte non distingue il pad dalla tastiera |
| Test | `npm test` (da `app/`) – solo Node, nessuna dipendenza |

Serve Chrome o Edge (WebHID). Il ponte è [`../tools/PadBridge.ps1`](../tools/PadBridge.ps1). Mantieni la porta `5173`: il browser
associa a quell'indirizzo il permesso WebHID e il profilo salvato, e il ponte accetta solo quell'origine.

## Come si usa

1. **Clic su un tasto o una manopola** → scheda con l'azione assegnata nei tre layer → **Modifica**.
2. **Cosa fa:** Tastiera (registra dalla tastiera o dal pad, scegli un tasto con i modificatori, scrivi un testo, pausa),
   Media, Mouse, Nessuna o Disattiva. In fondo, i **dettagli tecnici** (pacchetti esatti).
3. **Tenuto premuto:** ripeti finché è premuto oppure una volta per pressione.
4. **LED** (scheda in alto a destra): colore ed effetto per layer.
5. **Impostazioni** (in alto a destra): firma automatica, esecuzione sul PC dei media/mouse duplicati, controlli senza azione,
   ripetizione, **esporta/importa** il profilo.
6. **Da inviare al pad** (in basso a sinistra): con il cavo USB, un solo pulsante scrive i controlli cambiati.
7. L'indicatore accanto a "LIVE" mostra come è collegato il pad: USB, wireless o non collegato.

## Profilo di prova

[`profiles/diagnostico-layer1.json`](profiles/diagnostico-layer1.json): una azione diversa e innocua per ognuno dei 18
controlli. Si carica da **Impostazioni → Importa**.

## Struttura

* `live.html`, `live.css` — struttura e stili della pagina.
* `live.js` — punto d'ingresso: controlla che `protocol.js` ci sia e carica `modules/main.js`.
* `modules/` — l'applicazione, in moduli ES. `core/` è puro e senza DOM (`mp`, `state`, `keymap`, `icon-map`, `signatures`, `matching`, `frames`, `geometry`) e non importa mai `ui/`; si prova con Node. `ui/` contiene il codice che usa il DOM: `pad` (disegno), `recognition` (riconoscimento degli eventi), `editor`, `inspector`, `send` (WebHID), `leds`, `settings`, `bridge`… `main.js` collega gli eventi della pagina. Con `live.html?debug` la pagina espone `window.__live` per la diagnostica.
* `protocol.js` — protocollo: codifica dei pacchetti, firma automatica, identità "sensore", azioni eseguite dal PC.
* `fonts/` — Google Sans (variabile) con la sua licenza OFL.
* `profiles/` — profilo di prova.
* `test/protocol.test.js` — verifica gli esempi di [`../docs/PROTOCOL.md`](../docs/PROTOCOL.md) e che i moduli non ricopino la logica di `protocol.js`; `test/modules.test.mjs` — prove dei moduli puri.

Il protocollo è documentato in [`../docs/PROTOCOL.md`](../docs/PROTOCOL.md), l'hardware in [`../docs/HARDWARE.md`](../docs/HARDWARE.md).
