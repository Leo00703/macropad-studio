# Linguaggio grafico e geometria del pad

## Obiettivi iniziali (12/10/2026)
* **Frosted glass** (vetro smerigliato), **minimale**, interfaccia **in stile Apple**, molto intuitiva.
* **Assolutamente non "AI slop"**: niente gradienti viola/saturi sui pulsanti, niente decorazioni gratuite.
* La **forma del tastierino deve essere identica a quella reale** (si parte dalle foto).
* La vista realtime è il cuore dell'app; il 3D si valuta più avanti.

## Regole applicate
* Tipografia di sistema (`-apple-system`, SF Pro / Segoe UI Variable). Pesi 400/500/600, niente maiuscoletto decorativo.
* Superfici in vetro: `backdrop-filter: saturate(180%) blur(28px)` su fondo traslucido, bordo da 1 px chiaro, ombra morbida.
* **Un solo colore d'accento** (blu di sistema `#0071e3` chiaro / `#2997ff` scuro) usato solo per stato attivo; verde/arancio
  solo per stato di connessione. Nessun gradiente su controlli e pulsanti.
* I soli gradienti ammessi sono quelli **fisici** del render (riflesso sull'alluminio delle manopole).
* Tema chiaro/scuro automatico (`prefers-color-scheme`); animazioni brevi (≤ 150 ms) e disattivabili (`prefers-reduced-motion`).
* Controlli a segmenti come in iOS/macOS; testo secondario in grigio; nessuna icona decorativa.

## Geometria reale (unità = pixel della foto del PCB `docs/images/pcb/front-full.jpg`, ruotata come nel prodotto)
Orientamento prodotto: manopole a destra, la grande in basso, USB-C/Layer/ON-OFF sul bordo superiore.

| Elemento | Valore |
|---|---|
| Blocco tasti | 1210 × 760, angoli: alto-sx 44, alto-dx 84, basso-sx 44 |
| "Coda" delle manopole | capsula larga 360 (x 850–1210), arriva a y = 1250 con raggio 180 |
| Raccordo concavo coda/blocco | raggio 150, tra (700, 760) e (850, 910) |
| Tasti (centri) | colonne x = 180, 402, 624 · righe y = 170, 392, 614 (passo ≈ 222 ≈ 19,05 mm → ≈ 11,65 px/mm) |
| Manopole (centri) | x = 1030 · y = 220 (r 92), 610 (r 92), **1080 (r 142, la grande)** |
| LED di layer L1–L3 | x ≈ 806, y ≈ 346 / 392 / 438 |

Path SVG della sagoma:
`M44 0H1126A84 84 0 0 1 1210 84V1070A180 180 0 0 1 850 1070V910A150 150 0 0 0 700 760H44A44 44 0 0 1 0 716V44A44 44 0 0 1 44 0Z`

Materiali (dalla foto del prodotto): piastra superiore in acrilico **fumé smerigliato**, strati intermedi trasparenti,
base nera; tasti MX con keycap nere; due manopole piccole in alluminio con anello e una grande a gradino.

## Linguaggio visivo v2 (vista live, 12/10/2026)

Riferimenti: Liquid Glass di Apple (vetro come livello funzionale sopra i contenuti, raggi concentrici, tinta solo per
significato, riflesso speculare, rispetto di Riduci trasparenza/Contrasto/Movimento), configuratori di tastiere (dispositivo
al centro, web, leggeri), design industriale Nothing/Teenage Engineering (riduzione, un solo segno distintivo), linee guida
di accessibilità per il vetro (contrasto 4,5:1, riempimento sotto il testo, vetro su poche superfici).

Tre strati:
1. **Ambiente** — campo di punti (canvas) con onda diagonale lenta e un'onda che parte dal controllo usato; sotto il pad una
   luce RGB sfocata che segue la sagoma, nel colore del LED del layer visualizzato (di fabbrica: L1 verde, L2/L3 bianco).
2. **Pad** — il contenuto: materiali opachi fedeli alla foto; solo la piastra acrilica è traslucida. Bagliore sotto i tasti
   nel colore del LED (come il retroilluminato reale).
3. **Vetro** — solo i controlli: selettore layer, stato, riga "ultima azione", ispettore ancorato, etichette temporanee,
   diagnostica. Rifrazione ai bordi con `feDisplacementMap` solo in Chromium (ripiego: blur + riflesso).

Regole: un solo accento (blu di sistema); verde/arancio solo per stato; nessun gradiente su controlli; ispettore accanto al
controllo con linea di collegamento (foglio in basso se la finestra è stretta); l'ultima azione compare come etichetta sul
controllo; "Riduci movimento" lascia la griglia statica; "Riduci trasparenza" usa superfici piene.


## v3 (13/10/2026): geometria dalla foto reale, materiali, tipografia

Feedback: pad troppo grande, schede poco "mature", font da cambiare, render poco realistico.

**Geometria misurata sulla foto dall'alto** (`app/live.html`, unità = pixel della foto con origine nell'angolo della piastra):
- sagoma: blocco 1297 × 815, angolo alto‑destra r = 220, angoli sinistri r = 65, raccordo concavo r = 140, coda a capsula
  r = 200 centrata su (1097, 1195). La sagoma precedente (derivata dal PCB) aveva l'angolo alto‑destra a r ≈ 90 e i tasti
  troppo lontani dal bordo superiore (68 invece di ~20 px).
- basi dei tasti 202 × 214, passo 241 × 251; centri x = 199 / 441 / 681, y = 137 / 389 / 639; faccia superiore sabbiata
  146 × 163 spostata verso l'alto (la parte bassa è il pendio frontale), angoli alti smussati.
- manopole: due piccole con disco r 106 + anello cromato, gonna zigrinata (24 nervature) spostata in basso a sinistra per la
  prospettiva, indicatore bianco a ore 12; grande con ghiera nera r 208, disco r 168 e tacca a ~7 di orologio.
  Centri (1120, 211), (1122, 614), (1125, 1188).
- viti a croce: (55, 53), (52, 750), (900, 800), (1242, 963). Sotto la piastra satinata si vedono il pulsante layer
  (921, 76) con 4 puntini, il blocco dei 3 LED (855, 400/425/450) e blocchetti bianchi sul bordo alto (switch).
- feltro grigio sul bordo sinistro, pila di strati sul bordo inferiore (acrilico trasparente, PCB, base nera).

**Materiali** (procedurali, generati una volta all'avvio): alluminio tornito con riflesso conico a due strisce, sabbiatura
del cappuccio, grana dell'acrilico satinato, fibre del feltro.

**Tipografia:** Geist (testo) e Geist Mono (micro‑etichette, valori) in `app/fonts/`, licenza SIL OFL. Gerarchia: titolo 18/600,
testo 13, micro‑etichette 10,5 mono maiuscolo con spaziatura 0,08 em. Tasti combinati mostrati come `kbd`.

**Chrome:** barra in alto e barra di stato aderenti ai bordi (stile app desktop), ispettore a raggio 12 px con filetti da 1 px,
niente pillole né ombre morbide.

## v4 (13/10/2026): pannelli flottanti, LED leggibile, geometria verificata sulla foto

Feedback sulla v3: preferiti i pannelli flottanti alle barre fisse; pad troppo bianco; LED sotto poco comprensibile;
manopole fuori asse.

- **Verifica con sovrapposizione:** la foto dall'alto (`docs/images/reference/foto-dall-alto.jpg`) sovrapposta al render a
  scala 1:1 con origine (95, 305). Trovato che la manopola grande era ~40 unità troppo in basso: centro corretto a
  (1126, 1150), capsula della coda centrata sulla stessa ordinata (1152). Le piccole erano a posto ma con la gonna
  decentrata di (−12, +26) per la prospettiva: ora quasi concentrica (0, +4), r 119.
- **Chrome:** layer, LED, stato del ponte, ultima azione e diagnostica sono pannelli di vetro flottanti (raggio 10 px).
- **LED:** scheda "LED" con L1/L2/L3 e il nome del colore di ciascun layer (quello visualizzato in evidenza); la luce
  attraversa l'acrilico attorno ai tasti e alle manopole invece di un alone esterno; etichette L1–L3 accanto ai led reali.
- **Piastra:** grigio freddo satinato (non bianco), bordo luminoso più contenuto.

## v5 (13/10/2026): asse delle manopole, LED solo su tasti e bordi, tipografia e card

- **Manopole:** le tre sullo stesso asse x = 1097 (centro della capsula della piastra). La grande ha ghiera r = 184 dentro
  la capsula r = 200 (16 unità di bordo visibile), disco r = 152. Stanghetta a ore 12 in posizione iniziale su tutte e tre.
  (Nella foto la ghiera sporge dal bordo destro: scelta voluta in questa versione per tenere tutto dentro i bordi.)
- **Piastra:** plexiglass opaco, più scuro (#9aa1ab → #747b86 in scuro, #bcc2ca → #98a0aa in chiaro) per far risaltare i LED.
- **LED:** illuminano solo i tasti e il bordo del pad (bagliore interno + filo luminoso + spaziatore acrilico tinto);
  le manopole non si accendono più.
- **Tipografia:** Inter (variabile) al posto di Geist; selettore del carattere in Diagnostica (Inter / Geist / Sistema).
  Testi più grandi e pesanti: base 14 px, titoli card 24/700, valori 15,5/600, micro‑etichette 11/700 maiuscolo.
- **Card:** gerarchia in tre livelli — identità (micro‑etichetta, titolo, badge layer e tipo), azione assegnata in grande
  (tasti `kbd` 18 px), poi elenco di tutti i layer con quello attivo evidenziato; avviso duplicati con titolo e testo.
  Bersagli ≥ 30 px, contrasto verificato nei due temi, nessun significato affidato solo al colore.

## v6 (13/10/2026): senza feltro, cappucci più dettagliati

- Rimossa la striscia di feltro sul bordo sinistro del render (era un pezzo di gomma protettiva visibile nella foto).
- **Cappucci:** sabbiatura PBT a più scale (rumore fine + medio ripetibile, scintille sparse, chiazze morbide e rare
  micro‑graffiature), illuminazione del "dish" cilindrico (fascia centrale più chiara, bordi scuri), smusso interno,
  labbro frontale con ombra e pendio frontale sfumato verso il nero con grana propria.

## v7 (13/10/2026): riferimento Stitch (stitch.withgoogle.com)

Analisi dello screenshot di riferimento: sfondo nero con campo di punti (passo ~13 px, ~1 px, opacità bassa) e "aurora" blu/viola
in basso che colora i punti; titoli in Google Sans leggero e molto grande, sottotitolo regolare; superficie del campo di
input a raggio ~28 px, scura e traslucida, con filo a gradiente (chiaro in alto a sinistra, accento in basso a sinistra);
controlli e suggerimenti a **pillola** (segmentato App/Web, menu "Balanced", chip con scintilla); CTA bianca a pillola.
(Il sito non si è caricato nel browser integrato: iframe cross‑origin, quindi stile dedotto dalla schermata.)

Applicato:
- **Carattere:** Google Sans variabile (OFL, `app/fonts/GoogleSans-Variable.woff2`, 36 KB); Inter e Geist restano nel selettore
  in Diagnostica. Titoli 500, valori 600, scala più ampia (titolo card 32 px).
- **Forme:** pillole per layer, LED, connessione, chip delle ultime azioni, etichette e pulsanti; card a raggio 26 px con
  filo luminoso a gradiente (maschera `mask-composite`); CTA "Configuratore" bianca (nera nel tema chiaro).
- **Sfondo:** punti più fitti (passo 24) con **effetto magnetico**: entro 160 px dal puntatore i punti sono attratti (fino a
  22 px), si ingrandiscono e si colorano d'accento, con molla (0,17/frame); **aurora in basso** nel colore del LED del layer
  (non viola) che tinge anche i punti; onde dai controlli premuti; con "Riduci movimento" tutto resta statico.
- **Cronologia:** ultime tre azioni come chip (la più recente in evidenza, ripetizioni fuse in ×n) al posto della barra.
- **Tasti:** nero molto opaco con grana fine e uniforme (come la piastra satinata, ma scura), senza scintille né chiazze.

## v8 (13/10/2026): puntatore e grana, secondo lo screenshot di Stitch

- **Puntatore:** effetto inverso e discreto. Entro 210 px i punti si allontanano (fino a 9 px) e sfumano fino al ~20 %
  dell'opacità; nessun cambio di colore né ingrandimento. Passo dei punti 20 px.
- **Grana dei tasti:** tessera 128 px mappata 1:1 sui pixel del dispositivo (`fitGrain`, `image-rendering: pixelated`):
  ogni granello è di un pixel, fitto e nitido; granelli scuri marcati e chiari deboli. Faccia #0c0e11, luci attenuate.

## v9 (13/10/2026): grana dei tasti continua, senza puntini

Nella v8 i granelli chiari erano isolati (alpha fino a ~0,46) e sullo schermo sembravano macchie bianche. Ora la grana è
rumore tonale **continuo** su ogni pixel (correlazione 3×3 ripetibile): toni più chiari con alpha ≤ 0,30 e colore grigio‑blu
scuro (84, 92, 106), toni più scuri fino a 0,55. Nessun puntino isolato.

## v10 (14/10/2026): grana dei tasti con filtro SVG (cambio di approccio)

Le tessere di pixel casuali (v7–v9) producevano sempre puntini isolati. Ora la grana è un filtro SVG `feTurbulence`
(`fractalNoise`, 2 ottave) convertito con `feColorMatrix` in toni di grigio molto scuri (≈ 4–24/255, media ≈ 14) e ritagliato
con `feComposite in` sulla forma del tasto: rumore morbido e correlato, come il grain del vetro satinato ma in nero, senza
punti chiari. La frequenza si adatta alla scala e alla densità di pixel (`fitGrain`, granello ≈ 1,7 px).

## v11 (14/10/2026): carattere definitivo

Google Sans è l'unico carattere dell'app (`app/fonts/GoogleSans-Variable.woff2` + `GoogleSans-LICENSE.txt`, SIL OFL).
Rimossi Inter, Geist e Geist Mono (file, `@font-face`, selettore in Diagnostica). Ripiego di sistema: Segoe UI Variable /
Segoe UI.
