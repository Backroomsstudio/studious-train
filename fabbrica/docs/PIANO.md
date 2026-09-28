# La Fabbrica: piano a milestone

**Stato:** versione 2 del 28/09/2026, aggiornata con le risposte della Fase 0. **In attesa di approvazione.**
Riferimento: `docs/BRIEF.md` (contratto). Le decisioni approvate finiscono in `CLAUDE.md`.

## Risposte della Fase 0

| Tema | Risposta | Conseguenza |
| --- | --- | --- |
| Accesso | Più PC nello studio. Il lavoro si deve poter fare da qualsiasi PC, **sempre tramite Google Drive** | Architettura multi-PC con Drive come punto di scambio (vedi sotto) |
| Live campione | Non c'è ancora nessuna live | Dopo M0 si registra una prova di 20-30 min con le impostazioni OBS definitive |
| Overlay | Loghi e grafiche sono impressi nella registrazione; non c'è una registrazione pulita | Le clip sono un **close-up della webcam**, ritagliato sotto gli overlay |
| Chi parla | Parlate tutti | Serve un microfono per persona, ognuno sulla sua traccia (checklist OBS) |
| Volume | Circa 8 ore di live al giorno, format misti; il PC può restare acceso di notte | Elaborazione notturna, tetto di spesa giornaliero, pulizia automatica dei file |
| LLM | Chiave API Anthropic | Provider predefinito `anthropic_api`; `claude_cli` resta come riserva |
| Consensi | La liberatoria c'è | Registro dei consensi (`consensi.yaml`) su Drive, controllato all'export |

## Architettura multi-PC con Google Drive

### Ruoli dei PC

| Ruolo | Quale PC | Cosa fa |
| --- | --- | --- |
| Regia | Il PC con OBS | Registra; il logger OBS salva i marker |
| Elaborazione | Uno solo: il più potente, con NVIDIA se c'è, acceso di notte. Di solito è lo stesso della regia | Esegue la pipeline e scrive gli output su Drive |
| Revisione | Qualsiasi PC con Drive per desktop, anche il vostro | `fabbrica review` apre la dashboard in locale |

- Il PC di elaborazione **non lavora mai durante una live**: lo verifica tramite il WebSocket di OBS e aspetta la fine della registrazione.
- Dalla dashboard si approva, si modifica e si chiede un nuovo render. Le richieste viaggiano su Drive e il PC di elaborazione le esegue.

### Cosa sta su Drive (`Il mio Drive/La Fabbrica/`)

```
La Fabbrica/
  recon.ps1                 script di ricognizione (copia di tools/recon.ps1)
  ricognizione/<PC>.json    report di ogni PC
  campioni/                 registrazioni di prova per i test
  config/                   config.yaml condivisa, consensi.yaml
  live/<AAAA-MM-GG>_<format>/
    report.html, candidates.json, transcript.json
    clips/<id>/  anteprima.mp4, thumb.jpg, contatto.jpg, meta.json
    decisioni/   un file per ogni azione fatta dalla dashboard (PC, ora, clip)
  richieste/                re-render e tratti scelti a mano, in attesa del PC di elaborazione
  export/tiktok/AAAA-MM-GG/, export/instagram/AAAA-MM-GG/   clip finali approvate + caption
```

### Cosa resta in locale

| Dove | Cosa | Perché |
| --- | --- | --- |
| PC di elaborazione | Registrazioni grezze, WAV, proxy, modelli Whisper | 8 ore al giorno sono circa **70-90 GB**: su Drive riempirebbero lo spazio in poche settimane e saturerebbero l'upload durante la live successiva |
| Ogni PC | Codice (git) e ambiente Python | Una cartella `.venv` dentro Drive sono migliaia di file da sincronizzare |
| Solo il PC di elaborazione | `.env` con la chiave API | Mai su Drive, mai in chat |
| Ogni PC | Cache SQLite | Vedi le regole di sincronizzazione |

Se regia ed elaborazione dovessero essere PC diversi, le registrazioni passano da una cartella `in_arrivo/` che si svuota da sola dopo l'elaborazione, oppure da una cartella condivisa in rete locale, che è più veloce.

### Regole per non avere conflitti di sincronizzazione

- **Un file ha un solo autore.** Il PC di elaborazione scrive gli output. La dashboard scrive solo file nuovi in `decisioni/` e `richieste/`, senza mai modificare quelli esistenti.
- **SQLite non sta su Drive.** Un database dentro una cartella sincronizzata si corrompe quando due PC lo toccano. Ogni PC tiene un indice SQLite locale, ricostruibile in qualsiasi momento dai file su Drive. È l'unica deviazione dal §6 del brief: l'indice c'è, ma è locale.
- **Anteprime leggere per la revisione.** Su Drive vanno versioni a 720p (circa 8-10 MB per clip). La clip finale a piena qualità arriva su Drive solo quando è approvata ed esportata. Anteprima e finale escono dallo stesso passaggio di FFmpeg: nessuna ricodifica a catena.

## Close-up della webcam

- La posizione della webcam in ogni scena si legge dalla collezione scene di OBS (`recon.ps1` la rileva già). Con i cambi di scena registrati dal logger, La Fabbrica sa istante per istante dove sta la webcam e ritaglia lì il 9:16.
- Se un logo copre la webcam, si applicano le `hud_masks` (sfocatura o copertura).
- **Limite di qualità da conoscere.** Da una webcam 16:9 a 1080p, un close-up verticale usa al massimo 608×1080 pixel, che vanno ingranditi di circa 1,8 volte. Se la webcam in scena è rimpicciolita, l'ingrandimento cresce e l'immagine si ammorbidisce.
  - Rimedio migliore: webcam montata in verticale oppure 4K.
  - In alternativa: il plugin gratuito **Source Record** di OBS, che registra la webcam pulita a piena risoluzione in parallelo. Da valutare dopo aver visto la potenza del PC.

## Checklist OBS prima della prima live

Diventa `docs/OBS_SETUP.md`, con le schermate, in M0.

1. **Tracce audio.** Impostazioni → Uscita in modalità Avanzata → Registrazione → attivare le tracce 1-5.
   - In "Proprietà audio avanzate": traccia 1 il mix, tracce 2-4 un microfono per persona, traccia 5 la musica o la DAW.
   - Lo streaming resta sulla traccia 1.
2. **Formato di registrazione.** MP4 ibrido (OBS 30.2+) o MKV: entrambi sopravvivono a un crash.
3. **Webcam alla risoluzione massima** che supporta, possibilmente in verticale.
4. **WebSocket attivo con password.** Strumenti → Impostazioni server WebSocket: serve al logger dei marker.
5. **Sorgente "MARKER"** con il suo hotkey, per il logger (guida in M0).

## Scelte tecniche principali

| Area | Scelta | Perché |
| --- | --- | --- |
| Ambiente | Python 3.12 gestito da uv (`.python-version` + `uv.lock`) | Stesso ambiente su tutti i PC Windows e nel cloud |
| Configurazione | `config/config.yaml` condivisa su Drive, più `config.local.yaml` per PC (percorsi, GPU, worker) | Una sola fonte di verità, con le differenze hardware separate |
| Ripresa | Ogni fase scrive il suo output più `state/<fase>.json`, con hash di input e config, versione e tempi. Una fase rigira solo se qualcosa è cambiato o con `--force` | Dopo un crash si riparte dal punto esatto |
| Trascrizione a blocchi | Blocchi di circa 10 min tagliati **nei silenzi trovati dal VAD**, audio letto a pezzi, un checkpoint per blocco | Memoria costante, nessuna parola spezzata al confine |
| Tempo | EDL = lista di intervalli sorgente. Parole, zoom, hook e apertura a freddo passano da **una sola** funzione di rimappaggio, coperta da test a proprietà | È il punto dove questi sistemi si rompono |
| Crossfade | Equal-power da 15 ms, con le code audio estese di mezzo crossfade oltre il taglio | Niente click, e la durata audio resta uguale a quella video |
| Punch-in | Crop e scale statici per sotto-segmento, sui confini di frase | Nessun filtro per-frame, niente tremolio |
| Testi a schermo | Un solo `.ass` per clip. Il layout lo calcola Python con le misure reali dei glifi; libass fa solo da renderer | Il QC delle safe zone usa gli stessi box del video |
| Font | TTF ufficiali Google Fonts; i font variabili vengono istanziati in statici con fontTools | libass gestisce male le istanze dei font variabili |
| Render | Un processo FFmpeg e un solo encode per uscita. `loudnorm` a due passaggi, il primo sul solo audio | Niente ricodifiche a catena |
| Speaker | Energia delle tracce microfono con isteresi | Affidabile e gratis con un microfono per persona |
| Marker | Sorgente fittizia "MARKER" letta dal logger WebSocket; tempi da `GetRecordStatus.outputDuration` | OBS non manda eventi per un hotkey generico |
| LLM | `anthropic_api` con Batches e cache del prompt. JSON validato con Pydantic; costo registrato per chiamata; tetto giornaliero controllato prima di spendere | Costi visibili e prevedibili |
| Dashboard | FastAPI, Jinja2 e HTMX, JS vendorizzato. Legge da Drive e scrive solo file di decisione | Funziona da qualsiasi PC, senza aprire porte né usare servizi esterni |

## Milestone

Ogni passo è un commit piccolo con i test verdi. A fine milestone riporto: cosa funziona (comando e output), cosa non funziona, costo LLM misurato, prossimo passo.

### M0: Setup

1. Scheletro: `pyproject.toml` con uv, configurazione condivisa e locale validata con Pydantic (errori in italiano), log strutturati, CLI con Typer.
2. `fabbrica doctor` verifica:
   - GPU e CUDA, con prova reale;
   - NVENC, con prova di encoding vera;
   - libass e loudnorm;
   - disco, font, `.env`;
   - Drive per desktop e cartella `La Fabbrica`;
   - WebSocket di OBS.
3. `tools/setup.ps1`, da lanciare su ogni PC:
   - installa con winget ciò che manca e abilita i percorsi lunghi;
   - clona il codice;
   - sul PC di elaborazione chiede la chiave API e la salva nel `.env` locale.
4. Font statici e licenze OFL in `assets/fonts/`, con prova di rendering libass.
5. `tools/obs_logger.py` e `docs/OBS_SETUP.md`: checklist, sorgente MARKER, hotkey da tastiera e da Stream Deck.

**Accettazione:**
- `doctor` tutto verde sul PC di elaborazione;
- `doctor` verde per la parte "revisione" sugli altri PC;
- prova di 2 min con 2 marker: `markers.json` corretto.

Subito dopo registrate una live di prova di 20-30 min con le impostazioni definitive e la mettete in `La Fabbrica/campioni/`. È la base di M1 e M2.

### M1: Cervello

1. Ingest: remux, ffprobe, proxy 540p, WAV per traccia, **zone della webcam per scena** dalla collezione scene di OBS.
2. Analisi audio: VAD, loudness su finestre da 400 ms, musica/parlato, speaker attivo per traccia.
3. Trascrizione a blocchi con checkpoint, hotwords e correzione del glossario.
4. Segnali: marker, scene OBS, PySceneDetect, QR.
5. Candidate: frasi, poi finestre di 15-60 s.
6. Scoring:
   - prima le feature, gratis, su tutte le candidate della giornata;
   - poi l'LLM solo sulle migliori (circa 150 al giorno, configurabile), con stima del costo prima di spendere.
7. Selezione: IoU > 0,3, diversità, soglia, top N al giorno.
8. Output su Drive (`live/<id>/`, `report.html`) e indice SQLite locale.

**Test:**
- unit test su segmentazione, finestre, IoU, costi, ripresa e scrittura atomica su Drive;
- integrazione sul campione sintetico e sulla live di prova.

**Accettazione:** su 1 ora di live almeno 40 candidate con score e motivazione. Voi valutate le top 10 dal report su Drive: almeno 7 devono avere senso.

### M2: Montaggio

1. EDL e rimappaggio con test a proprietà, prima di tutto il resto.
2. **Tagli:**
   - silenzi sopra 0,40 s, con 100 ms di margine;
   - riempitivi in modalità conservativa;
   - niente tagli nella musica, salvo sul downbeat.
3. **Montaggio:** close-up della webcam, apertura a freddo, punch-in, durata 12-60 s.
4. **Copy:** 3 hook, caption, 3 hashtag e CTA per piattaforma, con validatore regex e LLM.
5. **Testi a schermo:** sottotitoli ASS parola per parola, hook, badge LIVE.
6. **Audio:** loudnorm a -14 LUFS e -1,5 dBTP, fade, AAC 48 kHz a 256 kbps.
7. **Render e controllo qualità:**
   - render in parallelo; QC automatico;
   - anteprima leggera su Drive, finale in locale.
8. Verifica visiva: 3 frame per clip in un foglio di contatto su Drive. Li guardo io e riporto.

**Accettazione:** top 20 renderizzate, QC superato, -14 LUFS ±1, verifica visiva riportata.

### M3: Dashboard

- Utilizzabile da qualsiasi PC:
  - griglia per score, player, filtri e scorciatoie (A/R/E/1-2-3/J/K);
  - modifica di hook, caption e parole; trim sulla forma d'onda.
- Re-render tramite `richieste/`, con lo stato visibile.
- Azioni in blocco: "approva le prime N sopra X", "esporta approvate".
- Export per piattaforma su Drive e FCPXML per DaVinci Resolve.
- L'export è bloccato se manca un consenso.

### M4: Automazione e sicurezza

- Elaborazione notturna automatica: parte a fine live, a priorità bassa, e si ferma se OBS riprende a registrare.
- Pulizia automatica:
  - grezzi eliminati dopo N giorni, conservando solo i tratti delle clip, copiati senza ricodifica;
  - anteprime vecchie eliminate da Drive.
- Blocchi completi: QR, "Il Segnale", musica, OCR a schermo per URL e numeri, consensi.
- Multicamera e split layout, se in futuro registrate più camere.

### M5: Pubblicazione e apprendimento

- **Verifiche preliminari:** documentazione ufficiale di Meta e TikTok per i limiti del §10.
- **Instagram:** Trial Reels via API e hosting temporaneo, attivato solo col vostro ok.
- **TikTok:** secondo lo stato dell'audit; fino ad allora, export manuale.
- **Regole di invio:** tetti giornalieri e fasce orarie; anteprima e consenso prima di ogni invio.
- **Metriche e apprendimento:** metriche, report settimanale, ricalibrazione dei pesi, vincitori A/B.

## Volumi e prestazioni attese (8 ore di live al giorno)

Sono stime, da misurare sul PC di elaborazione in M1-M2.

| Voce | GPU NVIDIA (RTX 3060-4070) | Solo CPU (8 core) |
| --- | --- | --- |
| Elaborazione di 8 ore di live (ingest, trascrizione, analisi) | 1,5-3 ore | 5-9 ore: al limite della notte, con modello small e meno clip |
| Render e controllo qualità di 40 clip | 10-15 min | 30-45 min |
| Spazio locale per i grezzi | 70-90 GB al giorno; pulizia dopo N giorni (default 7): circa 600 GB a regime | uguale |
| Spazio su Drive | anteprime circa 0,4 GB al giorno, export approvati circa 1 GB al giorno; con la pulizia restano circa 20-40 GB | uguale |

Sui 15 GB gratuiti di Google, Drive non basta: serve almeno un piano Google One da 100 GB. **È un costo: decidete voi.**

## Costo LLM stimato (per giorno, 8 ore di live)

Ipotesi:
- circa 480 candidate al giorno; le feature (gratis) ne passano circa 150 all'LLM;
- 40 clip al giorno da scrivere.

Prezzi: listino Anthropic in dollari.

| Voce | Modello | Senza Batches | Con Batches (-50%) |
| --- | --- | --- | --- |
| Scoring di 150 candidate | veloce (Sonnet 5: $2 / $10 per M token) | ~$1,25 | ~$0,60 |
| Hook, caption e hashtag di 40 clip | capace (Opus 5: $5 / $25 per M token) | ~$2,30 | ~$1,15 |
| Validatore LLM dei testi | veloce | ~$0,10 | ~$0,05 |
| **Totale al giorno** | | **~$3,65** | **~$1,80** |
| **Al mese (30 giorni)** | | **~$110** | **~$55 (≈ €50)** |

- Tetto predefinito: **$3 al giorno**, controllato prima di ogni spesa. Il limite mensile di sicurezza si imposta anche nella Console Anthropic.
- Con Haiku 4.5 per lo scoring ($1 / $5) la prima voce si dimezza.
- Pubblicando al massimo circa 8 clip al giorno (tetti del brief), 40 clip scritte al giorno danno 5 scelte per ogni post. Il numero è configurabile.

## Rischi e limiti noti

- **Musica di terzi:** non si riconosce in automatico di chi sia. Viene rilevata la presenza di musica e la clip resta bloccata finché non la marcate come vostra o consentita.
- **Riempitivi:** Whisper spesso omette gli "ehm". Il taglio resta conservativo.
- **Close-up:** la qualità dipende dalla risoluzione della webcam e da quanto è grande in scena (vedi sopra).
- **CPU senza NVIDIA:** 8 ore al giorno sono al limite della notte. Si decide dopo la ricognizione dei PC.
- **Drive per desktop:** la sincronizzazione ha qualche minuto di ritardo. La dashboard mostra quando un file non è ancora arrivato.
