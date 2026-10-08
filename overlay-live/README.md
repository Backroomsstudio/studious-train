# Overlay live — Backrooms

Overlay per le live di recensione su TikTok: premio in palio in grande, tabellone della traccia in ascolto (Beat, Voce e Mix, ognuno col suo giudice, più il voto della chat), classifica Top 5 animata con podio oro/argento/bronzo e corona, countdown di 3 ore (rosso e lampeggiante negli ultimi 30 minuti), notifiche, effetti sonori, schermata del vincitore e spareggio. Gira in locale sul PC della diretta e non dipende dal sito Next.js.

Lo stesso server fa anche il **layout senza premio** per le live giornaliere di ascolto (`/senza-premio.html`): banner «Mandaci la tua musica!» con `nero.fan/backrooms`, barra che scorre con i social, scheda «Ora in ascolto» che sale quando su Nero parte una traccia, spot dello studio. Stessa regia, stessa traccia automatica da Nero, stessi suoni (vedi [Layout senza premio](#layout-senza-premio)).

C'è anche il layout **Live session in studio** (`/studio.html`): split screen da tre con il fonico in alto, l'artista al centro e la DAW (FL Studio) in basso. Tra fonico e artista c'è una targa 3D con nome e Instagram dell'artista, che si compilano dalla regia. Tra artista e DAW c'è la barra dei nostri social, da cui salgono le comparse «Vieni a trovarci in studio» e «Scrivici in DM». Il layout non ha nessun suono (vedi [Live session in studio](#live-session-in-studio)).

Per gli scontri tra due rapper c'è il layout **Battle** (`/battle.html`): barre della vita in stile Tekken che seguono il voto della chat, camera al centro divisa da un fulmine con il VS, modalità e timer con il gong, tre giudici (Luca, Freya, Daniele), tabellone a torneo o a punti e pop-up social (vedi [Battle](#battle)).

Per le dirette con la camera a tutto schermo ci sono altri quattro layout, con la stessa grafica (vetro viola, cromo, monete BR, neon): **Drum Challenge Live** (`/drum.html`: i Like della live sbloccano una scaletta di brani, con equalizzatore dall'audio di FL Studio), **Studio Production** (`/produzione.html`: webcam e DAW con una targa per il titolo), **Back Rooms Podcast** (`/podcast.html`: targa, linea di divisione e pannello Tematiche, anche in 16:9) e **Reaction Release** (`/reaction.html`: webcam e schermo condiviso, anche in 16:9). Vedi [I quattro layout nuovi](#i-quattro-layout-nuovi).

```
Nero.fan ─webhook─▶ ┐                                        ┌──▶ /overlay.html       (gara con premio, sorgente Link)
Commenti TikTok ──▶ │  server.mjs (Node, porta 4747) ─WebSocket─┼──▶ /senza-premio.html  (live giornaliere, sorgente Link)
Regia / Stream Deck ▶ ┘  stato + dati/stato.json                 ├──▶ /studio.html        (live session in studio, sorgente Link)
                                                                 ├──▶ /battle.html        (scontro tra due rapper, sorgente Link)
                                                                 ├──▶ /drum.html          (sfida alla batteria, sorgente Link)
                                                                 ├──▶ /produzione.html    (webcam e DAW, sorgente Link)
                                                                 ├──▶ /podcast.html       (podcast, 9:16 e 16:9, sorgente Link)
                                                                 ├──▶ /reaction.html      (reaction, 9:16 e 16:9, sorgente Link)
                                                                 └──▶ /regia               (browser della regia)
```

Anteprime in [`mockup/`](mockup): verticale, ultimi minuti (timer rosso e nuovo primo posto), zone del telefono, orizzontale, vincitore, spareggio, la regia, il layout senza premio (`senza-premio*.jpg`) la live session in studio (`studio*.jpg`), il battle (`battle-*.jpg`, la regia in `regia-battle.jpg`) e i quattro layout nuovi (`drum-*.jpg`, `produzione*.jpg`, `podcast*.jpg`, `reaction*.jpg`, anche `-orizzontale` e `-testi-lunghi`; le regie in `regia-formati.jpg`, `regia-drum.jpg` e `regia-podcast.jpg`).

**Guida passo passo per la regia** (installazione sul PC fisso, TikTok LIVE Studio, uso durante la live, problemi comuni): [`GUIDA.html`](GUIDA.html), si apre con un doppio clic.

## Avvio (sul PC con TikTok LIVE Studio)

Serve Node.js 22 o più recente (`winget install OpenJS.NodeJS.LTS`). Copia la cartella `overlay-live` su quel PC e fai doppio clic su `AVVIA.cmd`: la prima volta installa le dipendenze. In alternativa:

```bash
npm install
npm start
```

Al primo avvio viene creato `config.json` (copia di `config.esempio.json`). Lo stato della serata è salvato in `dati/stato.json`: se chiudi il server o riavvii il PC, la classifica resta.

## TikTok LIVE Studio

1. Aggiungi **una sola** sorgente **Link** con URL `http://127.0.0.1:4747/overlay.html`, larghezza 1080 e altezza 1920 (diretta verticale), stesa su tutta la tela. Lo sfondo è trasparente e i riquadri sono già al loro posto.
   Serve proprio `overlay.html`: LIVE Studio (1.36) controlla l'indirizzo con un'espressione che vuole un punto seguito da 2–6 lettere (come `.com` o `.html`) e poi lo scarica una volta. Con `http://127.0.0.1:4747/overlay` o `localhost` risponde «Inserisci l'URL corretto».
2. Solo se serve separarli: `overlay.html?w=premio`, `?w=tabellone`, `?w=classifica`, `?w=timer`, `?w=vincitore` (anche combinati, es. `?w=tabellone,timer`). Ogni sorgente resta 1080×1920.
3. Diretta orizzontale: `overlay.html?formato=orizzontale` con una sorgente 1920×1080.

### Posizioni (verticale, pixel della tela 1080×1920)

Ricavate dallo screenshot dell'anteprima di LIVE Studio. Sui telefoni la tela riempie lo schermo in altezza e i lati vengono tagliati: resta visibile circa da x=104 a x=976, quindi tutto sta tra x=116 e x=964. L'app copre in alto fino a ~270 px (nome della live, classifica giornaliera) e in basso da ~1770 px (pulsanti).

| Riquadro | x | y | larghezza × altezza |
|---|---|---|---|
| Premio in palio | 116 | 282 | 848 × 156 |
| Classifica | 116 | 454 | 432 × 392 |
| Countdown | 564 | 454 | 400 × 132 |
| Notifiche | 564 | 604 | 400 × ~92 |
| Tabellone | 116 | 1236 | 848 × 282 |
| Barra «Vota in chat» | 116 | 1530 | 848 × 78 |

Si cambiano nel blocco di variabili in cima a `public/css/overlay.css`. Con `?guide=1` l'overlay mostra le zone tagliate e quelle coperte dall'app.

Per vedere l'overlay in un browser normale: `http://127.0.0.1:4747/overlay?anteprima=1` (sfondo scuro al posto della trasparenza). Altri parametri: `&guide=1` (zone del telefono), `&muto=1` (nessun suono).

## Layout senza premio

Per le live giornaliere in cui si ascolta la musica delle persone senza regalare nulla. In LIVE Studio: sorgente **Link** `http://127.0.0.1:4747/senza-premio.html`, 1080×1920, stesa su tutta la tela (sfondo trasparente). Dalla scena vanno tolti il vecchio banner e la scritta segnaposto «qui scrivi social e tutto che scorre». Nella regia, in alto: **In onda → Senza premio**.

- **Banner**: «MANDACI» · «La tua musica!» (gotico cromato) · «Link in bio» · `nero.fan/backrooms` in oro, con i loghi BR ai lati. Ogni 5 minuti (regolabile, muto) e con *Richiamo link* (campanella) il link si illumina d'oro e i loghi girano.
- **Barra che scorre** sotto la camera, a filo dei bordi: social e link con icone disegnate da noi (Nero.fan, Instagram + TikTok `@backrooms.studios`, Twitch e Kick `@backrooms_studio`, `backroomsstudio.it`), la traccia in ascolto e, da 3 tracce, «Oggi abbiamo ascoltato N tracce» (conta la live in corso: riparte da solo dopo 4 ore senza tracce). Scorre a 80 px/s (40–160); il contenuto nuovo entra da destra, quello che si sta leggendo non salta mai.
- **Scheda «Ora in ascolto»**: sale da dietro la barra quando su Nero parte una traccia, con vinile che gira. Chi paga si vede di più e più a lungo: gratis 8 s, Skip 10 (bordo cromo), Super Skip 12 (magenta), Throne 15 (oro, corona e punte d'oro). Suono `inAscolto` delicato (picco 0,27, metà di quello della gara), oppure «pieno» o nessuno.
- **Spot studio**: «Vuoi suonare così? · Registrazione, mix e master · backroomsstudio.it» per 10 secondi, muto, quando la regia preme *Spot studio*.
- In questo layout la traccia di Nero passa subito, senza aspettare voti (non c'è gara). Suona solo la pagina del layout in onda: con tutte e due le sorgenti caricate in LIVE Studio non partono suoni doppi.

### Posizioni senza premio (pixel della tela 1080×1920)

Misurate sull'anteprima dello studio (cornice 421×923, k = 0,4807: visibile x 102…978). Camera da y 634 a 1265; sotto la barra (da 1358) restano liberi i commenti dei telefoni.

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| Banner | 116 | 284 | 848 × 330 |
| Loghi del banner | 136 e 820 | 470 | 124 × 124 |
| Filo luminoso sopra la camera | 0 | 630 | 1080 × 2 |
| Scheda «Ora in ascolto» | 116 | 1106 | 848 × 148 (esce da dietro la barra) |
| Barra che scorre | 0 | 1266 | 1080 × 92 (testo leggibile pieno tra x 232 e 848, sfuma sotto i loghi) |
| Loghi della barra | 120 e 892 | 1278 | 68 × 68 |

Si cambiano nel blocco di variabili in cima a `public/css/senza-premio.css`. Parametri: `?anteprima=1` (sfondo nero e finta camera), `&guide=1` (zone del telefono, camera, commenti), `&muto=1`, `&statico=1`, `&scheda=ascolto|studio|skip|superskip|throne` (scheda ferma, per i mockup), `?w=banner,barra,scheda`.

## Live session in studio

Per le sessioni di registrazione in diretta. La scena è uno split screen da tre, come nella reference: camera del fonico in alto, camera dell'artista al centro e schermo della DAW (FL Studio) in basso. Il riquadro nero al centro della barra che c'è nella reference qui non c'è.

In LIVE Studio le tre camere vanno messe nelle loro zone. Sopra tutte va una sorgente **Link** `http://127.0.0.1:4747/studio.html`, 1080×1920, stesa su tutta la tela (sfondo trasparente). Nella regia, in alto: **In onda → Live session in studio**.

- **Targa dell'artista** (tra fonico e artista): una striscia smussata a tutta larghezza con i fili al neon. Sopra c'è una targa di vetro 3D che ondeggia piano: bordo cromo-neon, spessore estruso, monete BR che girano e una linguetta cromata «● Live session in studio». Il nome dell'artista è in cromo estruso, con sotto l'Instagram e la sua icona. Si compila a ogni sessione dalla regia (*Artista in studio*). Per l'Instagram vanno bene `@nome`, `nome` o il link del profilo. Quando cambia l'artista la targa gira su se stessa e a metà giro compare il nome nuovo. Senza nome mostra la riga sopra («Live session in studio») in gotico.
- **Barra dei social** (tra artista e DAW): è la barra che scorre del layout senza premio, con gli stessi social (si cambiano lì), in rilievo e con le monete 3D ai lati. Con l'artista in onda passa anche «In studio ora: nome · @instagram».
- **Comparse**: pannelli di vetro che si alzano dalla barra come se fossero incernierati, uno alla volta. Di partenza sono «Vieni a trovarci in studio · Registrazione, mix e master · backroomsstudio.it» e «Scrivici in DM · per prenotare la tua sessione · @backrooms.studios». Salgono da sole a giro ogni 4 minuti (regolabile; 0 = solo a mano) e restano 10 secondi. Dalla regia si possono mostrare con *Mostra la prossima* o con ▶ accanto a quella scelta. Si possono modificare, aggiungere (massimo 8), riordinare e spegnere.
- **Nessun effetto sonoro**: la pagina non carica nemmeno i suoni. Con questo layout in onda non suonano né gli altri overlay né la regia, così l'artista registra senza disturbi. La traccia di Nero, se arriva, passa senza aspettare voti.

### Posizioni live session (pixel della tela 1080×1920)

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| Camera del fonico | 0 | 0 | 1080 × 640 (l'app copre fino a ~270) |
| Striscia artista | 0 | 640 | 1080 × 76 |
| Targa (nome e Instagram) | 150 | 600 | 780 × 156 (sporge sopra e sotto la striscia) |
| Camera dell'artista | 0 | 716 | 1080 × 580 |
| Comparse | 116 | 1132 | 848 × 150 (salgono dalla barra) |
| Barra dei social | 0 | 1296 | 1080 × 92 |
| Schermo della DAW | 0 | 1388 | 1080 × 532 (i pulsanti di TikTok coprono da ~1768) |

Si cambiano nel blocco di variabili in cima a `public/css/studio.css`. Parametri: `?anteprima=1` (sfondo nero e finti schermi), `&guide=1` (zone del telefono e dei tre schermi), `&statico=1`, `&comparsa=1` (o `2`, `3`…: comparsa ferma, per i mockup), `?w=targa,barra,comparse`.

## Battle

Per gli scontri tra due rapper in diretta. La camera (16:9, a tutta larghezza, al centro della tela) è una sorgente di LIVE Studio **sotto**; sopra va una sorgente **Link** `http://127.0.0.1:4747/battle.html`, 1080×1920, stesa su tutta la tela (sfondo trasparente). Nella regia, in alto: **In onda → Battle**.

Un round:

1. In **Round** si scrivono nomi e Instagram dei due rapper (*Applica nomi*) e, se serve, si sceglie la modalità e la durata (default 90 secondi).
2. **Avvia (F2)**: 3-2-1 a tutto schermo, gong, un fulmine divide la camera a metà e compare il VS. Il timer parte e la chat vota dal primo secondo.
3. La chat vota scrivendo `1` o `sx` (rapper a sinistra) e `2` o `dx` (a destra), con o senza `!`: un voto per utente, vale l'ultimo. Un punteggio come `8` qui non conta. Le barre della vita mostrano la quota in %, e con 0 voti sono a metà.
4. A zero (o con **Termina**) suona il gong e si chiude la chat. La regia scrive i sei voti dei giudici (0–10, un decimale; `Invio` passa al campo dopo). **Rivela (F4)** li mostra uno alla volta con il conteggio, poi la chat e il totale.
5. **Totale** = media di Luca, Freya, Daniele e chat (10 × la sua quota), 25% ciascuno. Con un pari merito la regia sceglie con **Vince …**. **Prossimo scontro (F8)** svuota i nomi (con il torneo carica il prossimo scontro) e riparte da 1.
6. **Schermata del vincitore**: finita la rivelazione il vincitore esce **a tutta pagina**. Un rullo di tamburo con la scena che si scurisce e i raggi d'oro, poi il colpo: il nome in oro, il **voto totale** (la media di Luca, Freya, Daniele e chat) che conta da 0 e, sotto, i quattro voti. Resta in onda 11 secondi e si ritira da sola; con un pari merito arriva appena la regia sceglie con **Vince …**. **Rivedi vincitore** la rifà (Stream Deck: `POST /api/battleVittoria`), **Prossimo scontro** la chiude. Se il round ha deciso il torneo o la classifica il titolo diventa «Il campione del torneo è» / «Il vincitore della classifica è». Si spegne da *In onda → Schermata vincitore*.
7. **Dimensione dei testi**: in regia, sezione *Dimensione dei testi*, un cursore (60–200%) per ogni gruppo di testi: nomi sulle barre, modalità (nome e descrizione), timer, artisti (nome e Instagram), giudici, barra della chat, pop-up, schermata del vincitore. Si vede subito nell'anteprima e resta salvata anche tra una serata e l'altra. I testi nei riquadri si restringono da soli se non entrano; timer, giudici e chat stanno nel riquadro fino a circa 120%. Stream Deck: `POST /api/battleTesti`. Tutto il contenuto sta nella zona libera (y 230–1200, x 116–964), sopra la chat di TikTok.

Il timer diventa rosso e lampeggia negli ultimi 30 secondi; **Pausa (F9)** lo ferma. Gong, bip del 3-2-1 e schiocco del fulmine sono sintetizzati come gli altri effetti: suonano solo dalla pagina del layout in onda (come per la gara) e si provano dai pulsanti *Gong*, *Conto* e *Spacco* in *Suoni*.

- **Modalità**: Stile libero, Tre quarti, Tematica (con il tema), Anni '90, Beat a scelta, Situazione (con la situazione) e uno slot custom spento, da compilare. Si sceglie dai pulsanti; l'elenco si modifica in *Modifica l'elenco delle modalità* (massimo 10, la modalità in onda non si può spegnere). In onda compare solo quella scelta.
- **Tabellone** (copre camera e widget; si accende da *Mostra il tabellone* e si spegne da solo quando parte un round):
  - **Torneo**: 4 o 8 partecipanti (uno per riga, si sfidano 1-2, 3-4…; *Sorteggia* li mescola prima di iniziare). Quarti, semifinali e finale; chi vince avanza da solo e *Prossimo scontro* carica la partita dopo. *Carica* mette in campo una partita a scelta.
  - **Classifica a punti**: elenco di artisti (massimo 10) e **target** (default 30). A ogni round i totali di **entrambi** i rapper si sommano ai loro punti; vince il primo che arriva al target (se in due nello stesso round, il totale più alto di quel round). Rimettere l'elenco non azzera chi c'è già; *Azzera i punti* sì. Chi non è nell'elenco non fa punti.
  - Il round si registra una sola volta, solo nel tabellone attivo.
- **Pop-up social**: Back Rooms (con «Prenota la tua sessione») e Rime Vicentine, ogni 4 minuti per 10 secondi, mai durante il round e muti. Testi, icone, giro e durata si cambiano come le comparse dello studio. **L'handle Instagram di Rime Vicentine non è preimpostato**: scrivetelo nella riga sotto del pop-up.

### Posizioni battle (pixel della tela 1080×1920)

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| Barre della vita (nome · barra · «CHAT VOTES» · barra · nome) | 116 | 282 | 848 × 90 |
| Modalità | 116 | 398 | 530 × 146 |
| Timer | 660 | 398 | 304 × 146 |
| Pop-up social | 116 | 566 | 848 × 78 |
| Camera (cornice, spacco e VS) | 0 | 656 | 1080 × 608 |
| Box degli artisti (dentro la camera, in basso) | 116 | 1100 | 848 × 96 |
| Giudici | 116 | 1292 | 848 × 150 |
| Barra «Vota in chat» | 116 | 1456 | 848 × 78 |
| Tabellone | 116 | 282 | 848 × 1252 |

Giudici e barra della chat stanno nella zona dei commenti di TikTok (1200–1700): con la chat molto attiva i commenti coprono la parte sinistra dei box. Si cambiano nel blocco di variabili in cima a `public/css/battle.css`. **Se la camera nella vostra scena è 4:3 (circa y 550 → 1363)**, cambiate `--bt-y-camera` e `--bt-h-camera`: box degli artisti, giudici e barra della chat seguono il fondo della camera; barre della vita, modalità, timer e pop-up restano dove sono. Parametri: `?anteprima=1` (sfondo nero e finta camera), `&guide=1` (tagli dei telefoni e zone di TikTok), `&statico=1`, `&muto=1`, `&conto=3` (3-2-1 fermo), `&popup=1` (primo pop-up fermo), `&vittoria=1` (con `&statico=1`: la schermata del vincitore ferma), `?w=barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone,conto,vittoria`.

Per rifare i mockup e controllare che ogni pezzo stia dove dice la tabella (serve Playwright installato a parte, non fa parte di `npm test`): `node strumenti/mockup-battle.mjs --base http://127.0.0.1:4747 --fase battle` (fasi: `attesa`, `countdown`, `battle`, `voto`, `risultato`, `pari`, `torneo`, `punti`; opzioni `--guida`, `--secondi N`, `--conto N`, `--popup`, e `--fase risultato --vittoria` per la schermata del vincitore, con il controllo che stia nella zona libera), per provare la regia `--regia`, e `--controlli` per verificare che i nomi lunghi entrino nei riquadri e che «VIA!» resti visibile. **Usatelo su una porta di prova, non durante la diretta**: i dati di prova azzerano torneo e punti. I dati di prova li mette il comando `battleDemo`.

## I quattro layout nuovi

**Drum Challenge Live**, **Studio Production**, **Back Rooms Podcast** e **Reaction Release** hanno la stessa grafica (vetro viola, cromo, monete BR, neon ciano, magenta e oro; Barlow Condensed e Grenze Gotisch) e funzionano allo stesso modo: la camera (o le camere) sta **sotto**, in LIVE Studio o OBS, e sopra va **una sola** sorgente **Link** su sfondo trasparente. Nella regia, in alto, in *In onda* si sceglie il layout; ognuno ha la sua sezione, con un'anteprima che si aggiorna dal vivo e il link «Apri grande, con le zone».

| Layout | Indirizzo | Formato | Suoni |
|---|---|---|---|
| Drum Challenge Live | `/drum.html` | 9:16 (1080×1920) | solo lo sblocco di un brano |
| Studio Production | `/produzione.html` | 9:16 (1080×1920) | nessuno |
| Back Rooms Podcast | `/podcast.html` | 9:16 e 16:9 (`?formato=orizzontale`, 1920×1080) | nessuno |
| Reaction Release | `/reaction.html` | 9:16 e 16:9 (`?formato=orizzontale`, 1920×1080) | nessuno |

Il server li stampa all'avvio, insieme agli altri. Quello che hanno in comune:

- **Zone di TikTok** (verticale): sui telefoni resta visibile circa x 104…976, quindi i contenuti stanno tra x 116 e 964; l'app copre in alto fino a ~230 (fino a ~270 con il nome della live) e la chat sta tra 1200 e 1700, quindi i pezzi stanno tra y 230 e 1200. La fascia social è l'unica a tutta larghezza.
- **Parametri**: `?anteprima=1` (sfondo nero e finti schermi al posto delle camere), `&guide=1` (le zone dei telefoni, solo in verticale), `&statico=1` (tutto nello stato finale e senza animazioni: per i mockup), `&muto=1` (nessun suono da questa pagina: solo il Drum ne ha), `?formato=orizzontale` (solo Podcast e Reaction; negli altri due non cambia niente). Una sorgente di dimensioni diverse si adatta mantenendo le proporzioni. Per spostare un pezzo si cambiano i numeri in cima al foglio di stile del layout (`drum.css`, `doppio.css`, `podcast.css`; le parti comuni sono in `formati.css`).
- **Fascia social**: la barra che scorre del layout senza premio, larga 1080 (1920 in orizzontale). Le voci sono una lista sola, nella scheda **Social del brand** della regia (in alto, uguale per tutti i layout con la barra); il Drum aggiunge l'artista ospite e il Podcast i suoi ospiti subito dopo la prima voce. La velocità si regola in ogni sezione (40–160 px/s).
- **Dimensione dei testi**: in ogni sezione, un cursore (60–200%, 100% = base) per ogni gruppo di testi: Drum *contatore Like*, *colonna traguardi*, *brano in esecuzione*, *«Dona un…»*, *banner di sblocco*; Studio Production e Reaction *riga sopra*, *titolo*, *riga sotto*; Podcast *targa* e *pannello Tematiche*. Si vede subito nell'anteprima e resta salvata anche tra una serata e l'altra. Ogni testo sta in un riquadro di altezza fissa: il corpo si restringe da solo se la frase non entra e non supera mai l'altezza del riquadro (oltre non cresce). Il testo scorrevole della fascia non rientra. Stream Deck: `formatoTesti`.
- **Il vetro non è sfocato**: i riquadri di vetro sono semitrasparenti ma non sfocano la camera, perché una pagina non può sfocare quello che sta in un'altra sorgente: il vetro è simulato (fondo scuro, grana, bordo cromato, luce nel terzo alto) e il testo ha un'ombra per leggersi anche sulla camera.
- **Nuova serata** (regia): i Like del Drum ripartono da zero e annunci e brano si azzerano, la tematica attiva del Podcast torna alla prima; scaletta, titoli, elenco, ospiti e impostazioni restano.
- **Mockup e controlli**: `node strumenti/mockup-formati.mjs --base http://127.0.0.1:<porta> --layout <drum|produzione|reaction|podcast> [--formato orizzontale] [--stato <stato>]` (Playwright installato a parte, non fa parte di `npm test`) controlla che ogni pezzo stia dove dice la tabella (±1 px, e dentro la zona libera) e salva `mockup/<layout>[-orizzontale][-<stato>].jpg`; gli stati sono Drum `vuoto|meta|sblocco|finale` e Podcast `completo|base` (linea e tematiche accese o spente). Le altre opzioni provano i flussi dal vivo: `--clessidra`, `--sblocco-animato`, `--eq`, `--audio` (Drum), `--testi-lunghi` (con `--layout` per gli altri layout: i testi più lunghi permessi con la dimensione al 200%), `--regia`, `--regia-drum`, `--regia-doppio` (Studio Production e Reaction) e `--regia-podcast`. **Usatelo su una porta di prova** con `OVERLAY_CONFIG` e `OVERLAY_DATI` temporanei, non durante la diretta: i comandi di prova cambiano lo stato (Like, scaletta, titoli, tematiche, ospiti).
- **Limiti noti**: questi layout sono stati provati con Chromium e con i controlli dello strumento qui sopra, non dentro TikTok LIVE Studio né su un telefono (le posizioni seguono le zone già misurate per gli altri layout). I Like arrivano da TikTok come eventi della chat: nelle prove sono simulati (`likeEvento`, *+100*). L'«Audio del PC» e l'ASIO in modalità esclusiva non si sono potuti provare (vedi sotto).

## Drum Challenge Live

Per la sfida alla batteria: i **Like** della live sbloccano, uno dopo l'altro, i brani di una scaletta, e mentre si suona la cornice e l'equalizzatore seguono l'audio di FL Studio. La camera del batterista va **sotto**, a tutto schermo; sopra va una sorgente **Link** `http://127.0.0.1:4747/drum.html`, 1080×1920, stesa su tutta la tela (sfondo trasparente). Nella regia, in alto: **In onda → Drum Challenge Live**.

- **Colonna dei traguardi** (a destra) e **contatore dei Like** sopra di lei. La colonna mostra quattro moduli: l'ultimo sbloccato, quello che si sta riempiendo e i due dopo. Ogni modulo ha i Like della tappa e il titolo del brano (finché la tappa è chiusa «Brano segreto»; sbloccata senza titolo «Brano a sorpresa»); quello che si sta riempiendo mostra quanti Like mancano e la percentuale, con una clessidra che si riempie di **perline** o di **sabbia** (si sceglie in regia, *Riempimento dei moduli*).
- **Scaletta**: di partenza 37 tappe, da 1.000 a 500.000 Like (1k, 2k, 3k, 5k, 7k, 9k, 10k, 12k, 15k, 17k, 20k, 22k, 25k, 27k, 29k, 30k, 32k, 35k, 37k, 40k, 45k, 50k, 60k, 70k, 80k, 90k, 100k, 125k, 150k, 175k, 200k, 250k, 300k, 350k, 400k, 450k, 500k), senza titoli. In regia (*Scaletta*) si scrive una tappa per riga, «Like | Titolo del brano»: i Like si scrivono `15000`, `15.000` o `15k` e devono crescere; massimo 80 tappe, titoli fino a 60 caratteri. Un errore dice il numero della riga e non cambia niente. *Scaletta predefinita* rimette le 37 tappe tenendo i titoli di quelle con gli stessi Like. Cambiare la scaletta non sblocca nessun brano.
- **Like**: arrivano da soli dagli eventi «like» della chat TikTok (serve la chat collegata: *Serata → Collega chat*; la regia mostra «Collegato a TikTok», «In attesa di TikTok» o «TikTok non collegato»). Il totale della live non scende mai. In regia si correggono a mano: *Imposta*, *+100*, *+1.000* e *Riparti da ora* (contatore a zero e scaletta dalla prima tappa: per una live già iniziata). Una correzione fatta prima che arrivi il primo evento «like» (regia appena avviata o chat appena ricollegata) vale per quel primo evento: il totale della live non si somma al numero impostato e *Riparti da ora* non sblocca le tappe che c'erano già.
- **Sblocco**: quando i Like raggiungono una tappa parte una sequenza di circa 2,6 secondi: un colpo sul modulo (onda di luce, raffica di perline, lampo), il banner **«Brano sbloccato»** con il titolo in verde neon (per circa 3 secondi), la colonna che scorre di un posto e il suono `sblocco`. Se i Like saltano più tappe in una volta si annuncia solo la più alta; due sblocchi di fila non si accavallano (parte l'ultimo). Ricaricare la pagina non rifà la sequenza.
- **Brano in esecuzione** (in alto a sinistra): titolo (fino a 60 caratteri) e artista (40), scritti in regia con *Mostra* oppure con *Suona ora* accanto a una tappa già sbloccata nell'elenco della scaletta. Senza titolo il riquadro non c'è.
- **«Dona un…»** (sotto il brano): un riquadro sempre in vista che invita a fare un regalo per saltare la coda e scegliere il brano. Di partenza: «Dona un» · **Rosa** · «Salta la coda · scegli tu il brano». Prefisso (16 caratteri), slot (20), riga sopra (40) e icona (rosa, corona, cuore, regalo, stella, diamante o logo BR) si cambiano in regia; *Richiamo* (`F2`) lo fa pulsare per attirare l'attenzione (ogni 20 secondi lo fa anche da solo).
- **Cornice ed equalizzatore** (in basso): 40 barre, o un'onda specchiata, che seguono l'audio di FL Studio, dentro una cornice a staffe che lampeggia a ogni colpo di batteria. Senza audio resta una fascia che respira piano (si spegne con *Mostra anche senza segnale*). La sensibilità va da 50 a 300%.
- **Fascia social** in fondo, con lo slot **Artista ospite** (etichetta, contatto e icona) dopo la prima voce.

**Come arriva l'audio di FL Studio.** La pagina del Drum non sente niente da sola: lo fa la **regia**, che analizza l'audio in 12 bande (da 40 Hz a 14 kHz) e manda i livelli alla pagina, circa 30 volte al secondo e solo con il Drum in onda. Nella sezione *Equalizzatore* si sceglie la **sorgente**:

1. **Ingresso audio** (di partenza): un ingresso del PC che porta l'audio di FL Studio, per esempio un cavo audio virtuale, «Mix stereo» o l'ingresso di ritorno della scheda audio. Si sceglie dall'elenco *Ingresso* (la scelta si ricorda).
2. **Audio del PC**: la condivisione dello schermo con l'audio di sistema; nella finestra del browser si sceglie «Intero schermo» e si spunta «Condividi audio di sistema». Funziona se LIVE Studio sente FL Studio con «audio del desktop», perché è lo stesso audio.

Poi *Avvia ascolto*: l'indicatore di livello deve muoversi (se resta fermo il browser non riceve audio). *Prova (4 s)* manda alla pagina uno schema finto di 4 secondi, per vedere l'equalizzatore senza audio.

- **ASIO in modalità esclusiva**: se FL Studio usa un driver ASIO in modalità esclusiva nessun altro programma riceve il suo audio, nemmeno il browser: usate un driver condiviso (WASAPI o «FL Studio ASIO») oppure un cavo audio virtuale come *Ingresso audio*.
- **`localhost` e Chrome o Edge**: l'ascolto funziona solo con la regia aperta da `http://localhost:4747/regia` (o `127.0.0.1`, o https) e con Chrome o Edge; da un altro computer in rete (indirizzo con l'IP) il browser lo blocca. La pagina della regia va tenuta aperta per tutta la diretta.
- **Non provato qui**: l'«Audio del PC» e i driver ASIO non si sono potuti provare (le prove usano un ingresso audio finto di Chromium con un colpo ogni mezzo secondo): vanno provati una volta sul PC della diretta, con *Prova* e con un brano vero.

Suoni: solo `sblocco`, quando parte la sequenza, e solo dalla pagina del Drum se è il layout in onda (si prova da *Suoni*).

### Posizioni drum (pixel della tela 1080×1920)

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| Brano in esecuzione | 116 | 282 | 524 × 80 |
| «Dona un…» | 116 | 380 | 524 × 106 |
| Contatore dei Like | 676 | 282 | 288 × 68 |
| Colonna dei traguardi (4 moduli da 288 × 148, passo 164) | 676 | 366 | 288 × 640 |
| Banner di sblocco | 116 | 520 | 524 × 170 |
| Equalizzatore | 116 | 1016 | 848 × 84 |
| Cornice (staffe e filo) | 116 | 262 | 848 × 838 |
| Fascia social | 0 | 1108 | 1080 × 92 |

Si cambiano in cima a `public/css/drum.css`. Parametri: i comuni (vedi sopra) e `&sblocco=1` (con `&statico=1`: il banner di sblocco fermo, per i mockup). Dati di prova: il comando `drumDemo` (fasi `vuoto`, `meta`, `sblocco`, `finale`); per simulare i Like senza una live `likeEvento` o *+100*. In regia, *In onda*: cornice ed equalizzatore, colonna dei traguardi e Like, brano in esecuzione, «Dona un…» e fascia social.

## Studio Production

Per le live in cui si lavora a un beat o a un mix: la **webcam** in alto e lo **schermo della DAW** (FL Studio) in basso, la fascia social tra le due e, nella parte alta della webcam, una targa con il titolo della live. In LIVE Studio le due camere vanno **sotto**: webcam da y 0 a 1212, schermo della DAW da y 1304 a 1920. Sopra va una sorgente **Link** `http://127.0.0.1:4747/produzione.html`, 1080×1920, stesa su tutta la tela (sfondo trasparente). Nella regia, in alto: **In onda → Studio Production**. Solo verticale, nessun suono.

- **Targa del titolo**: placca cromata in 3D con le monete BR ai lati e il punto REC, su tre righe: una riga sopra, il titolo grande in cromo luccicante e una riga sotto. Il colore d'accento e l'icona dipendono dal **preset**: *Cooking Beats* (oro, cappello da cuoco, «Backrooms Studio · Live» / «Un beat da zero, in diretta»), *Sessione Beat* (magenta, cuffie, «In studio con il producer») e *Mix & Master* (ciano, manopole, «Mix e master in diretta»). Scelto il preset si può cambiare ogni riga.
- **Titolo in tempo reale**: le tre righe (sopra fino a 32 caratteri, titolo 28, sotto 48) vanno in onda **mentre si scrive**, 150 ms dopo l'ultimo tasto, con un breve effetto flip (non al primo caricamento). Il titolo non può restare vuoto: mentre lo riscrivete resta in onda quello di prima; un testo troppo lungo dà un avviso e il campo torna al testo in onda.
- **Fascia social** (la barra che scorre) tra la webcam e lo schermo.
- In regia, *In onda*: titolo e fascia social.

### Posizioni Studio Production e Reaction Release, verticale (pixel della tela 1080×1920)

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| Webcam (A) | 0 | 0 | 1080 × 1212 (l'app copre fino a ~270) |
| Titolo (targa) | 116 | 282 | 848 × 160 |
| Fascia social | 0 | 1212 | 1080 × 92 |
| Schermo (B: DAW o video) | 0 | 1304 | 1080 × 616 |

Si cambiano in cima a `public/css/doppio.css` (e il punto della fascia in `formati.css`). Parametri: i comuni; con `?anteprima=1` le camere sono finti schermi «Webcam» e «DAW · FL Studio».

## Back Rooms Podcast

Per il podcast sul divano: la **camera** (host e ospiti) a tutto schermo, **sotto**; sopra va una sorgente **Link** `http://127.0.0.1:4747/podcast.html` (1080×1920) oppure `http://127.0.0.1:4747/podcast.html?formato=orizzontale` (1920×1080), stesa su tutta la tela (sfondo trasparente). Nella regia, in alto: **In onda → Back Rooms Podcast**. Nessun suono.

- **Targa**: «Back Rooms Podcast» con sotto la riga dell'episodio (di partenza vuota), su una placca cromata con le monete BR (accento ciano). Il titolo (fino a 32 caratteri) e la riga dell'episodio (48) vanno in onda mentre si scrive, come in Studio Production.
- **Linea di divisione** (spenta all'inizio): un filo neon cromato che separa i due lati del divano («intervista doppia»). Quando si accende si disegna dal centro verso gli estremi in 0,7 secondi, quando si spegne si ritira.
- **Pannello Tematiche** (spento all'inizio): un pannello di vetro con l'intestazione («Tematiche di oggi») e fino a 8 tematiche da 48 caratteri. La tematica **attiva** ha il bordo oro e la freccia, le precedenti sono attenuate con la spunta, le seguenti hanno un cerchietto; cambiando tematica il bordo scorre da una voce all'altra. Entra e esce con una dissolvenza che scorre. In orizzontale sta a sinistra oppure a destra (*Pannello a*: Sinistra o Destra); in verticale sta sempre al centro, davanti alla linea (che si intravede attenuata dietro il vetro).
- **Fascia social** con gli **ospiti** (fino a 4: nome, contatto e icona) dopo la prima voce, come «Ospite · Nome · @contatto».
- **Dalla regia**: quattro grandi pulsanti On/Off (*Linea di divisione*, *Pannello Tematiche*, *Targa*, *Fascia social*), la lista delle tematiche in onda (un clic la rende attiva; *Indietro* e *Avanti*), l'elenco da scrivere (una tematica per riga, con il titolo del pannello, e *Salva tematiche*), gli ospiti (si salvano uscendo dal campo; una riga senza nome non va in onda) e il titolo.
- **Scorciatoie** (solo con il Podcast in onda): `F2` tematica avanti, `F3` indietro, `F4` mostra o nasconde il pannello Tematiche. Stream Deck: `POST /api/podcastTematica` con `{ "avanti": true }`, `{ "indietro": true }` o `{ "indice": 2 }`, e `POST /api/widget` con `{ "nome": "poTematiche", "visibile": true }`.
- *Nuova serata* riporta la tematica attiva alla prima; elenco, ospiti e titolo restano. All'avvio linea e pannello sono spenti.

### Posizioni podcast (pixel della tela)

| Pezzo | Verticale 1080×1920 | Orizzontale 1920×1080 |
|---|---|---|
| Targa | x 116, y 282, 848 × 90 | x 48, y 36, 512 × 90 |
| Pannello Tematiche | x 116, y 400, 848 × 480 (8 righe da 48) | x 48 (1360 con «Destra»), y 150, 512 × 570 (8 righe da 58) |
| Linea di divisione | x 538, y 240, 4 × 860 | x 958, y 0, 4 × 968 (arriva alla fascia) |
| Fascia social | x 0, y 1108, 1080 × 92 | x 0, y 968, 1920 × 92 |

Si cambiano in cima a `public/css/podcast.css`. Parametri: i comuni; con `?anteprima=1` la camera è un finto schermo «Camera · divano».

## Reaction Release

Per le reaction: la **webcam** di chi commenta e lo **schermo condiviso** (il video che si guarda). Titolo di partenza «REACTION RELEASE DELLA SETTIMANA» con sopra «Ogni giovedì · ore 01:00»; in regia si cambiano le tre righe (sopra fino a 40 caratteri, titolo 60, sotto 60, in onda mentre si scrive) e *Ripristina titolo predefinito* rimette quelle di partenza. Accento magenta; targa e fascia social come in Studio Production. Nessun suono. Nella regia, in alto: **In onda → Reaction Release**.

- **Verticale** (`http://127.0.0.1:4747/reaction.html`, sorgente Link 1080×1920): come Studio Production, con le stesse posizioni (webcam sopra, fascia, schermo sotto: vedi la tabella di Studio Production).
- **Orizzontale** (`http://127.0.0.1:4747/reaction.html?formato=orizzontale`, 1920×1080): fuori dalle due finestre la pagina è **opaca**: uno sfondo di marca (viola scuro con griglia sottile e vignetta), le due finestre sono **fori** con cornice cromata e staffe (la webcam e lo schermo condiviso stanno sotto e si vedono da lì), tra le due un divisore neon con una moneta BR, in alto il titolo e in basso la fascia social. Con `?anteprima=1` le finestre mostrano finti schermi.

### Posizioni reaction, orizzontale (pixel della tela 1920×1080)

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| Titolo (targa) | 360 | 28 | 1200 × 140 |
| Finestra A (webcam, verticale) | 24 | 192 | 576 × 702 |
| Divisore con la moneta BR | 600 | 192 | 48 × 702 |
| Finestra B (schermo condiviso) | 648 | 192 | 1248 × 702 |
| Fascia social | 0 | 920 | 1920 × 92 |

I rettangoli delle due finestre stanno due volte in `public/css/doppio.css` (nel `clip-path` dello sfondo e negli stili delle cornici): se li cambiate, cambiateli in entrambi i posti.

## Effetti sonori

Ogni animazione ha il suo effetto, sintetizzato al momento con Web Audio (`public/js/suoni.js`: nessun file audio, nessun diritto d'autore): nuova traccia, voto dei giudici (la nota sale col voto), voto nascosto, apertura/chiusura del voto chat, pop dei voti della chat, calcolo del punteggio con colpo finale, nuova entrata, scalata, uscita dalla top, fanfara del nuovo primo posto, premio cambiato, sirena a 30 minuti e a 1 minuto dalla fine, tic negli ultimi 10 secondi, rullo e fanfara del vincitore, battito dello spareggio; nel layout senza premio `inAscolto` (traccia nuova, con un tocco in più per Skip, Super Skip e Throne) e la campanella del richiamo. Quale effetto parte e quando lo decide `public/js/eventi-sonori.js` (testato in `test/eventi-sonori.test.mjs`).

Per il battle: `gong` (via e fine), `conto` (i tre bip del 3-2-1), `spacco` (il fulmine) e, riusati dalla gara, sirena a 30 secondi dalla fine, tic negli ultimi 10, `voto` e `calcolo` per i giudici e `vincitore` (rullo e fanfara) per la schermata del vincitore di ogni round; quando partono lo decide `suoniBattle` in `eventi-sonori.js`.

Per il Drum: `sblocco` (una volta per tappa raggiunta), deciso da `suoniDrum` in `eventi-sonori.js`; produzione, reaction e podcast sono muti.

Dalla regia (*Suoni*): dove suonano (nell'overlay, nella regia o spenti), volume e pulsanti di prova. Suona solo la pagina del layout **In onda** scelto in testata (gara o senza premio). Se la sorgente Link di LIVE Studio non manda l'audio in diretta, si sceglie «in questa pagina» e si cattura l'audio del PC.

## Regia

`http://127.0.0.1:4747/regia` sul PC della diretta. Per usarla da un altro computer o tablet sulla stessa rete: in `config.json` metti `"host": "0.0.0.0"` e un `"pinRegia"`, poi apri `http://<ip-del-pc-della-diretta>:4747/regia`.

| Tasto | Azione |
|---|---|
| `F2` | Apri / chiudi il voto della chat |
| `F4` o `Ctrl+Invio` | Conferma il punteggio (la traccia entra in classifica se ha il punteggio) |
| `F8` | Prossima traccia |
| `F9` | Pausa / riprendi il countdown |
| `Invio` in un voto | Passa al voto successivo |

Con il **battle** in onda i tasti fanno altro: `F2` avvia il round, `F4` o `Ctrl+Invio` rivela i voti dei giudici, `F8` passa al prossimo scontro, `F9` ferma o fa ripartire il timer. Con il **Drum** in onda `F2` fa il richiamo di «Dona un…»; con il **Podcast** in onda `F2` e `F3` spostano la tematica attiva avanti e indietro e `F4` mostra o nasconde il pannello Tematiche.

Flusso tipico: la traccia arriva da sola da Nero (oppure *In ascolto ora* / ▶ dalla coda) → i tre giudici dicono il voto, la regia lo scrive → `F2` apre il voto della chat → `F4` conferma → su Nero si passa alla traccia successiva e il tabellone cambia da solo (senza Nero: `F8`).

- **Chat TikTok**: nella sezione *Serata* scrivi l'@ dell'account che va in diretta e premi *Collega chat*. In alto compare lo stato (in ascolto / in attesa della live / non collegato). Si collega da solo quando parte la live e si ricollega se cade.
- **In onda**: mostra o nasconde tabellone, classifica e countdown. Con la classifica nascosta, dopo ogni conferma compare da sola per 15 secondi.
- **Countdown**: 180 minuti di default. Allo scadere vince il primo in classifica. Con più tracce a pari merito in testa, l'overlay mostra lo **spareggio** e la regia sceglie il vincitore con *Proclama*.
- **Premio e giudici**: si cambiano dalla regia (*Serata*); valgono per tutta la serata. Il premio sta in grande in cima all'overlay; sotto girano le frasi di *Salva frasi* (separate da `|`), per spiegare a chi entra come partecipare.
- **Classifica**: dopo la conferma il totale conta e si timbra, poi (1,7 s) la classifica si muove, con la notifica a destra (nuova entrata, scalata, nuovo primo posto). Podio oro/argento/bronzo, corona accanto al titolo del primo.

La chat accetta `8`, `7.5`, `7,5`, `9/10`, `!voto 8`. Un voto per utente (vale l'ultimo), solo mentre il voto è aperto. Il totale è la media di Beat, Voce, Mix e Chat (25% ciascuno).

## config.json

| Campo | Cosa fa |
|---|---|
| `giudici` | Giudice di ogni categoria: `{ "beat": "...", "voce": "...", "mix": "..." }` (modificabile anche dalla regia) |
| `pesi` | Peso di ogni voce nel totale (default uguali: chat al 25%) |
| `topN` | Posizioni in classifica |
| `premio` | Premio iniziale (si cambia dalla regia) |
| `invito` | Frasi iniziali sotto il premio, separate da `\|` (si cambiano dalla regia) |
| `suoni` | `{ "dove": "overlay" \| "regia" \| "spenti", "volume": 0.8 }` iniziali (si cambiano dalla regia) |
| `durataCountdownMinuti` | Durata del countdown (180) |
| `durataVotoChatSecondi` | Durata predefinita del voto chat |
| `tiktok` | Account TikTok iniziale (si cambia dalla regia) |
| `nero.username` | Username Nero.fan (`backrooms`): da qui arriva da sola la traccia in riproduzione, e la regia mostra la coda pubblica |
| `nero.automatico` | Traccia automatica da Nero accesa all'avvio (si cambia dalla regia) |
| `nero.attesaDopoConfermaSecondi` | Secondi dopo la conferma prima che arrivi la traccia successiva di Nero (10) |
| `nero.segreto` | Signing secret dei webhook Nero.fan |
| `layout` | Layout in onda all'avvio: `"gara"` (predefinito), `"senzaPremio"`, `"studio"`, `"battle"`, `"drum"`, `"produzione"`, `"podcast"` o `"reaction"` (si cambia dalla regia) |
| `host`, `pinRegia` | Regia da altri dispositivi in rete (vedi sopra) |

## Nero.fan

**Traccia in riproduzione (automatica, senza configurare niente).** Ogni 3 secondi il server legge la coda pubblica di `nero.username` (`api.nero.fan/users/<username>/profile` → sessione live, poi `/queue/<sessione>/slim` → `current`). Quando su Nero parte un'altra traccia, titolo, artista e tier vanno da soli sul tabellone e nell'overlay. Serve la sessione live avviata su nero.fan e la spunta *Traccia automatica da Nero.fan* nella regia.

- Nel layout senza premio passa sempre subito. Nella gara, se la traccia sul tabellone ha voti non confermati, la nuova aspetta (`neroInArrivo`, riquadro nella regia): i voti non si perdono.
- Dopo la conferma resta sul tabellone per `nero.attesaDopoConfermaSecondi` (10) secondi, il tempo di mostrare punteggio e classifica, poi arriva da sola la traccia successiva. `F8` / *Passa ora* la porta subito. Con `0` passa solo con `F8`.
- Per provarlo senza Nero: `NERO_API=http://127.0.0.1:<porta> npm start` con un server che risponde agli stessi due indirizzi.

**Coda delle submission pagate (facoltativa).** Nero manda un webhook firmato a ogni submission **pagata** (`submission.paid`): finisce nella coda della regia, ordinata come su Nero (Throne, Super Skip, Skip, Standard), e con ▶ passa sul tabellone. Le submission gratuite non generano webhook: la regia mostra la coda pubblica di Nero (*Coda su Nero.fan*) e si aggiungono con *Metti in coda*.

Il webhook vuole un indirizzo HTTPS pubblico che arrivi alla porta 4748 del PC della diretta. I DNS di backroomsstudio.it sono su Aruba, quindi un tunnel Cloudflare con sottodominio fisso richiederebbe di spostarli. La strada più semplice è il dominio statico gratuito di ngrok:

1. Crea un account su ngrok.com e prendi il dominio statico gratuito (Dashboard → Domains).
2. Sul PC della diretta: `winget install ngrok.ngrok`, poi `ngrok config add-authtoken <token>`.
3. A ogni live, insieme ad `AVVIA.cmd`:

```bash
ngrok http 4748 --url=<tuo-dominio>.ngrok-free.app
```

4. Su Nero: Settings → Developer → Stream triggers → URL `https://<tuo-dominio>.ngrok-free.app/webhook/nero`. Copia il signing secret in `nero.segreto` e usa *Send test event* per verificare che arrivi in coda.

Il tunnel espone solo la porta del webhook, non la regia.

## API (Stream Deck e altri tool)

`POST http://127.0.0.1:4747/api/<comando>` con `Content-Type: application/json` (e header `x-pin` se hai impostato `pinRegia`). `GET /api/stato` restituisce lo stato completo.

| Comando | Corpo JSON |
|---|---|
| `traccia` | `{ "titolo", "artista" }`: nuova traccia in ascolto |
| `correggiTraccia` | `{ "titolo"?, "artista"? }`: corregge senza azzerare i voti |
| `inCoda`, `daCoda`, `togliCoda` | `{ "titolo", "artista" }` / `{ "id" }` |
| `voto` | `{ "categoria": "beat"\|"voce"\|"mix", "valore": 8.5 }` |
| `giudici` | `{ "beat"?, "voce"?, "mix"? }` |
| `apriChat`, `chiudiChat`, `azzeraChat` | `{ "secondi": 60 }` / `{}` |
| `messaggioChat` | `{ "piattaforma", "utente", "testo" }`: per inoltrare commenti da altri tool |
| `tiktok` | `{ "utente": "@account" }` (vuoto per scollegare) |
| `conferma`, `prossima` | `{}` |
| `countdown` | `{ "azione": "avvia"\|"pausa"\|"riprendi"\|"aggiungi"\|"azzera", "minuti"? }` |
| `proclama` | `{}` chiude la gara (spareggio se c'è pari merito) · `{ "id" }` sceglie il vincitore |
| `nascondiVincitore` | `{}`: chiude la schermata finale |
| `widget` | `{ "nome": "premio"\|"tabellone"\|"classifica"\|"timer"\|"banner"\|"barra"\|"scheda"\|"targa"\|"barraStudio"\|"comparse"\|"barreVita"\|"modalita"\|"timerBattle"\|"giudiciBattle"\|"popupBattle"\|"vittoriaBattle"\|"bracket"\|"drumCornice"\|"drumTraguardi"\|"drumBrano"\|"drumPriorita"\|"drumBarra"\|"prTitolo"\|"prBarra"\|"reTitolo"\|"reBarra"\|"poTitolo"\|"poLinea"\|"poTematiche"\|"poBarra", "visibile": true }` (la linea e il pannello del podcast e il tabellone del battle partono spenti) |
| `nascondiVoti` | `{ "attivo": true }`: l'overlay mostra "?" fino alla conferma |
| `premio` | `{ "testo": "Mix + Master" }` |
| `invito` | `{ "testo": "La traccia più votata vince \| Manda la tua traccia su nero.fan/backrooms" }` |
| `suoni` | `{ "dove"?: "overlay"\|"regia"\|"spenti", "volume"?: 0.8 }` |
| `provaSuono` | `{ "nome": "primo", "dati"?: { "tier": "throne" } }`: fa suonare un effetto dove sono attivi i suoni (es. da un tasto dello Stream Deck) |
| `layout` | `{ "nome": "gara"\|"senzaPremio"\|"studio"\|"battle"\|"drum"\|"produzione"\|"podcast"\|"reaction" }`: layout in onda (chi suona, e se la traccia di Nero aspetta i voti) |
| `senzaPremio` | Uno o più campi: `sopra`, `titolo`, `pillola`, `link` (testi del banner); `voci` (`[{ "attiva", "icona", "etichetta", "testo" }]`, icone `nero`, `instagram`, `tiktok`, `instagram+tiktok`, `twitch`, `kick`, `youtube`, `spotify`, `whatsapp`, `sito`, `microfono`, `logo`; massimo 12, 8 accese, testo fino a 40 caratteri); `velocita` (40–160); `inAscoltoNellaBarra`, `ascoltateNellaBarra`, `loghiBarra`, `filoCamera`; `durate` (`{ "standard", "skip", "superskip", "throne" }`, 4–20 s); `suonoTraccia` (`"delicato"\|"pieno"\|"nessuno"`); `richiamoOgniMinuti` (0–30); `spot` (`{ "sopra", "titolo", "sotto" }`) |
| `ripristinaSenzaPremio` | `{}`: testi, social e impostazioni di partenza |
| `richiamo` | `{}`: il link del banner si illumina, con la campanella |
| `spotStudio` | `{}`: scheda «Vuoi suonare così?» per 10 secondi |
| `ripetiScheda` | `{}`: rimostra la scheda della traccia in ascolto, senza suono |
| `provaScheda` | `{ "tier": "standard"\|"skip"\|"superskip"\|"throne" }`: scheda di prova, senza cambiare traccia |
| `studio` | Uno o più campi: `artista` (fino a 32 caratteri), `instagram` (`@nome`, `nome` o link del profilo), `etichetta` (riga sopra il nome); `comparse` (`[{ "attiva", "icona", "sopra", "titolo", "sotto" }]`, massimo 8, titolo fino a 28 caratteri); `comparsaOgniMinuti` (0–30), `durataComparsa` (4–20 s), `velocita` (40–160), `artistaNellaBarra` |
| `ripristinaStudio` | `{}`: comparse e impostazioni di partenza (il nome dell'artista resta) |
| `comparsa` | `{}` la prossima del giro · `{ "id" }` quella scelta: sale dalla barra, senza suono |
| `battleScontro` | `{ "sx": { "nome", "instagram" }, "dx": { … } }`: i due rapper (solo tra un round e l'altro) |
| `battleModalita` | `{ "scelta"?, "testo"?, "elenco"? }`: modalità in onda, il suo testo (tema o situazione), l'elenco (massimo 10) |
| `battleTimer` | `{ "durataSecondi": 90 }` (10–600, vale dal prossimo round) oppure `{ "azione": "pausa"\|"riprendi" }` |
| `battleAvvia`, `battleTermina`, `battleProssimo`, `battleReset` | `{}`: avvia il 3-2-1, chiude il round con il gong, passa allo scontro dopo, scarta il round in corso |
| `battleVotoGiudice` | `{ "giudice": "luca"\|"freya"\|"daniele", "lato": "sx"\|"dx", "valore": 8.5 }`: solo a fine round |
| `battleGiudici` | `{ "luca"?, "freya"?, "daniele"? }`: nomi dei giudici |
| `battleRivela`, `battleProclama` | `{}` mostra i voti e il totale · `{ "lato": "sx"\|"dx" }` decide un pari merito |
| `battleTesti` | `{ "timer": 120, "artistiNome": 130, … }` percento 60–200 per gruppo (`barreNomi`, `modalitaNome`, `modalitaTesto`, `timer`, `artistiNome`, `artistiIg`, `giudici`, `chat`, `popup`, `vittoria`) · `{ "azzera": true }` torna al 100% |
| `battleVittoria` | `{}`: «Rivedi vincitore», rifà la schermata a tutta pagina (solo con un vincitore) |
| `tabellone` | `{ "modo"?: "torneo"\|"punti", "visibile"?: true }` |
| `torneo`, `torneoCarica` | `{ "azione": "crea"\|"sorteggia"\|"azzera", "partecipanti"?: ["…"] }` (4 o 8) · `{ "id": "q1"\|…\|"f1" }` |
| `punti` | `{ "artisti"?: ["…"], "target"?: 30, "azzera"?: true }` |
| `battlePopup` | `{ "elenco"?, "ogniMinuti"?, "durata"? }` per le impostazioni, oppure `{ "id"? }` per mostrare un pop-up (senza `id`, la prossima del giro) |
| `battleDemo` | `{ "fase": "attesa"\|"countdown"\|"battle"\|"voto"\|"risultato"\|"pari"\|"torneo"\|"punti", "secondi"? }`: dati di prova |
| `drumLike` | `{ "aggiungi"?: 100, "imposta"?: 11400, "daOra"?: true }`: corregge i Like a mano (nell'ordine `daOra`, `imposta`, `aggiungi`; un salto di più tappe annuncia solo la più alta) |
| `drumScaletta` | `{ "testo": "1000 \| Primo brano\n15k \| Secondo" }` (una tappa per riga, «Like \| Titolo», massimo 80) oppure `{ "predefinita": true }` |
| `drumBrano` | `{ "titolo"?, "artista"?, "daIndice"?, "svuota"? }`: brano in esecuzione (`daIndice` lo prende da una tappa già sbloccata) |
| `drumOspite` | `{ "etichetta"?, "handle"?, "icona"? }`: artista ospite sulla fascia (icone come per le voci social) |
| `drumPriorita` | `{ "prefisso"?, "slot"?, "sopra"?, "icona"?: "rosa"\|"corona"\|"cuore"\|"regalo"\|"stella"\|"diamante"\|"logo", "richiamo"?: true }`: «Dona un…»; con `richiamo` il widget pulsa (solo se è acceso) |
| `drumEq` | `{ "sensibilita"?: 100, "stile"?: "barre"\|"onda", "senzaSegnale"?: true }`: equalizzatore (sensibilità 50–300) |
| `drumRiempimento` | `{ "stile": "perline"\|"sabbia" }` |
| `drumDemo` | `{ "fase": "vuoto"\|"meta"\|"sblocco"\|"finale" }`: dati di prova (Like, titoli delle prime 12 tappe, ospite, brano) |
| `likeEvento` | `{ "totale"?: 11400, "conteggio"?: 25 }`: simula un evento «like» di TikTok (per provare il Drum senza una live) |
| `produzione` | `{ "preset"?: "cooking"\|"sessione"\|"mix", "titolo"?: { "sopra"?, "testo"?, "sotto"? }, "velocita"? }` (limiti 32, 28 e 48 caratteri) |
| `reaction` | `{ "titolo"?: { "sopra"?, "testo"?, "sotto"? }, "velocita"? }` (limiti 40, 60 e 60 caratteri) |
| `podcast` | `{ "titolo"?: { "testo"?, "sotto"? }, "ospiti"?: [{ "nome", "handle", "icona" }], "tematiche"?: { "titolo"?, "elenco"?: ["…"], "attiva"?, "lato"?: "sx"\|"dx" }, "velocita"? }` (titolo 32 e riga 48 caratteri; massimo 4 ospiti; 8 tematiche da 48) |
| `podcastTematica` | `{ "avanti": true }` · `{ "indietro": true }` · `{ "indice": 2 }`: sposta la tematica attiva (senza giri) |
| `formatoTesti` | `{ "formato": "drum"\|"produzione"\|"reaction"\|"podcast", "valori": { "contatore": 140 } }` percento 60–200 per gruppo (Drum `contatore`, `traguardi`, `brano`, `priorita`, `sblocco`; produzione e reaction `sopra`, `titolo`, `sotto`; podcast `targa`, `tematiche`) · `{ "formato", "azzera": true }` torna al 100% |
| `formatoVelocita` | `{ "formato": "drum"\|"produzione"\|"reaction"\|"podcast", "velocita": 80 }`: velocità della fascia social (40–160 px/s) |
| `togliRisultato` | `{ "id" }` |
| `demo`, `nuovaSerata` | `{}` |

## Struttura

- `server.mjs`: HTTP, WebSocket, comandi, webhook Nero, collegamento TikTok
- `lib/stato.mjs`: punteggi, classifica, countdown, spareggio, impostazioni del layout senza premio, tracce ascoltate (logica pura, testata)
- `lib/chat.mjs`: riconoscimento dei voti e lettura dei commenti TikTok (`tiktok-live-connector`)
- `lib/nero.mjs`: verifica firma e lettura dei webhook Nero.fan
- `lib/battle.mjs`: regole del battle (fasi del round, chat, punteggio, torneo, classifica a punti, dati di prova; logica pura, testata) · `lib/validazione.mjs`: controlli condivisi di testi, numeri e voti
- `public/battle.html` + `css/battle.css`, `css/battle-tabellone.css`, `js/battle.js`, `js/battle-logica.js`, `js/battle-tabellone.js`: il layout battle (la logica pura è in `battle-logica.js`)
- `strumenti/mockup-battle.mjs`: mockup e controllo di geometria del battle con Playwright
- `lib/drum.mjs`: regole del Drum (Like, scaletta, progresso e annunci, impostazioni, dati di prova) · `lib/formati.mjs`: titoli di Studio Production e Reaction Release, preset, Podcast (titolo, ospiti, tematiche) · `lib/testi.mjs`: dimensione dei testi dei quattro layout nuovi · `lib/audio.mjs`: controllo dei messaggi di livello audio (12 bande e il colpo) che la regia manda e il server ritrasmette, con il limite di frequenza (tutte logica pura, testata)
- `public/drum.html` + `css/drum.css`, `js/drum.js`, `js/drum-logica.js` (parti pure), `js/drum-clessidra.js`, `js/drum-sblocco.js`, `js/drum-eq.js`: il Drum · `public/produzione.html` e `public/reaction.html` + `css/doppio.css` e `js/doppio.js` (una pagina per due layout) · `public/podcast.html` + `css/podcast.css`, `js/podcast.js` · `css/formati.css`, `js/pagina.js`, `js/fascia.js`, `js/targa.js` e `js/formati-logica.js`: le parti comuni (vetro, targa, monete, fascia social, avvio della pagina, parti pure)
- `public/js/regia-formati.js` (sezioni, dimensione dei testi, titoli, controlli del Drum), `regia-podcast.js` (moduli, tematiche, ospiti, scorciatoie) e `regia-audio.js` (ascolto dell'audio di FL Studio): la regia dei quattro layout nuovi
- `strumenti/mockup-formati.mjs`: mockup, controllo di geometria e prove dal vivo dei quattro layout nuovi con Playwright
- `public/`: overlay della gara, layout senza premio, live session in studio, battle e regia (HTML/CSS/JS senza build); `public/js/suoni.js` sintetizza gli effetti, `public/js/eventi-sonori.js` decide quando partono, `public/js/barra.js` mette in fila le voci della barra che scorre; `public/js/studio.js` + `studio-logica.js` (voci della barra e giro delle comparse, testate in `test/studio.test.mjs`) + `nastro.js` (il nastro che scorre) per la live session
- `mockup/`: anteprime generate dall'overlay vero (`?anteprima=1&statico=1`)

Test: `npm test`
