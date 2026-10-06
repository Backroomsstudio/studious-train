# Integrazioni esterne e regia

Nero.fan (traccia in onda e submission pagate), chat TikTok (voti), regia (tasti, flusso, API per Stream Deck) e come aggiungere un'altra integrazione nello stesso stile. Tutto verificato su `overlay-live` (ottobre 2026). Per lo scheletro del server, la sicurezza e le porte vedi `architettura-e-riuso.md`.

| Integrazione | File e funzioni | Nel cloud si prova con |
|---|---|---|
| Nero.fan, traccia in onda (polling) | `lib/nero.mjs`: `avviaNero`, `tracciaInOnda`; `server.mjs`: `collegaNero`; `lib/stato.mjs`: `tracciaDaNero`, `passaSeTocca`, `prossima` | `strumenti/nero-finto.mjs` + `NERO_API` |
| Nero.fan, submission pagate (webhook) | `lib/nero.mjs`: `firmaValida`, `versoCoda`; `server.mjs`: server del webhook in fondo al file | `curl` con firma calcolata da `openssl` |
| Chat TikTok | `lib/chat.mjs`: `avviaTikTok`, `leggiVoto`, `commentoTikTok`; `server.mjs`: `collegaTikTok`, `registraCommento`; `lib/stato.mjs`: `votoChat` | comandi `messaggioChat` e `simulaChat` (la live vera no) |
| Regia | `public/regia.html`, `public/js/regia.js`, `public/js/connessione.js` | browser su `/regia`, `curl` su `/api` |

## 1. Nero.fan

Lo studio riceve le tracce su Nero.fan: utente `backrooms`, link pubblico `nero.fan/backrooms`. Tier delle submission: `standard` (gratis), `skip`, `superskip`, `throne` (a pagamento). Ogni altro valore diventa `standard` (funzione `tier` in `lib/nero.mjs`). La coda della regia li ordina come Nero: throne, superskip, skip, standard, poi per arrivo (`ORDINE_TIER` e `ordinaCoda` in `lib/stato.mjs`).

### 1.1 Endpoint pubblici (senza login né chiave)

Sono gli stessi che usa la pagina pubblica del profilo. Base: `https://api.nero.fan` (sostituibile con la variabile d'ambiente `NERO_API`).

```text
GET /users/<utente>/profile      → { liveSession: { id, isLive }, ... }
GET /queue/<liveSession.id>/slim → { queue: [...], current: { streamSubmissionId, submissionName,
                                     submitterName, tier, status: "current" } | null, meta: { queueCount } }
```

`tracciaInOnda(coda)` riduce `current` a `{ neroId, titolo, artista, tier }` (`submissionName` → titolo, `submitterName` → artista, testi tagliati a 120 caratteri). Senza `current.streamSubmissionId` restituisce `null`. `queue` non si usa: la coda pubblica la regia la mostra in un iframe (`https://www.nero.fan/embed/<utente>?mode=queue&theme=dark`, riquadro *Coda su Nero.fan*).

### 1.2 Polling: `avviaNero(username, suInOnda, suStato, { intervallo = 3000, scarica = fetch })`

- Ogni giro: se non ha la sessione o l'ha letta più di 60 s fa, rilegge il profilo. Poi legge `/queue/<id>/slim?_t=<ora>` (`_t` evita la cache) e chiama `suInOnda(traccia)`, anche con `null`.
- Tempi: 3 s se collegato; 30 s se il profilo non ha `liveSession.isLive`; 10 s dopo un errore. Dopo 3 errori di fila dimentica la sessione e rilegge il profilo. Ogni richiesta ha `AbortSignal.timeout(8000)`.
- `suStato` riceve `{ stato, messaggio }` con `stato` = `spento` (username vuoto), `attesa` («Nessuna sessione live su Nero per backrooms: riprovo ogni 30 secondi», «Nero.fan non risponde (…)») o `collegato` («Su Nero suona «X» di Y», «Collegato a Nero: nessuna traccia in riproduzione»).
- Restituisce la funzione che ferma il polling.
- `collegaNero()` in `server.mjs` passa `config.nero.username` (si cambia solo in `config.json`, non dalla regia). Chiama `cambiato()` solo se `stato` o `messaggio` cambiano: senza quel controllo partirebbe un messaggio a tutte le pagine ogni 3 s.
- `statoNero` vive solo nel server (non in `dati/stato.json`). Arriva alle pagine in `istantanea()` come `nero: { stato, messaggio, automatico, inArrivo, attesaDopoConfermaSecondi }` più `neroUtente`.

### 1.3 Traccia automatica sul tabellone

`tracciaDaNero(stato, traccia, { ora, attesaMs })`, chiamata a ogni giro:

| Situazione | Effetto |
|---|---|
| `traccia` null o `neroId` uguale a `stato.neroUltimo` | niente (restituisce `false`) |
| `neroAutomatico` spento | aggiorna solo `neroUltimo` |
| sempre, se automatico | toglie dalla coda della regia le voci con stesso titolo e artista |
| tabellone già su quella traccia (stesso titolo e artista) | niente, i voti restano |
| traccia attuale con voti non confermati (`haVoti`) | aspetta in `neroInArrivo` |
| confermata da meno di `attesaMs` (`ultimaConfermaAlle`) | aspetta in `neroInArrivo` |
| altrimenti | `corrente = tracciaVuota({ titolo, artista, tier })` |

- Se su Nero ne passano due mentre si vota, `neroInArrivo` tiene l'ultima, cioè quella che suona davvero.
- `passaSeTocca(stato, ora, attesaMs)` gira ogni 250 ms nel `setInterval` del server. Porta `neroInArrivo` sul tabellone (con `prossima`) solo se la traccia attuale è confermata e sono passati `attesaMs`. Se la regia cambia un voto dopo la conferma, `impostaVoto` rimette `confermato = false` e il passaggio aspetta la nuova conferma.
- `attesaMs` = `nero.attesaDopoConfermaSecondi` × 1000 (`ATTESA_DOPO_CONFERMA_MS`, predefinito 10 s): il pubblico vede il totale che conta (1,5 s) e la classifica che si muove (dopo 1,7 s) prima del cambio.
- Con `0` la traccia in arrivo passa appena si conferma, entro 250 ms. Verificato sul codice: **non** «solo con F8», come dicono invece README e `regia.js`.
- `F8` / *Passa ora* (comando `prossima`) la porta subito. Senza traccia in arrivo `prossima` svuota il tabellone, e la traccia che suona su Nero non torna finché su Nero non cambia (`neroUltimo` è uguale). Per farla tornare: togli e rimetti la spunta *Traccia automatica da Nero.fan* (il comando `neroAutomatico` con `attivo: true` azzera `neroUltimo`).
- `nuovaSerata` non conserva `neroUltimo`: la traccia in onda torna sul tabellone al giro dopo. `demo` lo conserva, così i dati finti restano.

### 1.4 Webhook delle submission pagate (facoltativo)

- Nero → Settings → Developer → Stream triggers manda una POST a ogni submission **pagata**. Doc: `https://www.nero.fan/docs/stream-triggers`. Le gratuite non mandano niente.
- Server separato in fondo a `server.mjs`. Ascolta solo su `127.0.0.1:<nero.portaWebhook>` (4748), solo `POST /webhook/nero`, corpo massimo 64 KB. Altri percorsi: 404. Con `"portaWebhook": 0` non parte.
- Firma: header `X-Nero-Signature: sha256=<hex>`, HMAC-SHA256 del **corpo grezzo** con `nero.segreto`. `firmaValida` accetta maiuscole e spazi ai bordi e confronta con `timingSafeEqual`. Senza segreto rifiuta tutto (401) e all'avvio stampa un avviso.
- Risponde 200 subito, poi `versoCoda(evento, ora)`. Considera solo `event === "submission.paid"`: `data.submissionName` → titolo, `data.submitterName` → artista, `tier`, `amountPaid` → importo, `timestamp`. L'id `nero-<sessionId>-<timestamp>-<submissionName>` scarta i doppioni. Poi `emetti("coda", voce)`.
- Associazione nome → titolo/artista **non ancora verificata con un evento vero**: alla prima prova dello studio controlla cosa arriva (*Send test event*).
- Serve un indirizzo HTTPS pubblico. Il dominio statico gratuito di ngrok espone solo la porta 4748, mai la regia:

```bat
winget install ngrok.ngrok
ngrok config add-authtoken <token>
ngrok http 4748 --url=<dominio>.ngrok-free.app
```
  Su Nero l'URL è `https://<dominio>.ngrok-free.app/webhook/nero`. Copia il signing secret in `nero.segreto`. Se due overlay usano il webhook insieme, ognuno ha la sua porta e il suo tunnel.

### 1.5 Cosa deve fare lo studio su nero.fan

1. Prima della diretta **avviare la sessione live** di `backrooms`. Senza, la regia mostra *Nero in attesa* (passa il mouse sul bollino: «Nessuna sessione live su Nero…»). Dopo l'avvio basta aspettare fino a 30 s; se c'era già una sessione vecchia letta dal server, fino a ~60 s.
2. Lasciare accesa *Traccia automatica da Nero.fan* (regia, riquadro *In ascolto*).
3. Passare alla traccia successiva **su Nero**: il tabellone segue da solo.
4. Solo per la coda pagata: ngrok, URL in Stream triggers, segreto in `config.json`, *Send test event*. Le gratuite si leggono in *Coda su Nero.fan* e si aggiungono con *Metti in coda*.

### 1.6 Provare senza Nero (il cloud blocca `api.nero.fan`: `CONNECT tunnel failed, response 403`)

Lavora su una copia con porte proprie, mai nella cartella con lo stato vero:

```bash
SK=/home/user/studious-train/.claude/skills/overlay-live-tiktok/strumenti
P=<scratchpad>/prova && mkdir -p $P && cd /home/user/studious-train
git archive HEAD overlay-live | tar -x --strip-components=1 -C $P
cd $P && ln -s /home/user/studious-train/overlay-live/node_modules node_modules
node -e 'const f=require("fs"),c=JSON.parse(f.readFileSync("config.esempio.json"));c.porta=4797;c.nero.portaWebhook=4798;c.nero.segreto="prova";c.tiktok="";f.writeFileSync("config.json",JSON.stringify(c,null,2))'
node $SK/nero-finto.mjs 4999 backrooms > nero.log 2>&1 &
NERO_API=http://127.0.0.1:4999 node server.mjs > server.log 2>&1 &
sleep 2
curl -s "http://127.0.0.1:4999/cambia?titolo=Asfalto&artista=Dama&tier=throne"   # in onda su Nero
sleep 3.5; curl -s http://127.0.0.1:4797/api/stato | head -c 400                  # corrente = Asfalto
curl -s http://127.0.0.1:4999/spegni    # sessione finita: "Nessuna sessione live" entro ~60 s
```

- `/cambia` riaccende anche la sessione. Ogni `/cambia` crea un `streamSubmissionId` nuovo (`sub-1`, `sub-2`…).
- Prova verificata: voto → `/cambia` → `neroInArrivo` → `conferma` → dopo 5 s ancora la vecchia → dopo 11 s la nuova sul tabellone.

Webhook firmato (verificato: 200 e voce in coda; firma sbagliata 401; GET 404):

```bash
CORPO='{"event":"submission.paid","data":{"sessionId":"s1","tier":"superskip","amountPaid":15,"submitterName":"Lince","submissionName":"Notti a Vicenza","timestamp":1700}}'
FIRMA="sha256=$(printf '%s' "$CORPO" | openssl dgst -sha256 -hmac prova -hex | sed 's/^.*= //')"
curl -s -X POST http://127.0.0.1:4798/webhook/nero -H "Content-Type: application/json" -H "X-Nero-Signature: $FIRMA" -d "$CORPO"
```

Alla fine fermali per porta (non con `pkill`, vedi `architettura-e-riuso.md`): `kill $(lsof -ti tcp:4797 -sTCP:LISTEN) $(lsof -ti tcp:4999 -sTCP:LISTEN)`.

## 2. Chat TikTok

- Libreria `tiktok-live-connector` (^2.5.0). Sola lettura, nessun login: basta l'@ dell'account in diretta (`config.tiktok` = `backrooms.studios`, poi `stato.tiktokUtente`, cambiabile dalla regia con *Collega chat* o col comando `tiktok`).
- `avviaTikTok(nome, suCommento, suStato, log)` crea `new TikTokLiveConnection(nome, { processInitialData: false })` e ascolta `WebcastEvent.CHAT`, `STREAM_END`, `ControlEvent.DISCONNECTED` ed `ERROR`. Restituisce la funzione che ferma tutto. `collegaTikTok()` ferma la connessione precedente prima di aprirne una nuova.
- Stati per la regia: `spento` (nessun account), `collegato` («Collegato alla live di @x»), `attesa` con nuovo tentativo:

| Caso | Riprova tra |
|---|---|
| `UserOfflineError` o messaggio con offline / not live | 60 s |
| errore con «Room ID» (account inesistente o mai andato in diretta) | 60 s |
| altro errore di connessione | 30 s |
| `STREAM_END` (live finita) | 30 s |
| `DISCONNECTED` | 10 s |

- Ogni callback controlla `connessione === c`: gli eventi di una connessione vecchia non toccano lo stato.
- `chiudi(c)` toglie gli ascoltatori ma rimette un `ControlEvent.ERROR` vuoto: un `error` senza ascoltatori farebbe cadere il server.
- `commentoTikTok(dati)`: testo in `content` (schema vecchio `comment`), utente in `user.displayId` (vecchio `user.uniqueId`, poi `user.id`). Senza utente: `null`.
- `leggiVoto(testo)` (regex `RE_VOTO`) accetta 0–10 con al massimo un decimale: `8`, `7.5`, `7,5`, `10.0`, `9/10`, `!voto 6`, `!v 6.5`. Rifiuta `10.5`, `11`, `07`, `-3`, `8 bomba`, `7.25`.
- `votoChat` (`lib/stato.mjs`) applica un voto per utente. Chiave `piattaforma:utente` in minuscolo: `Mario` e `mario` sono la stessa persona. Vale l'ultimo voto. Conta solo a voto aperto e prima di `chiudeAlle`. `ultimi` tiene gli ultimi 8 per l'overlay.
- La chiusura a tempo la fa `chiudiChatSeScaduta` nel `setInterval`. Anche `conferma` chiude il voto. La chat pesa come un giudice (`pesi.chat` = 1, cioè 25%).
- **Nel cloud non si prova.** La firma passa da `api.eulerstream.com` (bloccato). Nel cloud la regia mostra «Nessuna live trovata per @backrooms.studios: controlla il nome dell'account» anche col nome giusto: non è un errore di nome. Prova la logica così:

```bash
A=http://127.0.0.1:4797/api; H="Content-Type: application/json"
curl -s -X POST $A/apriChat -H "$H" -d '{"secondi":60}'
curl -s -X POST $A/messaggioChat -H "$H" -d '{"piattaforma":"tiktok","utente":"mario","testo":"7,5"}'   # {"contato":true}
curl -s -X POST $A/simulaChat -H "$H" -d '{"quanti":20}'      # voti finti (serve il voto aperto)
```
  La prova vera la fa lo studio: live accesa → bollino *TikTok in ascolto* → qualcuno scrive `8` → il conteggio sale.
- La libreria legge anche `SIGN_API_KEY` dall'ambiente (chiave Euler Stream, utile se la firma gratuita va a limite). Non provato: non serve finché la chat funziona.

## 3. Regia

Si apre su `http://127.0.0.1:4747/regia` (anche `/`). In alto ci sono tre bollini: connessione al server (`connesso`/`offline`), *TikTok …* e *Nero …* (in ascolto / in attesa / non collegato). Passandoci il mouse si legge il motivo. Il link *Anteprima overlay ↗* apre `/overlay?anteprima=1&guide=1&muto=1`: `muto` evita di sentire i suoni due volte.

| Tasto | Azione (`regia.js`, fondo del file) |
|---|---|
| `F2` | apre/chiude il voto chat con la durata scelta (30 s, 60 s, 90 s, 2 min, senza limite) |
| `F4` o `Ctrl+Invio` | conferma: prima manda i voti ancora in attesa (`svuotaVoti`), poi `conferma` |
| `F8` | prossima traccia (chiede conferma se ci sono voti non confermati) |
| `F9` | pausa / riprendi countdown |
| `Invio` in un voto | passa al campo successivo |

I tasti funzionano anche col cursore in un campo; la ripetizione tenendo premuto è ignorata. I voti partono 150 ms dopo l'ultima cifra. `riempi` non sovrascrive un campo mentre l'operatore scrive.

**Flusso di una serata**
1. `AVVIA.cmd` (finestra nera aperta), regia nel browser.
2. *Serata*: premio, frasi (separate da `|`), giudici, @ TikTok e *Collega chat*.
3. Su nero.fan avvia la sessione live: bollino *Nero in ascolto*.
4. *Suoni*: *Prova → Primo posto* e ascolta da un telefono collegato alla live.
5. *Countdown → Avvia* (180 min), poi diretta da LIVE Studio.
6. Per ogni traccia: arriva da Nero (oppure *In ascolto ora*, o ▶ dalla coda) → i giudici dicono il voto e la regia lo scrive → `F2` → `F4` → su Nero si passa alla successiva → dopo 10 s cambia da sola (`F8` per subito).
7. Allo scadere vince il primo. Con pari merito compare il riquadro *Spareggio*: *Proclama* sul vincitore scelto dai giudici. *Chiudi schermata finale* toglie il vincitore. La volta dopo: *Nuova serata*.

Altri riquadri: *In onda* (mostra/nasconde premio, tabellone, classifica, timer; con la classifica nascosta l'overlay la mostra 15 s dopo ogni conferma), *Suoni* (dove, volume, prova), *Correggi nomi* (cambia i nomi senza azzerare i voti; clic sulla traccia in ascolto per copiarli nel modulo). *Carica dati demo* sostituisce la serata: mai durante la diretta.

**Stream Deck e altri tool.** Ogni comando è `POST /api/<comando>` con `Content-Type: application/json` (formato, risposte e PIN in `architettura-e-riuso.md` §7; elenco completo nella tabella «API» del README). Su Windows la via più semplice è un `.cmd` per tasto con `curl` (incluso in Windows 10/11):

```bat
curl -s -X POST http://127.0.0.1:4747/api/conferma -H "Content-Type: application/json" -d "{}"
curl -s -X POST http://127.0.0.1:4747/api/apriChat -H "Content-Type: application/json" -d "{\"secondi\":60}"
curl -s -X POST http://127.0.0.1:4747/api/chiudiChat -H "Content-Type: application/json" -d "{}"
curl -s -X POST http://127.0.0.1:4747/api/prossima -H "Content-Type: application/json" -d "{}"
curl -s -X POST http://127.0.0.1:4747/api/countdown -H "Content-Type: application/json" -d "{\"azione\":\"pausa\"}"
curl -s -X POST http://127.0.0.1:4747/api/provaSuono -H "Content-Type: application/json" -d "{\"nome\":\"primo\"}"
```

- L'API non ha i comandi «alterna» dei tasti: `apriChat`/`chiudiChat` e `countdown` `pausa`/`riprendi` sono separati.
- Le domande di conferma stanno solo nella pagina. Da API `prossima` e `traccia` buttano via i voti non confermati senza chiedere.
- `messaggioChat` (`{ piattaforma, utente, testo }`) inoltra commenti da altri tool. La piattaforma fa parte della chiave: lo stesso nome su due piattaforme vale due voti.

## 4. Aggiungere un'altra integrazione nello stesso stile

Esempi: un'altra piattaforma di submission, i regali TikTok (`WebcastEvent.GIFT`, `LIKE`, `FOLLOW`, `SHARE` esistono nella 2.5.0), un obiettivo di donazioni.

**Polling (modello `avviaNero`)** in `lib/<nome>.mjs`:

```js
const API = process.env.XYZ_API ?? "https://api.xyz.example";       // sostituibile per le prove
export function datoUtile(risposta) { /* pura: riduce la risposta a ciò che serve, testi tagliati */ }
export function avviaXyz(nome, suDato, suStato = () => {}, { intervallo = 3000, scarica = fetch } = {}) {
  if (!nome) { suStato({ stato: "spento", messaggio: "Nessun account Xyz in config.json" }); return () => {}; }
  let fermato = false, attesa = null;
  async function giro() {
    if (fermato) return;
    let prossimo = intervallo;
    try {
      const r = await scarica(`${API}/…?_t=${Date.now()}`, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const dato = datoUtile(await r.json());
      if (fermato) return;
      suStato({ stato: "collegato", messaggio: "…" });
      suDato(dato);
    } catch (e) {
      suStato({ stato: "attesa", messaggio: `Xyz non risponde (${e.message}): riprovo tra 10 secondi` });
      prossimo = 10_000;
    }
    if (!fermato) attesa = setTimeout(giro, prossimo);
  }
  giro();
  return () => { fermato = true; clearTimeout(attesa); };
}
```

**Nel server** (copia `collegaNero`):
- variabile `let statoXyz = { stato: "spento", messaggio: "" }`;
- `collegaXyz()` che chiama `cambiato()` solo se stato o messaggio cambiano;
- il campo `xyz: statoXyz` in `istantanea()`;
- la configurazione in `config.esempio.json`, con la fusione `xyz: { ...base.xyz, ...tuo.xyz }` in `caricaConfig`.

**Nella logica** (`lib/stato.mjs`):
- una funzione pura `datoDaXyz(stato, dato, { ora })` che restituisce `true` se ha cambiato qualcosa;
- un «ultimo visto» (come `neroUltimo`), così il polling non ripete l'effetto ogni 3 s;
- un «in arrivo» (come `neroInArrivo`), così non sovrascrive lavoro non confermato;
- i passaggi a tempo come funzione pura chiamata dal `setInterval` da 250 ms (modello `passaSeTocca`).

Campi nuovi: `statoIniziale`, fusione in `caricaStato`, elenchi di `demo`/`nuovaSerata`.

**Nella regia**: un bollino come `#nero-stato` (`{ collegato, attesa, spento }[s.xyz.stato]`, classe `conn ok`/`conn attesa`, `title` = messaggio) e un interruttore «automatico» come `neroAutomatico`.

**Eventi in diretta (modello `avviaTikTok`)**: riconnessione con `riprova(secondi, messaggio)`, controllo `connessione === c`, ascoltatore `error` lasciato sulle connessioni chiuse. Prima di scrivere il parser registra la forma reale del dato da una live vera e mettila ridotta nel test, come in `commentoTikTok`.

**Webhook (modello Nero)**: porta propria su `127.0.0.1`, un solo percorso, `leggiCorpo` con limite, firma sul corpo grezzo **prima** di `JSON.parse`, risposta 200 subito, id stabile per scartare i doppioni.

**Test** (`test/integrazioni.test.mjs`, `node --test`):

```js
const codaVera = { /* forma reale osservata (data), ridotta ai campi che servono */ };
test("Xyz: legge il dato", async () => {
  const chiesti = [];
  const scarica = async (url) => { chiesti.push(url.replace(/\?_t=\d+$/, "")); return { ok: true, json: async () => codaVera }; };
  const stati = [];
  const dato = await new Promise((risolvi) => {
    const ferma = avviaXyz("backrooms", (d) => (ferma(), risolvi(d)), (s) => stati.push(s.stato), { scarica, intervallo: 10 });
  });
  assert.deepEqual(chiesti, ["https://api.xyz.example/…"]);
  assert.deepEqual(stati, ["collegato"]);
});
```
Più un test della funzione pura (`datoUtile`, con `null` e campi mancanti) e uno della logica di stato con l'ora passata a mano (come i test «traccia da Nero» di `test/stato.test.mjs`). Poi un finto server in `strumenti/` sul modello di `nero-finto.mjs`: stesse risposte ridotte, più `/cambia` e `/spegni`. Prova completa come in §1.6.

## 5. Trappole

- Nel cloud `api.nero.fan` (403 dal proxy) ed Euler Stream sono bloccati: niente prove reali da qui. Dillo allo studio e fagli provare sul PC della diretta: sessione Nero avviata, chat che conta i voti, webhook con *Send test event*.
- Nero non avviato su nero.fan = niente traccia automatica. È la prima cosa da controllare quando il tabellone non cambia.
- Le submission gratuite non generano webhook: solo polling (traccia in onda) o *Metti in coda*.
- Firma del webhook: calcolala sui byte ricevuti. Rileggere e riserializzare il JSON cambia la firma.
- `nero.username` si cambia solo in `config.json`; l'account TikTok anche dalla regia.
- Più overlay insieme: ognuno fa il suo polling di Nero e apre la sua connessione alla chat, quindi ognuno riceve la stessa traccia e gli stessi commenti. Se serve, spegni Nero (`"username": ""`) o la chat (`"tiktok": ""`) in quelli che non li usano. Webhook su porte diverse, oppure `"portaWebhook": 0`.
