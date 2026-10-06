# Architettura di overlay-live e riuso come modello

Il modello è `/home/user/studious-train/overlay-live`. È un server Node locale, senza build e senza framework. Tiene lo stato della live e lo manda via WebSocket a due pagine statiche: l'overlay (sorgente Link in TikTok LIVE Studio) e la regia. Non dipende dal sito Next.js del repo: ha il suo `package.json` e il suo `node_modules`. Il `tsconfig.json` del sito include solo `**/*.ts` e `**/*.tsx`, Netlify pubblica solo il sito: scrivi anche i nuovi overlay in `.mjs`/`.js`, in una cartella propria.

## 1. Mappa dei file

| File | Cosa fa | Riuso |
|---|---|---|
| `server.mjs` | `caricaConfig`, `caricaStato`, `salvaPresto`; comandi (`comandi`, `esegui`); diffusione (`emetti`, `cambiato`, `istantanea`, `inviaATutti`); HTTP statico + `/api`; WebSocket `/ws`; controlli ogni 250 ms; webhook Nero su una porta separata | scheletro generico; il contenuto di `comandi` è della gara |
| `lib/stato.mjs` | logica pura della serata: `statoIniziale`, `tracciaVuota`, `punteggi`, `conferma`, `classifica`, `countdown`, `proclama`, `tracciaDaNero`, `passaSeTocca`, `istantanea`. Nessun I/O: l'ora arriva come parametro `ora` | riscrivila per ogni format, ma con lo stesso stile |
| `lib/chat.mjs` | `leggiVoto` (regex dei voti), `commentoTikTok`, `avviaTikTok` (si ricollega da solo; stati `spento`/`attesa`/`collegato`) | `avviaTikTok` è generico, `leggiVoto` no |
| `lib/nero.mjs` | `avviaNero` (ogni 3 s legge `queue/<id>/slim`; il profilo solo senza sessione o ogni 60 s), `tracciaInOnda`, `firmaValida` (HMAC), `versoCoda` | generico per ogni overlay che segue Nero.fan |
| `public/js/connessione.js` | `collega({ suStato, suConnessione, pin })`: WebSocket con riconnessione, `comando()` che restituisce una Promise con l'esito, `ora()` allineata al server; `formatta`, `durata` | generico: copialo così |
| `public/js/overlay.js` | disegna lo stato; parametri URL; utilità `adattaPalco`, `rilancia`, `numero`, `adattaTesto`, `scintille` | utilità generiche, pannelli specifici |
| `public/js/regia.js` | disegna lo stato e manda comandi; utilità `invia` (chiede il PIN), `avviso`, `el`, `riempi`; tasti F2/F4/F8/F9 | utilità generiche |
| `public/js/suoni.js` | motore Web Audio + mappa `effetti`; `suona`, `volume`, `sblocca`, `audioPronto`, `NOMI_SUONI` | motore generico, effetti da adattare |
| `public/js/eventi-sonori.js` | funzioni pure prima/dopo → suoni: `suoniTraccia`, `cambiClassifica`, `suoniClassifica`, `suoniTimer`; `RITARDO_CLASSIFICA_MS`, `SOGLIA_URGENTE_MS` | schema generico, regole specifiche |
| `public/overlay.html` + `css/overlay.css` | pannelli con `data-widget`; posizioni nel blocco di variabili `.verticale .palco` in cima al CSS; righe `.orizzontale .x` in fondo | struttura generica |
| `public/regia.html` + `css/regia.css` | tre schede; interruttori «In onda» (`data-widget`); pulsanti Prova (`data-suono`) | struttura generica |
| `public/css/base.css` | colori e font Backrooms (`--font-gotico`, `--font-dati`, podio, cromo) | identità dello studio: riusala |
| `config.esempio.json` | predefiniti; `config.json` nasce da qui al primo avvio | adatta |
| `AVVIA.cmd`, `package.json`, `.gitignore` | avvio su Windows (installa le dipendenze se manca `node_modules`); dipendenze `ws` e `tiktok-live-connector`; Node >= 22; `npm test` = `node --test`; ignorati `node_modules/`, `config.json`, `dati/` | generici |
| `test/*.test.mjs` | test della logica pura (stato, chat, Nero, eventi sonori) | adatta |
| `README.md`, `GUIDA.html`, `mockup/` | documentazione e anteprime | riscrivi e rigenera |

## 2. Flusso dei dati

```
Regia ── WebSocket {tipo:"comando", id, nome, args, pin} ──┐
Stream Deck ── POST /api/<nome> (header x-pin) ────────────┼─▶ esegui() ─▶ comandi[nome] ─▶ funzioni di lib/stato.mjs
Chat TikTok, Nero (polling e webhook), setInterval 250 ms ─┘                                    │
                                                                                     cambiato()
                                       ┌──────────────────────────────────────────────────┤
                         salvaPresto(): dati/stato.json (al massimo ogni 500 ms)    inviaATutti() dopo 50 ms
                                                                                          │
                       {tipo:"stato", stato: istantanea(), eventi:[{nome,dati}]} ─▶ overlay e regia
```

1. **Ingresso.** Regia e Stream Deck passano da `esegui(nome, args, pin)`. Controlla il PIN e `Object.hasOwn(comandi, nome)`, chiama il comando, poi `cambiato()`. Risponde `{ok:true, dati}` oppure `{ok:false, errore}`; sul WebSocket la risposta è `{tipo:"esito", id, ...}`. Chat, Nero, webhook e il `setInterval` (`chiudiChatSeScaduta`, `passaSeTocca`, `scadenzaCountdown`) cambiano lo stato e chiamano `cambiato()` da soli.
2. **Stato.** Un solo oggetto `stato`, variabile di modulo del server. `demo` e `nuovaSerata` lo sostituiscono: non tenerne copie altrove.
3. **`cambiato()`.** Chiama `salvaPresto()` (scrive `stato.json.tmp`, poi lo rinomina) e programma l'invio tra 50 ms. Le modifiche ravvicinate (raffica di voti) partono in un solo messaggio.
4. **`istantanea()`.** Nel server vale `S.istantanea(stato, config, Date.now())` più i campi che vivono solo nel server (`tiktok`, `nero`, `neroUtente`). È il contratto con le pagine: un campo che non sta qui, overlay e regia non lo vedono.
5. **Invio.** `inviaATutti()` manda stato ed eventi a tutti i client e svuota `eventiInAttesa`. Alla connessione ogni client riceve subito lo stato, con `eventi: []`.
6. **Pagine.** `collega({ suStato(s, eventi) {...} })`. L'overlay confronta `prima` e `s` per suoni e animazioni, poi ridisegna (le funzioni `disegna*` si possono chiamare quante volte vuoi). Il countdown gira in `cicloTempo` (requestAnimationFrame) con `conn.ora()`, cioè con l'ora del server.

L'esito di un comando arriva **prima** dello stato aggiornato, che parte 50 ms dopo (verificato). Dopo `await invia(...)` usa `esito.dati`, non `stato`.

**Contratto di istantanea.** Chi legge cosa. Se cambi forma o nome di un campo, cambia tutte le funzioni della riga.

| Campo di `istantanea()` | Lo leggono |
|---|---|
| `ora` | `connessione.js` (`scarto`, da cui `ora()` allineata al server) |
| `corrente`: `id`, `titolo`, `artista`, `tier`, `confermato`, `posizione`, `punteggi` (`beat`, `voce`, `mix`, `chat`, `chatVoti`, `totale`), `chat` (`aperta`, `chiudeAlle`, `ultimi`) | `overlay.js` `disegnaTabellone`, `cicloTempo` (tempo della chat); `regia.js` `disegnaTraccia`, `disegnaVoti`, `disegnaChat`; `eventi-sonori.js` `suoniTraccia` (`id`, `punteggi`, `chat.aperta`, `confermato`) |
| `classifica[]`: `id`, `titolo`, `artista`, `totale` | `overlay.js` `disegnaClassifica`, `notificaCambi`; `eventi-sonori.js` `cambiClassifica` (solo `id`; la regia la chiama in `suoniRegia`) |
| `risultati[]`: come sopra più `beat`, `voce`, `mix`, `chat`, `chatVoti` | `regia.js` `disegnaClassifica`, `togliRisultato` (`id`) |
| `vincitore`: `id`, `titolo`, `artista`, `totale`, `premio`, `proclamatoAlle`, `visibile` | `overlay.js` `disegnaVincitore`; `eventi-sonori.js` `chiaveVincitore` |
| `spareggio`: `dal`, `candidati[]` (`id`, `titolo`, `artista`, `totale`) | `overlay.js` `disegnaSpareggio`; `regia.js` `disegnaSpareggio` → `scegliVincitore` (manda `id` a `proclama`); `eventi-sonori.js` (`dal`) |
| `countdown`: `fineAlle`, `rimanenteMs` | `overlay.js` `cicloTempo`; `regia.js` (timer, F9 `alternaPausa`) |
| `premio`, `invito` | `overlay.js` `disegnaPremio`; `regia.js` `disegnaSerata`; `eventi-sonori.js` (`premio`) |
| `giudici`, `topN`, `nascondiVoti`, `visibili`, `suoni` | entrambe le pagine; `nascondiVoti` anche `eventi-sonori.js` |
| `durataCountdownMinuti`, `coda`, `nero`, `neroUtente`, `tiktok` | solo `regia.js` |

**Regole del modello (mantienile):**
- Logica nel server, in funzioni pure con `ora` come argomento: si testano con `node --test` senza timer.
- Le pagine non tengono dati propri: disegnano lo stato e mandano comandi.
- Scadenze come istanti assoluti (`fineAlle`, `chiudeAlle`); in pausa `rimanenteMs`. Il server le controlla ogni 250 ms.
- Niente suoni né animazioni al primo disegno (`primoDisegno`, e `suoniTraccia(null, ...)` restituisce `[]`): LIVE Studio può ricaricare la sorgente in qualsiasi momento.
- Testi esterni (chat, Nero, regia) solo con `textContent` o `el()`; `innerHTML` solo per modelli fissi. Nel server ogni testo passa da `pulisci(testo, max)`.

## 3. Come aggiungere…

### Un comando
1. Scrivi la logica in `lib/stato.mjs`: funzione esportata `(stato, args, ora)` che lancia `new Error("messaggio in italiano")` se l'input non va. Testala in `test/stato.test.mjs`.
2. In `server.mjs`, dentro `comandi`: `mioComando({ testo }) { S.mioComando(stato, { testo: pulisci(testo) }, Date.now()); }`. `args` è sempre un oggetto. Quello che restituisci arriva al chiamante come `dati`. `cambiato()` lo chiama `esegui`.
3. Nome di sole lettere e cifre: l'API riconosce `/^\/api\/(\w+)$/`, quindi niente trattini.
4. Regia: pulsante in `regia.html`, poi `$("#id").addEventListener("click", () => invia("mioComando", {...}))`. Se cancella dati, chiedi `confirm()` prima (come `nuovaSerata`).
5. Aggiungilo alla tabella API del README: è subito anche un tasto Stream Deck.

### Un campo di stato
1. `statoIniziale(config)`: aggiungi il campo col predefinito (`config.x ?? PREDEFINITO` se si configura).
2. `istantanea()` in `lib/stato.mjs`: esponilo.
3. `caricaStato()` in `server.mjs`. `{ ...iniziale, ...salvato }` copre già un campo nuovo di primo livello. Un oggetto annidato va fuso a mano: `salvato.x = { ...iniziale.x, ...salvato.x };` (come `visibili` e `suoni`). Se cambi un testo predefinito, metti il vecchio in una lista (`INVITI_SUPERATI` per `invito`) e sostituiscilo solo a chi non l'aveva cambiato. Se cambia la forma di un dato, azzera solo quel pezzo (come `corrente` quando `voti.beat` è ancora un array). Chi aggiorna non deve perdere niente.
4. Campo dentro la traccia: aggiungilo in `tracciaVuota`. Una traccia salvata prima non lo ha: leggilo con `?? predefinito`.
5. `demo` e `nuovaSerata` ricreano lo stato da `statoIniziale` e conservano solo un elenco fisso (`premio, invito, suoni, giudici, tiktokUtente, neroAutomatico`; `demo` anche `neroUltimo`, così la traccia di Nero non torna sopra i dati finti). Un'impostazione nuova che deve sopravvivere alla nuova serata va aggiunta a **entrambi** gli elenchi.
6. Testa valore iniziale, validazione e istantanea.

### Un'impostazione in config
- Mettila in `config.esempio.json`. `caricaConfig` fonde esempio e `config.json`: le chiavi nuove di primo livello arrivano da sole; gli oggetti annidati si fondono solo per `giudici`, `pesi`, `nero`. Per un oggetto annidato nuovo aggiungi `x: { ...base.x, ...tuo.x }`.
- Il `config.json` dello studio non viene mai riscritto: non dare per scontato che contenga le chiavi nuove.

### Un widget
1. `WIDGET` in `lib/stato.mjs` (oggi `["premio", "tabellone", "classifica", "timer"]`): aggiungi il nome. `statoIniziale` lo accende in `visibili`; `caricaStato` lo accende anche negli stati salvati prima.
2. `overlay.html`: `<section class="pannello mio" data-widget="mio">` dentro `.palco`. Gli elementi accessori riusano il `data-widget` del pannello a cui appartengono: la notifica usa `classifica`, la barra «Vota in chat» `tabellone`, vincitore e spareggio `vincitore`.
3. `overlay.css`: `--y-mio` e `--h-mio` nel blocco `.verticale .palco`, poi `.verticale .mio { left: var(--x); top: var(--y-mio); ... }`; riga `.orizzontale .mio` in fondo.
4. `overlay.js`: aggiungi `mio` alla lista predefinita di `?w=` (`parametri.get("w") ?? "premio,tabellone,classifica,timer,vincitore"`). Scrivi `disegnaMio(s)` con `radice.classList.toggle("fuori", !s.visibili.mio)` e chiamala in `suStato`.
5. `regia.html`, scheda «In onda»: `<label class="interruttore"><input type="checkbox" data-widget="mio"> Nome</label>`. `regia.js` collega già ogni `[data-widget]` al comando `widget` e lo spunta da `s.visibili`.

`?w=` toglie l'elemento (`hidden`): serve a dividere i riquadri su più sorgenti. `visibili` lo sfuma con `.fuori`: è l'interruttore In onda dal vivo. `vincitore` sta in `?w=` ma non in `WIDGET`: la schermata finale si chiude col comando `nascondiVincitore`.

### Un evento per l'overlay
- Nel server: `emetti("nome", dati)`, poi `cambiato()` (in un comando lo fa `esegui`). L'evento parte col messaggio di stato successivo, in `eventi`.
- Gli eventi non si salvano e non si ripetono: chi si collega dopo non li riceve. Usali solo per effetti una tantum (suono, animazione). Quello che deve restare a schermo va nello stato.
- Un messaggio può portare più eventi (finestra di 50 ms): gestisci la lista. Esempio: `aggiornaClassifica` accumula le conferme in `confermeRinviate` e ridisegna dopo `RITARDO_CLASSIFICA_MS`.
- Prima di creare un evento, prova col confronto prima/dopo. Il vincitore si riconosce da `id@proclamatoAlle` (`chiaveVincitore`), lo spareggio da `spareggio.dal`. Oggi le pagine leggono solo gli eventi `classifica` (esito di `conferma`) e `suono` (da `provaSuono`). `vincitore`, `spareggio` e `coda` vengono emessi, ma nessuna pagina li usa.
- Suono collegato:
  1. Aggiungi l'effetto a `effetti` in `suoni.js`. Entra da solo in `NOMI_SUONI` e nella misura `strumenti/suoni.mjs livelli`.
  2. Scrivi la regola in `eventi-sonori.js` e il test in `test/eventi-sonori.test.mjs`. Il file deve restare senza DOM: lo importano anche i test in Node.
  3. Aggiungi il pulsante Prova `data-suono="nome"` in `regia.html`; si collega da solo.
- Regia e overlay chiamano le stesse funzioni. La regia suona solo con `suoni.dove === "regia"`; l'overlay solo con `"overlay"` e senza `?muto`/`?statico`.

### Una pagina o un tipo di file
- Pagina con indirizzo proprio: aggiungila a `PAGINE` in `server.mjs`. Per LIVE Studio l'URL deve finire con `.html`.
- Il resto di `public/` è servito così com'è. `TIPI` conosce solo html, css, js, png, jpg, svg, woff2, mp3: per `.json`, `.webp`, `.wav` o `.gif` aggiungi la riga, altrimenti esce `application/octet-stream`.

## 4. Generico o specifico della gara

**Generico, da tenere quasi uguale:** lo scheletro di `server.mjs` (config, caricamento e salvataggio, `emetti`/`cambiato`/`inviaATutti`, `esegui`, `leggiCorpo`, `json`, `hostValido`, `origineDi`, `serviFile`, WebSocket, server del webhook); `connessione.js`; il motore di `suoni.js`; in `overlay.js` i parametri URL, `adattaPalco`, `rilancia`, `numero`, `adattaTesto`, `scintille`, il ciclo `cicloTempo`; in `overlay.css` `.palco` con `--scala`, `.pannello`, `.fuori`, `.statico`, `.guide`, `.lampo`; `base.css`; in `regia.js` `invia`, `avviso`, `el`, `riempi`, i suoni in regia, le scorciatoie; `avviaTikTok`; `lib/nero.mjs`; `AVVIA.cmd`, `package.json`, `.gitignore`.

**In `server.mjs` vanno riscritti per un altro formato:** `registraCommento` (usa `leggiVoto` e `votoChat`); la callback di `collegaNero` (`tracciaDaNero`); il corpo del `setInterval` e i suoi log (`passaSeTocca`, «Nero.fan: sul tabellone…», «vince "titolo" di artista», «spareggio tra N tracce»); i campi `nero` e `neroUtente` di `istantanea`; le migrazioni di `caricaStato` (sono di overlay-live: `INVITI_SUPERATI`, `voti.beat` come lista, `giudici` come lista); il webhook (scrive in `stato.coda`); tutto `comandi`; la scritta «Overlay live pronto». Il resto resta uguale: `caricaConfig` (tranne le righe dei giudici, §8), `salvaPresto`, `emetti`/`cambiato`/`inviaATutti`, `esegui`, HTTP, WebSocket e sicurezza.

**Specifico della gara di recensione:** `CATEGORIE` (beat, voce, mix) e giudici; `pesi`, `punteggi`, `conferma`, `classifica` con `topN`, `primiPariMerito`, spareggio, `proclama`; countdown che chiude la gara; premio e `invito`; `ORDINE_TIER` e coda; `neroInArrivo` con `attesaDopoConfermaSecondi`; il formato di `leggiVoto`; i comandi `voto`, `giudici`, `nascondiVoti`, `apriChat`, `conferma`, `prossima`, `proclama`, `demo`; i pannelli di `overlay.html`; effetti e regole sonore; i test.

## 4bis. Cambiare formato di gara (es. battle 1 contro 1)

Nel modello l'unità di gara è la traccia e la scala è 0–10. Tutte e due sono scritte a mano in molti file.
Trappola silenziosa: `leggiVoto` accetta già `1` e `2` (come voti 1 e 2 su 10; `!1` e `2️⃣` invece no). Un overlay battle sembra funzionare, ma la chat fa una media (es. 1,4) invece di contare i voti per lato.

Prima di scrivere codice, nel clone:
```bash
grep -rn "0 a 10\|/10\|10%\|CATEGORIE\|leggiVoto\|media(\|\"beat\"" --exclude-dir=node_modules --exclude-dir=mockup .
```
e spunta ogni riga della tabella.

| Cosa | Dove nel modello | Battle (proposta) |
|---|---|---|
| parser della chat | `lib/chat.mjs` `RE_VOTO`, `leggiVoto`; test «riconosce i voti scritti nei commenti» in `test/integrazioni.test.mjs` | nuova `leggiLato(testo)` → 1, 2 o `null`. Accetta `1`, `2`, `!1`, `!v 2`, `1️⃣`, `1111`, `uno`, `due`; rifiuta `12`, `1 2`, `3` e le frasi. Non tenere `RE_VOTO` |
| voto per utente | `lib/stato.mjs` `votoChat` | riusalo, con `valore` = lato |
| calcolo | `lib/stato.mjs` `media`, `punteggi`, `normalizzaVoto` («tra 0 e 10»), `confronta` | `conteggio(chat.voti)` → `{ uno, due, totale, percentuale1 }` |
| simulazione | `server.mjs` `simulaChat` (voti 0–10) e `demo` | `simulaChat` con un parametro `percentuale1`; `demo` che riempie ogni riquadro |
| scala nei testi | `overlay.html` «Vota in chat da 0 a 10» e i due `/10` (totale e vincitore); `overlay.css` barra `calc(var(--v, 0) * 10%)` e tacche al 10%; `regia.html` `input type="number" min="0" max="10"`; `regia.js` `inviaVoto` (0..10) e `#chat-media` in `disegnaChat`; README e GUIDA («Da 0 a 10») | testi del nuovo formato |
| categorie | 4 copie: `CATEGORIE` in `lib/stato.mjs`, `eventi-sonori.js`, `regia.js`, e la lista scritta a mano in `overlay.js` `disegnaTabellone` | allineale o eliminale |
| suono del voto | `suoni.js` `effetti.voto` (`SCALA[round(valore)]`: 1 e 2 danno due note gravi quasi uguali) | effetto nuovo, `suoni.md` §10bis |
| giudici | `config.giudici` per categoria; `caricaConfig`, `caricaStato` e il comando `giudici` (scorre `S.CATEGORIE`) | trappola in §8 |

### Classifica di concorrenti che tornano (rapper, squadre)

Nel modello ogni risultato è una traccia e `classifica` ordina i risultati. In una battle la classifica è dei concorrenti, che tornano in più round.
1. Nello stato tieni un archivio `concorrenti: [{ id, nome }]`. La regia sceglie da un elenco (`datalist`) o crea un nome nuovo: così «Kappa» e «kappa » non diventano due righe.
2. I round confermati puntano agli id dei concorrenti.
3. `classifica(stato, n)` è una funzione pura che aggrega i round: vittorie, punti, round giocati. Ordine: vittorie, poi punti, poi chi è arrivato prima a quel punteggio.
4. L'id di ogni riga è l'id del concorrente. Così `cambiClassifica`, i badge NEW/▲, la corona e i suoni `primo`/`entrata`/`sale`/`esce` funzionano senza modifiche.
5. `proclama` (oggi cerca l'id in `stato.risultati`) e lo spareggio (`primiPariMerito`) lavorano sulla classifica aggregata, non sui round.
6. Vincitore e candidati dello spareggio hanno sempre `{ id, nome, sotto (es. «3 round vinti»), punti, premio, proclamatoAlle, visibile }`. Rinomina tutto insieme: `lib/stato.mjs`; `overlay.js` (`disegnaClassifica`, `notificaCambi`, `disegnaVincitore`, `disegnaSpareggio`, i `/10`); `regia.js` (`disegnaClassifica`, `disegnaSpareggio`, `scegliVincitore`); il log di fine countdown nel `setInterval` di `server.mjs` (oggi `vincitore.titolo` e `vincitore.artista`). Controlla con la tabella «Contratto di istantanea» di §2.
7. «Correggi nome» cambia l'archivio, non i round.

## 5. Ricetta: nuovo overlay da questo modello

**Prima scegli:**
- **Nuova cartella** (scelta di partenza): format diverso, stato diverso, può girare insieme agli altri.
- **Estendere overlay-live**: stessa gara con un altro layout. Aggiungi una pagina a `PAGINE` (es. `"/classifica.html"`) che legge lo stesso stato. Un solo server, una sola regia, nessuna porta nuova.

**Copia (solo i file versionati, verificato):**
```bash
cd /home/user/studious-train
NUOVO=overlay-xxx                  # minuscolo, con trattini
mkdir "$NUOVO"
git archive HEAD overlay-live | tar -x --strip-components=1 -C "$NUOVO"
cd "$NUOVO" && npm install && npm test   # 25 test verdi sul modello
```
`git archive` prende l'ultimo commit: senza `node_modules`, `config.json` e `dati/`, quindi il nuovo overlay parte da una serata vuota. Le modifiche non ancora committate di `overlay-live` restano fuori.

**Rinomina e adatta:**
- `package.json`: `name`, `description`.
- `config.esempio.json`: `porta`, `nero.portaWebhook`, `tiktok`, `nero.username`, e i campi del nuovo format. Anche `durataCountdownMinuti` (120 = 2 ore) e `premio` (es. «Sessione in studio»). Poi `grep -rn "180\|3 ore" --exclude-dir=node_modules --include=*.html --include=*.md .` (GUIDA e README dicono «3 ore» e «180») e aggiorna il `datalist #premi` di `regia.html` (oggi Mix, Master, Beat…).
- `server.mjs`: commento in cima e scritta «Overlay live pronto» in `server.listen`.
- `public/overlay.html`, `public/regia.html`: `<title>` e pannelli. In `regia.html` la nota Stream Deck del dialogo «Scorciatoie» contiene `127.0.0.1:4747` scritto a mano.
- `AVVIA.cmd`: commento e una riga `title <Nome overlay>` dopo `@echo off`, così la finestra nera si distingue da quella di overlay-live. `README.md`, `GUIDA.html`: riscrivili. Elimina `mockup/` e rigenera.
- `.gitignore`: scrivi `node_modules` senza barra. Con `node_modules/` un link simbolico `node_modules` non è ignorato e finisce nel commit (verificato).
- `lib/stato.mjs`, `overlay.*`, `regia.*`, `eventi-sonori.js`, `test/`: sostituisci la logica della gara. Tieni i test di ciò che resta.
- Se tieni il passaggio automatico da Nero, correggi la frase del modello sbagliata per attesa 0: README «Con `0` passa solo con `F8`» e `regia.js` in `disegnaTraccia` («Passa con F8.», «poi passa con F8.»). Con 0 la traccia passa da sola appena confermi (`passaSeTocca`).
- Trova ogni porta scritta a mano: `grep -rn "4747\|4748" --exclude-dir=node_modules .` (README e GUIDA ne hanno molte).

**Porte.** Ogni overlay ha le sue, anche se va in onda da solo (registro in `SKILL.md`, regola 11). Ogni server usa `porta` (4747) e `nero.portaWebhook` (4748): cambiale in `config.esempio.json` del clone, così il `config.json` creato al primo avvio è già giusto. Senza webhook metti `"portaWebhook": 0` (`if (config.nero.portaWebhook)` lo salta). Senza Nero: `"username": ""` (per un formato senza tracce togli anche il codice: `integrazioni.md` §0). Senza chat: `"tiktok": ""`. Ogni cartella ha il suo `dati/`. Il PIN in `localStorage` (`regia-pin`) è separato perché la porta cambia l'origine. Ogni server apre la sua connessione alla chat e il suo polling di Nero. Se due overlay vanno in onda insieme in LIVE Studio, i riquadri non devono sovrapporsi: controlla con `?guide=1` su entrambi.

**Controllo rapido:**
```bash
node server.mjs > server.log 2>&1 &
sleep 2; cat server.log            # deve stampare Regia/Overlay sulla porta nuova
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4757/overlay.html    # 200
curl -s http://127.0.0.1:4757/api/stato | head -c 300
kill $(lsof -ti tcp:4757 -sTCP:LISTEN)   # ferma SOLO questo server
```
Per la preview locale puoi aggiungere una configurazione in `.claude/launch.json`. Resta locale (escluso in `.git/info/exclude`): non committarlo. Commit in italiano, sullo stile di quelli esistenti («Overlay live: …»).

**Le parti generiche sono copie.** Con più overlay, `connessione.js`, il motore di `suoni.js` e lo scheletro di `server.mjs` (§4) esistono in più cartelle. Un bug corretto in una non arriva nelle altre. Se ne correggi una, porta la stessa correzione negli altri overlay:
```bash
cd /home/user/studious-train
for d in overlay-*/; do diff -q overlay-live/public/js/connessione.js ${d}public/js/connessione.js; done
```
Per `suoni.js` e `server.mjs` usa `diff` senza `-q` e guarda solo le parti generiche. Scrivilo nel commit e aggiorna la skill se cambia un comportamento.

## 6. Sicurezza (già nel modello: non toglierla)

- **`host`**: predefinito `127.0.0.1`, cioè solo il PC della diretta. Per la regia da tablet: `"host": "0.0.0.0"` più `pinRegia`. Con un host diverso da `127.0.0.1` e senza PIN il server avvisa all'avvio.
- **`hostValido(req.headers.host)`**: accetta solo `localhost`, `127.x`, `::1`, `10.x`, `192.168.x`, `172.16–31.x`, `*.local`. Blocca il DNS rebinding (verificato: `Host: evil.example` → 403). Vale per HTTP e WebSocket.
- **Origin del WebSocket** (`verifyClient`): host valido e Origin assente o uguale all'host. Un sito esterno aperto nel browser della regia non può aprire `/ws` (verificato: 401).
- **API**: solo `POST` con `Content-Type: application/json` (altrimenti 415). Una pagina esterna non può mandare un form semplice; un `fetch` JSON richiede il preflight `OPTIONS`, che riceve 405. `GET` solo su `/api/stato`, in sola lettura.
- **PIN**: `esegui` confronta `pin` con `config.pinRegia`, sia dal WebSocket (`msg.pin`) sia dall'header `x-pin`. La regia lo chiede con `prompt` al primo errore «PIN» e lo tiene in `localStorage`. L'overlay non manda comandi e non ha bisogno del PIN.
- **Limiti**: corpo massimo 256 KB per l'API e 64 KB per il webhook (`leggiCorpo`). Testi tagliati da `pulisci`. `Object.hasOwn(comandi, nome)` blocca nomi come `constructor` (verificato). I file statici sono protetti dall'uscita dalla cartella (`file.startsWith(PUBBLICA + sep)`) e hanno `Access-Control-Allow-Origin: *`, perché LIVE Studio li scarica dalla sua app.
- **Webhook Nero**: server separato, in ascolto solo su `127.0.0.1:<portaWebhook>`, solo `POST /webhook/nero`. Firma `X-Nero-Signature` verificata con `firmaValida` (HMAC-SHA256 e `timingSafeEqual`); senza `nero.segreto` rifiuta tutto. Il tunnel ngrok espone solo questa porta, mai la regia.

## 7. API per Stream Deck

Ogni comando della regia è anche `POST http://127.0.0.1:<porta>/api/<comando>` con corpo JSON, header `Content-Type: application/json` e, se c'è `pinRegia`, `x-pin`. Risposte: 200 `{"ok":true,"dati":...}`, 400 `{"ok":false,"errore":"..."}` (comando sconosciuto, PIN, validazione), 405 (non POST), 415 (manca il Content-Type). `GET /api/stato` restituisce l'istantanea completa. L'elenco dei comandi con i corpi sta nella tabella «API» del README del modello: aggiornala a ogni comando nuovo.

```bash
curl -X POST http://127.0.0.1:4747/api/conferma -H "Content-Type: application/json" -d "{}"
curl -X POST http://127.0.0.1:4747/api/countdown -H "Content-Type: application/json" -d '{"azione":"aggiungi","minuti":5}'
# cmd di Windows: virgolette interne con \"  →  -d "{\"azione\":\"pausa\"}"
```

## 8. Trappole

- `pkill -f 'node server.mjs'` uccide anche la shell che lo lancia. `pkill -f '^node server\.mjs'` evita questo, ma ferma **tutti** i server overlay della macchina, compresi quelli di altri overlay o di altre sessioni (successo in prova). Ferma per porta: `kill $(lsof -ti tcp:<porta> -sTCP:LISTEN)`. `$!` dopo `cd … && node … &` è il PID della subshell, non di node.
- Una porta cambiata solo in `config.json` lascia `4747` nei testi di README, GUIDA e regia.
- Un campo nuovo non messo in `istantanea()` non arriva alle pagine. Un'impostazione non messa negli elenchi di `demo`/`nuovaSerata` si azzera con «Nuova serata».
- Un tipo di file assente da `TIPI` esce come `application/octet-stream`.
- **Giudici**: nel modello sono un oggetto `{ beat, voce, mix }`. `caricaConfig` scarta una lista scritta in `config.json` (`tuo.giudici && !Array.isArray(tuo.giudici) ? tuo.giudici : {}`) e la fusione `{ ...base.giudici, ...giudici }` trasforma una lista di base in un oggetto `{ 0, 1, 2 }`. `caricaStato` sostituisce una lista salvata con i giudici di config. Il nome di un ospite cambiato in `config.json` sparisce senza errori. Se il nuovo formato usa una lista, riscrivi quelle righe (es. `giudici: Array.isArray(tuo.giudici) ? tuo.giudici : base.giudici`) e togli la migrazione in `caricaStato`. Se cambi le chiavi, cambia anche il comando `giudici` (scorre `S.CATEGORIE`). Testa con un `config.json` che cambia un nome.
- Niente `color-mix()` nel CSS (Chromium vecchio in OBS e LIVE Studio): colori espliciti, come in `base.css`.
