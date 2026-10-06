# Overlay live — Backrooms

Overlay per le live di recensione su TikTok: premio in palio in grande, tabellone della traccia in ascolto (Beat, Voce e Mix, ognuno col suo giudice, più il voto della chat), classifica Top 5 animata con podio oro/argento/bronzo e corona, countdown di 3 ore (rosso e lampeggiante negli ultimi 30 minuti), notifiche, effetti sonori, schermata del vincitore e spareggio. Gira in locale sul PC della diretta e non dipende dal sito Next.js.

```
Nero.fan ─webhook─▶ ┐
Commenti TikTok ──▶ │  server.mjs (Node, porta 4747) ──WebSocket──▶ /overlay  (sorgente Link in TikTok LIVE Studio)
Regia / Stream Deck ▶ ┘  stato + dati/stato.json ─────────────────▶ /regia    (browser della regia)
```

Anteprime in [`mockup/`](mockup): verticale, ultimi minuti (timer rosso e nuovo primo posto), zone del telefono, orizzontale, vincitore, spareggio e la regia.

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

## Effetti sonori

Ogni animazione ha il suo effetto, sintetizzato al momento con Web Audio (`public/js/suoni.js`: nessun file audio, nessun diritto d'autore): nuova traccia, voto dei giudici (la nota sale col voto), voto nascosto, apertura/chiusura del voto chat, pop dei voti della chat, calcolo del punteggio con colpo finale, nuova entrata, scalata, uscita dalla top, fanfara del nuovo primo posto, premio cambiato, sirena a 30 minuti e a 1 minuto dalla fine, tic negli ultimi 10 secondi, rullo e fanfara del vincitore, battito dello spareggio. Quale effetto parte e quando lo decide `public/js/eventi-sonori.js` (testato in `test/eventi-sonori.test.mjs`).

Dalla regia (*Suoni*): dove suonano (nell'overlay, nella regia o spenti), volume e pulsanti di prova. Se la sorgente Link di LIVE Studio non manda l'audio in diretta, si sceglie «in questa pagina» e si cattura l'audio del PC.

## Regia

`http://127.0.0.1:4747/regia` sul PC della diretta. Per usarla da un altro computer o tablet sulla stessa rete: in `config.json` metti `"host": "0.0.0.0"` e un `"pinRegia"`, poi apri `http://<ip-del-pc-della-diretta>:4747/regia`.

| Tasto | Azione |
|---|---|
| `F2` | Apri / chiudi il voto della chat |
| `F4` o `Ctrl+Invio` | Conferma il punteggio (la traccia entra in classifica se ha il punteggio) |
| `F8` | Prossima traccia |
| `F9` | Pausa / riprendi il countdown |
| `Invio` in un voto | Passa al voto successivo |

Flusso tipico: *In ascolto ora* (o ▶ dalla coda) → i tre giudici dicono il voto, la regia lo scrive → `F2` apre il voto della chat → `F4` conferma → `F8`.

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
| `nero.username` | Username Nero.fan: la regia mostra la coda pubblica ufficiale |
| `nero.segreto` | Signing secret dei webhook Nero.fan |
| `host`, `pinRegia` | Regia da altri dispositivi in rete (vedi sopra) |

## Nero.fan

Nero manda un webhook firmato a ogni submission **pagata** (`submission.paid`): finisce nella coda della regia, ordinata come su Nero (Throne, Super Skip, Skip, Standard), e con ▶ passa sul tabellone. Le submission gratuite non generano webhook: la regia mostra la coda pubblica di Nero (*Coda su Nero.fan*) e si aggiungono con *Metti in coda*.

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
| `widget` | `{ "nome": "premio"\|"tabellone"\|"classifica"\|"timer", "visibile": true }` |
| `nascondiVoti` | `{ "attivo": true }`: l'overlay mostra "?" fino alla conferma |
| `premio` | `{ "testo": "Mix + Master" }` |
| `invito` | `{ "testo": "La traccia più votata vince \| Manda la tua traccia su nero.fan/backrooms" }` |
| `suoni` | `{ "dove"?: "overlay"\|"regia"\|"spenti", "volume"?: 0.8 }` |
| `provaSuono` | `{ "nome": "primo" }`: fa suonare un effetto dove sono attivi i suoni (es. da un tasto dello Stream Deck) |
| `togliRisultato` | `{ "id" }` |
| `demo`, `nuovaSerata` | `{}` |

## Struttura

- `server.mjs`: HTTP, WebSocket, comandi, webhook Nero, collegamento TikTok
- `lib/stato.mjs`: punteggi, classifica, countdown, spareggio (logica pura, testata)
- `lib/chat.mjs`: riconoscimento dei voti e lettura dei commenti TikTok (`tiktok-live-connector`)
- `lib/nero.mjs`: verifica firma e lettura dei webhook Nero.fan
- `public/`: overlay e regia (HTML/CSS/JS senza build); `public/js/suoni.js` sintetizza gli effetti, `public/js/eventi-sonori.js` decide quando partono
- `mockup/`: anteprime generate dall'overlay vero (`?anteprima=1&statico=1`)

Test: `npm test`
