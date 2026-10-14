# Bluetooth — cosa si sa e cosa serve per programmare senza cavo

> Domanda: si può programmare macro ed effetti LED via Bluetooth?
> **Risposta attuale: no, non con quello che sappiamo.** Il canale usato dal software ufficiale non esiste in Bluetooth,
> e l'unico servizio vendor (`AE40`) **non ha eseguito** tre varianti di un frame LED (vedi §6). La funzione di `AE40`
> resta ignota; senza il protocollo non si procede oltre a tentativi.

## 1. Fatti verificati (cache di Windows del `MINI_KEYBOARD`, nessuna connessione)

| Elemento | Valore |
|---|---|
| Nome | `MINI_KEYBOARD`, appearance `0x03C1` (tastiera HID) |
| Indirizzo | *random statico* (diverso per ogni esemplare) |
| Controller | Company ID `0x05D6` = **Jieli**; Bluetooth 5.3 (LMP 12) |
| PnP ID dichiarato | sorgente USB-IF, VID `0x05AC`, PID `0x022C`, ver. `0x011B` (**ID di una tastiera Apple, fittizio**) |
| Parametri di connessione | intervallo 6–9 (7,5–11,25 ms), latenza 100, timeout 300 (3 s) |
| Servizi GATT visti da Windows | `1800` Generic Access · `1801` Generic Attribute · `180A` Device Information · `180F` Battery · `1812` **HID** · **`AE40` (vendor)** |
| Collezioni HID in BLE | **mouse** (`UP 0001 / U 0002`), **tastiera** (`0001/0006`), **consumer** (`000C/0001`). **Nessuna** collezione vendor `0xFF00` |

### 1.1 Enumerazione GATT dal vivo (12/10/2026, pad in modalità Bluetooth, sola lettura)

Eseguita con [`../tools/research/BleGattDump.ps1`](../tools/research/BleGattDump.ps1). Nessuna scrittura, nessuna iscrizione a notifiche.

| Handle | Servizio / caratteristica | Proprietà | Valore letto |
|---|---|---|---|
| `0x0001` | `1800` Generic Access: `2A00`, `2A01`, `2A04` | Read | — |
| `0x0008` | `1801` Generic Attribute: `2A05` | Indicate | — |
| `0x000C` | `180A` Device Information | Read | Manufacturer **`CXKJ`** · Model **`MINI_KEYBOARD`** · HW/FW/SW **`0.0.1`** · PnP ID `02 AC05 2C02 1B01` |
| `0x001F` | `180F` Battery: `2A19` | Read, Notify | **63 %** (coincide con quanto mostra Windows) |
| `0x0023`–`0x0049` | `1812` HID | (accesso bloccato da Windows) | — |
| **`0x004A`** | **`AE40`** (vendor) | | |
| `0x004B` | `AE41` | **WriteWithoutResponse** | non leggibile |
| `0x004D` | `AE42` | **Notify** | non leggibile |

* `CXKJ` è la stringa del costruttore del firmware (OEM). Revisioni `0.0.1` = valori segnaposto.
* La coppia **write-without-response + notify** è la forma tipica di un canale "dati trasparenti" (comando → risposta).
  Non dice però *quale* protocollo ci sia sopra.
* Non c'è lettura/scrittura "normale" su `AE41/AE42`: nessuna caratteristica Read/Write sul servizio.
* Letture aggiuntive ([`BleGattExtra.ps1`](../tools/research/BleGattExtra.ps1)): **MTU negoziato = 64 byte** → massimo **61 byte**
  per scrittura (un frame USB da 64 byte non entra intero, ma la parte utile è ≤ 46 byte); `AE41` **senza descrittori**;
  `AE42` con il **solo CCCD** (`0x004F`); nessuna *User Description* né *Presentation Format*;
  livello di protezione **Plain** (non richiede cifratura/associazione per essere usata).

Cosa significa:

* In USB, la configurazione passa da una collezione HID vendor `0xFF00` (Report ID 3, 64 byte). **In BLE quella
  collezione non esiste**: il canale usato da `MINI KeyBoard.exe` non è raggiungibile via Bluetooth.
* Chi ha scritto i tool della community lo dice senza giri: *"programming is possible through wire only in both cases"*
  (kriomant/ch57x-keyboard-tool). Anche i venditori descrivono la modalità: USB collegata → modo USB, scollegata → Bluetooth.
* Il servizio **`0xAE40`** è l'unica porta non standard. Nello SDK pubblico Jieli (`fw-AC63_BT_SDK`, esempio
  `standard_keyboard`) non compare: è un'aggiunta del costruttore del firmware, o parte di un componente Jieli
  (OTA/RCSP) che non ho potuto confermare. **Non si sa cosa faccia.**

## 2. Tre scenari

| # | Scenario | Cosa permetterebbe | Probabilità (stima, non misurata) |
|---|---|---|---|
| A | `AE40` è un canale di configurazione (write + notify), con lo stesso contenuto o un incapsulamento dei comandi USB | programmare macro e LED via BLE | **media** (dopo aver visto la coppia write+notify) |
| B | `AE40` è OTA/RCSP/dati generici di Jieli | nulla di utile per le macro; **scrivere può rovinare il firmware** | media |
| C | `AE40` è un canale di servizio inutilizzato | nulla | media-bassa |

Nota: A non è confermato da nulla di osservato; una coppia write+notify esiste anche nei servizi OTA. Resta da vedere
**cosa notifica** il pad.

## 3. Come si verifica, in sicurezza (a passi, ognuno reversibile)

1. **Solo lettura — ESEGUITO (12/10/2026):** con il macropad in modalità Bluetooth (cavo USB scollegato, interruttore su ON, già associato a Windows)
   si enumerano **servizi e caratteristiche con le loro proprietà** (read/write/notify) e si leggono gli attributi *Device
   Information* e *Battery*. È la stessa operazione che fa qualunque scanner BLE; non modifica nulla.
2. `AE40` ha la coppia *write* + *notify*: si osserva **cosa notifica** da sola e dopo azioni innocue
   (premere un tasto, ruotare una manopola, premere "Layer"). Ancora nessuna scrittura su `AE41`.
   Strumento pronto: [`../tools/research/BleNotifyProbe.ps1`](../tools/research/BleNotifyProbe.ps1) (iscrizione = scrittura del solo CCCD,
   volatile; disiscrizione automatica). **ESEGUITO (12/10/2026):** 200 s di ascolto premendo più volte
   tutti i tasti, ruotando e premendo le 3 manopole e premendo "Layer": **0 notifiche**. `AE42` non emette nulla da sola,
   quindi se è un canale di comandi risponde solo a richieste.
3. **Primo (e solo) tipo di scrittura ammesso: un frame LED**, già noto e reversibile via USB, con lo strumento
   [`BleSendProbe.ps1`](../tools/research/BleSendProbe.ps1) (rifiuta tutto ciò che non è un frame LED e richiede `-IUnderstand`).
   **Eseguito: vedi §6.** Varianti di incapsulamento, ognuna come invio separato:

   | Variante | Contenuto inviato su `AE41` | Perché |
   |---|---|---|
   | V1 | `FE B0 <L> 08 00 00 00 00 00 01 <L> <colore<<4 \| modo>` (12 B) | frame USB senza padding |
   | V2 | `03` + frame V1 (13 B) | con il Report ID 3 davanti, come l'app ufficiale lo costruisce |
   | V3 | frame V1 riempito a 61 B | lunghezza massima ATT, "come l'USB" |

   Esito atteso se è un canale di configurazione: i LED del layer attivo cambiano colore e/o arriva una notifica su `AE42`.
   Se **nessuna** variante produce effetti → non si insiste: il canale non è questo (o ha un incapsulamento ignoto) e si
   passa all'alternativa del §4.

   **Rischio stimato (non misurato):** il frame inizia con `FE B0…`; un parser OTA/RCSP Jieli si aspetta `FE DC BA…` e
   lo scarterebbe subito. Esiti peggiori realistici: frame ignorato, oppure disconnessione/riavvio del pad (si risolve
   spegnendo e riaccendendo). Non posso escludere un comportamento ignoto del firmware: per questo un solo tipo di
   frame, uno alla volta, e nessuna macro.
4. Decisione: se l'esito è B o C, la programmazione resta via USB e si passa all'alternativa del §4.

## 4. Alternativa che funziona senza canale di configurazione (da valutare)

Il pad in Bluetooth **invia già i tasti**: programmato via USB con codici "neutri" (es. F13–F24 e combinazioni),
una piccola app sul PC può *intercettarli* e decidere l'azione in base a profilo, finestra attiva o layer.
Vantaggi: macro illimitate e cambiabili al volo anche con il pad in BLE, senza scrivere nella flash.
Limiti: **non cambia i LED** (quelli dipendono dal firmware), richiede l'app in esecuzione sul PC, ed è un componente
nuovo (hook globale dei tasti, invio di azioni) da progettare — adatto all'app Electron, non alla pagina nel browser.

## 5. Cosa fa l'app oggi

* Programma **solo via USB** (WebHID, interfaccia `0xFF00`). Con il pad in Bluetooth lo stato dice "Non collegato" perché
  quell'interfaccia non è presente: è corretto, non un errore.
* Il trasporto è isolato in poche funzioni (`connect`, `sendFrames`): aggiungere un trasporto BLE più avanti sarà un
  cambiamento locale, se e quando il §3 troverà un canale.

## 6. Esito della prova di scrittura (12/10/2026, eseguita con `tools/research/BleSendProbe.ps1`)

Pad in Bluetooth, layer 1 attivo, LED dei tasti verdi. Un solo tipo di frame: **LED del layer 1**, con colore diverso per variante.

| Variante | Frame inviato su `AE41` | Scrittura BLE | Notifiche su `AE42` | LED layer 1 dopo il passaggio in USB |
|---|---|---|---|---|
| V1 | `FE B0 01 08 00 00 00 00 00 01 01 71` (12 B, viola) | `Success` | 0 | verde (invariato) |
| V2 | `03` + V1 con colore blu `61` (13 B) | `Success` | 0 | verde (invariato) |
| V3 | V1 con colore ciano `51`, riempito a 61 B | `Success` | 0 | verde (invariato) |

* `Success` significa solo che lo stack Bluetooth ha consegnato il pacchetto; **il firmware non lo ha eseguito**
  (nessun cambio colore, nessuna risposta).
* Layer 2 e 3 restano **bianchi** (colore predefinito, codice 0 presumibilmente).
* Il pad è tornato in USB senza problemi: nessuna disconnessione, nessun riavvio anomalo, nessuna modifica.

Osservazioni di funzionamento:

* In Bluetooth i **LED dei tasti sono spenti** (probabile risparmio energetico); si accendono in USB.
* I **tre LED di layer** (L1–L3) si accendono solo quando si preme il pulsante "Layer".
* Collegando l'USB il pad passa in modalità USB: la radio BLE non è più raggiungibile.

### Conclusione

Il servizio `AE40` **non accetta i frame di configurazione USB** in nessuno dei tre incapsulamenti provati, e non emette
notifiche spontanee. Possibili spiegazioni (non distinguibili senza altre informazioni): protocollo diverso, OTA/RCSP Jieli,
canale non usato dal firmware. **Non si prosegue con altri tentativi a caso**: il rischio cresce e l'informazione no.
La programmazione di macro e LED resta **solo via USB**; per macro in Bluetooth resta l'alternativa del §4.
