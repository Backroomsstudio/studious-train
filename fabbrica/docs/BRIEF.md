# La Fabbrica: brief di progetto

> Brief originale di Backrooms (28/09/2026), riportato integralmente. È il contratto di riferimento:
> se il codice o `PIANO.md` divergono da qui, vale questo file, salvo le decisioni registrate in `CLAUDE.md`.

## Ruolo

Sei il lead engineer di un piccolo prodotto interno. Hai esperienza di video engineering (FFmpeg, libass, encoding), speech processing (Whisper e derivati), computer vision leggera (face tracking, scene detection), audio (loudness, VAD, beat tracking) e integrazione di LLM con output strutturati. Scrivi codice di produzione: modulare, testato, riprendibile dopo un errore e documentato. Non consegni demo che funzionano "solo sul file di prova".

## 1. Obiettivo

Costruire «La Fabbrica», un software locale che prende la registrazione integrale di una nostra live (da 30 minuti a diverse ore) e produce automaticamente decine o centinaia di clip verticali 9:16 pronte per TikTok e per i Reel di prova di Instagram (Trial Reels). Ogni clip deve avere:

- un hook testuale a schermo nei primi 3 secondi, più caption e hashtag;
- sottotitoli dinamici parola per parola, nel nostro stile;
- un montaggio di base ma pulito: taglio di silenzi e false partenze, punch-in (zoom) per creare ritmo, apertura sul momento più forte;
- l'audio normalizzato per i social;
- un punteggio che dica quanto è promettente, con la motivazione.

Una persona del team deve poter rivedere, correggere e approvare le clip da una dashboard locale in pochi minuti. Poi le clip vengono esportate, e in una fase successiva pubblicate.

**Metrica di successo:** da 1 ora di live escono almeno 40 clip candidate, di cui almeno 15 pubblicabili senza ritocchi manuali, e la revisione umana di una live richiede meno di 15 minuti.

## 2. Contesto

Siamo Backrooms, uno studio di registrazione di Vicenza (rap/urban italiano) formato da 3 professionisti. La figura tecnica è Freya (produttore, fonico, mix engineer). Luca gestisce i clienti e il marketing.

Facciamo live quotidiane dallo studio. I format sono:

- **Caffè in Diretta**: chiacchiera leggera;
- **La Revisione**: ascoltiamo i pezzi degli artisti e diciamo tre cose concrete che mancano;
- **La Sala Aperta**: una sessione reale con un artista;
- **Lo Studio di Notte**: produzione.

Trasmettiamo con OBS. Le scene previste sono 5: L'Attesa; La Sala; Il Palco; **Il Segnale** (il momento dell'offerta, con link, QR o riferimenti a WhatsApp); La Chiusura.

Le clip servono a raggiungere artisti nuovi su TikTok e Instagram.

Lingua dei contenuti: italiano, parlato veloce e colloquiale, gergo rap e termini tecnici (mix, master, 808, BPM, Auto-Tune, stems).

## 3. Ambiente di destinazione

- Windows 11 x64 (PC "plugghepc"). È installato DaVinci Resolve.
- La GPU non è nota: rilevala (`nvidia-smi`) e scegli il percorso di conseguenza: CUDA per la trascrizione e NVENC per l'encoding se c'è una NVIDIA; altrimenti CPU, con modelli più leggeri e rendering in parallelo.
- Node non è nel PATH. Python e FFmpeg vanno verificati e, se mancano, installati con `winget` (Python 3.11/3.12; FFmpeg "full" con libass e NVENC).
- Usa `uv` per ambiente e dipendenze. Tutti i percorsi con `pathlib` (attenzione a spazi e caratteri accentati nei nomi delle cartelle).
- Secrets in `.env`, mai nel codice né nei commit.

## 4. Come devi lavorare (regole di processo)

- **Fase 0, ricognizione.** Prima di scrivere codice esegui un check dell'ambiente: OS, GPU, spazio su disco, Python, FFmpeg (`ffmpeg -filters | findstr ass` per libass, `-encoders` per NVENC). Poi fammi al massimo 5 domande su ciò che non puoi rilevare da solo (vedi §17). Poi presentami il piano a milestone e aspetta la mia approvazione.
- Crea subito un `CLAUDE.md` con architettura, comandi, convenzioni e decisioni prese. Aggiornalo a ogni milestone.
- Inizializza git. Fai un commit piccolo per ogni passo funzionante, con messaggi chiari.
- **Test:** unit test obbligatori per la logica temporale, cioè il rimappaggio dei timestamp delle parole dopo i tagli (è il punto dove questi sistemi si rompono). Aggiungi test di integrazione su un file campione di 3-5 minuti.
- **Verifica visiva:** dopo ogni render estrai 3 frame per clip (a 0,5 s, a metà, a -1 s), guardali davvero e verifica che sottotitoli e hook siano leggibili, dentro le safe zone e nello stile giusto. Non dichiarare finita una milestone senza averlo fatto.
- **Idempotenza e ripresa.** Ogni fase salva il suo output su disco (JSON/SQLite). Se il processo si interrompe dopo 2 ore di trascrizione, la ripresa non rifà ciò che è già fatto.
- Niente servizi a pagamento o account esterni senza chiedermelo prima. Stima e mostra il costo delle chiamate LLM per ogni live elaborata.
- Niente pubblicazione automatica senza approvazione umana esplicita, clip per clip o in blocco dalla dashboard.
- Preferisci strumenti collaudati (FFmpeg, libass, faster-whisper, PySceneDetect, MediaPipe) a soluzioni scritte da zero. Codifica il video una sola volta nel render finale: niente re-encoding a catena.

## 5. Input

- Sorgente principale: registrazione locale di OBS (MKV consigliato, poi remux in MP4), da 30 minuti fino a 4+ ore. Formato 9:16 (la tela delle nostre live è 1080×1920) oppure 16:9: supporta entrambi.
- **Audio multitraccia** (se presente): OBS registra fino a 6 tracce. Esempio: traccia 1 mix, traccia 2 microfono Luca, traccia 3 microfono Freya/ospite, traccia 4 musica/DAW. Se ci sono, usale per: la diarizzazione (chi parla = quale microfono è attivo); riconoscere dove c'è musica; il cambio camera automatico.
- File laterale opzionale `<nome>.markers.json` prodotto dal logger OBS (§7.4): cambi di scena con timestamp e segnalibri premuti durante la live con un hotkey ("MARKER" = "qui è successo qualcosa di forte").
- Metadati della live (form nella dashboard o `live.yaml`): format, data, ospiti presenti, consensi.
- In alternativa: un VOD scaricato (YouTube/Instagram) caricato a mano. La pipeline non deve dipendere dalla piattaforma.

## 6. Output

Per ogni live, una cartella del tipo `data/lives/2026-09-29_revisione/` con:

- `source/` (originale o remux), `audio/` (WAV 48 kHz per traccia), `proxy/` (video a bassa risoluzione per analisi e anteprime);
- `transcript.json`: parole con start/end, speaker, confidenza;
- `signals.json`: marker, scene, energia, risate/applausi se rilevabili, musica/parlato, cambi di inquadratura;
- `candidates.json`: tutte le candidate con score, motivazione, famiglia di format e di hook;
- `clips/<id>/`: `clip_tiktok.mp4` e `clip_ig.mp4` (varianti se le safe zone differiscono); `thumb.jpg`, `subs.ass`; `meta.json` con hook, varianti A/B, caption, hashtag, durata, score, flag di sicurezza e loudness misurata;
- `report.html`: panoramica navigabile della live, cioè timeline con le candidate, top 20, costo LLM e tempi di ogni fase.

Tutto è indicizzato in SQLite (`data/fabbrica.db`): live, candidate, clip, stato (bozza, approvata, scartata, pubblicata), metriche.

## 7. Pipeline (in ordine)

### 7.1 Ingest

- Remux senza ricodifica. Lettura dei metadati con ffprobe (fps, risoluzione, tracce).
- Creazione di un proxy a 540p per l'analisi visiva.
- Estrazione delle tracce audio in WAV 48 kHz.

### 7.2 Analisi audio

- VAD (Silero o il VAD integrato di faster-whisper) per trovare parlato e silenzi.
- Curva di energia/loudness (finestra da 400 ms) e picchi.
- Classificazione musica/parlato per segmento: serve per non tagliare dentro la musica e per i controlli di copyright.
- Se ci sono le tracce separate: speaker attivo per ogni istante.

### 7.3 Trascrizione

- faster-whisper con `word_timestamps=True`, `language="it"`, VAD filter attivo: modello `large-v3` (o `large-v3-turbo`) su GPU; `medium`/`small` int8 su CPU (scelta automatica, sovrascrivibile da config).
- Hotwords/glossario per i termini nostri, più una tabella di correzione post-trascrizione:
  - Backrooms, Freya, Luca, Daniele;
  - Zinco, Smeraldo, Zaffiro, Diamante, Into The Backrooms;
  - FL Studio, Pro Tools, Auto-Tune, 808, BPM, mix, master, stems;
  - cabina, regia, Vicenza.
- Il file va processato a blocchi (chunk con sovrapposizione), senza caricare ore di audio in RAM.

### 7.4 Segnali di contesto

- **Logger OBS:** uno script Python separato (`tools/obs_logger.py`) che si collega a OBS WebSocket v5, già integrato in OBS 28+. Registra inizio/fine registrazione, cambi di scena, eventi hotkey "MARKER"; tutto in `<nome_registrazione>.markers.json`, con tempi relativi all'inizio della registrazione. Spiegami come assegnare l'hotkey MARKER (tastiera o Stream Deck).
- Scene detection (PySceneDetect) sul proxy.
- Rilevamento QR code sui frame campionati (OpenCV `QRCodeDetector`), per bloccare i tratti con QR sulle clip TikTok.
- I tratti in scena "Il Segnale" vengono esclusi per TikTok. Su TikTok non devono comparire link, QR, numeri di telefono o inviti a uscire dalla piattaforma.

### 7.5 Generazione delle candidate

- Segmentazione per frasi (punteggiatura più pause), poi finestre candidate di 15-60 s (preferenza 20-45 s), che iniziano e finiscono su confini di frase.
- Densità: circa una candidata ogni 60-90 s di parlato utile, con sovrapposizioni permesse in questa fase.
- Ogni candidata eredita i segnali del suo intervallo: marker, energia, speaker, scena, musica, QR.

### 7.6 Scoring (punteggio 0-100)

Due livelli combinati con pesi configurabili.

**Feature:**

- bonus forte se c'è un MARKER vicino;
- picchi di energia, ritmo del parlato, poche pause morte;
- presenza di un momento prima/dopo audio;
- penalità per musica di terzi, QR, scena "Il Segnale" (solo per TikTok), ospite senza consenso.

**LLM** (output JSON validato da schema). Rubrica:

- forza dei primi 3 secondi;
- autonomia: si capisce senza contesto?;
- valore pratico (consiglio tecnico concreto su mix, voce, beat);
- emozione, ironia o sorpresa;
- conflitto o contrasto;
- chiarezza della chiusura.

L'LLM restituisce anche:

- `format_family`: una tra `il_difetto`, `la_revisione`, `la_domanda`, `il_prezzo`, `la_stanza`, `il_rito`, `altro`;
- `hook_family`: da H1 a H6 (§9);
- la frase più forte del segmento, con i suoi timestamp (serve per l'apertura a freddo);
- 1-2 parole chiave per frase da enfatizzare nei sottotitoli.

Provider LLM configurabile:

- `anthropic_api` (chiave in `.env`, con prompt caching del system prompt e Message Batches per lo scoring di massa);
- `claude_cli` (Claude Code in modalità headless `claude -p ... --output-format json`).

Modello veloce per lo scoring di massa, modello più capace per hook e caption delle clip finali. Entrambi in config.

### 7.7 Selezione

- Rimozione delle sovrapposizioni (IoU temporale > 0,3: tieni la migliore) e diversità di argomento.
- Soglia minima di score. Top N configurabile (default 40 renderizzate, tutte le altre restano candidate renderizzabili on demand).

### 7.8 Hook, caption, hashtag

Per ogni clip selezionata:

- 3 varianti di hook a schermo (max ~45 caratteri, leggibile in meno di 1,5 s);
- caption (2-4 righe, la parola-filtro del target va qui e non nel video);
- 3 hashtag (non di più);
- CTA per piattaforma da template configurabili (su TikTok nessun invito a uscire dalla piattaforma).

Le varianti servono ai Trial Reels: stessa clip, hook diversi, per vedere quale funziona.

Tutto rispetta le regole del §9. Aggiungi un controllo automatico finale (regex + LLM) che scarta testi con promesse di risultato, "gratis", numeri di telefono, URL o claim vietati.

### 7.9 Montaggio (edit decision list → render)

- Costruisci per ogni clip una EDL interna (lista di intervalli sorgente → timeline). Tutto il resto (sottotitoli, zoom, hook) si calcola sulla timeline dopo i tagli, tramite rimappaggio dei timestamp (testato!).
- Taglio dei silenzi oltre 0,40 s (configurabile), lasciando 80-120 ms di margine. Micro-crossfade audio di 10-20 ms su ogni taglio: niente click (siamo uno studio, si sente).
- False partenze e riempitivi ("ehm", "cioè cioè", frasi ricominciate) rimossi quando la trascrizione lo permette, in modalità conservativa e configurabile.
- Nei tratti con musica non si taglia il silenzio. Se serve un taglio, va fatto sul downbeat (beat tracking con librosa), altrimenti si lascia intatto.
- **Apertura a freddo** (opzionale, default on se lo score della frase forte è alto): i primi 1,5-3 s mostrano la frase più forte presa dall'interno della clip; poi uno stacco secco riporta all'inizio del discorso; la frase non viene ripetuta due volte per intero.
- **Punch-in:** alterna scala 1,00 e 1,10 sui confini di frase ogni 3-6 s, per simulare un multicamera. Opzionale uno zoom lento (1,00→1,05) sui tratti lunghi senza tagli.
- Durata finale: min 12 s, target 20-45 s, max 60 s (config). Finale pulito su fine frase.

### 7.10 Reframe 9:16 e layout

- Sorgente già 9:16: nessun crop. Se l'overlay della live è impresso nel video, applica le maschere configurabili (`hud_masks`) per coprire o sfocare logo, ticker e QR. Consiglia comunque una registrazione pulita senza HUD (§17).
- Sorgente 16:9, tre layout: (a) face-tracking con MediaPipe e smoothing (EMA o One-Euro, zona morta per evitare il tremolio); (b) split: sopra il volto, sotto lo schermo DAW (per i tratti di produzione); (c) fallback: crop centrale con sfondo sfocato.
- Multicamera: se ci sono più sorgenti video registrate separatamente, cambio automatico sulla camera di chi parla (dalle tracce microfono), con durata minima dell'inquadratura di 2 s.

### 7.11 Sottotitoli dinamici (formato ASS, bruciati con libass)

- Blocchi da 1-3 parole, max 16 caratteri per riga e 2 righe. Andate a capo su confini naturali: mai separare numero e unità, articolo e nome.
- Parola attiva evidenziata: testo `#0A0A0B` su riquadro `#F4F8FF` con angoli arrotondati, oppure pop-in (scala 1,12 → 1,00 in 80 ms). Le parole chiave dell'LLM sono enfatizzate allo stesso modo.
- Font Archivo Black/ExtraBold, circa 76-84 px su larghezza 1080, colore `#E6E8EA`, bordo `#0A0A0B` da 6-8 px e ombra morbida. Numeri, prezzi, BPM e tonalità in JetBrains Mono (regola di brand).
- Maiuscolo configurabile (default: maiuscolo per l'hook, frase normale per i sottotitoli).
- Tempi dalle word timestamps rimappate. Durata minima di un blocco 0,25 s. Unisci i blocchi con buchi sotto i 120 ms per evitare lo sfarfallio.
- Filtro parolacce opzionale per piattaforma: lista configurabile, con mascheramento sia nel testo che, facoltativamente, nell'audio con un beep.
- Correzione ortografica dei termini del glossario prima del render.

### 7.12 Hook a schermo

- Mostrato da 0 a 3 s in Anton, 88-110 px, maiuscolo, 2-3 righe max, nella zona hook (§9.2).
- Ingresso di 120 ms, eventuale lastra `#0A0A0B` al 70% dietro il testo.
- Dopo 3 s scompare, oppure diventa un titolo piccolo e persistente (config).
- Badge "● LIVE" opzionale in alto a sinistra con il pallino rosso `#E01F26`. È l'unico uso ammesso del rosso (§9.1), ed è legittimo perché la clip viene davvero da una live.

### 7.13 Audio finale

- Loudness -14 LUFS integrati, true peak ≤ -1 dBTP, con `loudnorm` a due passaggi.
- Fade in/out di 30-50 ms. AAC 48 kHz, 256-320 kbps.

### 7.14 Render e controllo qualità automatico

- H.264 High, yuv420p, 1080×1920, fps della sorgente (max 60), CRF 18-20 su CPU o NVENC a qualità equivalente, `+faststart`.
- Render in parallelo (worker = core/2, o sessioni NVENC disponibili).
- QC su ogni clip, con scarto e log se fallisce: durata nei limiti; niente frame neri iniziali; loudness nei limiti; testi dentro le safe zone (verifica geometrica dai box ASS calcolati); nessun QR/URL/numero se la clip è per TikTok; sincronia dei sottotitoli (errore medio sotto i 100 ms sulle parole campione); consenso degli ospiti presente.

### 7.15 Export

- Cartelle `export/tiktok/AAAA-MM-GG/` e `export/instagram/AAAA-MM-GG/` con video, caption `.txt` e `meta.json`.
- Export DaVinci Resolve: FCPXML (o EDL) per ogni clip, con i tagli già fatti sul file sorgente, così una clip speciale si rifinisce a mano in Resolve.

## 8. Dashboard di revisione (locale, `http://localhost:8765`)

- FastAPI con frontend leggero (HTML + HTMX o vanilla JS, niente build complicate). Tema scuro con la nostra palette (§9.1).
- Griglia delle clip ordinata per score, con player, hook, caption, famiglia, flag e motivazione dello score.
- Filtri: live, format, piattaforma, stato, score.
- Scorciatoie da tastiera: `A` approva, `R` scarta, `E` modifica, `1/2/3` scegli la variante di hook; `J/K` clip precedente/successiva.
- Modifica inline: testo di hook e caption; correzione di una parola nei sottotitoli; trim di inizio e fine con due maniglie sulla forma d'onda; on/off di apertura a freddo e badge LIVE. Poi il re-render della singola clip in background, con stato visibile.
- Azioni in blocco: "approva le prime N sopra score X", "esporta approvate".
- Pagina live: timeline con le candidate sopra la forma d'onda, per renderizzare a mano un tratto non scelto dal sistema. Form ospiti e consensi.
- Coda di pubblicazione (§10) e pagina metriche (§11).

## 9. Regole di brand e di contenuto

Non negoziabili: vanno nel system prompt dell'LLM e nei validatori.

### 9.1 Identità visiva

- Palette in scala di grigi, tendente al freddo. Mai grigi caldi.
  - nero sala `#0A0A0B` · grafite `#141517` · ferro `#232529`;
  - cenere `#8A8F98` · osso `#E6E8EA` · neon `#F4F8FF`.
- Rosso `#E01F26` riservato SOLO allo stato REC/LIVE. Mai su sottotitoli, hook, evidenziazioni o sfondi.
- Font: Anton (titoli e hook) · Archivo (sottotitoli e testo) · JetBrains Mono (numeri, prezzi, orari, BPM, tonalità). Tutti OFL: scaricali (Google Fonts / fontsource) in `assets/fonts/` e registrali per libass.
- Logo opzionale e configurabile per piattaforma (default off). Mai il watermark di un'altra piattaforma: le versioni TikTok e IG si renderizzano entrambe pulite dal sorgente.

### 9.2 Safe zone (tela 1080×1920, valori in config)

- Zona utile per testi: x 40→840, y 260→1360.
- Zone morte: in alto 0→220; a destra 860→1080 per y 900→1700 (icone like, commenti, condivisioni); in basso gli ultimi ~520 px (caption e UI).
- Hook nella fascia y 260→560. Sottotitoli nella fascia y 1000→1340, centrati sulla zona utile (x ≈ 440).

### 9.3 Tono di voce (hook e caption)

- Italiano parlato, seconda persona, caldo e diretto. Mai aziendale, mai da venditore.
- "Certezze, non fuffa": si promette ciò che si consegna (il suono, il mix, la sessione, il consiglio), mai il risultato. Vietati fama, stream, "ti facciamo esplodere", contratti, "diventerai…".
- Mai la parola "gratis".
- Titoli sul difetto, mai sul risultato (es. "La tua voce suona chiusa per questo motivo", non "Ecco come diventare virale").
- Niente superlativi non verificabili ("il più forte del Veneto", "garantito al 100%").
- Regola Grammy: ammesso solo "ha lavorato a un disco candidato ai Grammy 2026" (il soggetto è il lavoro); vietati "produttore candidato ai Grammy", plurali, loghi, statuette.
- Evita "Artista" come parola d'apertura. La parola-filtro del target va nella caption.
- Famiglie di hook: H1 frustrazione iper-specifica; H2 ribaltamento; H3 contrasto di mondi; H4 soglia/segreto; H5 numero + beneficio concreto; H6 scelta A/B.
- Nelle revisioni: tre mancanze concrete, mai un giudizio sul talento di nessuno.

### 9.4 Sicurezza, consensi, piattaforme

- Consensi: file `consensi.yaml` (nome, ambito, data, maggiorenne sì/no; per i minorenni serve il consenso di un genitore). Una clip con un ospite senza consenso registrato non si può esportare.
- Musica: le clip con musica di terzi (non nostra, non dell'artista consenziente) vanno segnalate e bloccate di default. I pezzi inediti degli artisti si usano solo con consenso.
- TikTok: nessun link, QR, numero di telefono, WhatsApp o invito a uscire dalla piattaforma, né a schermo né nell'audio. I tratti della scena "Il Segnale" sono esclusi.
- Nomi e dati degli utenti letti dalla chat: niente in sovrimpressione.

## 10. Pubblicazione (milestone M5, non prima)

**Instagram:**

- Content Publishing API (account professionale collegato a una pagina Facebook, app Meta con i permessi di pubblicazione);
- i Reel di prova si pubblicano con `trial_params.graduation_strategy` = `MANUAL` oppure `SS_PERFORMANCE`;
- limite: 100 post via API ogni 24 ore (finestra mobile);
- il video deve stare a un URL pubblico al momento della pubblicazione: proponimi un hosting temporaneo (bucket con link firmato, cancellato dopo la pubblicazione) e chiedimi prima di attivarlo.

**TikTok:**

- Content Posting API. I client non ancora verificati da TikTok (audit) pubblicano solo in privato (`SELF_ONLY`) e per massimo 5 utenti al giorno;
- c'è un tetto di circa 15 post al giorno per creator via API;
- le linee guida richiedono anteprima, consenso esplicito e caption modificabile prima dell'invio: la dashboard deve farlo.
- Finché l'audit non c'è: export e caricamento manuale, oppure un tool di scheduling (es. Postiz) che verifichi tu.

Prima di implementare, ricontrolla la documentazione ufficiale aggiornata: questi limiti cambiano.

- Tetti giornalieri per account configurabili, con default prudenti. L'obiettivo è generarne centinaia e pubblicare le migliori, non inondare un solo account: la pubblicazione di massa danneggia la distribuzione e può violare le regole anti-spam.
- Fasce orarie di pubblicazione configurabili (default serale, picco verso le 20:00).

## 11. Apprendimento (milestone M5)

- Import delle metriche per ogni clip pubblicata: IG Insights (riproduzioni, copertura, salvataggi, condivisioni, tempo di visione se disponibile); TikTok via API se disponibile, altrimenti import CSV.
- Report settimanale: quali famiglie di format e di hook, durate e segnali (es. clip con MARKER) rendono di più. Metriche che contano per noi: visione completa e riascolti; condivisioni in DM e salvataggi; i like contano poco.
- Ricalibra i pesi dello scoring. Usa le clip migliori come esempi (few-shot) nel prompt di hook e scoring.
- Per le varianti A/B dei Trial Reels, registra quale hook ha "vinto".

## 12. Configurazione (`config.yaml`, esempio da completare)

```yaml
paths:
  data_dir: "./data"
  watch_dir: "D:/OBS/Registrazioni"      # da chiedere
hardware:
  device: auto            # auto | cuda | cpu
  render_workers: auto
transcription:
  model: auto             # large-v3 | large-v3-turbo | medium | small
  language: it
  hotwords: [Backrooms, Freya, Zinco, Smeraldo, Zaffiro, Diamante, "FL Studio", "Pro Tools", "Auto-Tune", "808", BPM, stems]
clips:
  min_s: 12
  target_s: [20, 45]
  max_s: 60
  render_top_n: 40
  min_score: 55
  silence_cut_s: 0.40
  cut_padding_ms: 100
  audio_crossfade_ms: 15
  cold_open: auto
  punch_in: {enabled: true, scale: 1.10, every_s: [3, 6]}
llm:
  provider: anthropic_api   # anthropic_api | claude_cli
  scoring_model: "<modello veloce>"
  writing_model: "<modello capace>"
  use_batches: true
  max_cost_eur_per_live: 3.00
brand:
  colors: {nero: "#0A0A0B", grafite: "#141517", ferro: "#232529", cenere: "#8A8F98", osso: "#E6E8EA", neon: "#F4F8FF", rec: "#E01F26"}
  fonts: {hook: Anton, subs: Archivo, data: "JetBrains Mono"}
  live_badge: true
  logo: {tiktok: false, instagram: false}
safe_zone: {x: [40, 840], y: [260, 1360], hook_band: [260, 560], subs_band: [1000, 1340]}
subtitles: {max_words: 3, max_chars_line: 16, uppercase: false, highlight: box}
profanity_filter: {tiktok: false, instagram: false, list: []}
hud_masks: []             # rettangoli da coprire se l'overlay è impresso
publishing:
  daily_cap: {tiktok: 3, instagram_trial: 5}   # default prudenti, da regolare sui dati
  windows: ["18:00-21:30"]
  require_human_approval: true
```

## 13. Struttura del progetto

```
fabbrica/
  CLAUDE.md  README.md  config.yaml  .env.example  pyproject.toml
  fabbrica/
    cli.py                # comandi (vedi sotto)
    ingest.py  audio.py  transcribe.py  signals.py
    candidates.py  scoring.py  select.py  copywriting.py
    edl.py  reframe.py  subtitles.py  hook_overlay.py  render.py  qc.py
    export.py  davinci.py  publish/ (instagram.py, tiktok.py)
    llm/ (provider.py, prompts/, schemas/)
    db.py  models.py  costs.py  logging.py
    web/ (app.py, templates/, static/)
  tools/obs_logger.py
  assets/fonts/  assets/brand/
  tests/ (unit/, integration/, fixtures/)
  data/  export/
```

Comandi CLI (Typer):

- `fabbrica doctor`: verifica l'ambiente;
- `fabbrica process <file>`: pipeline completa;
- `fabbrica watch`: elabora in automatico le nuove registrazioni, anche di notte con l'Utilità di pianificazione di Windows;
- `fabbrica render <clip_id>`;
- `fabbrica review`: apre la dashboard;
- `fabbrica export`;
- `fabbrica publish`;
- `fabbrica stats`.

## 14. Prestazioni e robustezza

- Misura e riporta i tempi di ogni fase. Obiettivi, da confermare con un benchmark reale su questo PC: con GPU NVIDIA, 1 ora di live → candidate + top 40 renderizzate in meno di 45 minuti; solo CPU, elaborazione notturna accettabile, senza bloccare il PC di giorno (priorità bassa del processo).
- File di più ore: elaborazione a blocchi e memoria costante.
- Log strutturati. Errori chiari in italiano nella dashboard. Una clip che fallisce non ferma le altre.

## 15. Milestone e criteri di accettazione

- **M0, Setup (oggi):** `fabbrica doctor` è tutto verde. Font installati. Logger OBS funzionante su una registrazione di prova di 2 minuti con 2 marker.
- **M1, Cervello (oggi):** su una live campione da 1 ora: trascrizione con parole temporizzate, almeno 40 candidate con score e motivazione, `report.html` leggibile. Io controllo le top 10 e almeno 7 devono avere senso.
- **M2, Montaggio (oggi):** le top 20 renderizzate con tagli, apertura a freddo, punch-in, sottotitoli dinamici, hook, loudness -14 LUFS ±1 e QC superato. Verifica visiva dei frame fatta da te e riportata.
- **M3, Dashboard:** revisione, modifica, re-render, approvazione in blocco, export per piattaforma, export FCPXML per DaVinci.
- **M4, Automazione e sicurezza:** cartella controllata e batch notturno. Blocchi per QR, "Il Segnale", musica e consensi. Multicamera e split layout.
- **M5, Pubblicazione e apprendimento:** IG Trial Reels via API, TikTok secondo §10. Import metriche e report settimanale.

A fine di ogni milestone mostrami: cosa funziona, con una prova (comando + output); cosa non funziona ancora; il costo LLM misurato; il prossimo passo.

## 16. Cosa non fare

- Non pubblicare nulla senza approvazione umana.
- Non usare il rosso fuori dal badge LIVE/REC. Non scrivere hook che promettono risultati.
- Non ricodificare il video più di una volta. Non caricare ore di video in RAM.
- Non attivare servizi a pagamento, hosting o account senza chiedere.
- Non inventare limiti o API delle piattaforme: verifica sulla documentazione ufficiale.
- Non dichiarare una milestone completata senza test verdi e senza la verifica visiva dei frame.

## 17. Domande da fare in Fase 0 (solo quelle non rilevabili da soli)

- Il percorso di una registrazione di live campione da usare come riferimento (se non esiste ancora, ne registriamo una di 20-30 minuti).
- Impostazioni OBS: la tela è 9:16 o 16:9? L'overlay (logo, ticker, QR) è impresso nella registrazione o possiamo registrare una versione pulita? L'audio è su tracce separate?
- Quante ore di live al giorno prevediamo e in quali format.
- LLM: preferiamo una chiave API Anthropic o Claude Code in modalità headless (`claude -p`)?
- Chi compare nelle live (ospiti, artisti) e se abbiamo già un modulo di consenso.
