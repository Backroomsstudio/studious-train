# La Fabbrica: istruzioni per Claude

Software locale di Backrooms (studio di registrazione, Vicenza). Prende la registrazione integrale di una live OBS e produce decine di clip verticali 9:16 per TikTok e Instagram Trial Reels, che una persona rivede e approva da una dashboard locale.

- **Contratto:** `docs/BRIEF.md`. Leggilo prima di lavorare su una fase.
- **Piano:** `docs/PIANO.md`.
- **Questo file:** architettura, comandi, convenzioni e decisioni. Va aggiornato a ogni milestone.

## Stato

| Milestone | Stato |
| --- | --- |
| Fase 0: ricognizione | In corso. Container cloud verificato; `tools/recon.ps1` scritto, da lanciare su plugghepc; piano **in attesa di approvazione** |
| M0: setup | Da fare |
| M1: cervello | Da fare |
| M2: montaggio | Da fare |
| M3: dashboard | Da fare |
| M4: automazione e sicurezza | Da fare |
| M5: pubblicazione e apprendimento | Da fare |

**Non scrivere codice di pipeline finché il piano non è approvato.**

## Ambienti

- **Destinazione: plugghepc.** Windows 11 x64, DaVinci Resolve installato, Node non nel PATH. GPU, Python, FFmpeg e OBS si scoprono con `tools/recon.ps1` (sola lettura) e da M0 con `fabbrica doctor`. Il risultato della ricognizione va riportato qui sotto quando arriva.
- **Sviluppo: container cloud** (verificato il 28/09/2026):
  - macchina: Ubuntu 24.04, 4 core, 15 GB di RAM, nessuna GPU;
  - strumenti: Python 3.11 e 3.12, uv 0.8.17, FFmpeg 6.1.1 da apt (con libass, loudnorm e libx264), PowerShell 7 per verificare gli script `.ps1`.
- **Rete del container:**
  - raggiungibili: `pypi.org`, `raw.githubusercontent.com` (da cui si scaricano i font Google), apt di Ubuntu, `registry.npmjs.org`;
  - **bloccati:** `huggingface.co`, quindi i modelli Whisper non si scaricano qui, e `fonts.google.com`/`cdn.jsdelivr.net`;
  - per trascrivere davvero nel container, `huggingface.co` e i suoi CDN vanno aggiunti ai domini permessi dell'ambiente. Finché sono bloccati, qui i test usano trascrizioni finte e la trascrizione reale gira su plugghepc.
- **Attenzione:** `ffmpeg -encoders` elenca NVENC anche senza GPU. Conta solo una prova di encoding riuscita.

### Ricognizione di plugghepc

_Da compilare con l'output di `tools/recon.ps1`._

## Architettura (prevista, dettagli in `docs/PIANO.md`)

Pipeline a fasi idempotenti:

```
ingest → audio → transcribe → signals → candidates → score → select → copy → edit(EDL) → render → qc → report
```

- **Ripresa:** ogni fase scrive il suo output in `data/lives/<AAAA-MM-GG>_<format>/` più `state/<fase>.json`, con hash di input e config, versione e tempi. Una fase rigira solo se l'hash cambia o con `--force`.
- **Indice:** SQLite in `data/fabbrica.db` (live, candidate, clip, stato, metriche).
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
- **Secrets** solo in `.env` (ignorato da git); `.env.example` elenca le chiavi senza valori.
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

_Le decisioni tecniche proposte in `docs/PIANO.md` entrano in questa tabella quando il piano è approvato._

## Domande aperte (Fase 0)

1. Live campione (percorso) e come renderla disponibile per i test.
2. Overlay impresso o registrazione pulita; quale persona su quale traccia audio.
3. Ore di live al giorno, format, PC acceso di notte.
4. Provider LLM: chiave API Anthropic oppure `claude -p`.
5. Chi compare nelle live e se esiste già un modulo di consenso.
