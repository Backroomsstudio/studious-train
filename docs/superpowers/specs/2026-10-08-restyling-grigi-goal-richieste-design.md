# Restyling in grigi, San Francisco, Goal e richieste con regalo — overlay-live

Stato: da approvare (il design è stato approvato in chat il 2026-10-08). Poi il piano, poi l'esecuzione sullo stesso branch (`claude/practical-cannon-6wegnn`, PR #1 aperta: si aggiorna da sola).

## 1. Obiettivo

Portare tutti i layout di `overlay-live` a un'unica identità neutra e leggibile e chiudere le richieste arrivate col brief del 2026-10-08:

- **Comune**: San Francisco su ogni scritta di ogni layout; scala di grigi (restano solo oro, rosso e smeraldo, dove servono a capire); widget **Goal Like e Follower** in tutti i layout.
- **Live con Premio**: voti 4–10, chat al 10%, nomi dei giudici e delle quattro voci modificabili, blocco voti sopra i commenti di TikTok, classifica più leggibile, **tabellone ad albero** stile Champions League.
- **Senza premio**: spot dall'alto, «Ora in ascolto» fissa con colori per tipo, banner leggibile, artista in grande con Instagram.
- **Live session in studio**: intestazione grande, comparse in San Francisco.
- **Reaction della Settimana**: scaletta semitrasparente, richieste con regalo TikTok.
- **Batteria (Drum)**: striscia a scorrimento, istruzione su una riga, camera non schiacciata, niente «Brano segreto», scaletta a campi, regalo configurabile.
- **Studio Production e Podcast**: scritte più grandi e centrate, ogni dicitura modificabile, titoli salvati.
- **Battle**: «Voto Chat».

Nomi che ho abbinato: Live con Premio = gara (`/overlay.html`), Senza Premio = `/senza-premio.html`, Tripla CAM = Live session in studio (`/studio.html`), Batteria = Drum Challenge Live (`/drum.html`), Reaction della Settimana = Reaction Release (`/reaction.html`), Battle Freestyle = Battle (`/battle.html`).

## 2. Come ho letto il brief (decisioni prese)

Ognuna ha il suo costo se è sbagliata.

1. **Font su tutto, premio e classifica compresi.** Il brief teneva «Mix Master» solo su premio e classifica; alla domanda su quale font tenere lì hai risposto «per tutte le scritte di ogni layout usa San Francisco». Ho seguito l'ultima indicazione: San Francisco anche lì. Esiste una variabile separata `--font-premio` (oggi uguale al font di sistema) per tornare a un decorativo solo su premio e classifica. Costo se sbagliata: una riga di CSS.
2. **San Francisco non si può distribuire.** Apple ne vieta la distribuzione fuori dai suoi prodotti: non lo metto nella cartella. Lo stack di font prova `-apple-system` e «SF Pro» (Mac, iPhone, o installato a mano) e ripiega su **Inter** (quasi identico, gratuito), caricato dallo stesso link di Google Fonts che già usiamo. Sul PC Windows della diretta, senza SF Pro installato, si vede Inter. Costo: sul PC della diretta la scritta non è letteralmente SF.
3. **Scala di grigi con tre eccezioni.** Restano oro (premio, podio, vincitore, Super Skip), rosso (ultimi minuti del timer, pallino LIVE) e verde smeraldo (Skip, sblocco del Drum). Viola, magenta, ciano, blu e ogni verde diverso dallo smeraldo diventano grigi (arancio e ambra restano solo come oro e bronzo del podio); sfondi con riflessi viola diventano neri neutri. Lo garantisce un test sul codice (§4.3). Costo: se volevi anche oro e rosso in grigio, è una tabella in un file.
4. **La regia non cambia nei colori** (è il pannello dell'operatore, non un overlay). Usa lo stesso font di sistema.
5. **Tabellone «Champions League» = albero con i punteggi.** Come hai scelto: disegno ad albero costruito dalla classifica, senza scontri veri.
6. **Richieste con regalo: il brano lo scrive la regia a mano.** Il regalo mette in coda il nome di chi ha donato; il titolo non si prende dalla chat.
7. **Soglie del Drum solo a Like.** Per le condivisioni non ho modo di verificare un totale affidabile (arrivano come singoli eventi). Costo: se le vuoi, è una seconda scaletta da aggiungere.
8. **«Tutti i brani sempre visibili» = nessun titolo nascosto.** La colonna continua a mostrare quattro moduli (l'ultimo sbloccato, l'attivo e i due dopo); non c'è più «Brano segreto». Senza titolo il modulo dice «Da definire».
9. **Instagram da Nero.fan non verificabile da qui** (la rete di questa sessione blocca nero.fan). Cerco i nomi più probabili del campo e aggiungo un campo a mano in regia.
10. **Follower da TikTok non verificabili con una live vera.** Si contano gli eventi «follow» e, se il messaggio porta il totale, quello vale; in regia c'è la correzione a mano.
11. **Nome del regalo in inglese.** TikTok manda il nome del regalo nella sua lingua interna (di norma inglese, «Rose»): il campo accetta nome o ID e la regia mostra «Regali visti» da cui sceglierlo con un clic.
12. **«Titoli salvati».** «Oltre ai 3 titoli predefiniti» lo leggo come: i tre restano e se ne possono salvare altri (fino a 6) da riusare.
13. **«Layout full-page/prominente» per l'artista.** Lo leggo come: il nome dell'artista diventa la riga principale e più grande della scheda «Ora in ascolto», non una schermata a tutto schermo. Costo: se volevi una schermata intera per ogni traccia, è un elemento nuovo.

## 3. Fuori ambito (YAGNI)

Trascinare il Goal con il mouse (si regola con X, Y e dimensione); soglie a condivisioni; leggere il brano richiesto dai commenti; cambiare l'aspetto della regia; font inclusi nella cartella; altre lingue; suoni nuovi.

## 4. Fondamenta comuni: font, palette, misure

### 4.1 Font (`public/css/base.css` e le sette pagine overlay)

```
--font-sistema: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "San Francisco", Inter, "Segoe UI", system-ui, sans-serif;
--font-dati:   var(--font-sistema);
--font-gotico: var(--font-sistema);
--font-premio: var(--font-sistema);   /* solo premio e classifica della gara */
```

Le pagine caricano `Inter` (pesi 500–900) al posto di Barlow Condensed e Grenze Gotisch. Nessun altro `font-family` nei fogli degli overlay. Corpi, altezze dei riquadri e minimi di restringimento si ricalcolano per San Francisco/Inter (più larghi del vecchio font stretto): con `adattaTesto` restano all'interno, ma i corpi di partenza (100%) cambiano e vanno riscritti nel README. Maiuscole, spaziature e `letter-spacing` si rivedono dove il vecchio font era condensato.

### 4.2 Palette

- Variabili di `base.css`: `--viola`, `--viola-chiaro`, `--magenta`, `--ciano`, `--blu` spariscono; entrano `--accento` (grigio chiaro), `--accento-forte` (bianco), `--vetro-*` e `--grigio-*` (rampa 0–100). Restano `--oro*`, `--podio-*`, `--rosso*`, `--smeraldo*` e il cromo.
- Ogni colore con tinta nei fogli, nelle pagine (compresi gli `stop-color` degli SVG) e negli script degli overlay passa a un grigio neutro della stessa luminosità; i neri tinti di viola (`#150c28`, `#0a0714`…) diventano neri neutri. Gradienti, ombre, aloni e riflessi restano, in grigi.
- Gli effetti 3D (targa cromata, estrusione, monete BR, cornici a staffe, vetro con luce nel terzo alto) restano come strutture; neon e aloni diventano bianchi o grigi.
- Colori ammessi con tinta: **oro/bronzo** (tinta 15°–60°, per premio, podio, vincitore, Super Skip), **rosso** (345°–15°, ultimi minuti e pallino LIVE) e **smeraldo** (135°–170°, Skip e sblocco del Drum). Le bande del Battle destra/sinistra, oggi ciano/magenta, diventano bianco e grigio medio, con i nomi a distinguerle.

### 4.3 Test di palette e di font (`test/palette.test.mjs`)

Legge i fogli `public/css/*.css`, le pagine `public/*.html` e gli script `public/js/*.js`, tranne la regia (`regia*`). Per ogni colore scritto (esadecimale, `rgb()`, `rgba()`, `hsl()`) controlla che sia neutro (differenza tra canale massimo e minimo ≤ 10 su 255) oppure nella tinta di oro/bronzo, rosso o smeraldo. Fallisce con file, riga e colore. Un secondo controllo verifica che nei fogli e negli script degli overlay non compaia più nessun `font-family` (né `ctx.font` o `font:` con un nome proprio) diverso da `var(--font-*)` e che le pagine non carichino più Barlow o Grenze.

### 4.4 Misure dei testi

Gli strumenti `mockup-formati.mjs` e `mockup-battle.mjs` restano il controllo di geometria; si estendono con il controllo sui pixel delle lettere tagliate (già presente) alle nuove scatole. Nessun testo può sporgere dal suo riquadro con il cursore al 100% e al 200%.

## 5. Widget Goal (like e follower)

Un solo widget, `goal`, in **tutti** i layout (anche 16:9 di Podcast e Reaction). Due righe, scritte esattamente così:

- «Mancano **X** like al nuovo obiettivo»
- «Mancano **Y** follower al nuovo obiettivo»

### 5.1 Calcolo (`lib/goal.mjs`, funzioni pure)

- Stato: `goal = { like: { obiettivo: 15000, passo: 1000 }, follower: { obiettivo: 50, passo: 10, totale: null }, modo: "fisso" | "comparsa", ogniMinuti: 5, durataSecondi: 15, posizioni: {…} }`.
- **Like**: il conteggio è quello già tenuto per il Drum (`contati(stato.drum)`: totale di TikTok meno la partenza più le correzioni a mano), perché si aggiorna già da ogni evento «like» qualunque layout sia in onda. Con «Riparti da ora» o «Nuova serata» del Drum riparte anche il Goal.
- **Follower**: `totale` è l'ultimo valore noto. Un evento «follow» somma 1; se il messaggio porta `followCount` (testo di sole cifre) e questo è maggiore del totale noto, il totale diventa quello (mai verso il basso). In regia si imposta o si aggiunge a mano. Con `totale` sconosciuto la riga dei follower non va in onda (in regia c'è l'avviso «Imposta i follower di adesso»).
- **Nuovo obiettivo**: `obiettivoAttuale(totale, obiettivo, passo)` = `obiettivo` finché `totale < obiettivo`; altrimenti, con `passo > 0`, il primo multiplo del passo maggiore del totale; con `passo = 0` resta `obiettivo` e la riga dice «Obiettivo raggiunto!». Mancano = `obiettivoAttuale − totale`, mai sotto 1 con passo > 0. Numeri con il punto delle migliaia («1.250»).
- Limiti: obiettivo 1–10.000.000.000, passo 0–1.000.000, durata 5–120 s, ogni 1–60 minuti.

### 5.2 Comportamento in pagina (`public/js/goal.js` + `public/css/goal.css`, caricati da tutte le pagine overlay)

- **Fisso**: sempre in onda quando `visibili.goal` è acceso. **A comparsa**: entra con un breve scorrimento ogni `ogniMinuti` e resta `durataSecondi`; *Mostra ora* lo fa comparire a comando. Mai due comparse sovrapposte.
- Vetro neutro, numeri grandi, SF; i due numeri cambiano con un breve scatto. Si vede ma non copre nulla di importante nelle posizioni di partenza.
- **Posizione libera**: ogni layout ha la sua `posizioni[layout] = { x, y, scala }` (pixel della tela, scala 60–200%; Podcast e Reaction anche `podcastO` e `reactionO` per l'orizzontale). Le posizioni di partenza stanno in una zona libera di ciascun layout e le sceglie e controlla il piano nei mockup. In regia: X, Y, scala, frecce per spostare di 8 px, «Ripristina posizione». Il widget non esce mai dalla tela (si limita ai bordi).
- Nelle pagine: un nodo `<section data-widget="goal">` che segue lo stato; la posizione è `translate` sulla tela scalata, così segue anche il ridimensionamento delle sorgenti.

### 5.3 Regia (sezione «Goal Like e Follower», sopra le sezioni dei layout)

Obiettivo e passo per like e follower, follower di adesso (imposta e +1/+10), modo fisso/a comparsa con le due durate, *Mostra ora*, posizione del layout in onda (X, Y, scala), «Ripristina», anteprima dei due contatori. Il widget si accende e spegne in *In onda* (nome `goal`).

## 6. Eventi TikTok nuovi (`lib/chat.mjs`, `lib/regali.mjs`)

### 6.1 Regali

`avviaTikTok(…, { suLike, suNuovaConnessione, suRegalo, suFollow })`. `regaloTikTok(dati)` (pura) dà `{ utente, nome, id, quantita }` oppure `null`:

- Schema installato (proto v3): `dati.gift.name`, `dati.gift.type`, `dati.giftId` (testo), `dati.repeatCount`, `dati.repeatEnd` (numero 0/1), `dati.user.displayId`. Ripiego sui nomi del vecchio schema: `dati.giftDetails.giftName`, `giftType`, `user.uniqueId`.
- Un regalo «a serie» (`type === 1`) conta **una sola volta**, alla fine della serie (`repeatEnd` vero), con `quantita = repeatCount`; gli altri contano subito. Un evento senza nome né ID, o senza utente, dà `null`.
- Un test costruisce un messaggio codificato come lo fa la libreria (come per i Like) e verifica che il parser lo legga; le prove dal vivo con TikTok non sono possibili qui.

### 6.2 Follower

`followTikTok(dati)` → `{ utente, totale|null }` da `user` e `followCount` (solo cifre, 1–15). Si collega all'evento `follow` della libreria.

### 6.3 Regali visti e richieste

- `lib/regali.mjs`: `regaloCorrisponde(regalo, mappatura)` (confronto senza maiuscole sul nome, oppure sull'ID se la mappatura è un numero), coda di richieste con stato (`attesa` → `inOnda` → `fatta`, oppure scartata), massimo 30 in coda (le più vecchie escono), elenco «regali visti» (ultimi 12 nomi/ID distinti con l'ultimo utente).
- Due code separate, quella della Reaction (§10) e quella del Drum (§11): stesso modulo, mappatura diversa. Una mappatura vuota non fa partire nessuna richiesta.
- Server: il regalo ricevuto aggiorna «regali visti» e, se corrisponde, aggiunge una richiesta. Tutto con le stesse regole di robustezza dei Like (eccezioni catturate, messaggi rotti ignorati).

## 7. Live con Premio (gara)

### 7.1 Votazione (`lib/stato.mjs`, `lib/chat.mjs`, `lib/validazione.mjs`)

- Nuovo stato salvato `votazione = { pesi, min, max, etichette }`, con i valori di partenza da `config.json` (`pesi`, `votoMin`, `votoMax`, `etichette`) e modificabile dalla regia. Predefiniti: **pesi `{ beat: 3, voce: 3, mix: 3, chat: 1 }` (30/30/30/10 %)**, **min 4, max 10**, etichette `{ beat: "Beat", voce: "Voce", mix: "Mix", chat: "Chat" }`. I pesi sono relativi: la regia mostra la percentuale che ne risulta. Le categorie senza voto continuano a non pesare.
- `normalizzaVoto(valore, { min = 0, max = 10 })`: la gara usa quelli della votazione; il Battle resta 0–10. L'errore dice «Il voto deve essere tra 4 e 10».
- `leggiVoto(testo, { min, max })`: i commenti della chat con un voto fuori range si ignorano (compresa la forma `!voto 3`); `9/10`, `7,5` e `!voto 8` restano validi.
- «Vota in chat da **4** a **10**» segue il range. Il totale resta «/10».
- Nomi dei giudici (già in `giudici`) e le quattro voci dei rettangoli modificabili in regia, *Serata → Voti*. Le etichette hanno massimo 12 caratteri e non possono mancare.
- Comando `votazione` (§14). Gli stati salvati prima di questa versione ricevono i predefiniti nuovi (pesi 3/3/3/1, 4–10); i risultati già confermati restano come sono.

### 7.2 Geometria

Premio (y 282, 156), classifica (y 454, 392) e timer (y 454, 132) **non si muovono**. Il blocco voti (tabellone + barra «Vota in chat») sale in modo che il fondo della barra stia a **y 1196**, appena sopra i commenti di TikTok (che partono da 1200). Numeri di partenza: tabellone y 858 alto 260 (era 1236, 282), barra y 1130 alta 66 (era 1530, 78), con 12 px tra i due come oggi; il fondo della barra è 1130 + 66 = 1196. Dentro il tabellone i quattro rettangoli e il titolo si ricompongono sulla nuova altezza. Nessuna sovrapposizione con la classifica (che finisce a 846): lo verifica il controllo di geometria.

### 7.3 Classifica e tabellone

Tutti i testi in San Francisco (`--font-premio` per premio e classifica, uguale al sistema). Righe della classifica, titolo e nomi delle categorie ingranditi al massimo che entra nel riquadro, con `adattaTesto` su ogni riga (nome della traccia, artista, punteggio) e minimi fissati. L'artista nel tabellone mostra anche `@instagram` se c'è (§8).

### 7.4 Tabellone ad albero (`lib/albero.mjs`, `public/js/albero.js`, `public/css/albero.css`)

- `costruisciAlbero(risultati, { massimo: 16 })` (pura): ordina i risultati confermati della serata come la classifica (totale, poi chi è stato confermato prima), prende i primi 16 (gli altri restano fuori con la nota «+N»), porta il numero alla potenza di due successiva (4, 8 o 16) con posti vuoti («—») che danno il passaggio al compagno, accoppia le teste di serie come nei tabelloni (1 contro l'ultima, 2 contro la penultima, in modo che 1 e 2 si incontrino solo in finale) e fa avanzare chi ha il **punteggio più alto**. Con meno di 2 risultati dà `null`.
- Dà `{ dimensione, turni: [{ nome, partite: [{ a, b, vince }] }], esclusi }`; ogni lato porta titolo, artista, totale e posto in classifica. È solo un disegno: nessuno scontro vero, nessuna regola in più.
- Pagina: un riquadro `data-widget="albero"` da y 282 a y 1196 (x 116–964, 848 × 914), che sta **sopra** premio, classifica, timer, notifiche e blocco voti mentre è acceso (con 16 partecipanti le righe sono alte ~50 px). Rami in orizzontale (turni da sinistra a destra), nomi e punteggi nei rettangoli, il vincitore del turno evidenziato in oro, la finale con il trofeo. Entrata a fasi (un turno dopo l'altro, 0,5 s ciascuno) e si ridisegna da sola quando la classifica cambia. Con `?statico=1` compare tutto subito.
- Si accende da *In onda → Tabellone ad albero* oppure dal pulsante *Mostra* nella regia; parte spento; si spegne da solo dopo `durataSecondi` (30; 0 = resta finché non lo spegni). Comando `albero` (§14).

## 8. Senza premio

- **Spot studio dall'alto**: la scheda dello spot scende dall'alto (parte sopra il suo posto, 0,6 s, con la stessa curva morbida della salita) e dopo i suoi 10 secondi risale, poi torna la scheda della traccia. Non conta come traccia.
- **«Ora in ascolto» fissa**: nuovo `senzaPremio.schedaFissa = true`. Con la scheda fissa non c'è scomparsa automatica: resta finché arriva un'altra traccia o la regia la nasconde (*In onda → Scheda*, che c'è già). `schedaFissa: false` riporta i tempi per tipo (`durate`, 4–20 s), che restano come opzione «a tempo». Uno spot con la scheda fissa la sostituisce per 10 secondi e poi la scheda della traccia torna a entrare.
- **Colori per tipo** (sfondo pieno, solo CSS; i valori sono di partenza e si rifiniscono nei mockup):
  - Gratis (`standard`): grigio vetro neutro (il colore di oggi, convertito).
  - Skip: sfondo **verde smeraldo** (`#0b6e4f → #14a36f`), testo bianco.
  - Super Skip: sfondo **oro** (gradiente `#fff1b8 → #f2b52a → #c98a0c`), testo nero.
  - Throne: **cromo pieno** (gradiente metallico bianco/grigio/nero/bianco come `--cromo`, bordo cromato, riflesso che scorre), testo **nero**, con la corona e le punte (anch'esse grigie e oro).
- **Banner** (`MANDACI` / `La tua musica!` / `Link in bio`): `Mandaci` e `La tua musica!` in San Francisco **bianco** molto più grandi (corpo del titolo da ~96 px, `Mandaci` da ~34 px), la pillola `Link in bio` in San Francisco bianco su fondo scuro neutro; resta `nero.fan/backrooms` in oro. I testi restano modificabili dalla regia come oggi.
- **Artista e Instagram**: nella scheda il nome dell'artista diventa la riga principale (corpo massimo che entra, in grassetto, adattato con `adattaTesto`), il titolo sotto in corpo più piccolo, e sotto il nome `@instagram` con la sua icona se c'è. L'handle arriva da Nero (`lib/nero.mjs` cerca nell'ordine `submitterInstagram`, `submitterInstagramHandle`, `instagram`, `submitter.instagram`, `submitter.socials.instagram` nella traccia in riproduzione e nel webhook, e passa per `pulisciInstagram`), oppure si scrive a mano in regia (*In ascolto → Instagram dell'artista*, comando `correggiTraccia { instagram }`). Un handle scritto a mano vale finché la traccia non cambia. Lo mostra anche il tabellone della gara.
- La scheda cresce di quanto serve (il nome ha la riga più alta); si controlla nel mockup che non sporga dalla zona libera.
- I testi fissi della scheda («Ora in ascolto») e della barra («Oggi abbiamo ascoltato», «In studio ora») diventano campi (§12).

## 9. Live session in studio

- La linguetta «Live session in studio» sopra il nome dell'artista (`.st-etichetta`) diventa molto più grande: corpo da ~34 px, bianco pieno su cromo scuro, linguetta più larga e alta, con il pallino rosso; il testo resta modificabile (campo `etichetta`) e si adatta alla linguetta. La targa non si sposta oltre le sue zone: il controllo di geometria verifica che linguetta e nome stiano nella targa.
- «Scrivici in DM» e tutte le comparse in San Francisco (titolo, riga sopra, riga sotto), con gli stessi corpi o più grandi dove entra.
- Tutto in grigi; cromo, estrusione e monete restano.

## 10. Reaction della Settimana

### 10.1 Scaletta (`reaction.scaletta`)

`{ titolo: "In scaletta stasera", voci: [], modo: "fisso" | "comparsa", ogniMinuti: 5, durataSecondi: 15 }`. Fino a **8 voci** da 60 caratteri, titolo 32. Pannello di vetro **semitrasparente** (fondo ~55%) con le voci numerate; fisso in onda oppure a comparsa come il Goal; widget `reScaletta` (parte acceso, ma non mostra nulla finché l'elenco è vuoto). Posizione di partenza: verticale sotto la targa (x 116, y 500, 848 × fino a 8 righe da 52), orizzontale a destra sopra lo schermo. Dalla regia: elenco (una voce per riga), titolo, modo, *Mostra ora*.

### 10.2 Richieste con regalo (`reaction.richieste`)

- Campo **«Regalo per la richiesta»** (`reaction.regalo`: nome o ID del regalo TikTok, vuoto = richieste spente) e l'elenco **Regali visti** da cui sceglierlo con un clic.
- Quando arriva quel regalo, in regia compare in coda «@nome · Rosa ×1». La regia scrive il brano e preme *In onda*: sull'overlay compare una fascia «Richiesta di @nome: Titolo — Artista» per `durataRichiesta` (10 s) sotto la targa; *Fatta* chiude, *Scarta* toglie. Widget `reRichiesta`.
- Stato salvato (la coda sopravvive al riavvio, la nuova serata la svuota).

## 11. Batteria (Drum)

### 11.1 Layout (numeri di partenza, pixel della tela 1080×1920; li conferma il controllo di geometria)

| Pezzo | x | y | larghezza × altezza |
|---|---|---|---|
| **Striscia a scorrimento** (nuova) | 116 | 282 | 848 × 60 |
| **Istruzione su una riga** (sostituisce «Dona un…») | 116 | 350 | 848 × 52 |
| Camera (finestra, cornice a staffe) | 116 | 414 | 536 × 714 |
| Contatore dei Like | 676 | 414 | 288 × 64 |
| Colonna dei traguardi (4 moduli da 288 × 150, passo 164) | 676 | 486 | 288 × 642 |
| Banner di sblocco | 116 | 560 | 536 × 170 |
| Equalizzatore | 116 | 1140 | 848 × 56 |
| Fascia social | 0 | 1204 | 1080 × 92 |

La camera e la colonna dei Like (con il contatore) iniziano e finiscono alla stessa altezza (414 → 1128): la finestra della camera è 3:4 e non più schiacciata (era 524 × ~520). Equalizzatore e fascia social scendono. In LIVE Studio la camera va nella finestra (x 116, y 414, 536 × 714) oppure a tutto schermo sotto: l'overlay funziona in entrambi i modi. La cornice e i moduli cambiano di conseguenza.

### 11.2 Striscia a scorrimento

Usa lo stesso nastro della fascia social (`nastro.js`), con la sua velocità (`drum.striscia.velocita`, 40–160 px/s, 80). Voci, in giro continuo: «In esecuzione: Titolo — Artista» (se c'è un brano), «Artista ospite · @handle» (se c'è) e «Salta la coda e dona una **Rosa**» (con il regalo del campo). Si accende e spegne con `drumStriscia`; `drumBrano` accende o spegne la voce del brano.

### 11.3 Istruzione su una riga

Una riga fissa, mai a capo: «**Dona una Rosa** per saltare la fila e scegliere il brano». Campi (regia): prefisso («Dona una», 16), regalo mostrato (slot, 20), dopo («per saltare la fila e scegliere il brano», 48), icona; il corpo si restringe per stare su una riga. `drumPriorita` accetta `dopo` e `regalo`; i vecchi stati con `sopra` passano a `dopo` (se diverso dal vecchio predefinito, altrimenti il nuovo predefinito). Con *Richiamo* la riga pulsa come oggi.

### 11.4 Regalo che fa saltare la coda

Campo **«Regalo che salta la coda»** (`drum.priorita.regalo`: nome o ID; vuoto = lo slot mostrato), con **Regali visti**. Quando arriva, in regia compare «Salta la coda: @nome (Rosa)» in una coda (§6.3) con *Fatta* e *Scarta*; sull'overlay non cambia nulla (resta l'istruzione).

### 11.5 Niente «Brano segreto»

Tutti i moduli mostrano sempre il loro titolo, sbloccati o no; senza titolo c'è «Da definire». Spariscono «Brano segreto» e «Brano a sorpresa» (e i test che li citavano). Il banner di sblocco, la sequenza e il suono non cambiano.

### 11.6 Scaletta a campi (regia)

La scaletta diventa una **tabella di campi**: una riga per tappa con «Like» (numero, accetta `15k`) e «Titolo del brano» (60 caratteri), pulsanti *Aggiungi tappa*, *Togli*, *Su*/*Giù*, e *Scaletta predefinita*. Salva con un solo *Salva scaletta* e mostra l'errore sulla riga sbagliata, come oggi. `drumScaletta` accetta anche `{ tappe: [{ like, titolo }] }`, oltre a `testo` e `predefinita`; il modello dei dati non cambia.

## 12. Studio Production e Podcast (e diciture fisse)

- San Francisco su tutti i testi; corpi di partenza più grandi, sempre centrati nei loro riquadri (la targa di Studio Production e Reaction sale a ~230 px di altezza, quella del Podcast a ~140, se i mockup lo richiedono); il controllo sui pixel verifica che nulla venga tagliato al 100% e al 200%.
- **Diciture fisse modificabili**, in uno stato `etichette` per proprietario con i predefiniti di oggi, 40 caratteri, non vuote: `senzaPremio.etichette = { inAscolto: "Ora in ascolto", ascoltate: "Oggi abbiamo ascoltato", tracce: "tracce" }`, `studio.etichette = { inStudio: "In studio ora" }`, `podcast.etichette = { ospite: "Ospite" }`. Le righe dei titoli, il titolo del pannello Tematiche e l'etichetta dell'artista ospite del Drum erano già modificabili. Limiti dei titoli: Studio Production 40/36/60 (sopra/titolo/sotto), Reaction 48/60/60, Podcast titolo 40, riga 60.
- **Titoli salvati** (solo Studio Production): `produzione.salvati = [{ id, nome, sopra, testo, sotto, accento, icona }]`, fino a 6, oltre ai tre predefiniti: *Salva questo titolo* (con un nome), *Usa*, *Togli*. Non tocca `titolo.preset` e `accento`/`icona` si scelgono tra quelli esistenti.

## 13. Battle

Nel badge delle barre della vita «Chat» / «Votes» diventa «Voto» / «Chat» (`<span>Voto</span><span>Chat</span>`); README, commenti della pagina e mockup si aggiornano. Il resto del Battle cambia solo per palette e font.

## 14. Stato, API e regia

### 14.1 Comandi nuovi o cambiati (Stream Deck: `POST /api/<comando>`)

| Comando | Corpo |
|---|---|
| `votazione` (nuovo) | `{ pesi?: { beat, voce, mix, chat }, min?, max?, etichette?: { beat, voce, mix, chat } }`: pesi relativi (0–100, almeno uno > 0), min < max tra 0 e 10 |
| `goal` (nuovo) | `{ like?: { obiettivo?, passo? }, follower?: { obiettivo?, passo?, imposta?, aggiungi? }, modo?, ogniMinuti?, durataSecondi?, posizione?: { layout, x?, y?, scala?, ripristina? } }` |
| `goalMostra` (nuovo) | `{}`: il Goal compare ora (modo a comparsa) |
| `albero` (nuovo) | `{ durataSecondi?, mostra?: true \| false }` |
| `correggiTraccia` | in più `instagram?` |
| `senzaPremio` | in più `schedaFissa?`, `etichette?` |
| `studio`, `podcast` | in più `etichette?` |
| `produzione` | in più `salvati?` (elenco), `salva?: { nome }`, `usa?: id`, `togli?: id` |
| `reaction` | in più `scaletta?: { titolo?, voci?, modo?, ogniMinuti?, durataSecondi? }`, `regalo?`, `durataRichiesta?` |
| `scalettaMostra` (nuovo) | `{}`: la scaletta della Reaction compare ora |
| `richiesta` (nuovo) | `{ formato: "reaction" \| "drum", azione: "inOnda" \| "fatta" \| "scarta", id, brano?: { titolo, artista? } }` |
| `drumPriorita` | in più `dopo?`, `regalo?` |
| `drumStriscia` (nuovo) | `{ velocita? }` |
| `drumScaletta` | in più `{ tappe }` |
| `widget` | nuovi nomi: `goal`, `albero`, `reScaletta`, `reRichiesta`, `drumStriscia` (`albero` parte spento) |
| `regaloEvento` (nuovo, per le prove) | `{ nome, id?, utente, quantita? }`: simula un regalo; `followEvento` `{ utente, totale? }` simula un follow |

Ogni comando controlla tutto su una copia e non cambia nulla se un valore è sbagliato (come gli altri).

### 14.2 Stato salvato e compatibilità

I campi nuovi si ritrovano da soli in uno stato salvato da una versione precedente (funzioni `fondi*`, campo per campo, valori rotti → predefinito). Nessuna migrazione che perda dati.

### 14.3 Regia

Nuove sezioni o blocchi: *Goal Like e Follower* (§5.3), *Serata → Voti* (pesi, range, etichette, giudici), *Tabellone ad albero* (nei comandi di *In onda*), *In ascolto → Instagram*, *Reaction → Scaletta* e *Richieste*, *Drum → Striscia, Regalo, Scaletta a campi*, *Studio Production → Titoli salvati*, *Diciture* nelle sezioni di senza premio, studio e podcast. Scorciatoie: nessuna nuova.

## 15. Dove si cambiano i campi del brief (§3 del brief)

1. Pesi e range del voto: regia *Serata → Voti* e `config.json` (`pesi`, `votoMin`, `votoMax`).
2. Nomi dei giudici e delle quattro voci: regia *Serata → Voti* e `config.json` (`giudici`, `etichette`).
3. Lista Reaction e mappatura del regalo: regia *Reaction → Scaletta* e *Richieste*.
4. Brani del Drum e regalo per la priorità: regia *Drum → Scaletta a campi* e *Regalo che salta la coda*.
5. Testi di Studio Production e Podcast: regia, sezioni dei due layout (titoli, diciture, titoli salvati).
6. Target e contatori Goal: regia *Goal Like e Follower*.

## 16. Verifica

- **Test automatici** (`npm test`, un test per ogni regola, scritto prima e visto fallire): voti 4–10 (gara) e 0–10 (Battle), pesi 30/30/30/10, `leggiVoto` con range, etichette e giudici, `obiettivoAttuale` (soglia, multipli, passo 0), follower (evento, totale, mai verso il basso), `regaloTikTok` (v3 e vecchio schema, serie, mancanti) e `followTikTok`, `regaloCorrisponde` e code, `costruisciAlbero` (4/8/16, vuoti, ordine, esclusi), etichette e titoli salvati, scaletta a `tappe`, `drumPriorita` con `dopo`, estrazione dell'Instagram da Nero, e il test di palette e font (§4.3). I test dei comandi passano dal server vero.
- **Browser** (Playwright, come oggi, su una porta di prova): controllo di geometria di tutti i layout con le nuove tabelle (±1 px, nella zona libera, senza sovrapposizioni), controllo dei pixel delle lettere tagliate al 100% e al 200%, mockup rigenerati di ogni layout e stato, regie.
- **Consegna**: README e GUIDA aggiornati (font, palette, nuove sezioni, posizioni), `config.esempio.json` con i campi nuovi, nuovo video di tutto per telefono e zip provato in una cartella pulita (`npm ci` + test).
- Una revisione finale con un revisore che non ha visto il lavoro, un solo giro di correzioni con test che falliva prima, e i rilievi minori elencati.

## 17. Fasi di consegna (un commit per fase, sul branch di sviluppo)

1. Font e palette (variabili, conversione dei fogli, test di palette e font) + «Voto Chat».
2. Votazione della gara (logica, regia, CTA) e geometria del blocco voti.
3. Classifica e tabellone: testi, `lib/albero.mjs`, pagina e regia dell'albero.
4. Eventi TikTok (regali, follower), `lib/regali.mjs`, `lib/goal.mjs`, comandi di prova.
5. Widget Goal in tutte le pagine e sezione di regia.
6. Senza premio: scheda fissa, spot dall'alto, colori per tipo, banner, artista e Instagram.
7. Live session in studio.
8. Reaction: scaletta e richieste.
9. Drum: layout, striscia, istruzione, niente segreto, scaletta a campi, regalo.
10. Studio Production e Podcast: diciture, titoli salvati, corpi.
11. Documentazione, mockup, controllo di insieme, video e zip.

## 18. Rischi e limiti

- **San Francisco sul PC della diretta**: senza SF Pro installato si vede Inter (vedi §2).
- **Eventi TikTok non provati con una live vera**: regali e follower sono verificati solo contro lo schema installato e un messaggio codificato come lo fa la libreria; i nomi dei regali (inglese) vanno controllati con *Regali visti* alla prima diretta.
- **Instagram da Nero**: nome del campo non verificato (nero.fan non è raggiungibile da questa sessione); c'è il campo a mano.
- **Conversione dei colori**: ~660 valori nei fogli; il rischio è un'ombra o un alone che resta tinto (lo prende il test) o un contrasto peggiorato (lo vedono i mockup).
- **Larghezze del nuovo font**: i testi lunghi si restringono di più; i minimi di corpo sono rivisti, e il controllo sui pixel dice se qualcosa viene tagliato.
- **Geometria del Drum e del blocco voti**: i numeri sono di partenza; non provati su un telefono vero né dentro TikTok LIVE Studio.
- **Tabellone ad albero con 16**: nomi lunghi si troncano con i puntini; con meno di 4 partecipanti il disegno è piccolo.
- **Carico sul PC della diretta**: aggiunte leggere (Goal, albero, striscia); resta non misurato come per il resto.
