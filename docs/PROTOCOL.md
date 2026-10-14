# Protocollo di configurazione — USB `1189:8833` (famiglia "MINI KeyBoard")

> Stato: **ricavato per decompilazione** di `MINI KeyBoard.exe` v1.0.0.2, confrontato con tre fonti
> indipendenti (vedi §9) e **parzialmente verificato su hardware il 12/10/2026** (vedi §10).
> Le parti non ancora provate sul dispositivo sono marcate **[DA VERIFICARE]**.

## 1. Canale fisico

| Elemento | Valore (letto dai descrittori reali) |
|---|---|
| USB | 1.10, full-speed, `bMaxPacketSize0 = 64`, 1 configurazione, bus-powered 100 mA, remote-wakeup |
| Interfaccia 0 (`MI_00`) | HID 1.11, usage page `0xFF00` usage `0x01`. EP IN `0x84` + EP OUT `0x04`, interrupt, 64 B, 1 ms. **È il canale di configurazione.** |
| Interfaccia 1 (`MI_01`) | HID 1.01, EP IN `0x82` 16 B. Tastiera (ID 1), mouse (ID 2), tastiera NKRO-ish (ID 4), consumer (ID 5). È ciò che il PC "sente" quando premi un tasto. |
| Report di configurazione | **Report ID `3`**, 64 byte, identico in input e output |

Su Windows il buffer da scrivere è di **65 byte**: `[03][payload da 64 byte]`. L'app ufficiale
usa HidLibrary `WriteReport(report, timeout 500 ms)` sul percorso che contiene `mi_00`.
Via WebHID: `device.sendReport(3, payload64)`.

## 2. Pacchetto "assegna azione a un controllo"

Indici riferiti al **payload da 64 byte** (il Report ID `03` è davanti, fuori dal payload; sul filo sono tutti +1).
Tutto ciò che non è elencato è `0x00`.

| Byte | Contenuto | Note |
|---:|---|---|
| 0 | `0xFE` | comando "bind" |
| 1 | **ID controllo** | vedi §3. LED = `0xB0` |
| 2 | **layer** | 1..3 (base 1) |
| 3 | **tipo** | `1` tastiera, `2` media, `3` mouse, `5` **pausa (pacchetto separato)**, `8` LED |
| 4 | delay lo | ms, **solo nel pacchetto tipo 5** (0..6000) |
| 5 | delay hi | |
| 6–8 | `0` | |
| 9 | **count** | n. di coppie usate (vedi regola sotto) |
| 10.. | **payload** | coppie `(modificatore, codice)`; fino a 18 coppie (byte 10..45 usati dall'app ufficiale) |

**Regola del count** (app ufficiale): `count` = indice (base 1) dell'ultima coppia non vuota.
Eccezione: se la coppia 0 contiene *solo* un modificatore (codice = 0) conta 0 per quella coppia.
(rOzzy1987 usa una variante leggermente diversa: `(i>>1)+1` per ogni byte non nullo; differisce solo
nel caso "solo modificatore alla prima coppia".)

Il Report ID da usare l'app lo scopre provando `3`, poi `0`, poi `2` con un pacchetto di zeri
(`KeyBoardVersion_Check`); per questa interfaccia il descrittore dichiara solo `3`.

## 3. ID dei controlli

| ID | Controllo (numerazione dell'app) | Posizione fisica |
|---:|---|---|
| 1–12 | `KEY1`…`KEY12` | il software mostra sempre 12 tasti (3 colonne × 4 righe). Sul 9-tasti la corrispondenza è presumibilmente **1–9 a righe, dall'alto-sinistra**: la serigrafia del PCB (`KEY1`…`KEY9`, vedi `HARDWARE.md`) e le community (rOzzy1987 `9 buttons 2 knobs`, jonnytest1) vanno nello stesso senso. Che l'ID firmware coincida con la serigrafia resta **[DA VERIFICARE]** |
| 13 / 14 / 15 | `K1` sinistra / **pressione** / destra | manopola 1 |
| 16 / 17 / 18 | `K2` sinistra / pressione / destra | manopola 2 |
| 19 / 20 / 21 | `K3` sinistra / pressione / destra | manopola 3 |
| `0xB0` | pseudo-ID "LED" | tipo `8` |

"Sinistra/destra" = rotazione antioraria/oraria presumibilmente **[DA VERIFICARE]**; quale manopola
fisica sia K1/K2/K3 (dall'alto o dal basso?) **[DA VERIFICARE]**.
Nota: nella UI esistono anche `KEY13`…`KEY16` ma non hanno handler (inutilizzati).

## 4. Tipi e payload

### 4.1 Tastiera (tipo 1) e pausa (tipo 5, pacchetto separato)
Payload = sequenza di coppie `(modificatore, usage)` che il firmware riproduce in ordine.

* `usage` = **usage HID standard, pagina 0x07** (A=`04`, Z=`1D`, 1=`1E`, 0=`27`, Enter=`28`, Esc=`29`,
  Backspace=`2A`, Tab=`2B`, Space=`2C`, F1–F12=`3A`–`45`, frecce `4F`–`52`, keypad `53`–`63`, Menu=`65`).
  Tabella completa estratta dall'app: vedi `docs/keycodes.tsv`.
* `modificatore` = bitmask HID: `01` LCtrl, `02` LShift, `04` LAlt, `08` LGui, `10` RCtrl, `20` RShift, `40` RAlt, `80` RGui.
* L'app ufficiale non offre F13–F24 (`68`–`73`) né altri usage > `65`; il firmware potrebbe accettarli **[DA VERIFICARE]**
  — dal 14/10/2026 il configuratore li usa come "firma univoca" (F13–F21, `68`–`70`) in testa alle macro: vedi [`DEVELOPMENT-LOG.md`](DEVELOPMENT-LOG.md).
* **La pausa è un pacchetto a sé** (tipo 5): stessi ID e layer, byte 4–5 = ms little-endian (max 6000), **nessuna coppia,
  count 0**, da inviare **dopo** il pacchetto dei tasti. Un unico pacchetto di tipo 5 *con* le coppie **non** assegna i
  tasti: su hardware il controllo ha continuato a emettere la vecchia combinazione (§10). Conferme: nell'app ufficiale la
  pagina "Delay" azzera le coppie prima dell'invio (`Page_change_Clear → Set_Key_Init`), e `ch57x-keyboard-tool` documenta
  la pausa come pacchetto separato dopo quello dei tasti. Una pausa "0" sembra lecita (l'UI ufficiale ammette 0).

### 4.2 Media (tipo 2)
Payload = `[00, usage_lo, usage_hi?]`. L'app ufficiale invia solo usage < 0x100:

| Funzione | usage (pagina 0x0C) |
|---|---|
| Play/Pausa | `CD` |
| Traccia precedente | `B6` |
| Traccia successiva | `B5` |
| Muto | `E2` |
| Volume + | `E9` |
| Volume − | `EA` |

`usage_hi` (per usage ≥ 0x100, es. Calcolatrice `0192`) è **dedotto** da rOzzy1987 **[DA VERIFICARE]**.

### 4.3 Mouse (tipo 3)
Secondo l'app ufficiale (payload dal byte 10): `[00, bottoni, 00, 00, rotella, modificatore]`.

| Azione | bottoni | rotella | modificatore |
|---|---|---|---|
| Click sinistro | `01` | `00` | `00` |
| Click destro | `02` | | |
| Click centrale | `04` | | |
| Rotella su / giù | `00` | `01` / `FF` | `00` |
| Ctrl / Shift / Alt + rotella | `00` | `01`/`FF` | `01` / `02` / `04` |

⚠️ **[DA VERIFICARE]** rOzzy1987 colloca gli stessi campi *un byte prima* (`[bottoni, 0, 0, rotella, modificatore]`).
La differenza va risolta con un test su hardware prima di fidarsi.

### 4.4 LED (ID `0xB0`, tipo 8)
Payload = `[layer, codice]` con `codice = (colore << 4) | modo`.

| colore | 1 rosso | 2 arancio | 3 giallo | 4 verde | 5 ciano | 6 blu | 7 viola |
|---|---|---|---|---|---|---|---|
| modo | `0`…`5` — l'app li chiama solo "LED_Mode0…5"; semantica non nota **[DA VERIFICARE]** |

Il LED è impostato **per layer** (byte 2 = layer).

**Effetti verificati sul pad reale (15/10/2026, USB):**

| modo | effetto |
|---:|---|
| 0 | spento |
| 1 | fisso: retroilluminazione sempre accesa nel colore scelto |
| 2 | a ogni pressione (di qualunque tasto) i LED dei tasti si accendono in sequenza dal 1 al 9 |
| 3 | come il 2, dal 9 al 1 |
| 4 | si accende il tasto premuto e si spegne piano in ~0,5 s, una volta alla pressione e una al rilascio |
| 5 | tutti i LED bianchi, qualunque colore sia scelto |
| 10 | a ogni pressione i LED si accendono dal tasto 1 al 4 e tornano indietro fino al 1 |
| 11 | come il 4, ma netto (acceso/spento senza dissolvenza) |
| 6–9, 12–15 | si comportano come il modo 4 (alias) |

Colori: i codici 8–15 sono tutti bianchi (alias del bianco).

In **Bluetooth** i LED dei tasti restano spenti con gli effetti provati. Colore e modo sono due nibble (4 bit): modi 6–15 e colori
8–15 non sono usati dall'app ufficiale, la vista live li espone come "valori non documentati" per provarli.

## 5. Esempi (payload, senza Report ID; riempire con zeri fino a 64 byte)

```
Tasto 1, layer 1, tipo tastiera, "A":
  FE 01 01 01 00 00 00 00 00 01 | 00 04

Tasto 2, layer 1, Ctrl+C:
  FE 02 01 01 00 00 00 00 00 01 | 01 06

Manopola 1 pressione (ID 14), layer 1, Play/Pausa:
  FE 0E 01 02 00 00 00 00 00 01 | 00 CD

Tasto 3, layer 2, macro "ciao" con 50 ms di pausa = DUE pacchetti, in quest'ordine:
  1) FE 03 02 01 00 00 00 00 00 04 | 00 06  00 0C  00 04  00 12        (tasti, tipo 1)
  2) FE 03 02 05 32 00 00 00 00 00                                    (pausa 50 ms, tipo 5, count 0)

LED layer 1: colore verde (4), modo 1:
  FE B0 01 08 00 00 00 00 00 01 | 01 41
```

## 6. Sequenza completa osservata nell'app ufficiale (PID `0x8833`)

1. Enumerazione `VID 1189`, PID in ordine `8890, 8830, 8831, 8832, 8833, 8810`; richiede che il path contenga `mi_00` (per 8890: `mi_01`).
2. `KeyBoardVersion_Check`: invia un pacchetto di zeri con Report ID 3 (poi 0, poi 2). La risposta **non viene letta**.
3. Per ogni controllo modificato: **un solo** pacchetto `0xFE…` (§2). Poi mostra "Download success" se la scrittura HID è riuscita.
4. **Nessun comando di commit/flash** in questa variante (i comandi `AA AA`, `AA A1`, `A1 layer`
   esistono solo nel ramo "legacy" per PID 8890/8810). Ipotesi: il firmware salva a ogni `0xFE`.
5. **Nessuna lettura** della configurazione: il dispositivo è *write-only* dal punto di vista dell'app.
   La configurazione attuale non è recuperabile prima di sovrascriverla.

## 7. Protocollo "legacy" (solo PID 8890 / 8810 nell'app ufficiale)

Non riguarda `8833`; riportato per completezza. Un report per ogni pressione:
`[tasto, (layer<<4)|tipo, n_coppie, indice, mod, usage]`, poi `AA AA` (flash) ; LED `AA A1`; cambio layer `A1 layer`.

## 8. Cose che il protocollo NON fa (per quanto noto)
* Non legge la configurazione, né un identificativo/versione.
* Non imposta il Bluetooth (l'app lavora solo sull'interfaccia USB `MI_00`).
* Non cambia layer "a caldo" nel protocollo esteso: il layer attivo si cambia dal dispositivo con il
  pulsante **"Layer"** serigrafato sul bordo della scheda (L1/L2/L3 = `RGB13`–`RGB15` lo indicano) **[dedotto dalla serigrafia]**.

## 9. Fonti incrociate
* Decompilazione locale: `HIDTester.HidLib`, `FormMain.Download_Click`, `LEDkey`, `MULKey`, `MouseKey`, `BasicKeys`, `FunKey`, `Delay`.
* [kriomant/ch57x-keyboard-tool](https://github.com/kriomant/ch57x-keyboard-tool) — `k884x.rs` (stessa struttura `FE / key / layer / tipo`, LED `B0`/tipo 8, end-of-programming `AA AA` + `FD FE FF`).
* [rOzzy1987/MacroPad](https://github.com/rOzzy1987/MacroPad) — `config.txt` elenca `1189:8833` (34867), `mi_00`, "Extended"; `ExtendedReport.cs` per le posizioni dei byte.
* [Probler-Yt/MacroPad](https://github.com/Probler-Yt/MacroPad) — varianti `0xFD` (8840) e Report ID 3, numerazione knob da 0x10 su 8840.

## 10. Verifiche su hardware (12/10/2026, USB `1189:8833`, tramite l'app, layer 1)

Procedura: 18 pacchetti di tipo 1 (`FE <id> 01 01 00 00 00 00 00 01 00 <lettera>`), uno per controllo, distanziati di
40 ms; poi si è premuto ogni controllo e l'app ha letto la lettera ricevuta.

| Verificato | Esito |
|---|---|
| Canale: `sendReport(3, 64 byte)` sull'interfaccia `0xFF00` | **funziona** (WebHID, Edge) |
| Frame tipo 1 (tastiera), `count = 1`, coppia `(0, usage)` | **accettato ed eseguito**: ogni controllo emette la lettera assegnata |
| Nessun pacchetto di commit | **non necessario** perché la config sia attiva subito (la persistenza dopo spegnimento è da provare) |
| Pacing 40 ms tra pacchetti | sufficiente: nessuna perdita su 18 pacchetti |
| Numerazione tasti | **`KEYn` = ID n**, a righe dall'alto-sinistra: 1 2 3 / 4 5 6 / 7 8 9 |
| Numerazione manopole | alta = **13/14/15**, centrale = **16/17/18**, grande (in basso) = **19/20/21**; ordine **sinistra, pressione, destra** |
| Verso | rotazione a sinistra → ID 13/16/19; a destra → ID 15/18/21 |

Ancora **[DA VERIFICARE]**: persistenza dopo spegnimento; effetto percepibile della pausa; più pressioni; modificatori;
media (`EA/E9/E2`); mouse (posizioni dei byte: nell'app c'è il toggle "Byte alternativi"); modi LED; layer 2 e 3.
Profilo di prova pronto: `app/profiles/diagnostico-layer1.json`.

### 10.1 Seconda tornata (12/10/2026): programmazione di 3 layer con il profilo diagnostico

| Verificato | Esito |
|---|---|
| Tasti e manopole programmati con tastiera, media, mouse | **funzionano** |
| LED per layer | **funzionano** |
| Layer 1, 2, 3 programmati | **funzionano** |
| **Tipo 5 inviato con le coppie nello stesso pacchetto** (errore dell'app, ora corretto) | **non assegna i tasti**: il tasto 1, che doveva scrivere `ciao`, ha continuato a emettere `a` (la combinazione precedente) |

Correzione applicata: la pausa è un pacchetto separato (§4.1). Il comportamento del tasto 1 dopo l'invio dei due
pacchetti va ancora confermato sul pad.

### 10.2 Esito finale della verifica USB (12/10/2026)

* Dopo l'invio dei due pacchetti, il tasto 1 scrive **`ciao`**: la pausa come pacchetto separato è **confermata**.
* **Persistenza confermata**: scollegando e ricollegando il pad restano le azioni e i LED. Nessun comando di commit.
* Tutti i controlli dei 3 layer funzionano.

### 10.3 Verifica puntuale tramite monitor eventi (12/10/2026, app v0.4)

Eventi osservati dalla pagina con il profilo diagnostico (layout byte **standard**, nessun "Byte alternativi"):

* Media: `EA` → `AudioVolumeDown`, `E9` → `AudioVolumeUp`, `E2` → `AudioVolumeMute`: **verificati**.
* Mouse: rotella su, rotella giù e **Ctrl+rotella su**: **verificati** con le posizioni dell'app ufficiale
  `[0, bottoni, 0, 0, rotella, mod]` (il layout alternativo di rOzzy1987 non serve). Pulsanti del mouse (sx/centro/dx):
  **non provati**.
* Modificatori: Ctrl e Shift **verificati**. Tenendo premuto un tasto-rotella, il pad **ripete** la rotella.
* Manopole: ordine ↺ / premi / ↻ riconfermato per tutte e tre.

### 10.4 Firma univoca: esiti su hardware (14/10/2026)

| Verificato | Esito |
|---|---|
| F13–F21 (`68`–`70`) come tasti di una macro | **funzionano**: arrivano come tasti F13–F21, invisibili alle app; anche due tasti uguali di fila (`F15 F15`) escono correttamente |
| Volume/Muto come tasti tastiera (`81`/`80`/`7F`) | **Windows li scarta**: nessun evento di tastiera e il volume non cambia (la firma arriva, il resto no). Il volume funziona solo come tipo media (pagina 0x0C) |
| Cambiare tipo (media → tastiera) senza azzerare | il firmware **conserva il tipo vecchio**: serve un pacchetto tipo `0` (azzera) prima, come fa l'app ufficiale al cambio pagina |
| Scrittura lunga a 40 ms (112 pacchetti) | gli **ultimi controlli scritti** (layer 3, manopola grande) restavano senza azione: pacing portato a 120–150 ms, LED prima dei controlli e ripasso dell'ultimo pacchetto |

| Tipo 2 (media) con più usage (`count` 2–3, coppie `00 E9 00 EA …`) | **solo il primo usage esce**: ogni pressione emette un unico report consumer. Nessun modo di mettere firma + volume nello stesso controllo |

Conseguenza: i controlli media (volume, play/pausa) e mouse **non** possono portare la firma; la vista live li riconosce
dall'evento, dal layer fisico (dedotto dai controlli firmati) e dalla durata (impulso = manopola, pressione = tasto).

### 10.5 Bluetooth (14/10/2026, cattura passiva con il pad in wireless)

| Verificato | Esito |
|---|---|
| Windows in BLE | enumera mouse (`COL01`), tastiera (`COL02`), consumer (`COL03`) e batteria, tutti OK; Raw Input li vede (il nome contiene l'indirizzo BLE) |
| Tasti normali (frecce) in BLE | **arrivano** |
| Pulsanti del mouse in BLE | **arrivano** |
| Consumer (Play/Pausa) in BLE | **arriva**, come `03 <lo> <hi>` (ID report 3, in USB è 5) |
| **F13–F21 (firma tastiera) in BLE** | **NON arrivano**: il descrittore tastiera wireless li scarta. In USB sì |
| Con cavo e Bluetooth attivi insieme | il pad invia via USB; staccando il cavo passa al Bluetooth |

Conseguenza: la firma F13–F21 funziona solo in USB. Per i controlli senza azione e per i media/mouse duplicati l'identità è
ora un **usage consumer riservato** (HUT: 0x07–0x1F, 0x49–0x5F, 0x67–0x7F, 72 valori = 3 layer × 24), che viaggia anche in
Bluetooth perché Raw Input consegna i byte grezzi del report consumer. Le macro a tastiera firmate perdono la firma in wireless
(l'azione funziona, ma la vista live non le distingue).
