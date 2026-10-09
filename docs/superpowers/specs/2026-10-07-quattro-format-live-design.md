# Quattro nuovi format della regia Backrooms — Drum Challenge, Studio Production, Podcast, Reaction Release

Data: 2026-10-07 · Stato: design e spec approvati in chat; implementata, da provare sul PC della diretta (vedi i limiti noti nel README)

## 1. Obiettivo

Aggiungere a `overlay-live` i layout **5°–8°** della regia, con la stessa veste grafica dei precedenti
(vetro viola, cromo, monete BR, neon ciano/magenta/oro, Barlow Condensed e Grenze Gotisch):

| Layout | Nome in regia | Pagina | Formati |
|---|---|---|---|
| `drum` | Drum Challenge Live | `/drum.html` | 9:16 |
| `produzione` | Studio Production | `/produzione.html` | 9:16 |
| `podcast` | Back Rooms Podcast | `/podcast.html` | 9:16 e 16:9 (`?formato=orizzontale`) |
| `reaction` | Reaction Release | `/reaction.html` | 9:16 e 16:9 (`?formato=orizzontale`) |

Successo = la regia porta a termine una diretta di ciascun format dalla pagina di regia o dallo Stream Deck, senza
toccare i file a mano: i Like di TikTok riempiono e sbloccano i brani del Drum, i titoli e le tematiche si cambiano in
tempo reale, i moduli del podcast si accendono a comando, e ogni pagina rispetta le zone di TikTok (9:16) o la
griglia 1920×1080 (16:9).

Scopo di business: far crescere interazione e regali delle live (Like, «Dona un…») e portarle a prenotazioni di
sessioni in studio (obiettivo dello studio: 10.000 €/mese). Ogni layout porta in vista i social dello studio.

## 2. Contesto, vincoli e come ho letto il brief

- `overlay-live` è un progetto Node ≥ 22 separato dal sito Next.js: `server.mjs` (HTTP + WebSocket, porta 4747), logica
  pura in `lib/*.mjs`, pagine in `public/` senza build, 138 test con `node --test`. Gira in locale sul PC della diretta.
- Si lavora sul branch `claude/practical-cannon-6wegnn`; i commit che non toccano il sito portano `[skip netlify]`.
- Stesse regole dei layout esistenti: sorgente Link di TikTok LIVE Studio con indirizzo `.html`; tela 1080×1920
  visibile circa x 104…976, contenuti tra x 116 e 964; zone TikTok: intestazione 0–230 (fino a ~270 con il nome della
  live), zona libera 230–1200, chat a sinistra e cuori/regali a destra 1200–1700, barra commenti 1700–1920. Orizzontale
  1920×1080 (come `overlay.html?formato=orizzontale`). Le camere sono sorgenti di LIVE Studio/OBS **sotto** la pagina.
- **Vetro «smerigliato»**: una pagina non può sfocare la camera che sta dietro (è un'altra sorgente). Il vetro si
  simula con fondo scuro semitrasparente, grana sottile, bordo cromato e riflessi: sulla camera si vede come vetro,
  non sfocato.
- Interpretazioni del brief (vincolanti per il piano):
  - **Drum, riempimento sequenziale**: si riempie solo la tappa attiva, con i Like fra la tappa precedente e la sua;
    le successive sono chiuse. Allo sblocco il fuoco passa alla seguente.
  - **Scaletta «dinamica»** = modificabile dalla regia e la colonna scorre da sola mentre si sblocca.
  - **«Dona un [slot]» sempre in vista** (scelta della regia): widget fisso, con una pulsazione periodica.
  - **Equalizzatore dall'audio di FL Studio** (scelta della regia): lo ascolta la regia; niente MIDI.
  - **Doppio formato** = stessa pagina con `?formato=orizzontale`, come la gara.
  - **Striscia social orizzontale** anche nel Reaction 16:9 affiancato: in basso, a tutta larghezza.

## 3. Fuori ambito (YAGNI)

- Nessun MIDI. Nessun riconoscimento automatico dei regali (il widget «Dona un…» non legge la chat).
- Nessun blur reale della camera. Nessun cambio ai layout `gara`, `senzaPremio`, `studio` e `battle`, salvo estendere
  `LAYOUT`, `WIDGET`, le route, il selettore «In onda», le regole su chi suona e spostare la lista dei social della
  regia in una scheda propria (§9).
- Nessun titolo preso da Spotify/YouTube; nessuna registrazione di clip; nessun `?w=` per dividere le sorgenti dei
  nuovi layout (una sola sorgente per layout).
- Il refactoring dei layout esistenti per usare i nuovi moduli condivisi non si fa.

## 4. Fondamenta condivise

Nuovi moduli usati **solo** dalle quattro pagine nuove (le vecchie pagine non si toccano):

- `public/js/pagina.js` — avvio comune: parametri URL (`anteprima`, `guide`, `statico`, `formato`), classi del `body`
  (`verticale`/`orizzontale`), scala automatica del palco (1080×1920 o 1920×1080), utilità (`nodo`, `simbolo`,
  `rilancia`, `adattaTesto`, `scriviConLink`, monete 3D BR) e collegamento WebSocket.
- `public/js/simboli.js` — inietta nel documento i gradienti e le icone SVG (le stesse delle altre pagine più:
  `cuore`, `rosa`, `corona`, `regalo`, `stella`, `diamante`, `lucchetto`, `spunta`, `play`, `cappello`, `manopole`).
- `public/js/formati-logica.js` — funzioni **pure** (testate): voci della fascia social, finestra della scaletta,
  formattazione dei Like (`12.480`, `15K`), preset dei titoli, tematica attiva.
- `public/css/formati.css` — vetro (`.fm-vetro`), cornice a staffe, targa del titolo, fascia social a larghezza
  variabile, finestre con cornice cromata, linea verticale.
- `public/js/nastro.js` — le costanti 980/1500 (valide solo per 1080) diventano opzioni `bordoVisibile` e `riempiFino`
  con quei valori come predefiniti: le pagine vecchie non cambiano; le orizzontali usano 1800/2400.
- `lib/testi.mjs` — dimensione dei testi (§11), riuso del metodo del battle (percentuale per testo, 60–200%).

**Vetro.** Fondo `rgba(12, 8, 28, 0.38)` con sopra un gradiente bianco 0,18 → 0,04, bordo cromato da 1,5 px
(maschera come `.bordo-cromo`), luce nel terzo alto, ombra morbida scura, grana SVG (`feTurbulence`) al 7%; il testo ha
sempre ombra scura per leggersi sulla camera.

**Fascia social.** Stessi pezzi e stile di `senza-premio.css` (`.sp-pezzo`, `.sp-voce`, monete BR ai lati), altezza
92 px, larghezza 1080 o 1920. Voci = i social accesi della regia (`senzaPremio.voci`) con le voci dei layout inserite
dopo la prima: l'**artista ospite** (Drum) e gli **ospiti** (Podcast). Velocità regolabile (px/s) per layout.

**Layout, widget e stato.** `LAYOUT` = `["gara", "senzaPremio", "studio", "battle", "drum", "produzione", "podcast",
"reaction"]`. Nuovi `WIDGET`: `drumCornice`, `drumTraguardi`, `drumBrano`, `drumPriorita`, `drumBarra`, `prTitolo`,
`prBarra`, `reTitolo`, `reBarra`, `poTitolo`, `poLinea`, `poTematiche`, `poBarra`. Partono accesi tutti tranne
`poLinea` e `poTematiche` (moduli «a comando») e il già esistente `bracket`.

## 5. Drum Challenge Live (`/drum.html`, 1080×1920)

Telecamera a tutto schermo sotto la pagina (batterista e kit); la grafica sta intorno e sopra, nella zona libera.

### 5.1 Griglia (pixel della tela)

| Pezzo | Posizione | Note |
|---|---|---|
| Brano in esecuzione | x 116–640, y 282–362 | pillola di vetro con mini-equalizzatore, nascosta se vuota |
| Dona un [slot] | x 116–640, y 380–486 | **sempre visibile**; pulsazione ogni 20 s e a comando |
| Contatore Like | x 676–964, y 282–350 | cuore + numero con punti (`12.480`) + «LIKE» |
| Colonna traguardi | x 676–964, y 366–1006 | 4 moduli 288×148, passo 164 |
| Equalizzatore | x 116–964, y 1016–1100 | 40 barre, oppure onda specchiata |
| Cornice | x 116–964, y 262–1100 | staffe d'angolo, filo neon in alto; lampo a ogni colpo |
| Fascia social | x 0–1080, y 1108–1200 | monete BR; slot «Artista ospite» fra le voci |
| Banner sblocco | x 116–640, y 520–690 | 3,2 s allo sblocco, sopra la camera, a sinistra della colonna |

La colonna sta a destra dei widget di sinistra (36 px di spazio) e finisce sopra l'equalizzatore. Fascia e banner
chiudono a y 1200: la chat di TikTok (1200–1700) resta libera.

### 5.2 Like e scaletta (`lib/drum.mjs`, funzioni pure)

```
contati = max(0, tiktokTotale − offset + extra)        // tiktokTotale assente = 0
tappa i raggiunta  ⇔  contati ≥ scaletta[i].like
attiva = prima tappa non raggiunta (nessuna se sono tutte raggiunte)
progresso = (contati − base) / (like attiva − base),  base = like della tappa precedente (0 per la prima), 0…1
```

- **Fonte dei Like**: l'evento `like` di `tiktok-live-connector` (`totalLikeCount`, totale della live; se manca si somma
  `likeCount` al totale già noto). `lib/chat.mjs` espone `likeTikTok(dati)` (pura, testata) e `avviaTikTok(..., { suLike })`.
  A ogni (ri)collegamento il totale noto si azzera; alla prima lettura, se è minore dell'offset, l'offset riparte da 0
  (è una live nuova). Mentre dura il collegamento il totale non scende mai.
- **Correzioni a mano** (`drumLike`): `{ imposta: N }` (il contatore diventa N), `{ aggiungi: ±N }`,
  `{ daOra: true }` (il conteggio riparte da zero, azzera gli annunci).
- **Scaletta predefinita** (37 tappe): 1k, 2k, 3k, 5k, 7k, 9k, 10k, 12k, 15k, 17k, 20k, 22k, 25k, 27k, 29k, 30k
  (dalla regia) e poi 32k, 35k, 37k, 40k, 45k, 50k, 60k, 70k, 80k, 90k, 100k, 125k, 150k, 175k, 200k, 250k, 300k,
  350k, 400k, 450k, 500k (mia scelta, modificabile). Titoli vuoti all'inizio.
- **Formato del testo di regia**: una riga per tappa, `like | titolo` (es. `15k | Back in Black`; `like` = intero, anche
  con punti o suffisso `k`). Regole: crescente, 1…1.000.000, massimo 80 righe, titolo ≤ 60 caratteri. Errori in
  italiano con il numero di riga («Riga 3: i like devono crescere»). Tappa raggiunta senza titolo → «Brano a sorpresa».
- **Annunci**: `annunciati` = tappe già annunciate. Quando le raggiunte superano `annunciati` si emette **un solo**
  evento `sbloccoDrum { indice, like, titolo }` per la più alta e `annunciati` sale; se le raggiunte scendono
  (correzione al ribasso) `annunciati` si riallinea in silenzio.
- **Finestra della colonna** (`finestraScaletta`, pura): 4 moduli = l'ultima tappa sbloccata (se c'è), l'attiva, le
  successive. Con tutte sbloccate, le ultime 4. Stati: `sbloccata`, `attiva`, `chiusa`.

### 5.3 Sblocco (sequenza di ~2,6 s)

1. Il modulo attivo arriva al 100%: urto (scala 1,06, scossa), lampo verde neon (`--verde`), onda d'urto e una
   raffica di perline.
2. Lucchetto → spunta; il bersaglio («15K») diventa verde; il titolo si rivela con effetto «slot» (lettere che girano).
3. Dopo 1 s compare il **banner sblocco** (3,2 s): «BRANO SBLOCCATO» + titolo grande verde neon.
4. A 1,8 s la colonna scorre di un posto (0,7 s): l'ultimo modulo esce in alto, il successivo diventa attivo.

Durante la sequenza la colonna mostra ancora la finestra di prima; i Like nuovi vanno al modulo che diventa attivo.
Mai al primo disegno della pagina. Suono `sblocco` (§5.8). Per i mockup, `?statico=1&sblocco=1` mostra lo stato
finale della sequenza (modulo verde con titolo e banner).

### 5.4 Riempimento (clessidra)

Il modulo attivo è una «clessidra rettangolare»: il livello sale dal basso in proporzione a `progresso` (animato con
easing, nessun salto) e un filo di grani cade dal bordo alto verso la superficie quando i Like crescono. Due stili,
scelti dalla regia (`riempimento`): **perline** (sfere lucide da 14 px, impilate a nido d'ape, colori oro/viola/ciano/
magenta con riflesso) e **sabbia** (grani da 5 px color oro caldo, superficie liscia). Il livello è deterministico
(non una simulazione): i grani che cadono sono solo scena. Canvas 2D, ridisegnato solo quando cambia qualcosa o c'è
animazione; in `?statico=1` si disegna lo stato finale.

### 5.5 Altri widget

- **Brano in esecuzione**: titolo (oro, adattato) e artista; si imposta a mano o con «Suona ora» su un brano sbloccato.
- **Dona un [slot]**: campi `prefisso` («Dona un»), `slot` («Rosa», «Corolla»…, in oro), `sopra` («Salta la coda · scegli
  tu il brano»), `icona` (rosa, corona, cuore, regalo, stella, diamante o logo BR). Pulsazione (luce che attraversa +
  rimbalzo dell'icona) ogni 20 s; `drumPriorita { richiamo: true }` la fa partire subito. Muta.
- **Artista ospite**: `etichetta` («Artista ospite»), `handle` (testo), `icona` (una delle icone social). Compare nella
  fascia dopo il primo social.
- **Cornice**: staffe d'angolo e filo neon; a ogni colpo di batteria (§5.6) il filo e le staffe lampeggiano.

### 5.6 Equalizzatore e audio da FL Studio

Lo ascolta **la regia** (non la pagina: LIVE Studio non dà accesso al microfono alle sorgenti Link) e lo manda alle
pagine come messaggio WebSocket leggero, non salvato nello stato.

- **Sorgenti** nella regia (`public/js/regia-audio.js`): **Ingresso audio** (elenco dei dispositivi: interfaccia,
  mixer, cavo virtuale, loopback; `getUserMedia` senza cancellazione dell'eco) e **Audio del PC** (`getDisplayMedia`
  con audio: scegliere «Intero schermo» e spuntare «Condividi audio di sistema»; Windows, Chrome/Edge; si scarta il
  video). Se LIVE Studio sente FL Studio con «audio del desktop», lo sente anche «Audio del PC».
- **Analisi**: `AnalyserNode` (FFT 1024) → 12 bande logaritmiche 40 Hz–14 kHz, valore 0–100 con la sensibilità
  (50–300%); **colpo** = flusso spettrale nelle bande basse/medie contro una media mobile (soglia adattiva) → 0–100.
  Il passo di lettura (~30/s) lo scandisce un Web Worker, così non rallenta se la scheda è in secondo piano.
- **Protocollo**: regia → server `{ tipo: "audio", b: [12 interi 0–100], c: intero 0–100, pin }`; il server, solo con il
  layout `drum` in onda e con PIN valido (se `pinRegia` è impostato), lo ritrasmette a tutti gli altri client come
  `{ tipo: "audio", b, c }`; al massimo un messaggio ogni 25 ms per connessione, il resto si scarta.
- **Pagina**: barre (40, interpolate dalle 12 bande; salita rapida, discesa lenta, cappuccio che cade) o onda specchiata
  (curva liscia sulle stesse bande, riempimento sfumato). `colpo > 60` → lampo della cornice. Senza dati per 2 s:
  «respiro» lento a bassa ampiezza (spegnibile: `senzaSegnale`). Pulsante **Prova** in regia: schema finto di 4 s.
- La regia deve restare aperta su `localhost` (contesto sicuro) in Chrome o Edge; da un altro dispositivo in rete il
  browser non dà il microfono.

### 5.7 Stato e comandi

```
drum: {
  like: { tiktokTotale, offset, extra }, annunciati,
  scaletta: [{ like, titolo }],
  brano: { titolo, artista },
  ospite: { etichetta, handle, icona },
  priorita: { prefisso, slot, sopra, icona },
  eq: { sensibilita, stile: "barre" | "onda", senzaSegnale },
  riempimento: "perline" | "sabbia",
  velocita, testi,
}
```

L'istantanea aggiunge `drum.contati`, `drum.attiva` (indice o `null`), `drum.progresso`.
Comandi (anche `POST /api/<comando>`): `drumLike`, `drumScaletta { testo? , predefinita? }`, `drumBrano { titolo?,
artista?, daIndice?, svuota? }`, `drumOspite`, `drumPriorita { …, richiamo? }`, `drumEq`, `drumRiempimento { stile }`,
`drumDemo { fase: "vuoto" | "meta" | "sblocco" | "finale" }` (dati di prova per mockup e prove).
`nuovaSerata` azzera i Like e gli annunci e **conserva** scaletta, titoli, ospite, widget, equalizzatore e velocità.

### 5.8 Suoni

Nuovo effetto `sblocco` in `suoni.js` (arpeggio ascendente breve con scintillio e colpo grave, ~1,4 s, sintetizzato).
`suoniDrum(prima, dopo, eventi)` in `eventi-sonori.js`: `sbloccoDrum` → `sblocco`; il resto è muto. Suona solo la
pagina del layout in onda, con le stesse destinazioni (overlay / regia / spenti) delle altre.

## 6. Studio Production (`/produzione.html`, 1080×1920)

Doppio schermo in colonna: webcam del producer sopra, schermo della DAW (FL Studio) sotto.

| Pezzo | Posizione | Note |
|---|---|---|
| Webcam (A) | y 0–1212 | sorgente sotto la pagina; visibile da y ~270 |
| Titolo | x 116–964, y 282–486 | targa 3D cromata 848×204 con monete BR (tre righe con i corpi 28 / 88 / 32 px) |
| Fascia centrale | y 1212–1304 | 92 px, ticker dei social, filo neon sopra e sotto |
| Schermo DAW (B) | y 1304–1920 | 1080×616 (un 16:9 è 608) |

- **Titolo**: `sopra` (≤ 32), `testo` (≤ 28, cromo luccicante, si adatta), `sotto` (≤ 48), punto REC rosso. I **preset**
  riempiono i tre campi e il colore d'accento, poi tutto resta modificabile: **Cooking Beats** (accento oro,
  icona cappello, «Un beat da zero, in diretta»), **Sessione Beat** (accento magenta, icona cuffie, «In studio con il
  producer»), **Mix & Master** (accento ciano, icona manopole, «Mix e master in diretta»). Modifica **in tempo
  reale**: la regia manda ogni cambio mentre si scrive (invio ritardato di 150 ms) e il testo nuovo entra con un
  effetto flip.
- Stato `produzione: { titolo: { preset, sopra, testo, sotto }, velocita, testi }`; comando `produzione { titolo?,
  preset?, velocita? }` (con `preset` si riempiono i campi). Muta (nessun suono, come `studio`).

## 7. Reaction Release (`/reaction.html`, 9:16 e 16:9)

Doppio schermo: **A** webcam host/reaction, **B** screen-share di Spotify/YouTube.

**Verticale 1080×1920**: identico alla produzione (A sopra y 0–1212, fascia 1212–1304, B sotto 1304–1920, titolo
x 116–964, y 282–486).

**Orizzontale 1920×1080** (sfondo di marca **opaco**: gradiente viola scuro con griglia e vignetta; le finestre sono
fori nella pagina):

| Pezzo | Posizione | Note |
|---|---|---|
| Titolo | x 360–1560, y 28–188 | targa cromata 1200×160 (corpi 26 / 58 / 28 px) |
| Finestra A (host) | x 24–600, y 192–894 | 576×702, cornice cromata con staffe |
| Divisore | x 600–648 | linea neon verticale con moneta BR al centro |
| Finestra B (schermo) | x 648–1896, y 192–894 | 1248×702 (16:9) |
| Fascia social | x 0–1920, y 920–1012 | ticker a tutta larghezza |

- **Titolo**: predefinito `testo` = «REACTION RELEASE DELLA SETTIMANA», `sopra` = «Ogni giovedì · ore 01:00», `sotto` vuoto;
  tutti e tre modificabili in tempo reale come nella produzione; accento magenta. Stato `reaction: { titolo, velocita,
  testi }`, comando `reaction { titolo?, velocita? }`. Muta.

## 8. Back Rooms Podcast (`/podcast.html`, 9:16 e 16:9)

Camera del divano/host a tutto schermo sotto la pagina; tre moduli accendibili e una targa. Pagina trasparente.

**Verticale 1080×1920**

| Pezzo | Posizione | Note |
|---|---|---|
| Targa | x 116–964, y 282–410 | «Back Rooms Podcast» + riga episodio (corpi 48 / 32 px) |
| Pannello Tematiche | x 116–964, y 424–904 | intestazione + fino a 8 righe da 48 px, a comparsa |
| Linea di divisione | x 538–542, y 240–1100 | neon cromato, filo che si disegna dal centro |
| Fascia social | y 1108–1200 | social dello studio + ospiti |

**Orizzontale 1920×1080**

| Pezzo | Posizione | Note |
|---|---|---|
| Targa | x 48–560, y 36–164 | |
| Pannello Tematiche | x 48–560 (o 1360–1872 con `lato: dx`), y 176–746 | |
| Linea di divisione | x 958–962, y 0–968 | arriva alla fascia |
| Fascia social | x 0–1920, y 968–1060 | |

- **Linea di divisione** (`poLinea`, spenta all'inizio): l'effetto «intervista doppia»; entra e esce con animazione.
- **Pannello Tematiche** (`poTematiche`, spento all'inizio): elenco degli argomenti del giorno; la **tematica attiva** ha
  bordo oro e freccia, le precedenti sono attenuate con spunta. Si accende e spegne con animazione di comparsa.
  `podcastTematica { avanti | indietro | indice }` sposta l'attiva (Stream Deck, scorciatoie `F2`/`F3`; `F4`
  mostra/nasconde il pannello).
- **Fascia social**: social dello studio più gli **ospiti** (`nome`, `handle`, `icona`, fino a 4) come «Ospite · Nome ·
  @handle».
- Stato `podcast: { titolo: { testo, sotto }, ospiti, tematiche: { titolo, elenco, attiva, lato }, velocita, testi }`;
  comando `podcast { titolo?, ospiti?, tematiche?, velocita? }`. Elenco: massimo 8 voci da 48 caratteri; l'indice
  attivo resta tra 0 e l'ultima voce. `nuovaSerata` riporta l'attiva alla prima. Muto.

## 9. Server, stato e API

- `PAGINE` aggiunge `/drum`, `/produzione`, `/podcast`, `/reaction` (e `.html`). Il messaggio d'avvio stampa i quattro
  indirizzi (e le varianti orizzontali).
- `stato` aggiunge `drum`, `produzione`, `reaction`, `podcast`, uniti ai salvati con `fondiDrum`/`fondiFormati`
  (stesso schema di `fondiBattle`); `istantanea` li include. `lib/drum.mjs` (Drum) e `lib/formati.mjs` (gli altri
  tre) hanno solo funzioni sullo stato, senza I/O.
- Comandi nuovi: quelli di §5.7, `produzione`, `reaction`, `podcast`, `podcastTematica`, `formatoTesti { formato, valori |
  azzera }` (dimensione dei testi). Errori in italiano, come gli altri. `layout` accetta i nuovi valori.
- `connessione.js` gestisce i messaggi `audio` (callback opzionale `suAudio`); `server.mjs` li ritrasmette come §5.6.
- La lista delle **voci social** della regia (`#sp-voci` e «+ Aggiungi voce») passa dalla sezione «Senza premio» a una
  scheda propria **«Social del brand»**, visibile con i layout che usano la fascia (senza premio, studio e i quattro
  nuovi). Gli id e il codice restano gli stessi: si sposta solo l'HTML.

## 10. Regia

Il selettore «In onda» aggiunge i quattro layout; ogni sezione compare solo con il suo layout (come `battle`).
Ognuna ha spunte «In onda», **Dimensione dei testi** (§11), velocità della fascia e anteprima in iframe con link alla
versione grande con le zone (`?guide=1`); per Podcast e Reaction un selettore Verticale/Orizzontale dell'anteprima.

- **Drum**: Like (contatore, stato del collegamento, Imposta, +100, +1.000, «Riparti da ora»); Scaletta (casella
  `like | brano`, Salva, «Ripristina predefinita», elenco con stato e «Suona ora»); Brano in esecuzione; Artista ospite;
  Dona un… (campi, icona, «Richiamo»); Equalizzatore (sorgente, dispositivo, Avvia/Ferma, indicatore di livello,
  sensibilità, stile barre/onda, «Prova», «Mostra anche senza segnale»); Riempimento (perline/sabbia).
- **Produzione / Reaction**: preset (solo produzione), campi sopra/titolo/sotto che aggiornano l'onda mentre si scrive.
- **Podcast**: Titolo/episodio; Ospiti; Tematiche (casella una per riga, elenco cliccabile per scegliere l'attiva,
  Avanti/Indietro, lato del pannello); grandi pulsanti On/Off per Linea, Tematiche, Targa e Fascia.
- Scorciatoie (solo con quel layout in onda): Drum `F2` richiamo; Podcast `F2`/`F3`/`F4` come §8.

## 11. Dimensione dei testi

Come richiesto per il battle, ogni gruppo di testi dei nuovi layout ha un cursore 60–200% (100 = base), salvato nello
stato e tenuto tra le serate. Gruppi: Drum `contatore`, `traguardi`, `brano`, `priorita`, `sblocco`; Produzione e
Reaction `sopra`, `titolo`, `sotto`; Podcast `targa`, `tematiche`. La dimensione arriva alla pagina come variabile CSS
`--ts-<gruppo>` e come moltiplicatore del corpo massimo di `adattaTesto`: i testi nei riquadri si restringono da soli se
non entrano. Il testo scorrevole della fascia social non rientra (la velocità e le voci sì). Comando `formatoTesti`;
`lib/testi.mjs` ha le funzioni pure (valori, errori, azzeramento).

## 12. Verifica

- **Test automatici** (`npm test`; nuovi `test/testi.test.mjs`, `test/drum.test.mjs`, `test/drum-logica.test.mjs`,
  `test/formati.test.mjs`, `test/formati-server.test.mjs`, estensioni di `test/eventi-sonori.test.mjs`,
  `test/stato.test.mjs`, `test/studio.test.mjs`): Like (totale che sale, ritorni, nuova live, correzioni), scaletta
  (lettura, errori con numero di riga, predefinita), progresso e finestra, annunci con salti e correzioni al ribasso,
  messaggi audio (forma, limiti, PIN, ritrasmissione solo con il Drum in onda), preset e titoli, tematiche e indici,
  unione degli stati salvati vecchi, dimensione dei testi, suoni. I 138 test esistenti restano verdi.
- **Prova end-to-end** del server: like simulati via comando e via evento, sblocco, audio via WebSocket.
- **Browser (Playwright)**: strumento `strumenti/mockup-formati.mjs` come `mockup-battle.mjs`: per ogni layout e formato
  controlla che ogni pezzo stia dove dicono le tabelle (±1 px, dentro x 116–964 e y 230–1200 dove richiesto) e salva
  `mockup/<layout>-*.jpg`; fotogrammi dell'animazione di sblocco; **equalizzatore con audio finto** (Chromium con
  `--use-fake-device-for-media-stream` e un file audio di colpi) che verifica barre in movimento, cornice che lampeggia
  e ritorno al «respiro»; flussi della regia (cambio titolo in tempo reale, preset, tematiche, scaletta, Like).
- **Limiti dichiarati**: da qui non si può aprire TikTok LIVE Studio né ricevere Like veri (si simulano): l'evento `like`
  si controlla sul formato dei dati della libreria. «Audio del PC» (`getDisplayMedia`) non si prova qui. Le posizioni sono
  misurate sulle zone del PDF; la prova con le camere vere la fa la regia, regolando le variabili CSS se serve.

## 13. Fasi di consegna (un commit per fase, sul branch di sviluppo)

1. **Fondamenta**: layout, widget, route, `testi.mjs`, `pagina.js`, `simboli.js`, `formati.css`, `nastro.js` con
   opzioni, scheda «Social del brand», scaffolding della regia.
2. **Drum — regole e server**: `drum.mjs`, `chat.mjs` (like), comandi, relay audio, persistenza.
3. **Drum — pagina e regia**: colonna, clessidra, sblocco, widget, cornice, equalizzatore, suoni, regia audio, mockup.
4. **Produzione e Reaction**: logica, pagine (verticale e orizzontale), regia, mockup.
5. **Podcast**: logica, pagine (verticale e orizzontale), regia, mockup.
6. **Documenti e consegna**: README e GUIDA, mockup, revisione finale indipendente, zip dell'`overlay-live` (senza
   `node_modules`).

A fine di ogni fase con grafica nuova mando anteprime (immagini e video) per la diretta da telefono.

## 14. Rischi

- **Like a scatti**: TikTok manda i Like aggregati ogni pochi secondi: il livello sale a salti. L'animazione con easing
  e i grani che cadono nascondono lo scatto; il numero del contatore sale con un conteggio breve.
- **Audio del PC con ASIO esclusivo**: se FL Studio suona in ASIO esclusivo, «Audio del PC» non lo sente: serve un
  ingresso con loopback (interfaccia o cavo virtuale). Se LIVE Studio lo sente con «audio del desktop», va bene.
- **Scheda della regia in secondo piano**: i timer vengono rallentati dal browser; per questo il passo di lettura è in
  un Web Worker, e il browser non sospende una scheda che sta catturando audio. Da confermare con una prova lunga sul PC vero.
- **Vetro non sfocato**: su camere molto chiare la leggibilità si regge su fondo scuro e ombra del testo (§2).
- **Camera dietro la colonna**: la colonna occupa x 676–964; il batterista va inquadrato a sinistra (x 116–640).
- **Font da Google Fonts**: serve Internet sul PC della diretta, come per le altre pagine.
- **Dimensione dei testi molto grande** in riquadri fissi: i testi con nomi si restringono; le cifre grandi no (come nel
  battle, entro circa 120%).
