# Effetti sonori

Lo studio vuole un effetto "figo" per ogni animazione: intrattiene anche chi ascolta e basta. In overlay-live gli effetti sono **sintetizzati al momento con Web Audio**. Non ci sono file audio, quindi niente da scaricare e niente diritti d'autore. Tieni questo schema anche nei prossimi overlay.

File coinvolti (percorsi relativi a `overlay-live/`):

| File | Ruolo |
|---|---|
| `public/js/suoni.js` | **motore**: catena audio, primitive, mappa `effetti`; esporta `suona`, `volume`, `sblocca`, `audioPronto`, `NOMI_SUONI` |
| `public/js/eventi-sonori.js` | **decisione**: funzioni pure prima/dopo → elenco di suoni; `RITARDO_CLASSIFICA_MS`, `SOGLIA_URGENTE_MS` |
| `test/eventi-sonori.test.mjs` | test della decisione (6 test, `node --test`) |
| `public/js/overlay.js` | `riproduci(suoni)`: suona solo se `stato.suoni.dove === "overlay"` |
| `public/js/regia.js` | `riproduci(suoni, ritardoBase)` e `suoniRegia(prima, dopo, eventi)`: suona solo se `dove === "regia"`; selettore, volume, pulsanti Prova |
| `lib/stato.mjs` | `DOVE_SUONI`, `suoniIniziali(config)`, `impostaSuoni(stato, { dove, volume })` |
| `server.mjs` | comandi `suoni` e `provaSuono`; fusione di `suoni` in `caricaStato` |

## 1. Architettura: motore e decisione separati

```
server: stato + eventi ──WebSocket──▶ suStato(s, eventi)
                                         │  prima = stato vecchio, dopo = s
                                         ▼
             eventi-sonori.js (puro): suoniTraccia / suoniClassifica / suoniTimer
                                         │  [{ nome, dati?, ritardo? }]   ritardo in ms
                                         ▼
             riproduci() in overlay.js o regia.js (filtro "dove", volume)
                                         ▼
             suoni.js: suona(nome, dati, ritardoMs) → effetti[nome](t, dati)
```

- `eventi-sonori.js` non tocca audio né DOM: si importa in Node e si testa con `S.istantanea` di `lib/stato.mjs`.
- `suoni.js` non decide niente: riceve un nome e lo suona. Si importa anche in Node senza errori: senza `AudioContext`, `contesto()` restituisce `null` e `suona` non fa niente.
- Overlay e regia chiamano **le stesse** funzioni di decisione. Così "in questa pagina" suona esattamente come "nell'overlay".
- Un nome sconosciuto viene ignorato in silenzio (`if (!effetto ...) return`). Controlla l'ortografia contro `NOMI_SUONI`.

## 2. Catena audio (`contesto()` in `suoni.js`)

Il contesto nasce al primo `suona` o al primo clic, una volta sola:

```
voce(): gain con inviluppo ─▶ [StereoPanner se pan≠0] ─┬─▶ bus ───────────────────────────┐
                                                        └─▶ mandata (riv) ─▶ Convolver ─▶ ritorno 0,42 ─┤
                                                                                                       ▼
                                                    DynamicsCompressor ─▶ uscita (volume) ─▶ destination
```

| Pezzo | Valori |
|---|---|
| Compressore | `threshold -16`, `knee 10`, `ratio 5`, `attack 0.003`, `release 0.25`: tiene insieme gli effetti sovrapposti |
| Riverbero | `ConvolverNode` con `codaRiverbero(2.6, 3)`: rumore stereo di 2,6 s che si spegne come `(1 − i/n)^3`. Nessun file di impulso |
| Ritorno riverbero | gain `0.42` |
| Rumore | un buffer mono di 2 s di rumore bianco (`rumoreBianco`), in loop, con partenza casuale |
| Volume | `uscita.gain`; `volume(v)` limita 0…1 e usa `setTargetAtTime(v, now, 0.05)`. Con volume 0 `suona` esce subito e non crea il contesto |
| Tempo | `suona(nome, dati, ritardoMs)` chiama `effetti[nome](ctx.currentTime + 0.02 + ritardoMs / 1000, dati)`. I ritardi stanno sull'orologio audio, non su `setTimeout` |

Compatibilità: `globalThis.AudioContext ?? globalThis.webkitAudioContext`; il pan si usa solo se esiste `ctx.createStereoPanner`. Il browser di OBS / LIVE Studio può essere un Chromium vecchio: non aggiungere API audio recenti senza un controllo.

## 3. Primitive

Tutti i tempi sono in **secondi** (`t`), le frequenze in Hz, `hz(midi)` converte una nota MIDI.

| Primitiva | Cosa fa |
|---|---|
| `voce(t0, { att, dur, vol, riv, pan })` | inviluppo 0,0001 → `vol` lineare in `att`, poi esponenziale a 0,0001 entro `max(att + 0.01, dur)`; manda a `bus` e, se `riv`, al riverbero |
| `filtra(sorgente, t0, dur, { tipo, f, f2, q, durFiltro })` | BiquadFilter; se c'è `f2` la frequenza scivola in modo esponenziale |
| `tono(t0, { f, f2, glide, tipo, dur, att, vol, riv, pan, detune, filtro })` | oscillatore (`sine`, `square`, `sawtooth`, `triangle`) con glissato opzionale e filtro opzionale |
| `rumore(t0, { dur, att, vol, riv, pan, tipo, f, f2, q })` | rumore bianco filtrato (predefinito `bandpass` 1200 Hz) |
| `colpo(t, forza)` | cassa: seno 160 → 38 Hz in 0,35 s (vol 0,95·forza) + rumore lowpass 900 → 120 Hz |
| `piatto(t, forza)` | rumore highpass 6 kHz, 1,6 s, molto riverbero (0,6) |
| `rullante(t, vol)` | rumore bandpass 2400 Hz di 0,12 s con pan casuale ±0,2 + tono 210 → 150 Hz |
| `whoosh(t, dur, su, vol)` | rumore bandpass che sale 260 → 5200 Hz (`su`) o scende 5000 → 220 Hz; attacco al 75% della durata |
| `scintille(t, quante, spread, vol)` | `quante` toni sinusoidali casuali 2200–5800 Hz sparsi in `spread` secondi, pan casuale, riverbero 0,7 |
| `ottoni(t, note, { dur, vol, apri, att })` | per ogni nota due seghe scordate ±8 cent, filtro lowpass che si apre da 500 Hz a `apri` (in ≤ 0,25 s); ogni voce ha `vol / note.length * 2.2`, quindi più note non vuol dire più forte |
| `campana(t, midi, { dur, vol, pan })` | triangolo + ottava (seno, 35%) + dodicesima `midi + 19` (seno, 15%) |

`SCALA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]` (pentatonica): `voto` sceglie `SCALA[round(valore)] + 12`, quindi più alto il voto, più alta la nota.

## 4. Catalogo degli effetti

Picco e durata: misurati con `strumenti/suoni.mjs livelli` (volume 0,8, canale sinistro, tre misure a ottobre 2026; variano un po' perché pan e scintille sono casuali). "Prova" = c'è il pulsante `data-suono` in `regia.html`.

| Effetto | Quando parte (regola) | Com'è | Picco | Durata | Prova |
|---|---|---|---|---|---|
| `nuovaTraccia` | `corrente.id` cambia (`suoniTraccia`) | whoosh 0,7 s, colpo, accordo di ottoni, scintille | 0,54 | 2,0 s | sì |
| `voto` | voto di un giudice visibile, `dati.valore` | campana sulla nota del voto + scintille | 0,27 | 1,3 s | sì (valore 7) |
| `bloccato` | voto inserito con `nascondiVoti` attivo e traccia non confermata | click di cassaforte | 0,28 | 0,2 s | no |
| `chatApre` / `chatChiude` | `corrente.chat.aperta` cambia | whoosh + due note quadre + campana / due campane che scendono | 0,36 / 0,47 | 2,0 / 1,5 s | sì / no |
| `chatVoto` | aumenta `punteggi.chatVoti`: al massimo 4 pop, sfalsati di 70 ms | pop acuto leggero (vol 0,08), non copre la voce | 0,02–0,04 | 0,1 s | no |
| `calcolo` | evento `classifica` (esito di `conferma`) | salita di 1,5 s con tic che accelerano, poi `risultato` | 0,59–0,63 | 3,3 s | sì |
| `risultato` | solo dentro `calcolo`, a +1,5 s | colpo, piatto, accordo di 6 note, scintille | 0,55 | 1,9 s | no |
| `primo` | nuovo primo in classifica (`suoniClassifica`) | fanfara "ta-ta-ta-taaa" con rullante, colpo, piatto, 22 scintille | 0,61–0,67 | 2,6–3,1 s | sì |
| `entrata` | nuova entrata in top (se non c'è un nuovo primo) | whoosh, arpeggio di 4 campane, colpo leggero | 0,52 | 2,2 s | sì |
| `sale` | una traccia sale (se non c'è primo né entrata), `dati.posti` = salita massima | whoosh + `posti + 1` campane che salgono (max 5) | 0,36 | 1,7 s | sì (posti 1) |
| `esce` | qualcuno esce dalla top, `ritardo: 600` | sega che scende 320 → 65 Hz + whoosh giù | 0,12 | 0,7–0,9 s | no |
| `premio` | `premio` cambia ed è non vuoto | due campane + scintille | 0,38 | 1,7 s | no |
| `allarme` | countdown passa sotto 30 min e sotto 1 min (`suoniTimer`) | colpo + sirena quadra 880/660 Hz × 4 | 0,38 | 1,5 s | sì |
| `tic` | ultimi 10 s, uno al secondo; `dati.ultimi` negli ultimi 3 | tic 1000 Hz, o 1500 Hz più forte con colpo | 0,19 | 0,1 s | no |
| `vincitore` | `vincitore.visibile` con nuova chiave `id@proclamatoAlle` | rullo di 2 s che cresce, poi colpo, piatto, tre accordi, 40 scintille | 0,63–0,67 | 5,6 s | sì |
| `spareggio` | `spareggio.dal` cambia | 4 battiti di cuore su tappeto di seghe | 0,56 | 3,2 s | no |

Somma di una sequenza tipica di 36 s a volume 0,9 (sezione 9): picco −2,7 dBFS, media −24,5 dB. Nessuna distorsione anche quando gli effetti si sovrappongono.

## 5. Regole di decisione (`eventi-sonori.js`)

**`suoniTraccia(prima, dopo, eventi)`**, chiamata a ogni stato in arrivo:
1. `prima` nullo (primo disegno, LIVE Studio che ricarica la sorgente) → `[]`.
2. Ogni evento `suono` (da `provaSuono`) aggiunge `{ nome: e.dati.nome }`. Resta anche nei casi esclusivi qui sotto.
3. Nuovo vincitore → solo `vincitore`. Nuovo spareggio → solo `spareggio`. Escono subito: niente altro rumore sopra.
4. Premio cambiato → `premio` (si somma al resto).
5. Traccia cambiata → `nuovaTraccia` ed esce.
6. Evento `classifica` → `calcolo` ed esce: alla conferma non suonano i singoli voti rivelati.
7. Per `beat`, `voce`, `mix`: valore cambiato e non nullo → `bloccato` se i voti sono nascosti (solo al primo inserimento, `v1 === null`), altrimenti `voto` con il valore.
8. Chat aperta/chiusa → `chatApre` / `chatChiude`. Nuovi voti chat → fino a 4 `chatVoto` con `ritardo: i * 70`.

**`cambiClassifica(prima, dopo)`** → `{ entrate, salite, uscite, nuovoPrimo }` per id. **`suoniClassifica(cambi)`** → un solo effetto principale (`primo` > `entrata` > `sale`) più `esce` a +600 ms. Le pagine la chiamano solo se nello stesso messaggio c'è l'evento `classifica`: `togliRisultato`, `demo` e `nuovaSerata` cambiano la classifica senza suoni di classifica (ma `demo` e `nuovaSerata` cambiano la traccia, quindi suona `nuovaTraccia`).

**`suoniTimer(msPrima, msDopo)`**: `[]` se uno dei due è `null`, se `msDopo <= 0` o se il tempo è aumentato (minuti aggiunti dalla regia). Sirena al passaggio sotto `SOGLIA_URGENTE_MS` (30 min, la stessa soglia che rende il timer rosso con la classe `urgente`) e sotto 60 s. Tic quando cambia il secondo intero (`Math.ceil(ms / 1000)`) ed è ≤ 10. Funziona a qualsiasi frequenza di chiamata: l'overlay la chiama a ogni frame in `cicloTempo`, la regia ogni 250 ms.

## 6. Sincronia con le animazioni

Suoni e animazioni devono cadere insieme, senza accavallarsi. Dopo `conferma` (F4):

| t | Overlay | Suono |
|---|---|---|
| 0 | il totale conta da 0 in 1500 ms (`numero(tab.totale, p.totale, 2, 1500)`), classe `calcolo` (vibra) | `calcolo`: salita di 1,5 s |
| 1,5 s | `setTimeout(..., 1500)` in `disegnaTabellone` → `rilancia(tab.totaleValore, "timbro")` | `risultato` (colpo + accordo) |
| 1,7 s | `aggiornaClassifica` rinvia `disegnaClassifica` di `RITARDO_CLASSIFICA_MS` (1700): righe che si muovono, badge, notifica | `primo` / `entrata` / `sale` |
| 2,3 s | la riga uscita sta scivolando sotto l'ultimo posto (parte a 1,7 s, dura 1 s) | `esce` (`ritardo: 600`) |
| 10 s | se su Nero aspetta già la traccia dopo (`neroInArrivo`), passa sul tabellone (`nero.attesaDopoConfermaSecondi`) | `nuovaTraccia` |

- Nell'overlay il ritardo della classifica è un `setTimeout` (deve aspettare anche il disegno). Nella regia, che non anima la classifica, è `ritardoBase = RITARDO_CLASSIFICA_MS` passato a `suona`. Stessa costante, importata da `eventi-sonori.js`.
- Vincitore: `const rullo = 2` in `effetti.vincitore`. Lo stesso istante compare in due altri posti: `setTimeout(..., 2000)` delle scintille in `disegnaVincitore` (`overlay.js`) e i `--d` di `overlay.html` (corona `2s`, titolo `2.1s`, artista `2.4s`, punti `2.7s`, premio `3s`). **Se cambi il rullo, cambia tutti e tre.**
- Regola generale: la durata di un'animazione legata a un suono va in una costante esportata da `eventi-sonori.js` (come `RITARDO_CLASSIFICA_MS`). Non ripetere numeri a mano in tre file.

## 7. Dove suonano, e perché si sceglie dalla regia

Non è ancora verificato se TikTok LIVE Studio manda in diretta l'audio della sorgente Link. Per questo l'uscita si sceglie dalla regia (riquadro **Suoni**):

| `suoni.dove` | Chi suona | Quando usarlo |
|---|---|---|
| `overlay` (predefinito) | `overlay.js`, se l'URL non ha `?muto` né `?statico` | se in diretta l'audio della sorgente Link si sente |
| `regia` | `regia.js` | altrimenti: regia aperta sul PC della diretta + in LIVE Studio l'audio del PC |
| `spenti` | nessuno | — |

- Stato: `suoni: { dove, volume }`, nato da `suoniIniziali(config)` (`config.suoni?.dove ?? "overlay"`, `config.suoni?.volume ?? 0.8`; la chiave `suoni` non è in `config.esempio.json` ma è letta). `impostaSuoni` accetta solo i valori di `DOVE_SUONI`, volume 0…1 arrotondato a 2 decimali, e lancia un errore in italiano.
- `caricaStato` in `server.mjs` fonde `salvato.suoni = { ...iniziale.suoni, ...salvato.suoni }`; `demo` e `nuovaSerata` conservano `suoni`. Se aggiungi un campo (es. un volume per categoria), fondilo e conservalo allo stesso modo.
- Il link **Anteprima overlay ↗** della regia è `/overlay?anteprima=1&guide=1&muto=1`: muto, così non si sente doppio.
- `#suoni-nota` in regia spiega cosa fare per ogni scelta (`disegnaSerata`).
- **Prova**: il pulsante `data-suono="nome"` invia `provaSuono`; il server fa `emetti("suono", { nome })` e il suono fa **lo stesso percorso** di quelli veri, quindi esce dove è impostato. Senza `dati`: `voto` suona come 7, `sale` come 1 posto. Con i suoni spenti la regia avvisa e non invia. Da Stream Deck: `POST /api/provaSuono` con `{"nome":"primo"}`.
- Allo studio: "Premete Prova → Primo posto e ascoltate da un telefono collegato alla live. Se non si sente, scegliete «in questa pagina» e in LIVE Studio aggiungete l'audio del PC".

## 8. Sblocco dell'audio (autoplay)

- I browser fanno partire l'audio solo dopo un gesto. `suoni.js` registra `sblocca` su `pointerdown` e `keydown`; `contesto()` chiama `ctx.resume()` se lo stato è `suspended`.
- Nella sorgente Link di LIVE Studio / OBS di solito non serve (lo dice il commento in `suoni.js`). Nella regia sì: finché `audioPronto()` è falso, la nota dice "fate un clic qui per attivare l'audio del browser". La nota si ridisegna al prossimo stato in arrivo, non al clic.
- Non si verifica nel cloud: Chromium headless di Playwright lascia partire l'audio anche con `--autoplay-policy=user-gesture-required` (provato). Va provato sul PC della diretta.

## 9. Misurare e far ascoltare

`strumenti/suoni.mjs` sostituisce `window.AudioContext` con un `OfflineAudioContext` e rende gli effetti senza altoparlanti. L'URL deve essere una pagina servita dallo stesso server, perché lo strumento importa `/js/suoni.js`.

```bash
# dalla radice del repo, con il server avviato (npm start in overlay-live)
node .claude/skills/overlay-live-tiktok/strumenti/suoni.mjs "http://127.0.0.1:4747/overlay?muto=1" livelli

# senza avviare il server (basta un server statico su public/; ignora gli errori di WebSocket)
python3 -m http.server 4799 --bind 127.0.0.1 --directory overlay-live/public &
node .claude/skills/overlay-live-tiktok/strumenti/suoni.mjs "http://127.0.0.1:4799/overlay.html?muto=1" livelli
pkill -f '^python3 -m http.server 4799'
```

`livelli` stampa picco, RMS e durata per ogni nome di `NOMI_SUONI` (buffer di 7 s) e segnala con ⚠ i picchi ≥ 1 (distorti) o < 0,02 (muti).
- Obiettivo: picco tra ~0,1 e ~0,65 per gli effetti principali. I più forti (`primo`, `vincitore`, `calcolo`) stanno sopra 0,6. Gli effetti di sottofondo stanno sotto: `chatVoto` 0,02–0,04, `tic` 0,19.
- Misura **solo il canale sinistro**: un effetto con pan casuale varia a ogni misura. `chatVoto` sfiora la soglia 0,02 e può comparire tra i ⚠ "muti". È voluto: si sente come un ticchettio sotto la voce.

MP3 di anteprima per lo studio (sequenza `[nome, dati, secondo di partenza]`, durata totale in secondi, volume 0,9):

```bash
D=<scratchpad>
node .claude/skills/overlay-live-tiktok/strumenti/suoni.mjs "http://127.0.0.1:4747/overlay?muto=1" wav $D/suoni.wav '[["nuovaTraccia",{},0],["voto",{"valore":6},2.5],["voto",{"valore":8},3.3],["voto",{"valore":9.5},4.1],["chatApre",{},5.5],["chatVoto",{},7.5],["chatVoto",{},7.57],["chatChiude",{},9],["calcolo",{},11],["entrata",{},12.7],["sale",{"posti":2},16],["primo",{},19],["allarme",{},23],["tic",{},25.5],["tic",{"ultimi":true},26.5],["vincitore",{},28]]' 36
ffmpeg -loglevel error -y -i $D/suoni.wav -b:a 192k $D/suoni.mp3
ffmpeg -hide_banner -i $D/suoni.wav -af volumedetect -f null - 2>&1 | grep max_volume   # deve restare sotto 0 dB
```

La sequenza segue i tempi veri (`entrata` a `calcolo` + 1,7 s). Manda l'MP3 con `SendUserFile` e scrivi in italiano semplice l'ordine dei suoni ("0 s nuova traccia, 2,5 s voti dei giudici, …").

## 10. Aggiungere un effetto nuovo

1. **Partitura** in `effetti` (`suoni.js`): `nome(t, { campo = predefinito } = {}) { ... }`. Usa solo le primitive e somma i tempi a `t`. Metti un predefinito a ogni dato, così il pulsante Prova funziona senza `dati`. Il nome entra da solo in `NOMI_SUONI`.
2. **Regola** in `eventi-sonori.js`: estendi `suoniTraccia`, `suoniClassifica` o `suoniTimer`, oppure scrivi una nuova funzione pura `(prima, dopo, ...) → [{ nome, dati?, ritardo? }]`. Decidi la priorità: un momento "da schermo pieno" esce subito con `return [...suoni, { nome }]`. Confronta valori dello stato (chiavi come `id@proclamatoAlle`), non eventi, quando puoi.
3. **Chiamata in entrambe le pagine**: in `overlay.js` (`suStato` o la funzione che anima il pannello) con `riproduci(...)`, e in `regia.js` dentro `suoniRegia` (o nel `setInterval` se dipende dal tempo). Se la dimentichi nella regia, con «in questa pagina» quel suono non esiste.
4. **Test** in `test/eventi-sonori.test.mjs`: costruisci lo stato con `S.statoIniziale(config)`, fai `foto()` prima e dopo l'azione, controlla `nomi(...)`. Testa anche il caso che **non** deve suonare.
5. **Pulsante Prova** in `regia.html`, nel blocco `.prova-suoni`: `<button class="piccolo" data-suono="nome">Etichetta</button>`. Si collega da solo.
6. **Sincronia**: se il suono ha un culmine (colpo, timbro), metti la stessa costante nell'animazione (sezione 6).
7. **Misura**: `livelli`, poi un WAV con l'effetto in mezzo a quelli vicini. Regola `vol` finché il picco sta nella fascia degli effetti simili e la sequenza resta sotto 0 dB.
8. **Documenta**: elenco degli effetti in `README.md` (`## Effetti sonori`) e in `GUIDA.html` (`<section id="suoni">`).
9. `npm test` in `overlay-live/`.

Esempio minimo (traccia Throne in onda):

```js
// suoni.js, dentro effetti
throne(t) {
  whoosh(t, 0.5, true, 0.3);
  ottoni(t + 0.45, [48, 55, 60, 67], { dur: 1.2, vol: 0.14, apri: 5000 });
  campana(t + 0.45, 84, { dur: 1.2, vol: 0.18 });
  scintille(t + 0.5, 14, 0.8);
},

// eventi-sonori.js, in suoniTraccia, al posto del ramo della nuova traccia
if (a.id !== b.id) return [...suoni, { nome: b.tier === "throne" ? "throne" : "nuovaTraccia" }];

// test/eventi-sonori.test.mjs
test("una traccia Throne ha la sua entrata", () => {
  const stato = S.statoIniziale(config);
  const prima = foto(stato);
  stato.corrente = S.tracciaVuota({ titolo: "Re", tier: "throne" });
  assert.deepEqual(nomi(suoniTraccia(prima, foto(stato))), ["throne"]);
});
```

L'esempio passa i test (provato su una copia). `tier` funziona perché `tracciaVuota` lo accetta e `istantanea` lo manda alle pagine: per un campo nuovo controlla entrambe le cose.

## 11. Trappole

- **Unità diverse**: `ritardo` nelle voci di suono e `ritardoMs` di `suona` sono in millisecondi; `t` dentro `effetti` e la sequenza di `suoni.mjs wav` sono in secondi.
- **Raffiche**: senza il limite di 4 `chatVoto` per aggiornamento, 50 voti in chat diventano rumore. Ogni effetto ripetibile ha bisogno di un tetto.
- **Primo disegno muto**: niente suoni con `prima === null` e niente effetti di classifica con `primoDisegno`. LIVE Studio ricarica la sorgente quando vuole.
- **Doppio audio**: se apri l'overlay in un browser mentre suona anche LIVE Studio, aggiungi `?muto=1`. Con più overlay attivi insieme, ognuno ha il suo `suoni.dove`: falli suonare da uno solo.
- **Volume 0** non crea il contesto: un `audioPronto()` falso con volume 0 è normale.
- **Casualità**: pan, scintille e rumore sono casuali, quindi le misure cambiano un po' a ogni giro. I test non toccano l'audio: verificano solo la decisione.
- **Niente file audio presi dal web** (diritti). Se lo studio vuole un suono "come quello di X", imitalo con le primitive.
