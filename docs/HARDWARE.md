# Hardware — scheda "ANXIN-@9KEY_3KNOB"

Ricavato dalle 8 foto del PCB (cartella [`images/pcb/`](images/pcb/)) più i dati letti dal dispositivo.
Distinzione usata: **[visto]** = leggibile nelle foto · **[dedotto]** = inferenza · **[ignoto]**.

## 1. Identità della scheda

| | |
|---|---|
| Serigrafia | `ANXIN-@9KEY_3KNOB` e, sotto, `307988AP70-221104` (alcuni caratteri incerti nelle foto). `221104` è probabilmente una data (4/11/2022) **[dedotto]** |
| Struttura | sandwich acrilico: piastra superiore smerigliata + distanziali + PCB nero + base nera **[visto]** |
| Alimentazione | USB-C **e** batteria LiPo a sacchetto saldata a `b+`/`b−`, fissata con Kapton **[visto]** |
| Radio | Bluetooth LE (dispositivo `MINI_KEYBOARD`); antenna a pista sul bordo sinistro del lato posteriore **[visto]** |

## 2. Lato anteriore (tasti e controlli)

Orientamento di riferimento: come nella foto [`foto-dall-alto.jpg`](images/reference/foto-dall-alto.jpg) (manopole a destra, la grande in basso).
In questa posizione USB-C, pulsante "Layer" e interruttore ON/OFF sono sul **bordo superiore**.

| Elemento | Dettagli |
|---|---|
| `KEY1`…`KEY9` | 3×3, footprint MX (3 fori + 2 pin). **Numerazione a righe: KEY1–3 in alto da sinistra, KEY4–6, KEY7–9** **[visto]** |
| `RGB1`…`RGB9` | un LED RGB SMD accanto a ogni tasto **[visto]** |
| `RGB10`…`RGB12` | **assenti**: la numerazione salta da 9 a 13 → il PCB è una variante "depopolata" di un design a 12 tasti, coerente con le 12 posizioni di tasto del software ufficiale **[dedotto]** |
| `RGB13`…`RGB15` (`L1 L2 L3`) | tre LED indicatori del layer attivo **[visto]** |
| `RGB16` | LED aggiuntivo vicino all'angolo (probabile stato/Bluetooth) **[dedotto]** |
| 3 encoder | tipo EC11 con pulsante (5 pin), albero filettato con dado, saldati a foro passante **[visto]** |
| `Layer` | micro-pulsante SMD a bordo scheda, serigrafato **"Layer"** → cambia il layer 1→2→3 **[dedotto dalla serigrafia]** |
| `ON` / `OFF` | interruttore a slitta SPDT, serigrafato → alimentazione (batteria) **[visto]** |
| `TP1`, `TP3` | punti di test **[visto]** |

I LED RGB sono molti (16): è più probabile una catena indirizzabile con un solo pin dati che 48 uscite PWM **[dedotto]**.

## 3. Lato posteriore (elettronica)

| Rif. | Cosa | Note |
|---|---|---|
| `U1` | MCU, QFN a 8 pin/lato (≈ QFN32) | **marcatura rimossa a mano**: il rettangolo chiaro è la zona abrasa. Nessun part number leggibile **[visto]** |
| `X1` | cristallo SMD **24.000 MHz** + `C1`, `C2` di carico | **[visto]** |
| `L1`, `C4`…`C9` | induttore + condensatori vicino all'MCU | tipico di DC-DC/alimentazione RF **[dedotto]** |
| `R5`, `C10`, `R6` | rete a π tra MCU e pista d'antenna | alimentazione dell'antenna 2.4 GHz **[dedotto]** |
| Antenna | pista in rame a "L" lungo il bordo sinistro, con zona libera da rame | **[visto]** |
| `J4` | 2 piazzole (una quadrata), tracce verso l'MCU e `R10` | header di servizio: programmazione/bootloader **[ignoto]** |
| `Q2` + 2° SOT-23 marcato `A19T` + `R8`–`R12` | percorso di alimentazione discreto (batteria/USB, protezione) | `A19T` è di norma un P-MOSFET tipo Si2301 **[dedotto]** |
| LED SMD vicino a `b+` | probabile LED di carica | **[dedotto]** |
| Presa USB-C | solo USB 2.0; `R1`, `R2` = pull-down dei CC (verosimilmente 5.1 kΩ), `ESD1` marcato "PB" = TVS su D+/D−, `C3` | **[dedotto]** |
| `R14`…`R17`, `C13`, `C14` | serie di passivi vicino alla USB-C | funzione non determinata **[ignoto]** |
| `U2`, `C11`, `C12`, `R3` | **non montati** (solo piazzole stagnate) | probabile regolatore/filtro non fitted **[visto]** |
| `TP2`, `TP4` | punti di test | **[visto]** |

Il caricabatteria non è stato identificato: nessun IC dedicato chiaramente montato (il candidato `U2` è vuoto);
la carica potrebbe essere nel percorso discreto `Q2`/`A19T` o nell'MCU **[ignoto]**.

## 4. Quale MCU è?

**Il chip radio è un SoC Jieli (Zhuhai Jieli Technology, 杰理).** Prova: la cache Bluetooth di Windows per il
`MINI_KEYBOARD` riporta `ManufacturerId = 0x05D6`, che nel registro dei *Company Identifier* del Bluetooth SIG
corrisponde a **"Zhuhai Jieli technology Co.,Ltd"** (letto dalla lista pubblica di Nordic `bluetooth-numbers-database`).
Il controller dichiara anche `LmpVersion = 12` (Bluetooth 5.3) e `LmpSubversion = 0x0772`.

Ragionamento sul fatto che sia **lo stesso chip di `U1`**: sulla scheda c'è un solo circuito integrato grande,
che fa sia USB HID sia BLE; il SDK pubblico di Jieli per AC63 include proprio esempi di tastiera con USB HID + BLE.
Questo **corregge** le ipotesi precedenti (WCH CH57x e Telink TLSR825x): entrambe erano sbagliate.

| Indizio | Esito |
|---|---|
| `ManufacturerId 0x05D6` | **Jieli** (dato letto dal sistema, non dedotto) |
| Cristallo 24 MHz, QFN ≈ 32 pin, marcatura abrasa | compatibili con un SoC Jieli; non dimostrano il part number |
| VID `0x1189` e "ch57x" delle community | etichette della community, fuorvianti per questo PID |
| PnP ID BLE `05AC:022C` | **falso** (ID Apple): il firmware si spaccia per una tastiera Apple |
| Indirizzo BLE | *random statico*; non identifica il produttore |

**Il modello esatto di SoC Jieli resta ignoto** (famiglie AC63/AC69/JL70xx…). Per saperlo servirebbe la marcatura
o il comportamento del bootloader Jieli. Non è necessario per programmare via USB.
Su `J4`, `TP1`–`TP4`: probabilmente servizio/UART di download Jieli **[ignoto]**; non toccare senza un backup del firmware,
che al momento non esiste.

## 5. Schematica

Dalle foto si può disegnare lo **schema a blocchi** (USB-C → protezione → MCU; batteria → percorso di alimentazione;
MCU → catena di 16 LED RGB; MCU ← 9 tasti, 3 encoder con pulsante, pulsante Layer; MCU → antenna), ma **non la netlist**:
per i collegamenti pin-per-pin servono continuità o foto ad alta risoluzione dei due lati con le piste visibili.

## 6. Foto

| File | Cosa mostra |
|---|---|
| [`front-full.jpg`](images/pcb/front-full.jpg) | intero lato anteriore (ruotato: manopole in basso) |
| [`front-keys-leds.jpg`](images/pcb/front-keys-leds.jpg) | KEY1–9, RGB1–9, L1–L3, Layer, ON/OFF |
| [`front-encoders-silkscreen.jpg`](images/pcb/front-encoders-silkscreen.jpg) | encoder, serigrafia `ANXIN-@9KEY_3KNOB` |
| [`back-full-battery.jpg`](images/pcb/back-full-battery.jpg) | lato posteriore con batteria |
| [`back-usb-mcu-region.jpg`](images/pcb/back-usb-mcu-region.jpg) | zona USB-C, MCU, batteria |
| [`back-mcu-crystal.jpg`](images/pcb/back-mcu-crystal.jpg) | U1, X1 24 MHz, L1, rete d'antenna |
| [`back-j4-power-path.jpg`](images/pcb/back-j4-power-path.jpg) | J4, Q2, A19T, `b+`/`b−` |
| [`back-usbc-esd-u2.jpg`](images/pcb/back-usbc-esd-u2.jpg) | USB-C, ESD1, R1/R2, U2 non montato |
