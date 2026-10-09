# Overlay Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a `overlay-live` il 4° layout `battle` (scontro tra due rapper con barre della vita dal voto chat, spacco a fulmine e VS, modalità, timer con gong, tre giudici, tabellone torneo/punti, pop-up social) con la sua sezione di regia.

**Architecture:** Le regole stanno in un modulo di funzioni pure `lib/battle.mjs` (stato in `stato.battle`, nessun I/O, testato con `node --test`). `server.mjs` le espone come comandi e instrada la chat; la pagina `/battle.html` (HTML/CSS/JS senza build, come `studio.html`) disegna lo stato e suona gli effetti; la regia ottiene una sezione *Battle*. I tre layout esistenti non cambiano comportamento.

**Tech Stack:** Node ≥ 22, `ws`, `tiktok-live-connector` (già presenti), Web Audio sintetizzato, HTML/CSS/JS senza build, `node --test`. Playwright (globale, già installato) solo per mockup e controlli di geometria, fuori da `npm test`.

**Spec:** `docs/superpowers/specs/2026-10-06-battle-overlay-design.md` (con le due correzioni della Task 1).

## Global Constraints

- Node ≥ 22; nessuna nuova dipendenza npm; nessuna fase di build.
- Il codice vive in `overlay-live/` nel repo; `node_modules/`, `config.json`, `dati/` non si committano (già nel `.gitignore` di `overlay-live`).
- Tela 1080×1920; tutto tra x 116 e 964; zone TikTok: intestazione 0–230, zona libera 230–1200, chat 1200–1700 (sinistra) e cuori/regali (destra), barra commenti 1700–1920.
- Palette e font solo da `public/css/base.css` (variabili `--viola`, `--magenta`, `--ciano`, `--oro-testo`, `--font-dati` Barlow Condensed, `--font-gotico` Grenze Gotisch); logo `/assets/logo-br.png`. Il VS è un SVG disegnato qui (oro con fulmine), **senza** i personaggi Capcom/Bandai dell'immagine allegata.
- Testi dell'interfaccia e messaggi d'errore in italiano, come il resto del progetto.
- Un solo layout in onda suona (`suonaIn`); `studio` resta muto. I pop-up non suonano.
- Convenzioni di pagina come `studio`: `?anteprima=1`, `&guide=1`, `&statico=1`, `?w=` (parti da includere).
- Ogni commit: `git commit -m "<messaggio> [skip netlify]" -m "Co-Authored-By: Claude <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01KknJSv8vijv85bNpvfWr5a"` sul branch `claude/practical-cannon-6wegnn`. Nessun nome di modello in codice, commenti o messaggi.
- Gli esistenti 57 test (`cd overlay-live && node --test`) restano verdi a ogni task.
- Voti dei giudici: `normalizzaVoto` della gara (0–10, **un decimale**, accetta la virgola).
- Valori fissati: durata default 90 s (10–600); target default 30; pop-up ogni 4 min per 10 s; nomi dei rapper max 24 caratteri; modalità max 10; pop-up max 8; partecipanti torneo 4 o 8; artisti in classifica a punti max 10; conto 3-2-1 = `CONTO_MS = 3000`.

## Review Focus

1. Commenti di chat «strani» (`1 `, `!DX`, `12`, `1 vs 2`, vuoti) e voti fuori finestra (prima del via, dopo il gong, layout non battle): non devono contare. → Task 3 (lettore, finestra) e Task 7 (instradamento).
2. Riavvio del server a metà round (stato salvato con `fase: "battle"` e `fineAlle` nel passato, oppure `stato.json` di una versione senza `battle` o con valori rotti): niente crash, un solo gong, valori buoni conservati. → Task 3 (`fondiBattle`) e Task 5 (`passaSeTocca`).
3. Doppi clic e ordine sbagliato dalla regia (`battleAvvia` due volte, `battleRivela` due volte, `battleProclama` senza pari, `battleProssimo` con pari non risolto): errore chiaro, nessun doppio conteggio dei punti. → Task 5 e Task 6.
4. Nomi: uguali per i due lati, duplicati nel torneo/classifica (case-insensitive), troppo lunghi, vuoti, Instagram con link o `@`. → Task 4 e Task 6.
5. Un solo rapper (o due) arriva al target nello stesso round, e un artista non presente nell'elenco dei punti. → Task 6.

---

## File Structure

Create:
- `overlay-live/` (importata dallo zip, senza `node_modules/`, `config.json`, `dati/`)
- `overlay-live/lib/validazione.mjs` — validatori condivisi (`oggetto`, `testo`, `numeroTra`, `siNo`, `normalizzaVoto`, `arrotonda`, `pulisciInstagram`, `ICONE`, `controllaComparse`), estratti da `stato.mjs`
- `overlay-live/lib/battle.mjs` — tutte le regole del battle (funzioni pure)
- `overlay-live/test/battle.test.mjs`, `battle-server.test.mjs`, `battle-logica.test.mjs`
- `overlay-live/public/battle.html`, `css/battle.css`, `css/battle-tabellone.css`, `js/battle.js`, `js/battle-logica.js`, `js/battle-tabellone.js`
- `overlay-live/strumenti/mockup-battle.mjs` — mockup e controllo geometria con Playwright
- `overlay-live/mockup/battle-*.jpg`

Modify: `tsconfig.json` (root), `overlay-live/lib/stato.mjs`, `overlay-live/server.mjs`, `overlay-live/public/js/suoni.js`, `public/js/eventi-sonori.js`, `public/regia.html`, `public/js/regia.js`, `public/css/regia.css`, `overlay-live/README.md`, `GUIDA.html`, la spec.

Aggiunte rispetto alla spec: `lib/validazione.mjs` (evita import circolari tra `stato.mjs` e `battle.mjs`), `battle-tabellone.js/css` (il tabellone è un file a sé), `strumenti/mockup-battle.mjs`.

---

### Task 1: Importare overlay-live nel repo e correggere la spec

**Files:**
- Create: `overlay-live/**` (copia dello zip `/root/.claude/uploads/0a424b85-39fd-59ba-8663-5221618c2e36/b231620d-overlay-live.zip`)
- Modify: `tsconfig.json`, `docs/superpowers/specs/2026-10-06-battle-overlay-design.md`

**Interfaces:**
- Produces: la cartella `overlay-live/` con `npm test` verde (57 test) e il sito che non la tipizza.

- [ ] **Step 1: Estrarre lo zip in una cartella nuova e vuota e copiare `overlay-live/` nel repo escludendo `node_modules/`, `config.json`, `dati/`.** Poi `cd overlay-live && npm ci --no-audit --no-fund`.
- [ ] **Step 2: Mostrare il problema** — `tsc --listFilesOnly -p tsconfig.json | grep -c overlay-live` (dalla radice) stampa un numero > 0 (i `.d.ts` di `overlay-live/node_modules` rientrano in `**/*.ts`).
- [ ] **Step 3: In `tsconfig.json` portare `"exclude"` a `["node_modules", "overlay-live"]`.**
- [ ] **Step 4: Verificare** — lo stesso comando stampa `0`; `cd overlay-live && node --test` → `# pass 57`, `# fail 0`.
- [ ] **Step 5: Correggere la spec** in due punti: §5.3 «da 0 a 10 a passi di 0,5 (stessa `normalizzaVoto`)» diventa «da 0 a 10 con un decimale (stessa `normalizzaVoto` della gara)»; §5.1 `battleProssimo` aggiunge «e svuota i nomi dei due rapper (con il torneo carica il prossimo scontro)».
- [ ] **Step 6: Commit** — `git add tsconfig.json overlay-live docs && git commit` con messaggio «Importa overlay-live nel repo ed escludilo dal typecheck del sito [skip netlify]» (trailer in Global Constraints).

---

### Task 2: Estrarre i validatori in `lib/validazione.mjs`

**Files:**
- Create: `overlay-live/lib/validazione.mjs`
- Modify: `overlay-live/lib/stato.mjs` (righe ~88, 111–129, 189–219 e `normalizzaVoto`/`arrotonda`/`ICONE`/`pulisciInstagram`)
- Test: i test esistenti (rete di sicurezza), nessun test nuovo

**Interfaces:**
- Produces (da `lib/validazione.mjs`): `oggetto(x): boolean`, `testo(valore, max, nome, { obbligatorio }?): string`, `numeroTra(valore, min, max, nome): number`, `siNo(valore, nome): boolean`, `normalizzaVoto(valore): number | null`, `arrotonda(x, cifre): number | null`, `pulisciInstagram(valore): string`, `ICONE: string[]`, `controllaComparse(lista, massimo, nomeBase?): Comparsa[]` (la validazione oggi dentro `impostaStudio`: array, massimo, oggetto, icona in `ICONE`, id generato con `randomUUID` se manca, `attiva !== false`, `sopra` ≤ 40, `titolo` ≤ 28, `sotto` ≤ 60, titolo obbligatorio se attiva).
- `stato.mjs` continua a esportare `normalizzaVoto`, `arrotonda`, `pulisciInstagram`, `ICONE` (re-export) e `impostaStudio` usa `controllaComparse(modifiche.comparse, MAX_COMPARSE)`.

- [ ] **Step 1: Spostare** i validatori sopra in `lib/validazione.mjs` senza cambiarne il comportamento; in `stato.mjs` importarli e re-esportare i quattro nomi già pubblici. I messaggi d'errore restano identici.
- [ ] **Step 2: Verificare** — `cd overlay-live && node --test` → `# pass 57`.
- [ ] **Step 3: Commit** — «Estrai i validatori condivisi in lib/validazione.mjs [skip netlify]».

---

### Task 3: `lib/battle.mjs` — stato iniziale, chat e punteggio

**Files:**
- Create: `overlay-live/lib/battle.mjs`
- Modify: `overlay-live/lib/stato.mjs` (`LAYOUT`, `WIDGET`, `statoIniziale`, `istantanea`, messaggio di `impostaLayout`)
- Test: `overlay-live/test/battle.test.mjs`; aggiornare l'asserzione su `S.LAYOUT` in `test/studio.test.mjs` a quattro valori

**Interfaces:**
- Consumes: `normalizzaVoto`, `arrotonda`, `testo`, `numeroTra`, `oggetto` da `validazione.mjs`.
- Produces (da `battle.mjs`):
  - costanti `LATI = ["sx","dx"]`, `FASI = ["attesa","countdown","battle","voto","risultato"]`, `GIUDICI_BATTLE = ["luca","freya","daniele"]`, `CONTO_MS = 3000`.
  - `battleIniziale(): Battle` — forma: `{ fase: "attesa", round: 1, partitaId: null, sx: {nome:"",instagram:""}, dx: {…}, modalita: { scelta: "stileLibero", elenco: [{id,nome,conTesto,testo,attiva}] }, timer: { durataSecondi: 90, fineAlle: null, rimanenteMs: null, scaduto: false }, conto: { finoAlle: null }, chat: { aperta: false, voti: {} }, giudici: [{ id, nome, voti: { sx: null, dx: null } }], risultato: null, tabellone: { modo: "torneo", torneo: { partecipanti: [], partite: [], campione: null }, punti: { artisti: [], target: 30, vincitore: null } }, popup: { elenco, ogniMinuti: 4, durata: 10 } }`. Elenco modalità di partenza (id → nome, conTesto): `stileLibero` «Stile libero», `treQuarti` «Tre quarti», `tematica` «Tematica» (con testo), `anni90` «Anni '90», `beatAScelta` «Beat a scelta», `situazione` «Situazione» (con testo), `custom` (nome vuoto, `attiva: false`); tutte le altre `attiva: true`, `testo: ""`. Giudici: Luca, Freya, Daniele. Pop-up di partenza: `backrooms` (icona `logo`, sopra «Backrooms Studio · Vicenza», titolo «Prenota la tua sessione», sotto «backroomsstudio.it · @backrooms.studios») e `rime` (icona `instagram`, sopra «Seguici su Instagram», titolo «Rime Vicentine», sotto vuoto).
  - `fondiBattle(salvato: unknown): Battle` — parte da `battleIniziale()`; per ogni chiave di primo livello tiene il valore salvato solo se ha la forma giusta (fase in `FASI`, `round` intero ≥ 1, `durataSecondi` 10–600…), altrimenti il predefinito. Mai eccezioni.
  - `leggiVotoBattle(testo: unknown): "sx" | "dx" | null` — minuscole/maiuscole indifferenti, spazi ai lati ignorati, `!` facoltativo davanti; `1`/`sx` → `"sx"`, `2`/`dx` → `"dx"`, tutto il resto `null`.
  - `votoChatBattle(stato, { piattaforma, utente }, lato, ora): boolean` — `false` se la chat non è aperta, manca l'utente o il lato; chiave `${piattaforma}:${utente.toLowerCase()}`; l'ultimo voto vale.
  - `quota(chat): { sx: number, dx: number, voti: number }` — 50/50 senza voti.
  - `calcolaRisultato(battle): { parziali: { luca: {sx,dx}, freya: {sx,dx}, daniele: {sx,dx}, chat: {sx,dx} }, totali: {sx,dx}, pari: boolean, vincitore: "sx"|"dx"|null }` — chat = `arrotonda(10 × quota, 2)`; totale = `arrotonda((luca+freya+daniele+chat)/4, 2)`; `pari` se i totali grezzi differiscono meno di 0,005; lancia `Mancano i voti di <Nome>` per il primo giudice con un voto nullo.
  - `istantaneaBattle(battle): object` — copia senza `chat.voti`, con `chat: { aperta, sx, dx, voti }` (conteggi) e `quota`.
- Modifiche a `stato.mjs`: `LAYOUT = ["gara","senzaPremio","studio","battle"]`; `WIDGET` aggiunge `barreVita`, `modalita`, `timerBattle`, `giudiciBattle`, `popupBattle`, `bracket`; `statoIniziale` aggiunge `battle: battleIniziale()` e mette `visibili.bracket = false` (gli altri widget `true`); `istantanea` aggiunge `battle: istantaneaBattle(stato.battle)`; il messaggio di `impostaLayout` resta «Layout sconosciuto: …» e nomina anche `battle`.

- [ ] **Step 1: Scrivere i test falliti** in `test/battle.test.mjs` (setup: `config` come in `studio.test.mjs`, `const nuovo = () => S.statoIniziale(config)`):
  - `partenza: stato battle di default` — `stato.battle` uguale a `B.battleIniziale()`; `fase === "attesa"`, `round === 1`, `timer.durataSecondi === 90`, `modalita.scelta === "stileLibero"`, ids modalità `["stileLibero","treQuarti","tematica","anni90","beatAScelta","situazione","custom"]`, nomi giudici `["Luca","Freya","Daniele"]`, `tabellone.punti.target === 30`; `S.LAYOUT` ha 4 voci con `"battle"` ultima; `stato.visibili.bracket === false` e `stato.visibili.barreVita === true`; `S.istantanea(stato, config, 0).battle.chat.voti === 0` (un conteggio, non la mappa dei voti).
  - `chat: lettore dei comandi` (Review Focus 1) — tabella: `"1"`→`sx`, `" 2 "`→`dx`, `"SX"`→`sx`, `"!dx"`→`dx`, `"!1"`→`sx`, `"12"`/`"1 vs 2"`/`"3"`/`"uno"`/`""`/`null`/`undefined`→`null`.
  - `chat: un voto per utente e solo a chat aperta` — con `chat.aperta = false` `votoChatBattle(stato, {piattaforma:"tiktok", utente:"Mario"}, "sx", 0)` → `false`; aperta: `sx` poi `dx` dallo stesso utente (`"MARIO"`) → `true`, `Object.keys(chat.voti).length === 1`, `chat.voti["tiktok:mario"] === "dx"`; utente vuoto → `false`.
  - `quota` — senza voti `{ sx: 0.5, dx: 0.5, voti: 0 }`; 3 `sx` e 1 `dx` → `{ sx: 0.75, dx: 0.25, voti: 4 }`.
  - `risultato: media di giudici e chat` — voti Luca/Freya/Daniele a `sx` = 8,8,8 e `dx` = 6,6,6, chat 3 `sx` vs 1 `dx`: `totali` `{ sx: 7.88, dx: 5.13 }`, `vincitore: "sx"`, `pari: false`, `parziali.chat` `{ sx: 7.5, dx: 2.5 }`.
  - `risultato: mancano i voti` — con il voto di Freya a `null` → `assert.throws(..., /Mancano i voti di Freya/)`.
  - `risultato: pari merito` — `sx` 8,7,9 e `dx` 7,8,9, chat 1:1 → `pari: true`, `vincitore: null`, `totali` entrambi `7.25`.
  - `fondiBattle: stato vecchio o rotto` (Review Focus 2) — `fondiBattle(undefined)` e `fondiBattle("x")` uguali a `battleIniziale()`; `fondiBattle({ fase: "boh", round: -3, timer: { durataSecondi: 99999 }, sx: { nome: 42 } })` → `fase "attesa"`, `round 1`, `timer.durataSecondi 90`, `sx.nome ""`; `fondiBattle({ round: 4, timer: { durataSecondi: 120 } })` → `round 4`, `durataSecondi 120`.
- [ ] **Step 2: Eseguire** `cd overlay-live && node --test test/battle.test.mjs` → FAIL (`battle.mjs` mancante).
- [ ] **Step 3: Implementare** `lib/battle.mjs` come da Interfaces e le modifiche a `stato.mjs`; `istantaneaBattle` non deve mutare lo stato.
- [ ] **Step 4: Eseguire** `node --test` → tutti verdi (57 + nuovi).
- [ ] **Step 5: Commit** — «Battle: stato iniziale, lettore della chat e punteggio [skip netlify]».

---

### Task 4: `battle.mjs` — impostazioni dalla regia

**Files:**
- Modify: `overlay-live/lib/battle.mjs`
- Test: `overlay-live/test/battle.test.mjs`

**Interfaces:**
- Consumes: Task 3 (`battleIniziale`, tipi), `pulisciInstagram`, `controllaComparse`, `testo`, `numeroTra`, `siNo`.
- Produces:
  - `impostaScontro(stato, { sx?: {nome?, instagram?}, dx?: {nome?, instagram?} }): void` — nome ≤ 24 (`testo`), Instagram con `pulisciInstagram`; solo in fase `attesa` (altrimenti `Cambia i nomi prima di avviare il round (usa Reset)`); controllo su copia (un errore non cambia nulla).
  - `impostaModalita(stato, { scelta?: string, testo?: string, elenco?: ModalitaVoce[] }): void` — `elenco` massimo 10, nome ≤ 24 e obbligatorio se `attiva`, id generato se manca; `scelta` deve indicare una voce esistente e attiva; `testo` (≤ 40) si applica alla voce scelta solo se `conTesto`, altrimenti `Questa modalità non ha testo`.
  - `impostaTimer(stato, { durataSecondi }): void` — 10–600; cambia solo la durata del prossimo round.
  - `impostaGiudici(stato, { luca?, freya?, daniele? }): void` — nome non vuoto ≤ 24.
  - `impostaPopup(stato, { elenco?, ogniMinuti?, durata? }): void` — `controllaComparse(elenco, 8)`, `ogniMinuti` 0–30, `durata` 4–20.
  - `battleNuovaSerata(battle): Battle` — `battleIniziale()` che conserva nomi dei giudici, `modalita`, `timer.durataSecondi`, `popup`.

- [ ] **Step 1: Test falliti:**
  - `scontro: nomi e Instagram puliti` — `impostaScontro(stato, { sx: { nome: "  Lince ", instagram: "https://www.instagram.com/lince.music/?hl=it" }, dx: { nome: "Nove" } })` → `sx` `{ nome: "Lince", instagram: "lince.music" }`, `dx.nome "Nove"`.
  - `scontro: errori e atomicità` (Review Focus 4) — `nome` di 25 caratteri lancia `/24 caratteri/`; `{ sx: { nome: "Kappa" }, dx: { instagram: "non valido!" } }` lancia e `sx.nome` resta `""`; con `fase = "battle"` lancia `/Cambia i nomi/`.
  - `modalità: scelta e testo` — `impostaModalita(stato, { scelta: "tematica", testo: "Vicenza di notte" })` → `scelta "tematica"` e testo salvato nella voce; `{ scelta: "stileLibero", testo: "x" }` lancia `/non ha testo/`; `{ scelta: "custom" }` lancia (voce spenta); con `elenco` da 11 voci lancia `/10/`; aggiungere una voce `{ nome: "Rime baciate", conTesto: false, attiva: true }` le assegna un id e la rende scegliibile.
  - `timer, giudici e pop-up` — `impostaTimer(stato, { durataSecondi: "120" })` → `120`; `9` e `601` lanciano `/tra 10 e 600/`; `impostaGiudici(stato, { luca: "Luca C." })` aggiorna solo Luca, `{ freya: "" }` lancia; `impostaPopup` con 9 pop-up lancia, `ogniMinuti: 31` lancia, `durata: 3` lancia, `ogniMinuti: 0` valido.
  - `nuova serata conserva la configurazione` — dopo aver cambiato nome di Luca, modalità, durata e popup e simulato un round, `battleNuovaSerata(stato.battle)` ha `round 1`, `fase "attesa"`, `chat.voti {}`, `sx.nome ""`, ma Luca, `modalita`, `durataSecondi` e `popup` invariati.
- [ ] **Step 2: Eseguire** `node --test test/battle.test.mjs` → FAIL sulle nuove.
- [ ] **Step 3: Implementare** le cinque funzioni come da Interfaces (stesso stile di `impostaStudio`: copia profonda, validazione, assegnazione finale).
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: impostazioni di scontro, modalità, timer, giudici e pop-up [skip netlify]».

---

### Task 5: `battle.mjs` — fasi del round

**Files:**
- Modify: `overlay-live/lib/battle.mjs`
- Test: `overlay-live/test/battle.test.mjs`

**Interfaces:**
- Consumes: Task 3 (`calcolaRisultato`, `CONTO_MS`), Task 4 (`impostaScontro`).
- Produces (tutte su `stato.battle`, `ora` in ms; gli eventi sono `{ nome: "gong", dati: { quando: "inizio" | "fine" } }`):
  - `avvia(stato, ora): void` — da `attesa`; errori `Mancano i nomi dei rapper`, `I due rapper devono avere nomi diversi` (confronto senza maiuscole), `Il round è già avviato`; imposta `fase "countdown"`, `conto.finoAlle = ora + CONTO_MS`, `stato.visibili.bracket = false`.
  - `passaSeTocca(stato, ora): Evento[]` — `countdown` scaduto → `battle`: `timer = { durataSecondi, fineAlle: ora + durataSecondi*1000, rimanenteMs: null, scaduto: false }`, `chat.aperta = true`, `conto.finoAlle = null`, evento gong `inizio`. `battle` con `timer.fineAlle !== null && ora >= fineAlle` → `chiudiRound` (sotto). Altrimenti `[]`.
  - `termina(stato, ora): Evento[]` — da `battle` (anche in pausa) → `chiudiRound`: `fase "voto"`, `chat.aperta = false`, `timer.scaduto = true` con `fineAlle`/`rimanenteMs` a `null`, evento gong `fine`; fuori da `battle` lancia `Il round non è in corso`.
  - `timerAzione(stato, azione: "pausa" | "riprendi", ora): void` — solo in `battle`; `pausa` salva `rimanenteMs = fineAlle - ora`; `riprendi` rimette `fineAlle = ora + rimanenteMs`.
  - `votoGiudice(stato, { giudice, lato, valore }): void` — solo in `voto` (altrimenti `I voti dei giudici si scrivono a fine round`); giudice in `GIUDICI_BATTLE`, lato in `LATI`, valore con `normalizzaVoto` (`""`/`null` svuota).
  - `rivela(stato, ora): { vincitore, pari }` — solo in `voto`; usa `calcolaRisultato`; `fase "risultato"`, `risultato = { rivelatoAlle: ora, totali, parziali, vincitore, pari, registrato: false }`; se non `pari` chiama `registraRound(stato)`.
  - `proclamaBattle(stato, lato): void` — solo in `risultato` con `pari` e vincitore ancora `null` (altrimenti `Il round non è in pari merito`); imposta `risultato.vincitore = lato` e chiama `registraRound`.
  - `registraRound(stato): void` — se `risultato.registrato` non fa nulla; qui marca `risultato.registrato = true` (la Task 6 aggiunge torneo e punti).
  - `prossimo(stato): void` — solo in `risultato` con vincitore (altrimenti `Proclama prima il vincitore`): `fase "attesa"`, `round + 1`, nomi svuotati, `partitaId null`, `chat { aperta: false, voti: {} }`, voti dei giudici a `null`, `risultato null`, `conto.finoAlle null`, timer azzerato (durata invariata). La Task 6 aggiunge il caricamento della partita successiva.
  - `reset(stato): void` — in `countdown`, `battle`, `voto` o `risultato` non registrato: torna ad `attesa` tenendo nomi, `round` e `partitaId`, azzerando chat, voti, timer, conto e risultato; in `risultato` registrato lancia `Il round è già registrato: usa Prossimo scontro`.

- [ ] **Step 1: Test falliti** (helper di test `pronto(stato)` che chiama `impostaScontro` con Lince/Nove e `giocaFinoAlVoto(stato, T)` che esegue `avvia(T)`, `passaSeTocca(T + CONTO_MS)`, `termina(T + CONTO_MS + 1000)`):
  - `avvia: servono i nomi e parte il 3-2-1` — senza nomi `/Mancano i nomi/`; con nomi uguali (`"lince"`/`"Lince"`) `/nomi diversi/`; ok → `fase "countdown"`, `conto.finoAlle === T + 3000`, `visibili.bracket === false` anche se prima era `true`; secondo `avvia` `/già avviato/` (Review Focus 3).
  - `passaSeTocca: fine del conto → battle` — a `T + 2999` ritorna `[]` e fase `countdown`; a `T + 3000` ritorna `[{ nome: "gong", dati: { quando: "inizio" } }]`, `fase "battle"`, `chat.aperta`, `timer.fineAlle === T + 3000 + 90_000`.
  - `scadenza del timer → voto` — a `fineAlle` ritorna il gong `fine`, `fase "voto"`, `chat.aperta === false`, `timer.scaduto`; un voto chat dopo la fine ritorna `false` (Review Focus 1); una seconda chiamata ritorna `[]` (idempotente).
  - `pausa e ripresa` — avviato a `T0` (`fineAlle = T0 + 90000`): `timerAzione(stato, "pausa", T0 + 10_000)` → `rimanenteMs 80000`, `fineAlle null`; `passaSeTocca(stato, T0 + 200_000)` → `[]`; `riprendi` a `T0 + 50_000` → `fineAlle === T0 + 130_000`; `pausa` in fase `attesa` lancia.
  - `termina` — in `battle` → `voto` + gong `fine`; in `attesa` lancia `/non è in corso/`.
  - `riavvio dopo lunga assenza` (Review Focus 2) — stato in `battle` con `fineAlle` nel passato: `passaSeTocca(stato, fineAlle + 3_600_000)` ritorna esattamente un gong `fine`; stato in `countdown` con `finoAlle` di un'ora fa → diventa `battle` con `fineAlle = ora + 90_000` (non scade subito).
  - `voti dei giudici` — `votoGiudice(stato, { giudice: "luca", lato: "sx", valore: "7,5" })` in `voto` → `7.5`; in `battle` lancia `/a fine round/`; `valore: 11` lancia `/tra 0 e 10/`; `valore: ""` rimette `null`; `giudice: "gigi"` lancia.
  - `rivela: calcola e registra una volta` — voti 8,8,8 vs 6,6,6 e chat 3:1 → `rivela` ritorna `{ vincitore: "sx", pari: false }`, `fase "risultato"`, `risultato.totali` `{ sx: 7.88, dx: 5.13 }`, `registrato true`; seconda `rivela` lancia; con il voto di Freya mancante lancia `/Mancano i voti di Freya/` e la fase resta `voto`.
  - `pari merito: proclama` (Review Focus 3) — 8,7,9 vs 7,8,9 chat 1:1 → `pari true`, `vincitore null`, `registrato false`; `prossimo` lancia `/Proclama prima/`; `proclamaBattle(stato, "dx")` → `vincitore "dx"`, `registrato true`; di nuovo lancia; in un round non pari `proclamaBattle` lancia `/pari merito/`.
  - `prossimo e reset` — dopo un round vinto `prossimo` → `fase "attesa"`, `round 2`, nomi `""`, `chat.voti {}`, voti giudici tutti `null`, `risultato null`, `timer.fineAlle null`, `durataSecondi` invariata; `reset` a metà `voto` tiene nomi e `round`; `reset` in `risultato` registrato lancia `/già registrato/`.
- [ ] **Step 2: Eseguire** `node --test test/battle.test.mjs` → FAIL.
- [ ] **Step 3: Implementare** le funzioni; `chiudiRound` è un helper interno condiviso da `passaSeTocca` e `termina`.
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: fasi del round, voti dei giudici, rivelazione e pari merito [skip netlify]».

---

### Task 6: `battle.mjs` — torneo e classifica a punti

**Files:**
- Modify: `overlay-live/lib/battle.mjs`
- Test: `overlay-live/test/battle.test.mjs`

**Interfaces:**
- Consumes: Task 5 (`registraRound`, `prossimo`, `rivela`), Task 4 (`impostaScontro`).
- Produces:
  - Partita: `{ id, turno: "quarti"|"semifinali"|"finale", sx: {nome,instagram}|null, dx: …|null, vincitore: null|"sx"|"dx", totali: null|{sx,dx} }`; ids `q1…q4`, `s1`, `s2`, `f1` (con 4 partecipanti solo `s1`, `s2`, `f1`).
  - `creaTorneo(stato, partecipanti: (string | {nome, instagram?})[]): void` — solo in `attesa`; 4 o 8 (`Servono 4 o 8 partecipanti`), nomi non vuoti ≤ 24 e unici senza maiuscole (`Nomi duplicati`); accoppiamenti 1-2, 3-4, 5-6, 7-8; azzera `campione`.
  - `sorteggiaTorneo(stato, caso = Math.random): void` — mescola `partecipanti` (Fisher–Yates con `caso`) e ricrea le partite; solo se nessuna partita è stata giocata.
  - `azzeraTorneo(stato): void`.
  - `caricaPartita(stato, id): void` — solo in `attesa`; errori `Partita non trovata`, `La partita non è ancora definita`, `La partita è già stata giocata`; imposta `sx`, `dx` (da `impostaScontro`) e `partitaId`.
  - `impostaPunti(stato, { artisti?: (string | {nome, punti?})[], target?: number, azzera?: boolean }): void` — massimo 10 artisti, nomi unici senza maiuscole (`Nomi duplicati`), `target` 1–1000; artista `{ nome, punti, round: number[] }`; `azzera` rimette `punti` a 0, `round []`, `vincitore null`.
  - `registraRound(stato)` esteso — solo nel tabellone attivo (`tabellone.modo`): in `torneo`, se `partitaId` è impostato, scrive `vincitore` e `totali` nella partita, fa avanzare il vincitore (`q1`→`s1.sx`, `q2`→`s1.dx`, `q3`→`s2.sx`, `q4`→`s2.dx`, `s1`→`f1.sx`, `s2`→`f1.dx`; con 4 partecipanti i semifinalisti sono già nelle partite) e, deciso `f1`, imposta `torneo.campione`; in `punti` somma i totali di **entrambi** i rapper presenti nell'elenco (nome senza maiuscole; gli assenti si ignorano), `punti = arrotonda(somma, 2)`, e se nessun vincitore c'è già assegna `punti.vincitore` tra chi ha raggiunto `target` in questo round (se due: totale del round più alto; a parità, `punti` complessivi più alti; poi il lato vincente del round). Sempre una sola volta per round (`registrato`).
  - `prossimo` esteso — con `tabellone.modo === "torneo"` carica la prima partita (in ordine di array) con entrambi i rapper noti e non giocata, se esiste.
  - `impostaTabellone(stato, { modo?: "torneo"|"punti", visibile?: boolean }): void` — `modo` in `battle.tabellone.modo`, `visibile` in `stato.visibili.bracket`.

- [ ] **Step 1: Test falliti** (helper `faiRound(stato, T, lato)` che porta `avvia → passaSeTocca → termina`, scrive i sei voti con 8,8,8 al `lato` e 6,6,6 all'altro, e chiama `rivela`):
  - `torneo: 8 partecipanti` — `creaTorneo(stato, ["A","B","C","D","E","F","G","H"])` → ids `["q1","q2","q3","q4","s1","s2","f1"]`, `q1.sx.nome "A"`, `q1.dx.nome "B"`, `s1.sx === null`; con 5 lancia `/4 o 8/`; `["A","a",…]` lancia `/duplicati/` (Review Focus 4); con 4 → ids `["s1","s2","f1"]`.
  - `torneo: sorteggio` — `sorteggiaTorneo(stato, () => 0)` mantiene gli stessi nomi (insieme ordinato uguale), ricrea le partite con `vincitore null`; dopo una partita giocata lancia.
  - `torneo: avanzamento e campione` — con `["A","B","C","D"]`: `caricaPartita(stato,"s1")`, `faiRound(…,"sx")` (chat senza voti: 50/50) → `s1.vincitore "sx"`, `s1.totali` `{ sx: 7.25, dx: 5.75 }`, `f1.sx.nome "A"`; `prossimo` carica `s2` (`partitaId "s2"`, nomi C e D); dopo `s2` vinto da `dx` → `f1.dx.nome "D"`; `prossimo` carica `f1`; finale vinta da `dx` → `torneo.campione.nome "D"`.
  - `torneo: caricamento non valido` — `caricaPartita(stato,"f1")` prima delle semifinali lancia `/non è ancora definita/`; `"zz"` lancia `/non trovata/`; partita già giocata lancia `/già stata giocata/`; fuori da `attesa` lancia.
  - `punti: somma di entrambi e target` (Review Focus 5) — `impostaPunti(stato, { artisti: ["Lince","Nove","Kappa"], target: 14 })`, `tabellone.modo = "punti"`, `impostaScontro` Lince (sx) / Nove (dx), `faiRound(…,"sx")` con chat 50/50 → Lince `punti 7.25` e `round [7.25]`, Nove `punti 5.75`, Kappa `0`, `punti.vincitore null`; dopo `prossimo`, di nuovo Lince/Nove e `faiRound(…,"sx")` → Lince `14.5`, Nove `11.5`, `punti.vincitore "Lince"`.
  - `punti: due raggiungono il target nello stesso round` — artisti Lince e Nove con `punti: 14.5` ciascuno e `target: 15`, round vinto da Lince (totali 7.25 / 5.75): entrambi sopra il target (21.75 / 20.25), `punti.vincitore "Lince"` (totale del round più alto).
  - `punti: artista fuori elenco e nomi duplicati` — Lince vs «Zeta» (non in elenco): somma solo a Lince, nessun errore; `impostaPunti` con `["Lince","lince"]` lancia `/duplicati/`; 11 artisti lancia.
  - `registrazione unica e solo nel tabellone attivo` (Review Focus 3) — chiamare `registraRound` due volte lascia i punti invariati; in `modo "punti"` il torneo non cambia anche con `partitaId` impostato; in `modo "torneo"` i punti non cambiano.
- [ ] **Step 2: Eseguire** `node --test test/battle.test.mjs` → FAIL.
- [ ] **Step 3: Implementare.** Per l'avanzamento usare una tabella `{ q1: ["s1","sx"], q2: ["s1","dx"], q3: ["s2","sx"], q4: ["s2","dx"], s1: ["f1","sx"], s2: ["f1","dx"] }`.
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: torneo a eliminazione e classifica a punti [skip netlify]».

---

### Task 7: Server — layout, route, comandi, chat e demo

**Files:**
- Modify: `overlay-live/server.mjs`, `overlay-live/lib/battle.mjs` (`votoDaCommento`, `battleDemo`), `overlay-live/lib/stato.mjs` (se serve per `fondiBattle` nel caricamento)
- Test: `overlay-live/test/battle.test.mjs`, `overlay-live/test/battle-server.test.mjs`

**Interfaces:**
- Consumes: tutto `battle.mjs`.
- Produces:
  - `votoDaCommento(stato, { piattaforma, utente, testo }, ora): boolean` in `battle.mjs` = `leggiVotoBattle` + `votoChatBattle`.
  - `battleDemo(stato, fase: "attesa"|"countdown"|"battle"|"voto"|"risultato"|"pari"|"torneo"|"punti", ora, { secondi = 47 } = {}): void` — riempie dati di prova realistici: nomi Lince / Nove (Instagram `lince.music`, `nove.mc`), modalità `tematica` con «Vicenza di notte»; `countdown`: `conto.finoAlle = ora + 60_000`; `battle`: timer con `secondi` rimasti (`fineAlle = ora + secondi × 1000`) e chat 22 `sx` / 15 `dx`; `voto`: timer scaduto, voti giudici assenti; `risultato`: voti 8,8,8 / 6,6,6 rivelati, `rivelatoAlle = ora - 60_000`; `pari`: come la spec §5.3; `torneo`: 8 partecipanti con quarti giocati; `punti`: 5 artisti con 2 round e target 30 (entrambi mostrano `visibili.bracket = true`).
  - Variabili d'ambiente per le prove: `OVERLAY_CONFIG` (percorso del config, se presente non si crea nulla) e `OVERLAY_DATI` (cartella dello stato).
  - Comandi (tutti via WebSocket e `POST /api/<nome>`): `battleScontro`, `battleModalita`, `battleTimer` (`{ durataSecondi }` oppure `{ azione }`), `battleAvvia`, `battleTermina`, `battleReset`, `battleProssimo`, `battleVotoGiudice`, `battleGiudici`, `battleRivela`, `battleProclama`, `tabellone`, `torneo` (`{ partecipanti, azione: "crea"|"sorteggia"|"azzera" }`), `torneoCarica`, `punti`, `battlePopup` (`{ elenco?, ogniMinuti?, durata?, id? }`: con `id` emette l'evento `popupBattle` `{ id }`, senza `id` e senza altri campi la «prossima»), `battleDemo` (`{ fase, secondi? }`). `layout` accetta già il nuovo nome.
  - Eventi emessi dal server: `gong` (`dati.quando`) dai ritorni di `passaSeTocca`/`termina`; `popupBattle`.

- [ ] **Step 1: Test falliti** in `battle.test.mjs`:
  - `commento di chat → voto` (Review Focus 1) — `votoDaCommento(stato, { piattaforma: "tiktok", utente: "m", testo: "!DX" }, 0)` con chat aperta → `true` e voto `dx`; `testo: "8"` → `false`.
  - `battleDemo: ogni fase produce uno stato valido` — per ciascuna fase `fondiBattle(stato.battle)` è profondamente uguale a `stato.battle`; `battle` ha nomi Lince/Nove, `punti` ha 5 artisti, `torneo` 8 partecipanti e `visibili.bracket === true`; `battleDemo(stato, "battle", T, { secondi: 20 })` → `timer.fineAlle === T + 20_000`.
  Poi `test/battle-server.test.mjs` (avvia `node server.mjs` come processo figlio con `OVERLAY_CONFIG` su un file temporaneo `{ "porta": <libera>, "host": "127.0.0.1", "tiktok": "", "layout": "gara", "premio": "x", "giudici": {…}, "pesi": {…}, "topN": 3, "durataCountdownMinuti": 180, "durataVotoChatSecondi": 60, "nero": { "username": "", "portaWebhook": 0 } }`, `OVERLAY_DATI` su cartella temporanea; attende la riga «Overlay live pronto»; chiude il processo a fine test):
  - `e2e: un round completo` — POST `layout {nome:"battle"}`, `battleScontro`, `battleTimer {durataSecondi:10}`, `battleAvvia`; attende 3,4 s; POST `messaggioChat` con `testo "1"` (×3, utenti diversi) e `"2"` (×1) → risposte `dati.contato === true`; POST `battleTermina`; sei `battleVotoGiudice` (8 e 6); `battleRivela`; `GET /api/stato` → `battle.fase "risultato"`, `battle.risultato.vincitore "sx"`, `battle.quota.sx === 0.75`, `typeof battle.chat.voti === "number"` (nessuna mappa dei voti nell'istantanea); un client WebSocket collegato prima ha ricevuto due eventi `gong` (`inizio`, `fine`).
  - `e2e: errori chiari` (Review Focus 3) — `battleAvvia` senza nomi → HTTP 400 con `errore` contenente `Mancano i nomi`; `battleRivela` fuori da `voto` → 400; comando sconosciuto → 400.
  - `e2e: con un altro layout la chat non vota il battle` — con `layout "gara"` un `messaggioChat` `"1"` non cambia `battle.chat`.
- [ ] **Step 2: Eseguire** `node --test test/battle.test.mjs test/battle-server.test.mjs` → FAIL.
- [ ] **Step 3: Implementare** in `server.mjs`: `PAGINE` con `/battle` e `/battle.html`; `caricaStato` applica `fondiBattle(salvato.battle)`; `registraCommento` con `stato.layout === "battle"` usa `B.votoDaCommento` (altrimenti come oggi); il tick da 250 ms chiama `B.passaSeTocca` e `emetti("gong", …)` per ogni evento, poi `cambiato()`; i comandi della lista (con `pulisci` dove serve) chiamando le funzioni di `battle.mjs`; `nuovaSerata` usa `battleNuovaSerata`; `demo` conserva `battle`; le env `OVERLAY_CONFIG`/`OVERLAY_DATI` come da Interfaces; il messaggio di avvio stampa `Battle: <base>/battle.html (scontro, 1080x1920)`.
- [ ] **Step 4: Eseguire** `cd overlay-live && node --test` → verdi (i test e2e durano ~5 s).
- [ ] **Step 5: Commit** — «Battle: layout, route, comandi, chat e dati di prova nel server [skip netlify]».

---

### Task 8: `public/js/battle-logica.js` — parti pure della pagina

**Files:**
- Create: `overlay-live/public/js/battle-logica.js`
- Test: `overlay-live/test/battle-logica.test.mjs`

**Interfaces:**
- Consumes: `prossimaComparsa` da `studio-logica.js`.
- Produces:
  - `percentuali(quota): { sx: number, dx: number }` — `sx = Math.round(100 × quota.sx)`, `dx = 100 - sx`.
  - `SOGLIA_URGENTE_MS = 30_000`; `timerUrgente(ms): boolean` (`0 < ms <= 30_000`).
  - `rimanenteBattleMs(battle, ora): number` — `fineAlle - ora` se in corso, altrimenti `rimanenteMs`, altrimenti `durataSecondi × 1000`; mai negativo.
  - `numeroConto(finoAlle, ora): 3 | 2 | 1 | 0` — `Math.ceil((finoAlle - ora) / 1000)` limitato a 0–3.
  - `RIVELAZIONE = { passoMs: 900, conteggioMs: 700, conteggioTotaleMs: 1500 }` e `sequenzaRivelazione(risultato): { chiave: "luca"|"freya"|"daniele"|"chat"|"totale", sx: number, dx: number, dopoMs: number }[]` — cinque passi con `dopoMs` 0, 900, 1800, 2700, 3600; `FINE_RIVELAZIONE_MS = 3600 + 1500`.
  - `popupConsentito(battle, visibili): boolean` — solo in fase `attesa` o `battle` e con `visibili.popupBattle !== false`.
  - `richiestePopup(prima, dopo, eventi): (string | null)[]` — un elemento per ogni evento `popupBattle` (`dati.id ?? null`), vuoto se `prima` è `null` o il pop-up non è consentito.
  - `popupAutomaticoDovuto({ ogniMinuti, ultimaAlle, ora, aperto, consentito }): boolean`.
  - Riuso di `prossimaComparsa(elenco, ultimaId, id)` per scegliere il pop-up.

- [ ] **Step 1: Test falliti:** `percentuali({sx:.75,dx:.25})` → `{75,25}`; `percentuali({sx:1/3,dx:2/3})` → `{33,67}`; `timerUrgente` vero a `30_000` e `1`, falso a `30_001` e `0`; `rimanenteBattleMs` per i tre casi (incluso `fineAlle` nel passato → `0`); `numeroConto(1000, 0)` → 1, `(3000, 0)` → 3, `(0, 5)` → 0; `sequenzaRivelazione` su un risultato 8,8,8/6,6,6 chat 7.5/2.5 totali 7.88/5.13 → chiavi `["luca","freya","daniele","chat","totale"]`, `dopoMs` `[0,900,1800,2700,3600]`, ultimo passo `{ sx: 7.88, dx: 5.13 }`; `popupConsentito` falso in `countdown`, `voto`, `risultato` e con `visibili.popupBattle === false`; `richiestePopup` ritorna `["rime", null]` per due eventi e `[]` in fase `voto`; `popupAutomaticoDovuto` falso con `ogniMinuti: 0`, falso prima dell'intervallo, vero dopo, falso se `aperto`.
- [ ] **Step 2: Eseguire** `node --test test/battle-logica.test.mjs` → FAIL.
- [ ] **Step 3: Implementare** il modulo (nessun DOM).
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: logica pura della pagina (barre, timer, rivelazione, pop-up) [skip netlify]».

---

### Task 9: Suoni del battle

**Files:**
- Modify: `overlay-live/public/js/suoni.js`, `overlay-live/public/js/eventi-sonori.js`
- Test: `overlay-live/test/eventi-sonori.test.mjs`

**Interfaces:**
- Consumes: Task 8 (`RIVELAZIONE`, `sequenzaRivelazione`, `FINE_RIVELAZIONE_MS`, `SOGLIA_URGENTE_MS`, `rimanenteBattleMs`), `S.istantanea` + funzioni di `battle.mjs` per costruire gli stati.
- Produces:
  - In `suoni.js`: effetti `gong` (colpo grave con coda lunga e riverbero, un secondo battito più acuto a +0,25 s), `conto` (bip breve; `dati.n === 1` più acuto), `spacco` (schiocco: rumore breve passa-alto + discesa rapida di tono). Compaiono in `NOMI_SUONI`.
  - In `eventi-sonori.js`: `suoniTimerBattle(msPrima, msDopo): Suono[]` (`allarme` quando si passa da > 30_000 a ≤ 30_000; un `tic` per ogni nuovo secondo ≤ 10 con `dati.ultimi` vero se ≤ 3; niente se `msDopo <= 0`); `suoniBattle(prima, dopo, eventi): Suono[]` con `Suono = { nome, dati?, ritardo? }`.

- [ ] **Step 1: Test falliti** in `eventi-sonori.test.mjs`:
  - `battle: prima è nullo → nessun suono`.
  - `battle: il 3-2-1` — da `attesa` a `countdown` → `[{nome:"conto",dati:{n:3},ritardo:0},{nome:"conto",dati:{n:2},ritardo:1000},{nome:"conto",dati:{n:1},ritardo:2000}]`.
  - `battle: gong e spacco al via, gong alla fine` — evento `{ nome: "gong", dati: { quando: "inizio" } }` → nomi `["gong","spacco"]`; `quando: "fine"` → `["gong"]`.
  - `battle: timer` — `suoniTimerBattle(31_000, 29_900)` → `[{nome:"allarme"}]`; `(29_000, 28_000)` → `[]`; `(11_000, 9_900)` → `[{nome:"tic",dati:{ultimi:false}}]`; `(3_500, 2_900)` → `ultimi:true`; `(5_000, 0)` → `[]`.
  - `battle: rivelazione` — da `voto` a `risultato` (voti 8,8,8/6,6,6): `[{nome:"voto",dati:{valore:8},ritardo:0},{nome:"voto",dati:{valore:8},ritardo:900},{nome:"voto",dati:{valore:8},ritardo:1800},{nome:"calcolo",ritardo:3600}]`.
  - `battle: campione` — quando `tabellone.punti.vincitore` passa da `null` a un nome (o `torneo.campione` da `null` a un oggetto) si aggiunge `{ nome: "vincitore", ritardo: 5100 + 600 }`.
  - `battle: suona solo la pagina del layout in onda` — `suonaIn({ layout: "battle", suoni: { dove: "overlay" } }, "battle", "overlay")` vero e `suonaIn(…, "gara", "overlay")` falso.
  - `suoni: gong, conto e spacco esistono` — `NOMI_SUONI` li contiene e `suona("gong")` non lancia in Node (nessun AudioContext).
- [ ] **Step 2: Eseguire** `node --test test/eventi-sonori.test.mjs` → FAIL.
- [ ] **Step 3: Implementare** gli effetti con le primitive già in `suoni.js` (`colpo`, `piatto`, `rumore`, `tono`, `campana`, `whoosh`) e le due funzioni pure.
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: effetti gong, conto e spacco e regole dei suoni [skip netlify]».

---

### Task 10: Pagina `/battle.html` — griglia fissa e strumento di controllo

**Files:**
- Create: `overlay-live/public/battle.html`, `public/css/battle.css`, `public/js/battle.js`, `strumenti/mockup-battle.mjs`
- Test: `overlay-live/test/battle-server.test.mjs` (route), `strumenti/mockup-battle.mjs` (geometria)

**Interfaces:**
- Consumes: `collega`, `durata` da `connessione.js`; `percentuali`, `rimanenteBattleMs`, `timerUrgente` da Task 8; stato dal server (`stato.battle`, `stato.visibili`).
- Produces:
  - Pagina con classe `verticale bt`, scala del palco e parametri come `studio.js` (`?anteprima=1` con finta camera nera/viola, `&guide=1` con tagli, zone TikTok e riquadro camera, `&statico=1`, `?w=barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone`).
  - Elementi con `data-parte` e geometria (px della tela): `barre` x116 y282 848×90; `modalita` x116 y398 530×146; `timer` x660 y398 304×146; `popup` x116 y566 848×78; `camera` x0 y656 1080×608; `artisti` x116 y1100 848×96 (box sinistro x116–520, destro x560–964); `giudici` x116 y1292 848×150 (tre box da 272 con 16 di spazio); `chat` x116 y1456 848×78; `tabellone` x116 y282 848×1252.
  - Variabili in cima a `battle.css`: `--bt-x`, `--bt-largo`, `--bt-y-barre`, `--bt-h-barre`, `--bt-y-modo`, `--bt-h-modo`, `--bt-largo-modo`, `--bt-x-timer`, `--bt-largo-timer`, `--bt-y-popup`, `--bt-h-popup`, `--bt-y-camera: 656px`, `--bt-h-camera: 608px`, `--bt-y-tabellone`, `--bt-h-tabellone`; box artisti = fondo camera − 164, giudici = fondo camera + 28, barra chat = giudici + 164 (a default coincidono con la tabella).
  - Contenuto: barre della vita (nome 124 px · barra 230 · badge «CHAT VOTES» 108 · barra 230 · nome 124; riempimento = quota dal centro verso il nome; % su ogni barra; sinistra `--ciano`, destra `--magenta` come colore di barra, nome, bordo del box artista e etichetta della barra chat); piastra modalità («MODALITÀ» + nome + testo se `conTesto`); timer `mm:ss` (via `durata`); cornice della camera (fili neon sopra e sotto a tutta larghezza, staffe d'angolo a x 116/964); box artisti (nome, icona Instagram, handle; senza handle solo il nome); tre box giudici (nome, due valori `sx · dx`, «?» finché non rivelato); barra «VOTA IN CHAT: 1 = <nome sx> · 2 = <nome dx>». I widget `visibili.*` nascondono le rispettive parti.
  - `strumenti/mockup-battle.mjs`: uso `node strumenti/mockup-battle.mjs --base http://127.0.0.1:4747 --fase battle [--guida]`; applica `battleDemo {fase}` (layout `battle`) via POST, apre la pagina con Playwright a 1080×1920 e `?anteprima=1&statico=1`, **verifica** con tolleranza ±1 px le geometrie della tabella sopra (e che tutto tranne `camera` stia tra x 116 e 964) uscendo con codice ≠ 0 e un messaggio per ogni scarto, e salva `mockup/battle-<fase>.jpg`.

- [ ] **Step 1: Test fallito** — in `battle-server.test.mjs` `e2e: la pagina del battle` — `GET /battle.html` e `GET /battle` rispondono 200 con `text/html` e contengono `data-parte="camera"` (oggi 404).
- [ ] **Step 2: Eseguire** → FAIL.
- [ ] **Step 3: Implementare** `battle.html` (stessi `defs` SVG di `studio.html` per `g-cromo`/`g-oro` e le icone), `battle.css`, `battle.js` (stato → DOM, `riempi` testi con `textContent`, riadatta i testi lunghi con la tecnica di `adattaTesto` di `studio.js`, `document.fonts.ready` per rimisurare) e lo strumento.
- [ ] **Step 4: Verificare** — `node --test` verde; poi con il server avviato (`OVERLAY_DATI=<tmp> node server.mjs`) `node strumenti/mockup-battle.mjs --base http://127.0.0.1:4747 --fase battle` esce con 0 e crea `mockup/battle-battle.jpg`; guardare l'immagine e confrontarla con la griglia della spec §4. Ripetere con `--fase attesa` e `--fase risultato`.
- [ ] **Step 5: Commit** — «Battle: pagina con barre, camera, giudici e strumento di controllo geometria [skip netlify]».

---

### Task 11: Pagina — animazioni, countdown, spacco, rivelazione e pop-up

**Files:**
- Modify: `overlay-live/public/battle.html`, `public/css/battle.css`, `public/js/battle.js`
- Test: `strumenti/mockup-battle.mjs`

**Interfaces:**
- Consumes: Task 8 (`numeroConto`, `sequenzaRivelazione`, `RIVELAZIONE`, `richiestePopup`, `popupAutomaticoDovuto`, `popupConsentito`, `timerUrgente`), Task 9 (`suoniBattle`, `suona`, `volume`, `suonaIn`), eventi `gong` e `popupBattle` del server.
- Produces (stati visivi pilotati dallo stato/eventi):
  - **Countdown 3-2-1**: strato a tutto schermo (1080×1920) con numero enorme (`numeroConto`), «VIA!» a zero; parametro `?conto=N` mostra il numero N fermo (per i mockup).
  - **Spacco**: all'evento `gong` `inizio` un fulmine verticale (SVG a zig-zag, disegno in 350 ms con lampo bianco) attraversa il centro della camera e lascia un divisorio luminoso fisso; il VS (SVG oro con fulmine, 220×190, centro in x 540 y 960) entra con urto e onda d'urto. Con `fase` `attesa`/`countdown` il divisorio e il VS non ci sono; con la pagina caricata a round in corso compaiono subito, senza animazione.
  - **Fine**: al gong `fine` onda d'urto e scritta «STOP»; a `fase "voto"` i box giudici mostrano «?».
  - **Timer**: rosso e lampeggiante per `timerUrgente`.
  - **Rivelazione**: da `risultato.rivelatoAlle` i passi di `sequenzaRivelazione` mostrano i valori con conteggio animato (`RIVELAZIONE.conteggioMs`, il totale `conteggioTotaleMs`); con `statico` o a passi già trascorsi, valori finali subito. Vincitore illuminato in oro; con `pari` e `vincitore` nullo, scritta «PARI MERITO».
  - **Pop-up**: pannello (logo/icona, sopra, titolo gotico, sotto con `scriviConLink` come `studio.js`) che sale in 0,9 s e resta `popup.durata` s; giro con `prossimaComparsa`; automatico con `popupAutomaticoDovuto` ogni `popup.ogniMinuti`; manuale da evento `popupBattle`; `?popup=1` lo mostra fermo (per i mockup).
  - **Suoni**: `suoniBattle(prima, dopo, eventi)` solo se `suonaIn(stato, "battle", "overlay")`, `?muto=1` e `?statico=1` li escludono; `volume(stato.suoni.volume)` prima di suonare.

- [ ] **Step 1: Estendere `strumenti/mockup-battle.mjs`** con `--conto N`, `--popup` e geometria del countdown (strato 1080×1920 a x0 y0) e del pop-up (x116 y566 848×78); poi eseguirlo su `--fase countdown --conto 3` e `--fase battle --popup` e vederlo FALLIRE (elementi assenti).
- [ ] **Step 2: Implementare** le animazioni e gli stati sopra. Le animazioni usano solo CSS/JS della pagina, `statico` le azzera come in `studio`.
- [ ] **Step 3: Verificare** — lo strumento esce con 0 per `--fase countdown --conto 3`, `--fase battle`, `--fase voto`, `--fase risultato`, `--fase pari`, `--fase battle --popup`; guardare i sei `mockup/battle-*.jpg` (nomi: `battle-countdown.jpg`, `battle-battle.jpg`, `battle-voto.jpg`, `battle-risultato.jpg`, `battle-pari.jpg`, `battle-popup.jpg`) e controllare: VS e divisorio visibili solo da `battle` in poi, timer rosso con meno di 30 s (usare `battleDemo` `battle` con 20 s rimasti passando `--secondi 20` allo strumento), «PARI MERITO» solo nel pari.
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: countdown, spacco a fulmine, VS, rivelazione e pop-up [skip netlify]».

---

### Task 12: Regia — sezione Battle, suoni e scorciatoie

**Files:**
- Modify: `overlay-live/public/regia.html`, `public/js/regia.js`, `public/css/regia.css`
- Test: `strumenti/mockup-battle.mjs` (modalità `--regia`)

**Interfaces:**
- Consumes: comandi della Task 7, `suoniBattle` (Task 9), `stato.battle` dall'istantanea.
- Produces:
  - Voce «Battle» nel selettore `#layout` («In onda») e link «Anteprima battle ↗» (`/battle.html?anteprima=1&guide=1&muto=1`) in testata.
  - Sezione `<section class="scheda sp-regia bt-regia" id="bt-regia">` (classe `attivo` con layout `battle`, come `#st-regia`): **Scontro** (`#f-bt-scontro`: nome e Instagram dei due rapper, «Applica»), **Modalità** (chip per le voci attive in `#bt-modalita`, campo `#bt-testo` per Tematica/Situazione, modifica dell'elenco con aggiunta fino a 10), **Timer** (`#bt-durata` con scorciatoie 60/90/120/180 e numero libero 10–600; pulsanti `#bt-avvia`, `#bt-pausa`, `#bt-termina`), **Giudici** (sei campi `data-giudice`/`data-lato` che salvano con Invio come i voti della gara, nomi dei giudici modificabili, `#bt-rivela`, `#bt-proclama-sx`/`#bt-proclama-dx` attivi solo con pari merito, `#bt-prossimo`, `#bt-reset` con `confirm`), **Pop-up** (elenco modificabile, intervallo, durata, «Mostra ora»), stato del round (fase, round, quota chat in %, tempo rimasto), anteprima in iframe.
  - `suoniRegia`: con `dopo.layout === "battle"` riproduce `suoniBattle`.
  - Scorciatoie con il battle in onda: `F2` → `battleAvvia`, `F4` → `battleRivela`, `F8` → `battleProssimo`, `F9` → `battleTimer` pausa/riprendi (secondo `timer.fineAlle`); con gli altri layout invariate. L'aiuto «Scorciatoie» in `regia.html` le elenca per layout.

- [ ] **Step 1: Estendere `strumenti/mockup-battle.mjs` con `--regia`** — apre `/regia`, sceglie «Battle», compila i nomi, preme Avvia, attende 3,5 s, preme Termina, scrive i sei voti, preme Rivela e controlla che `#bt-regia` mostri la fase «risultato» e che `GET /api/stato` dica `battle.fase === "risultato"`; salva `mockup/regia-battle.jpg`. Eseguirlo e vederlo FALLIRE (sezione assente).
- [ ] **Step 2: Implementare** HTML, JS (`disegnaBattle(s)` richiamata da `disegna`) e CSS riusando le classi esistenti (`scheda`, `sp-colonne`, `modulo`, `interruttore`, `nota`, `azioni`, `primario`, `piccolo`, `pericolo`).
- [ ] **Step 3: Verificare** — `--regia` esce con 0; guardare `mockup/regia-battle.jpg`; controllare a mano che con `layout gara` la sezione sia nascosta e le scorciatoie `F2/F4/F8/F9` facciano ancora la gara.
- [ ] **Step 4: Eseguire** `node --test` → verdi.
- [ ] **Step 5: Commit** — «Battle: sezione di regia, suoni e scorciatoie [skip netlify]».

---

### Task 13: Tabellone — pannello torneo e classifica a punti

**Files:**
- Create: `overlay-live/public/js/battle-tabellone.js`, `public/css/battle-tabellone.css`
- Modify: `public/battle.html`, `public/js/battle.js`, `public/regia.html`, `public/js/regia.js`, `strumenti/mockup-battle.mjs`

**Interfaces:**
- Consumes: `stato.battle.tabellone`, `stato.visibili.bracket` (Task 3/6), comandi `tabellone`, `torneo`, `torneoCarica`, `punti` (Task 7).
- Produces:
  - `disegnaTabellone(radice, battle, { statico })` in `battle-tabellone.js`: pannello opaco nel riquadro `tabellone` (x116 y282 848×1252) con ingresso/uscita animati; `modo "torneo"` → albero verticale (quarti in alto, semifinali, finale con trofeo; partita in corso evidenziata, vincitori in oro, nomi `—` se non noti, campione in evidenza); `modo "punti"` → tabella ordinata per punti (posizione, nome, chip dei punti di ogni round, totale grande, barra verso `target`, banner con `punti.vincitore`).
  - Regia: blocco **Tabellone** in `#bt-regia`: interruttore mostra/nascondi (`#bt-bracket`), scelta Torneo/Punti, partecipanti del torneo (8 righe di testo, «Crea», «Sorteggia», «Azzera»), elenco partite con «Carica» (`torneoCarica`), elenco artisti della classifica (testo con un nome per riga), `#bt-target`, «Azzera punti».
  - `strumenti/mockup-battle.mjs`: fasi `torneo` e `punti` con geometria del pannello.

- [ ] **Step 1: Estendere lo strumento** con le fasi `torneo` e `punti` (geometria `tabellone`, e `visibili.bracket` attivo) ed eseguirlo: FALLISCE (pannello assente).
- [ ] **Step 2: Implementare** `battle-tabellone.js/css`, il collegamento in `battle.js` (il pannello compare con `visibili.bracket` e sparisce da solo al countdown perché `avvia` lo spegne) e i controlli di regia.
- [ ] **Step 3: Verificare** — `--fase torneo` e `--fase punti` escono con 0; guardare `mockup/battle-torneo.jpg` e `mockup/battle-punti.jpg`; con `--regia` il flusso della Task 12 resta verde; `node --test` verde.
- [ ] **Step 4: Commit** — «Battle: tabellone con torneo e classifica a punti [skip netlify]».

---

### Task 14: Documentazione, consegna e push

**Files:**
- Modify: `overlay-live/README.md`, `overlay-live/GUIDA.html`
- Create: `overlay-live-battle.zip` (fuori dal repo, nella cartella degli output della sessione)

**Interfaces:**
- Consumes: tutto.

- [ ] **Step 1: README** — nuova sezione «Battle» (a imitazione di «Live session in studio»): descrizione, sorgente Link `http://127.0.0.1:4747/battle.html` 1080×1920, tabella delle posizioni (spec §4), parametri URL, regole del punteggio, comandi della chat (`1`/`2`/`sx`/`dx`), scorciatoie, tabella dei comandi `POST /api/…` del battle, variabili CSS per spostare la camera (16:9 vs 4:3), file nuovi nella sezione «Struttura»; aggiornare l'elenco dei layout e `layout` in `config.json` (`"battle"`).
- [ ] **Step 2: GUIDA.html** — breve capitolo «Battle» con il flusso di una serata (nomi → Avvia → 3-2-1 → battle → voti → Rivela → Prossimo scontro) e come accendere il tabellone.
- [ ] **Step 3: Verifica finale** — `cd overlay-live && node --test` verde; rigenerare tutti i mockup battle e `--regia`; `git status` pulito dai file non voluti (`config.json`, `dati/`, `node_modules/` esclusi).
- [ ] **Step 4: Commit e push** — «Battle: README e guida [skip netlify]», poi `git push -u origin claude/practical-cannon-6wegnn` (ritentare fino a 4 volte con attesa 2/4/8/16 s solo per errori di rete).
- [ ] **Step 5: Zip da copiare sul PC della diretta** — creare lo zip di `overlay-live/` senza `node_modules/`, `config.json`, `dati/`; inviarlo con `SendUserFile` insieme ai mockup `battle-*.jpg`, dicendo apertamente che la prova con la camera vera in TikTok LIVE Studio resta da fare e che l'handle Instagram di Rime Vicentine va scritto dalla regia.
