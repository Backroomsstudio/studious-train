# La Fabbrica: piano a milestone

**Stato:** proposta del 28/09/2026, **in attesa di approvazione**. Nessun codice di pipeline scritto finora.
Riferimento: `docs/BRIEF.md` (contratto). Le decisioni approvate finiscono in `CLAUDE.md`.

## Come lavoriamo

Lo sviluppo avviene in un container cloud Linux, senza GPU e senza accesso alle vostre registrazioni. L'esecuzione vera avviene su plugghepc (Windows 11).

| Dove | Cosa |
| --- | --- |
| Container cloud | Scrittura del codice, unit test, test di integrazione su un campione sintetico, render di prova con verifica visiva dei frame |
| plugghepc | `recon.ps1`, `fabbrica doctor`, benchmark, elaborazione delle live vere, logger OBS |

- Tutto il codice è multipiattaforma (`pathlib`, niente comandi di shell specifici) e i test girano a ogni commit.
- Su plugghepc lanciate voi i comandi e mi incollate l'output. In alternativa, da M1 in poi conviene installare Claude Code su plugghepc: l'installer nativo non richiede Node. Così lavoro direttamente sui file veri, con GPU e OBS.
- Il codice sta nella sottocartella `fabbrica/` di questo repo, sul branch `claude/la-fabbrica-vertical-clips-ho26f1`.
- I commit portano `[skip netlify]`, così il deploy del sito non riparte.
- Si può spostare in un repo dedicato quando volete, senza perdere la storia (`git subtree split`).

## Scelte tecniche principali

| Area | Scelta | Perché |
| --- | --- | --- |
| Ambiente | Python 3.12 gestito da uv (`.python-version` + `uv.lock`) | Stesso ambiente su Windows e Linux; uv installa anche Python |
| Ripresa | Ogni fase scrive il suo output più `state/<fase>.json`, con hash di input e config, versione e tempi. Una fase rigira solo se qualcosa è cambiato o con `--force` | Dopo un crash si riparte dal punto esatto |
| Trascrizione a blocchi | Blocchi di circa 10 min tagliati **nei silenzi trovati dal VAD**, audio letto a pezzi da WAV 16 kHz, un checkpoint per blocco | Memoria costante, nessuna parola spezzata al confine, niente sovrapposizioni da deduplicare |
| Tempo | EDL = lista di intervalli sorgente. Parole, zoom, hook e apertura a freddo passano tutti da **una sola** funzione di rimappaggio, coperta da test a proprietà (hypothesis) | È il punto dove questi sistemi si rompono |
| Crossfade | Equal-power da 15 ms, con le code audio estese di mezzo crossfade oltre il taglio | Niente click, e la durata dell'audio resta identica a quella del video: il rimappaggio non si sposta |
| Punch-in | Crop e scale statici per sotto-segmento, perché i cambi di zoom cadono sui confini di frase | Nessun filtro per-frame, niente tremolio, render veloce |
| Testi a schermo | Un solo file ASS per clip (sottotitoli, hook, badge). Il layout lo calcola Python misurando i glifi reali con FreeType; libass fa solo da renderer | Il QC geometrico delle safe zone usa gli stessi box che finiscono nel video |
| Riquadro arrotondato | Disegnato in ASS vettoriale (`\p1`), dimensionato sulla parola misurata | libass non ha box con angoli arrotondati nativi |
| Font | TTF ufficiali Google Fonts. I font variabili (Archivo, JetBrains Mono) vengono istanziati in statici (ExtraBold, Bold) con fontTools | libass gestisce male le istanze dei font variabili |
| Render | Un processo FFmpeg per clip e un solo encode (x264 CRF 19 oppure NVENC CQ equivalente). `loudnorm` a due passaggi: il primo decodifica solo l'audio | Niente ricodifiche a catena |
| Varianti TikTok/IG | Un encode solo se le due versioni sono identiche; il secondo solo se cambia il contenuto (tratti esclusi, beep, logo) | Si dimezzano i tempi di render |
| Speaker | Energia delle tracce microfono con isteresi, niente modelli di diarizzazione | Affidabile e gratis se le tracce sono separate |
| Marker | Logger WebSocket più, da verificare, i capitoli nativi dell'MP4 ibrido di OBS 30.2+, letti con ffprobe | Doppia sicurezza |
| LLM | Provider astratto (`anthropic_api`, `claude_cli`), JSON validato con Pydantic, costo registrato per ogni chiamata, tetto per live controllato **prima** di chiamare | Costi visibili e prevedibili |
| Dashboard | FastAPI, Jinja2 e HTMX. JS vendorizzato: niente npm, niente Node | Nessuna build |

## Milestone

Ogni passo è un commit piccolo con i test verdi. A fine milestone riporto: cosa funziona (comando e output), cosa non funziona, costo LLM misurato, prossimo passo.

### M0: Setup

1. Scheletro: `pyproject.toml` con uv, `config.yaml` validato con Pydantic (errori in italiano), log strutturati (JSON su file più console leggibile), CLI con Typer.
2. `fabbrica doctor` verifica:
   - OS, GPU e CUDA, con prova reale di faster-whisper su CUDA se c'è una NVIDIA;
   - NVENC con una prova di encoding vera: `-encoders` lo elenca anche senza GPU, verificato;
   - libass e loudnorm;
   - spazio su disco, font, `.env`, WebSocket di OBS raggiungibile.
3. `tools/setup.ps1`: installa con winget ciò che manca (solo dopo il vostro ok) e abilita i percorsi lunghi (serve l'amministratore).
4. Font:
   - download dei TTF ufficiali e istanziazione statica;
   - licenze OFL in `assets/fonts/`;
   - prova di rendering con libass.
5. `tools/obs_logger.py` e guida all'hotkey MARKER:
   - OBS non manda un evento WebSocket quando premete un hotkey generico. Il metodo solido è una sorgente fittizia "MARKER": l'hotkey "Mostra/Nascondi MARKER" genera l'evento `SceneItemEnableStateChanged`, che il logger registra.
   - Funziona da tastiera e da Stream Deck (plugin OBS, azione "Sorgente").
   - I tempi vengono presi da `GetRecordStatus.outputDuration`, non dall'orologio del PC, così sono allineati al file.

**Accettazione:**
- `doctor` tutto verde su plugghepc;
- registrazione di prova di 2 min con 2 marker: `markers.json` corretto, con i tempi confrontati sul video.

### M1: Cervello

1. **Ingest:**
   - remux senza ricodifica e metadati con ffprobe;
   - proxy a 540p;
   - un WAV 48 kHz per traccia, più un mono a 16 kHz per il riconoscimento.
2. **Analisi audio:**
   - VAD Silero (è già dentro faster-whisper, funziona offline);
   - loudness su finestre da 400 ms e picchi;
   - musica/parlato (dalla traccia DAW se c'è, altrimenti da feature librosa);
   - speaker attivo.
3. **Trascrizione:**
   - blocchi con checkpoint e hotwords;
   - correzione del glossario: fuzzy match ristretto ai termini noti, così una parola comune non viene "corretta" per sbaglio.
4. **Segnali:**
   - marker e scene OBS;
   - PySceneDetect sul proxy;
   - QR su un frame ogni 2 s (OpenCV).
5. **Candidate:** frasi (punteggiatura e pause), poi finestre di 15-60 s su confini di frase, circa una ogni 60-90 s di parlato.
6. **Scoring:**
   - prima il punteggio da feature, che è gratis;
   - poi l'LLM sulle candidate che superano un filtro minimo, con schema JSON e stima del costo mostrata prima di spendere.
7. **Selezione:** IoU > 0,3, diversità di argomento, soglia, top N.
8. **Indice e report:** SQLite e `report.html` statico (timeline, top 20, costi, tempi per fase).

**Test:**
- unit test su segmentazione, finestre, IoU, cost tracker e ripresa dopo interruzione;
- integrazione su un campione sintetico di 3-5 min, generato e versionato;
- integrazione su un estratto reale, fuori dal repo.

**Accettazione:** una live di 1 ora dà almeno 40 candidate con score e motivazione e un report leggibile. Voi valutate le top 10: almeno 7 devono avere senso.

### M2: Montaggio

1. **EDL e rimappaggio**, con test a proprietà, prima di tutto il resto.
2. **Tagli:**
   - silenzi sopra 0,40 s, con 100 ms di margine;
   - riempitivi e false partenze in modalità conservativa;
   - nella musica non si taglia, salvo sul downbeat (librosa).
3. **Ritmo e durata:** apertura a freddo senza ripetere la frase, punch-in 1,00/1,10 ogni 3-6 s, durata 12-60 s che chiude su fine frase.
4. **Copy** (modello capace):
   - 3 hook, caption, 3 hashtag e CTA per piattaforma;
   - validatore a due livelli: regex (gratis, URL, telefoni, WhatsApp, promesse, superlativi, regola Grammy, "Artista" in apertura), poi un controllo LLM sulle regole del §9;
   - se un testo non passa, viene rigenerato (max 2 volte) e poi segnalato.
5. **Testi a schermo:** sottotitoli ASS parola per parola (box `#F4F8FF`, JetBrains Mono per numeri e BPM), hook in Anton con lastra al 70%, badge LIVE.
6. **Audio:**
   - loudnorm a due passaggi, target -14 LUFS e true peak -1,5 dBTP, per stare sotto -1 anche dopo l'AAC;
   - fade da 40 ms;
   - AAC 48 kHz a 256 kbps.
7. **Render e QC:**
   - render in parallelo e QC automatico su tutte le voci del §7.14;
   - una clip fallita viene registrata e le altre proseguono.
8. **Verifica visiva:** 3 frame per clip (0,5 s, metà, -1 s) in un foglio di contatto. Li guardo io e riporto cosa vedo.

**Accettazione:** top 20 renderizzate, QC superato, -14 LUFS ±1, verifica visiva riportata.

### M3: Dashboard

- Griglia per score, player, filtri e scorciatoie (A/R/E/1-2-3/J/K).
- Modifica di hook, caption e parola dei sottotitoli; trim con maniglie sulla forma d'onda (wavesurfer.js vendorizzato); interruttori per apertura a freddo e badge.
- Re-render in background da una coda su SQLite, con lo stato visibile.
- Azioni in blocco: "approva le prime N sopra X", "esporta approvate".
- Pagina live con la timeline e il render a mano di un tratto non scelto. Form ospiti e consensi.
- Export per piattaforma.
- FCPXML per DaVinci Resolve, con la versione scelta in base al Resolve installato; EDL CMX3600 come riserva.
- L'export è bloccato se manca un consenso.

### M4: Automazione e sicurezza

- Cartella controllata:
  - un file si elabora solo quando è stabile e la registrazione è finita (il logger lo sa);
  - Utilità di pianificazione per la notte;
  - priorità bassa del processo.
- Blocchi completi:
  - QR, "Il Segnale";
  - musica (segnalata e bloccata finché non la marcate come vostra o consentita);
  - OCR a schermo per URL e numeri;
  - consensi, compresi i minorenni.
- Sorgenti 16:9: face tracking MediaPipe con One-Euro e zona morta, layout split volto/DAW, fallback con sfondo sfocato.
- Multicamera guidata dai microfoni, con inquadratura minima di 2 s.
- Se il vostro sorgente fosse 16:9, anticipo il face tracking in M2.

### M5: Pubblicazione e apprendimento

- **Prima di scrivere codice:** verifica sulla documentazione ufficiale di Meta e TikTok dei limiti del §10, che cambiano.
- **Instagram:** Trial Reels con Content Publishing API e hosting temporaneo del video, che vi propongo e attivo solo col vostro ok.
- **TikTok:** secondo lo stato dell'audit; fino ad allora, export manuale.
- **Regole di invio:** tetti giornalieri e fasce orarie. Anteprima, consenso esplicito e caption modificabile prima di ogni invio.
- **Metriche:** import da IG Insights e TikTok (API o CSV), report settimanale.
- **Apprendimento:** ricalibrazione dei pesi, few-shot con le clip migliori, vincitore A/B degli hook.

## Prestazioni attese

Sono stime, da misurare con un benchmark vero su plugghepc in M1-M2.

| Fase, per 1 ora di live | GPU NVIDIA (fascia RTX 3060-4070) | Solo CPU (8 core) |
| --- | --- | --- |
| Ingest, proxy e WAV | 3-6 min | 5-10 min |
| Trascrizione | 3-8 min (large-v3-turbo) | 15-45 min (small o medium int8) |
| Analisi, segnali, candidate | 3-6 min | 5-10 min |
| LLM (Batches) | 5-30 min, di solito pochi minuti; non occupa il PC | uguale |
| Render e QC di 40 clip | 5-10 min (NVENC) | 15-30 min (x264 in parallelo) |

- **Spazio su disco:** circa 15-20 GB per ora di live (sorgente 8-11 GB, WAV, proxy, clip). La pulizia di WAV e proxy dopo l'approvazione è configurabile.
- **Memoria:** costante, perché audio e video vengono sempre letti a blocchi.

## Costo LLM stimato per ora di live

Ipotesi:
- 60 candidate, ognuna con circa 500 token di trascrizione e un system prompt di circa 3.500 token in cache;
- 40 clip da scrivere, con risposta e ragionamento di circa 2.000 token ciascuna.

Prezzi: listino Anthropic in dollari; il cambio in euro sarà configurabile.

| Voce | Modello | Senza Batches | Con Batches (-50%) |
| --- | --- | --- | --- |
| Scoring di 60 candidate | veloce (Sonnet 5: $2 / $10 per M token) | ~$0,50 | ~$0,25 |
| Hook, caption e hashtag di 40 clip | capace (Opus 5: $5 / $25 per M token) | ~$2,30 | ~$1,15 |
| Validatore LLM dei testi | veloce | ~$0,10 | ~$0,05 |
| **Totale** | | **~$2,9 (≈ €2,6)** | **~$1,45 (≈ €1,3)** |

- Con Haiku 4.5 per lo scoring ($1 / $5) la prima voce si dimezza. Consiglio Sonnet 5, perché il giudizio sul gergo rap italiano pesa sul criterio "7 su 10 sensate".
- Una live di 4 ore con i Batches costa circa €2. Senza Batches supererebbe il tetto di €3: in quel caso il sistema lo dice prima di spendere e restringe le candidate che vanno all'LLM.
- Con `claude_cli` il costo marginale è zero, perché usa l'abbonamento, ma le chiamate consumano i limiti del piano, sono più lente e non esistono i Batches.

## Rischi e limiti noti

- **Musica di terzi:** non si può stabilire in automatico di chi sia un brano. Il sistema rileva "c'è musica" e blocca finché non la marcate come vostra o dell'artista consenziente.
- **Riempitivi:** Whisper tende a "ripulire" il parlato e spesso non trascrive gli "ehm". Il taglio dei riempitivi si appoggia anche ai buchi tra le parole, ma resta conservativo.
- **Speaker senza tracce separate:** con una sola traccia non c'è una diarizzazione affidabile e gratuita. Lo speaker resta "sconosciuto".
- **QR piccoli:** sul proxy a 540p possono sfuggire. Se succede, si campiona dal sorgente.
- **Tempi di oggi:** il codice di M0-M2 si può scrivere in giornata. L'accettazione però dipende dall'avere la live campione e dai giri di prova su plugghepc.
