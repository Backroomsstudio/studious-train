# Overlay live — Backrooms

Overlay per le live di recensione su TikTok: premio in palio in grande, tabellone della traccia in ascolto (Beat, Voce e Mix, ognuno col suo giudice, più il voto della chat), classifica Top 5 animata con podio oro/argento/bronzo e corona, countdown di 3 ore (rosso e lampeggiante negli ultimi 30 minuti), notifiche, effetti sonori, schermata del vincitore e spareggio. Gira in locale sul PC della diretta e non dipende dal sito Next.js.

Lo stesso server fa anche il **layout senza premio** per le live giornaliere di ascolto (`/senza-premio.html`): banner «Mandaci la tua musica!» con `nero.fan/backrooms`, barra che scorre con i social, scheda «Ora in ascolto» che sale quando su Nero parte una traccia, spot dello studio. Stessa regia, stessa traccia automatica da Nero, stessi suoni (vedi [Layout senza premio](#layout-senza-premio)).

C'è anche il layout **Live session in studio** (`/studio.html`): split screen da tre con il fonico in alto, l'artista al centro e la DAW (FL Studio) in basso. Tra fonico e artista c'è una targa 3D con nome e Instagram dell'artista, che si compilano dalla regia. Tra artista e DAW c'è la barra dei nostri social, da cui salgono le comparse «Vieni a trovarci in studio» e «Scrivici in DM». Il layout non ha nessun suono (vedi [Live session in studio](#live-session-in-studio)).

Per gli scontri tra due rapper c'è il layout **Battle** (`/battle.html`): barre della vita in stile Tekken che seguono il voto della chat, camera al centro divisa da un fulmine con il VS, modalità e timer con il gong, tre giudici (Luca, Freya, Daniele), tabellone a torneo o a punti e pop-up social (vedi [Battle](#battle)).

```
Nero.fan ─webhook─▶ ┐                                        ┌──▶ /overlay.html       (gara con premio, sorgente Link)
Commenti TikTok ──▶ │  server.mjs (Node, porta 4747) ─WebSocket─┼──▶ /senza-premio.html  (live giornaliere, sorgente Link)
Regia / Stream Deck ▶ ┘  stato + dati/stato.json                 ├──▶ /studio.html        (live session in studio, sorgente Link)
                                                                 ├──▶ /battle.html        (scontro tra due rapper, sorgente Link)
                                                                 └──▶ /regia               (browser della regia)
```

Anteprime in [`mockup/`](mockup): verticale, ultimi minuti (timer rosso e nuovo primo posto), zone del telefono, orizzontale, vincitore, spareggio, la regia, il layout senza premio (`senza-premio*.jpg`) la live session in studio (`studio*.jpg`) e il battle (`battle-*.jpg`, la regia in `regia-battle.jpg`).

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

## Effetti sonori

Ogni animazione ha il suo effetto, sintetizzato al momento con Web Audio (`public/js/suoni.js`: nessun file audio, nessun diritto d'autore): nuova traccia, voto dei giudici (la nota sale col voto), voto nascosto, apertura/chiusura del voto chat, pop dei voti della chat, calcolo del punteggio con colpo finale, nuova entrata, scalata, uscita dalla top, fanfara del nuovo primo posto, premio cambiato, sirena a 30 minuti e a 1 minuto dalla fine, tic negli ultimi 10 secondi, rullo e fanfara del vincitore, battito dello spareggio; nel layout senza premio `inAscolto` (traccia nuova, con un tocco in più per Skip, Super Skip e Throne) e la campanella del richiamo. Quale effetto parte e quando lo decide `public/js/eventi-sonori.js` (testato in `test/eventi-sonori.test.mjs`).

Per il battle: `gong` (via e fine), `conto` (i tre bip del 3-2-1), `spacco` (il fulmine) e, riusati dalla gara, sirena a 30 secondi dalla fine, tic negli ultimi 10, `voto` e `calcolo` per i giudici e `vincitore` (rullo e fanfara) per la schermata del vincitore di ogni round; quando partono lo decide `suoniBattle` in `eventi-sonori.js`.

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

Con il **battle** in onda i tasti fanno altro: `F2` avvia il round, `F4` o `Ctrl+Invio` rivela i voti dei giudici, `F8` passa al prossimo scontro, `F9` ferma o fa ripartire il timer.

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
| `layout` | Layout in onda all'avvio: `"gara"` (predefinito), `"senzaPremio"`, `"studio"` o `"battle"` (si cambia dalla regia) |
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
| `widget` | `{ "nome": "premio"\|"tabellone"\|"classifica"\|"timer"\|"banner"\|"barra"\|"scheda"\|"targa"\|"barraStudio"\|"comparse"\|"barreVita"\|"modalita"\|"timerBattle"\|"giudiciBattle"\|"popupBattle"\|"vittoriaBattle"\|"bracket", "visibile": true }` |
| `nascondiVoti` | `{ "attivo": true }`: l'overlay mostra "?" fino alla conferma |
| `premio` | `{ "testo": "Mix + Master" }` |
| `invito` | `{ "testo": "La traccia più votata vince \| Manda la tua traccia su nero.fan/backrooms" }` |
| `suoni` | `{ "dove"?: "overlay"\|"regia"\|"spenti", "volume"?: 0.8 }` |
| `provaSuono` | `{ "nome": "primo", "dati"?: { "tier": "throne" } }`: fa suonare un effetto dove sono attivi i suoni (es. da un tasto dello Stream Deck) |
| `layout` | `{ "nome": "gara"\|"senzaPremio"\|"studio"\|"battle" }`: layout in onda (chi suona, e se la traccia di Nero aspetta i voti) |
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
- `public/`: overlay della gara, layout senza premio, live session in studio, battle e regia (HTML/CSS/JS senza build); `public/js/suoni.js` sintetizza gli effetti, `public/js/eventi-sonori.js` decide quando partono, `public/js/barra.js` mette in fila le voci della barra che scorre; `public/js/studio.js` + `studio-logica.js` (voci della barra e giro delle comparse, testate in `test/studio.test.mjs`) + `nastro.js` (il nastro che scorre) per la live session
- `mockup/`: anteprime generate dall'overlay vero (`?anteprima=1&statico=1`)

Test: `npm test`
