# Overlay «Battle» — 4° layout della regia Backrooms

Data: 2026-10-06 · Stato: design approvato in chat, spec da rivedere

## 1. Obiettivo

Aggiungere a `overlay-live` il **4° layout**, `battle`: uno scontro tra due rapper in diretta su TikTok LIVE
(tela verticale 1080×1920), con barre della vita in stile Tekken che seguono il voto della chat in tempo reale,
camera orizzontale al centro divisa da uno spacco a fulmine con il VS, modalità di gioco, timer con gong, tre giudici
(Luca, Freya, Daniele), tabellone alternabile (torneo o classifica a punti) e pop-up social periodici.

Successo = la regia porta a termine una serata di scontri (3-2-1, battle, voti dei giudici, vincitore, avanzamento
nel torneo o nella classifica a punti) dalla pagina di regia o dallo Stream Deck, senza toccare i file a mano, e il
layout rispetta le zone di TikTok del PDF «Inquadrature live freestyle».

Scopo di business: far crescere pubblico e interazione delle live e portarle a prenotazioni di sessioni in studio
(obiettivo dello studio: 10.000 €/mese). Per questo i pop-up portano una CTA «Prenota la tua sessione».

## 2. Contesto e vincoli

- `overlay-live` è un progetto Node ≥ 22 **separato** dal sito Next.js (`studious-train`): server `server.mjs`
  (HTTP + WebSocket, porta 4747), logica pura in `lib/stato.mjs`, pagine in `public/` senza build, 57 test con
  `node --test`. Gira in locale sul PC della diretta e viene copiato come cartella.
- Layout esistenti: `gara` (`overlay.html`), `senzaPremio`, `studio`. Il battle è il 4°.
- Il codice viene aggiunto al repo in `overlay-live/` (senza `node_modules/`, `config.json`, `dati/`), sul branch
  `claude/practical-cannon-6wegnn`. I commit che non toccano il sito portano `[skip netlify]`.
- TikTok LIVE Studio accetta come sorgente Link solo indirizzi con un `.html`: la pagina è `/battle.html`.
- Tela 1080×1920, visibile sui telefoni circa x 104…976: tutto sta tra x 116 e 964. Zone TikTok (PDF): intestazione
  0–230, zona libera 230–1200, chat a sinistra e cuori/regali a destra 1200–1700, barra commenti 1700–1920.
- La camera è una sorgente di LIVE Studio **sotto** l'overlay: l'overlay disegna solo la grafica attorno e sopra.
- Stile: palette e font di `base.css` (nero, cromo, viola/magenta/ciano/oro, Barlow Condensed e Grenze Gotisch),
  logo `public/assets/logo-br.png`. Il logo VS è ridisegnato in SVG (giallo-arancio con fulmine, ispirato alla
  reference) **senza** i personaggi Capcom/Bandai dell'immagine allegata.

## 3. Fuori ambito (YAGNI)

- Nessuna integrazione con Nero.fan nel battle (il layout non usa la traccia in ascolto).
- Nessun voto con regali TikTok: la chat vota solo con comandi testuali.
- Nessun cambio di comportamento di `gara`, `senzaPremio` e `studio` (si estendono solo `LAYOUT`, `WIDGET`, le
  route del server, il selettore «In onda» della regia e le regole su chi suona).
- Nessun sorteggio oltre al mescolamento casuale dei partecipanti; nessuna apparizione automatica del tabellone
  dopo il round (lo accende la regia).
- Non si muove né si ritaglia il video: lo «spacco» è un divisorio grafico sopra la camera.

## 4. Griglia (pixel della tela 1080×1920)

| Pezzo | Posizione | Note |
|---|---|---|
| Barre della vita | y 282–372, x 116–964 | nome (124 px), barra (230), badge «CHAT VOTES» (108), barra (230), nome (124) |
| Modalità + timer | y 398–544 | modalità a sinistra (x 116–646), timer a destra (x 660–964) |
| Pop-up social | y 566–644 | pannello a comparsa, x 116–964 |
| Camera | y 656–1264, tutta larghezza | default 16:9 (1080×608), centrata. Posizione e altezza in variabili CSS: la scena attuale è ~4:3 (y≈550–1363) e si può adottare cambiando i numeri |
| Cornice | attorno alla camera | fili neon sopra e sotto a tutta larghezza, angoli a staffa a x 116/964, divisorio centrale |
| Box artisti | y 1100–1196 | dentro la camera, a sinistra x 116–520 e a destra x 560–964: nome + icona Instagram + handle |
| Giudici | y 1292–1442 | 3 box da 272 px con 16 px di spazio: Luca, Freya, Daniele |
| Barra voto chat | y 1456–1534 | «Vota in chat: 1 = nome · 2 = nome» |
| Countdown 3-2-1 | tutto schermo | prima del round |
| Tabellone | y 282–1534, x 116–964 | pannello opaco che copre camera e widget |

I giudici e la barra chat cadono nella zona chat di TikTok (1200–1700): compromesso accettato, già presente nella
gara con premio (tabellone a y 1236–1518). Tutte le posizioni stanno nel blocco di variabili in cima a `battle.css`,
come negli altri layout. Con `?guide=1` si vedono tagli dei telefoni e zone TikTok.

## 5. Regole del gioco (`lib/battle.mjs`, funzioni pure)

### 5.1 Fasi del round

`attesa` → `countdown` → `battle` → `voto` → `risultato`.

- `battleAvvia` (da `attesa`): richiede i nomi di entrambi i rapper. Passa a `countdown` e fissa `contoFinoAlle = ora + 3000`.
- Passaggio automatico a `battle` allo scadere del conto (controllo del server ogni 250 ms, come il countdown della
  gara): parte il timer, si apre la chat, evento `gong` con `{ quando: "inizio" }`. La pagina può quindi vedere
  spacco e gong fino a 250 ms dopo la fine del 3-2-1.
- Scadenza del timer, o `battleTermina`: si chiude la chat, fase `voto`, evento `gong` con `{ quando: "fine" }`.
- In `voto` la regia scrive i 6 voti (3 giudici × 2 rapper). `battleRivela` richiede tutti i voti presenti, calcola
  i totali e passa a `risultato`.
- Pausa e ripresa del timer solo in `battle`; la chat resta aperta.
- `battleProssimo` (da `risultato`): azzera round, chat e voti, svuota i nomi dei due rapper, torna ad `attesa` e
  incrementa il numero del round. Con il torneo attivo carica il prossimo scontro giocabile.
- `battleReset`: torna ad `attesa` scartando voti e chat del round in corso (la regia chiede conferma).

### 5.2 Chat

- Si apre in automatico al via e si chiude al gong finale: conta dal primo secondo.
- Comandi accettati (senza distinzione tra maiuscole e minuscole, con `!` facoltativo davanti): `1`, `2`, `sx`, `dx`.
  `1`/`sx` = rapper di sinistra, `2`/`dx` = destra. Un voto per utente, vale l'ultimo.
- Con il layout `battle` in onda il server usa questo lettore al posto di `leggiVoto` della gara (che leggerebbe
  «1» come punteggio 1). Con gli altri layout non cambia nulla.
- `quota = voti di quel rapper / voti totali`; senza voti 50/50. Le barre mostrano la quota (50/50 = entrambe a metà).
  La quota si congela alla chiusura della chat.

### 5.3 Punteggio

- Ogni giudice dà ogni voto da 0 a 10 con un decimale (stessa `normalizzaVoto` della gara).
- `chat(sx) = 10 × quota(sx)`, `chat(dx) = 10 × quota(dx)`.
- `totale(lato) = (voto Luca + voto Freya + voto Daniele + chat) / 4`, arrotondato a 2 decimali (25% ciascuno).
- Vince il totale più alto **come mostrato** (due decimali): due totali uguali sullo schermo sono un **pari merito**
  (correzione dopo la revisione: decidere sui totali non arrotondati poteva dare un vincitore con totali uguali
  sullo schermo). Il round resta in `risultato` con `pari: true` finché la regia non usa `battleProclama { lato }`.
- Una volta deciso il vincitore, il round viene **registrato una sola volta** (flag `registrato`) nel tabellone attivo.

### 5.4 Modalità

Elenco modificabile `modalita.elenco` di voci `{ id, nome, conTesto, testo, attiva }`. Di partenza: Stile libero,
Tre quarti, Tematica (conTesto: il tema), Anni '90, Beat a scelta, Situazione (conTesto: la situazione) e uno slot
custom (spento, senza nome, da compilare). La regia può rinominare, accendere/spegnere, aggiungere voci (massimo 10 in
tutto) e sceglie quella in onda con `modalita.scelta`. In onda compare solo la modalità scelta, con il suo testo.

### 5.5 Timer

`timer = { durataSecondi, fineAlle, rimanenteMs, scaduto }`, stessa forma e stesse regole di pausa/ripresa del
countdown della gara. Default 90 s, con scorciatoie 60/90/120/180 nella regia; qualsiasi valore da 10 a 600 s.
Negli ultimi 30 s la pagina lo mostra rosso e lampeggiante.

### 5.6 Torneo (tabellone A)

- 4 o 8 partecipanti (nomi, e Instagram facoltativo): con 8 si gioca quarti, semifinali, finale; con 4 semifinali e
  finale. Il pulsante *Sorteggia* mescola l'ordine, altrimenti valgono gli accoppiamenti 1-2, 3-4, 5-6, 7-8.
- Struttura: `partite = [{ id, turno, sx, dx, vincitore, totali }]`. Registrando il round il vincitore passa nella
  partita successiva. `battleProssimo` carica la prima partita con entrambi i rapper noti e non ancora giocata.
- Con il torneo attivo, `torneoCarica { id }` carica una partita a scelta.

### 5.7 Classifica a punti (tabellone B)

- Elenco di artisti `{ nome, punti, round: [..] }` (massimo 10) e un `target` (default 30, modificabile).
- Registrando un round i **totali di entrambi** i rapper (0–10) si sommano ai loro punti.
- Vince il primo che raggiunge il target; se due lo raggiungono nello stesso round, il totale più alto di quel round.
  Il vincitore resta in `punti.vincitore` e il tabellone mostra il banner.

## 6. Stato, server e API

`stato.battle` (nuova sezione, unita agli stati salvati con `fondiBattle` come `fondiStudio`):

```
battle: {
  fase, round, partitaId,
  sx: { nome, instagram }, dx: { nome, instagram },
  modalita: { scelta, elenco },
  timer: { durataSecondi, fineAlle, rimanenteMs, scaduto },
  conto: { finoAlle },
  chat: { aperta, voti: { [chiave]: "sx" | "dx" } },
  giudici: [{ id, nome, voti: { sx, dx } }],            // luca, freya, daniele
  risultato: { rivelatoAlle, totali, parziali, vincitore, pari, registrato },
  tabellone: { modo: "torneo" | "punti", torneo, punti },
  popup: { elenco, ogniMinuti, durata },
}
```

L'istantanea inviata alle pagine aggiunge `quota` calcolata. Salvataggio in `dati/stato.json` come ora.

- `LAYOUT` diventa `["gara", "senzaPremio", "studio", "battle"]`; `PAGINE` aggiunge `/battle` e `/battle.html`.
- Nuovi widget (nomi diversi dal `tabellone` della gara): `barreVita`, `modalita`, `timerBattle`, `giudiciBattle`,
  `popupBattle`, `bracket`.
- Il messaggio di avvio del server stampa anche l'indirizzo del battle.
- `nuovaSerata` azzera round, chat, risultato, torneo e punti, e **conserva** nomi dei giudici, modalità, durata del
  timer e pop-up (come già fa per `studio` e `senzaPremio`).

Comandi (tutti anche via `POST /api/<comando>` per Stream Deck, con lo stesso PIN):

| Comando | Corpo |
|---|---|
| `layout` | `{ nome: "battle" }` (esistente, accetta il nuovo valore) |
| `battleScontro` | `{ sx: { nome, instagram }, dx: { nome, instagram } }` |
| `battleModalita` | `{ scelta?, testo?, elenco? }` |
| `battleTimer` | `{ durataSecondi }` e `{ azione: "pausa" \| "riprendi" }` |
| `battleAvvia`, `battleTermina`, `battleReset`, `battleProssimo` | `{}` |
| `battleVotoGiudice` | `{ giudice, lato: "sx" \| "dx", valore }` |
| `battleGiudici` | `{ luca?, freya?, daniele? }` (nomi) |
| `battleRivela` | `{}` |
| `battleProclama` | `{ lato }` (solo con `pari`) |
| `tabellone` | `{ modo?, visibile? }` |
| `torneo` | `{ partecipanti, azione: "crea" \| "sorteggia" \| "azzera" }`, `torneoCarica { id }` |
| `punti` | `{ artisti?, target?, azzera? }` |
| `battlePopup` | `{ elenco?, ogniMinuti?, durata?, id? }` (con `id` mostra quel pop-up) |
| `battleDemo` | `{ fase }`: dati di prova in quella fase, per mockup e prove |

Errori espliciti in italiano, come gli altri comandi (es. «Mancano i voti di Freya», «Mancano i nomi dei rapper»).

## 7. Pagina del battle (`/battle.html`)

File: `public/battle.html`, `public/css/battle.css`, `public/js/battle.js` e `public/js/battle-logica.js` (parti
pure: frazione delle barre, etichetta del timer, sequenza della rivelazione, giro dei pop-up; testate).
Come `studio`: classe `verticale bt`, scala automatica del palco, parametri `?anteprima=1` (sfondo nero e finta
camera), `&guide=1`, `&statico=1`, `&fase=` (per i mockup), `?w=` per separare le parti
(`barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone`).

- **Barre della vita**: smussate, crescono dal centro verso i nomi; transizione fluida; % su ogni barra.
- **Camera**: cornice attorno (fili neon, staffe d'angolo). Al gong d'inizio un fulmine verticale attraversa il
  centro, lascia un divisorio luminoso e il VS (SVG) entra con urto e onda d'urto.
- **Countdown 3-2-1**: numeri enormi a tutto schermo; dopo l'1, «VIA!», gong e spacco.
- **Timer**: grande; rosso e lampeggiante negli ultimi 30 s; a zero effetto grafico del gong (onda d'urto e «STOP»).
- **Giudici**: box con nome e «?» finché non si rivela. Alla rivelazione i voti compaiono in sequenza
  Luca → Freya → Daniele → Chat → Totale con conteggio animato (stesso stile della gara con premio) e il vincitore
  si illumina d'oro. Con `pari` compare «PARI MERITO» finché la regia non proclama.
- **Pop-up**: Back Rooms Studio («Prenota la tua sessione · backroomsstudio.it · @backrooms.studios», col logo) e
  Rime Vicentine (Instagram). Ogni 4 minuti per 10 s, a giro (riuso della logica delle comparse dello studio).
  Non compaiono durante `countdown`, `voto` e `risultato`. Testi modificabili dalla regia. L'handle Instagram di
  Rime Vicentine non è stato fornito: resta vuoto (si mostra solo il nome) finché la regia non lo scrive.
- **Tabellone**: pannello che copre la tela con transizione. Torneo: albero verticale (quarti in alto, semifinali,
  finale con trofeo), partita in corso evidenziata, vincitori in oro. Punti: tabella ordinata con punti di ogni round,
  totale grande e barra verso il target.
  Si accende e si cambia da regia (`tabellone`); si nasconde da solo quando parte un countdown.

## 8. Suoni

Nuovi effetti in `suoni.js` (sintetizzati con Web Audio, nessun file): `gong`, `conto` (bip del 3-2-1, più acuto
sull'1) e `spacco` (schiocco del fulmine). Si riusano `allarme` (a 30 s dalla fine), `tic` (ultimi 10 s), `voto`,
`calcolo`, `risultato` e `vincitore`. I pop-up non suonano. La funzione pura `suoniBattle(prima, dopo, eventi)` in
`eventi-sonori.js` decide quando partono (testata). Sirena a 30 secondi e tic degli ultimi 10 suonano dal ciclo della
pagina (ogni 50 ms; nella regia ogni 250 ms) con `suoniTimerBattle` e `msTimerBattle`, non dagli aggiornamenti dello
stato: con la chat ferma il server non manda aggiornamenti per tutto il round. Suona solo la pagina del layout in onda,
con le stesse opzioni di destinazione (overlay / regia / spenti) della gara; il layout `studio` resta senza suoni.

## 9. Regia

Nuova sezione *Battle* in `regia.html` / `regia.js`, visibile e attiva con il layout `battle` (come `studio`):

1. **Scontro**: nomi e Instagram dei due rapper (con scelta rapida dal torneo o dall'elenco dei punti).
2. **Modalità**: chip selezionabili, campo testo per Tematica e Situazione, modifica dell'elenco.
3. **Timer**: durata, scorciatoie 60/90/120/180, Avvia (3-2-1), Pausa/Riprendi, Termina.
4. **Giudici**: nomi e i 6 campi voto, **Rivela**, **Proclama** (attivo solo con pari merito).
5. **Tabellone**: interruttore mostra/nascondi, scelta Torneo/Punti, setup del torneo (partecipanti, Sorteggia), elenco
   artisti e target della classifica a punti, Azzera.
6. **Pop-up**: elenco modificabile, intervallo, durata, «Mostra ora».
7. **Anteprima** in iframe della pagina e link a quella grande con le zone.

Il selettore «In onda» in testata aggiunge «Battle». Scorciatoie con il battle in onda: `F2` avvia il round,
`F4` rivela, `F8` prossimo scontro, `F9` pausa/riprendi (le altre pagine mantengono le scorciatoie di prima).

## 10. Verifica

- **Test automatici** (`npm test`, nuovi file `test/battle.test.mjs`, `test/battle-logica.test.mjs`, estensione di
  `test/eventi-sonori.test.mjs`): lettore della chat, quote, totali e pari merito, transizioni di fase e comandi
  non validi, avanzamento del torneo, punti e target (anche con due artisti oltre il target), unione degli stati
  salvati vecchi, suoni in ogni fase. I 57 test esistenti devono restare verdi.
- **Prova end-to-end** del server: avvio, voti dei giudici e della chat via WebSocket/API, risultato.
- **Screenshot 1080×1920** con Playwright per ogni fase e per i due tabelloni, salvati in `mockup/battle-*.jpg`
  (convenzione dei mockup esistenti), controllati contro la griglia della sezione 4 e le zone del PDF.
- **Limite dichiarato**: da qui non si può aprire TikTok LIVE Studio. Le posizioni sono misurate sulle zone del PDF e
  sullo screenshot della scena; la prova con la camera vera la fa la regia, regolando le variabili CSS se serve.

## 11. Fasi di consegna (un commit per fase, sul branch di sviluppo)

1. **Regole e server**: importazione di `overlay-live` nel repo, `lib/battle.mjs` con test, layout, route, comandi,
   instradamento della chat, persistenza e migrazione dello stato.
2. **Pagina e regia**: `battle.html/css/js`, suoni, pop-up, sezione Battle della regia, mockup della fase.
3. **Tabellone**: torneo e classifica a punti (pagina e regia), mockup, README e guida aggiornati.

Alla fine: README con sezione «Battle» e API aggiornata, e uno zip dell'`overlay-live` aggiornato (senza
`node_modules`) da copiare sul PC della diretta.

## 12. Rischi

- **Chat TikTok sopra i giudici**: con chat molto attiva i commenti coprono la parte sinistra dei box (accettato).
- **Camera 16:9 vs 4:3**: il default è 16:9; se la scena resta ~4:3 si regolano le variabili CSS e i pezzi sopra e
  sotto si riposizionano con le stesse.
- **Font da Google Fonts**: serve Internet sul PC della diretta, come per le altre pagine.
- **Scarto di 250 ms** tra fine del 3-2-1 e spacco, dovuto al controllo periodico del server (accettabile per una
  diretta TikTok, che ha comunque più secondi di ritardo).
