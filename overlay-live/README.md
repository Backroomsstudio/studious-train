# Overlay live — Backrooms

Overlay per le live di recensione su TikTok: tabellone della traccia in ascolto (Beat, Voce e Mix, ognuno col suo giudice, più il voto della chat), classifica Top 5 animata, countdown di 3 ore, schermata del vincitore e spareggio. Gira in locale sul PC della diretta e non dipende dal sito Next.js.

```
Nero.fan ─webhook─▶ ┐
Commenti TikTok ──▶ │  server.mjs (Node, porta 4747) ──WebSocket──▶ /overlay  (sorgente Link in TikTok LIVE Studio)
Regia / Stream Deck ▶ ┘  stato + dati/stato.json ─────────────────▶ /regia    (browser della regia)
```

Anteprime in [`mockup/`](mockup): verticale, orizzontale, vincitore, spareggio e la regia.

**Guida passo passo per la regia** (installazione sul PC fisso, TikTok LIVE Studio, uso durante la live, problemi comuni): [`GUIDA.html`](GUIDA.html), si apre con un doppio clic.

## Avvio (sul PC con TikTok LIVE Studio)

Serve Node.js 22 o più recente (`winget install OpenJS.NodeJS.LTS`). Copia la cartella `overlay-live` su quel PC e fai doppio clic su `AVVIA.cmd`: la prima volta installa le dipendenze. In alternativa:

```bash
npm install
npm start
```

Al primo avvio viene creato `config.json` (copia di `config.esempio.json`). Lo stato della serata è salvato in `dati/stato.json`: se chiudi il server o riavvii il PC, la classifica resta.

## TikTok LIVE Studio

1. Aggiungi una sorgente **Link** con URL `http://127.0.0.1:4747/overlay.html`, larghezza 1080 e altezza 1920 (diretta verticale). Lo sfondo è trasparente.
   Serve proprio `overlay.html`: LIVE Studio (1.36) controlla l'indirizzo con un'espressione che vuole un punto seguito da 2–6 lettere (come `.com` o `.html`) e poi lo scarica una volta. Con `http://127.0.0.1:4747/overlay` o `localhost` risponde «Inserisci l'URL corretto».
2. Un widget per sorgente, se vuoi spostarli a mano: `overlay.html?w=tabellone`, `?w=classifica`, `?w=timer`, `?w=vincitore` (anche combinati, es. `?w=tabellone,timer`). Ogni sorgente resta 1080×1920.
3. Diretta orizzontale: `overlay.html?formato=orizzontale` con una sorgente 1920×1080.

Nel formato verticale i widget restano fuori dalle zone coperte dall'app TikTok: in alto nome e spettatori (fino a circa 230 px), in basso commenti e regali (da circa 1160 px). Le posizioni si cambiano in cima a `public/css/overlay.css`.

Per vedere l'overlay in un browser normale: `http://127.0.0.1:4747/overlay?anteprima=1` (sfondo scuro al posto della trasparenza).

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
- **Premio e giudici**: si cambiano dalla regia (*Serata*); valgono per tutta la serata.

La chat accetta `8`, `7.5`, `7,5`, `9/10`, `!voto 8`. Un voto per utente (vale l'ultimo), solo mentre il voto è aperto. Il totale è la media di Beat, Voce, Mix e Chat (25% ciascuno).

## config.json

| Campo | Cosa fa |
|---|---|
| `giudici` | Giudice di ogni categoria: `{ "beat": "...", "voce": "...", "mix": "..." }` (modificabile anche dalla regia) |
| `pesi` | Peso di ogni voce nel totale (default uguali: chat al 25%) |
| `topN` | Posizioni in classifica |
| `premio` | Premio iniziale (si cambia dalla regia) |
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
| `widget` | `{ "nome": "tabellone"\|"classifica"\|"timer", "visibile": true }` |
| `nascondiVoti` | `{ "attivo": true }`: l'overlay mostra "?" fino alla conferma |
| `premio` | `{ "testo": "Mix + Master" }` |
| `togliRisultato` | `{ "id" }` |
| `demo`, `nuovaSerata` | `{}` |

## Struttura

- `server.mjs`: HTTP, WebSocket, comandi, webhook Nero, collegamento TikTok
- `lib/stato.mjs`: punteggi, classifica, countdown, spareggio (logica pura, testata)
- `lib/chat.mjs`: riconoscimento dei voti e lettura dei commenti TikTok (`tiktok-live-connector`)
- `lib/nero.mjs`: verifica firma e lettura dei webhook Nero.fan
- `public/`: overlay e regia (HTML/CSS/JS senza build)
- `mockup/`: anteprime generate dall'overlay vero (`?anteprima=1&statico=1`)

Test: `npm test`
