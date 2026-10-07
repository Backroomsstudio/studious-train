# Quattro nuovi format della regia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a `overlay-live` i layout 5°–8° `drum`, `produzione`, `podcast` e `reaction` (Drum Challenge con Like TikTok, scaletta di sblocchi ed equalizzatore da FL Studio; Studio Production; Back Rooms Podcast e Reaction Release anche in 16:9), ciascuno con la sua pagina e la sua sezione di regia.

**Architecture:** Le regole stanno in moduli di funzioni pure (`lib/drum.mjs`, `lib/formati.mjs`, `lib/testi.mjs`, `lib/audio.mjs`) testati con `node --test`. `server.mjs` le espone come comandi, riceve i Like da `tiktok-live-connector` e ritrasmette i livelli audio mandati dalla regia. Le quattro pagine (HTML/CSS/JS senza build) condividono `pagina.js`, `simboli.js`, `fascia.js` e `formati.css`; la regia ottiene quattro sezioni (`regia-formati.js`, `regia-audio.js`) e una scheda «Social del brand». I quattro layout esistenti non cambiano comportamento.

**Tech Stack:** Node ≥ 22, `ws` e `tiktok-live-connector` (già presenti), Web Audio (analisi e suoni sintetizzati), Web Worker, canvas 2D, HTML/CSS/JS senza build, `node --test`. Playwright (globale, già installato) solo per mockup e controlli nel browser, fuori da `npm test`.

**Spec:** `docs/superpowers/specs/2026-10-07-quattro-format-live-design.md`

## Global Constraints

- Node ≥ 22; nessuna nuova dipendenza npm; nessuna fase di build. Playwright solo in `strumenti/`.
- Si lavora in `overlay-live/` sul branch `claude/practical-cannon-6wegnn`, nessuna PR. Ogni commit: `git commit -m "<messaggio> [skip netlify]" -m "Co-Authored-By: Claude <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01KknJSv8vijv85bNpvfWr5a"`. Nessun nome di modello in codice, commenti o messaggi.
- I 138 test esistenti (`cd overlay-live && node --test`) restano verdi a ogni task; `gara`, `senzaPremio`, `studio` e `battle` non cambiano comportamento.
- Layout e pagine: `drum` → `/drum.html`; `produzione` → `/produzione.html`; `podcast` → `/podcast.html`; `reaction` → `/reaction.html` (le ultime due anche con `?formato=orizzontale`, 1920×1080); route anche senza `.html`. Nomi in regia: «Drum Challenge Live», «Studio Production», «Back Rooms Podcast», «Reaction Release».
- Tela verticale 1080×1920: contenuti tra x 116 e 964 (fasce e linee a tutta larghezza escluse); zone TikTok: intestazione 0–230 (fino a ~270 con il nome della live), zona libera 230–1200, chat 1200–1700.
- Griglie (px, `[x, y, larghezza, altezza]`, una voce per `data-parte`):
  - **drum** (verticale): `brano` [116, 282, 524, 80]; `priorita` [116, 380, 524, 106]; `contatore` [676, 282, 288, 68]; `colonna` [676, 366, 288, 640] (4 moduli 288×148, passo 164); `eq` [116, 1016, 848, 84]; `cornice` [116, 262, 848, 838]; `fascia` [0, 1108, 1080, 92]; `sblocco` [116, 520, 524, 170].
  - **produzione** e **reaction** (verticale): `titolo` [116, 282, 848, 160]; `fascia` [0, 1212, 1080, 92]; finto A [0, 0, 1080, 1212]; finto B [0, 1304, 1080, 616].
  - **reaction** (orizzontale): `titolo` [360, 28, 1200, 140]; `finestraA` [24, 192, 576, 702]; `divisore` [600, 192, 48, 702]; `finestraB` [648, 192, 1248, 702]; `fascia` [0, 920, 1920, 92].
  - **podcast** (verticale): `targa` [116, 282, 848, 90]; `tematiche` [116, 400, 848, 480]; `linea` [538, 240, 4, 860]; `fascia` [0, 1108, 1080, 92]. (orizzontale): `targa` [48, 36, 512, 90]; `tematiche` [48, 150, 512, 570] (o x 1360 con `lato: "dx"`); `linea` [958, 0, 4, 968]; `fascia` [0, 968, 1920, 92].
- Scaletta di partenza (37 tappe): 1000, 2000, 3000, 5000, 7000, 9000, 10000, 12000, 15000, 17000, 20000, 22000, 25000, 27000, 29000, 30000, poi 32000, 35000, 37000, 40000, 45000, 50000, 60000, 70000, 80000, 90000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 450000, 500000. Titoli vuoti; senza titolo allo sblocco si legge «Brano a sorpresa».
- Limiti dei testi: tappa `like` 1…1.000.000, massimo 80 tappe, titolo brano ≤ 60; brano in esecuzione artista ≤ 40; ospite `etichetta` ≤ 24, `handle` ≤ 40; priorità `prefisso` ≤ 16, `slot` ≤ 20 (non vuoto), `sopra` ≤ 40; produzione `sopra` ≤ 32, `testo` ≤ 28 (non vuoto), `sotto` ≤ 48; reaction `sopra` ≤ 40, `testo` ≤ 60 (non vuoto), `sotto` ≤ 60; podcast titolo ≤ 32 (non vuoto), sotto ≤ 48, ospiti massimo 4 (`nome` ≤ 24 non vuoto, `handle` ≤ 40), tematiche massimo 8 voci ≤ 48, titolo pannello ≤ 32; velocità della fascia 40–160 px/s (predefinita 80); sensibilità dell'equalizzatore 50–300 (predefinita 100); dimensione dei testi 60–200 (predefinita 100).
- Stile: palette e font solo da `public/css/base.css` (`--viola`, `--magenta`, `--ciano`, `--verde`, `--oro-testo`, `--cromo`, `--font-dati`, `--font-gotico`), logo `/assets/logo-br.png`. **Niente `backdrop-filter`** (non sfoca la camera dietro): il vetro è `.fm-vetro` (formula in spec §4). Testi dell'interfaccia e messaggi d'errore in italiano.
- Testi leggibili da telefono: etichette in maiuscolo spaziate 24 px; ogni altro testo almeno 32 px; nomi, titoli e numeri da 44 px in su. Corpi di base (px): Drum contatore 64 (etichetta «LIKE» 26), modulo target 52 / titolo 34 / «mancano» 26 / percentuale 30, brano etichetta 22 / titolo 40, priorità sopra 24 / prefisso 38 / slot 56, banner sblocco etichetta 28 / titolo 72; produzione e reaction sopra 28 / titolo 88 (adattato fino a 40) / sotto 32; podcast targa 48 / sotto 32, pannello titolo 32 / voci 34. I corpi si moltiplicano per `--ts-<gruppo>` (dimensione dei testi) e si adattano al riquadro con `adattaTesto`.
- Convenzioni di pagina: `?anteprima=1` (sfondo nero e finti schermi `[data-finto]`), `&guide=1` (solo verticale), `&statico=1` (stato finale senza animazioni), `?formato=orizzontale` (solo podcast e reaction). Ogni pezzo misurabile ha `data-parte="<nome>"`.
- Suoni: solo il Drum suona (`sblocco`); `produzione`, `podcast` e `reaction` sono muti. Suona solo la pagina del layout in onda (`suonaIn`).
- Audio dalla regia: 12 bande, `b` interi 0–100, `c` intero 0–100, un messaggio ogni ≥ 25 ms per connessione, stesso PIN dei comandi, ritrasmesso solo con il layout `drum` in onda.
- Compatibilità degli stati salvati: ogni sezione nuova si unisce con `fondi*` (valori buoni conservati, valori rotti → predefiniti, mai eccezioni).

## Review Focus

1. **Tappe e riavvii**: Like che scendono (correzione), salti su più tappe, scaletta con tutte le tappe sbloccate (500k), riavvio del server con gli annunci già pari alle tappe raggiunte, pagina ricaricata a metà diretta: nessun sblocco ripetuto, nessuna animazione al primo disegno. → Task 4, 5, 14.
2. **Messaggi `audio` malformati o a raffica** (array di lunghezza sbagliata, NaN, stringhe, JSON rotto, messaggi enormi, mille al secondo, PIN mancante o sbagliato): il server non cade, non ritrasmette, gli altri client restano collegati. → Task 9.
3. **Stato salvato di una versione precedente** (nessuna sezione nuova) o con valori rotti nelle sezioni nuove: partenza pulita con i predefiniti, gli altri layout intatti. → Task 5, 6, 7, 8.
4. **Testi lunghi nei riquadri fissi** (titolo brano da 60 caratteri, handle da 40, titolo reaction da 60, tematica da 48, nome ospite da 24) e dimensione dei testi al 200%: niente esce dal riquadro o dalla zona libera. → Task 12, 18, 20.
5. **Cambio di layout o spegnimento di un widget durante uno sblocco, e più sorgenti aperte insieme** (drum e battle in LIVE Studio): suona solo il layout in onda; la sequenza non lascia a metà banner o colonna e al ritorno la colonna è nello stato aggiornato. → Task 14.

## File Structure

Create:
- `lib/testi.mjs` (dimensione dei testi), `lib/drum.mjs` (regole del Drum), `lib/formati.mjs` (produzione, reaction, podcast), `lib/audio.mjs` (messaggi audio e limite di frequenza)
- `public/drum.html`, `produzione.html`, `podcast.html`, `reaction.html`
- `public/css/formati.css`, `drum.css`, `doppio.css`, `podcast.css`
- `public/js/simboli.js`, `pagina.js`, `fascia.js`, `formati-logica.js`, `drum.js`, `drum-logica.js`, `drum-clessidra.js`, `drum-eq.js`, `doppio.js`, `podcast.js`, `regia-formati.js`, `regia-audio.js`
- `strumenti/mockup-formati.mjs`; `mockup/drum-*.jpg`, `produzione.jpg`, `reaction*.jpg`, `podcast*.jpg`, `regia-drum.jpg`
- `test/testi.test.mjs`, `drum.test.mjs`, `formati.test.mjs`, `audio.test.mjs`, `formati-logica.test.mjs`, `drum-logica.test.mjs`, `regia-audio.test.mjs`, `formati-server.test.mjs`, `aiuti-server.mjs` (aiuto per i test con un server vero)

Modify: `lib/stato.mjs`, `lib/chat.mjs`, `server.mjs`, `public/js/nastro.js`, `connessione.js`, `suoni.js`, `eventi-sonori.js`, `regia.js`, `public/regia.html`, `public/css/regia.css`, `README.md`, `GUIDA.html`, `test/studio.test.mjs`, `test/battle.test.mjs`, `test/integrazioni.test.mjs`, `test/eventi-sonori.test.mjs`.

Aggiunte rispetto alla spec: `lib/audio.mjs`, `public/js/fascia.js`, `drum-logica.js`, `drum-clessidra.js`, `drum-eq.js`, `doppio.js/css`, `test/aiuti-server.mjs`; comandi `likeEvento` (come `messaggioChat`: simula/prova), `formatoVelocita` (la velocità della fascia dei quattro layout); limite di dimensione dei messaggi WebSocket (256 KiB); in `reaction` i limiti dei testi (spec §7 non li fissa).

**Prova nel browser** (compiti con grafica): server di prova su una porta libera (es. 4799) con `OVERLAY_CONFIG` e `OVERLAY_DATI` temporanei, come per `mockup-battle.mjs`; riavviarlo dopo ogni modifica a `server.mjs` o a `lib/`. Strumento: `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout <drum|produzione|reaction|podcast> [--formato orizzontale] [--stato vuoto|meta|sblocco|finale]` (per `podcast`: `--stato completo|base`, con linea e tematiche accese o spente).

---

### Task 1: `lib/testi.mjs` — dimensione dei testi

**Files:**
- Create: `lib/testi.mjs`
- Test: `test/testi.test.mjs`

**Interfaces:**
- Consumes: `numeroTra`, `oggetto` da `lib/validazione.mjs`.
- Produces:
  - `FORMATI_TESTI: Record<formato, Record<id, etichetta>>` — `drum`: `contatore` «Contatore Like», `traguardi` «Colonna traguardi», `brano` «Brano in esecuzione», `priorita` «Dona un…», `sblocco` «Banner di sblocco»; `produzione` e `reaction`: `sopra` «Riga sopra», `titolo` «Titolo», `sotto` «Riga sotto»; `podcast`: `targa` «Targa», `tematiche` «Pannello Tematiche».
  - `TESTO_MIN = 60`, `TESTO_MAX = 200`.
  - `testiBase(formato): Record<id, 100>`.
  - `controllaTesti(formato, valori): Record<id, number>` — parte da `testiBase`; ogni id in `valori` deve esistere (`Testo sconosciuto: <id>`) e valere un intero 60–200 (`numeroTra`, messaggio `Dimensione di «<etichetta>» (%)`); formato sconosciuto → `Formato sconosciuto: <formato>`; `valori` non oggetto → `Testi: forma non valida`.
  - `impostaTesti(stato, formato, modifiche): void` — richiede `stato[formato].testi` (altrimenti `Formato senza testi: <formato>`); `{ azzera: true }` rimette `testiBase`; altrimenti `controllaTesti(formato, { ...attuali, ...modifiche })` e assegna solo se valido (nessuna metà modifica).

- [ ] **Step 1: Scrivere i test falliti** in `test/testi.test.mjs`:
  - `testi: ogni formato ha i suoi gruppi, tutti al 100%` — `Object.keys(FORMATI_TESTI)` = `["drum","produzione","reaction","podcast"]`; chiavi di `drum` = `["contatore","traguardi","brano","priorita","sblocco"]`; `produzione` e `reaction` = `["sopra","titolo","sotto"]`; `podcast` = `["targa","tematiche"]`; `testiBase("podcast")` deepEqual `{ targa: 100, tematiche: 100 }`.
  - `testi: i valori si controllano` — `controllaTesti("drum", { contatore: 140, brano: "120" })` deepEqual `{ contatore: 140, traguardi: 100, brano: 120, priorita: 100, sblocco: 100 }`; `{ contatore: 59 }` lancia `/60/`; `{ contatore: 201 }` lancia `/200/`; `{ inventato: 100 }` lancia `/sconosciuto/i`; `controllaTesti("boh", {})` lancia `/formato/i`; `controllaTesti("drum", null)` lancia `/forma/i`.
  - `testi: impostaTesti cambia solo quelli dati` — con `stato = { drum: { testi: testiBase("drum") } }`: `impostaTesti(stato, "drum", { traguardi: 150 })` → `traguardi` 150 e `contatore` 100; `{ sblocco: 120, brano: 5 }` lancia e `stato.drum.testi.sblocco` resta 100; `{ azzera: true }` → `testiBase("drum")`; `impostaTesti(stato, "reaction", { titolo: 100 })` lancia `/senza testi/i`.
- [ ] **Step 2: Eseguire** `cd overlay-live && node --test test/testi.test.mjs` → FAIL (`Cannot find module '../lib/testi.mjs'`).
- [ ] **Step 3: Implementare** `lib/testi.mjs` come da Interfaces.
- [ ] **Step 4: Eseguire** `node --test test/testi.test.mjs` → PASS (3 test).
- [ ] **Step 5: Commit** — «Formati: dimensione dei testi (lib/testi.mjs) [skip netlify]».

---

### Task 2: Layout e widget nuovi in `lib/stato.mjs`

**Files:**
- Modify: `lib/stato.mjs` (`WIDGET`, `LAYOUT`, `statoIniziale`, `impostaLayout`), `test/studio.test.mjs`, `test/battle.test.mjs`
- Create: `test/formati.test.mjs`

**Interfaces:**
- Produces: `LAYOUT = ["gara","senzaPremio","studio","battle","drum","produzione","podcast","reaction"]`; `WIDGET` aggiunge `drumCornice`, `drumTraguardi`, `drumBrano`, `drumPriorita`, `drumBarra`, `prTitolo`, `prBarra`, `reTitolo`, `reBarra`, `poTitolo`, `poLinea`, `poTematiche`, `poBarra`; `WIDGET_SPENTI = ["bracket","poLinea","poTematiche"]` (esportato) e `statoIniziale().visibili` = tutti `true` tranne quelli; messaggio di `impostaLayout`: `Layout sconosciuto: gara, senzaPremio, studio, battle, drum, produzione, podcast o reaction`.

- [ ] **Step 1: Scrivere i test falliti** in `test/formati.test.mjs` (con `config` come in `studio.test.mjs`) e aggiornare quelli esistenti:
  - `layout: otto, i quattro nuovi si scelgono` — `S.LAYOUT` deepEqual l'elenco sopra; per ciascuno dei quattro nuovi `S.impostaLayout(stato, nome)` imposta `stato.layout`; `"boh"` lancia `/drum.*produzione.*podcast.*reaction/`.
  - `widget: i tredici nuovi, accesi tranne linea e tematiche` — ognuno è in `S.WIDGET`; `visibili` è `true` per tutti i nuovi tranne `poLinea` e `poTematiche`, che con `bracket` sono `false`; `S.WIDGET_SPENTI` deepEqual `["bracket","poLinea","poTematiche"]`.
  - In `test/studio.test.mjs` l'asserzione su `S.LAYOUT` diventa `S.LAYOUT.slice(0, 4)` deepEqual `["gara","senzaPremio","studio","battle"]` e `S.LAYOUT.length === 8`; in `test/battle.test.mjs` `S.LAYOUT.length` diventa `8` (e `S.LAYOUT[3]` resta `"battle"`).
- [ ] **Step 2: Eseguire** `node --test test/formati.test.mjs` → FAIL (layout a 4 voci).
- [ ] **Step 3: Implementare** le modifiche di `stato.mjs` come da Interfaces (il commento sopra `LAYOUT` descrive anche i quattro nuovi).
- [ ] **Step 4: Eseguire** `node --test` → tutti verdi (138 + nuovi).
- [ ] **Step 5: Commit** — «Formati: layout e widget dei quattro nuovi format [skip netlify]».

---

### Task 3: Like da TikTok in `lib/chat.mjs`

**Files:**
- Modify: `lib/chat.mjs`
- Test: `test/integrazioni.test.mjs`

**Interfaces:**
- Produces: `likeTikTok(dati: unknown): { totale: number | null, conteggio: number } | null` — `totale` = `totalLikeCount` se è un numero finito ≥ 0 (parte intera), altrimenti `null`; `conteggio` = `likeCount` se numero finito > 0 (parte intera), altrimenti `0`; `null` se entrambi mancano. Nessuna coercione di stringhe.
- `avviaTikTok(nomeUtente, suCommento, suStato, log, { suLike, suNuovaConnessione } = {})` — le due callback sono facoltative: `suNuovaConnessione()` parte a ogni nuovo tentativo di collegamento, prima di `connect()`; `suLike({ totale, conteggio })` a ogni evento `WebcastEvent.LIKE` con dati validi. Firma esistente invariata per chi non passa opzioni.

- [ ] **Step 1: Scrivere il test fallito** in `test/integrazioni.test.mjs` — `like: legge totale e conteggio dell'evento` — `likeTikTok({ likeCount: 15, totalLikeCount: 12480 })` deepEqual `{ totale: 12480, conteggio: 15 }`; `{ likeCount: 3 }` → `{ totale: null, conteggio: 3 }`; `{ totalLikeCount: 500 }` → `{ totale: 500, conteggio: 0 }`; `{ likeCount: 2.9, totalLikeCount: 10.7 }` → `{ totale: 10, conteggio: 2 }`; `{}`, `null`, `undefined`, `{ likeCount: -2, totalLikeCount: NaN }`, `{ totalLikeCount: "7" }` → `null`.
- [ ] **Step 2: Eseguire** `node --test test/integrazioni.test.mjs` → FAIL (`likeTikTok` non esportata).
- [ ] **Step 3: Implementare** `likeTikTok` e il collegamento in `avviaTikTok` (`c.on(WebcastEvent.LIKE, …)`); un'eccezione dentro `suLike` non deve fermare la connessione (try/catch con `log`).
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Formati: Like da TikTok (likeTikTok e opzioni di avviaTikTok) [skip netlify]».

---

### Task 4: `lib/drum.mjs` — Like, scaletta, progresso e annunci

**Files:**
- Create: `lib/drum.mjs`
- Test: `test/drum.test.mjs`

**Interfaces:**
- Consumes: `oggetto`, `testo`, `numeroTra` da `validazione.mjs`; `testiBase` da `testi.mjs`.
- Produces (da `drum.mjs`; i modificatori prendono `stato` con `stato.drum`, le funzioni di lettura prendono `drum`):
  - `PASSI_FISSI` e `PASSI_ALTI` (valori in Global Constraints), `scalettaPredefinita(): { like, titolo: "" }[]` (37 voci), `MAX_TAPPE = 80`.
  - `controllaScaletta(tappe: unknown): { like, titolo }[]` — array non vuoto (massimo 80) di `{ like, titolo }` con `like` interi crescenti (stretti) 1…1.000.000 e `titolo` ≤ 60 (testo, senza spazi ai lati); lancia gli errori sotto (senza numero di riga se arriva da un array); la usano `leggiScaletta` e `fondiDrum`.
  - `leggiScaletta(testoGrezzo: string): { like, titolo }[]` — una tappa per riga `like | titolo` (si divide alla prima `|`; titolo senza spazi ai lati e può contenere altre `|`; righe vuote ignorate; CRLF ammesso); `like`: intero (`1000`), con punti da migliaia (`1.000`, `12.500`) o suffisso `k`/`K` (`5k` = 5000), niente decimali. Errori in italiano con il numero di riga: `Riga N: «x» non è un numero di like (es. 15000, 15.000 o 15k)`; `Riga N: i like vanno da 1 a 1.000.000`; `Riga N: i like devono crescere (X dopo Y)` (stretto); `Riga N: titolo troppo lungo (massimo 60 caratteri)`; `Scaletta: al massimo 80 tappe`; `Scaletta: serve almeno una tappa`.
  - `drumIniziale(): Drum` — `{ like: { tiktokTotale: null, offset: 0, extra: 0 }, annunciati: 0, scaletta: scalettaPredefinita(), brano: { titolo: "", artista: "" }, ospite: { etichetta: "Artista ospite", handle: "", icona: "instagram" }, priorita: { prefisso: "Dona un", slot: "Rosa", sopra: "Salta la coda · scegli tu il brano", icona: "rosa" }, eq: { sensibilita: 100, stile: "barre", senzaSegnale: true }, riempimento: "perline", velocita: 80, testi: testiBase("drum") }`.
  - `contati(drum): number` = `max(0, (tiktokTotale ?? 0) − offset + extra)`; `tappeRaggiunte(drum): number` (tappe con `like ≤ contati`); `indiceAttiva(drum): number | null` (`null` se tutte raggiunte); `progresso(drum): number` (0…1, `1` se nessuna attiva; `base` = `like` della tappa prima dell'attiva, 0 per la prima).
  - `registraLike(stato, { totale?, conteggio? }): void` — con `totale` valido: se `tiktokTotale` è `null` (prima lettura dopo il collegamento) e `totale < offset`, `offset` riparte da 0; poi `tiktokTotale = totale` (prima lettura) o `max(tiktokTotale, totale)`; senza `totale` ma con `conteggio > 0` e `tiktokTotale` noto, `tiktokTotale += conteggio`; altrimenti nessun effetto.
  - `nuovaConnessioneLike(stato): void` — `tiktokTotale = null`.
  - `impostaLike(stato, { imposta?, aggiungi?, daOra? }): void` — almeno uno dei tre (`Like: serve imposta, aggiungi o daOra`); `imposta` 0…10.000.000 (`extra = N − (tiktokTotale ?? 0) + offset`, così `contati = N`); `aggiungi` −1.000.000…1.000.000 (`extra += N`); `daOra: true` (`offset = tiktokTotale ?? 0`, `extra = 0`, `annunciati = 0`).
  - `impostaScaletta(stato, { testo?, predefinita? }): void` — `testo` con `leggiScaletta`; `predefinita: true` rimette la scaletta di partenza ma tiene i titoli delle tappe con lo stesso `like`; un errore non cambia nulla; dopo ogni cambio `annunciati = tappeRaggiunte(drum)` **in silenzio**.
  - `controllaSblocchi(stato): { nome: "sbloccoDrum", dati: { indice, like, titolo } }[]` — se le tappe raggiunte superano `annunciati`: un solo evento per la più alta, `annunciati` sale; se sono meno (correzione al ribasso), `annunciati` si riallinea senza eventi; altrimenti `[]`.

- [ ] **Step 1: Scrivere i test falliti** in `test/drum.test.mjs` (aiuto: `const nuovo = () => ({ drum: D.drumIniziale() })` e `const conLike = (s, tik, extra = {}) => (Object.assign(s.drum.like, { tiktokTotale: tik, ...extra }), s)`):
  - `scaletta predefinita: 37 tappe` — lunghezza 37; le prime 16 sono `[1000,2000,3000,5000,7000,9000,10000,12000,15000,17000,20000,22000,25000,27000,29000,30000]`; la 17ª è 32000 e l'ultima 500000; crescente stretta; tutti i titoli `""`.
  - `partenza: forma del Drum` — `drumIniziale()` ha esattamente i campi e i valori di Interfaces; `testi` uguale a `testiBase("drum")`.
  - `leggiScaletta: righe «like | titolo»` — `"1000 | Back in Black\r\n2.000 | Seven Nation Army\n\n5k |\n  7k | Titolo con | barra "` → `[{like:1000,titolo:"Back in Black"},{like:2000,titolo:"Seven Nation Army"},{like:5000,titolo:""},{like:7000,titolo:"Titolo con | barra"}]`; `"12.500"` → 12500.
  - `leggiScaletta: errori con il numero di riga` — `"1000\n500"` lancia `/Riga 2: i like devono crescere \(500 dopo 1000\)/`; `"1000\n1000"` lancia `/devono crescere/`; `"abc | x"` lancia `/Riga 1/`; `"1.00"` e `"1,5k"` lanciano `/Riga 1/`; `"0"` e `"1000001"` lanciano `/da 1 a 1\.000\.000/`; titolo di 61 caratteri lancia `/Riga 1: titolo troppo lungo/`; 81 righe lanciano `/al massimo 80 tappe/`; `""` e `"  \n "` lanciano `/serve almeno una tappa/`.
  - `contati, tappe e progresso` — senza totale: `contati` 0, `indiceAttiva` 0, `progresso` 0; con `tiktokTotale` 1500: `contati` 1500, `tappeRaggiunte` 1, `indiceAttiva` 1, `progresso` 0.5; `tiktokTotale` 250 → `progresso` 0.25; `offset` 500 con totale 1500 → `contati` 1000 e `tappeRaggiunte` 1; `extra: -9999` con totale 1500 → `contati` 0; totale 500000 → `indiceAttiva` `null`, `progresso` 1, `tappeRaggiunte` 37.
  - `registraLike: il totale sale e non scende mai` — `{ totale: 100 }` → 100; `{ totale: 90 }` → resta 100; `{ totale: 150 }` → 150; `{ conteggio: 5 }` → 155; `nuovaConnessioneLike` → `null`; con `tiktokTotale` `null` un `{ conteggio: 5 }` non fa nulla (resta `null`).
  - `registraLike: live nuova` — `offset` 3000 e `tiktokTotale` `null`: prima lettura `{ totale: 200 }` → `offset` 0 e `tiktokTotale` 200; con `offset` 100 la prima lettura `{ totale: 150 }` lascia `offset` 100.
  - `impostaLike` — con `tiktokTotale` 5000: `{ imposta: 12000 }` → `contati` 12000; `{ aggiungi: 100 }` → 12100; `{ aggiungi: -50000 }` → `contati` 0; `{ daOra: true }` → `offset` 5000, `extra` 0, `annunciati` 0, `contati` 0; `{}` lancia `/imposta, aggiungi o daOra/`; `{ imposta: -1 }` e `{ imposta: 20000000 }` lanciano.
  - `annunci: un evento per salto, silenzio al ribasso` (Review Focus 1) — `annunciati` 0, `tiktokTotale` 1500 → `controllaSblocchi` = `[{ nome: "sbloccoDrum", dati: { indice: 0, like: 1000, titolo: "" } }]` e `annunciati` 1; di nuovo → `[]`; salto a 6000 → un solo evento con `indice` 3 e `like` 5000, `annunciati` 4; scendere a 2500 → `[]` e `annunciati` 2; risalire a 3000 → evento `indice` 2; con titolo scritto nella tappa, `dati.titolo` lo riporta; con tutte le 37 raggiunte l'evento è `indice` 36 e un secondo controllo dà `[]`.
  - `impostaScaletta` — con `tiktokTotale` 6000 e `annunciati` 4: `{ testo: "100\n1000" }` → `annunciati` 2 senza eventi; `{ testo: "1000 | A\n2000 | B" }` poi `{ predefinita: true }` tiene il titolo «A» alla tappa 1000 e «B» alla 2000; un testo con errore lancia e lascia scaletta e `annunciati` come prima.
- [ ] **Step 2: Eseguire** `node --test test/drum.test.mjs` → FAIL (`Cannot find module '../lib/drum.mjs'`).
- [ ] **Step 3: Implementare** `lib/drum.mjs` (la parte dell'Interfaces; i controlli su copia, nessuna metà modifica).
- [ ] **Step 4: Eseguire** `node --test test/drum.test.mjs` → PASS.
- [ ] **Step 5: Commit** — «Drum: Like, scaletta, progresso e annunci degli sblocchi [skip netlify]».

---

### Task 5: `lib/drum.mjs` — impostazioni, nuova serata, demo, istantanea e unione degli stati salvati

**Files:**
- Modify: `lib/drum.mjs`
- Test: `test/drum.test.mjs`

**Interfaces:**
- Produces:
  - `ICONE_REGALO = ["rosa","corona","cuore","regalo","stella","diamante","logo"]`.
  - `impostaBrano(stato, { titolo?, artista?, daIndice?, svuota? }): void` — `titolo` ≤ 60, `artista` ≤ 40; `svuota: true` azzera entrambi; `daIndice: i` copia il titolo della tappa `i` (artista `""`): errore `Quel brano non è ancora sbloccato` se `i` ≥ tappe raggiunte o fuori scaletta, `Quel brano non ha un titolo: scrivilo nella scaletta` se vuoto.
  - `impostaOspite(stato, { etichetta?, handle?, icona? })` (icona in `ICONE`), `impostaPriorita(stato, { prefisso?, slot?, sopra?, icona? })` (icona in `ICONE_REGALO`; `slot` non vuoto), `impostaEq(stato, { sensibilita?, stile?, senzaSegnale? })` (`stile` `"barre"`|`"onda"`), `impostaRiempimento(stato, stile)` (`"perline"`|`"sabbia"`), `impostaVelocita(stato, n)` (40–160) — tutti con i limiti di Global Constraints e messaggi italiani (`Icona sconosciuta`, `Stile non valido: barre o onda`…); controllo su copia.
  - `fondiDrum(salvato: unknown): Drum` — parte da `drumIniziale()`; ogni campo salvato resta se valido (per `like` numeri finiti con `offset ≥ 0`; `scaletta` solo se `controllaScaletta` la accetta; `annunciati` intero tra 0 e `tappeRaggiunte`, altrimenti riallineato verso il basso); mai eccezioni.
  - `drumNuovaSerata(drum): Drum` — `like` con `offset = tiktokTotale ?? 0`, `extra = 0`; `annunciati: 0`; `brano` vuoto; conserva scaletta (titoli compresi), ospite, priorità, eq, riempimento, velocità, testi.
  - `istantaneaDrum(drum): object` — copia con in più `contati`, `attiva` (`indiceAttiva`) e `progresso`; non muta.
  - `drumDemo(stato, fase): void` — `fase` in `"vuoto"|"meta"|"sblocco"|"finale"` (altrimenti `Fase non valida: vuoto, meta, sblocco o finale`); imposta i titoli demo delle prime 12 tappe (`["Back in Black","Seven Nation Army","Smells Like Teen Spirit","Billie Jean","Sweet Child O' Mine","Enter Sandman","Another One Bites the Dust","Livin' on a Prayer","Thunderstruck","Hysteria","Paradise City","Master of Puppets"]`) e ospite `{ handle: "@lince.music", icona: "instagram" }`; `vuoto`: `tiktokTotale` 0, `annunciati` 0, brano vuoto; `meta`: `tiktokTotale` 11400, `annunciati` 7, brano «Seven Nation Army»; `sblocco`: 12000 e `annunciati` 8; `finale`: 500000 e `annunciati` 37 (offset 0, extra 0 in tutte).

- [ ] **Step 1: Scrivere i test falliti** in `test/drum.test.mjs`:
  - `brano` — `impostaBrano({ titolo: "Titolo", artista: "Artista" })` li imposta; titolo di 61 e artista di 41 caratteri lanciano; con 3 tappe raggiunte e titolo «Uno» alla prima, `{ daIndice: 0 }` → titolo «Uno», artista `""`; `{ daIndice: 3 }` lancia `/non è ancora sbloccato/`; `{ daIndice: 1 }` (raggiunta, senza titolo) lancia `/titolo/`; `{ svuota: true }` svuota.
  - `ospite, priorità, eq, riempimento, velocità` — valori validi si applicano; `impostaOspite({ icona: "boh" })` lancia `/icona/i`; `impostaPriorita({ slot: " " })` lancia; `{ icona: "instagram" }` lancia (non è un'icona regalo); `impostaEq({ sensibilita: 49 })` e `{ sensibilita: 301 }` lanciano, `{ stile: "boh" }` lancia, `{ senzaSegnale: "sì" }` lancia; `impostaRiempimento("sabbia")` ok, `"boh"` lancia; `impostaVelocita(39)` e `161` lanciano; dopo un errore lo stato è invariato.
  - `fondiDrum: stato vecchio o rotto` (Review Focus 3) — `fondiDrum(undefined)` e `fondiDrum("x")` deepEqual `drumIniziale()`; `fondiDrum({ scaletta: "rotta", like: { tiktokTotale: 7000, offset: 0, extra: 0 }, annunciati: 99 })` → scaletta di partenza, `tiktokTotale` 7000, `annunciati` 5 (le tappe ≤ 7000 sono 1k, 2k, 3k, 5k, 7k); `fondiDrum({ eq: { sensibilita: 5000, stile: "onda" } })` → `eq` di partenza (valore rotto scarta il gruppo); `fondiDrum({ velocita: 120, riempimento: "sabbia" })` li conserva; round-trip: `fondiDrum(structuredClone(drum))` deepEqual `drum` e poi `controllaSblocchi` dà `[]`.
  - `drumNuovaSerata` — da un Drum con `tiktokTotale` 9000, `extra` 50, `annunciati` 6, brano «X», titolo alla tappa 1000, ospite, eq `{ sensibilita: 150, stile: "onda", senzaSegnale: false }`: risultato `contati` 0, `annunciati` 0, brano vuoto, `like` `{ tiktokTotale: 9000, offset: 9000, extra: 0 }`, titolo e eq conservati.
  - `istantaneaDrum` — con `tiktokTotale` 11400: `contati` 11400, `attiva` 7, `progresso` 0.7, e `drum` originale non mutato (nessun campo `contati`).
  - `drumDemo` — `vuoto`: `contati` 0; `meta`: `contati` 11400, `tappeRaggiunte` 7, `annunciati` 7, `indiceAttiva` 7, `progresso` 0.7, brano «Seven Nation Army», titolo della tappa 6 «Another One Bites the Dust», ospite `@lince.music`; `sblocco`: `contati` 12000 e `annunciati` 8; `finale`: `indiceAttiva` `null` e `annunciati` 37; `"boh"` lancia `/Fase non valida/`.
- [ ] **Step 2: Eseguire** `node --test test/drum.test.mjs` → FAIL (funzioni mancanti).
- [ ] **Step 3: Implementare** le funzioni sopra in `lib/drum.mjs`.
- [ ] **Step 4: Eseguire** `node --test test/drum.test.mjs` → PASS.
- [ ] **Step 5: Commit** — «Drum: impostazioni, nuova serata, dati di prova e unione degli stati salvati [skip netlify]».

---

### Task 6: `lib/formati.mjs` — Studio Production e Reaction Release

**Files:**
- Create: `lib/formati.mjs`
- Test: `test/formati.test.mjs`

**Interfaces:**
- Consumes: `oggetto`, `testo`, `numeroTra` da `validazione.mjs`; `testiBase` da `testi.mjs`.
- Produces:
  - `PRESET_TITOLI`: `cooking` `{ sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta", accento: "oro", icona: "cappello" }`; `sessione` `{ sopra: "Backrooms Studio · Live", testo: "Sessione Beat", sotto: "In studio con il producer", accento: "magenta", icona: "cuffie" }`; `mix` `{ sopra: "Backrooms Studio · Live", testo: "Mix & Master", sotto: "Mix e master in diretta", accento: "ciano", icona: "manopole" }`.
  - `produzioneIniziale()` → `{ titolo: { preset: "cooking", sopra, testo, sotto } (dal preset), velocita: 80, testi: testiBase("produzione") }`; `reactionIniziale()` → `{ titolo: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" }, velocita: 80, testi: testiBase("reaction") }`.
  - `impostaProduzione(stato, { titolo?, preset?, velocita? })` — con `preset` (chiave di `PRESET_TITOLI`, altrimenti `Preset sconosciuto: cooking, sessione o mix`) riempie `sopra`/`testo`/`sotto` e imposta `titolo.preset`; un `titolo` nella stessa chiamata prevale sul preset campo per campo; `titolo` parziale ammesso (`sopra` ≤ 32, `testo` ≤ 28 non vuoto, `sotto` ≤ 48); `velocita` 40–160. `impostaReaction(stato, { titolo?, velocita? })` — stessi controlli con i limiti della reaction (`sopra` ≤ 40, `testo` ≤ 60 non vuoto, `sotto` ≤ 60), nessun preset. Controllo su copia.
  - `fondiProduzione(salvato)`, `fondiReaction(salvato)` — come `fondiStudio`: campo per campo, valori rotti → predefiniti, mai eccezioni.

- [ ] **Step 1: Scrivere i test falliti** in `test/formati.test.mjs`:
  - `produzione: partenza e preset` — `produzioneIniziale().titolo` deepEqual `{ preset: "cooking", sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta" }`; `impostaProduzione(stato, { preset: "mix" })` → testo «Mix & Master», sotto «Mix e master in diretta», `preset` «mix»; `{ preset: "sessione", titolo: { testo: "Sessione 12" } }` → testo «Sessione 12», sotto «In studio con il producer», preset «sessione»; `{ preset: "boh" }` lancia `/Preset sconosciuto/`.
  - `produzione: limiti e tempo reale` — `titolo: { testo: "" }` lancia `/vuoto/`; `testo` di 29 caratteri lancia `/28/`; `sopra` di 33 lancia; `sotto` di 49 lancia; `{ titolo: { sotto: "" } }` svuota il sotto e lascia il resto; `velocita: 39` e `161` lanciano; un errore lascia lo stato com'era.
  - `reaction: partenza e limiti` — `reactionIniziale().titolo.testo === "REACTION RELEASE DELLA SETTIMANA"`, `sopra` «Ogni giovedì · ore 01:00», `sotto` `""`; `impostaReaction({ titolo: { testo: "x".repeat(60) } })` ok, 61 lancia; `sopra` di 41 e `sotto` di 61 lanciano; `{ titolo: { sopra: "" } }` svuota il sopra.
  - `formati: stato salvato rotto` (Review Focus 3) — `fondiProduzione(undefined)` e `fondiReaction("x")` deepEqual i predefiniti; `fondiProduzione({ titolo: { preset: "mix", testo: 42 }, velocita: 120 })` → `preset` «mix», `testo` «Cooking Beats» (campo rotto torna al predefinito), `velocita` 120; `fondiReaction({ titolo: { testo: "Titolo X" } })` → testo «Titolo X», resto predefinito.
- [ ] **Step 2: Eseguire** `node --test test/formati.test.mjs` → FAIL (`lib/formati.mjs` mancante).
- [ ] **Step 3: Implementare** questa parte di `lib/formati.mjs`.
- [ ] **Step 4: Eseguire** `node --test test/formati.test.mjs` → PASS.
- [ ] **Step 5: Commit** — «Formati: regole di Studio Production e Reaction Release [skip netlify]».

---

### Task 7: `lib/formati.mjs` — Back Rooms Podcast

**Files:**
- Modify: `lib/formati.mjs`
- Test: `test/formati.test.mjs`

**Interfaces:**
- Produces:
  - `podcastIniziale()` → `{ titolo: { testo: "Back Rooms Podcast", sotto: "" }, ospiti: [], tematiche: { titolo: "Tematiche di oggi", elenco: [], attiva: 0, lato: "sx" }, velocita: 80, testi: testiBase("podcast") }`.
  - `impostaPodcast(stato, { titolo?, ospiti?, tematiche?, velocita? })` — `titolo` parziale (`testo` ≤ 32 non vuoto, `sotto` ≤ 48); `ospiti` array ≤ 4 di `{ nome ≤ 24 non vuoto, handle ≤ 40, icona in ICONE (predefinita "instagram") }`; `tematiche` parziale `{ titolo ≤ 32 non vuoto, elenco: string[] ≤ 8 voci non vuote ≤ 48, lato: "sx"|"dx", attiva: intero }` con `attiva` poi riportata tra 0 e `max(0, elenco.length − 1)`; `velocita` 40–160; controllo su copia.
  - `spostaTematica(stato, { avanti?, indietro?, indice? })` — `avanti` va a `min(ultima, attiva + 1)`, `indietro` a `max(0, attiva − 1)` (senza giri); `indice` deve essere intero in elenco (`Tematica inesistente`); senza voci `Non ci sono tematiche`.
  - `podcastNuovaSerata(podcast)` → copia con `tematiche.attiva = 0`.
  - `fondiPodcast(salvato)` — come gli altri; `attiva` e `lato` riallineati.

- [ ] **Step 1: Scrivere i test falliti** in `test/formati.test.mjs`:
  - `podcast: partenza` — deepEqual `podcastIniziale()` con la forma sopra (ospiti `[]`, `lato` «sx», `attiva` 0).
  - `podcast: ospiti e titolo` — 4 ospiti ok, 5 lanciano `/4/`; ospite senza nome lancia; `nome` di 25 lancia; icona «boh» lancia; senza `icona` diventa «instagram»; `titolo: { testo: "" }` lancia; `testo` di 33 lancia; `sotto` di 49 lancia.
  - `podcast: tematiche` — elenco di 8 voci ok, 9 lanciano `/8/`; voce vuota lancia; voce di 49 caratteri lancia; con elenco di 3 voci e `attiva: 9` → `attiva` 2; accorciando l'elenco da 5 a 2 voci con `attiva` 4 → `attiva` 1; `lato: "alto"` lancia; elenco vuoto → `attiva` 0.
  - `podcast: spostaTematica` — con 3 voci e `attiva` 0: `{ avanti: true }` → 1, ancora → 2, ancora → resta 2; `{ indietro: true }` → 1; `{ indice: 0 }` → 0; `{ indice: 3 }` lancia `/inesistente/`; con elenco vuoto lancia `/Non ci sono tematiche/`.
  - `podcast: nuova serata e stato salvato rotto` — `podcastNuovaSerata` porta `attiva` a 0 e conserva elenco, ospiti, titolo; `fondiPodcast({ tematiche: { elenco: ["A","B"], attiva: 7, lato: "dx" }, ospiti: "rotto" })` → elenco `["A","B"]`, `attiva` 1, `lato` «dx», ospiti `[]`; `fondiPodcast(undefined)` deepEqual `podcastIniziale()`.
- [ ] **Step 2: Eseguire** `node --test test/formati.test.mjs` → FAIL (funzioni del podcast mancanti).
- [ ] **Step 3: Implementare** le funzioni in `lib/formati.mjs`.
- [ ] **Step 4: Eseguire** `node --test test/formati.test.mjs` → PASS.
- [ ] **Step 5: Commit** — «Formati: regole del Back Rooms Podcast [skip netlify]».

---

### Task 8: Server — stato, comandi, Like e persistenza dei quattro layout

**Files:**
- Modify: `lib/stato.mjs` (`statoIniziale`, `istantanea`), `server.mjs`
- Create: `test/aiuti-server.mjs`, `test/formati-server.test.mjs`

**Interfaces:**
- Consumes: Task 1–7 (`lib/testi.mjs`, `lib/drum.mjs`, `lib/formati.mjs`), `likeTikTok` e le opzioni di `avviaTikTok` (Task 3).
- Produces:
  - `statoIniziale` aggiunge `drum: drumIniziale()`, `produzione: produzioneIniziale()`, `reaction: reactionIniziale()`, `podcast: podcastIniziale()`; `istantanea` aggiunge `drum: istantaneaDrum(stato.drum)` e le altre tre sezioni.
  - `server.mjs`: `caricaStato` unisce con `fondiDrum`/`fondiProduzione`/`fondiReaction`/`fondiPodcast`; `demo` e `nuovaSerata` conservano le sezioni nuove (`nuovaSerata`: `drum` → `drumNuovaSerata`, `podcast` → `podcastNuovaSerata`, le altre invariate); `collegaTikTok` passa `{ suLike: registraLikeTikTok, suNuovaConnessione }` (`registraLikeTikTok({ totale, conteggio })` registra il Like, emette gli eventi di `controllaSblocchi` con `emetti` e chiama `cambiato()`; `suNuovaConnessione` chiama `nuovaConnessioneLike`).
  - Comandi (corpo → effetto; errori italiani come gli altri): `drumLike { imposta?, aggiungi?, daOra? }` (poi `controllaSblocchi` → `emetti("sbloccoDrum", dati)`); `drumScaletta { testo?, predefinita? }`; `drumBrano { titolo?, artista?, daIndice?, svuota? }`; `drumOspite {…}`; `drumPriorita { prefisso?, slot?, sopra?, icona?, richiamo? }` (con `richiamo: true` emette `richiamoDrum` `{}`, errore `Il widget è spento: accendetelo in In onda` se `visibili.drumPriorita` è falso); `drumEq {…}`; `drumRiempimento { stile }`; `drumDemo { fase }`; `produzione { titolo?, preset?, velocita? }`; `reaction { titolo?, velocita? }`; `podcast { titolo?, ospiti?, tematiche?, velocita? }`; `podcastTematica { avanti?, indietro?, indice? }`; `formatoTesti { formato, valori? , azzera? }` (→ `impostaTesti(stato, formato, azzera ? { azzera: true } : valori)`); `formatoVelocita { formato, velocita }` (formato in `drum|produzione|reaction|podcast`, altrimenti `Formato sconosciuto`); `likeEvento { totale?, conteggio? }` (come `messaggioChat`: simula un evento `like`).
- `test/aiuti-server.mjs` esporta `avviaServer({ config?, stato? })` → `{ base, porta, api(nome, args), statoCorrente(), apriWs(), ferma() }` (processo figlio su porta libera, config e dati temporanei, eventuale `dati/stato.json` iniziale; `apriWs()` → `{ ws, messaggi: [], eventi: [], invia(obj), chiudi() }` che raccoglie i messaggi `stato` ed `eventi`); stessa logica di `test/battle-server.test.mjs`.

- [ ] **Step 1: Scrivere i test falliti** in `test/formati-server.test.mjs` (un server in `before`, chiuso in `after`):
  - `e2e: stato di partenza dei quattro layout` — `drum.contati === 0`, `drum.attiva === 0`, `drum.scaletta.length === 37`; `produzione.titolo.testo === "Cooking Beats"`; `reaction.titolo.testo === "REACTION RELEASE DELLA SETTIMANA"`; `podcast.tematiche.elenco.length === 0`; `visibili.poLinea === false`, `visibili.drumBarra === true`.
  - `e2e: i Like sbloccano le tappe` — `layout drum`; `likeEvento { totale: 800 }` → `contati` 800 e nessun evento `sbloccoDrum`; `likeEvento { totale: 1200 }` → evento con `indice` 0 e `like` 1000; `drumScaletta { testo: "1000 | Uno\n2000 | Due" }` → titoli; `drumLike { imposta: 2500 }` → evento con `indice` 1 e `titolo` «Due»; `drumLike { daOra: true }` → `contati` 0 e `annunci` azzerati (stato `annunciati` 0).
  - `e2e: errori chiari` — `drumScaletta { testo: "1000\n500" }` risponde 400 con `/Riga 2/` e la scaletta non cambia; `drumLike {}` 400 `/imposta, aggiungi o daOra/`; `drumBrano { daIndice: 30 }` 400; `podcastTematica { avanti: true }` con elenco vuoto 400; `formatoTesti { formato: "boh" }` 400 `/Formato sconosciuto/`; `produzione { preset: "boh" }` 400.
  - `e2e: brano, ospite, priorità e richiamo` — `drumBrano { titolo: "Pezzo", artista: "Chi" }` ok; `drumOspite { handle: "@lince.music", icona: "tiktok" }` ok; `drumPriorita { slot: "Corolla" }` ok; `{ richiamo: true }` → evento `richiamoDrum`; con `widget { nome: "drumPriorita", visibile: false }` il richiamo risponde 400 `/spento/`; riaccendere.
  - `e2e: produzione, reaction e podcast` — `produzione { preset: "mix" }` poi `{ titolo: { testo: "Mix live" } }`; `reaction { titolo: { sotto: "Ep. 12" } }`; `podcast { titolo: { testo: "Puntata 3" }, ospiti: [{ nome: "Lince", handle: "@lince.music" }], tematiche: { elenco: ["Uno","Due","Tre"] } }`, `podcastTematica { avanti: true }` → `attiva` 1; `widget { nome: "poLinea", visibile: true }` ok.
  - `e2e: dimensione dei testi e velocità` — `formatoTesti { formato: "drum", valori: { contatore: 140 } }` → `drum.testi.contatore` 140; `valori: { contatore: 10 }` 400; `{ formato: "drum", azzera: true }` → 100; `formatoVelocita { formato: "podcast", velocita: 120 }` → `podcast.velocita` 120; `{ formato: "drum", velocita: 10 }` 400.
  - `e2e: nuova serata e demo conservano le impostazioni` — con `drumScaletta` titoli, `drumLike { imposta: 5000 }`, `podcast` tematiche e `attiva` 2, `reaction` titolo: `nuovaSerata` → `drum.contati` 0, titoli della scaletta intatti, `podcast.tematiche.attiva` 0, elenco e titolo reaction intatti; `demo` non azzera le sezioni nuove.
  - `e2e: stato salvato di una versione precedente` (Review Focus 3) — secondo server con `stato.json` iniziale `{ layout: "studio", premio: "Beat", drum: { like: { tiktokTotale: 7000, offset: 0, extra: 0 }, annunciati: 99, scaletta: "rotta" }, podcast: { tematiche: { elenco: ["A","B"], attiva: 7 } } }`: il server parte, `layout` «studio», `premio` «Beat», `drum.scaletta.length` 37, `drum.like.tiktokTotale` 7000, `drum.annunciati` 5, `podcast.tematiche.elenco` `["A","B"]` con `attiva` 1, `produzione` e `reaction` predefiniti.
- [ ] **Step 2: Eseguire** `node --test test/formati-server.test.mjs` → FAIL (stato senza `drum`, comandi sconosciuti).
- [ ] **Step 3: Implementare** `statoIniziale`/`istantanea`, `test/aiuti-server.mjs` e le modifiche del server come da Interfaces.
- [ ] **Step 4: Eseguire** `node --test` → tutti verdi.
- [ ] **Step 5: Commit** — «Formati: stato, comandi, Like TikTok e persistenza nel server [skip netlify]».

---

### Task 9: Audio dalla regia — `lib/audio.mjs`, relay WebSocket e `connessione.js`

**Files:**
- Create: `lib/audio.mjs`, `test/audio.test.mjs`
- Modify: `server.mjs` (WebSocket), `public/js/connessione.js`, `test/formati-server.test.mjs`

**Interfaces:**
- Produces:
  - `leggiAudio(msg: unknown): { b: number[12], c: number } | null` — `msg` oggetto con `b` array di esattamente 12 numeri finiti (ognuno limitato a 0…100 e arrotondato) e `c` numero finito (limitato 0…100, arrotondato; assente → 0); altrimenti `null`.
  - `class LimiteFrequenza { constructor(minMs = 25); permetti(ora: number): boolean }` — `true` se `ora − ultimo permesso ≥ minMs` (e allora lo ricorda), altrimenti `false`.
  - `server.mjs`: `WebSocketServer` con `maxPayload: 256 * 1024`; per ogni connessione un `LimiteFrequenza`; un messaggio `{ tipo: "audio", … }` è ritrasmesso a tutti gli **altri** client come `{ tipo: "audio", b, c }` solo se `config.pinRegia` è vuoto o `msg.pin` coincide, `stato.layout === "drum"`, il limite lo permette e `leggiAudio` lo accetta; ogni altro caso si scarta senza risposta né errori.
  - `connessione.js`: `collega({ suStato, suConnessione, pin, suAudio = () => {} })`; il messaggio `{ tipo: "audio" }` chiama `suAudio(msg)`; il valore restituito aggiunge `audio(b, c)` che invia `{ tipo: "audio", b, c, pin: pin() }` se il socket è aperto.

- [ ] **Step 1: Scrivere i test falliti**:
  - `test/audio.test.mjs` — `leggiAudio({ b: [0, 10.4, 100.6, 50, 50, 50, 50, 50, 50, 50, 50, 50], c: 55.5 })` deepEqual `{ b: [0, 10, 100, 50, …], c: 56 }` (un 100.6 diventa 100); `c` assente → 0; `c: 150` → 100; `c: -5` → 0; `b` di 11 o 13 voci, `b` non array, una voce `NaN`/`"7"`/`null`/`Infinity`, `msg` `null`/stringa/array → `null`; `LimiteFrequenza(25)`: `permetti(0)` true, `permetti(10)` false, `permetti(25)` true, `permetti(30)` false, `permetti(50)` true.
  - In `test/formati-server.test.mjs` (Review Focus 2) — `e2e: audio ritrasmesso solo con il Drum in onda`: due client A e B; `layout drum`; A invia `{ tipo: "audio", b: [...12 numeri], c: 70 }` → B riceve `{ tipo: "audio", b, c }` entro 500 ms, A non lo riceve; con `layout gara` non arriva a B. `e2e: audio malformato o a raffica`: con `layout drum`, A invia in sequenza `b` di 11 voci, `b` con `NaN` e con stringa, `c` testo, JSON non valido, un messaggio enorme (1 MB → il server chiude quel socket ma resta in piedi): B non riceve nulla di questi; un messaggio valido da un nuovo client subito dopo arriva (server vivo, `/api/stato` risponde); una raffica di 40 messaggi validi inviati senza pausa → B ne riceve almeno 1 e al massimo 4. `e2e: audio con PIN`: server con `pinRegia: "1234"`: senza `pin` e con `pin` sbagliato non arriva, con `pin` giusto sì (le chiamate ai comandi continuano a chiedere il PIN).
- [ ] **Step 2: Eseguire** `node --test test/audio.test.mjs test/formati-server.test.mjs` → FAIL (`lib/audio.mjs` mancante / nessuna ritrasmissione).
- [ ] **Step 3: Implementare** `lib/audio.mjs`, il relay e `maxPayload` in `server.mjs`, `suAudio`/`audio()` in `connessione.js`.
- [ ] **Step 4: Eseguire** `node --test` → tutti verdi.
- [ ] **Step 5: Commit** — «Formati: livelli audio dalla regia alle pagine (lib/audio.mjs e relay) [skip netlify]».

---

### Task 10: Pagine dei quattro layout con la fascia social, route e strumento di controllo

**Files:**
- Create: `public/js/simboli.js`, `pagina.js`, `fascia.js`, `formati-logica.js`, `drum.js`, `doppio.js`, `podcast.js`; `public/css/formati.css`; `public/drum.html`, `produzione.html`, `podcast.html`, `reaction.html`; `strumenti/mockup-formati.mjs`; `test/formati-logica.test.mjs`
- Modify: `public/js/nastro.js`, `server.mjs` (`PAGINE`, messaggio d'avvio), `test/formati-server.test.mjs`

**Interfaces:**
- Consumes: `vociSocial` e `stimaGiroSecondi` da `barra.js`; `creaNastro` da `nastro.js`; `collega` da `connessione.js`; stati del Task 8 (`s.drum.velocita`, `s.drum.ospite`, `s.podcast.ospiti`, `s.senzaPremio.voci`).
- Produces:
  - `nastro.js`: `creaNastro({ …, bordoVisibile = 980, riempiFino = 1500 })` (le pagine vecchie non cambiano; le orizzontali passano 1800 e 2400).
  - `simboli.js`: `ID_SIMBOLI: string[]` (tutti gli `id` dei simboli: i gradienti `g-cromo`, `g-oro`; `punta`; `ic-nero`, `ic-instagram`, `ic-tiktok`, `ic-twitch`, `ic-kick`, `ic-youtube`, `ic-spotify`, `ic-whatsapp`, `ic-dm`, `ic-sito`, `ic-microfono`, `ic-cuffie` come nelle altre pagine; nuovi `ic-cuore`, `ic-rosa`, `ic-corona`, `ic-regalo`, `ic-stella`, `ic-diamante`, `ic-lucchetto`, `ic-spunta`, `ic-play`, `ic-cappello`, `ic-manopole`), `svgSimboli(): string` (markup dell'`<svg>` nascosto con `<defs>`), `iniettaSimboli(): void` (lo mette in testa al `body`). Disegno in linea come le icone esistenti (24×24, tratto, `currentColor`).
  - `pagina.js`: `export const parametri, STATICO, ORIZZONTALE` (da `location.search`; `ORIZZONTALE` vera solo con `formato=orizzontale`); `$`, `nodo(tag, classe?, testo?)`, `simbolo(id, classe?)`, `logo()`, `rilancia(el, classe)`, `adattaTesto(el, massimo, minimo)` (come nelle altre pagine, con la tolleranza sull'altezza di `battle.js`), `scriviConLink(el, testo)`, `costruisciMoneta(el)`; `avviaPagina({ orizzontaleAmmesso = false }): { palco, orizzontale }` (`orizzontale` = `ORIZZONTALE && orizzontaleAmmesso`: drum e produzione ignorano il parametro) — inietta i simboli, imposta sul `body` `verticale`/`orizzontale`, `anteprima`, `statico`, `guide-attive`, adatta il palco (1080×1920 o 1920×1080) alla finestra con `--scala`, costruisce le monete `[data-moneta]`; `applicaTesti(palco, testi)` imposta `--ts-<id>` = percentuale/100; `ts(testi, id)` = moltiplicatore (1 se manca).
  - `fascia.js`: `creaFascia({ radice, nastro, larghezza, voci, velocita, statico })` → `{ aggiorna(s), rimisura() }` — costruisce i pezzi come `studio.js` (`creaPezzo`) e usa `creaNastro` con `inizio: () => 236`, `bordoVisibile`/`riempiFino` proporzionati a `larghezza`; `aggiorna(s)` chiama `nastro.aggiorna(voci(s))` e applica `velocita(s)`.
  - `formati-logica.js`: `vociFascia(s, layout): Voce[]` — `vociSocial(s.senzaPremio)` con, dopo il primo social, per `drum` l'ospite (se ha `handle`) `{ tipo: "social", chiave: "ospite|drum|<icona>|<etichetta>|<handle>", icone: icona.split("+"), etichetta, testo: handle, oro: false }` e per `podcast` un'unica voce per ospite `{ tipo: "social", chiave: "ospite|<nome>|<handle>|<icona>", icone, etichetta: "Ospite", testo: handle ? "<nome> · <handle>" : nome, oro: false }`; `produzione` e `reaction` solo i social; `velocitaFascia(s, layout): number` (`s[layout]?.velocita ?? 80`); `ETICHETTE_TESTI` (copia delle etichette di `FORMATI_TESTI`, per la regia); `scalaTesto(testi, id)`.
  - Pagine: ognuna con `<body class="fm …">`, `.palco`, finti schermi `[data-finto]` visibili solo con `?anteprima=1`, la fascia `<section class="sp-barra fm-fascia" data-parte="fascia">` (stessa struttura di `studio.html`, monete BR ai lati) e `data-parte` come nelle Griglie; `guide`. Fascia: larghezza 1080 (o 1920 in orizzontale), altezza 92, secondo le Griglie; finti: `drum` `[data-finto="camera"]` a tutto schermo; `produzione`/`reaction` `[data-finto="A"]` e `[data-finto="B"]` ai rettangoli delle Griglie; `podcast` `[data-finto="camera"]` a tutto schermo. Si accende con `visibili.drumBarra`/`prBarra`/`reBarra`/`poBarra` (classe `fuori` come le altre fasce).
  - `server.mjs`: `PAGINE` aggiunge `/drum`, `/drum.html`, `/produzione`, `/produzione.html`, `/podcast`, `/podcast.html`, `/reaction`, `/reaction.html`; il messaggio d'avvio stampa i quattro indirizzi.
  - `strumenti/mockup-formati.mjs`: opzioni `--base`, `--layout`, `--formato`, `--stato`, `--guida`; tabella `GEOMETRIA[layout][formato]` (le Griglie) e controllo per `data-parte` e `[data-finto]` (±1 px); `PRESENTI[layout][formato][stato]` elenca i pezzi che devono esserci; prepara lo stato via API (`layout`, `drumDemo`, `produzione`, `podcast` con dati di prova: ospite `{ nome: "Lince", handle: "@lince.music", icona: "instagram" }`, tematiche `["Come nasce un beat","Il primo disco","Social e musica","Cosa ascoltiamo","Domande dal pubblico"]` con `attiva` 1, `poLinea` e `poTematiche` accesi); apre `…?anteprima=1&statico=1[&formato=orizzontale]` a 1080×1920 o 1920×1080; controlla che i pezzi che dichiarano `dentro` stiano in x 116…964 e y 230…1200 (le fasce e le linee a tutta larghezza no); salva `mockup/<layout>[-orizzontale][-<stato>].jpg`; esce con codice 1 e l'elenco dei problemi.

- [ ] **Step 1: Scrivere i test falliti**:
  - `test/formati-logica.test.mjs` — `vociFascia`: con `senzaPremioIniziale()` (5 social accesi) e `drum.ospite.handle` «@lince.music» (etichetta «Artista ospite», icona `tiktok`) il risultato per `drum` ha 6 voci e l'indice 1 è `{ tipo: "social", etichetta: "Artista ospite", testo: "@lince.music", icone: ["tiktok"] }`; senza `handle` ha 5 voci; per `podcast` con due ospiti (`{ nome: "Lince", handle: "@lince.music" }`, `{ nome: "Nove", handle: "" }`) le voci 1 e 2 hanno testo «Lince · @lince.music» e «Nove»; `produzione` e `reaction` 5 voci; con tutti i social spenti e un ospite il risultato è la sola voce ospite; `chiave` cambia se cambia l'handle; `velocitaFascia({ drum: { velocita: 120 } }, "drum")` 120 e senza sezione 80. `ID_SIMBOLI` contiene `ic-<icona>` per ogni `ICONE` di `validazione.mjs` salvo `instagram+tiktok` e `logo`, per ogni `ICONE_REGALO` salvo `logo`, e `ic-lucchetto`, `ic-spunta`, `ic-play`, `ic-cappello`, `ic-manopole`, `ic-cuore`; `svgSimboli()` contiene `id="<x>"` per ogni voce di `ID_SIMBOLI`. `ETICHETTE_TESTI` deepEqual `FORMATI_TESTI` di `lib/testi.mjs`. `scalaTesto({ timer: 125 }, "timer")` 1.25 e `scalaTesto({}, "timer")` 1.
  - In `test/formati-server.test.mjs` — `e2e: le quattro pagine si aprono con o senza .html` — per `/drum`, `/drum.html`, `/produzione`, `/produzione.html`, `/podcast`, `/podcast.html`, `/reaction`, `/reaction.html`: 200, `text/html`, il corpo contiene `data-parte="fascia"`.
  - `strumenti/mockup-formati.mjs` con `GEOMETRIA` che contiene per ora `fascia` e i finti di ogni layout/formato delle Griglie.
- [ ] **Step 2: Eseguire** `node --test test/formati-logica.test.mjs test/formati-server.test.mjs` → FAIL; e, con il server di prova su, `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout drum --stato vuoto` → esce con 1 («elemento assente: fascia»).
- [ ] **Step 3: Implementare** `nastro.js` (opzioni), `simboli.js`, `pagina.js`, `fascia.js`, `formati-logica.js`, `formati.css` (`.fm-vetro` come da spec §4, `.fm-fascia` con maschera dei bordi in funzione della larghezza, `.fm-finto`, la regola `.fuori`), le quattro pagine con `drum.js`/`doppio.js`/`podcast.js` minimi (`avviaPagina`, `collega` → `fascia.aggiorna`, `applicaTesti`), le route e il messaggio d'avvio.
- [ ] **Step 4: Eseguire** i test (PASS) e lo strumento per ogni coppia layout/formato: drum; produzione; reaction verticale e `--formato orizzontale`; podcast verticale e `--formato orizzontale` → `ok …` per tutti. Controllo visivo di `mockup/*.jpg`: la fascia scorre con monete BR, il finto A/B è dove dice la tabella. In non-statico la fascia si muove (il transform di `.sp-nastro` cambia in 1,5 s) e il nastro contiene almeno un `.sp-pezzo`.
- [ ] **Step 5: Commit** — «Formati: pagine dei quattro layout con la fascia social, route e strumento di controllo [skip netlify]».

---

### Task 11: Regia — scheda «Social del brand», sezioni dei quattro layout e controlli comuni

**Files:**
- Modify: `public/regia.html`, `public/js/regia.js`, `public/css/regia.css`, `strumenti/mockup-formati.mjs`
- Create: `public/js/regia-formati.js`

**Interfaces:**
- Consumes: `ETICHETTE_TESTI`, `vociFascia` (Task 10), comandi `formatoTesti`/`formatoVelocita` (Task 8), `stimaGiroSecondi` da `barra.js`.
- Produces:
  - `regia.html`: il selettore `#layout` aggiunge le opzioni `drum` «Drum Challenge Live», `produzione` «Studio Production», `podcast` «Back Rooms Podcast», `reaction` «Reaction Release»; la testata aggiunge i link di anteprima (con `?anteprima=1&guide=1` e, per podcast e reaction, anche `&formato=orizzontale`); la lista delle voci social (`#sp-voci` e `#sp-aggiungi`, con la loro nota) passa dalla sezione «Senza premio» a una nuova `<section class="scheda sp-regia" id="social-regia">` «Social del brand» (gli id restano, il codice delle voci non cambia; `#sp-ripristina` resta in «Senza premio»); quattro sezioni `<section class="scheda sp-regia" id="dr-regia|pr-regia|re-regia|po-regia">` con `.sp-colonne` a tre colonne: `#<sigla>-col1`, `#<sigla>-col2` (vuote, riempite dai compiti successivi) e la colonna dell'anteprima (iframe 1080×1920 con `?anteprima=1&muto=1`; per podcast e reaction due pulsanti «Verticale»/«Orizzontale» che cambiano l'`src` e le dimensioni); in ogni sezione `div.fm-velocita` (cursore 40–160 con «un giro ≈ N s»), `div.fm-testi[data-formato]` (un cursore 60–200 per gruppo, «Ripristina tutti al 100%») e le spunte «In onda» (`data-widget`) dei suoi widget: drum `drumCornice` «Cornice ed equalizzatore», `drumTraguardi` «Colonna traguardi e Like», `drumBrano` «Brano in esecuzione», `drumPriorita` «Dona un…», `drumBarra` «Fascia social»; produzione `prTitolo`, `prBarra`; reaction `reTitolo`, `reBarra`; podcast `poTitolo`, `poLinea`, `poTematiche`, `poBarra`.
  - `regia-formati.js`: `avviaRegiaFormati({ $, el, invia, avviso, riempi, mostra, conn })` → `{ disegna(s), scorciatoia(tasto, layout): (() => void) | null }`. `disegna(s)` mostra/nasconde le sezioni con la classe `attivo` (`s.layout`), mostra `#social-regia` con `senzaPremio`, `studio`, `drum`, `produzione`, `podcast`, `reaction`, costruisce una volta i cursori dei testi (da `ETICHETTE_TESTI`) e della velocità e li aggiorna dallo stato senza toccare quello in mano all'operatore; i cursori inviano `formatoTesti` e `formatoVelocita` con un invio ritardato di 120 ms.
  - `regia.js`: crea `formati = avviaRegiaFormati(…)`, chiama `formati.disegna(s)` in `disegna`; `suoniRegia` esce subito per `produzione`, `podcast` e `reaction` (muti) e, fino al Task 14, anche per `drum`; il gestore dei tasti chiama prima `formati.scorciatoia(e.key, stato.layout)`.
  - Strumento: `--regia` (flusso Playwright su 1500×2400) — per ciascun layout seleziona `#layout` e verifica che solo la sua sezione abbia `.attivo` (le altre no), che `#social-regia` sia `.attivo` solo per i sei layout indicati e che `#sp-voci` abbia almeno 5 righe; sposta un cursore dei testi (`input[data-testo]` di `#dr-regia`) a 140 e verifica `drum.testi` via `/api/stato`; sposta la velocità di `#pr-regia` a 120 e verifica `produzione.velocita`; accende e spegne `poLinea` dalla spunta e verifica `visibili.poLinea`; «Ripristina tutti» riporta i testi a 100.

- [ ] **Step 1: Scrivere il controllo fallito** — aggiungere `--regia` a `strumenti/mockup-formati.mjs` come da Interfaces.
- [ ] **Step 2: Eseguire** `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --regia` → esce con 1 (opzione `drum` assente nel selettore).
- [ ] **Step 3: Implementare** HTML, CSS (la scheda sociale e le sezioni riusano `.sp-regia`/`.attivo`; stile dei cursori dei testi come in `battle`), `regia-formati.js` e i collegamenti in `regia.js`; spostare l'HTML della lista dei social senza cambiarne gli id.
- [ ] **Step 4: Eseguire** lo strumento → `ok regia …`; `node --test` verde; controllo visivo: la sezione «Senza premio» funziona ancora (aggiungere/spostare/togliere una voce dalla scheda sociale modifica la barra del layout senza premio).
- [ ] **Step 5: Commit** — «Formati: scheda Social del brand, sezioni di regia e controlli comuni [skip netlify]».

---

### Task 12: Pagina Drum — composizione statica, colonna dei traguardi e widget

**Files:**
- Modify: `public/drum.html`, `public/js/drum.js`, `public/css/formati.css`, `strumenti/mockup-formati.mjs`
- Create: `public/css/drum.css`, `public/js/drum-logica.js`, `test/drum-logica.test.mjs`

**Interfaces:**
- Consumes: `istantaneaDrum` (campi `contati`, `attiva`, `progresso`) da `s.drum`, `ts`/`applicaTesti`, `fascia`.
- Produces — `drum-logica.js` (pure):
  - `formattaLike(n): string` — punti da migliaia anche sotto i 10.000 (`1234` → `"1.234"`, `12480` → `"12.480"`, `0` → `"0"`).
  - `etichettaLike(n): string` — multipli di 1.000.000 → `"1M"`, multipli di 1.000 → `"12K"`, altrimenti `formattaLike(n)`.
  - `finestraScaletta(scaletta, raggiunte, quante = 4): { inizio, voci: { indice, like, titolo, stato }[] }` — `attiva = raggiunte < scaletta.length ? raggiunte : null`; `inizio` = `raggiunte − 1` (almeno 0) se c'è un'attiva, altrimenti `length − quante`; poi `min(inizio, max(0, length − quante))`; `stato` = `"sbloccata"` (indice < raggiunte), `"attiva"`, `"chiusa"`.
  - `testoScaletta(scaletta): string` — una riga `like | titolo` (titolo vuoto → `like |`); `leggiScaletta(testoScaletta(x))` ridà `x`.
  - `titoloBrano(titolo): string` — `titolo || "Brano a sorpresa"`.
  - `SBLOCCO = { urtoMs: 0, titoloMs: 150, bannerDopoMs: 1000, bannerDurataMs: 3200, scorriDopoMs: 1800, scorriDurataMs: 700, totaleMs: 2600 }` (Task 14).
- Produces — pagina e ganci DOM (`data-parte`): `cornice` (`.fm-cornice`: 4 `i.fm-staffa`, `i.fm-filo`; `visibili.drumCornice`), `eq` (`<canvas id="dr-eq">` 848×84; `drumCornice`), `brano` (`#dr-brano`: `#dr-brano-titolo`, `#dr-brano-artista`; nascosto con `hidden` se titolo vuoto; `drumBrano`), `priorita` (`#dr-priorita`: `#dr-pri-icona` con `ic-<icona>`, `#dr-pri-sopra`, `#dr-pri-prefisso`, `#dr-pri-slot` in oro; `drumPriorita`; sempre visibile con pulsazione CSS ogni 20 s; l'evento `richiamoDrum` la rilancia con `rilancia(el, "pulsa")`), `contatore` (`#dr-contatore`: `#dr-like-numero` con `formattaLike`, conteggio animato 600 ms quando cresce; cuore e «LIKE»; `drumTraguardi`), `colonna` (`#dr-colonna`: 4 `.dr-modulo[data-indice][data-stato]` ciascuno con `.dr-modulo-like` (`etichettaLike`), `.dr-modulo-titolo` (sbloccata: `titoloBrano`; attiva e chiusa: «Brano segreto»), `.dr-modulo-manca` (solo attiva: «mancano N» con `formattaLike`), `.dr-modulo-perc` (solo attiva: «N%»), icona lucchetto/spunta, `canvas.dr-fondo` 288×148 vuoto per ora; `drumTraguardi`), `sblocco` (`#dr-sblocco`, `#dr-sblocco-titolo`; nascosto), `fascia` (Task 10; `drumBarra`). Camera finta con `?anteprima=1`. I corpi di base sono quelli di Global Constraints, moltiplicati da `--ts-<gruppo>`; titolo modulo, brano e slot si adattano con `adattaTesto`.
- Strumento: `GEOMETRIA.drum.verticale` con tutte le Griglie del Drum; `PRESENTI` per stato (`vuoto`: tutto tranne `brano` e `sblocco`; `meta` e `finale`: tutto tranne `sblocco`; `sblocco`: tutto); controllo dei moduli.

- [ ] **Step 1: Scrivere i test falliti**:
  - `test/drum-logica.test.mjs` — `formattaLike`: `0`→`"0"`, `999`→`"999"`, `1234`→`"1.234"`, `12480`→`"12.480"`, `1000000`→`"1.000.000"`; `etichettaLike`: `1000`→`"1K"`, `12000`→`"12K"`, `500000`→`"500K"`, `1000000`→`"1M"`, `1500`→`"1.500"`, `750`→`"750"`; `finestraScaletta(scalettaPredefinita(), 0)` → `inizio` 0 e stati `["attiva","chiusa","chiusa","chiusa"]`; con `raggiunte` 7 → `inizio` 6, indici `[6,7,8,9]`, stati `["sbloccata","attiva","chiusa","chiusa"]`; con 36 → `inizio` 33, stati `["sbloccata","sbloccata","sbloccata","attiva"]`; con 37 (tutte) → `inizio` 33 e stati tutti `"sbloccata"`; con una scaletta di 2 tappe e `quante` 4 → 2 voci; `testoScaletta` e `leggiScaletta` fanno il giro (default con un titolo scritto); `titoloBrano("")` → «Brano a sorpresa»; relazioni di `SBLOCCO`: `bannerDopoMs > urtoMs`, `scorriDopoMs + scorriDurataMs <= totaleMs`, `bannerDopoMs + bannerDurataMs > scorriDopoMs`.
  - Strumento: per `--layout drum` e stato `vuoto`/`meta`/`sblocco`/`finale` il controllo geometrico di ogni parte presente, i moduli — `vuoto`: `[[0,"attiva","1K"],[1,"chiusa","2K"],[2,"chiusa","3K"],[3,"chiusa","5K"]]`; `meta`: `[[6,"sbloccata","10K"],[7,"attiva","12K"],[8,"chiusa","15K"],[9,"chiusa","17K"]]` con titolo del primo «Another One Bites the Dust», del secondo «Brano segreto», contatore `11.400`, `.dr-modulo-manca` che contiene `600`, `.dr-modulo-perc` «70%»; `finale`: indici 33…36, tutti `"sbloccata"`, etichette `["350K","400K","450K","500K"]`; il brano `meta` mostra «Seven Nation Army» e in `vuoto` `[data-parte="brano"]` è nascosto; `priorita` mostra «Dona un» e «Rosa»; `--testi-lunghi` (Review Focus 4) — con un titolo di tappa sbloccata di 60 caratteri, brano di 60 e artista di 40, prefisso di 16 e slot di 20 caratteri, ospite con handle di 40 (nella fascia) e `formatoTesti` al 200% per tutti i gruppi del Drum: per `.dr-modulo-titolo`, `#dr-brano-titolo`, `#dr-pri-prefisso`, `#dr-pri-slot` `scrollWidth <= clientWidth`, e i rettangoli di `colonna`, `brano`, `priorita`, `contatore` restano quelli delle Griglie.
- [ ] **Step 2: Eseguire** `node --test test/drum-logica.test.mjs` → FAIL (modulo mancante); `node strumenti/mockup-formati.mjs … --layout drum --stato meta` → esce con 1.
- [ ] **Step 3: Implementare** `drum-logica.js`, il markup di `drum.html`, `drum.css`, `drum.js` (disegno dallo stato; il primo disegno non anima; `statico` mostra lo stato finale; `fuori` per i widget spenti; `applicaTesti`) e la camera finta.
- [ ] **Step 4: Eseguire** test e strumento (`vuoto`, `meta`, `sblocco`, `finale`) → `ok`; controllo visivo dei quattro mockup: pezzi dove dicono le Griglie, testi leggibili, vetro sulla camera finta.
- [ ] **Step 5: Commit** — «Drum: pagina con colonna dei traguardi, contatore e widget [skip netlify]».

---

### Task 13: Drum — clessidra (perline e sabbia)

**Files:**
- Create: `public/js/drum-clessidra.js`
- Modify: `public/js/drum.js`, `public/css/drum.css`, `test/drum-logica.test.mjs`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Produces (`drum-clessidra.js`):
  - `STILI = { perline: { raggio: 7, colori: ["#ffd54a","#a066ff","#36dcff","#ff4fd8","#fff2a8"], lucido: true }, sabbia: { raggio: 2.5, colori: ["#f5b72a","#ffd863","#e09a12","#fff0b0"], lucido: false } }`.
  - `posizioniGrani({ larghezza, altezza, raggio, livello, seme = 7 }): { x, y, colore }[]` (pura) — impilamento a nido d'ape dal basso (righe a passo `raggio·√3`, passo orizzontale `2·raggio`, righe dispari spostate di `raggio`), `colore` indice in `0…colori.length−1` stabile per grano; i grani si «depositano» riga per riga con ordine mescolato (generatore con `seme`) dentro la riga; ne escono `round(livello · totale)`; `livello` fuori da 0…1 viene limitato; centri sempre dentro `[raggio, larghezza − raggio] × [raggio, altezza − raggio]`.
  - `creaClessidra(canvas, { stile }): { imposta({ livello, attiva }), ridisegna(), cambiaStile(stile), ferma() }` — canvas 2D con sprite pre-disegnati per colore (perline: sfera con riflesso; sabbia: disco pieno); il livello mostrato rincorre `livello` con easing (~600 ms) e ridisegna solo mentre si muove; con `attiva` (Like in crescita) un filo di 6–10 grani cade dal bordo alto al centro verso la superficie (solo scena, spariscono toccandola); `statico` (parametro `?statico=1`) disegna subito il livello finale senza animazione.
- `drum.js`: ogni `.dr-modulo` ha la sua clessidra; modulo `sbloccata` → livello 1, `chiusa` → 0, `attiva` → `progresso`; `attiva` (caduta) è vera quando i Like sono cresciuti nell'ultimo secondo; lo stile viene da `s.drum.riempimento`.
- Strumento: `--clessidra` — con `meta` (progresso 0.7) il bordo superiore dei grani nel canvas del modulo attivo cade a `148 · (1 − 0.7)` ± 14 px; con `drumRiempimento { stile: "sabbia" }` idem; `vuoto` → canvas del modulo attivo vuoto; `finale` → moduli pieni (bordo superiore ≤ 14 px dall'alto).

- [ ] **Step 1: Scrivere i test falliti** in `test/drum-logica.test.mjs`:
  - `clessidra: i grani` — con `{ larghezza: 264, altezza: 148, raggio: 7 }`: `livello` 0 → `[]`; `livello` 1 → tanti grani quanti ne dà la griglia (≥ 150) e tutti con centro dentro i limiti; ripetuta due volte con gli stessi parametri dà lo stesso risultato; i grani a `livello` 0.5 sono un sottoinsieme (stesse `x`,`y`,`colore`) di quelli a 0.8 (i posati non si spostano); a `livello` 0.5 il bordo alto dei grani (`min(y) − raggio`) è a 74 ± 13; `livello` 2 e −1 si limitano a 1 e 0; con `raggio: 2.5` il totale a livello 1 è ≥ 1500.
  - Controllo `--clessidra` dello strumento come da Interfaces.
- [ ] **Step 2: Eseguire** `node --test test/drum-logica.test.mjs` → FAIL (`drum-clessidra.js` mancante); `node strumenti/mockup-formati.mjs … --layout drum --clessidra` → esce con 1 (canvas vuoto).
- [ ] **Step 3: Implementare** `drum-clessidra.js` e il collegamento nei moduli (nessuna animazione continua quando non serve).
- [ ] **Step 4: Eseguire** test e strumento (`perline` e `sabbia`) → `ok`; controllo visivo dei mockup `meta` in entrambi gli stili (perline lucide e sabbia liscia).
- [ ] **Step 5: Commit** — «Drum: riempimento a clessidra con perline e sabbia [skip netlify]».

---

### Task 14: Drum — sequenza di sblocco, banner e suono

**Files:**
- Modify: `public/js/drum.js`, `public/css/drum.css`, `public/js/suoni.js`, `public/js/eventi-sonori.js`, `public/js/regia.js` (solo `suoniRegia` per `drum`), `test/eventi-sonori.test.mjs`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Consumes: eventi `sbloccoDrum` (`{ indice, like, titolo }`), `SBLOCCO` e `finestraScaletta` (Task 12), clessidra (Task 13).
- Produces:
  - `suoni.js`: effetto `sblocco(t)` (colpo grave, arpeggio ascendente a campana, accordo di ottoni breve e scintillio, ~1,4 s) in `effetti`/`NOMI_SUONI`.
  - `eventi-sonori.js`: `suoniDrum(prima, dopo, eventi): { nome, dati? }[]` — `[]` senza `prima`; un `{ nome: "sblocco" }` se c'è almeno un evento `sbloccoDrum` (anche più d'uno: un solo suono); inoltre gli eventi `suono` dei pulsanti Prova come in `suoniBattle`.
  - `regia.js`: `suoniRegia` per `drum` → `riproduci(suoniDrum(prima, dopo, eventi))`.
  - `drum.js`: alla ricezione di `sbloccoDrum` (mai al primo disegno, mai con `?statico=1`): la colonna mostra ancora la finestra di prima (`raggiunte − 1`) con il modulo `indice` al 100%; sequenza di `SBLOCCO` — urto (scala 1,06 e scossa), lampo verde neon (`--verde`), onda d'urto e raffica di perline dal modulo; lucchetto → spunta, bersaglio verde, titolo che si rivela con effetto «slot» (lettere che girano, `titoloBrano`); a `bannerDopoMs` compare `#dr-sblocco` («BRANO SBLOCCATO» + titolo grande verde neon, adattato fino a 34 px) per `bannerDurataMs`; a `scorriDopoMs` la colonna scorre di un posto in `scorriDurataMs` (il primo modulo esce in alto, quello nuovo entra in basso) e passa alla finestra con le tappe raggiunte aggiornate. Un secondo sblocco durante la sequenza si accoda (resta solo l'ultimo). Con `?statico=1&sblocco=1` si vede lo stato finale: finestra con `annunciati − 1` in testa, modulo verde con titolo e banner visibile.
- Strumento: `--sblocco-animato` — dal vivo (non statico) con `drumDemo { fase: "meta" }` e `drumLike { imposta: 12000 }`: subito dopo l'evento il modulo con `data-indice="7"` ha classe `sblocco` e `data-stato="sbloccata"` e la colonna mostra ancora `[6,7,8,9]`; a ~1,5 s `#dr-sblocco` è visibile con il titolo «Livin' on a Prayer»; a ~3 s gli indici della colonna sono `[7,8,9,10]`; a ~5 s `#dr-sblocco` è di nuovo nascosto; una ricarica della pagina a sblocco già annunciato non lo rifà (nessuna classe `sblocco` entro 2 s); spegnendo `drumTraguardi` (`widget`) durante la sequenza colonna e banner spariscono e, riaccendendolo, la colonna mostra la finestra aggiornata `[7,8,9,10]` senza moduli con classe `sblocco` né banner a metà. Con `?statico=1&sblocco=1` e stato `sblocco`: banner nel rettangolo `sblocco` delle Griglie.

- [ ] **Step 1: Scrivere i test falliti** in `test/eventi-sonori.test.mjs`: `drum: suono dello sblocco` — `suoniDrum(null, foto, [evento])` → `[]`; con `prima` e un evento `sbloccoDrum` → `[{ nome: "sblocco" }]`; due eventi nello stesso aggiornamento → un solo `sblocco`; nessun evento → `[]`; `{ nome: "suono", dati: { nome: "sblocco" } }` → `[{ nome: "sblocco" }]`; `NOMI_SUONI` include `sblocco`; `suonaIn({ layout: "battle", suoni: { dove: "overlay" } }, "drum", "overlay")` è `false` e con `layout: "drum"` è `true`. Aggiungere `--sblocco-animato` allo strumento.
- [ ] **Step 2: Eseguire** `node --test test/eventi-sonori.test.mjs` → FAIL; lo strumento con `--sblocco-animato` → esce con 1.
- [ ] **Step 3: Implementare** suono, `suoniDrum`, la sequenza nella pagina, lo stato statico `sblocco` e il collegamento in `regia.js`.
- [ ] **Step 4: Eseguire** `node --test` (verde) e lo strumento (`--sblocco-animato` e lo stato statico `sblocco`) → `ok`; prova nel browser con un `AudioContext` osservato: `sblocco` crea oscillatori al momento dell'evento e nessuno al caricamento; con `?muto=1` zero. Controllo visivo a fotogrammi (0,3 s, 1,5 s, 3 s) e del mockup `drum-sblocco.jpg`.
- [ ] **Step 5: Commit** — «Drum: sequenza di sblocco, banner e suono [skip netlify]».

---

### Task 15: Drum — equalizzatore e cornice che reagiscono ai colpi

**Files:**
- Create: `public/js/drum-eq.js`
- Modify: `public/js/drum.js`, `public/css/drum.css`, `public/js/drum-logica.js`, `test/drum-logica.test.mjs`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Consumes: `suAudio` di `connessione.js` (Task 9), `s.drum.eq` (`stile`, `senzaSegnale`), `.fm-cornice`.
- Produces:
  - `drum-logica.js` (pure): `interpolaBande(bande12, n): number[]` — `n` valori 0…1 (le bande sono 0…100) interpolati linearmente tra le 12 bande, estremi inclusi; `passoBarra(attuale, bersaglio, dt): number` — salita rapida (costante di tempo 0,04 s) e discesa lenta (0,22 s); `cappuccio(attuale, valore, dt): number` = `max(valore, attuale − 0.6·dt)`; `respiro(t, i, n): number` tra 0.06 e 0.14.
  - `drum-eq.js`: `creaEqualizzatore(canvas, { stile, senzaSegnale, suColpo }): { dati(bande12, colpo), imposta({ stile, senzaSegnale }), ferma() }` — 40 barre (stile `barre`, gradiente ciano → viola → magenta, cappuccio bianco) o onda specchiata (`onda`: curva liscia sulle stesse bande con riempimento sfumato) disegnate a ogni fotogramma; ogni `dati()` aggiorna i bersagli; `colpo > 60` chiama `suColpo()`; senza dati da 2 s: «respiro» lento se `senzaSegnale`, altrimenti niente; torna al segnale appena arrivano dati.
  - `drum.js`: `collega({ suAudio })` → `equalizzatore.dati(msg.b, msg.c)`; `suColpo` aggiunge per 250 ms la classe `colpo` a `.fm-cornice` (filo e staffe lampeggiano); `imposta` da `s.drum.eq` a ogni stato.
- Strumento: `--eq` — con `layout drum`, apre la pagina (non statica) e da un client WebSocket dello strumento invia a 30 Hz per 1 s `{ tipo: "audio", b: [90,80,70,60,50,40,30,20,10,5,0,0], c: 80 }`: il canvas `#dr-eq` ha pixel non trasparenti, `.fm-cornice.colpo` compare almeno una volta; interrotto l'invio, dopo 2,5 s il canvas mostra il «respiro» (pixel non trasparenti) e con `drumEq { senzaSegnale: false }` torna vuoto; `drumEq { stile: "onda" }` cambia il disegno (i pixel cambiano).

- [ ] **Step 1: Scrivere i test falliti** in `test/drum-logica.test.mjs`: `eq: matematica` — `interpolaBande(Array(12).fill(50), 40)` ha 40 valori tutti 0.5; con bande `[0,100,…]` i valori restano in 0…1 e gli estremi valgono la prima e l'ultima banda/100; `passoBarra(0, 1, 0.1)` > 0.9 (salita) e `passoBarra(1, 0, 0.1)` > 0.5 (discesa più lenta); `cappuccio(0.8, 0.2, 0.1)` = 0.74 e `cappuccio(0.8, 0.9, 0.1)` = 0.9; `respiro` sempre tra 0.06 e 0.14 per `t` 0…20, `i` 0…39, `n` 40. Aggiungere `--eq` allo strumento.
- [ ] **Step 2: Eseguire** `node --test test/drum-logica.test.mjs` → FAIL; strumento `--eq` → esce con 1.
- [ ] **Step 3: Implementare** le funzioni pure, `drum-eq.js` e il collegamento nella pagina (un solo `requestAnimationFrame` per l'equalizzatore).
- [ ] **Step 4: Eseguire** test e strumento `--eq` → `ok`; controllo visivo di barre e onda.
- [ ] **Step 5: Commit** — «Drum: equalizzatore e cornice reattivi ai colpi [skip netlify]».

---

### Task 16: Regia — ascolto dell'audio di FL Studio

**Files:**
- Create: `public/js/regia-audio.js`, `test/regia-audio.test.mjs`
- Modify: `public/regia.html` (blocco audio nella colonna `#dr-col2`), `public/js/regia-formati.js`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Consumes: `conn.audio(b, c)` (Task 9), `drumEq` (Task 8), sezione `#dr-regia` (Task 11).
- Produces:
  - `regia-audio.js` (pure): `BANDE = 12`; `limitiBande(frequenzaCampionamento, fftSize): [number, number][]` — 12 intervalli di bin `[da, a)` contigui e crescenti per 12 bande logaritmiche tra 40 Hz e 14 kHz, ciascuna con almeno un bin, la prima parte dal bin 1 e l'ultima arriva al bin di 14 kHz; `bandeDaSpettro(dati, limiti, sensibilita): number[12]` — `dati` byte 0…255 di `getByteFrequencyData`; ogni banda è `min(100, round(media/255 · 100 · sensibilita/100))`; `creaRilevatoreColpi(): { passo(bande, ora): number }` — flusso = somma degli incrementi (`max(0, b[i] − prec[i])`) sulle bande 0–6; media mobile `media += 0.08·(flusso − media)` dopo ogni passo; `soglia = max(30, 2.2 · media)`; colpo se `flusso > soglia` e sono passati più di 90 ms dall'ultimo, valore `min(100, max(50, round((flusso − soglia)/soglia · 100 + 50)))`, altrimenti 0.
  - `regia-audio.js` (browser): `elencaIngressi(): Promise<{ id, nome }[]>` (`enumerateDevices` degli `audioinput`); `avviaAscolto({ sorgente: "ingresso" | "sistema", deviceId, sensibilita, suFrame(b, c) }): Promise<{ ferma(), livello(): number }>` — `ingresso`: `getUserMedia({ audio: { deviceId, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`; `sistema`: `getDisplayMedia({ video: true, audio: true })` scartando la traccia video (errore in italiano se non c'è audio: «Scegli “Intero schermo” e spunta “Condividi audio di sistema”»); `AnalyserNode` con FFT 1024, `minDecibels` −85, `maxDecibels` −20, smoothing 0; passo di lettura di ~33 ms scandito da un Web Worker (Blob) che manda un tick; a ogni tick `bandeDaSpettro` e `creaRilevatoreColpi`, poi `suFrame`.
  - Regia (colonna `#dr-col2`, blocco «Equalizzatore»): `#dr-audio-sorgente` (Ingresso audio / Audio del PC), `#dr-audio-ingresso` (dispositivi, ricordato in `localStorage` con try/catch), `#dr-audio-avvia` (Avvia/Ferma ascolto), `#dr-audio-livello` (indicatore), `#dr-eq-sens` (cursore 50–300 → `drumEq { sensibilita }`), `#dr-eq-stile` (barre/onda → `drumEq { stile }`), `#dr-eq-idle` (spunta «Mostra anche senza segnale» → `drumEq { senzaSegnale }`), `#dr-eq-prova` (schema finto di 4 s a 30 Hz mandato con `conn.audio`); note in italiano: «Se LIVE Studio sente FL Studio con “audio del desktop”, lo sente anche “Audio del PC”»; avviso su ASIO esclusivo e su `localhost`/Chrome o Edge.
  - Strumento: `--audio` — Chromium con `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=<wav>` (WAV PCM 16 bit mono 48 kHz di 6 s generato dallo strumento: un colpo di rumore di 40 ms con tonfo a 80 Hz ogni 500 ms), permesso microfono; apre la pagina `drum.html` e la regia, sceglie «Ingresso audio», preme `#dr-audio-avvia`: entro 3 s `#dr-eq` della pagina ha pixel non trasparenti e `.fm-cornice.colpo` compare almeno 3 volte in 3 s; `#dr-audio-livello` si muove; «Ferma» interrompe i messaggi (dopo 2,5 s la pagina torna al respiro).

- [ ] **Step 1: Scrivere i test falliti** in `test/regia-audio.test.mjs`:
  - `limitiBande(48000, 1024)` — 12 intervalli; per ognuno `da < a`; il primo `da` è 1; `intervallo[i+1].da === intervallo[i].a`; l'ultimo `a` tra 296 e 300 e `≤ 512`.
  - `bandeDaSpettro` con `Uint8Array(512).fill(255)` → dodici 100; con `fill(0)` → dodici 0; con `fill(128)` e sensibilità 100 → dodici 50, a 50 → dodici 25, a 300 → dodici 100 (limitato); con solo i bin della banda 3 a 255 → `[0,0,0,100,0,0,0,0,0,0,0,0]`.
  - `creaRilevatoreColpi` — con 30 passi di silenzio (dodici 0, ogni 33 ms) sempre 0; `passo([90,80,70,60,50,40,30,20,10,5,0,0], 1000)` ≥ 50 e ≤ 100; poi 19 passi con le stesse bande → sempre 0 (rumore continuo non è colpo); silenzio a 1700 e di nuovo il colpo a 1800 → ≥ 50; due colpi a meno di 90 ms (silenzio a t+33, colpo a t+66) → il secondo vale 0; oscillazioni piccole (`±2` per banda) non danno mai colpi.
  - Aggiungere `--audio` allo strumento.
- [ ] **Step 2: Eseguire** `node --test test/regia-audio.test.mjs` → FAIL (modulo mancante); strumento `--audio` → esce con 1.
- [ ] **Step 3: Implementare** `regia-audio.js`, il blocco audio e il collegamento in `regia-formati.js` (il bottone avvia/ferma, il livello, i controlli dell'equalizzatore, la «Prova»).
- [ ] **Step 4: Eseguire** `node --test` (verde) e lo strumento `--audio` → `ok`. Limite dichiarato: «Audio del PC» (`getDisplayMedia`) non si prova qui.
- [ ] **Step 5: Commit** — «Drum: ascolto dell'audio dalla regia (ingresso e audio del PC) [skip netlify]».

---

### Task 17: Regia — controlli del Drum

**Files:**
- Modify: `public/regia.html` (colonna `#dr-col1` e resto di `#dr-col2`), `public/js/regia-formati.js`, `public/css/regia.css`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Consumes: comandi del Task 8, `testoScaletta`, `finestraScaletta`, `formattaLike`, `etichettaLike` (Task 12), `istantaneaDrum`.
- Produces — blocchi nella sezione Drum (id fissi, usati dallo strumento):
  - **Like**: `#dr-like-grande` (contatore con punti), `#dr-like-stato` («Collegato a TikTok» / «TikTok non collegato» da `s.tiktok.stato`), `#dr-like-imposta` (campo numerico) + `#dr-like-imposta-ok` (invia `drumLike { imposta }`), `#dr-like-100` e `#dr-like-1000` (`aggiungi`), `#dr-like-ora` («Riparti da ora», con conferma).
  - **Scaletta**: `#dr-scaletta` (textarea con `testoScaletta`; non si riscrive mentre ci si scrive), `#dr-scaletta-salva` (`drumScaletta { testo }`; l'errore mostra il messaggio con il numero di riga), `#dr-scaletta-predefinita` (con conferma), `#dr-scaletta-elenco` (lista scorrevole: per ogni tappa `etichettaLike`, titolo, stato ✓ sbloccata / ▶ attiva e per le sbloccate il pulsante «Suona ora» → `drumBrano { daIndice }`).
  - **Brano in esecuzione**: `#dr-brano-titolo-in`, `#dr-brano-artista-in`, `#dr-brano-ok` (`drumBrano { titolo, artista }`), `#dr-brano-svuota`.
  - **Artista ospite**: `#dr-ospite-etichetta`, `#dr-ospite-handle`, `#dr-ospite-icona` (elenco delle icone social), invio al cambio (`drumOspite`).
  - **Dona un…**: `#dr-pri-prefisso-in`, `#dr-pri-slot-in`, `#dr-pri-sopra-in`, `#dr-pri-icona-in` (rosa, corona, cuore, regalo, stella, diamante, logo BR), invio al cambio (`drumPriorita`), `#dr-pri-richiamo` («Richiamo» → `drumPriorita { richiamo: true }`).
  - **Riempimento**: `#dr-riempimento` (perline/sabbia → `drumRiempimento { stile }`).
  - Scorciatoia `scorciatoia("F2", "drum")` → richiamo.
  - Strumento: `--regia-drum` — dalla sezione Drum: «+1.000» fa salire `drum.contati` di 1000; `#dr-like-imposta` a 12000 + OK → `contati` 12000; scrivere `1000 | Uno\n2000 | Due` e salvare → scaletta di 2 tappe; una scaletta sbagliata mostra l'errore e non cambia lo stato; con 12000 «Suona ora» sulla tappa 2 → `drum.brano.titolo === "Due"`; cambiare ospite (`@lince.music`, icona TikTok), slot («Corolla»), icona (corona) e riempimento (sabbia) → stato aggiornato; `#dr-pri-richiamo` → un client WebSocket dello strumento riceve l'evento `richiamoDrum`; F2 invia lo stesso richiamo; salva `mockup/regia-drum.jpg`.

- [ ] **Step 1: Scrivere il controllo fallito** — `--regia-drum` come da Interfaces.
- [ ] **Step 2: Eseguire** `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --regia-drum` → esce con 1.
- [ ] **Step 3: Implementare** HTML e JS dei blocchi (campi si riempiono dallo stato solo se non in uso, come `riempi`; testi di errore con `avviso`).
- [ ] **Step 4: Eseguire** lo strumento → `ok regia-drum`; `node --test` verde; controllo visivo di `mockup/regia-drum.jpg`.
- [ ] **Step 5: Commit** — «Drum: controlli di regia per Like, scaletta, brano, ospite e Dona un… [skip netlify]».

---

### Task 18: Pagine Studio Production e Reaction Release (verticale e orizzontale)

**Files:**
- Modify: `public/produzione.html`, `public/reaction.html`, `public/js/doppio.js`, `public/css/formati.css`, `strumenti/mockup-formati.mjs`
- Create: `public/css/doppio.css`

**Interfaces:**
- Consumes: `s.produzione.titolo` (`preset`, `sopra`, `testo`, `sotto`), `s.reaction.titolo`, `ts`/`applicaTesti`, `fascia`; `doppio.js` serve entrambe (il layout si riconosce dal `data-formato="produzione"|"reaction"` del `body`).
- Produces — ganci DOM:
  - `titolo` (`data-parte="titolo"`, `#fm-titolo`): targa 3D cromata con monete BR e punto REC; `#fm-titolo-sopra`, `#fm-titolo-testo` (cromo luccicante, `adattaTesto` 88→40), `#fm-titolo-sotto` (nascosto se vuoto); `data-accento` = `oro`|`magenta`|`ciano` (produzione dal preset: cooking oro, sessione magenta, mix ciano; reaction sempre `magenta`); con `preset` produzione anche l'icona del preset in targa (`ic-cappello`, `ic-cuffie`, `ic-manopole`). Si accende con `visibili.prTitolo`/`reTitolo`.
  - Cambio titolo in tempo reale: quando `sopra`/`testo`/`sotto` cambiano la pagina aggiorna con un effetto flip breve (≤ 400 ms, classe `flip` rilanciata) — mai al primo disegno, e senza interrompere se arriva un altro cambio (vince l'ultimo); con `?statico=1` immediato.
  - Verticale (entrambi): finti A/B e fascia come nelle Griglie, titolo in [116, 282, 848, 160]. Reaction orizzontale: sfondo di marca opaco a tutta pagina (`.dp-sfondo`: gradiente viola scuro con griglia sottile e vignetta), titolo [360, 28, 1200, 140], `finestraA` (`data-parte="finestraA"`) e `finestraB` (`data-parte="finestraB"`) come **fori** (cornice cromata con staffe attorno a un'area trasparente, rettangoli delle Griglie), `divisore` (`data-parte="divisore"`: linea neon verticale con moneta BR al centro) e fascia [0, 920, 1920, 92]; finti A/B ai rettangoli delle finestre.
  - Strumento: `GEOMETRIA` per `produzione.verticale`, `reaction.verticale` e `reaction.orizzontale` (titolo, fascia, finestre, divisore, finti); controlli: il testo del titolo di `produzione` è «Cooking Beats» con `data-accento="oro"`; dopo `produzione { preset: "mix" }` (non statico) entro 700 ms `#fm-titolo-testo` è «Mix & Master» e `data-accento="ciano"`; `reaction` mostra «REACTION RELEASE DELLA SETTIMANA»; con testi lunghi (produzione `testo` di 28 caratteri; reaction `testo` di 60, `sopra` di 40, `sotto` di 60) e `formatoTesti` al 200% `scrollWidth <= clientWidth` per ogni riga e il titolo resta nel rettangolo (Review Focus 4); ogni parte `dentro` sta in x 116…964 / y 230…1200 in verticale.

- [ ] **Step 1: Scrivere i controlli falliti** — estendere `GEOMETRIA`, `PRESENTI` e i controlli dello strumento come da Interfaces.
- [ ] **Step 2: Eseguire** `node strumenti/mockup-formati.mjs … --layout produzione` e `… --layout reaction --formato orizzontale` → escono con 1 («elemento assente: titolo»).
- [ ] **Step 3: Implementare** il markup, `doppio.css`, `doppio.js` (stato → testi, accento, effetto flip, sfondo e finestre dell'orizzontale), le parti nuove di `formati.css`.
- [ ] **Step 4: Eseguire** lo strumento per produzione, reaction verticale e reaction orizzontale (anche con i testi lunghi al 200%) → `ok`; `node --test` verde; controllo visivo dei tre mockup (`produzione.jpg`, `reaction.jpg`, `reaction-orizzontale.jpg`): targa cromata, sfondo di marca, finestre con cornice, divisore con moneta, fascia in basso.
- [ ] **Step 5: Commit** — «Studio Production e Reaction Release: pagine verticali e orizzontale [skip netlify]».

---

### Task 19: Regia — Studio Production e Reaction Release

**Files:**
- Modify: `public/regia.html` (colonne `#pr-col1`/`#pr-col2` e `#re-col1`/`#re-col2`), `public/js/regia-formati.js`, `public/css/regia.css`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Consumes: comandi `produzione`, `reaction` (Task 8), sezioni di regia (Task 11).
- Produces:
  - Produzione: chip preset `button[data-preset="cooking|sessione|mix"]` (il preset in onda è evidenziato) che inviano `produzione { preset }`; campi `#pr-sopra`, `#pr-testo`, `#pr-sotto` che mandano `produzione { titolo: { <campo> } }` **mentre si scrive** con invio ritardato di 150 ms (un errore mostra l'avviso e rimette il valore in onda), senza essere riscritti dallo stato mentre hanno il fuoco; nota sui limiti (32/28/48).
  - Reaction: campi `#re-sopra`, `#re-testo`, `#re-sotto` con lo stesso comportamento (`reaction { titolo }`, limiti 40/60/60) e «Ripristina titolo predefinito» (rimanda `REACTION RELEASE DELLA SETTIMANA` e il sopra di partenza).
  - Anteprima: per reaction il selettore Verticale/Orizzontale della sezione (Task 11) è collegato.
  - Strumento: `--regia-doppio` — scegliendo il chip «Mix & Master» `produzione.titolo.preset` è `mix` e il campo `#pr-testo` mostra «Mix & Master»; scrivendo «Beat live 3» in `#pr-testo` (carattere per carattere con 30 ms di pausa) entro 600 ms dall'ultimo tasto `/api/stato` ha `testo` «Beat live 3» e il campo non viene sovrascritto durante la digitazione; un testo di 29 caratteri mostra un avviso e il valore in onda resta; per reaction scrivere in `#re-testo` «Ep. 12 · Lince» aggiorna `reaction.titolo.testo`, «Ripristina titolo predefinito» lo riporta a «REACTION RELEASE DELLA SETTIMANA».

- [ ] **Step 1: Scrivere il controllo fallito** — `--regia-doppio` come da Interfaces.
- [ ] **Step 2: Eseguire** `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --regia-doppio` → esce con 1.
- [ ] **Step 3: Implementare** HTML e JS dei due blocchi.
- [ ] **Step 4: Eseguire** lo strumento → `ok regia-doppio`; `node --test` verde.
- [ ] **Step 5: Commit** — «Regia: titoli in tempo reale di Studio Production e Reaction Release [skip netlify]».

---

### Task 20: Pagina Back Rooms Podcast (verticale e orizzontale)

**Files:**
- Modify: `public/podcast.html`, `public/js/podcast.js`, `public/css/formati.css`, `strumenti/mockup-formati.mjs`
- Create: `public/css/podcast.css`

**Interfaces:**
- Consumes: `s.podcast` (`titolo`, `ospiti`, `tematiche`), `visibili.poTitolo|poLinea|poTematiche|poBarra`, `vociFascia` (con gli ospiti), `ts`/`applicaTesti`.
- Produces — ganci DOM:
  - `targa` (`data-parte="targa"`, `#po-targa`): targa cromata con monete BR; `#po-targa-testo` («Back Rooms Podcast», `adattaTesto` 48→28), `#po-targa-sotto` (riga episodio, nascosta se vuota); `poTitolo`.
  - `tematiche` (`data-parte="tematiche"`, `#po-tematiche`): pannello a vetro di dimensione fissa (848×480 verticale, 512×570 orizzontale; a destra se `tematiche.lato === "dx"` in orizzontale, in verticale sempre centrato) con intestazione `#po-tematiche-titolo` e `.po-tema[data-stato]` per voce: `fatta` (attenuata, spunta), `attiva` (bordo oro, freccia, testo pieno), `prossima`; voce lunga si adatta (`adattaTesto` 34→22); comparsa/uscita animate (entra con scorrimento + dissolvenza in 600 ms), `poTematiche` spento = nascosto; il cambio di tematica attiva anima il passaggio del bordo.
  - `linea` (`data-parte="linea"`, `#po-linea`): linea neon cromata da 4 px (verticale x 538, y 240–1100; orizzontale x 958, y 0–968) che si disegna dal centro verso gli estremi in 700 ms quando `poLinea` si accende e si ritira quando si spegne.
  - `fascia` con i social e gli ospiti (Task 10). Con `?statico=1` tutto nello stato finale.
  - Strumento: `GEOMETRIA.podcast.verticale` e `.orizzontale` (Griglie) con `PRESENTI` per «completo» (linea e tematiche accese) e «base» (spente: `linea` e `tematiche` nascosti); controlli: il testo della targa è «Back Rooms Podcast» e dopo `podcast { titolo: { testo: "Puntata 3", sotto: "Con Lince" } }` si aggiornano targa e riga; 5 `.po-tema` con `data-stato` `["fatta","attiva","prossima","prossima","prossima"]` (attiva 1); dopo `podcastTematica { avanti: true }` `["fatta","fatta","attiva","prossima","prossima"]`; con `lato: "dx"` in orizzontale il pannello è a x 1360; la fascia contiene «Lince · @lince.music»; con otto tematiche da 48 caratteri, targa da 32 caratteri e `formatoTesti` al 200% niente esce dai riquadri (`scrollWidth <= clientWidth`) (Review Focus 4); in verticale ogni parte `dentro` in x 116…964 / y 230…1200.

- [ ] **Step 1: Scrivere i controlli falliti** — `GEOMETRIA`, `PRESENTI` e controlli del podcast nello strumento.
- [ ] **Step 2: Eseguire** `node strumenti/mockup-formati.mjs … --layout podcast` → esce con 1 («elemento assente: targa»).
- [ ] **Step 3: Implementare** markup, `podcast.css`, `podcast.js` (stato → targa, tematiche, linea; animazioni di comparsa; primo disegno senza animazioni).
- [ ] **Step 4: Eseguire** lo strumento per verticale e `--formato orizzontale` (anche con `lato: "dx"` e i testi lunghi al 200%) → `ok`; `node --test` verde; controllo visivo di `podcast.jpg` e `podcast-orizzontale.jpg`.
- [ ] **Step 5: Commit** — «Back Rooms Podcast: pagina verticale e orizzontale [skip netlify]».

---

### Task 21: Regia — Back Rooms Podcast

**Files:**
- Modify: `public/regia.html` (colonne `#po-col1`/`#po-col2`), `public/js/regia-formati.js`, `public/css/regia.css`, `strumenti/mockup-formati.mjs`

**Interfaces:**
- Consumes: comandi `podcast`, `podcastTematica`, `widget` (Task 8).
- Produces:
  - **Moduli a comando**: quattro grandi pulsanti On/Off `button[data-modulo="poLinea|poTematiche|poTitolo|poBarra"]` («Linea di divisione», «Pannello Tematiche», «Targa», «Fascia social») che inviano `widget { nome, visibile }` e mostrano lo stato in onda.
  - **Titolo**: `#po-testo`, `#po-sotto` (invio ritardato di 150 ms come negli altri titoli).
  - **Ospiti**: elenco fino a 4 righe (`nome`, `handle`, icona) con aggiungi/togli, salvataggio all'uscita dal campo (`podcast { ospiti }`).
  - **Tematiche**: `#po-tem-titolo`, `#po-tem-elenco` (una per riga, massimo 8) con «Salva», `#po-tem-lista` (elenco cliccabile: clic su una voce → `podcastTematica { indice }`, l'attiva evidenziata), `#po-tem-avanti`, `#po-tem-indietro`, `#po-tem-lato` (Sinistra/Destra → `podcast { tematiche: { lato } }`).
  - `scorciatoia("F2", "podcast")` → avanti, `F3` → indietro, `F4` → attiva/disattiva `poTematiche`.
  - Strumento: `--regia-podcast` — dalla sezione Podcast: il pulsante «Linea di divisione» accende `visibili.poLinea` e lo spegne al secondo clic; scrivere tre tematiche e salvare → `elenco` di 3 e `attiva` 0; clic sulla seconda voce della lista → `attiva` 1; F2 → 2, F3 → 1, F4 → `poTematiche` cambia; un'ospite aggiunto (Nome «Lince», handle «@lince.music») compare in `podcast.ospiti`; il titolo scritto in `#po-testo` arriva in onda entro 600 ms; una nona tematica mostra l'errore e lascia l'elenco com'era.

- [ ] **Step 1: Scrivere il controllo fallito** — `--regia-podcast` come da Interfaces.
- [ ] **Step 2: Eseguire** `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --regia-podcast` → esce con 1.
- [ ] **Step 3: Implementare** HTML e JS dei blocchi e le scorciatoie.
- [ ] **Step 4: Eseguire** lo strumento → `ok regia-podcast`; `node --test` verde.
- [ ] **Step 5: Commit** — «Regia: moduli, ospiti e tematiche del Back Rooms Podcast [skip netlify]».

---

### Task 22: Documentazione, mockup finali e controllo di insieme

**Files:**
- Modify: `README.md`, `GUIDA.html`
- Regenerate: `mockup/drum-*.jpg`, `produzione.jpg`, `reaction.jpg`, `reaction-orizzontale.jpg`, `podcast.jpg`, `podcast-orizzontale.jpg`, `regia-drum.jpg`

**Interfaces:**
- Produces: sezione README per ciascun layout (indirizzi e parametri `?anteprima=1`, `&guide=1`, `&statico=1`, `?formato=orizzontale`; dove mettere le camere e le sorgenti in LIVE Studio/OBS con le Griglie; cosa fanno i widget e le «Dimensione dei testi»; Drum: scaletta, Like, sblocco, «Dona un…», equalizzatore con le due sorgenti, ASIO esclusivo, `localhost` e Chrome/Edge; limiti: vetro non sfocato, Like simulati nelle prove, «Audio del PC» non provato qui); tabella dell'API con i comandi nuovi; elenco dei file nella struttura; capitolo nella `GUIDA.html` per ciascun layout (passi per la prima diretta) e la nota sui due mockup di regia; i numeri citati (test, porte, indirizzi) coincidono con lo stato reale.

- [ ] **Step 1: Eseguire il controllo completo** — `cd overlay-live && node --test` (tutti verdi, annotare il totale) e, con il server di prova, ogni invocazione dello strumento: drum (`vuoto`, `meta`, `sblocco`, `finale`), produzione, reaction verticale e orizzontale, podcast verticale e orizzontale, `--regia`, `--regia-drum`, `--regia-doppio`, `--regia-podcast`, `--clessidra`, `--eq`, `--sblocco-animato`, `--audio` → tutti `ok`.
- [ ] **Step 2: Scrivere README e GUIDA** (testi in italiano, stessa struttura delle sezioni di studio e battle).
- [ ] **Step 3: Rigenerare i mockup** con lo strumento (`mockup/<layout>[-orizzontale][-<stato>].jpg`) e controllarli a vista.
- [ ] **Step 4: Verifica dei riferimenti** — `grep` in README e GUIDA dei nomi di comandi e id citati (`drumLike`, `formatoTesti`, `likeEvento`, `/podcast.html?formato=orizzontale`…) contro `server.mjs` e le pagine: nessuno inesistente.
- [ ] **Step 5: Aggiornare** la riga di stato in testa alla spec («Stato: design e spec approvati in chat»).
- [ ] **Step 6: Commit** — «Formati: README, guida e mockup dei quattro nuovi layout [skip netlify]».
