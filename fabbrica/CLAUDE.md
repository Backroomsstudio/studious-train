# La Fabbrica

Software locale di Backrooms Studio: prende la registrazione integrale di una live (30 min, 4+ ore)
e produce clip verticali 9:16 per TikTok e per i Trial Reels di Instagram, con hook, sottotitoli
dinamici, montaggio di base, audio normalizzato e punteggio motivato. Una persona le rivede e le approva
da una dashboard locale. Niente viene pubblicato senza approvazione umana.

La specifica completa è il brief di progetto (sezioni §1-§17), consegnato nella prima sessione.
I riferimenti `§n` in questo file e nel codice rimandano a quella specifica.

## Stato

| Milestone | Stato |
| --- | --- |
| Fase 0: ricognizione, domande, piano | in corso: aspettiamo l'output di `tools/recon.ps1` e le risposte |
| M0 Setup | da iniziare, dopo l'approvazione del piano |
| M1 Cervello · M2 Montaggio · M3 Dashboard · M4 Automazione · M5 Pubblicazione | da iniziare |

Non esiste ancora codice della pipeline. Non scriverlo prima che il piano sia approvato.

## Dove gira

- **Destinazione**: plugghepc, Windows 11 x64. GPU da rilevare, con DaVinci Resolve e OBS installati.
- **Sviluppo nel cloud** (sessioni Claude Code web): Linux, 4 core, niente GPU. FFmpeg 6.1 con libass
  va installato con apt. `huggingface.co` è bloccato dalla rete dell'ambiente: niente modelli Whisper qui,
  a meno che il dominio non venga aggiunto a quelli consentiti. PyPI, npm, raw.githubusercontent.com
  (font) e storage.googleapis.com (modelli MediaPipe) funzionano.
- **Regola**: la logica pura (EDL, rimappaggio dei tempi, ASS, candidate, scoring, QC) si sviluppa e si
  testa ovunque. Trascrizione reale, benchmark e render sulle live vere si fanno su plugghepc.

## Architettura (prevista, da confermare in M0)

La pipeline è a fasi. Ogni fase legge gli artefatti della fase precedente e scrive i propri su disco,
in `data/lives/<AAAA-MM-GG_format>/`, con un manifest che registra l'hash dell'input e della config
usata. Se l'hash non cambia, la fase non viene rieseguita: così si riprende dopo un'interruzione.

```
ingest → audio → transcribe → signals → candidates → scoring → select → copywriting
       → edl → (reframe, subtitles, hook_overlay) → render → qc → export
```

- **Il tempo della timeline si calcola solo dall'EDL.** Una clip è una lista di intervalli sorgente →
  timeline. Parole, sottotitoli, zoom e hook si rimappano con `edl.TimeMap`. È il punto dove questi
  sistemi si rompono: i test sono obbligatori (§4.4), anche con test property-based.
- **Una sola codifica video**, nel render finale: un solo filtergraph FFmpeg per clip (tagli, crop/zoom,
  maschere HUD, ASS con libass, hook). Il loudnorm a due passaggi misura prima solo l'audio montato,
  senza codificare il video.
- **La trascrizione procede a blocchi**, tagliati nei silenzi individuati dal VAD, con un checkpoint per
  blocco. La memoria resta costante anche su file di diverse ore.
- **SQLite** (`data/fabbrica.db`) indicizza live, candidate, clip, stati e metriche. I JSON su disco
  restano la fonte di verità di ogni fase.

## Comandi

Oggi esiste solo la ricognizione:

```powershell
# su plugghepc, sola lettura
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\recon.ps1
```

Previsti (Typer, §13): `fabbrica doctor | process <file> | watch | render <clip_id> | review | export | publish | stats`.

## Convenzioni

- Python 3.12 con `uv` (`uv sync`, `uv run pytest`). Tutti i percorsi con `pathlib`, mai stringhe
  concatenate: cartelle con spazi e lettere accentate sono il caso normale su Windows.
- Identificatori in inglese. Commenti, documentazione, log e messaggi per l'utente in italiano.
- Secrets solo in `.env` (mai nel codice, nei log o nei commit). `.env.example` elenca le chiavi senza valori.
- Commit piccoli, uno per passo funzionante. Questo è il repo del sito: i commit che toccano solo
  `fabbrica/` finiscono con `[skip netlify]`, per non far partire il deploy.
- Strumenti collaudati prima del codice scritto da zero: FFmpeg, libass, faster-whisper, PySceneDetect,
  OpenCV, MediaPipe, librosa.
- Script PowerShell compatibili con Windows PowerShell 5.1, salvati in UTF-8 **con BOM**: senza BOM la
  5.1 legge male le lettere accentate.
- Una milestone è chiusa solo con test verdi e con la verifica visiva di 3 frame per clip (0,5 s, metà,
  -1 s) fatta davvero (§4.5, §16).

## Decisioni

- **2026-09-28 · Posizione del codice.** La Fabbrica vive nella cartella `fabbrica/` del repo del sito,
  sul branch di sviluppo assegnato. Se serve, si sposta in un repo dedicato con `git subtree split`,
  conservando la storia.
- **2026-09-28 · MARKER da hotkey.** Verificato su `obs-websocket/docs/generated/protocol.md`: il
  protocollo v5 **non emette un evento quando si preme un hotkey**. Il logger quindi:
  1. registra da sé un hotkey globale di Windows (anche il tasto di uno Stream Deck con l'azione
     "Hotkey");
  2. accetta un `CustomEvent` (inviato con `BroadcastCustomEvent`) con `{"fabbrica": "MARKER"}`;
  3. legge il tempo da `GetRecordStatus.outputDuration`, così il marker è relativo alla registrazione;
  4. se la registrazione è in Hybrid MP4 (OBS ≥ 30.2), chiama anche `CreateRecordChapter` (v5.5.0), così
     il marker resta scritto anche dentro il file. L'ingest legge i capitoli con `ffprobe -show_chapters`.
- **2026-09-28 · Modelli LLM (proposta, da approvare).** Scoring: `claude-sonnet-5` (alternativa più
  economica: `claude-haiku-4-5`, da confrontare in M1 su 20 candidate). Scrittura di hook e caption:
  `claude-opus-5`. Listino API al 2026-06, in $/MTok input/output: Haiku 4.5 1/5, Sonnet 5 2/10,
  Opus 5 5/25. Batch -50%, lettura dalla cache circa 0,1×. Prima di fissare i costi in `costs.py`,
  ricontrollarli sul listino ufficiale.

## Trappole note

- In una `Section` di `recon.ps1` le variabili sono locali alla sezione. Quelle che servono dopo usano
  `$script:`.
- Le build di FFmpeg possono avere NVENC senza il flag `--enable-nvenc` (lo attivano in automatico).
  Conta l'elenco degli encoder più un encode di prova, non la riga di configurazione.
- Whisper tende a non trascrivere i riempitivi ("ehm"). Per trovarli, usare i buchi fra le parole in cui
  il VAD sente parlato, non solo il testo.
