# Diario di sviluppo e decisioni di progetto

Cronologia di misure, decisioni e correzioni (ottobre 2026). La specifica verificata è in [`PROTOCOL.md`](PROTOCOL.md);
questo file spiega il *perché* delle scelte. Le cose ancora aperte sono nella sezione *Roadmap* del [`README`](../README.md).

## Requisito iniziale: vista in tempo reale ("clone" del pad)

> *"Vorrei che si potesse vedere in tempo reale i tasti che vengono premuti e le rotelle che girano/si cliccano,
> creando un clone dello stato attuale del macropad. Quando rifaremo tutta la grafica e la UI, ricordiamoci di
> implementare questa funzione."*

Cosa deve mostrare il clone: ognuno dei 9 tasti **premuto/rilasciato**; ognuna delle 3 manopole con **rotazione ↺/↻**
(impulsi, con eventuale conteggio e direzione) e **pressione**; idealmente anche **layer attivo**, colore LED e,
in Bluetooth, batteria (servizio standard `180F`, già leggibile).

### Il problema tecnico: da dove arriva l'informazione?

Il pad **non** ha (finora) un canale che dica "è stato premuto il controllo X": ciò che arriva al PC sono i *tasti che
esegue*. Le strade possibili, dalla più semplice alla più completa:

| # | Strada | Copre | Limiti |
|---|---|---|---|
| 0 | **Report IN dell'interfaccia vendor `0xFF00`** (EP `0x84`, 64 B, Report ID 3): il pad potrebbe inviare lì lo stato | tutto, con layer | **CHIUSA il 12/10/2026**: con l'ascolto passivo attivo, premendo tasti, manopole e "Layer" non è arrivato **nessun** report IN. Il canale resta silenzioso |
| 1 | **Deduzione dagli eventi tastiera/rotella** che la pagina riceve (`keydown/keyup`, `wheel`), confrontati con il profilo programmato | tasti e manopole con azione "tastiera" *univoca*; il layer si deduce dall'azione | non distingue il pad dalla tastiera del PC; media/mouse poco o per niente visibili; azioni uguali su più controlli sono ambigue; serve la finestra in primo piano |
| 2 | **Profilo "monitor"**: codici univoci (F13–F24 + modificatori) su ogni controllo, e un'app (Electron, in background) che li intercetta, li traduce in azioni e li mostra | tutti i controlli, **anche in Bluetooth**, layer incluso | il pad non esegue più le azioni "da solo" (le esegue l'app); niente LED; richiede app attiva — coincide con l'alternativa "macro in BLE" di `BLUETOOTH.md` §4 |
| 3 | Lettura per dispositivo con Raw Input (Windows) tramite modulo nativo in Electron | distingue il pad dalla tastiera, qualunque azione | modulo nativo, Windows-only; non vede media/mouse del pad separatamente |

Stato: la strada 0 è chiusa (silenziosa). Si parte dalla **1** per un clone "best effort" nel browser — il monitor
eventi dell'app (v0.4) serve a misurare cosa la pagina vede davvero — e si pianifica la **2** con l'app Electron.
Nota: dalla prova del 12/10 la pagina riceve già le lettere dei tasti del pad (es. `c i a o` dal tasto 1).

### Prossima misura (strada 1): cosa vede la pagina
Con il profilo diagnostico caricato, la finestra in primo piano e il Registro aperto, premere ogni controllo: il
Registro mostra `tasto <modificatori>+<code>` e `rotella ↑/↓`. Serve a capire quali controlli sono **visibili** e
**distinguibili** (media e mouse sono i dubbi). Da questo si decide se il clone nel browser basta o serve la strada 2.

### Esito della misura (strada 1), 12/10/2026, profilo diagnostico, app v0.4

La pagina (finestra in primo piano) ha visto **tutti** i controlli, nell'ordine in cui sono stati premuti:

| Controllo | Evento visto dalla pagina | Distinguibile? |
|---|---|---|
| Tasto 1 | `KeyC KeyI KeyA KeyO` (4 eventi ravvicinati) | sì |
| Tasto 2 | `Control` + `Ctrl+KeyA` | sì (ma identico a un Ctrl+A reale) |
| Tasto 3 | `Shift` + `Shift+KeyA` | sì |
| Tasti 4 / 5 / 6 | `key="AudioVolumeDown / Up / Mute"` (**`code` vuoto**: si legge `key`) | **no**: uguali a manopola alta ↺ / ↻ / premi, per scelta del profilo |
| Tasti 7 / 8 | `wheel` ↑ / ↓ (`deltaY` ∓100) | sì; **se il tasto è tenuto premuto la rotella si ripete** |
| Tasto 9 | `Control` + `wheel ↑ con Ctrl` | sì |
| Manopola alta ↺ / premi / ↻ | Volume −, Mute, Volume + | no (duplica 4–6) |
| Manopola centrale ↺ / premi / ↻ | `PageUp`, `Home`, `PageDown` | sì |
| Manopola grande ↺ / premi / ↻ | `ArrowLeft`, `Space`, `ArrowRight` | sì |

Conclusioni di progetto:

* **Un clone "best effort" nel browser è fattibile**: tasti, media (via `key`), rotella e modificatori arrivano tutti.
* L'ambiguità non è del pad ma del *profilo*: azioni identiche su controlli diversi non si distinguono. L'app può
  calcolare un **"rapporto di visibilità"** del profilo (quali controlli sono identificabili in modo univoco) e avvisare.
* Il **layer attivo** si deduce dall'azione osservata, se è diversa tra i layer.
* Il pad invia *tap* istantanei, non uno stato "tenuto premuto": nel clone la pressione è un **impulso** (lampeggio),
  salvo la rotella che si ripete mentre il tasto è tenuto.
* Resta il limite strutturale: **non si distingue il pad dalla tastiera del PC** (il Ctrl+C finale del log era la
  tastiera). Con l'app Electron e una "firma" si risolve (vedi sotto).

#### Idea: "firma" per il monitor
Per ogni controllo di tipo *tastiera* l'app può **aggiungere in coda alla macro un tasto F13–F24** (con modificatori
per ottenere abbastanza combinazioni: 12 tasti × {nessuno, Shift, Ctrl, Alt, Shift+Ctrl} = 60 ≥ 54 = 18 controlli × 3 layer).
F13–F24 sono ignorati dalla quasi totalità delle applicazioni, quindi la macro resta invariata a occhio, ma identifica
in modo **univoco controllo e layer**. Limiti: non applicabile a media/mouse (un solo tipo per controllo), usa un passo
di macro in più (max 18), e alcune app/giochi potrebbero reagire a F13–F24.

### Domanda: si può dare a ogni controllo un identificativo "privato", letto solo dall'app?

Analisi (12/10/2026). Si separano due problemi, con soluzioni diverse:

**A. "Da quale dispositivo arriva?" (pad vs tastiera, mouse, ecc.)** → *Raw Input* di Windows. Ogni evento porta l'handle
del dispositivo, da cui si legge `VID_1189&PID_8833`; funziona anche con la finestra in background e in Bluetooth.
È **passivo** (non blocca né modifica gli eventi: gli altri programmi li ricevono comunque) e vede tastiera, mouse e
consumer control. Il browser non può usarlo: serve l'app Electron con un piccolo helper nativo (anche un C# compilato
al volo, come gli strumenti già usati). Da limitare per privacy ai soli dispositivi `VID_1189`.

**B. "Quale controllo è?"** → il pad sa emettere solo azioni *tastiera* (fino a 18 combinazioni), *media* (usage a 16
bit) e *mouse* (tipi 1, 2, 3; il 5 è la pausa, l'8 il LED). **Non esiste** un'azione "invia messaggio vendor": il canale
vendor IN è silenzioso e il Bluetooth `AE40` non ha dato risposta. Quindi l'identificativo deve viaggiare come azione:

| Opzione | Effetto sugli altri programmi | Il pad lavora da solo? | Note |
|---|---|---|---|
| B1. **Firma F13–F24** (+ modificatori) in coda alla macro | quasi nullo (F13–F24 sono ignorati dalla maggior parte delle app) | sì, anche senza app e in BLE | solo controlli *tastiera*; consuma 1 passo di macro |
| B2. **Controllo "sensore"**: azione *media* con usage consumer non assegnato (16 bit = identificativo) | nullo (Windows non lo mappa su nulla) | **no**: l'azione reale la esegue l'app | stile Stream Deck; il pad senza app non fa nulla; da verificare che il byte alto dell'usage sia accettato |
| B3. Nessuna firma, solo azioni **uniche** per controllo | nullo | sì | si ha ambiguità se due controlli fanno la stessa cosa |

Combinazione consigliata: **A (Raw Input) per l'origine + B3 dove possibile + B1 dove servono duplicati**; B2 solo se
si sceglie il modello "il PC è il cervello". Con A non serve più che la firma sia "segreta": basta che sia univoca,
perché l'app sa già che l'evento viene dal pad. Un blocco *per dispositivo* degli eventi (perché nessun altro li riceva)
non è fattibile senza un driver kernel (es. Interception): non lo si propone.

Esperimento opzionale, solo con consenso: provare tipi di frame mai usati dall'app ufficiale (4, 6, 7…) su un controllo
di prova, per vedere se il firmware ne ha uno che risponde sul canale vendor. Probabilità bassa; rischio basso via USB
(la config si riscrive), ma è scrittura di valori non documentati.

### Esito del prototipo Raw Input (12/10/2026) — **strada 3/A VALIDATA**

Eseguito con `tools/RawInputPad.ps1` (40 s, Blocco note in primo piano, uso contemporaneo di tastiera e mouse):

| Misura | Risultato |
|---|---|
| Eventi del pad riconosciuti | **76**, tutti da `VID_1189`, ognuno con la sua interfaccia |
| Eventi di altri dispositivi (tastiera/mouse del PC) | **274, scartati e solo contati** |
| Interfacce del pad viste | `COL01` tastiera (50), `COL04` consumer control (18), `COL02` mouse (8) |
| Funziona con la finestra in background | **sì** (Blocco note aveva il focus) |
| Pressione **e rilascio** | **sì**, separati: la durata riflette quanto il controllo è tenuto premuto |

Dati utili per il clone:

* **Tasti e pressione manopola:** `pressione` → `rilascio` con durate di ~15–170 ms (la durata segue la pressione fisica).
  → il tasto si può mostrare **davvero abbassato finché è premuto**.
* **Rotazione manopole:** pressione e rilascio nello **stesso istante** (0 ms): è un impulso, non uno stato. L'animazione
  della manopola va guidata dagli scatti (↺/↻ da quale ID/azione arriva).
* **Media (consumer):** report `05 <usage lo> <usage hi>`: `05 EA 00` = Volume −, `05 E9 00` = Volume +, `05 E2 00` = Muto;
  il rilascio è `05 00 00`. Quindi anche i media hanno **giù/su**.
* **Mouse:** la rotella arriva come un evento `±120` (una tacca) senza rilascio; con Ctrl, il modificatore è un evento
  tastiera a parte, prima e dopo.
* **Macro multi-tasto** (es. `ciao`): gli eventi seguono la pausa programmata (~15–30 ms).

Cosa **non** risolve da sola: *quale controllo* ha generato l'evento. Se due controlli hanno la stessa azione (es.
Volume − sul tasto 4 e sulla manopola alta) non sono distinguibili. Per i tasti-tastiera si usa la firma F13–F24;
per i media serve usare azioni diverse, oppure (da verificare) una **azione tastiera equivalente** — nella pagina
Keyboard i usage `0x7F/0x80/0x81` sono Mute/Volume su/giù, e Windows li mappa sui tasti volume — così anche i controlli
"volume" possono avere la firma.

#### Idea architetturale emersa: un "ponte" locale (bridge)
Poiché il browser non può usare Raw Input, ma un piccolo programma sì: uno script PowerShell/C# in ascolto (come
`RawInputPad.ps1`) che pubblica **solo gli eventi del pad** su `http://127.0.0.1:<porta>/events` (Server-Sent Events,
con CORS limitato alla pagina dell'app). Così la **vista realtime funziona già nel browser**, in background e con
l'identità del dispositivo, senza aspettare Electron; in seguito lo stesso ponte viene incorporato in Electron.
Sicurezza: bind solo su `127.0.0.1`, solo eventi `VID_1189`, nessun contenuto di altri dispositivi.

## Direzione del redesign (decisa il 12/10/2026)

* **Ordine:** si rifà *tutta* la grafica e la UI **nel browser** (HTML + WebHID); solo a lavoro finito si porta in Electron.
* **Cuore dell'interfaccia: una vista "macropad realtime"**, un vero clone del pad in cui si vedono:
  * i **tasti che si abbassano e si rialzano** secondo l'uso;
  * le **manopole che girano** (verso ↺/↻, un impulso per scatto) e che **si cliccano**;
  * il layer attivo e i LED.
* **3D da valutare** (non è certo che convenga: si decide quando si arriva alla grafica). Opzioni da confrontare
  con un prototipo piccolo prima di impegnarsi:

  | Approccio | Pro | Contro |
  |---|---|---|
  | **2.5D con CSS 3D transforms** (tasti con `translateZ`, manopole con `rotate`) | resta un solo file HTML, leggero, nitido, accessibile | profondità limitata, niente rotazione libera |
  | **WebGL/Three.js** con modello semplice del pad | rotazione libera, luci e ombre, resa "prodotto" | libreria da incorporare (centinaia di KB), più codice, più lavoro sul modello |
  | **Isometrica in SVG/Canvas** | stile definito, leggero | meno "reale" |

* Dati da cui alimentare la vista: eventi osservati dalla pagina (strada 1) e, con Electron, Raw Input (A) + firma (B1)
  per distinguere il pad dalla tastiera; l'impulso di pressione è un tap, la rotella si ripete finché il tasto è tenuto.

## Prototipi realizzati (12/10/2026)

* **`tools/PadBridge.ps1`** — il "ponte": Raw Input passivo filtrato su `VID_1189`, pubblica solo gli eventi del pad su
  `http://127.0.0.1:5174/events` (SSE). Verificato: `/health` risponde, CORS solo per l'origine dell'app, **403** per origini
  o Host non consentiti, eventi di altri dispositivi scartati e solo contati.
* **`app/live.html`** — prima versione della **vista realtime**: sagoma reale del pad, tasti che si abbassano, manopole
  che ruotano (±18° per scatto) e si premono, layer rilevato dall'azione, sequenze parallele (più controlli insieme),
  segnalazione di ambiguità, cronologia. Legge il profilo salvato dal configuratore (stessa origine). Senza ponte usa
  gli eventi della pagina (finestra in primo piano).
* Linguaggio grafico e geometria reale: **`docs/DESIGN.md`**.

### Disambiguazione per durata (12/10/2026)

Caso segnalato in prova: Volume − sul tasto 4 **e** sulla manopola alta ↺ → la vista accendeva anche i tasti.
Dal log Raw Input: una **rotazione** ha pressione e rilascio nello stesso istante (0 ms), mentre tasti e pressione della
manopola restano giù 15–170 ms. La vista, quando la stessa azione è su controlli di ruolo diverso (rotazione vs pressione),
attende fino a 25 ms e classifica: rilascio entro **8 ms** → impulso di rotazione; altrimenti → pressione.
Verificato con eventi simulati (rotazione, tasto 79 ms, tocco rapido 16 ms). **Resta ambiguo** il caso *pressione della
manopola ↔ tasto con la stessa azione* (entrambi "giù"): si risolve con azioni diverse o con la firma F13–F24.

## Altri requisiti raccolti

* Una sola pagina HTML (WebHID) usabile anche da browser, poi impacchettata in Electron (scelta di progetto).
* Scrittura **sempre** protetta da avviso e conferma; modalità simulazione di default (il pad non si può leggere).
* Profili salvati ed esportabili in JSON (il pad è l'unica copia della config, ma non è leggibile).
* Pausa tra le pressioni = pacchetto separato (corretto il 12/10/2026).
* Il Bluetooth non è programmabile (provato; vedi `BLUETOOTH.md` §6): l'app lo dice nello stato.

## Idee emerse, da valutare
* Cambio "profilo" rapido (set di 3 layer) con un clic, più copia/incolla tra tasti e layer, annulla.
* Icone per media/mouse, vista d'insieme dei 3 layer, tema chiaro/scuro manuale.
* Scoperta dei **modi LED** 0–5 con anteprima (il layer attivo si vede solo in USB).

## Correzioni della vista live dopo la prova sul pad (12/10/2026)

Segnalazioni: Muto appariva solo come "accenno" blu; Rotella ↑/↓ non restavano premute; ruotando la manopola alta si riaccendevano
i tasti volume e, a tratti, la manopola "si cliccava".

| Causa | Correzione |
|---|---|
| Il ponte marcava gli eventi con `DateTime.UtcNow`, che avanza a passi di ~15,6 ms: una rotazione (down+up in 2–5 ms) a cavallo di due passi sembrava una pressione di 15 ms → si accendevano i tasti volume. | `PadBridge.ps1` usa `Stopwatch` (alta risoluzione) e un ciclo che si sveglia sul messaggio (`MsgWaitForMultipleObjects`) invece di `Sleep(2)`. L'handshake `hello` dichiara `precise:true`; la pagina avvisa se il ponte è vecchio. Soglia rotazione/pressione 8 → 20 ms, attesa 25 → 30 ms (con tolleranza se il thread è in ritardo). |
| Una seconda rotazione entro 110 ms nello stesso canale veniva trattata come "controllo già premuto": niente animazione e la manopola risultava cliccata. | Lo stato "premuto" è derivato dai canali attivi (`render()`); ogni scatto di rotazione ruota la manopola (`tick`) e non imposta mai "premuto" su una manopola. Risolto anche un possibile controllo "fantasma" rimasto bloccato. |
| Muto è su Tasto 6 e Manopola 1 (premi): stesso messaggio, stesso ruolo (entrambe pressioni) → indistinguibili; la vista li mostrava come "forse" (blu tenue). | Le azioni duplicate dello stesso ruolo si accendono insieme in modo pieno, e il pannello elenca i duplicati con il suggerimento di assegnare azioni diverse. |
| La rotella è un impulso senza rilascio; un tasto tenuto la ripete, ma il segnale veniva mostrato 110 ms. | Primo impulso: 250 ms; se ne arriva un altro entro 700 ms il tasto resta premuto finché gli impulsi continuano (finestra = 1,8 × intervallo, 250–900 ms). |

Aggiunto un registro "Eventi grezzi (diagnostica)" nel pannello: intervalli tra eventi e durata di ogni pressione, con pulsante Copia.

## Firma univoca per controllo e layer (14/10/2026) — implementata, da verificare sul pad

**Problema segnalato:** la vista live riconosceva solo i controlli la cui azione non esiste nel layer visualizzato; con
la stessa azione su più controlli/layer (es. Volume − sul tasto 4 del layer 1 e sul tasto 3 del layer 2) accendeva il
controllo del layer *visualizzato*, non quello fisico.

**Soluzione (due parti):**

1. **Firma in testa alla macro.** Con "Firma univoca (F13–F21)" attiva, il configuratore antepone a ogni azione di tipo
   tastiera due tasti F13–F21 che codificano `n = (layer−1)·24 + (id−1)` (0…71) in base 9: `F13+⌊n/9⌋`, `F13+n%9`.
   54 combinazioni (18 controlli × 3 layer), tutte distinte (test automatici). La macro è memorizzata nel pad, quindi la
   firma viaggia **anche in Bluetooth**; la programmazione resta solo via USB. Il limite sale a 16 pressioni utili.
   In testa (e non in coda) perché l'ultima coppia è quella che il firmware mantiene premuta mentre il controllo è tenuto.
2. **Layer fisico separato dal layer visualizzato.** La vista live tiene `padLayer`, dedotto dagli eventi: un evento
   firmato (o con un'azione presente in un solo layer) lo stabilisce; per gli eventi ambigui (media, mouse) si usa il layer
   fisico noto, non quello selezionato nell'interfaccia. Il controllo acceso è sempre quello *fisico*; il layer
   visualizzato cambia solo le etichette.

**Limiti (strutturali):** media e mouse sono un solo tipo di report per controllo e non possono portare la firma. Si
riconoscono dall'azione, e il layer arriva dall'ultimo evento firmato. Opzione sperimentale "Volume e Muto come tasti":
li invia come usage tastiera 0x7F/0x80/0x81 (Windows li tratta da tasti volume, da verificare) così hanno la firma.
Play/Pausa, Traccia ±, rotella e pulsanti mouse restano non firmabili.

**Da verificare su hardware (non provato):**
* il firmware accetta F13–F21 (usage 0x68–0x70) nel report tastiera — `docs/PROTOCOL.md` lo segnava "da verificare";
* una macro con firma + azione si comporta bene quando il controllo è *tenuto* (frecce che si ripetono, Ctrl+A tenuto);
* Volume/Muto come tasti (0x7F–0x81) producono davvero il volume in Windows e arrivano come VK 173–175.

**Prova:** configuratore → attiva "Firma univoca" → "Invia tutti i layer" (scrittura attiva) → start.cmd →
premi un controllo per layer; l'ispettore indica "Univoco" per i controlli firmati e la pillola mostra "N firmate".
Se qualcosa non va: spegni la firma e reinvia (la firma è solo una scelta di codifica, la configurazione si riscrive).

### Controlli senza azione (14/10/2026)
Un controllo senza azione non emette nulla: premerlo non rivela il layer fisico (segnalato in prova: "se un tasto non è
mappato in un layer, non cambia layer sulla UI"). Con la firma attiva, **i controlli senza azione inviano la sola firma**
(opzione "Firma anche i controlli senza azione", attiva di default; `MP.withSignature(…, null, {signEmpty})`). Invisibile alle
app (F13–F21), serve solo alla vista live. I controlli "Disattiva" (tipo clear) restano muti per scelta.
Il pad ha ora 54 controlli × layer che emettono una firma, tranne i media/mouse non convertibili.

### Media e mouse duplicati: esecuzione sul PC (14/10/2026)
Verificato su hardware: un controllo media emette **un solo report** (anche con più usage nel frame), Windows scarta Volume/Muto
come tasti (0x7F–0x81) e il pulsante Layer del pad non invia nulla. Quindi due controlli con la stessa azione media erano
indistinguibili e il cambio layer passava inosservato (segnalato in prova: tasto 6 e manopola alta entrambi "premuti";
Volume − del tasto 4 L1 e del tasto 3 L2 confusi).

Scelta di progetto (opzione "Esecuzione sul PC"): per ogni gruppo di azioni media/mouse **identiche** nel profilo UN controllo
resta nativo (rotazione > tasto > pressione manopola; a parità layer e ID più bassi) e gli altri inviano **solo la firma**;
l'azione la esegue il ponte (`tools/PadBridge.ps1` v3) leggendo la firma dal Raw Input.

* Logica: `MP.hostedControls(profile, layout)` (configuratore) = `hostedControls` in `live.html` (un test li confronta).
* Scrittura: `withSignature` → macro tastiera con la sola firma; `tools/profile-frames.js` lo applica (`--no-host-actions` per escluderlo).
* Ponte: `POST /hostmap` (solo Origin dell'app) con la mappa `{s:[vk,vk], k:'key'|'wheel'|'btn', …}`; lista bianca: tasti VK
  0xA6–0xB7, rotella ±120 con Ctrl/Maiusc/Alt, clic. Resta in memoria; la pagina la reinvia a ogni connessione e a ogni
  modifica del profilo. `-NoHost` la disattiva. `/health` mostra `hostEntries` e `hostRuns`.
* Limite: i controlli eseguiti dal PC funzionano solo con ponte e pagina collegati (non su telefono o altri dispositivi);
  il primo controllo di ogni funzione resta nativo e funziona ovunque.
* Effetto sulla vista live: ogni controllo è univoco (nativo = evento media unico, eseguito dal PC = firma), il layer fisico
  si aggiorna a ogni pressione di un controllo firmato o di un media unico.

### Da fare a breve (14/10/2026)
1. **Configuratore dei tasti nella UI live** (prossimo passo).
2. **Pressioni contemporanee e riconoscimento veloce.** Oggi la vista live gestisce più sequenze in parallelo e il layer fisico
   è dedotto dagli eventi firmati, ma non è mai stato provato premendo due controlli insieme. Rischi noti: firme intercalate
   (il ponte cerca due F13–F21 consecutivi entro 40 ms), attese di 90 ms per chiudere una sequenza, soglie rotazione/pressione
   (20/30 ms). Servono misure sul pad (due tasti insieme, tasto + rotazione) e una modalità a bassa latenza.
3. **Ripetizione a tasto tenuto, selezionabile per controllo**: "continua a inviare finché è premuto" oppure "una volta, poi
   rilascia per rimandarlo" (volume, lettere, frecce). Misurare prima il comportamento del firmware (macro con firma tenuta,
   media tenuto: la rotella del mouse si ripete già). Per i controlli eseguiti dal PC la ripetizione andrebbe emulata dal ponte
   (richiede di sapere quando il controllo viene rilasciato: la firma da sola non lo dice).

#### Misure su hardware: tenuta e pressioni contemporanee (14/10/2026)
Catture passive con tasti a lettera singola (layer 3, senza firma) e con macro firmate (layer 1):

| Caso | Risultato |
|---|---|
| Tasto **singolo** (1 coppia, senza firma) tenuto | pressione e rilascio **seguono la mano**; Windows ripete da solo (attesa ~500 ms, poi ogni ~31 ms) |
| 2 e 3 tasti singoli premuti insieme | **tutti riconosciuti** (scarti 4–17 ms tra le pressioni), rilasci indipendenti |
| Manopola ruotata mentre un tasto è tenuto | riconosciuta; il tasto continua |
| Tocchi alternati A/B (~10 al secondo) | nessuna perdita |
| Macro **firmata** (2+ coppie) tenuta | un solo "tocco" di ~6 ms per tutta la durata: nessun tenuto, nessuna ripetizione |
| Due macro firmate premute insieme | la seconda esce con 1,5–2 s di ritardo (verosimilmente al rilascio della prima); con tre ne esce una sola in meno. **Da confermare** con macro a 2 passi senza firma |
| Media (Muto) tenuto | giù/su fedeli alla mano (2,4 s), nessuna ripetizione; un impulso di rotazione azzera il media tenuto |
| Tasto 9 (Ctrl+rotella) tenuto | rotella una volta, poi il pad ripete il Ctrl ogni ~32 ms |

Conclusione: il pad gestisce bene tenuta e accordi **solo per i controlli a una coppia**. La firma (macro a 3 passi) li
trasforma in un tocco e li serializza. Tre modalità possibili per controllo: *nativo* (tenuta/accordi perfetti, identificato dall'azione),
*firmato* (univoco, ma tocco e niente accordi), *sensore* (il pad invia un tasto/combinazione unica a una coppia, tenuta e
accordi nativi, e il ponte esegue l'azione reale: richiede il PC).

### Firma automatica: solo dove serve (14/10/2026)
Scelta dopo le misure su tenuta e accordi: la firma costa la tenuta nativa (la macro diventa un tocco), quindi **si
firma solo quando l'azione si confonde con un'altra**, in qualunque layer, così il layer non viene mai sbagliato.

* Piano: `MP.signPlan(profile, layout)` → `keys` (controlli a tastiera da firmare) + `hosted` (media/mouse eseguiti dal ponte).
  Conflitto = stessa sequenza (Ctrl sinistro/destro equivalenti) oppure una è l'inizio dell'altra. Resta normale il primo per
  priorità (tasti, poi pressione di manopola, poi rotazione; poi layer e ID più bassi), gli altri si firmano.
* Per controllo: `a.sign = 'on' | 'off'` (selettore "Firma" nell'ispettore); `profile.signAll` firma tutto (come prima).
* Controlli normali = una sola coppia → tenuta e ripetizione di Windows native; la vista live li riconosce dall'azione e ne deduce
  il layer. Media/mouse unici restano nativi; i duplicati restano "solo firma" + ponte (sezione precedente).
* Vista live: spegnimento immediato dopo l'ultimo passo di una sequenza completa; un controllo già rilasciato si spegne quando ne
  viene premuto un altro (niente due controlli accesi con tocchi alternati veloci).
* Test: `app/test/protocol.test.js` confronta configuratore e vista live su 300 profili casuali.
* Pad scritto con il profilo di prova: 9 controlli del layer 1 passati da firmati a normali (tasti 1–3, manopole 2 e 3);
  restano firmati solo i 5 media duplicati (eseguiti dal PC) e i controlli vuoti (sola firma, per rivelare il layer).

### Configuratore dentro la vista live (14/10/2026)
`app/live.html` ora modifica i controlli: seleziona un tasto o una manopola → **Modifica** nella scheda.

* Tipo (Nessuna/Tastiera/Media/Mouse/Disattiva), sequenza di tasti (registra dalla tastiera **o dal pad**, testo, pausa), media, mouse con
  modificatori, e selettore di firma Automatica/Sempre/Mai. Per le manopole si sceglie ↺ / premi / ↻.
* In modifica la vista resta sul layer che si sta modificando (nessun salto se il pad cambia layer); a "Fine" torna alla modalità
  precedente (Auto segue il layer fisico).
* Il profilo è lo stesso del configuratore (`localStorage`); il modulo di protocollo si legge da `index.html` (unica fonte).
* Invio: la pillola **Da inviare al pad · N** confronta i pacchetti attuali con l'ultima istantanea inviata (`macropad-studio.sent.v1`;
  al primo uso si assume il pad allineato) e invia solo i controlli cambiati — compresi quelli il cui stato di firma è cambiato per
  effetto di un duplicato — con "azzera" + azione, 150 ms tra i pacchetti e ripasso dell'ultimo. WebHID (Chrome/Edge), cavo USB,
  conferma esplicita ogni volta. "Invia tutti i layer" riscrive tutto tranne i controlli senza azione.
* Limiti: LED non modificabili qui (restano nel configuratore); WebHID apre l'interfaccia in esclusiva (chiudere il
  configuratore se aperto); non verificato su pad reale al momento della scrittura di questa nota.
* UI dell'editor (rifinita su feedback): tipo a 4 riquadri con icona (Tastiera, Media, Mouse, Nessuna) e "Disattiva del tutto" come
  azione secondaria; mouse a gruppi uguali (Clic: sinistro/centrale/destro, Rotella: su/giù, modificatori); funzioni media in un
  elenco a discesa dello stile dell'interfaccia (il menu di sistema era illeggibile); scorrimento interno senza barre visibili.

### Stato del collegamento, invio rifatto e LED nella vista live (14/10/2026)
* **Collegamento:** il ponte (`PadBridge.ps1`, hello con `link:true`, evento `status`) guarda l'elenco dei dispositivi di input di
  Windows ogni 1,5 s e controlla solo se il nome contiene `VID_1189` (USB) o l'indirizzo BLE del pad (wireless); nessun altro nome
  viene conservato. La vista live mostra accanto a "LIVE" un indicatore: verde USB, blu wireless, rosso non collegato, grigio ignoto
  (ponte spento; senza ponte, se WebHID ha già il pad autorizzato risulta USB). Verificato: USB presente, BLE assente.
* **Invio:** foglio ridisegnato (elenco chip dei controlli, riga di stato, un solo pulsante "Invia al pad"/"Collega e invia", barra di
  avanzamento, esito con ✓); niente casella di conferma (il pulsante è esplicito); "Riscrivi tutto" come azione secondaria.
* **LED:** clic sulla scheda LED → colore (7 + bianco, codice 0 da verificare) ed effetto per layer, con invio diretto. I LED fanno parte
  delle modifiche da inviare (`led:N`).
* **Modi LED (ipotesi dal progetto ch57x-keyboard-tool, modelli 0x8840/0x8842, stesso formato):** 0 spento, 1 fisso ("backlight"),
  2 "shock", 3 "shock2", 4 "press" (si accende il tasto premuto), 5 ignoto. Colore e modo sono **per layer**: il protocollo noto non
  ha colori per singolo LED. In Bluetooth i LED dei tasti risultavano spenti con il modo 1; gli altri modi non sono stati provati in
  wireless (la programmazione resta solo USB).

### Identità "sensore" per il wireless (14/10/2026)
Segnalato in prova: in Bluetooth Play/Pausa funzionava ma Volume −/+ (tasti 4 e 5, eseguiti dal PC) no, e lo stato risultava
"ignoto". Causa verificata: i tasti F13–F21 della firma non arrivano in Bluetooth (vedi PROTOCOL §10.5), quindi il ponte non vedeva
la firma dei controlli "eseguiti dal PC".

* Controlli vuoti ed eseguiti dal PC ora inviano un usage consumer riservato (`MP.sensorUsage(id, layer)`), non due tasti F.
* Il ponte (`PadBridge.ps1`) accetta voci `{u: usage, k: …}` nella mappa e le esegue quando vede quell'usage (USB e BLE).
* La vista live riconosce questi controlli come eventi media di valore riservato (univoci per controllo e layer).
* Resta: le macro a tastiera firmate (azioni a tastiera duplicate) in wireless non si identificano.
* Da inviare al pad: i controlli vuoti e quelli eseguiti dal PC cambiano pacchetto → compaiono come "da inviare" nella vista live.

### Effetti LED verificati (15/10/2026)
Provati in USB: 0 spento, 1 fisso, 2 sequenza 1→9 a ogni pressione, 3 sequenza 9→1, 4 tasto premuto (dissolvenza di ~0,5 s a
pressione e rilascio), 5 tutti bianchi (il colore non conta). In Bluetooth i LED dei tasti restano spenti. Aggiunta nella vista live
"Prova valori non documentati" (modi 6–15, colori 8–15) per scoprire se il firmware ha altri effetti. Non si possono creare effetti
nuovi: sono nel firmware; animarli dal PC riscriverebbe la flash a ogni fotogramma e non vale in wireless.

### Vecchio configuratore in pensione (15/10/2026)
Esito della prova dei valori LED non documentati (prova manuale): colori 8–15 = bianco; modi 6–9 e 12–15 = "tasto premuto"; **10** = andata e
ritorno 1→4→1 a ogni pressione; **11** = tasto premuto netto (senza dissolvenza). Aggiunti 10 e 11 all'elenco, tolti gli alias.

Verifica funzione per funzione del vecchio `index.html` prima della rimozione:

| Funzione | Esito |
|---|---|
| Collegare il pad, stato | portata (pulsante "Collega e invia", indicatore USB/wireless/non collegato) |
| Interruttore "scrittura attiva" / simulazione | tolta: l'invio è un gesto esplicito |
| Tab dei layer, pad | già nella vista live |
| Editor tastiera: registra, svuota, testo, pausa | portato |
| **Selezione manuale del tasto con modificatori** | **portata** (elenco di tutti i tasti + Ctrl/Maiusc/Alt/Win) |
| Media, mouse, disattiva, nessuna | portati (UI rifatta) |
| **Anteprima del pacchetto in esadecimale** | **portata** ("Dettagli tecnici" nella scheda) |
| Invia controllo / invia layer / invia tutto | sostituiti da "Da inviare al pad" + "Riscrivi tutto" |
| LED per layer | portato, con i modi verificati |
| **Opzioni di firma (4 interruttori)** e riepilogo | **portate** (Impostazioni) |
| **Esporta / importa profilo** | **portato** (Impostazioni) |
| Avviso "usa già F13–F21", "troppi tasti" | portati nell'editor |
| Procedura guidata "Mappa controlli" | **non portata**: la mappa ID↔tasto è verificata su questo pad (docs/PROTOCOL §10) |
| "Byte alternativi" del mouse | **non portata**: il layout standard è verificato |
| Volume come tasti (0x7F–0x81) | **non portata**: Windows li scarta |
| Registro dei pacchetti / monitor eventi | sostituiti da "Diagnostica" e dai "Dettagli tecnici" |

`index.html` e i suoi backup (`index-v*.html`) sono stati eliminati; il protocollo vive in `app/protocol.js`.

### Simboli sui tasti e verifica adattiva (15/10/2026)
* **Simboli:** libreria di 26 icone SVG (griglia 24, tratto 1,9, stessa grammatica dei riquadri "Cosa fa") al posto del testo per
  Play/Pausa, Volume +/−, Muto, traccia successiva/precedente, clic sinistro/centrale/destro, rotella su/giù (con didascalia
  dei modificatori), frecce, Invio, Backspace, Canc, Tab, Spazio e le scorciatoie Ctrl+C/V/X/Z/Y/S. Il testo resta per ogni altra macro.
  Mappatura in `iconFor()` (app/live.html); la scheda mostra simbolo + testo.
* **Colori LED:** gli 8 campioni stanno in una sola riga (si restringono, non vanno a capo).
* **Adattivo:** tre fasce (≤1500, ≤1180, ≤1000, ≤760, ≤480 px) e altezze basse (≤560, ≤480). Nulla si nasconde senza alternativa:
  Impostazioni e Diagnostica diventano pulsanti-icona, le azioni recenti passano sopra la barra delle connessioni, la barra dei
  layer scende su una seconda riga, le schede e i fogli calcolano lo spazio libero reale e scorrono dentro (senza barre).
  Verificato con un controllo automatico delle sovrapposizioni e dei bordi in 12 dimensioni (360×640 … 2560×1080, 1280×480, 600×420)
  e in 6 stati (base, scheda, modifica, LED, impostazioni, invio): nessuna sovrapposizione né elemento fuori schermo.
* **Correzioni:** "Volume +" non veniva scambiato per una scorciatoia (comparivano due tasti vuoti); testi sulla firma aggiornati
  al codice identificativo.

### Ripetizione a tasto tenuto (15/10/2026)
Opzione per controllo `a.hold` = `'repeat'` | `'once'` (assente = automatico), nella scheda di modifica ("Tenuto premuto").

| Tipo | Automatico | Ripeti | Una volta |
|---|---|---|---|
| Tasto singolo (1 combinazione, senza pausa) | tenuto si ripete (Windows) se non è firmato | tasto normale, non firmato (anche se duplicato) | tocco: viene firmato |
| Macro a più tasti o con pausa | una volta | — | — |
| Media | nativo: una volta (Windows può ripetere il volume) | **eseguito dal ponte**, che ripete finché è premuto | **eseguito dal ponte**, una sola volta |
| Rotella del mouse | uno scatto | **eseguito dal ponte**, ripete gli scatti | eseguito dal ponte, uno scatto |

* Il ponte vede pressione e rilascio del codice consumer del controllo: la ripetizione parte dopo `repeat.delay` ms (450) e
  ripete ogni `repeat.rate` ms (70) fino al rilascio, a una nuova pressione, allo stop del ponte o dopo 20 s (tetto di sicurezza).
  Valori in Impostazioni → "Ripetizione a tasto tenuto" (`profile.repeat`). I clic del mouse non si ripetono.
* Un controllo con scelta esplicita non occupa il posto "nativo" del suo gruppo di azioni uguali; "Ripeti" sui tasti vince su
  "Firma tutti i controlli".
* Verificato: logica di firma/ponte nei test (54), ripetizione del ponte con una prova a tavolino (1 esecuzione subito, ~10 in
  750 ms, 0 dopo il rilascio, 1 per un impulso breve). **Non ancora provato sul pad.**

### Grafo di conoscenza per gli agenti: graphify (15/10/2026)
* Aggiunto per rendere il repository più leggibile agli agenti AI. Pacchetto PyPI `graphifyy` (CLI `graphify`, già
  installato con `uv tool` in `~/.local/bin`, non nel PATH), sorgente github.com/Graphify-Labs/graphify.
* Aggiunti: `.graphifyignore`, `graphify-out/` (graph.json, GRAPH_REPORT.md, graph.html; solo AST del codice, nessuna API),
  `CLAUDE.md` (panoramica del progetto + regole del grafo), `.claude/skills/graphify/` (skill `/graphify`) e `.claude/settings.json`
  (hook PreToolUse `graphify hook-guard`, consultivi, percorso assoluto dell'eseguibile).
* Per renderlo utile il codice è stato reso leggibile all'estrazione AST (comportamento invariato, 54 test): `protocol.js` ora è una
  IIFE con dichiarazioni `function` che espone `globalThis.MP`, e la logica di `live.html` è in `app/live.js`. Prima il grafo non
  vedeva né `signPlan` né le funzioni dell'interfaccia (HTML con script in linea e funzioni dentro `const MP = (() => …)()`).
* Resta fuori dal grafo: i documenti (servirebbe `/graphify .`, con un modello) e le funzioni a freccia assegnate a `const`
  dentro le IIFE; i `.ps1` con C# incorporato hanno pochi simboli.
* **Documenti indicizzati (15/10/2026):** eseguito il flusso `/graphify .` (estrazione semantica con un sottoagente su 9 documenti:
  129 nodi, 226 archi, ~147 mila token). Il grafo ora ha 401 nodi (274 codice, 105 concetti, 13 motivazioni, 9 documenti),
  779 archi e 30 comunità con nome. `graphify update .` (solo AST) mantiene i nodi semantici. I documenti modificati dopo
  l'estrazione verranno rielaborati da `/graphify --update`.

### Pubblicazione (15/10/2026)
Per il repository pubblico: software del produttore, foto del listing, backup `live-v*.html` e guscio Electron mai provato sono stati tolti;
strumenti di analisi in `tools/research/`; foto in `docs/images/`; il lanciatore è `start.cmd` nella radice. L'indirizzo BLE del pad non è più
nel codice: si passa con `-BleAddress`/`-Address`, con `MACROPAD_BLE_ADDRESS` o si ricava dal nome `MINI_KEYBOARD`. `graphify-out/` e
`.claude/` restano locali (`.gitignore`).
