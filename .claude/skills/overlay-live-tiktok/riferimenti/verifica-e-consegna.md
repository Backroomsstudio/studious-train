# Verifica e consegna

Come controllare un overlay prima di darlo allo studio, rigenerare mockup e documenti, fare lo ZIP e spiegare cosa provare sul PC della diretta. Tutti i comandi sono stati provati su `overlay-live` (ottobre 2026). Per misure e coordinate vedi `posizioni-e-leggibilita.md`, per Nero e chat `integrazioni.md`, per i suoni `suoni.md`.

Ordine di lavoro: mockup, prima/dopo e documenti (§2–4) → checklist §1, punti 1–13 → commit e push (§5) → ZIP e prova da zero (§6) → consegna (§7).

## 0. Ambiente di prova

Lavora su una **copia della cartella** (contiene anche le modifiche non ancora committate), con porte proprie: 4747/4748 possono essere occupate da altri overlay o da altre sessioni.

```bash
R=/home/user/studious-train
S=$R/.claude/skills/overlay-live-tiktok/strumenti
SP=<scratchpad della sessione>
C=overlay-live                       # cartella dell'overlay da verificare
P=$SP/prova-$C; B=http://127.0.0.1:4797
lsof -ti tcp:4797 -sTCP:LISTEN; lsof -ti tcp:4999 -sTCP:LISTEN   # nessuna riga = porte libere
rm -rf $P && mkdir -p $P
tar -C $R/$C --exclude=node_modules --exclude=dati --exclude=config.json -cf - . | tar -C $P -xf -
ln -sfn $R/$C/node_modules $P/node_modules        # prima: npm install in $R/$C
cd $P && node -e 'const f=require("fs"),c=JSON.parse(f.readFileSync("config.esempio.json"));c.porta=4797;c.nero.portaWebhook=4798;c.nero.segreto="prova";c.tiktok="";f.writeFileSync("config.json",JSON.stringify(c,null,2))'
```

- Porte occupate (altri agenti, i verificatori del workflow o altre sessioni)? Il nuovo server fallirebbe con `EADDRINUSE` e `scatta.mjs` manderebbe i comandi, anche `demo`, al server di un altro, senza errori visibili. Scegli un'altra terna: 4900/4901 con Nero finto su 4990 (poi 4910/4911 e 4991…), in `config.json`, `NERO_API` e `B`. Non mandare mai `demo` a una porta che non hai avviato tu.
- Il link simbolico a `node_modules` va solo nella copia di prova nello scratchpad. In una cartella del repo usa `npm install`: con `node_modules/` nel `.gitignore` il link non è ignorato e finirebbe nel commit.
- Avvia i server con `run_in_background: true` del Bash: `node $S/nero-finto.mjs 4999 backrooms` e `cd $P && NERO_API=http://127.0.0.1:4999 node server.mjs > $P/server.log 2>&1`.
- Aspetta con un ciclo di `curl -s $B/api/stato` oppure con un `sleep` di pochi secondi; per attese lunghe usa `run_in_background`.
- Lascia `pinRegia` vuoto: `scatta.mjs` e `_browser.mjs` mandano i comandi senza header `x-pin`.
- `c.tiktok=""` evita che il server provi a collegarsi a TikTok (nel cloud fallisce comunque).
- Dopo ogni modifica al progetto rifai la copia e riavvia il server.
- Fermali per porta: `kill $(lsof -ti tcp:4797 -sTCP:LISTEN) $(lsof -ti tcp:4999 -sTCP:LISTEN)`.

## 1. Checklist prima della consegna

Fai tutto, nell'ordine. Ogni riga ha il controllo che deve passare.

| # | Cosa | Come | Passa se |
|---|---|---|---|
| 1 | Test | `cd $R/$C && npm test` (`node --test` trova `test/*.test.mjs`) | 0 fail (overlay-live: 25 test in 3 file) |
| 2 | Screenshot statico | sezione 2, poi apri ogni JPG con Read | dati giusti, niente vuoti, niente errori `ERRORE nella pagina` nell'output |
| 3 | Prima/dopo | sezione 3 | i riquadri cadono dove li ha messi lo studio |
| 4 | Testi lunghi | `node $S/misura-testo.mjs "$B/overlay.html?anteprima=1&statico=1" "#premio-invito" "frase 1" "frase 2"` | nessun `⚠ TAGLIATO`, oppure c'è `adattaTesto` e il corpo finale (≈ corpo × disponibili / serve) resta ≥ 22 px |
| 5 | Guide del telefono | `zone-telefono.jpg` (sezione 2) | niente nelle bande rosse (x < 104 o > 976) né nelle zone gialle (y < ~270, y > ~1770); margine x 116…964 |
| 6 | Suoni | `node $S/suoni.mjs "$B/overlay?muto=1" livelli` | nessun ⚠ (picco ≥ 1 o < 0,02), salvo `chatVoto` (pan casuale: picco 0,015–0,04, voluto) |
| 7 | MP3 per lo studio | `suoni.mjs … wav` + `ffmpeg` (comandi in `suoni.md` §9) | `max_volume` sotto 0 dB; ascolto nell'ordine giusto |
| 8 | Finto Nero end-to-end (solo se il formato usa Nero) | `integrazioni.md` §1.6: `/cambia` → tabellone; voto → `/cambia` → `neroInArrivo` → `conferma` → dopo `nero.attesaDopoConfermaSecondi` (10 s) passa | provato su overlay-live: a 5 s ancora la vecchia, a 11 s la nuova |
| 8bis | Giro del formato via API | uno script `curl` fa un giro intero e legge `/api/stato` dopo ogni passo. overlay-live: `traccia` → tre `voto` → `apriChat` → `messaggioChat` con `8`, `7,5`, `ciao` e un doppio voto dello stesso utente → `conferma` → `proclama`. Battle: nuovo round → punti dei giudici → `apriChat` → `messaggioChat` con `1`, `2`, `!1`, `ciao` e un doppio voto → conferma → secondo round con un concorrente già visto → `proclama` | conteggi, totale o vincitore del round e classifica (aggregata, nella battle) sono quelli attesi; `ciao` non conta; il doppio voto vale una volta |
| 9 | Webhook firmato (solo se il formato usa Nero) | `curl` con firma `openssl` (`integrazioni.md` §1.6) | 200 e voce in coda; firma sbagliata 401 |
| 10 | Aggiornamento | togli da `$P/dati/stato.json` un campo nuovo (es. `suoni`, `visibili.premio`) e metti un invito di `INVITI_SUPERATI`, riavvia, leggi `/api/stato`. Overlay nuovo: togli `visibili.<widget>` e `suoni`; `INVITI_SUPERATI` c'è solo se hai cambiato un testo predefinito | campi ripristinati da `caricaStato`, invito nuovo, classifica intatta |
| 11 | Compatibilità | `grep -rn "color-mix" $R/$C/public` · `curl -s -o /dev/null -w "%{http_code}\n" $B/overlay.html` | solo commenti · 200 |
| 12 | Porta nei testi | `grep -rn "4747" $R/$C --exclude-dir=node_modules --include=*.html --include=*.js --include=*.md` | se l'overlay usa un'altra porta, nessun 4747 rimasto (anche nella nota Stream Deck di `regia.html`) |
| 13 | GUIDA | script `guida-controllo.mjs` (sezione 4) | nessuna immagine rotta, nessun `#ancora` mancante, numeri `.zona` = zone del mockup della regia |
| 14 | ZIP da zero | sezione 6 | `npm install`, `npm test` e avvio funzionano nella cartella estratta |

## 2. Rigenerare i mockup

`scatta.mjs <url> <out> [larghezza] [altezza] [attesaMs] [comando ...]`: carica, aspetta 1,5 s, manda i comandi (150 ms l'uno dall'altro), aspetta `attesaMs`, scatta. Con l'estensione `.jpg` salva in JPEG. Per `/regia` scatta la pagina intera. Il comando `demo` sostituisce la serata (tiene premio, frasi, suoni, giudici, account TikTok e impostazioni Nero): mai sul PC della diretta.

I comandi qui sotto sono di overlay-live (voti per categoria, spareggio a 8,4 come «Specchi Neri»). Per un overlay nuovo:
- riscrivi `demo` perché riempia OGNI riquadro (per una battle: round in corso con chat al 60/40, 5 concorrenti, un pari merito facile da creare) e `simulaChat` con i parametri del formato. Servono ai mockup;
- scatti obbligatori: `verticale`, il momento dopo la conferma (attesa 2000–6000), `ultimi-minuti`, `zone-telefono`, `vincitore`, `spareggio`, `regia`. `orizzontale` solo se lo studio lo ha chiesto.

```bash
M=$R/$C/mockup; U="$B/overlay.html?anteprima=1&statico=1"
node $S/scatta.mjs "$U" $M/verticale.jpg 1080 1920 2500 'premio={"testo":"Sessione + Beat"}' demo
# timer rosso (< 30 min) + nuovo primo posto con notifica oro e corona
node $S/scatta.mjs "$U" $M/ultimi-minuti.jpg 1080 1920 2500 demo 'countdown={"azione":"avvia","minuti":12}' \
  'voto={"categoria":"beat","valore":10}' 'voto={"categoria":"voce","valore":9.5}' 'voto={"categoria":"mix","valore":10}' conferma
node $S/scatta.mjs "$U&guide=1" $M/zone-telefono.jpg 1080 1920 2500 demo
node $S/scatta.mjs "$U&formato=orizzontale" $M/orizzontale.jpg 1920 1080 2500 demo
node $S/scatta.mjs "$U" $M/vincitore.jpg 1080 1920 2500 demo proclama
# pari merito in testa: la traccia demo a 8,4 come «Specchi Neri», senza chat
node $S/scatta.mjs "$U" $M/spareggio.jpg 1080 1920 2500 demo chiudiChat azzeraChat \
  'voto={"categoria":"beat","valore":8.4}' 'voto={"categoria":"voce","valore":8.4}' 'voto={"categoria":"mix","valore":8.4}' conferma proclama
```

Controlla ogni immagine con Read:
- **Notifica** dopo `conferma`: compare dopo `RITARDO_CLASSIFICA_MS` (1,7 s, `eventi-sonori.js`) e resta `DURATA_NOTIFICA_MS` (6 s, `overlay.js`). Tieni `attesaMs` tra 2000 e 6000.
- **Frase sotto il premio**: cambia ogni `CAMBIO_INVITO_MS` (6 s dal caricamento) e per 450 ms è vuota (classe `cambia`). Se lo scatto cade lì, la frase manca (successo con attesa 3000 e 7 comandi). Rifallo con un'attesa diversa.
- Il timer deve essere rosso (`.urgente`, soglia `SOGLIA_URGENTE_MS` = 30 min), il primo con corona e casella oro, secondo e terzo argento e bronzo.
- Per i mockup non chiamare `/cambia` del Nero finto: una traccia nuova aspetterebbe in `neroInArrivo` e la regia mostrerebbe «Su Nero ora suona…».

### Regia con le zone numerate in giallo

`GUIDA.html` rimanda a `mockup/regia.jpg` con cerchietti gialli (#ffc400, lo stesso giallo della classe `.zona` della guida). Salva nello scratchpad come `regia-zone.mjs` e adatta `ZONE` alla regia del nuovo overlay (questa è quella di overlay-live, 1–11):

```js
// node regia-zone.mjs <base> <out.jpg>
import { apriBrowser, comando } from "/home/user/studious-train/.claude/skills/overlay-live-tiktok/strumenti/_browser.mjs";
const [base, out] = process.argv.slice(2);
// selettore CSS, oppure "h2:Testo" / "h3:Testo" = titolo visibile che inizia con Testo
const ZONE = [[1, "#nero-stato"], [2, "h2:In ascolto"], [3, "h3:Coda"], [4, "h2:Voti"], [5, "h3:Voto chat"],
  [6, ".conferma .etichetta"], [7, "h2:Classifica"], [8, "h2:Countdown"], [9, "h2:In onda"], [10, "h2:Suoni"], [11, "h2:Serata"]];
const browser = await apriBrowser();
const pagina = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pagina.goto(`${base}/regia`);
await pagina.waitForTimeout(1500);
console.log(await comando(base, "demo"));
await pagina.waitForTimeout(2000);
const mancanti = await pagina.evaluate((zone) => {
  const trova = (s) => { const m = s.match(/^(h[23]):(.+)$/);
    return m ? [...document.querySelectorAll(m[1])].find((e) => e.offsetParent && e.textContent.trim().startsWith(m[2])) : document.querySelector(s); };
  const no = [];
  for (const [n, s] of zone) {
    const el = trova(s); if (!el) { no.push(s); continue; }
    const c = Object.assign(document.createElement("span"), { textContent: n });
    c.style.cssText = "display:inline-grid;place-items:center;width:34px;height:34px;margin-left:12px;border-radius:50%;background:#ffc400;color:#000;" +
      "font:800 19px/1 'Barlow Condensed',sans-serif;letter-spacing:0;text-transform:none;vertical-align:middle;box-shadow:0 0 0 3px rgba(0,0,0,.6)";
    s.startsWith("#") ? el.after(c) : el.append(c);   // accanto alle etichette di stato, dentro i titoli
  }
  return no;
}, ZONE);
if (mancanti.length) console.log("zone non trovate:", mancanti.join(", "));
await pagina.screenshot({ path: out, fullPage: true });
await browser.close();
```

Prima rimetti l'account TikTok, tolto in §0: `curl -s -X POST $B/api/tiktok -H "Content-Type: application/json" -d '{"utente":"@backrooms.studios"}'`. Senza, la regia mostra «TikTok non collegato» in rosso e la casella dell'account vuota. Poi `node $SP/regia-zone.mjs $B $R/$C/mockup/regia.jpg` → 1440 × ~1600. Nel cloud le etichette in alto dicono «TikTok in attesa» e «Nero in attesa»: va bene, la GUIDA le spiega come normali prima della live. Poi aggiorna la legenda `ul.legenda` in GUIDA e gli attributi `width`/`height` dell'immagine.

## 3. Prima/dopo sullo screenshot dello studio

È il controllo che convince di più lo studio. Serve l'overlay **trasparente** (PNG, senza `?anteprima`) alla scala dell'anteprima di LIVE Studio. Le misure della cornice sono in `posizioni-e-leggibilita.md` §2.

```bash
node $S/scatta.mjs "$B/overlay.html?statico=1" $SP/ov.png 1080 1920 2500 demo
python3 -I $S/composito.py screenshot-studio.jpg $SP/ov.png $SP/composito.jpg <bordo_sx> <bordo_alto> <larghezza_cornice> <altezza_cornice>
# stampa k e la zona visibile (con la cornice 720x1585: k=0.8255, x 104…976)
python3 -I -c "
import sys; from PIL import Image
a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')
c = Image.new('RGB', (a.width + b.width + 40, max(a.height, b.height))); c.paste(a, (0, 0)); c.paste(b, (a.width + 40, 0))
c.save(sys.argv[3], quality=88)" screenshot-studio.jpg $SP/composito.jpg $SP/prima-dopo.jpg
```

Senza `?guide=1` nell'immagine per lo studio. Quello che sporge dalla cornice sopra l'interfaccia di LIVE Studio è la parte tagliata sui telefoni: se c'è un riquadro, va spostato.

## 4. README e GUIDA.html

**README.md** (per tecnici e per il prossimo Claude: tabelle, niente spiegoni). Ordine di overlay-live: cosa fa in un paragrafo · schema ASCII dei flussi (Nero, chat, regia → server → overlay) · link a `mockup/` e a `GUIDA.html` · Avvio · TikTok LIVE Studio (URL con `.html` e perché) · tabella Posizioni (x, y, L × A) · Effetti sonori · Regia (tasti, flusso tipico) · `config.json` campo per campo · Nero.fan · API (comando → corpo JSON) · Struttura dei file · Test. Ogni comando nuovo va nella tabella API, ogni posizione cambiata nella tabella Posizioni.

**GUIDA.html** (per lo studio, sul PC Windows della diretta). Un solo file con CSS e JS in linea: si apre con doppio clic, anche senza internet (i font di Google ripiegano su quelli di sistema). Le immagini sono relative (`mockup/…`), quindi la guida va nella radice della cartella. Sezioni di overlay-live, da tenere nei prossimi:

1. **In breve**: 4 schede (Avvio, Tasti, indirizzo della regia, indirizzo della sorgente Link) + giudici e account.
2. **Prima volta sul PC fisso** (sottopassi numerati): ZIP in Documenti con «Annulla blocco» · Node.js (≥ 22, `engines` in `package.json`; la guida di overlay-live usa l'installer `.msi` di nodejs.org, il README `winget install OpenJS.NodeJS.LTS`. Nei prossimi: blocco `.copia` con `winget install OpenJS.NodeJS.LTS`, in alternativa il `.msi`; poi `node -v`) · primo avvio con `AVVIA.cmd` e il testo esatto che deve comparire nella finestra nera (`pre.finestra`) · regia e «Carica dati demo» · sorgente in LIVE Studio con `verticale.jpg` e `zone-telefono.jpg` · «Nuova serata».
3. **Prima di ogni live** · 4. **Il giro di ogni traccia** (figura `regia.jpg` + legenda 1–11 + passi che citano le zone) · 5. **Fine gara e vincitore** · 6. **Effetti sonori** · 7. **Dopo la live** · 8–9. parti **facoltative** (coda Nero con ngrok, regia da tablet) · 10. **Se qualcosa non va** (`dl.problemi`: sintomo come lo vede lo studio → cosa fare) · 11. **Chiedere aiuto a Claude sul PC fisso** con la frase da copiare.

Componenti: `ol.passi` (passi numerati), `.zona` (cerchietto giallo con il numero della zona), `kbd` (F2, F4, F8, F9), `.etichetta-ui verde/arancio/rosso` (come le etichette della regia), `.copia` (codice + pulsante «Copia»), `.riquadro.attenzione` («Nuova serata cancella la classifica»), `.riquadro.da-provare` con tag **«Da controllare la prima volta»**. In overlay-live sono tre: sfondo trasparente in LIVE Studio, audio della sorgente Link in diretta, webhook Nero con *Send test event*. Nei prossimi aggiungi anche i commenti dei telefoni in basso a sinistra, che l'anteprima non mostra. `color-mix()` qui va bene (si apre in Chrome/Edge), nell'overlay no. Aggiorna la data nel `.piede`.

Tono: seconda persona singolare, imperativo, frasi brevi. Nomi dei pulsanti in grassetto, esattamente come nella regia. Parole dello studio («finestra nera», «doppio clic», «PC fisso»), non «server», «porta» o «WebSocket». Di ogni passo scrivi cosa devono vedere e quali messaggi sono normali («La riga su Nero.fan è normale finché…»). Indirizzi e testi da incollare sempre in un blocco `.copia`.

Controllo automatico (salva in `$SP/guida-controllo.mjs`; le immagini hanno `loading="lazy"`, per questo le forza):

```js
import { apriBrowser } from "/home/user/studious-train/.claude/skills/overlay-live-tiktok/strumenti/_browser.mjs";
import { resolve } from "node:path";
const b = await apriBrowser(), p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto("file://" + resolve(process.argv[2]));
await p.evaluate(() => document.querySelectorAll("img").forEach((i) => (i.loading = "eager")));
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => ({
  rotte: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute("src")),
  ancore: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.querySelector(h)),
  zone: [...new Set([...document.querySelectorAll(".zona")].map((z) => z.textContent))].sort((a, b) => a - b).join(","),
})));
await b.close();
```

`node $SP/guida-controllo.mjs $R/$C/GUIDA.html` → `{ rotte: [], ancore: [], zone: '…' }`.

## 5. Git

- Commit solo dopo la checklist (§1, punti 1–13). Oggetto in italiano, dal punto di vista dello studio: `Overlay live: la traccia di Nero passa da sola anche dopo il voto`. Per un overlay nuovo usa il suo nome al posto di «Overlay live». Poi una riga vuota ed elenco puntato di cosa cambia (righe di ~85 caratteri).
- Oggetto e corpo senza nomi o ID di modello. In coda metti solo le righe di attribuzione che la sessione chiede (nei commit di overlay-live: `Co-Authored-By` e `Claude-Session`), nient'altro.
- Prima del commit, `git status --short`: non devono comparire `node_modules/`, `config.json`, `dati/` (ignorati dal `.gitignore` della cartella: copialo nel nuovo overlay) né `.claude/launch.json` (locale, ha il percorso Windows del PC dello studio; escluso in `.git/info/exclude`).
- Si versionano i mockup (`mockup/*.jpg`: li usa la GUIDA e finiscono nello ZIP). Prima/dopo, MP3 e ZIP restano nello scratchpad.
- Se hai cambiato la skill (`SKILL.md`, `riferimenti/`, `strumenti/`, `.claude/workflows/`), committala insieme all'overlay: `git status --short .claude/` non deve mostrare righe `??`.
- Netlify compila il sito (`netlify.toml`: `npm run build`). Nel repo alcuni commit finiscono con `[skip netlify]` («Pulizia file in radice [skip netlify]»); quelli di overlay-live no. Se il commit tocca solo la cartella dell'overlay o `.claude/`, chiedi una volta allo studio se aggiungere `[skip netlify]` in coda all'oggetto (il sito non cambia), poi scrivi qui la risposta.
- Push sul ramo della sessione: `git push -u origin <ramo>`.

## 6. ZIP e prova da zero

`pacchetto.py` usa `git archive HEAD`: **prima committa**, altrimenti le modifiche non entrano. Si lancia dalla radice del repo. Lo ZIP contiene la cartella (`overlay-live/…`), quindi estratto in Documenti dà `Documenti\overlay-live`, come dice la GUIDA.

```bash
cd $R && python3 -I $S/pacchetto.py $C $SP/$C.zip       # overlay-live: 1355 KB, 32 file
python3 -I -c "
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1]); n = z.namelist()
print('vietati:', [x for x in n if 'node_modules/' in x or x.endswith('/config.json') or '/dati/' in x] or 'nessuno')
print('AVVIA.cmd CRLF:', b'\r\n' in z.read(sys.argv[2] + '/AVVIA.cmd'))" $SP/$C.zip $C
Z=$SP/zip-da-zero; rm -rf $Z && mkdir -p $Z && cd $Z && unzip -q $SP/$C.zip
cd $Z/$C && npm install --omit=dev --no-fund --no-audit && npm test   # stesso install di AVVIA.cmd
```

Poi scrivi un `config.json` con le porte di prova (come in §0), avvia `node server.mjs` in background e controlla `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4797/overlay.html` (200) e `/api/stato`. Al primo avvio senza `config.json` il server lo crea da `config.esempio.json` («Creato config.json dal modello.»).

## 7. Cosa mandare allo studio

**Come aggiornano il PC fisso: da chiarire.** `.claude/launch.json` (locale) avvia `C:/Users/plugghe/Documents/backrooms-sito/overlay-live/server.mjs`: sul PC fisso c'è il repo intero. GUIDA e consegna invece dicono «ZIP estratto in Documenti». Due copie vogliono dire due `dati/stato.json`. Chiedi una volta se aggiornano con `git pull` nel repo `backrooms-sito` o con lo ZIP, poi scrivi qui la risposta. Con il repo, dopo il push bastano `git pull` e `AVVIA.cmd` nella cartella nuova; lo ZIP serve solo come copia. Nel messaggio scrivi l'indirizzo esatto della sorgente Link con la porta nuova (es. `http://127.0.0.1:4757/overlay.html`), da mettere in una scena diversa da quella di overlay-live.

Con `SendUserFile` (`status: "normal"` se rispondi a una loro richiesta, `"proactive"` se lo mandi di tua iniziativa), un file per volta o a gruppi, ognuno con una didascalia di una riga:

1. `prima-dopo.jpg`: «a sinistra la vostra anteprima, a destra con l'overlay nuovo».
2. I mockup (`verticale`, `ultimi-minuti`, `vincitore`, `spareggio`, `regia`).
3. `suoni.mp3` con l'ordine dei suoni in secondi («0 s nuova traccia, 2,5 s voti dei giudici, …»).
4. `<cartella>.zip` (`display: "attach"`): «estraetelo in Documenti e aprite GUIDA.html: c'è tutto, passo passo».

Poi un messaggio in italiano semplice, senza parole tecniche. Cosa provare sul PC della diretta, perché da qui non si può:
- **Sfondo trasparente** in LIVE Studio: si vede la camera sotto i riquadri.
- **Suoni in diretta**: in regia *Prova → Primo posto* e ascoltate da un telefono collegato alla live. Se non si sente: *Suoni* → «in questa pagina» e in LIVE Studio l'audio del PC.
- **Commenti**: sui telefoni i commenti escono in basso a sinistra e l'anteprima non li mostra. Guardate la live da un telefono e diteci se coprono il tabellone.
- **Nero.fan** (solo se il formato lo usa): avviate la sessione live su nero.fan prima della diretta, altrimenti la regia scrive «Nessuna sessione live».
- **Chat TikTok**: entro un minuto dall'inizio della live, in alto nella regia deve comparire «TikTok in ascolto».

Chiudi chiedendo uno screenshot dell'anteprima se qualcosa è tagliato o coperto.

## 8. Trappole

- **pkill**: `pkill -f 'node server.mjs'` uccide anche la shell che lo lancia (la sua riga di comando contiene la stessa stringa). `pkill -f '^node server\.mjs'` ferma tutti gli overlay della macchina, anche quelli di altre sessioni. Ferma per porta con `lsof` (§0).
- **Rete del cloud**: `api.nero.fan` è bloccato (`CONNECT tunnel failed, response 403`; in regia «Nero.fan non risponde (HTTP 403)»). La chat TikTok (`tiktok-live-connector`, firma tramite `api.eulerstream.com`, bloccata) non si collega: nel log compare `Failed to retrieve Room ID from all sources` e in regia «Nessuna live trovata per @…: controlla il nome dell'account». Qui non vuol dire che il nome sia sbagliato. Prova Nero con `nero-finto.mjs`, la chat con i comandi `messaggioChat` e `simulaChat`.
- **Nero finto**: la sessione si rilegge ogni 60 s (`avviaNero` in `lib/nero.mjs`), quindi dopo `/spegni` «Nessuna sessione live» arriva entro un minuto.
- **AVVIA.cmd**: nel repo ha gli a-capo LF. Solo `pacchetto.py` lo porta in CRLF: non fare lo ZIP a mano e non mandare la cartella copiata dal repo.
- **ZIP vecchio**: `git archive HEAD` ignora le modifiche non committate. Se cambi qualcosa dopo, committa e rifai lo ZIP.
- **Trasparenza**: per il composito serve il PNG senza `?anteprima` (`scatta.mjs` usa `omitBackground`; verificato: pixel vuoti con alfa 0). Il JPEG non ha trasparenza e con `?anteprima` lo sfondo è scuro: vanno bene solo per i mockup.
- **`demo` e `Nuova serata`**: cancellano la classifica. Nei documenti per lo studio, «Carica dati demo» va sempre seguito da «Nuova serata» prima della live.
- **Mockup e premio**: `demo` tiene il premio della serata (all'inizio `premio` di `config.json`). Impostane uno realistico con `premio={"testo":…}` nel primo scatto: resta per tutti gli scatti successivi.
- **Immagini lazy**: in un controllo automatico della GUIDA, le immagini fuori schermo risultano «rotte» se non le forzi a caricarsi (§4).
