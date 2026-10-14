# Macropad 9 tasti + 3 manopole — rapporto di analisi

*Aggiornato il 15/10/2026 · Documenti correlati:
[`PROTOCOL.md`](PROTOCOL.md) (protocollo), [`HARDWARE.md`](HARDWARE.md) (PCB), [`../app/`](../app/README.md) (app).*

## In sintesi

| Domanda | Risposta | Certezza |
|---|---|---|
| **Modello esatto** | Nessun nome commerciale univoco: OEM generico della famiglia **"MINI KeyBoard"**. Sulla scheda è serigrafato **`ANXIN-@9KEY_3KNOB`**. Identificatori reali: **USB `1189:8833`**, nome Bluetooth **`MINI_KEYBOARD`**. "VT3" non compare in nessuna fonte pubblica. | Alta sugli ID · il nome commerciale originale non è recuperabile |
| **MCU** | **SoC Jieli (杰理).** Il controller BLE dichiara il Company ID Bluetooth SIG `0x05D6` = "Zhuhai Jieli technology" (letto dalla cache di Windows). Il modello esatto è ignoto: la marcatura di `U1` è abrasa. **Correzione:** le ipotesi iniziali (WCH, Telink) erano sbagliate. Dettagli in [`HARDWARE.md`](HARDWARE.md) §4. | Alta sul costruttore · il part number resta ignoto |
| **Programmazione via Bluetooth** | **Provata, senza esito**: in BLE manca la collezione HID vendor; il servizio vendor `AE40` (`AE41` write, `AE42` notify) **non ha eseguito** tre varianti di un frame LED e non notifica nulla. Si programma solo via USB. Dettagli e prove in [`BLUETOOTH.md`](BLUETOOTH.md) §6. | Media-alta |
| **Schematica** | Schema a blocchi ricavato dalle foto; **netlist no** (serve continuità). | Media |
| **Protocollo** | Decodificato: **18 controlli** (9 tasti + 3 manopole × 3 azioni) × **3 layer**, macro fino a 18 pressioni, media, mouse, LED. | Alta sulla struttura · da verificare su hardware: mappa fisica, mouse, modi LED |
| **Software originale sicuro?** | Sì, per analisi statica (§3). | Alta |
| **App custom** | Vista live + configuratore in [`app/`](../app/README.md) (HTML + WebHID) e ponte Raw Input in [`tools/`](../tools/README.md). **Verificati sul dispositivo**: [`PROTOCOL.md`](PROTOCOL.md) §10. | Alta |

## 1. Come si è arrivati a questa identificazione

1. **App ufficiale** (`MINI KeyBoard.exe`, .NET Framework 4, compilata 13/10/2022, v1.0.0.2), disassemblata
   in sola lettura (nessun codice eseguito). Cerca `VID 0x1189` con PID `0x8890, 0x8830–0x8833, 0x8810`.
2. **Cronologia Windows**: il dispositivo risulta `VID_1189&PID_8833` e, nel Bluetooth, `MINI_KEYBOARD`
   (indirizzo BLE di tipo *random statico*; non identifica il produttore).
3. **Descrittori USB reali** letti dalla porta del macropad (EP0 64 B, 2 interfacce HID, 100 mA).
4. **Fonti indipendenti** (repository community): stessa struttura di pacchetto; `1189:8833` elencato come
   protocollo "Extended" su `mi_00`.
5. **8 foto del PCB** (in [`images/pcb/`](images/pcb/)): serigrafia della scheda, LED, pulsante Layer, batteria, cristallo, chip senza marcatura.

Venditori che rivendono hardware simile (non verificato che sia identico): Vikye,
Sanpyl, BRIMFORD, Koolertron; SikaiCase pubblica lo stesso `MINI KeyBoard.exe` per altri modelli.

## 2. Hardware (riassunto; dettaglio e foto in [`HARDWARE.md`](HARDWARE.md))

* **Alimentazione:** USB-C + **batteria LiPo** a sacchetto, interruttore **ON/OFF** a slitta; percorso di
  alimentazione discreto (`Q2`, `A19T`). Il carica-batteria non è stato identificato.
* **Controlli:** 9 switch MX (`KEY1`–`KEY9`, a righe dall'alto-sinistra), 3 encoder EC11 con pulsante,
  pulsante **"Layer"** (cambia layer; L1/L2/L3 sono tre LED indicatori).
* **LED:** 16 RGB (`RGB1`–`RGB9` per tasto, `RGB13`–`15` indicatori di layer, `RGB16`); `RGB10`–`12` non montati
  → il PCB è una versione a 9 tasti di un design a 12.
* **Radio:** BLE con antenna a pista sul bordo; cristallo 24 MHz.
* **Dispositivo USB:** 1.10 full-speed, bus-powered 100 mA; IF0 = HID vendor `0xFF00` con **Report ID 3 da 64 byte**
  (configurazione); IF1 = tastiera (ID 1), mouse (ID 2), seconda tastiera (ID 4), consumer (ID 5).

## 3. Il software originale: è sicuro?

Analisi statica del codice IL (nessuna esecuzione):

| Controllo | Esito |
|---|---|
| Rete (`System.Net`, socket, web client) | **assente** |
| Registro di sistema / persistenza | **assente** |
| Caricamento dinamico (`Assembly.Load`, reflection, `Activator`) | **assente** |
| Esecuzione di processi | **una sola chiamata**: apre un URL (`cnblogs.com/…/4504855.html`, blog cinese su HID in C#) quando clicchi *About* |
| Scrittura file | solo `errorLog.txt` accanto all'exe |
| P/Invoke | solo API HID/SetupAPI (`hid.dll`, `setupapi`, `kernel32`) + `SetProcessDPIAware` |
| Privilegi richiesti | `asInvoker` (non chiede amministratore) |
| `app.publish\MINI KeyBoard.exe` vs `MINI KeyBoard.exe` | **IL identico**; differiscono 7 byte di header e 1008 byte di firma ClickOnce (certificato autofirmato) |
| `HidLibrary.dll` | nessun riferimento a rete, processi, registro, scrittura file, reflection-emit |
| `Theraot.Core.dll` | libreria di compatibilità .NET (2017): nessun riferimento a rete/processi/registro/scrittura file; usa `Reflection.Emit.DynamicMethod` (normale per le sue backport). Non confrontata byte per byte con l'originale |

Antivirus e VirusTotal possono segnalarlo come "hackertool" generico perché parla HID a basso livello.
Il residuo di rischio è la catena di fornitura del file; avendolo già analizzato non serve più eseguirlo.
`errorLog.txt` (19/11/2023): solo un'eccezione `Dispose()` alla chiusura del form.

## 4. Incognite

| # | Incognita | Come si risolve |
|---|---|---|
| 1 | ~~Quale ID corrisponde a quale tasto/manopola~~ — **RISOLTO il 12/10/2026**: `KEYn` = ID n; manopole 13–15 (alta), 16–18 (centrale), 19–21 (grande) | verificato sul pad con la procedura guidata |
| 2 | ~~Verso sinistra/destra delle manopole~~ — **RISOLTO**: sinistra → primo ID del trio, destra → terzo | idem |
| 3 | ~~Posizione byte del **mouse** (ufficiale vs rOzzy1987 differiscono di 1 byte)~~ — **RISOLTO**: layout standard verificato | [`PROTOCOL.md`](PROTOCOL.md) §10 |
| 4 | ~~Usage media ≥ 0x100 e codici F13–F24 accettati dal firmware~~ — **RISOLTO**: F13–F21 accettati in USB (in BLE non arrivano) | [`PROTOCOL.md`](PROTOCOL.md) §10 |
| 5 | ~~Semantica dei **modi LED**~~ — **RISOLTO**: modi 0–5, 10 e 11 provati | [`PROTOCOL.md`](PROTOCOL.md) §10 |
| 6 | Modello esatto del **SoC Jieli** | marcatura abrasa; non necessario per la programmazione USB |
| 7 | **Configurazione attuale non leggibile**: protocollo write-only → scrivere sovrascrive | conservare il profilo esportato dall'app |
| 8 | ~~Il firmware salva a ogni `0xFE`~~ — **CONFERMATO il 12/10/2026**: azioni e LED restano dopo lo scollegamento | — |
| 9 | ~~Configurazione via Bluetooth~~ — **provata, senza esito**: si programma solo via USB | [`BLUETOOTH.md`](BLUETOOTH.md) |

Risolto con le foto: *come si cambia layer* → pulsante **"Layer"** serigrafato sulla scheda
(non è un selettore USB/BT: lo slide è **ON/OFF**).

## 5. Stato

Protocollo decodificato e verificato su hardware (USB), configuratore e vista live funzionanti, ponte Raw Input per distinguere il
pad dalla tastiera del PC. Il Bluetooth non programma il pad ma i controlli funzionano e si riconoscono anche in wireless.
Punti aperti e idee: sezione *Roadmap* del [`README`](../README.md).

## Fonti

* [kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool) — tool open source per la stessa famiglia (PID 8890/8840/8842).
* [rOzzy1987/MacroPad](https://github.com/rOzzy1987/MacroPad) — configuratore C# (GPL-3.0); `config.txt` include `1189:8833`.
* [Probler-Yt/MacroPad](https://github.com/Probler-Yt/MacroPad) — implementazione Linux per `1189:8840`.
* [jonnytest1/minikeyboard](https://github.com/jonnytest1/minikeyboard) — copia del software per `1189:8890` e note sulla numerazione.
* [SikaiCase – guida software](https://sikaicase.com/blogs/support/setting-for-software) — stesso `MINI KeyBoard.exe` per altri modelli.
