# CONTEXT_RESTORE — overlay-live (Backrooms Studio)

Riassunto per riprendere il lavoro senza la chat. Ultimo aggiornamento: 2026-10-14.
Branch di lavoro: `claude/practical-cannon-6wegnn` · PR #1 (verso `claude/busy-knuth-qedjne`) già aperta: NON aprirne un'altra, niente merge/publish senza via libera esplicito.

## 1. Il progetto

`overlay-live/` è la suite di overlay per le live TikTok di Backrooms Studio (3 liberi professionisti, studio di registrazione; obiettivo: arrivare a fatturare 10 000 €/mese). Interfaccia e testi in italiano. Node ≥ 22, ESM, `ws`, `tiktok-live-connector` 2.5.0 (+ `tiktok-live-proto/v3`). Pagine senza build, test con `node --test`, Playwright solo in `strumenti/` (installato a parte).

Regole del repo (`AGENTS.md`): questo Next.js (nella radice) ha API diverse da quelle note, leggere `node_modules/next/dist/docs/` prima di toccare codice Next. L'overlay vive tutto in `overlay-live/`.

## 2. Richiesta grande (approvata: brainstorming → spec → piano → esecuzione "Nativo")

Restyle + refactor di tutta la suite:
- Font San Francisco di sistema ovunque (`-apple-system, BlinkMacSystemFont, "SF Pro Display"…`, Inter come ripiego).
- Palette in grigi; restano solo oro, rosso, smeraldo (test in `test/aspetto.test.mjs`).
- Widget Goal globale (Like e Follower, "Mancano X al nuovo obiettivo"), su tutti i layout.
- **Live con Premio**: voti 4–10, chat al 10% (pesi 3/3/3/1), nomi di giudici e categorie configurabili, blocco voti sopra i commenti TikTok (y 1196), testi classifica più grandi, tabellone "solo un albero con i punteggi".
- **Senza Premio**: spot dall'alto, "Ora in ascolto" fisso colorato per tier, banner bianco SF, artista + Instagram.
- **Live Session**: header più grande, popup DM.
- **Reaction**: scaletta semitrasparente, richieste scatenate da un regalo e scritte a mano dalla regia.
- **Drum**: striscia marquee, istruzione su una riga, camera più alta, niente "Brano segreto", scaletta modificabile, campo regalo.
- **Studio Production / Podcast**: SF, testi più grandi e centrati, etichette modificabili, titoli salvati.
- **Battle**: "Voto Chat" al posto di "Chat Votes".

Documenti: spec `overlay-live/docs/superpowers/specs/2026-10-08-restyling-grigi-goal-richieste-design.md` (18 sezioni), piano `overlay-live/docs/superpowers/plans/2026-10-08-restyling-grigi-goal-richieste.md` (27 task + Review Focus), ledger `.superpowers/sdd/2026-10-08-restyling-grigi-goal-richieste/progress.md` (git-ignored; contiene tutti i `Ruling:`).

## 3. Cosa è FATTO (task 1–13, 345 test verdi)

| Task | Commit | Contenuto |
|---|---|---|
| T1 | 55e90c1 | Font SF ovunque |
| T2 | 0b400d7 | Palette grigi + oro/rosso/smeraldo, test colori |
| T3 | 423d913 | Battle "Voto Chat" |
| T4 | 8a389e1 | `leggiVoto(testo,{min,max})`, `normalizzaVoto` con intervallo |
| T5 | 95bab68 | `stato.votazione {pesi,min,max,etichette}`, comando `votazione`, pesi 3/3/3/1, voti 4–10 |
| T6 | 1af422a | Regia "Voti della gara" (`regia-voti.js`, `votazione-logica.js`), etichette in pagina |
| T7 | 5b59451 | Geometria verticale (tabellone y858 h260, barra chat y1130 h66), `strumenti/mockup-layout.mjs`, `test/geometria.test.mjs` |
| T8 | d113132 | Testi adattati (`CORPI` in `overlay.js`, `adattaTesto` con controllo inchiostro in `pagina.js`), classifica righe 58 px |
| T9 | 83368fd | `lib/albero.mjs` `costruisciAlbero` |
| T10 | 3b88082 | Widget `albero` (stato, comando, `albero.js/css`, regia, scadenza) |
| T11 | 502ba6a | `regaloTikTok`, `followTikTok`, ascoltatori GIFT/FOLLOW in `avviaTikTok` (opzione `creaConnessione`) |
| T12 | 8705a89 | `lib/regali.mjs`: corrispondenza regalo, regali visti, coda richieste (max 30) |
| T13 | 0fa0279 | `lib/goal.mjs`: obiettivi, passo, follower, posizioni, `istantaneaGoal` |

(T1–T3 sono i commit 55e90c1, 0b400d7, 423d913; spec/piano: f0a07ff, fe93049.)

## 4. Architettura attuale (da ricordare)

- `server.mjs`: mappa `comandi` (POST `/api/<comando>` e WebSocket), `caricaConfig` (fonde `config.esempio.json`; vecchi pesi 1/1/1/1 → "non impostati"), `caricaStato` (+ riparazione campo per campo `fondi*`), `emetti`/`cambiato`, tick `setInterval` 250 ms, `nuovaSerata`/`demo` (mantengono liste, votazione, durata albero), `registraCommento`, `avviaTikTok` con `suLike`, `suNuovaConnessione`, `suRegalo`, `suFollow`, `creaConnessione`.
- `lib/*.mjs`: funzioni pure sullo stato (`stato.mjs`, `goal.mjs`, `regali.mjs`, `albero.mjs`, `chat.mjs`, `drum.mjs`, `nero.mjs`, `validazione.mjs` con `numeroTra`, `testo`, `oggetto`, `corpo`).
- Client: `connessione.js` (WS), `pagina.js` (`adattaTesto`), `overlay.js` (`CORPI`, `adatta`, `scrivi`, `adattaLarghezza`), `nastro.js`, widget con `data-widget`/`data-parte`, anteprime `?anteprima=1&statico=1`.
- Geometria verticale 1080×1920: premio y282 h156, classifica y454 h392 w432, timer x564 y454 400×132, notifica y604, tabellone y858 h260, barra chat y1130 h66 (fine 1196), albero 116,282,848×914; orizzontale albero 24,16,1872×1048.
- Test: `node --test` (aiuti: `test/aiuti-server.mjs`). Strumenti di mockup in `strumenti/` (`mockup-layout.mjs --layout gara --stato … --controlli`).
- Commit: trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01KknJSv8vijv85bNpvfWr5a`; titoli che finiscono con `[skip netlify]`; push con `git push -u origin claude/practical-cannon-6wegnn` (T11–T13 e successivi non ancora pushati).

## 5. Problemi risolti (tra i principali)

Cella nomi troppo stretta dopo il cambio font; font-size inline che batteva il CSS; `adattaTesto` che sforava con minimi di parità diversa; etichetta timer su due righe; "10,00/10" che andava a capo; albero con ghosting (pannello ora opaco); ciclo oltre l'ultimo turno nell'albero; `WIDGET_SPENTI` fissato dai test; codec `MessageCommonText` per il testo dei follow; `controllaRichieste` che accettava `regalo` numerico; eviction delle richieste in onda.

## 6. Cosa RESTA da fare

### 6.1 Ritocchi grafici urgenti (fatti, commit "Ritocchi: coda Nero reale, scheda e barra dorate con lo skip, testi più grandi")
- [x] "Traccia N di TOTALE · mancano X canzoni" (`avanzamentoCoda` in `public/js/barra.js`; `istantanea.codaNero` da `meta.queueCount` di Nero, `impostaCodaNero` in `lib/stato.mjs`): oggi compare nella **barra** del layout Senza Premio (voce «In ascolto»).
- [ ] Mostrarlo anche in **Reaction** e **Gara** (il dato `codaNero` e `ascoltate` è già nello stato; manca il punto in pagina: T18 per la gara, T21 per Reaction). Da verificare con Nero vero che `meta.queueCount` sia il numero delle canzoni in attesa.
- [x] Senza Premio: scheda in onda e barra dorate per Skip, Super Skip e Throne (`.sp-scheda:is(.tier-…)`, `.sp-barra.pagata`).
- [x] Testi più grandi: classifica (titolo 32, artista 22, righe 60 px), nomi voci 26, giudici 24, invito del premio 30 (`CORPI` + CSS + `strumenti/mockup-layout.mjs`, `--controlli` verde).

### 6.2 Piano (T14–T27)
- [ ] **T14** Server: `stato.goal` e `stato.regaliVisti` (fusi in `caricaStato`, mantenuti da `nuovaSerata`/`demo`); `collegaTikTok` passa `suRegalo` e `suFollow`; comandi `goal`, `goalMostra`, `regaloEvento {nome,id?,utente,quantita?}`, `followEvento {utente,totale?}`; `istantanea.goal`/`regaliVisti`; widget `goal` acceso di partenza; test `test/goal-server.test.mjs`. Commit "Goal: stato, comandi e collegamento di follow e regali [skip netlify]".
- [ ] **T15** Componente Goal (`public/js/goal.js`, `goal.css`) + 4 layout nuovi.
- [ ] **T16** Goal su gara / senza premio / studio / Battle + regia `regia-goal.js`.
- [ ] **T17** Stato Senza Premio, Instagram, Nero (coda reale → totale/mancanti).
- [ ] **T18** Scheda fissa, spot dall'alto, colori tier (Throne/Skip/Super Skip), banner bianco SF, artista, Instagram nel tabellone gara (`--layout senzaPremio --scheda …`).
- [ ] **T19** Studio.
- [ ] **T20–T21** Reaction: stato, scaletta, richieste (scaletta/richiesta a y 524, targa 230 px).
- [ ] **T22–T24** Drum: stato, pagina, regia (`drum.js` adattamento `sopra→dopo`).
- [ ] **T25–T26** Studio Production e Podcast: stato, pagine, regia.
- [ ] **T27** Documenti (README: righe `pesi`/`votoMin`/`etichette`, API `votazione`/`albero`; GUIDA.html), mockup, calibrazione `stimaGiroSecondi`, controlli generali.

### 6.3 Chiusura
- [ ] Revisione finale dell'intero branch con un reviewer a contesto pulito (modello più capace), `review-package PLAN MERGE_BASE HEAD` (MERGE_BASE `0d206cc` o `fe93049`), includendo il Review Focus del piano e i `Ruling:` del ledger.
- [ ] UN solo giro di correzioni (RED→GREEN) con righe `Final:` nel ledger; minori come `Final: minor (deferred)`.
- [ ] Push dei commit; nuovo video per telefono + zip verificato in cartella pulita (`npm ci` + test), invio con SendUserFile.
- [ ] Messaggio finale in italiano con "Rulings I made" (tutti, in ordine) e "Deferred minors"; cancellare il workspace del piano; finishing-a-development-branch (proporre, non creare, PR/merge); offrire la sottoscrizione ai PR.

### 6.4 Punti aperti noti
- Nome del campo Instagram in Nero non verificato.
- Regali e follow non provati con una live vera (solo messaggi scritti con lo schema v3).
- Colori delle schede Throne/Skip/Super Skip e pillole tier da definire in T18.
- `stimaGiroSecondi` da calibrare in T27.

## 7. Come riprendere

1. `git log --oneline | head` e leggere il ledger: i task con `Task N: complete` sono fatti.
2. Strumenti dei test server: script `con-server.sh <comando…>` (server di prova su 4799) nella scratchpad della sessione; Playwright per gli screenshot (`strumenti/`).
3. Script del flusso di esecuzione: `task-start PLAN N`, `task-done PLAN N BASE -- node --test` (skill `executing-plans`).
