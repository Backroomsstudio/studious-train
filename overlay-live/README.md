# Overlay live — Backrooms

Overlay per le live di recensione su TikTok: premio in palio in grande, tabellone della traccia in ascolto (Beat, Voce e Mix, ognuno col suo giudice, più il voto della chat), classifica Top 5 animata con podio oro/argento/bronzo e corona, countdown di 3 ore (rosso e lampeggiante negli ultimi 30 minuti), notifiche, effetti sonori, schermata del vincitore e spareggio. Gira in locale sul PC della diretta e non dipende dal sito Next.js.

Lo stesso server fa anche il **layout senza premio** per le live giornaliere di ascolto (`/senza-premio.html`): banner «Mandaci la tua musica!» con `nero.fan/backrooms`, barra che scorre con i social, scheda «Ora in ascolto» che sale quando su Nero parte una traccia, spot dello studio. Stessa regia, stessa traccia automatica da Nero, stessi suoni (vedi [Layout senza premio](#layout-senza-premio)).

```
Nero.fan ─webhook─▶ ┐                                        ┌──▶ /overlay.html       (gara con premio, sorgente Link)
Commenti TikTok ──▶ │  server.mjs (Node, porta 4747) ─WebSocket─┼──▶ /senza-premio.html  (live giornaliere, sorgente Link)
Regia / Stream Deck ▶ ┘  stato + dati/stato.json                 └──▶ /regia               (browser della regia)
```

Anteprime in [`mockup/`](mockup): verticale, ultimi minuti (timer rosso e nuovo primo posto), zone del telefono, orizzontale, vincitore, spareggio, la regia e il layout senza premio (`senza-premio*.jpg`).

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
- **Barra che scorre** sotto la camera, a filo dei bordi: social e link con icone disegnate da noi (Nero.fan, Instagram + TikTok `@backrooms.studios`, Twitch e Kick `@backrooms_studio`, `backroomsstudio.it`), la traccia in ascolto e, da 3 tracce, «Oggi abbiamo ascoltato N tracce». Scorre a 80 px/s (40–160); il contenuto nuovo entra da destra, quello che si sta leggendo non salta mai.
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

## Effetti sonori

Ogni animazione ha il suo effetto, sintetizzato al momento con Web Audio (`public/js/suoni.js`: nessun file audio, nessun diritto d'autore): nuova traccia, voto dei giudici (la nota sale col voto), voto nascosto, apertura/chiusura del voto chat, pop dei voti della chat, calcolo del punteggio con colpo finale, nuova entrata, scalata, uscita dalla top, fanfara del nuovo primo posto, premio cambiato, sirena a 30 minuti e a 1 minuto dalla fine, tic negli ultimi 10 secondi, rullo e fanfara del vincitore, battito dello spareggio; nel layout senza premio `inAscolto` (traccia nuova, con un tocco in più per Skip, Super Skip e Throne) e la campanella del richiamo. Quale effetto parte e quando lo decide `public/js/eventi-sonori.js` (testato in `test/eventi-sonori.test.mjs`).

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
| `layout` | Layout in onda all'avvio: `"gara"` (predefinito) o `"senzaPremio"` (si cambia dalla regia) |
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
| `widget` | `{ "nome": "premio"\|"tabellone"\|"classifica"\|"timer"\|"banner"\|"barra"\|"scheda", "visibile": true }` |
| `nascondiVoti` | `{ "attivo": true }`: l'overlay mostra "?" fino alla conferma |
| `premio` | `{ "testo": "Mix + Master" }` |
| `invito` | `{ "testo": "La traccia più votata vince \| Manda la tua traccia su nero.fan/backrooms" }` |
| `suoni` | `{ "dove"?: "overlay"\|"regia"\|"spenti", "volume"?: 0.8 }` |
| `provaSuono` | `{ "nome": "primo", "dati"?: { "tier": "throne" } }`: fa suonare un effetto dove sono attivi i suoni (es. da un tasto dello Stream Deck) |
| `layout` | `{ "nome": "gara"\|"senzaPremio" }`: layout in onda (chi suona, e se la traccia di Nero aspetta i voti) |
| `senzaPremio` | Uno o più campi: `sopra`, `titolo`, `pillola`, `link` (testi del banner); `voci` (`[{ "attiva", "icona", "etichetta", "testo" }]`, icone `nero`, `instagram`, `tiktok`, `instagram+tiktok`, `twitch`, `kick`, `youtube`, `spotify`, `whatsapp`, `sito`, `microfono`, `logo`; massimo 12, 8 accese, testo fino a 40 caratteri); `velocita` (40–160); `inAscoltoNellaBarra`, `ascoltateNellaBarra`, `loghiBarra`, `filoCamera`; `durate` (`{ "standard", "skip", "superskip", "throne" }`, 4–20 s); `suonoTraccia` (`"delicato"\|"pieno"\|"nessuno"`); `richiamoOgniMinuti` (0–30); `spot` (`{ "sopra", "titolo", "sotto" }`) |
| `ripristinaSenzaPremio` | `{}`: testi, social e impostazioni di partenza |
| `richiamo` | `{}`: il link del banner si illumina, con la campanella |
| `spotStudio` | `{}`: scheda «Vuoi suonare così?» per 10 secondi |
| `ripetiScheda` | `{}`: rimostra la scheda della traccia in ascolto, senza suono |
| `provaScheda` | `{ "tier": "standard"\|"skip"\|"superskip"\|"throne" }`: scheda di prova, senza cambiare traccia |
| `togliRisultato` | `{ "id" }` |
| `demo`, `nuovaSerata` | `{}` |

## Struttura

- `server.mjs`: HTTP, WebSocket, comandi, webhook Nero, collegamento TikTok
- `lib/stato.mjs`: punteggi, classifica, countdown, spareggio, impostazioni del layout senza premio, tracce ascoltate (logica pura, testata)
- `lib/chat.mjs`: riconoscimento dei voti e lettura dei commenti TikTok (`tiktok-live-connector`)
- `lib/nero.mjs`: verifica firma e lettura dei webhook Nero.fan
- `public/`: overlay della gara, layout senza premio e regia (HTML/CSS/JS senza build); `public/js/suoni.js` sintetizza gli effetti, `public/js/eventi-sonori.js` decide quando partono, `public/js/barra.js` mette in fila le voci della barra che scorre
- `mockup/`: anteprime generate dall'overlay vero (`?anteprima=1&statico=1`)

Test: `npm test`
