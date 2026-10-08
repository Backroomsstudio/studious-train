# Restyling in grigi, San Francisco, Goal e richieste — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare tutti i layout di `overlay-live` a San Francisco e a una palette neutra e realizzare le richieste del brief del 2026-10-08: Goal Like e Follower, voti 4–10 con chat al 10%, tabellone ad albero, richieste con regalo, scheda «Ora in ascolto» fissa, Drum rivisto, diciture modificabili.

**Architecture:** Logica pura in `lib/*.mjs` (stato, validazioni, parser TikTok) con test `node --test`; `server.mjs` espone i comandi e collega gli eventi TikTok; le pagine overlay (HTML/CSS/JS senza build) disegnano lo stato; la regia (`public/regia.html`, `public/js/regia*.js`) lo modifica; gli strumenti Playwright in `strumenti/` controllano geometria e pixel.

**Tech Stack:** Node ≥ 22 (moduli ES), `ws`, `tiktok-live-connector` 2.5.0 (proto v3), `node:test`, Playwright (solo strumenti, installato a parte).

**Spec:** `docs/superpowers/specs/2026-10-08-restyling-grigi-goal-richieste-design.md` (i §N dei task rimandano a lì). Tutti i percorsi sono relativi a `overlay-live/` salvo `docs/`.

## Global Constraints

- Node ≥ 22, moduli ES, nessuna dipendenza nuova (solo `ws` e `tiktok-live-connector`); le pagine restano senza build; Playwright serve solo agli strumenti e non fa parte di `npm test`.
- `npm test` (= `node --test`) resta verde dopo ogni task; un test che cambia comportamento di proposito si aggiorna nello stesso task e si cita nel messaggio di commit.
- Commit: oggetto in italiano che finisce con ` [skip netlify]`; trailer `Co-Authored-By: Claude <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01KknJSv8vijv85bNpvfWr5a`; nessun nome di modello in commit, codice o commenti. Branch `claude/practical-cannon-6wegnn`.
- Testi per l'utente ed errori in italiano, nello stile del progetto; commenti in italiano.
- Font: `--font-sistema: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "San Francisco", Inter, "Segoe UI", system-ui, sans-serif`; `--font-dati`, `--font-gotico`, `--font-premio` valgono `var(--font-sistema)`; nessun altro font negli overlay.
- Colori degli overlay: neutri (canale massimo meno minimo ≤ 10 su 255) più oro/bronzo (tinta 15°–60°), rosso (345°–15°) e smeraldo (135°–170°); la regia non cambia nei colori.
- Zona sicura 9:16: contenuti tra x 116 e 964 e y 282–1196 (la chat di TikTok parte da 1200); nessun testo sporge dal suo riquadro, al 100% e al 200%.
- Voto della gara: pesi `{ beat: 3, voce: 3, mix: 3, chat: 1 }` (30/30/30/10 %), range 4–10, etichette Beat/Voce/Mix/Chat; il Battle resta 0–10.
- Ogni comando controlla tutto su una copia e non cambia nulla se un valore è sbagliato; gli stati salvati si fondono campo per campo (`fondi*`), senza eccezioni.
- Eventi TikTok: schema installato (proto v3) con ripiego sui nomi del vecchio schema; eccezioni catturate; nessuna rete reale nei test.
- Gli strumenti Playwright girano solo su un server di prova con `OVERLAY_CONFIG` e `OVERLAY_DATI` temporanei (porta libera, es. 4799).

## Review Focus

Ingressi e condizioni che la spec implica e che i test «normali» non coprirebbero; ognuno ha il suo test nel task che lo possiede.

1. **Voto in chat ai bordi del range** (T4): «3», «3.9», «10.5», «!voto 3» e «0» ignorati; «4», «10», «9/10», «7,5» validi; un giudice che scrive 3 in regia riceve «Il voto deve essere tra 4 e 10».
2. **Stati e config scritti da versioni precedenti** (T5, T13, T20, T22, T25): un `config.json` copiato dal vecchio modello (pesi 1/1/1/1, senza `votoMin`) e uno `stato.json` senza `votazione`, `goal`, `etichette`, `scaletta`, `salvati`, `striscia`, `richieste` partono con i predefiniti nuovi (chat al 10%, 4–10), senza eccezioni e senza perdere i dati che c'erano.
3. **Goal** (T13): i like saltano più obiettivi in un colpo; passo 0; follower sconosciuti; `followCount` più basso del noto o non numerico; obiettivo e passo ai limiti.
4. **Regali** (T11, T12): una serie (`type 1`) senza `repeatEnd` non crea richieste; lo stesso donatore due volte crea due richieste; mappatura vuota, per nome senza maiuscole o per ID; coda oltre 30; regalo senza utente.
5. **Scheda «Ora in ascolto» fissa** (T18): spot mentre c'è la scheda, traccia nuova durante lo spot, scheda nascosta dalla regia e riaccesa, `schedaFissa: false` con i tempi per tipo.

---

### Task 1: Font di sistema negli overlay

**Files:**
- Create: `test/aspetto.test.mjs`
- Modify: `public/css/base.css`; `public/css/{overlay,senza-premio,studio,battle,battle-tabellone,battle-vittoria,formati,doppio,podcast,drum}.css`; le otto pagine overlay `public/{overlay,senza-premio,studio,battle,drum,produzione,reaction,podcast}.html`; gli script che impostano un font con nome proprio (`grep -rn "Barlow\|Grenze\|ctx.font" public/js`, esclusa la regia).

**Interfaces:**
- Produces: variabili CSS `--font-sistema`, `--font-dati`, `--font-gotico`, `--font-premio` (valori nei Global Constraints); in `test/aspetto.test.mjs` la funzione `fileOverlay() → [{ file, testo }]` (fogli, pagine e script degli overlay, esclusi `regia.css`, `regia.html` e `regia*.js`), riusata da T2.

- [ ] **Step 1: scrivi `test/aspetto.test.mjs`** con tre test: «gli overlay non usano font con nome proprio» (nessun `font-family` il cui valore non sia `var(--font-…)`, nessun `font:` o `ctx.font` con un nome tra virgolette o `Barlow`/`Grenze`/`Georgia`/`Arial`; il messaggio elenca file e riga), «le pagine overlay caricano Inter e non Barlow né Grenze», «base.css definisce `--font-sistema` con `-apple-system`, `"SF Pro Display"`, `Inter` e `sans-serif`, e le altre tre variabili puntano a `var(--font-sistema)`».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/aspetto.test.mjs`. Expected: 3 test FAIL, con l'elenco dei file da correggere.
- [ ] **Step 3: implementa.** In `base.css` definisci le quattro variabili al posto delle vecchie `--font-gotico`/`--font-dati`; nei fogli sostituisci ogni famiglia con `var(--font-dati)` (i punti gotici con `var(--font-gotico)`; il testo del premio e le righe della classifica in `overlay.css` con `var(--font-premio)`); nelle otto pagine il link di Google Fonts carica solo `Inter:wght@500;600;700;800;900`; gli script con canvas leggono la famiglia da `getComputedStyle(document.body).fontFamily`.
- [ ] **Step 4: vedi passare.** Run: `node --test test/aspetto.test.mjs` (Expected: 3 pass), poi `npm test` (Expected: tutti verdi). Gli strumenti dei pixel possono ora segnalare testi tagliati: i corpi si riassestano nei task dei singoli layout e in T27.
- [ ] **Step 5: commit** «Font: San Francisco su tutti gli overlay, Inter come ripiego [skip netlify]».

### Task 2: Palette neutra

**Files:**
- Modify: `test/aspetto.test.mjs`; `public/css/base.css`; tutti i fogli, le pagine (compresi gli `stop-color` degli SVG) e gli script degli overlay con colori scritti (`drum-clessidra.js`, `drum-eq.js`, `drum-sblocco.js`, `overlay.js`, `battle.js`…).
- Create (non versionato, nello scratchpad): `neutralizza-colori.mjs`.

**Interfaces:**
- Consumes: `fileOverlay()` (T1).
- Produces: `coloreAmmesso(r, g, b) → boolean` in `test/aspetto.test.mjs`; variabili `--accento` (grigio chiaro), `--accento-forte` (bianco), `--smeraldo`, `--grigio-0 … --grigio-100`; spariscono `--viola`, `--viola-chiaro`, `--magenta`, `--ciano`, `--blu` e il verde diverso dallo smeraldo; nel Battle `--bt-sx` è bianco e `--bt-dx` grigio medio.

- [ ] **Step 1: scrivi i test.** «coloreAmmesso: rifiuta `#a066ff`, `#ff4fd8`, `#36dcff`, `#150c28`; accetta `#5c3a00`, `#ffd863`, `#ff3046`, `#14a36f`, `#ffffff`, `#0b0b0c`, `rgba(255,255,255,.2)`» e «ogni colore scritto negli overlay è neutro o oro/bronzo, rosso, smeraldo» (esadecimali a 3/4/6/8 cifre, `rgb()`, `rgba()`, `hsl()`, `hsla()`; il messaggio dà file, riga e colore). Oro/bronzo: tinta 15°–60° e saturazione HSL ≥ 0,2; rosso 345°–15°; smeraldo 135°–170°.
- [ ] **Step 2: vedi fallire.** Run: `node --test test/aspetto.test.mjs`. Expected: il primo test passa, il secondo FAIL con circa 600 violazioni (viola, magenta, ciano, blu e neri tinti).
- [ ] **Step 3: implementa.** Scrivi `neutralizza-colori.mjs` (scratchpad): per ogni colore con tinta fuori dalle famiglie ammesse produce il grigio neutro con la stessa luminosità HSL (sotto il 9% di luminosità `#0b0b0c`), e sostituisce `var(--viola…)`, `var(--magenta)`, `var(--ciano)`, `var(--blu)` con le nuove variabili. Poi a mano: `--bt-sx`/`--bt-dx`, gli sfondi di `body.anteprima` e dell'orizzontale della reaction (riflessi viola → neri neutri), i gradienti che con il grigio diventano piatti (alza o abbassa la luminosità di un estremo dell'8%), aloni e ombre neon (bianchi o grigi). Cromo, `--podio-*` e `--oro-testo` restano.
- [ ] **Step 4: vedi passare.** Run: `node --test test/aspetto.test.mjs` (Expected: tutti pass) e `npm test` (Expected: verdi).
- [ ] **Step 5: controllo a occhio.** Rigenera uno screenshot di ogni pagina (`?anteprima=1&statico=1`; per gli strumenti: `node strumenti/mockup-battle.mjs --base http://127.0.0.1:4799 --fase battle`, `node strumenti/mockup-formati.mjs --base … --layout drum`) e verifica che il testo si legga sul vetro grigio e che non resti nessuna dominante viola. Correggi i contrasti scarsi e ripeti Step 4.
- [ ] **Step 6: commit** «Palette: scala di grigi con oro, rosso e smeraldo, e test sui colori [skip netlify]».

### Task 3: Battle — «Voto Chat»

**Files:**
- Modify: `public/battle.html` (badge riga 68 e commento riga 64), `README.md` (tabella delle posizioni del Battle), `test/aspetto.test.mjs`.

**Interfaces:** nessuna nuova.

- [ ] **Step 1: scrivi il test** «il badge delle barre del Battle dice «Voto Chat»»: `public/battle.html` contiene `<span>Voto</span><span>Chat</span>` e nessun «Votes»; il README non contiene «CHAT VOTES».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/aspetto.test.mjs`. Expected: 1 FAIL.
- [ ] **Step 3: implementa** il cambio nel badge, nei commenti e nel README.
- [ ] **Step 4: vedi passare.** Run: `node --test test/aspetto.test.mjs`. Expected: pass.
- [ ] **Step 5: commit** «Battle: «Voto Chat» al posto di «Chat Votes» [skip netlify]».

### Task 4: Voti da 4 a 10 (funzioni pure)

**Files:**
- Modify: `lib/validazione.mjs` (`normalizzaVoto`), `lib/chat.mjs` (`leggiVoto`).
- Create: `test/votazione.test.mjs`. Modify: `test/integrazioni.test.mjs` (un caso).

**Interfaces:**
- Produces: `normalizzaVoto(valore, { min = 0, max = 10 } = {}) → number|null` (errore «Il voto deve essere tra ${min} e ${max}»); `leggiVoto(testo, { min = 0, max = 10 } = {}) → number|null`. Senza opzioni il comportamento di oggi (0–10) resta, per il Battle e per i vecchi usi.

- [ ] **Step 1: scrivi i test** in `test/votazione.test.mjs`: «leggiVoto 4–10 accetta 4, 4.5, 10, «9/10», «7,5», «!voto 8» e ignora 3, 3.9, 10.5, «!voto 3», «0»» (con `{ min: 4, max: 10 }`); «leggiVoto senza opzioni resta 0–10»; «normalizzaVoto 4–10: 3.9 lancia «Il voto deve essere tra 4 e 10», 4 e 10 passano, vuoto → null, «9,5» → 9.5»; «normalizzaVoto senza opzioni resta 0–10».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/votazione.test.mjs`. Expected: i test 4–10 FAIL (3 accettato), gli altri pass.
- [ ] **Step 3: implementa** le due funzioni con i parametri `min` e `max` (il controllo di `max` e l'arrotondamento a un decimale restano).
- [ ] **Step 4: vedi passare.** Run: `node --test test/votazione.test.mjs test/integrazioni.test.mjs`. Expected: tutti pass.
- [ ] **Step 5: commit** «Voti: intervallo configurabile in leggiVoto e normalizzaVoto [skip netlify]».

### Task 5: Votazione della gara (pesi, range, etichette), comando e config

**Files:**
- Modify: `lib/stato.mjs`, `server.mjs`, `config.esempio.json`, `test/stato.test.mjs` (dove i test contano sui pesi uguali).
- Create: `test/votazione-server.test.mjs`. Modify: `test/votazione.test.mjs`.

**Interfaces:**
- Consumes: `normalizzaVoto`, `leggiVoto` (T4).
- Produces: `votazioneIniziale(config) → { pesi: { beat, voce, mix, chat }, min, max, etichette: { beat, voce, mix, chat } }` (da `config.pesi`, `config.votoMin`, `config.votoMax`, `config.etichette`; predefiniti 3/3/3/1, 4, 10, Beat/Voce/Mix/Chat); `impostaVotazione(stato, { pesi?, min?, max?, etichette? })` (pesi interi 0–100 con almeno uno > 0; min e max interi 0–10 con min < max; etichette da 1 a 12 caratteri; tutto su una copia); `fondiVotazione(salvato, config) → votazione`; `stato.votazione` in `statoIniziale`, in `istantanea` (campo `votazione`) e conservato da `nuovaSerata` e `demo`; `punteggi`, `conferma`, `impostaVoto` leggono `stato.votazione`; comando `votazione`; `config.esempio.json` con `pesi {3,3,3,1}`, `votoMin 4`, `votoMax 10`, `etichette`. In `caricaConfig` un `pesi` identico al vecchio modello (1/1/1/1) vale «non impostato» e `etichette` si fonde campo per campo come `giudici`.

- [ ] **Step 1: scrivi i test** (`test/votazione.test.mjs`, `test/votazione-server.test.mjs` con `avviaServer`): «votazione iniziale: pesi 3/3/3/1, 4–10, etichette di partenza»; «punteggi 30/30/30/10: voti 8, 8, 8 e chat 4 → totale 7,6»; «impostaVoto usa il range: 3 → errore, 4 ok»; «impostaVotazione: pesi, range e etichette validi; errori in italiano e niente cambia se un valore è sbagliato (min ≥ max, tutti i pesi a 0, etichetta vuota o di 13 caratteri)»; «fondiVotazione: stato senza `votazione` o con valori rotti → predefiniti campo per campo»; e2e: «`POST /api/votazione` cambia range e pesi e `GET /api/stato` li mostra»; «un commento «3» non vota e «5» sì con il voto chat aperto (`apriChat`, `messaggioChat`)»; «un `config.json` con i vecchi pesi 1/1/1/1 parte con 3/3/3/1, uno con pesi scelti a mano (2/2/2/1) li tiene»; «un `stato.json` senza `votazione` parte con i predefiniti».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/votazione.test.mjs test/votazione-server.test.mjs`. Expected: FAIL (funzioni e comando mancanti).
- [ ] **Step 3: implementa** in `lib/stato.mjs` e `server.mjs`; `registraCommento` passa `{ min, max }` a `leggiVoto`; `caricaStato` fonde `votazione` con `fondiVotazione`; aggiorna i test di `test/stato.test.mjs` che davano per scontati i pesi uguali o voti sotto il minimo (elencali nel commit).
- [ ] **Step 4: vedi passare.** Run: `npm test`. Expected: tutti verdi.
- [ ] **Step 5: commit** «Gara: voti 4–10, chat al 10%, etichette e comando votazione [skip netlify]».

### Task 6: Gara in pagina e in regia — etichette, intervallo, pesi

**Files:**
- Create: `public/js/votazione-logica.js`, `public/js/regia-voti.js`.
- Modify: `public/js/overlay.js`, `public/js/regia.js`, `public/regia.html` (Serata → Voti), `test/votazione.test.mjs`.

**Interfaces:**
- Consumes: `istantanea.votazione`, comando `votazione` (T5).
- Produces: `percentualiPesi(pesi) → { beat, voce, mix, chat }` (interi che sommano sempre 100, resto assegnato al più grande); in pagina i nomi delle quattro voci da `votazione.etichette`, il testo «Vota in chat da **min** a **max**» da `votazione.min/max`; in regia, *Serata → Voti*: quattro pesi con la percentuale accanto, min e max, quattro etichette, *Salva voti* (errori nell'avviso della regia).

- [ ] **Step 1: scrivi il test** «percentualiPesi: 3/3/3/1 → 30/30/30/10; 1/1/1/0 → somma 100; tutti 0 → tutti 0».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/votazione.test.mjs`. Expected: FAIL (modulo mancante).
- [ ] **Step 3: implementa** `votazione-logica.js`, la pagina (`overlay.js`: `.cat-nome` e `.cta-testo b` aggiornati a ogni stato) e la sezione di regia (`regia-voti.js` importato da `regia.js`; i campi in uso non si riscrivono).
- [ ] **Step 4: vedi passare e verifica nel browser.** Run: `npm test` (Expected: verdi); poi su un server di prova apri `/overlay.html?anteprima=1&statico=1`, dai `votazione {"min":5,"etichette":{"beat":"Base"}}` e controlla a occhio che la barra dica «da 5 a 10» e il rettangolo «Base».
- [ ] **Step 5: commit** «Gara: etichette, intervallo e pesi dei voti in pagina e in regia [skip netlify]».

### Task 7: Blocco voti sopra i commenti e strumento di controllo dei layout

**Files:**
- Create: `strumenti/mockup-layout.mjs` (autonomo: tabella di geometria, controllo ±1 px, nessuna sovrapposizione tra pezzi dichiarati, controllo dei pixel delle lettere tagliate con una copia delle funzioni di `mockup-formati.mjs`, `--layout gara|senzaPremio|studio`, `--stato`, `--controlli`; salva `mockup/<nome>.jpg`), `test/geometria.test.mjs`.
- Modify: `public/css/overlay.css` (variabili del blocco voti e interno del tabellone). I pezzi si misurano con i selettori che ci sono già (`.premio`, `.classifica`, `.timer`, `.tabellone`, `.chat-cta`).

**Interfaces:**
- Produces: nel CSS `.verticale .palco`: `--y-tabellone: 858px; --h-tabellone: 260px; --y-chat: 1130px; --h-chat: 66px` (fondo della barra = 1196); `strumenti/mockup-layout.mjs` con `GEOMETRIA` per `gara` (premio, classifica, timer, tabellone, chat, goal in seguito), riusata da T8, T10, T16, T18, T19.

- [ ] **Step 1: scrivi `test/geometria.test.mjs`** che legge le variabili di `public/css/overlay.css` e verifica: `--y-chat` + `--h-chat` = 1196; `--y-tabellone` ≥ `--y-colonne` + `--h-classifica` + 12 (858); `--y-chat` ≥ `--y-tabellone` + `--h-tabellone` + 12; premio e classifica invariati (`--y-premio` 282, `--h-premio` 156, `--y-colonne` 454, `--h-classifica` 392, `--h-timer` 132).
- [ ] **Step 2: vedi fallire.** Run: `node --test test/geometria.test.mjs`. Expected: FAIL (i valori di oggi sono 1236/282 e 1530/78).
- [ ] **Step 3: implementa** i nuovi valori e ricomponi l'interno del tabellone sull'altezza di 260 (titolo, totale, quattro rettangoli); scrivi `mockup-layout.mjs` con la tabella della gara.
- [ ] **Step 4: vedi passare e controlla nel browser.** Run: `node --test test/geometria.test.mjs` (Expected: pass), poi `node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout gara` (Expected: nessun problema; `mockup/verticale.jpg` rigenerato: il blocco voti finisce a 1196 senza toccare la classifica).
- [ ] **Step 5: commit** «Gara: blocco voti sopra i commenti e strumento di controllo dei layout [skip netlify]».

### Task 8: Classifica e tabellone della gara — testi al massimo

**Files:**
- Modify: `public/css/overlay.css`, `public/js/overlay.js` (usa `adattaTesto` di `pagina.js` su titolo, artista, punteggio e nomi delle categorie), `strumenti/mockup-layout.mjs` (`--controlli` per la gara).

**Interfaces:**
- Consumes: `adattaTesto(el, massimo, minimo)` (`public/js/pagina.js`), `--font-premio` (T1).
- Produces: corpi di partenza più grandi per le righe della classifica, il titolo del tabellone e le categorie, ognuno con un minimo; il controllo `--controlli` della gara: titolo di traccia da 60 caratteri, artista da 40, nomi lunghi in classifica → nessuna lettera tagliata (pixel) e niente fuori dal riquadro.

- [ ] **Step 1: scrivi il controllo** in `mockup-layout.mjs --layout gara --controlli`: con `traccia` e risultati di prova lunghi (comandi `traccia`, `demo`) misura, per le righe `.cl-traccia-testo`, `.cl-artista`, `.cl-punti`, `.tab-titolo`, `.tab-artista`, `.cat-nome`, che l'inchiostro non sia tagliato e che il testo stia nel riquadro.
- [ ] **Step 2: vedi fallire.** Run: `node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout gara --controlli`. Expected: problemi elencati (con il nuovo font le righe di oggi sporgono o restano piccole).
- [ ] **Step 3: implementa:** alza i corpi di base, chiama `adattaTesto` con massimo e minimo per ogni riga a ogni disegno e dopo `document.fonts.ready`.
- [ ] **Step 4: vedi passare.** Run: lo stesso comando. Expected: nessun problema; `mockup/verticale.jpg` e `mockup/ultimi-minuti.jpg` rigenerati e controllati a occhio.
- [ ] **Step 5: commit** «Gara: classifica e tabellone con i testi al massimo che entra [skip netlify]».

### Task 9: Albero del tabellone (logica)

**Files:**
- Create: `lib/albero.mjs`, `test/albero.test.mjs`.

**Interfaces:**
- Produces: `costruisciAlbero(risultati, { massimo = 16 } = {}) → null | { dimensione, turni, esclusi }`, con `turni: [{ nome, partite: [{ a, b, vince }] }]`, ogni lato `{ id, titolo, artista, totale, posto } | null`, `vince: "a" | "b" | null`. `risultati` è `stato.risultati`. Ordine come `confronta` di `lib/stato.mjs` (totale decrescente, poi `confermatoAlle` crescente). Nomi dei turni: «Ottavi di finale» (16), «Quarti di finale» (8), «Semifinali» (4), «Finale» (2).

- [ ] **Step 1: scrivi i test:** «meno di 2 risultati → null»; «4 risultati: dimensione 4, turni Semifinali (1° contro 4°, 2° contro 3°) e Finale; vince il totale più alto e la finale è tra i vincitori»; «5 risultati: dimensione 8, i posti 6, 7 e 8 vuoti danno il passaggio alle teste 3, 2 e 1 (`b: null`, `vince: "a"`)»; «16 risultati: ottavi 1-16, 8-9, 4-13, 5-12, 2-15, 7-10, 3-14, 6-11»; «20 risultati: `esclusi` 4 e l'albero dei primi 16»; «pari merito: passa chi è stato confermato prima»; «non modifica l'elenco ricevuto e dà sempre lo stesso risultato».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/albero.test.mjs`. Expected: FAIL (modulo mancante).
- [ ] **Step 3: implementa** `costruisciAlbero` (ordine delle teste ricorsivo: per 2 → [1, 2]; per 2n → per ogni testa s dell'ordine di n, [s, 2n + 1 − s]).
- [ ] **Step 4: vedi passare.** Run: `node --test test/albero.test.mjs`. Expected: pass.
- [ ] **Step 5: commit** «Gara: costruzione del tabellone ad albero dalla classifica [skip netlify]».

### Task 10: Tabellone ad albero — stato, comando, pagina e regia

**Files:**
- Create: `public/js/albero.js`, `public/css/albero.css`.
- Modify: `lib/stato.mjs`, `server.mjs`, `public/overlay.html`, `public/js/overlay.js` (aggiungi `albero` alla lista predefinita di `?w=`), `public/regia.html`, `public/js/regia-voti.js`, `strumenti/mockup-layout.mjs`, `test/albero.test.mjs`.

**Interfaces:**
- Consumes: `costruisciAlbero` (T9).
- Produces: widget `albero` in `WIDGET` e in `WIDGET_SPENTI`; `stato.albero = { durataSecondi: 30, finoAlle: null }`; `mostraAlbero(stato, { durataSecondi? }, ora)`, `nascondiAlbero(stato)`, `chiudiAlberoSeScaduto(stato, ora) → boolean` (chiamata nel giro periodico di `server.mjs` accanto a `chiudiChatSeScaduta`); comando `albero { durataSecondi?, mostra? }` (durata 0–600, 0 = resta); `istantanea.albero`; `disegnaAlbero(radice, albero)` in `public/js/albero.js` (SVG/DOM, rami in orizzontale, turni a fasi da 0,5 s, vincitore del turno in oro, trofeo in finale, nota «+N» per gli esclusi); riquadro `data-parte="albero"` da x 116, y 282, 848 × 914, sopra tutto il resto.

- [ ] **Step 1: scrivi i test:** «mostraAlbero accende il widget e imposta `finoAlle` = ora + durata (null con durata 0)»; «chiudiAlberoSeScaduto lo spegne alla scadenza e solo allora»; «il comando `albero` con durata 31 s accende, con `mostra: false` spegne; durata 601 → errore»; e2e: «con `albero {durataSecondi:1, mostra:true}` il widget si spegne da solo entro 2,5 s»; «il widget parte spento».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/albero.test.mjs`. Expected: FAIL.
- [ ] **Step 3: implementa** stato, comando, giro periodico, `albero.js`/`albero.css`, innesto in `overlay.html` e `overlay.js`, pulsante *Mostra tabellone ad albero* e campo durata in regia; in `mockup-layout.mjs` lo stato `albero` (dati: `demo` con 6 e con 16 risultati).
- [ ] **Step 4: vedi passare e controlla.** Run: `npm test` (Expected: verdi); `node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout gara --stato albero` (Expected: riquadro dentro x 116–964 e y 282–1196, nessuna lettera tagliata con 16 partecipanti; mockup `gara-albero.jpg`).
- [ ] **Step 5: commit** «Gara: tabellone ad albero in pagina e in regia [skip netlify]».

### Task 11: Eventi TikTok — regalo e follow (lettura)

**Files:**
- Modify: `lib/chat.mjs`, `test/integrazioni.test.mjs`.

**Interfaces:**
- Produces: `regaloTikTok(dati) → { utente, nome, id, quantita } | null` (campi v3: `gift.name`, `gift.type`, `giftId`, `repeatCount`, `repeatEnd`, `user.displayId`; ripiego: `giftDetails.giftName`, `giftType`, `user.uniqueId`; una serie — tipo 1 — conta solo a `repeatEnd` vero con `quantita = repeatCount`, gli altri subito con `max(1, repeatCount)`; senza nome e ID, o senza utente → `null`); `followTikTok(dati) → { utente, totale } | null` (`user.displayId`/`uniqueId`, `followCount` di sole cifre 1–15, altrimenti `totale: null`); `avviaTikTok(…, { suLike, suNuovaConnessione, suRegalo, suFollow })` registra `WebcastEvent.GIFT` e `WebcastEvent.FOLLOW` con le stesse protezioni di `suLike`.

- [ ] **Step 1: scrivi i test** con messaggi scritti e riletti con lo schema vero (`WebcastGiftMessage`, `WebcastSocialMessage` da `tiktok-live-proto/v3`, come `likeSulFilo`): «regalo: legge il messaggio vero»; «regalo: una serie conta solo a repeatEnd, con la quantità; un regalo non a serie conta subito»; «regalo: ripiego sui nomi del vecchio schema»; «regalo: senza nome e ID o senza utente → null»; «follow: utente e `followCount`»; «follow: `followCount` non numerico o di 16 cifre → totale null»; «il connettore consegna regalo e follow come li legge il parser» (`processDecodedData` con `common.displayText.key` che contiene `follow`).
- [ ] **Step 2: vedi fallire.** Run: `node --test test/integrazioni.test.mjs`. Expected: FAIL (funzioni mancanti).
- [ ] **Step 3: implementa** le due funzioni e i due ascoltatori in `avviaTikTok`.
- [ ] **Step 4: vedi passare.** Run: `node --test test/integrazioni.test.mjs`. Expected: pass.
- [ ] **Step 5: commit** «TikTok: lettura di regali e follow dagli eventi della libreria [skip netlify]».

### Task 12: Regali visti e richieste (`lib/regali.mjs`)

**Files:**
- Create: `lib/regali.mjs`, `test/regali.test.mjs`.

**Interfaces:**
- Consumes: la forma `{ utente, nome, id, quantita }` di `regaloTikTok` (T11).
- Produces: `regaloCorrisponde({ nome, id }, mappatura) → boolean` (mappatura vuota → false; di sole cifre → confronto con l'ID; altrimenti nome senza maiuscole); `registraVisto(visti, regalo, ora) → visti` (ultimi 12 per nome e ID distinti, il più recente in cima, con l'ultimo utente); `richiesteIniziali() → { regalo: "", coda: [] }`; `aggiungiRichiesta(richieste, regalo, ora) → richiesta | null` (se `regaloCorrisponde(regalo, richieste.regalo)`; `{ id, utente, nome, quantita, alle, stato: "attesa", brano: null }`, massimo 30, le più vecchie escono); `segnaRichiesta(richieste, { id, azione, brano? })` con `azione` `"inOnda"` (una sola alla volta, le altre tornano in attesa; `brano { titolo ≤ 60, artista ≤ 40 }` obbligatorio con titolo), `"fatta"`, `"scarta"` (la toglie); `controllaRichieste(salvato) → richieste` (fusione senza eccezioni).

- [ ] **Step 1: scrivi i test:** «mappatura vuota non fa partire richieste»; «per nome senza maiuscole («rose» = «Rose») e per ID («5655»)»; «lo stesso donatore due volte = due richieste»; «oltre 30 escono le più vecchie»; «inOnda: una sola alla volta, serve un titolo, errori in italiano»; «fatta e scarta»; «regali visti: ultimi 12 distinti, il più recente in cima»; «controllaRichieste: dati rotti → richieste vuote, valide tenute».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/regali.test.mjs`. Expected: FAIL (modulo mancante).
- [ ] **Step 3: implementa** il modulo (funzioni pure, errori con `testo()` di `validazione.mjs`).
- [ ] **Step 4: vedi passare.** Run: `node --test test/regali.test.mjs`. Expected: pass.
- [ ] **Step 5: commit** «Regali: corrispondenza, regali visti e coda delle richieste [skip netlify]».

### Task 13: Obiettivi Goal (`lib/goal.mjs`)

**Files:**
- Create: `lib/goal.mjs`, `test/goal.test.mjs`.

**Interfaces:**
- Consumes: `numeroTra`, `oggetto`, `corpo` (`lib/validazione.mjs`).
- Produces: `LAYOUT_GOAL = ["gara", "senzaPremio", "studio", "battle", "drum", "produzione", "podcast", "podcastO", "reaction", "reactionO"]`; `goalIniziale() → { like: { obiettivo: 15000, passo: 1000 }, follower: { obiettivo: 50, passo: 10, totale: null }, modo: "fisso", ogniMinuti: 5, durataSecondi: 15, posizioni: {} }`; `obiettivoAttuale(totale, obiettivo, passo) → number`; `mancano(totale, obiettivo, passo) → number | null`; `registraFollow(stato, { totale }) ` (aggiorna `stato.goal.follower.totale`: `totale` maggiore del noto → vale; altrimenti, se noto, +1; sconosciuto e senza totale → resta null); `impostaGoal(stato, dati)` (campi della spec §14: obiettivo 1–10.000.000.000, passo 0–1.000.000, `imposta` 0–10.000.000.000, `aggiungi` ±1.000.000, modo `fisso|comparsa`, ogniMinuti 1–60, durataSecondi 5–120, `posizione { layout, x 0–1920, y 0–1920, scala 60–200, ripristina }`); `fondiGoal(salvato) → goal`; `istantaneaGoal(stato) → goal con like.totale = contati(stato.drum) e follower.totale`.

- [ ] **Step 1: scrivi i test:** «obiettivoAttuale: sotto il totale resta quello scelto; raggiunto, passa al primo multiplo del passo maggiore del totale»; «il totale salta più obiettivi (14.900 → 31.200, passo 1.000) → 32.000»; «passo 0: resta l'obiettivo e `mancano` 0»; «mancano non scende sotto 1 con passo > 0, è null con totale sconosciuto»; «registraFollow: +1 se noto, `totale` più alto vale, più basso o non numerico no, sconosciuto resta null»; «impostaGoal: limiti ai bordi (obiettivo 1 e 10.000.000.000 ok, 0 errore; passo 0 e 1.000.000 ok), errori in italiano, niente cambia se un valore è sbagliato»; «posizione: layout sconosciuto → errore; `ripristina` toglie solo quel layout»; «fondiGoal: stato vecchio o rotto → predefiniti campo per campo»; «istantaneaGoal usa i like contati dal Drum».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/goal.test.mjs`. Expected: FAIL (modulo mancante).
- [ ] **Step 3: implementa** il modulo.
- [ ] **Step 4: vedi passare.** Run: `node --test test/goal.test.mjs`. Expected: pass.
- [ ] **Step 5: commit** «Goal: calcolo dell'obiettivo, follower e posizioni [skip netlify]».

### Task 14: Server — Goal, follow e regali visti

**Files:**
- Modify: `lib/stato.mjs` (`statoIniziale`, `istantanea`, `WIDGET` con `goal`), `server.mjs`, `test/goal.test.mjs`; Create: `test/goal-server.test.mjs`.

**Interfaces:**
- Consumes: T11, T12, T13.
- Produces: `stato.goal`, `stato.regaliVisti` (salvati, fusi in `caricaStato` con `fondiGoal` e un controllo dell'elenco; `nuovaSerata` e `demo` conservano `goal` e `regaliVisti`); `collegaTikTok` passa `suRegalo` (aggiorna `regaliVisti`; i layout con una coda di richieste la usano da T20/T22) e `suFollow` (`registraFollow`); comandi `goal`, `goalMostra` (emette l'evento `goalMostra`), `regaloEvento { nome, id?, utente, quantita? }`, `followEvento { utente, totale? }`; `istantanea.goal` = `istantaneaGoal(stato)`, `istantanea.regaliVisti`; il widget `goal` parte acceso.

- [ ] **Step 1: scrivi i test e2e:** «`goal` cambia obiettivo e passo e `GET /api/stato` mostra `mancano` coerenti con i Like di `likeEvento`»; «`followEvento` somma, `followEvento` con totale 1.250 lo imposta, un totale più basso no»; «`regaloEvento` finisce in `regaliVisti` (il più recente in cima)»; «un errore non cambia niente (obiettivo 0)»; «nuova serata e demo conservano obiettivi e posizioni»; «uno stato senza `goal` parte con i predefiniti».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/goal-server.test.mjs`. Expected: FAIL (comandi sconosciuti).
- [ ] **Step 3: implementa** stato, istantanea, comandi e collegamento TikTok.
- [ ] **Step 4: vedi passare.** Run: `npm test`. Expected: verdi.
- [ ] **Step 5: commit** «Goal: stato, comandi e collegamento di follow e regali [skip netlify]».

### Task 15: Widget Goal — componente e quattro layout nuovi

**Files:**
- Create: `public/js/goal-logica.js`, `public/js/goal.js`, `public/css/goal.css`, `test/goal-logica.test.mjs`.
- Modify: `public/{drum,produzione,reaction,podcast}.html` (link a `goal.css`, `<section data-parte="goal">`), `public/js/{drum,doppio,podcast}.js` (`creaGoal` e `goal.aggiorna(s)`), `strumenti/mockup-formati.mjs` (voce `goal` nella `GEOMETRIA` e controllo di non sovrapposizione).

**Interfaces:**
- Consumes: `istantanea.goal`, `visibili.goal` (T14), evento `goalMostra`.
- Produces: in `goal-logica.js`: `testiGoal(goal) → { like: string | null, follower: string | null }` («Mancano 1.250 like al nuovo obiettivo», «Mancano 12 follower al nuovo obiettivo»; `null` con totale sconosciuto), `chiaveGoal(layout, orizzontale) → string` (es. `reactionO`), `POSIZIONI_GOAL` di partenza (gara x 564 y 712; senzaPremio 116, 650; studio 116, 290; battle 116, 672; drum 128, 1016; produzione e reaction 116, 1076; podcast 116, 960; podcastO 1400, 36; reactionO 1584, 40 con scala 0,75; larghezza 400, altezza ~120), `posizioneGoal(goal, chiave) → { x, y, scala }` (con la tela come limite: il widget non esce mai), `goalVisibile({ modo, ogniMinuti, durataSecondi }, acceso, ora, ultimaComparsaAlle, mostraOraAlle) → boolean`; in `goal.js`: `creaGoal({ palco, chiave, statico }) → { aggiorna(stato, eventi) }`.

- [ ] **Step 1: scrivi i test** in `test/goal-logica.test.mjs`: «testiGoal con i numeri e il punto delle migliaia; follower sconosciuti → null»; «posizioneGoal: ogni chiave di `LAYOUT_GOAL` ha una posizione di partenza dentro la tela; una posizione salvata vince; con scala 200 e x vicino al bordo il widget resta dentro la tela»; «goalVisibile: fisso → acceso; a comparsa → visibile `durataSecondi` ogni `ogniMinuti` e `mostraOra` lo fa comparire; spento → mai».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/goal-logica.test.mjs`. Expected: FAIL (modulo mancante).
- [ ] **Step 3: implementa** logica, componente (vetro neutro, numeri grandi, scatto al cambio, `translate` sulla tela scalata) e l'innesto nelle quattro pagine; aggiungi `goal` alla `GEOMETRIA` dei quattro layout (voce `goal: p(x, y, 400, 120, true)` per ogni formato).
- [ ] **Step 4: vedi passare e controlla.** Run: `npm test` (Expected: verdi); `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout drum` e gli altri tre layout, anche `--formato orizzontale` (Expected: il Goal sta dove dice la tabella e non si sovrappone a nessun altro pezzo; mockup rigenerati).
- [ ] **Step 5: commit** «Goal: widget nei layout Drum, Studio Production, Podcast e Reaction [skip netlify]».

### Task 16: Widget Goal — gara, senza premio, studio, Battle e regia

**Files:**
- Modify: `public/{overlay,senza-premio,studio,battle}.html` (link a `goal.css`, `<section data-parte="goal">`; per `overlay.js` e `battle.js` il nome non si chiama `data-widget`, così `?w=` non lo nasconde), `public/js/{overlay,senza-premio,studio,battle}.js`, `public/regia.html`, `public/js/regia.js`; Create: `public/js/regia-goal.js`; Modify: `strumenti/mockup-layout.mjs`, `strumenti/mockup-battle.mjs` (geometria del Goal).

**Interfaces:**
- Consumes: `creaGoal`, `posizioneGoal`, `chiaveGoal` (T15).
- Produces: il Goal in tutte le pagine; sezione di regia «Goal Like e Follower» (sopra le sezioni dei layout): obiettivo e passo per like e follower, follower di adesso (imposta, +1, +10), modo fisso o a comparsa con le due durate, *Mostra ora*, posizione del layout in onda (X, Y, scala, frecce da 8 px, *Ripristina posizione*), anteprima dei due testi e avviso «Imposta i follower di adesso» se sconosciuti; interruttore `goal` in *In onda*.

- [ ] **Step 1: scrivi il controllo di geometria:** voce `goal` nelle tabelle di `mockup-layout.mjs` (gara, senzaPremio, studio) e di `mockup-battle.mjs`, con il controllo di non sovrapposizione a ogni altro pezzo dichiarato; per la regia, un caso in `mockup-layout.mjs --regia-goal` (obiettivo, follower di adesso, posizione, *Mostra ora*).
- [ ] **Step 2: vedi fallire.** Run: `node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout gara`. Expected: problema «goal assente».
- [ ] **Step 3: implementa** l'innesto nelle quattro pagine e la sezione di regia (`regia-goal.js` importato da `regia.js`; i campi in uso non si riscrivono).
- [ ] **Step 4: vedi passare.** Run: i controlli di gara, senzaPremio, studio, `mockup-battle.mjs --fase battle` e `--regia-goal` (Expected: nessun problema; mockup rigenerati), poi `npm test` (Expected: verdi).
- [ ] **Step 5: commit** «Goal: widget nei layout gara, senza premio, studio e Battle e sezione di regia [skip netlify]».

### Task 17: Senza premio — stato, Instagram e Nero

**Files:**
- Modify: `lib/stato.mjs`, `lib/nero.mjs`, `server.mjs`, `test/senza-premio.test.mjs`, `test/integrazioni.test.mjs`.

**Interfaces:**
- Produces: `senzaPremio.schedaFissa = true` e `senzaPremio.etichette = { inAscolto: "Ora in ascolto", ascoltate: "Oggi abbiamo ascoltato", tracce: "tracce" }` (40 caratteri, non vuote), accettati da `impostaSenzaPremio` e fusi da `fondiSenzaPremio`; `stato.corrente.instagram` (stringa, vuota di partenza) in `tracciaVuota`, `istantanea.corrente.instagram` e nel comando `correggiTraccia { titolo?, artista?, instagram? }` (passa da `pulisciInstagram`; non azzera i voti; una traccia nuova la azzera); `instagramDaNero(oggetto) → string` in `lib/nero.mjs` (cerca `submitterInstagram`, `submitterInstagramHandle`, `instagram`, `submitter.instagram`, `submitter.socials.instagram`; non valido → `""`) usato da `tracciaInOnda` (campo `instagram`) e `versoCoda`; `tracciaDaNero` lo porta in `corrente`.

- [ ] **Step 1: scrivi i test:** «`instagramDaNero`: `@nome`, `nome`, link `instagram.com/nome/?hl=it` → `nome`; campo mancante, numero o testo con spazi → vuoto; i cinque nomi di campo»; «`tracciaInOnda` e `versoCoda` portano l'Instagram»; «una traccia nuova da Nero azzera l'Instagram scritto a mano; `correggiTraccia` con `instagram` lo imposta senza azzerare i voti»; «`senzaPremio`: `schedaFissa` vero di partenza, `etichette` modificabili (41 caratteri → errore), stato vecchio → predefiniti».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/senza-premio.test.mjs test/integrazioni.test.mjs`. Expected: FAIL.
- [ ] **Step 3: implementa** come da Interfaces.
- [ ] **Step 4: vedi passare.** Run: `npm test`. Expected: verdi.
- [ ] **Step 5: commit** «Senza premio: scheda fissa, etichette e Instagram dell'artista nello stato [skip netlify]».

### Task 18: Senza premio — scheda, spot dall'alto, colori, banner, artista

**Files:**
- Create: `public/js/scheda-logica.js`.
- Modify: `public/senza-premio.html`, `public/js/senza-premio.js`, `public/css/senza-premio.css`, `public/js/overlay.js` e `public/css/overlay.css` (la riga `@instagram` sotto l'artista nel tabellone della gara), `public/regia.html`, `public/js/regia.js` (In ascolto: Instagram dell'artista, «Scheda fissa», diciture), `test/senza-premio.test.mjs`, `strumenti/mockup-layout.mjs` (`--layout senzaPremio --scheda standard|skip|superskip|throne|studio`, `--layout gara --stato instagram`, `--controlli`).

**Interfaces:**
- Consumes: `schedaFissa`, `durate`, `etichette`, `corrente.instagram` (T17).
- Produces: in `scheda-logica.js` una funzione pura `prossimaScheda(stato, evento, ora, { schedaFissa, durate, durataSpotMs }) → { stato, azioni }` con eventi `traccia { id, tier, titolo, artista, instagram }`, `spot`, `scadenza`, `nascondi`, `mostra`, `uscita-finita` e azioni `entra-ascolto`, `entra-spot`, `esce`, `programma { quando }` (la pagina esegue le azioni con i timer); CSS: Gratis grigio, Skip sfondo smeraldo (`#0b6e4f → #14a36f`, testo bianco), Super Skip sfondo oro (`#fff1b8 → #f2b52a → #c98a0c`, testo nero), Throne cromo pieno con testo nero; lo spot entra dall'alto (0,6 s); banner con «Mandaci» e «La tua musica!» in San Francisco bianco molto più grandi e «Link in bio» bianco; nome dell'artista come riga principale della scheda (corpo massimo con `adattaTesto`), titolo sotto, `@instagram` con l'icona se c'è.

- [ ] **Step 1: scrivi i test** in `test/senza-premio.test.mjs`: «fissa: dopo una traccia nessuna scadenza»; «a tempo: scade dopo 8, 10, 12, 15 secondi per tipo»; «spot con scheda fissa: esce la traccia, entra lo spot per 10 secondi, poi rientra la traccia più recente»; «traccia nuova durante lo spot: dopo lo spot rientra la nuova»; «scheda nascosta dalla regia: nessuna entrata; riaccesa, rientra l'ultima traccia»; «uno spot senza una traccia in scheda entra subito e poi la scheda resta chiusa». Nel controllo del browser: il colore del testo calcolato è bianco per Skip e nero per Super Skip e Throne; con `corrente.instagram` impostato (comando `correggiTraccia`) il tabellone della gara mostra `@instagram` sotto l'artista, dentro il riquadro e senza lettere tagliate, e senza Instagram la riga non c'è.
- [ ] **Step 2: vedi fallire.** Run: `node --test test/senza-premio.test.mjs`. Expected: FAIL (modulo mancante).
- [ ] **Step 3: implementa** la macchina a stati e la pagina (sostituisce `mostraScheda`/`chiudiScheda`; `riempiScheda` mostra Instagram e adatta nome e titolo), il CSS dei quattro tipi e dello spot dall'alto, il banner, la regia (campo *Instagram dell'artista*, spunta *Scheda fissa*, tre diciture).
- [ ] **Step 4: vedi passare e controlla.** Run: `npm test` (Expected: verdi); `node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout senzaPremio --scheda skip` e gli altri quattro tipi, poi `--controlli` (Expected: nessuna lettera tagliata nel banner e nella scheda, scheda dentro la zona libera; mockup `senza-premio*.jpg` rigenerati e guardati).
- [ ] **Step 5: commit** «Senza premio: scheda fissa con colori per tipo, spot dall'alto, banner e artista in grande [skip netlify]».

### Task 19: Live session in studio

**Files:**
- Modify: `lib/stato.mjs` (`studio.etichette = { inStudio: "In studio ora" }`), `public/js/studio-logica.js`, `public/css/studio.css`, `public/js/studio.js`, `public/studio.html`, `public/regia.html`, `public/js/regia.js`, `test/studio.test.mjs`, `strumenti/mockup-layout.mjs`.

**Interfaces:**
- Produces: `impostaStudio` accetta `etichette: { inStudio }` (40 caratteri, non vuota) e `fondiStudio` lo ritrova; `vociStudio` usa `studio.etichette.inStudio`; la linguetta `.st-etichetta` ha corpo da ~34 px, testo bianco su cromo scuro, più larga e alta; le comparse (compreso «Scrivici in DM») usano `--font-dati` con corpi uguali o più grandi.

- [ ] **Step 1: scrivi i test:** «`etichette.inStudio` modificabile, 40 caratteri, non vuota»; «la voce «In studio ora» usa l'etichetta»; «uno stato studio senza `etichette` le ritrova»; nel controllo del browser: la linguetta ha il corpo calcolato ≥ 34 px e sta dentro la targa (rect), nessuna lettera tagliata.
- [ ] **Step 2: vedi fallire.** Run: `node --test test/studio.test.mjs`. Expected: FAIL.
- [ ] **Step 3: implementa** stato, logica, CSS e pagina; regia: campo *In studio ora*.
- [ ] **Step 4: vedi passare e controlla.** Run: `npm test` (Expected: verdi); `node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout studio --controlli` (Expected: nessun problema; `studio.jpg` e `studio-zone.jpg` rigenerati).
- [ ] **Step 5: commit** «Studio: intestazione grande, comparse in San Francisco e diciture modificabili [skip netlify]».

### Task 20: Reaction — stato, scaletta e richieste

**Files:**
- Modify: `lib/formati.mjs`, `lib/stato.mjs` (`WIDGET`: `reScaletta`, `reRichiesta`), `server.mjs`, `test/formati.test.mjs`, `test/formati-server.test.mjs`.

**Interfaces:**
- Consumes: `lib/regali.mjs` (T12), `suRegalo` e `regaliVisti` (T14).
- Produces: `reaction.scaletta = { titolo: "In scaletta stasera", voci: [], modo: "fisso", ogniMinuti: 5, durataSecondi: 15 }` (titolo 32, fino a 8 voci da 60, modo `fisso|comparsa`, 1–60 minuti, 5–120 secondi), `reaction.richieste = richiesteIniziali()` e `reaction.durataRichiesta = 10` (3–60); `impostaReaction` accetta `scaletta`, `regalo` (nome o ID, ≤ 40, vuoto = spente), `durataRichiesta`, e i limiti del titolo diventano 48/60/60; `fondiReaction` li ritrova campo per campo; comandi `scalettaMostra` (evento `scalettaMostra`) e `richiesta { formato, azione, id, brano? }` (per `reaction`; `drum` in T22); `suRegalo` aggiunge la richiesta della Reaction se il regalo corrisponde; `nuovaSerata` svuota la coda delle richieste e tiene scaletta e regalo; `istantanea.reaction` le include.

- [ ] **Step 1: scrivi i test:** «impostaReaction: scaletta con 9 voci → errore, 8 ok; voce da 61 caratteri → errore; modo sconosciuto → errore; niente cambia in caso d'errore»; «uno stato reaction senza `scaletta`, `richieste` o `durataRichiesta` li ritrova»; e2e: «con `regalo: "Rose"`, `regaloEvento { nome: "rose", utente: "mario" }` crea una richiesta in coda; con regalo vuoto no»; «`richiesta` `inOnda` con titolo la mette in onda, `fatta` la chiude, `scarta` la toglie»; «nuova serata svuota la coda e tiene scaletta e regalo»; «limiti nuovi del titolo: 48/60/60».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/formati.test.mjs test/formati-server.test.mjs`. Expected: FAIL.
- [ ] **Step 3: implementa** come da Interfaces.
- [ ] **Step 4: vedi passare.** Run: `npm test`. Expected: verdi.
- [ ] **Step 5: commit** «Reaction: scaletta e richieste con regalo nello stato [skip netlify]».

### Task 21: Reaction — pagina e regia

**Files:**
- Create: `public/js/regia-richieste.js` (blocco condiviso con T24: regalo, *Regali visti*, coda con *In onda*, *Fatta*, *Scarta*).
- Modify: `public/reaction.html`, `public/js/doppio.js`, `public/css/doppio.css`, `public/regia.html`, `public/js/regia-formati.js`, `strumenti/mockup-formati.mjs`, `test/formati-logica.test.mjs`.

**Interfaces:**
- Consumes: T20, evento `scalettaMostra`, `goalVisibile` (T15) per il modo a comparsa.
- Produces: pannello `data-parte="scaletta"` semitrasparente (fondo ~55%) con le voci numerate: verticale x 116, y 500, 848 × (titolo 56 + 8 × 52); orizzontale a destra sopra la finestra B; fascia `data-parte="richiesta"` «Richiesta di @nome: Titolo — Artista» sotto la targa (x 116, y 498, 848 × 72); in `formati-logica.js` `vociScaletta(reaction) → string[]` e `testoRichiesta(richiesta) → string`; regia *Reaction*: scaletta (una voce per riga), titolo, modo con le due durate, *Mostra ora*, regalo con *Regali visti* (clic = lo usa), coda con campo titolo/artista e i tre pulsanti.

- [ ] **Step 1: scrivi i test e il controllo:** in `test/formati-logica.test.mjs` «vociScaletta toglie le righe vuote e taglia a 8»; «testoRichiesta: con artista «Richiesta di @mario: Titolo — Artista», senza artista solo il titolo»; nello strumento le voci `scaletta` e `richiesta` nella `GEOMETRIA` della reaction (verticale e orizzontale) e lo stato `scaletta` (voci di prova più una richiesta in onda).
- [ ] **Step 2: vedi fallire.** Run: `node --test test/formati-logica.test.mjs` (Expected: FAIL) e `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout reaction --stato scaletta` (Expected: pezzi mancanti).
- [ ] **Step 3: implementa** pagina, CSS (verticale e orizzontale), logica e regia.
- [ ] **Step 4: vedi passare.** Run: `npm test` (Expected: verdi) e i controlli della reaction (verticale, `--formato orizzontale`, `--testi-lunghi --layout reaction`, `--regia-doppio`) (Expected: nessun problema; mockup rigenerati).
- [ ] **Step 5: commit** «Reaction: scaletta semitrasparente, fascia delle richieste e regia [skip netlify]».

### Task 22: Drum — stato (striscia, istruzione, regalo, scaletta a campi)

**Files:**
- Modify: `lib/drum.mjs`, `lib/stato.mjs` (`WIDGET`: `drumStriscia`), `server.mjs`, `public/js/drum-logica.js` (`titoloModulo`), `test/drum.test.mjs`, `test/drum-logica.test.mjs`, `test/formati-server.test.mjs`.

**Interfaces:**
- Consumes: `lib/regali.mjs` (T12), `suRegalo` (T14), comando `richiesta` (T20).
- Produces: `drum.priorita = { prefisso: "Dona una", slot: "Rosa", dopo: "per saltare la fila e scegliere il brano", regalo: "", icona: "rosa" }` (prefisso ≤ 16, slot ≤ 20, dopo ≤ 48, regalo ≤ 40; `impostaPriorita` accetta `dopo` e `regalo`; un vecchio `sopra` diverso dal vecchio predefinito passa a `dopo`, uguale al vecchio predefinito → nuovo predefinito); `drum.striscia = { velocita: 80 }` (40–160) e comando `drumStriscia { velocita? }`; `drum.richieste = richiesteIniziali()` con la mappatura `regalo || slot` (la richiesta del Drum si aggiunge nella sua coda; `richiesta { formato: "drum" }`); `impostaScaletta` accetta anche `{ tappe: [{ like, titolo }] }` (stesse regole di `controllaScaletta`); `titoloModulo(voce) → string` in `drum-logica.js` (il titolo, oppure «Da definire»: sbloccata o no); `fondiDrum` ritrova i campi nuovi; `nuovaSerata` svuota la coda; widget `drumStriscia`.

- [ ] **Step 1: scrivi i test:** «`impostaPriorita`: `dopo` e `regalo` con i limiti ai bordi; errori in italiano»; «stato vecchio con `sopra` personalizzato → `dopo`; con `sopra` predefinito → nuovo testo»; «`drumScaletta { tappe }` uguale al testo equivalente; tappe non crescenti → errore con il numero della tappa»; «`titoloModulo`: con titolo lo mostra anche chiuso; senza titolo, chiuso o sbloccato, «Da definire»»; e2e: «con `slot: "Rosa"` e `regalo` vuoto, `regaloEvento { nome: "Rosa" }` crea una richiesta Drum; con `regalo: "5655"` conta per ID»; «`drumStriscia` limiti 39/161 → errore»; «nuova serata svuota la coda».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/drum.test.mjs test/drum-logica.test.mjs test/formati-server.test.mjs`. Expected: FAIL.
- [ ] **Step 3: implementa** come da Interfaces.
- [ ] **Step 4: vedi passare.** Run: `npm test`. Expected: verdi.
- [ ] **Step 5: commit** «Drum: striscia, istruzione con regalo, coda dei regali e scaletta a tappe nello stato [skip netlify]».

### Task 23: Drum — pagina

**Files:**
- Modify: `public/drum.html`, `public/css/drum.css`, `public/css/formati.css`, `public/js/drum.js`, `public/js/formati-logica.js`, `strumenti/mockup-formati.mjs` (`GEOMETRIA.drum`, `RIGHE_DRUM`, `CORPI_BASE_DRUM`), `test/formati-logica.test.mjs`.

**Interfaces:**
- Consumes: `drum.striscia`, `drum.priorita`, `titoloModulo` (T22), `creaNastro` (`public/js/nastro.js`).
- Produces: in `formati-logica.js` `vociStriscia(s) → [voce]` (nell'ordine: «In esecuzione: Titolo — Artista» se c'è un brano e `drumBrano` è acceso; «Artista ospite · @handle» se c'è un contatto; «Salta la coda e dona una **Rosa**») e `testoIstruzione(priorita) → { prima, regalo, dopo }` («Dona una», «Rosa», «per saltare la fila e scegliere il brano»); la pagina con la tabella di §11.1 della spec (striscia 282/60, istruzione 350/52, camera e cornice 414–1128, contatore, colonna 486–1128 con moduli da 150, banner di sblocco dentro la finestra, equalizzatore 1140/56, fascia 1204/92); l'istruzione su una riga (corpo adattato, mai a capo); i moduli mostrano sempre il titolo; nessun «Brano segreto» né «Brano a sorpresa».

- [ ] **Step 1: scrivi i test e la geometria:** in `test/formati-logica.test.mjs` «vociStriscia: tre voci con brano, ospite e regalo; senza brano manca la prima; senza ospite manca la seconda; il regalo viene dallo slot»; «testoIstruzione compone le tre parti»; nello strumento aggiorna `GEOMETRIA.drum.verticale` ai numeri della spec (`striscia`, `istruzione`, `cornice`, `contatore`, `colonna`, `sblocco`, `eq`, `fascia`, più la finestra della camera 116, 414, 536 × 714) e `RIGHE_DRUM` con `#dr-striscia`, `#dr-istruzione`.
- [ ] **Step 2: vedi fallire.** Run: `node --test test/formati-logica.test.mjs` (Expected: FAIL) e `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout drum` (Expected: pezzi fuori posto o mancanti).
- [ ] **Step 3: implementa** HTML, CSS e JS (striscia con `creaNastro`, richiamo che fa pulsare l'istruzione, moduli con `titoloModulo`).
- [ ] **Step 4: vedi passare.** Run: `npm test` (Expected: verdi) e per il Drum `--layout drum` negli stati `vuoto`, `meta`, `sblocco`, `finale`, `--testi-lunghi`, `--clessidra`, `--sblocco-animato` (Expected: nessun problema; nessuna lettera tagliata al 200%; mockup `drum-*.jpg` rigenerati e guardati).
- [ ] **Step 5: commit** «Drum: striscia a scorrimento, istruzione su una riga, camera allungata e niente brano segreto [skip netlify]».

### Task 24: Drum — regia (scaletta a campi, striscia, regalo)

**Files:**
- Modify: `public/regia.html`, `public/js/regia-formati.js`, `public/js/regia-richieste.js` (T21), `public/js/drum-logica.js`, `test/drum-logica.test.mjs`, `strumenti/mockup-formati.mjs` (`--regia-drum`).

**Interfaces:**
- Consumes: comandi `drumScaletta { tappe }`, `drumPriorita`, `drumStriscia`, `richiesta` (T22).
- Produces: in `drum-logica.js` `leggiLikeCampo(testo) → number | null` (accetta `15000`, `15.000`, `15k`; gli stessi casi di `leggiLike` di `lib/drum.mjs`, con un test che li tiene uguali) e `campiDaScaletta(tappe) → [{ like, titolo }]`; regia *Drum*: tabella di campi «Like | Titolo» con *Aggiungi tappa*, *Togli*, *Su*, *Giù*, *Salva scaletta* (errore sulla riga sbagliata) e *Scaletta predefinita*; velocità della striscia; campi prefisso, regalo mostrato, dopo, icona e **Regalo che salta la coda** con *Regali visti* e la coda («Salta la coda: @nome (Rosa)», *Fatta*, *Scarta*).

- [ ] **Step 1: scrivi i test:** in `test/drum-logica.test.mjs` «`leggiLikeCampo` e `leggiLike` danno lo stesso risultato su `1000`, `1.000`, `5k`, `5K`, `0`, `1,5k`, `abc`, vuoto»; «`campiDaScaletta` rimette i Like in forma leggibile»; nello strumento `--regia-drum` i casi nuovi: tabella (aggiungi, togli, su, giù, salva, errore sulla riga 3), striscia, regalo, *Regali visti*, coda.
- [ ] **Step 2: vedi fallire.** Run: `node --test test/drum-logica.test.mjs` (Expected: FAIL) e `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --regia-drum` (Expected: elementi della regia mancanti).
- [ ] **Step 3: implementa** logica e regia (i campi in uso non si riscrivono; la tabella si ridisegna solo se la scaletta dello stato cambia davvero).
- [ ] **Step 4: vedi passare.** Run: `npm test` (Expected: verdi) e `--regia-drum` (Expected: nessun problema; `regia-drum.jpg` rigenerato).
- [ ] **Step 5: commit** «Drum: regia con scaletta a campi, striscia e regalo che salta la coda [skip netlify]».

### Task 25: Studio Production e Podcast — stato (diciture, titoli salvati, limiti)

**Files:**
- Modify: `lib/formati.mjs`, `server.mjs`, `public/js/formati-logica.js` (`vociFascia` usa l'etichetta dell'ospite), `test/formati.test.mjs`, `test/formati-server.test.mjs`.

**Interfaces:**
- Produces: `podcast.etichette = { ospite: "Ospite" }` (40 caratteri, non vuota; `impostaPodcast` e `fondiPodcast`); `produzione.salvati = []` (fino a 6 `{ id, nome ≤ 24, sopra, testo, sotto, accento, icona }`) con in `impostaProduzione` `salva: { nome }` (salva il titolo in onda con accento e icona del preset attuale), `usa: id` (riempie le tre righe, non cambia `titolo.preset`), `togli: id`; limiti dei titoli: produzione 40/36/60, podcast titolo 40 e riga 60 (reaction in T20); `fondiProduzione` e `fondiPodcast` ritrovano i campi nuovi.

- [ ] **Step 1: scrivi i test:** «`etichette.ospite` modificabile, non vuota, 41 caratteri → errore»; «`salva` con nome vuoto o già usato → errore; il settimo → errore; `usa` riempie le tre righe e lascia il preset; `togli` toglie»; «limiti: sopra 40 ok e 41 errore, titolo 36/37, sotto 60/61; podcast titolo 40/41 e riga 60/61»; «stati vecchi senza `salvati` o `etichette` partono completi»; e2e: «salva, riavvia il server con lo stato salvato, `usa`».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/formati.test.mjs test/formati-server.test.mjs`. Expected: FAIL.
- [ ] **Step 3: implementa** come da Interfaces.
- [ ] **Step 4: vedi passare.** Run: `npm test`. Expected: verdi.
- [ ] **Step 5: commit** «Studio Production e Podcast: diciture modificabili, titoli salvati e limiti più larghi [skip netlify]».

### Task 26: Studio Production e Podcast — pagine e regia

**Files:**
- Modify: `public/css/doppio.css`, `public/css/podcast.css`, `public/js/doppio.js`, `public/js/podcast.js`, `public/regia.html`, `public/js/regia-formati.js`, `public/js/regia-podcast.js`, `strumenti/mockup-formati.mjs` (`GEOMETRIA`, `CORPI_BASE_TARGA`, `CORPI_BASE_PODCAST`).

**Interfaces:**
- Consumes: T25, `--font-dati` (T1).
- Produces: targhe con i corpi di base più grandi e le righe centrate nei riquadri (Studio Production e Reaction: targa 848 × ~230; Podcast: ~140; le altezze finali le fissa il controllo di geometria, senza oltrepassare la zona libera e senza coprire le tematiche), regia con *Diciture* («Ospite») e *Titoli salvati* (nome, *Salva questo titolo*, *Usa*, *Togli*; massimo 6).

- [ ] **Step 1: scrivi i controlli:** nello strumento le nuove misure delle targhe in `GEOMETRIA` e i limiti nuovi (40/36/60, 48/60/60, 40/60) in `--testi-lunghi` per produzione, reaction e podcast, a 100% e 200%; nella regia `--regia-doppio` e `--regia-podcast` i casi dei titoli salvati e delle diciture.
- [ ] **Step 2: vedi fallire.** Run: `node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout produzione --testi-lunghi`. Expected: problemi (limiti nuovi più lunghi, targa di oggi più bassa).
- [ ] **Step 3: implementa** CSS, JS e regia; riscrivi i corpi di base nelle costanti dello strumento.
- [ ] **Step 4: vedi passare.** Run: `npm test` (Expected: verdi) e per produzione, reaction, podcast (verticale e orizzontale) `--layout`, `--testi-lunghi`, `--regia-doppio`, `--regia-podcast` (Expected: nessun problema; mockup rigenerati e guardati).
- [ ] **Step 5: commit** «Studio Production e Podcast: scritte più grandi e centrate, diciture e titoli salvati in regia [skip netlify]».

### Task 27: Documentazione e controllo di insieme

**Files:**
- Modify: `README.md`, `GUIDA.html`, `config.esempio.json` (se serve), `public/regia.html` (note), `docs/superpowers/specs/2026-10-08-restyling-grigi-goal-richieste-design.md` (aggiornamenti per le scelte di corpi e posizioni fatte lungo la strada), tutti i `mockup/*.jpg`.

**Interfaces:** nessuna nuova.

- [ ] **Step 1: scrivi il controllo documentale** in `test/aspetto.test.mjs`: «il README cita i comandi nuovi (`votazione`, `goal`, `goalMostra`, `albero`, `scalettaMostra`, `richiesta`, `drumStriscia`, `regaloEvento`, `followEvento`), i widget nuovi e il font di sistema; non cita più «Barlow», «Grenze», «vetro viola» né «Brano segreto»; ogni comando di `server.mjs` compare nella tabella dell'API».
- [ ] **Step 2: vedi fallire.** Run: `node --test test/aspetto.test.mjs`. Expected: FAIL (il README è quello di prima).
- [ ] **Step 3: aggiorna** README (font e palette, tabelle delle posizioni di gara, Drum, Reaction, Studio, Goal, albero, richieste con regalo e *Regali visti*, limiti noti: San Francisco su Windows, Instagram da Nero, regali e follower non provati con una live vera, carico non misurato), GUIDA, note della regia e `config.esempio.json`; rigenera tutti i mockup con gli strumenti (`mockup-layout.mjs`, `mockup-battle.mjs`, `mockup-formati.mjs`) e rifai la lista di controlli completa.
- [ ] **Step 4: vedi passare.** Run: `npm test` (Expected: tutti verdi) e tutti gli strumenti su un server di prova (Expected: 0 problemi), compresi i controlli dei pixel al 100% e al 200% per ogni layout.
- [ ] **Step 5: commit** «Documentazione, mockup e controllo di insieme dei nuovi layout [skip netlify]».
