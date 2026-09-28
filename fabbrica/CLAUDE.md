# La Fabbrica: istruzioni per Claude

Software locale di Backrooms (studio di registrazione, Vicenza). Prende la registrazione integrale di una live OBS e produce decine di clip verticali 9:16 per TikTok e Instagram Trial Reels, che una persona rivede e approva da una dashboard locale.

- **Contratto:** `docs/BRIEF.md`. Leggilo prima di lavorare su una fase.
- **Piano:** `docs/PIANO.md`.
- **Questo file:** architettura, comandi, convenzioni e decisioni. Va aggiornato a ogni milestone.

## Stato

| Milestone | Stato |
| --- | --- |
| Fase 0: ricognizione | In corso. Risposte ricevute. Cartella Drive `La Fabbrica` creata con `recon.ps1`. Mancano i report dei PC; piano v2 **in attesa di approvazione** |
| M0: setup | Da fare |
| M1: cervello | Da fare |
| M2: montaggio | Da fare |
| M3: dashboard | Da fare |
| M4: automazione e sicurezza | Da fare |
| M5: pubblicazione e apprendimento | Da fare |

**Non scrivere codice di pipeline finché il piano non è approvato.**

## Ambienti

- **Destinazione: più PC Windows 11 dello studio** (tra cui plugghepc, con DaVinci Resolve), collegati tramite **Google Drive per desktop**.
  - Ruoli: un PC di regia (OBS), **un solo** PC di elaborazione (il più potente, acceso di notte), revisione da qualsiasi PC. Dettagli in `docs/PIANO.md`, sezione "Architettura multi-PC".
  - Hardware e software di ogni PC si scoprono con `recon.ps1`, che scrive in `La Fabbrica/ricognizione/<PC>.json` su Drive; da M0 con `fabbrica doctor`.
- **Google Drive** (account backrooms.studios.vi):
  - cartella `La Fabbrica` (id `1dvnwK5G-_5jnjQVNvqAD1t1-ajxwE5dv`) con `ricognizione/` (id `14v9I6gNYDgj5xDrYcEjdsU9Gcv_nLWfp`), `campioni/` (id `1nVsKsDJZizcBVZBmpZuA3tCpmyjUFy8H`) e `recon.ps1`;
  - dal cloud Claude legge e scrive lì tramite il connettore Google Drive. **Se `tools/recon.ps1` cambia, va ricaricata anche la copia su Drive.**
- **Sviluppo: container cloud** (verificato il 28/09/2026):
  - macchina: Ubuntu 24.04, 4 core, 15 GB di RAM, nessuna GPU;
  - strumenti: Python 3.11 e 3.12, uv 0.8.17, FFmpeg 6.1.1 da apt (con libass, loudnorm e libx264), PowerShell 7 per verificare gli script `.ps1`.
- **Rete del container:**
  - raggiungibili: `pypi.org`, `raw.githubusercontent.com` (da cui si scaricano i font Google), apt di Ubuntu, `registry.npmjs.org`;
  - **bloccati:** `huggingface.co`, quindi i modelli Whisper non si scaricano qui, e `fonts.google.com`/`cdn.jsdelivr.net`;
  - per trascrivere davvero nel container, `huggingface.co` e i suoi CDN vanno aggiunti ai domini permessi dell'ambiente. Finché sono bloccati, qui i test usano trascrizioni finte e la trascrizione reale gira su plugghepc.
- **Attenzione:** `ffmpeg -encoders` elenca NVENC anche senza GPU. Conta solo una prova di encoding riuscita.

### Ricognizione dei PC

_Da compilare leggendo `La Fabbrica/ricognizione/*.json` su Drive._

## Architettura (prevista, dettagli in `docs/PIANO.md`)

Pipeline a fasi idempotenti:

```
ingest → audio → transcribe → signals → candidates → score → select → copy → edit(EDL) → render → qc → report
```

- **Ripresa:** ogni fase scrive il suo output più `state/<fase>.json`, con hash di input e config, versione e tempi. Una fase rigira solo se l'hash cambia o con `--force`.
- **Dove stanno i file:**
  - grezzi, WAV, proxy e modelli restano in locale sul PC di elaborazione;
  - report, candidate, anteprime, meta, decisioni, richieste ed export vanno su Drive in `La Fabbrica/live/<AAAA-MM-GG>_<format>/`.
- **Sincronizzazione:**
  - un file ha un solo autore: il PC di elaborazione scrive gli output; la dashboard crea solo file nuovi in `decisioni/` e `richieste/`;
  - su Drive le scritture sono atomiche: file temporaneo, poi rinomina.
- **Indice:** SQLite **locale** su ogni PC (live, candidate, clip, stato, metriche), ricostruibile dai file su Drive. Mai un database dentro Drive.
- **Webcam:** il close-up 9:16 si ritaglia nella zona della webcam, letta dalla collezione scene di OBS per ogni scena; gli overlay impressi si coprono con `hud_masks`.
- **Live in corso:** il PC di elaborazione non lavora mai durante una registrazione (controllo via WebSocket di OBS).
- **Tempo:** una sola funzione di rimappaggio sorgente → timeline in `edl.py`. Tutto ciò che sta sulla timeline (parole, zoom, hook, apertura a freddo) passa da lì. Non duplicare mai questa logica.
- **Render:** un processo FFmpeg e un solo encode per clip. Sottotitoli, hook e badge stanno in un solo `.ass`, il cui layout è calcolato in Python con le misure reali dei glifi.
- **LLM:** `llm/provider.py` con due backend, `anthropic_api` e `claude_cli`. Output validato con Pydantic, costo registrato a ogni chiamata, tetto per live controllato prima di chiamare.

## Comandi

Sono quelli previsti; nessuno esiste ancora, salvo la ricognizione.

```powershell
# Fase 0, su plugghepc (sola lettura)
powershell -NoProfile -ExecutionPolicy Bypass -File fabbrica\tools\recon.ps1
```

```bash
uv sync                       # ambiente e dipendenze
uv run pytest                 # test
uv run fabbrica doctor        # verifica ambiente
uv run fabbrica process <file>
uv run fabbrica render <clip_id>
uv run fabbrica review        # dashboard su http://localhost:8765
uv run fabbrica export | publish | stats | watch
```

## Convenzioni

- **Dove sta il codice.** Il repo contiene anche il sito Next.js dello studio; La Fabbrica vive solo in `fabbrica/`. Non toccare i file del sito.
- **Commit.** Piccoli, uno per passo funzionante, messaggio in italiano, con `[skip netlify]` in coda al titolo così il deploy del sito non riparte. Branch di lavoro: `claude/la-fabbrica-vertical-clips-ho26f1`.
- **Percorsi.** Sempre `pathlib`, mai stringhe concatenate. I nomi di cartella possono avere spazi e accenti.
- **FFmpeg su Windows.** Nei filtri FFmpeg (`ass=`, `subtitles=`) i percorsi Windows vanno evitati: il processo si lancia con `cwd` nella cartella della clip e nomi di file relativi. Mai `shell=True`: argomenti sempre come lista.
- **Lingua.** Identificatori e docstring in inglese. Messaggi per l'utente, log leggibili, dashboard e documentazione in italiano.
- **Secrets** solo in `.env` locale del PC di elaborazione: ignorato da git, **mai dentro Drive**, mai in chat. `.env.example` elenca le chiavi senza valori.
- **Drive.** Nessuna `.venv`, nessun codice e nessun database dentro Drive: lì solo dati. Ogni scrittura è atomica e ha un solo autore.
- **Test.** pytest. Il rimappaggio dei timestamp ha test a proprietà obbligatori. Nessuna milestone è chiusa senza test verdi **e** verifica visiva dei frame (0,5 s, metà, -1 s) guardati davvero.
- **Regole di brand** (§9 del brief). Valgono nel prompt LLM e nei validatori:
  - rosso `#E01F26` solo nel badge LIVE;
  - niente "gratis", niente promesse di risultato;
  - su TikTok niente link, QR, telefoni o WhatsApp;
  - regola Grammy.
- **Mai:** pubblicare senza approvazione umana, attivare servizi a pagamento senza chiedere, inventare limiti delle API delle piattaforme (vanno verificati sulla documentazione ufficiale).

## Decisioni

| Data | Decisione | Motivo |
| --- | --- | --- |
| 28/09/2026 | Codice in `fabbrica/` dentro questo repo, sul branch indicato; commit con `[skip netlify]` | È il repo della sessione; si può separare in seguito con `git subtree split` |
| 28/09/2026 | Sviluppo e test nel container cloud, esecuzione e benchmark su plugghepc | Il container non ha GPU né accesso alle registrazioni |
| 28/09/2026 | La ricognizione di Windows è uno script in sola lettura (`tools/recon.ps1`); le installazioni avvengono solo in M0, dopo l'approvazione | Fase 0 prima di scrivere codice |
| 28/09/2026 | Google Drive per desktop è il collegamento fra i PC (richiesta del team). Su Drive solo dati leggeri e condivisi; i grezzi restano sul PC di elaborazione | Si lavora da qualsiasi PC; 8 ore al giorno sono circa 70-90 GB, troppi per Drive |
| 28/09/2026 | SQLite locale e ricostruibile invece di un database condiviso; su Drive un solo autore per file | Un database in una cartella sincronizzata si corrompe |
| 28/09/2026 | Layout: close-up della webcam ritagliato dalla registrazione (overlay impressi, niente registrazione pulita) | Risposta del team |
| 28/09/2026 | Provider LLM predefinito `anthropic_api`; tetto di spesa giornaliero (default $3) | Risposta del team: chiave API |
| 28/09/2026 | Nessuna live registrata finora: dopo M0 si registra una prova di 20-30 min in `La Fabbrica/campioni/` | Serve un campione per M1 e M2 |

_Le decisioni tecniche proposte in `docs/PIANO.md` entrano in questa tabella quando il piano è approvato._

## Risposte della Fase 0 (28/09/2026)

- Più PC, tutto tramite Drive.
- Nessuna live ancora registrata.
- Overlay impressi; parlano tutti; close-up sulla webcam.
- Circa 8 ore di live al giorno, format misti; PC acceso di notte.
- Chiave API Anthropic.
- La liberatoria c'è.

## Punti aperti

- Report di `recon.ps1` da ogni PC, per scegliere il PC di elaborazione e il percorso GPU/CPU.
- Risoluzione della webcam e sua posizione in scena, per giudicare la qualità del close-up.
- Microfoni: uno per persona su tracce separate?
- Spazio Google Drive: serve almeno Google One da 100 GB. È un costo, decide il team.
- Approvazione del piano v2.
