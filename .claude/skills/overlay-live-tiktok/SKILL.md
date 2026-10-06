---
name: overlay-live-tiktok
description: "Usala quando Backrooms Studio chiede un overlay per le live TikTok (OBS o TikTok LIVE Studio), nuovo o da modificare, con tabellone, classifica, timer/countdown, premio, voti della chat, Nero.fan, regia o effetti sonori, anche detto «come l'altra volta» o «un altro overlay simile»: parte dal modello overlay-live e arriva fino allo ZIP consegnato."
---

# Overlay live TikTok per Backrooms Studio

Serve a rifare in fretta, e bene, un overlay per le live dello studio, partendo dal primo: `overlay-live/`.
Cliente: Backrooms Studio, studio di registrazione a Vicenza, 3 giovani liberi professionisti, obiettivo 10.000 €/mese. Tutto in italiano: testi, codice, commit, messaggi.
Live di recensione su TikTok (@backrooms.studios). Giudici: Plugghe (Voce), Daniele (Beat), Freya (Mix). Le tracce arrivano da Nero.fan (utente `backrooms`, link pubblico `nero.fan/backrooms`, submission anche a pagamento: Skip, Super Skip, Throne).

Percorsi (dalla radice `/home/user/studious-train`): modello `overlay-live/`; skill `.claude/skills/overlay-live-tiktok/`, con `riferimenti/` (i dettagli) e `strumenti/` (gli script di verifica).

## Cosa c'è già: overlay-live, il modello

Server Node locale (`server.mjs`, niente build né framework) e due pagine statiche collegate via WebSocket: l'overlay (sorgente Link) e la regia. La logica sta in funzioni pure in `lib/stato.mjs`. 25 test con `npm test`.

| Pezzo | Cosa fa |
|---|---|
| Premio | «In palio» enorme in alto; sotto, frasi a rotazione ogni 6 s con il link `nero.fan/backrooms` in oro |
| Tabellone | traccia in ascolto, voti Beat/Voce/Mix più la chat; dopo la conferma il totale conta per 1,5 s e «timbra» |
| Classifica Top 5 | caselle oro/argento/bronzo, corona accanto al titolo del primo, badge di salita, notifica |
| Countdown | 3 h (180 min); rosso e lampeggiante negli ultimi 30 min, tic negli ultimi 10 s |
| Vincitore e spareggio | rullo di 2 s, poi colpo, fanfara e scintille; con pari merito proclama la regia |
| Regia (`/regia`) | voti, F2 chat, F4 conferma, F8 prossima, F9 pausa; schede In onda, Suoni, Serata, coda; ogni comando è anche `POST /api/<comando>` (Stream Deck) |
| Chat TikTok | `tiktok-live-connector`; voti `8`, `7,5`, `9/10`, `!voto 8`; un voto per utente (vale l'ultimo) |
| Nero.fan | API pubblica letta ogni 3 s: la traccia in onda va da sola sul tabellone; webhook firmato per le submission pagate |
| Suoni | 17 effetti sintetizzati con Web Audio; si sceglie dove suonano (overlay, regia, spenti); pulsanti Prova |
| Contorno | stato in `dati/stato.json`, `config.json` creato da `config.esempio.json`, `AVVIA.cmd`, `GUIDA.html`, `README.md`, `mockup/` |

## Prima di iniziare: cosa chiedere allo studio

Chiedi solo quello che cambia il lavoro. Per il resto valgono le preferenze di partenza.

1. **Uno screenshot dell'anteprima di TikTok LIVE Studio**, con la cornice a forma di telefono intera e i riquadri dove li vogliono (l'overlay vecchio spostato a mano, oppure rettangoli disegnati sopra). Senza screenshot usa le posizioni del modello.
2. **Cosa deve mostrare il nuovo formato**: quali riquadri, chi vota (giudici, chat o entrambi), come si calcola il punteggio, come si vince, quanto dura.
3. **Il premio e come si partecipa**: testo del premio, dove si manda la traccia, quali tier a pagamento mettere in risalto.
4. **Se va in onda insieme a overlay-live**: in quel caso servono porte diverse e riquadri che non si sovrappongono.
5. Verticale (predefinito) oppure orizzontale.

Preferenze di partenza, già chieste dallo studio. Valgono finché non dicono altro:
- tela 1080×1920; TUTTI i riquadri in UN SOLO overlay (una sorgente Link stesa su tutta la tela), nelle posizioni del loro screenshot;
- scritte MOLTO più grandi, leggibili da telefono; colori belli (palette di `public/css/base.css`);
- timer rosso e lampeggiante negli ultimi 30 minuti; primi tre su oro, argento e bronzo; corona accanto al titolo del primo;
- un effetto sonoro «figo» per ogni animazione (calcolo del punteggio, scalata, nuova entrata…);
- premio enorme e chiaro: chi entra in live deve capire subito come partecipare (banner sopra countdown e classifica, frasi a rotazione con `nero.fan/backrooms`).

## Procedura

Lavora in quest'ordine. Ogni fase dice dove trovare i dettagli.

### 1. Dallo screenshot alle coordinate (`riferimenti/posizioni-e-leggibilita.md` §2)
- Apri lo screenshot con Read. Misura la cornice in pixel: `bordo_sx`, `bordo_alto`, `larghezza_cornice`, `altezza_cornice` (lo script PIL è nel riferimento).
- Controlla la forma. A ottobre 2026 la cornice era ~720×1585 px, rapporto 0,454 (≈ 9:19,8). La tela la riempie in ALTEZZA e i LATI vengono TAGLIATI al centro.
- Verifica che sia un ritaglio e non uno stiramento: un pannello noto deve avere lo stesso rapporto L/A sulla tela e nello screenshot (entro ±4%).
- Formula: `k = altezza_cornice/1920` (0,8255), `taglio = (1080 − larghezza_cornice/k)/2` (104), `x_tela = taglio + (px − bordo_sx)/k`, `y_tela = (py − bordo_alto)/k`.
- Zone: visibile solo x 104…976. L'app TikTok copre in alto fino a y ~270 (nome della live, «Classifica giornaliera») e in basso da ~1770 (pulsanti). Zona sicura, con 12 px di margine: x 116…964, y 282…1756.
- Sui telefoni i commenti compaiono in basso a sinistra, ma l'anteprima non li mostra: avvisa lo studio.

### 2. Layout e CSS (`posizioni-e-leggibilita.md` §2.7 e §4–7)
- Copia il modello (ricetta in `riferimenti/architettura-e-riuso.md` §5: `git archive`, `npm install`, `npm test`), poi rinomina e cambia le porte.
- Scrivi le posizioni SOLO nel blocco di variabili `.verticale .palco` in cima a `public/css/overlay.css`. I riquadri le leggono con `var(--x)` e `var(--y-…)`.
- Corpi: nessun testo sotto 22 px; titoli ~56 px, numeri 56–98 px. Il gotico (`--font-gotico`, Grenze Gotisch) solo da ~34 px in su; sotto, Barlow Condensed (`--font-dati`).
- Testi che cambiano: usa `adattaTesto(el, massimo, minimo)` di `public/js/overlay.js`, che riduce il corpo finché il testo entra, invece dei puntini. L'elemento deve avere `white-space: nowrap; overflow: hidden` e `min-width: 0`.
- Riusa la palette e il podio di `base.css` (`--podio-oro`, `--podio-argento`, `--podio-bronzo`, `--oro-testo`), la corona `#corona` e `.timer.urgente`.

### 3. Logica del server e regia (`architettura-e-riuso.md` §2–4, `riferimenti/integrazioni.md`)
- La logica va in funzioni pure di `lib/stato.mjs`, con `ora` come argomento. Il server le chiama da `comandi` in `server.mjs`; `esegui` chiama poi `cambiato()`, che salva lo stato e lo manda alle pagine. Le pagine disegnano lo stato e mandano comandi, senza tenere dati propri.
- Campo nuovo nello stato: `statoIniziale`, poi `istantanea`, poi la fusione in `caricaStato`. Gli oggetti annidati si fondono a mano (come `visibili` e `suoni`); i testi predefiniti superati si migrano (come `INVITI_SUPERATI`). Se deve sopravvivere a una nuova serata, aggiungilo agli elenchi di `demo` e `nuovaSerata`.
- Widget nuovo: `WIDGET` in `lib/stato.mjs`, `data-widget` in `overlay.html`, `?w=` in `overlay.js`, interruttore In onda in `regia.html`.
- Nero.fan e chat: riusa `lib/nero.mjs` e `avviaTikTok` di `lib/chat.mjs` così come sono. Adatta solo cosa si fa con i dati (`tracciaDaNero`, `leggiVoto`).
- Pagina nuova: aggiungila a `PAGINE` in `server.mjs`, con un indirizzo che finisce in `.html`.

### 4. Suoni (`riferimenti/suoni.md`)
- I compiti sono divisi. Il suono si scrive in `effetti` di `public/js/suoni.js`, usando solo le primitive (nessun file). Quando parte lo decide `public/js/eventi-sonori.js`, con funzioni pure senza DOM. Lo fa suonare `riproduci`, sia in `overlay.js` sia in `regia.js`. Il pulsante Prova è un `data-suono` in `regia.html`.
- Sincronia: la durata di un'animazione legata a un suono va in una costante esportata da `eventi-sonori.js`. Nel modello il totale conta per 1,5 s e poi timbra; la classifica si muove dopo `RITARDO_CLASSIFICA_MS` (1700). Il rullo di 2 s del vincitore compare in tre punti: `effetti.vincitore`, `disegnaVincitore` e i `--d` di `overlay.html`.
- Niente suoni al primo disegno, perché LIVE Studio ricarica la sorgente quando vuole. Metti un tetto agli effetti ripetibili (nel modello, al massimo 4 `chatVoto`).

### 5. Test
- Lancia `npm test` (`node --test` su `test/*.test.mjs`). Copri: la logica dello stato, con l'ora passata a mano; gli eventi sonori, con `foto()` prima e dopo, compresi i casi che NON devono suonare; le integrazioni, con una `scarica` finta.
- Se hai aggiunto campi allo stato, prova anche a caricare un `stato.json` vecchio.

### 6. Render e prima/dopo (`riferimenti/verifica-e-consegna.md` §0–3)
- Prova su una COPIA della cartella con porte proprie (4797/4798, Nero finto su 4999). Lo stato vero non si tocca.
- Fai gli screenshot con `?anteprima=1&statico=1` e guardali con Read. Per le zone aggiungi `?guide=1`.
- Prima/dopo: l'overlay TRASPARENTE (senza `?anteprima`) sopra lo screenshot dello studio, alla stessa scala, con `composito.py`. È il controllo che convince lo studio.
- Poi: misura le frasi lunghe, misura i livelli dei suoni (picco < 1, nessuno muto) e fai l'MP3, prova il finto Nero, il webhook firmato e uno stato salvato vecchio. Segui la checklist da 14 punti del §1.

### 7. Documentazione (`verifica-e-consegna.md` §2 e §4)
- `README.md` per i tecnici, con le tabelle Posizioni e API aggiornate.
- `GUIDA.html` per lo studio: offline, passo passo, per il PC Windows della diretta (installazione di Node compresa).
- Rigenera `mockup/`, compresa `regia.jpg` con le zone numerate in giallo che la GUIDA cita.

### 8. Commit e push (`verifica-e-consegna.md` §5)
- Solo con i test verdi e la checklist fatta. Messaggio in italiano, descrittivo, dal punto di vista dello studio (`<Nome overlay>: …`), senza nomi né ID di modello.
- Prima di committare lancia `git status --short`. Non devono comparire `node_modules/`, `config.json`, `dati/` e `.claude/launch.json` (resta locale, è in `.git/info/exclude`).

### 9. ZIP e consegna (`verifica-e-consegna.md` §6–7)
- `pacchetto.py` va lanciato DOPO il commit, perché usa `git archive HEAD`.
- Poi prova lo ZIP da zero: estrai in una cartella nuova, `npm install --omit=dev`, `npm test`, avvia il server e controlla che `overlay.html` risponda 200.

## Regole che non si discutono

1. **Leggibilità**: niente testo sotto 22–24 px sulla tela 1080 (le etichette da 15 px della prima versione erano illeggibili). Misura le frasi; `adattaTesto` invece dei puntini.
2. **Zona visibile**: tutto tra x 116 e 964, fuori dalle zone dell'app (y < ~270 e y > ~1770). Il centro resta libero per il video.
3. **Una sola sorgente** Link 1080×1920, stesa su tutta la tela, con sfondo trasparente. Usa `?w=` solo se lo studio vuole separare i riquadri.
4. **Chromium vecchio** nel browser di OBS e LIVE Studio: niente `color-mix()` né CSS o API recenti; colori espliciti in variabili.
5. **`.html` nell'URL**: `http://127.0.0.1:<porta>/overlay.html`. LIVE Studio 1.36 accetta solo indirizzi con un punto seguito da 2–6 lettere. Si aggiunge con «Aggiungi fonte → Link», non con «Link di streaming».
6. **Suoni**: solo sintetizzati, niente file presi dal web (diritti d'autore). Dalla regia si sceglie dove suonano (overlay, regia, spenti), il volume e i Prova. Il link «Anteprima overlay» della regia ha `?muto=1`. L'audio si sblocca al primo clic. Non è ancora verificato che LIVE Studio mandi in diretta l'audio della sorgente Link.
7. **Stato retrocompatibile**: chi aggiorna non perde classifica né impostazioni (fusione e migrazioni in `caricaStato`).
8. **`npm test` verde** prima di ogni commit e push.
9. **Prima/dopo** sullo screenshot dello studio prima di consegnare.
10. **Fermare i server per porta**: `kill $(lsof -ti tcp:<porta> -sTCP:LISTEN)`. `pkill -f 'node server.mjs'` uccide anche la shell che lo lancia. `pkill -f '^node server\.mjs'` ferma TUTTI gli overlay della macchina.
11. **Più overlay insieme**: cambia `porta` (4747) e `nero.portaWebhook` (4748) nel `config.esempio.json` del clone (proposta: 4757/4758, 4767/4768…). Poi cerca i `4747` rimasti nei testi.

## Strumenti

Dalla radice del repo: `S=.claude/skills/overlay-live-tiktok/strumenti`, `B=http://127.0.0.1:<porta>`. Il server deve essere avviato; per gli strumenti con Playwright si usa `_browser.mjs`.

| Strumento | A cosa serve | Esempio |
|---|---|---|
| `_browser.mjs` | `apriBrowser()` apre Chromium (anche nel cloud); `comando(base, "nome={json}")` chiama l'API | `import { apriBrowser, comando } from "./_browser.mjs"` |
| `scatta.mjs` | screenshot dopo aver mandato dei comandi; con `.jpg` salva in JPEG; la regia viene a pagina intera | `node $S/scatta.mjs "$B/overlay.html?anteprima=1&statico=1" mockup/verticale.jpg 1080 1920 2500 demo` |
| `misura-testo.mjs` | quanto spazio serve a una frase in un elemento (⚠ TAGLIATO se non entra) | `node $S/misura-testo.mjs "$B/overlay.html?anteprima=1&statico=1" "#premio-invito" "Manda la tua traccia su nero.fan/backrooms"` |
| `composito.py` | overlay trasparente sopra lo screenshot dello studio, alla stessa scala | `python3 -I $S/composito.py studio.jpg ov.png prima-dopo.jpg 300 60 720 1585` |
| `nero-finto.mjs` | finto api.nero.fan; `/cambia?titolo=…&artista=…&tier=…`, `/spegni` | `node $S/nero-finto.mjs 4999 backrooms` poi `NERO_API=http://127.0.0.1:4999 node server.mjs` |
| `suoni.mjs` | rendering offline: `livelli` (picco, RMS, durata) oppure `wav` con una sequenza | `node $S/suoni.mjs "$B/overlay?muto=1" livelli` |
| `pacchetto.py` | ZIP dai file versionati, `.cmd` in CRLF, senza `node_modules`, `config.json`, `dati/` | `python3 -I $S/pacchetto.py overlay-live <scratchpad>/overlay-live.zip` |

Per l'MP3: `suoni.mjs … wav out.wav '<sequenza>' 36`, poi `ffmpeg -i out.wav -b:a 192k out.mp3` (sequenza pronta in `suoni.md` §9).
Nel cloud `api.nero.fan` è bloccato, e anche la chat TikTok, perché la firma passa da `api.eulerstream.com`. Prova Nero con `nero-finto.mjs` e la chat con i comandi `messaggioChat` e `simulaChat`.

## Cosa consegnare allo studio e come dirlo

Manda con `SendUserFile`, ogni file con una didascalia di una riga:
1. `prima-dopo.jpg`: «a sinistra la vostra anteprima, a destra con l'overlay nuovo»;
2. i mockup (verticale, ultimi minuti, vincitore, spareggio, regia);
3. `suoni.mp3`, con l'ordine dei suoni in secondi;
4. lo ZIP (`display: "attach"`): «estraetelo in Documenti e aprite GUIDA.html».

Poi scrivi un messaggio in italiano semplice, senza parole tecniche, su cosa provare sul PC della diretta (da qui non si può):
- **sfondo trasparente** in LIVE Studio: sotto i riquadri si deve vedere la camera;
- **suoni in diretta**: in regia premete Prova → Primo posto e ascoltate da un telefono collegato alla live. Se non si sente, scegliete «in questa pagina» e in LIVE Studio aggiungete l'audio del PC;
- **commenti**: sui telefoni escono in basso a sinistra e l'anteprima non li mostra. Guardate la live da un telefono e diteci se coprono qualcosa;
- **Nero.fan**: avviate la sessione live su nero.fan prima della diretta, altrimenti la regia scrive «Nessuna sessione live»;
- **chat TikTok**: in alto nella regia deve comparire «TikTok in ascolto».

Chiudi chiedendo uno screenshot dell'anteprima se qualcosa risulta tagliato o coperto.

## Workflow salvato

Per un nuovo overlay, con ultracode puoi lanciare il workflow salvato `nuovo-overlay-live` (file `.claude/workflows/nuovo-overlay-live.js`), con args `{ nome, cartella, descrizione, screenshot? }`. Facoltativo anche `cornice: { x, y, larghezza, altezza }`, la cornice già misurata. `cartella` e `descrizione` sono obbligatori.
- Le fasi sono: Capisci (piano di riuso e posizioni), Progetta (tre proposte: leggibilità, intrattenimento, conversione; poi una sintesi), Costruisci, Verifica (posizioni, logica, suoni, consegna) e Correggi (al massimo 2 giri). Restituisce cartella, porta, file, screenshot, dubbi e i problemi che restano.
- Non fa commit, push né ZIP: dopo il workflow fai tu le fasi 8–9 e la consegna, controllando prima i `restanti`.
- I suoi agenti fermano i server con `pkill -f '^node server\.mjs'`. Se sulla macchina deve restare acceso il server di un altro overlay, ricordalo e riavvialo dopo.
