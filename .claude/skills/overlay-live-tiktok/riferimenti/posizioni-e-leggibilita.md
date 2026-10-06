# Posizioni e leggibilità

Dallo screenshot dell'anteprima di TikTok LIVE Studio alle coordinate sulla tela 1080×1920, e scritte leggibili da telefono.
Modello: `overlay-live/` (i percorsi sotto sono relativi a quella cartella). Strumenti: `.claude/skills/overlay-live-tiktok/strumenti/`.

## Valori di partenza (diretta verticale, misurati a ottobre 2026)

| Cosa | Valore |
|---|---|
| Tela | 1080×1920, UNA sola sorgente **Link** stesa su tutta la tela, sfondo trasparente |
| Visibile sui telefoni | x 104…976 (i lati della tela vengono tagliati) |
| Coperto dall'app in alto | y 0…~270 (nome della live, spettatori, "Classifica giornaliera") |
| Coperto dall'app in basso | da y ~1768 (pulsanti) |
| Zona sicura (12 px di margine) | x 116…964, y 282…1756 |
| Commenti | sui telefoni in basso a sinistra; l'anteprima NON li mostra → avvisa lo studio che possono coprire tabellone e barra chat |
| Spazio tra riquadri | 12–16 px |

## 1. Cosa chiedere allo studio

- Uno screenshot intero dell'anteprima di LIVE Studio (la cornice a forma di telefono), con i riquadri dove li vogliono: l'overlay vecchio spostato a mano o rettangoli disegnati sopra.
- Le loro richieste valgono anche come stile: scritte molto grandi, primi tre su caselle oro/argento/bronzo, premio enorme in alto, tutto in un solo overlay.

## 2. Metodo passo passo

### 2.1 Misura la cornice

Servono 4 numeri, in pixel dello screenshot: `bordo_sx`, `bordo_alto`, `larghezza_cornice`, `altezza_cornice`.
Guarda lo screenshot ingrandito (angoli arrotondati, bordo chiaro) oppure cerca i salti di luminosità lungo una riga e una colonna che passano su zone vuote (ogni pannello aggiunge altri salti):

```python
# python3 -I cornice.py screenshot.png [y_riga] [x_colonna]   (scrivilo nello scratchpad)
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("L"); W, H = im.size
y = int(sys.argv[2]) if len(sys.argv) > 2 else H // 2
x = int(sys.argv[3]) if len(sys.argv) > 3 else W // 2
salti = lambda v: [i for i in range(1, len(v)) if abs(v[i] - v[i - 1]) > 25]
print("riga y=%d:" % y, salti([im.getpixel((i, y)) for i in range(W)]))
print("colonna x=%d:" % x, salti([im.getpixel((x, j)) for j in range(H)]))
```

Primo e ultimo salto di ogni elenco = i bordi. Prova su un'immagine finta con cornice 720×1585 in (300, 60): riga `[300, 302, 1018, 1020]`, colonna `[60, 62, 1643, 1645]` → larghezza 1020−300 = 720, altezza 1645−60 = 1585.

### 2.2 Controlla la forma

Calcola `larghezza_cornice / altezza_cornice`. A ottobre 2026: 720×1585 → 0,454 (≈ 9:19,8), più stretto di 9:16 (0,5625).
Quindi la tela riempie la cornice **in altezza** e i lati escono, tagliati al centro.

### 2.3 Ritaglio o stiramento? Verificalo

Prendi un riquadro di cui conosci la misura sulla tela (un pannello dell'overlay vecchio visibile nello screenshot) e confronta il rapporto larghezza/altezza:

- **ritaglio** (scala uniforme): L/A nello screenshot = L/A sulla tela, entro ±4%. È il caso verificato con lo studio.
- **stiramento**: L/A nello screenshot ≈ 0,81 × quello sulla tela (in x 720/1080 = 0,667, in y 0,8255). In quel caso la formula sotto non vale: x_tela = (px − bordo_sx) × 1080 / larghezza_cornice.

### 2.4 Formula

```
k      = altezza_cornice / 1920                  # 1585 → 0,8255
taglio = (1080 − larghezza_cornice / k) / 2      # 720  → 104
x_tela = taglio + (px − bordo_sx) / k
y_tela = (py − bordo_alto) / k
visibile: x da taglio a 1080 − taglio            # 104…976
```

Se la cornice fosse 9:16, `taglio` viene 0 da solo. Per convertire i riquadri indicati dallo studio:

```python
bordo_sx, bordo_alto, w_cornice, h_cornice = 300, 60, 720, 1585  # i tuoi numeri
k = h_cornice / 1920
taglio = (1080 - w_cornice / k) / 2
def tela(px, py):
    return round(taglio + (px - bordo_sx) / k), round((py - bordo_alto) / k)
def riquadro(x1, y1, x2, y2):  # angolo in alto a sinistra e in basso a destra, px dello screenshot
    (a, b), (c, d) = tela(x1, y1), tela(x2, y2)
    return {"x": a, "y": b, "largo": c - a, "alto": d - b}
print(f"k={k:.4f}  rapporto={w_cornice / h_cornice:.3f}  visibile x {taglio:.0f}…{1080 - taglio:.0f}")
print(riquadro(310, 293, 1010, 422))  # → {'x': 116, 'y': 282, 'largo': 848, 'alto': 157}
```

### 2.5 Zone coperte dall'app

Converti con `y_tela` il punto dove finiscono le scritte dell'app in alto e dove iniziano i pulsanti in basso. Se escono valori diversi da 270/1768 (o un taglio diverso da 104), aggiorna in `public/css/overlay.css`:
il commento in cima, `.guida-taglio { width }`, `.guida-ui { left; right }`, `.guida-ui.alto { height }`, `.guida-ui.basso { top }`, e `.vin-contenuto { width: 820px }` (il vincitore deve stare nella larghezza visibile).

### 2.6 Margini e arrotondamenti

- 12 px dentro la zona visibile: x 116…964, cioè 848 px di larghezza piena.
- Primo riquadro 12 px sotto la zona dell'app: y 282. Ultimo riquadro sopra y 1756.
- Due colonne: 432 + 16 + 400 = 848 (classifica a sinistra, timer e notifiche a destra).
- Allinea i bordi: i riquadri a tutta larghezza usano tutti `--x` e `--largo`.
- Arrotonda a interi (meglio pari). Lo studio vuole i riquadri "dove li ha messi", non al pixel: correggi solo per allineare.

### 2.7 Scrivi i numeri nel blocco di variabili

Tutte le posizioni verticali stanno nel blocco in cima a `public/css/overlay.css`; ogni riquadro le usa così: `.verticale .premio { left: var(--x); top: var(--y-premio); width: var(--largo); height: var(--h-premio); }`. Per spostare un riquadro si cambia solo il blocco:

```css
.verticale .palco {
  --larghezza: 1080px;
  --altezza: 1920px;
  --x: 116px;               /* bordo sinistro di premio, classifica e tabellone */
  --largo: 848px;           /* 116 → 964 */
  --x-destra: 564px;        /* colonna di destra: timer e notifiche (564 → 964) */
  --largo-destra: 400px;
  --largo-classifica: 432px;
  --y-premio: 282px;   --h-premio: 156px;
  --y-colonne: 454px;  /* classifica e timer */
  --h-classifica: 392px;  --h-timer: 132px;
  --y-notifica: 604px;
  --y-tabellone: 1236px;  --h-tabellone: 282px;
  --y-chat: 1530px;       --h-chat: 78px;
}
```

### 2.8 Controlla

1. `http://127.0.0.1:4747/overlay?anteprima=1&guide=1`: bande rosse = lati tagliati (104 px per lato), bande gialle = zone dell'app (alto 0…270, basso da 1768). Nessun riquadro deve toccarle. La regia ha già il link "Anteprima overlay" con `?anteprima=1&guide=1&muto=1`.
2. Prima/dopo sullo screenshot dello studio (sezione 8): è il controllo che convince lo studio.

## 3. Posizioni attuali (esempio da overlay-live)

| Riquadro | Selettore | x | y | largo × alto | Fine |
|---|---|---|---|---|---|
| Premio in palio | `.premio` | 116 | 282 | 848 × 156 | y 438 |
| Classifica Top 5 | `.classifica` | 116 | 454 | 432 × 392 | y 846 |
| Countdown | `.timer` | 564 | 454 | 400 × 132 | y 586 |
| Notifiche | `.notifica` | 564 | 604 | 400 × min 92 | — |
| Tabellone | `.tabellone` | 116 | 1236 | 848 × 282 | y 1518 |
| Barra «Vota in chat» | `.chat-cta` | 116 | 1530 | 848 × 78 | y 1608 |
| Vincitore / spareggio | `.schermo` | tutta la tela | | contenuto largo 820 | |

Il centro (y 846…1236) resta libero: lì si vede il video della live. La stessa tabella è nel README: aggiornale insieme.

## 4. Leggibilità da telefono

Regole:

- Niente testo sotto **22 px** sulla tela 1080 (le etichette da 15 px della prima versione erano illeggibili; `.etichetta` di `base.css` è 15 px: usala solo in regia).
- Titoli ~56 px, numeri 56–98 px, peso 800–900, Barlow Condensed (`--font-dati`).
- Gotico (`--font-gotico`, Grenze Gotisch) solo da ~34 px in su; sotto, Barlow Condensed.
- Etichette in maiuscolo con `letter-spacing` ~0,12em (0,1–0,2em); numeri che cambiano con `font-variant-numeric: tabular-nums` (non ballano).
- Ombra sotto i numeri grandi (`text-shadow: 0 3px 0 rgba(0,0,0,.6), 0 0 22px …`): si leggono su qualsiasi video.
- Su oro/argento/bronzo testo scuro, mai bianco.

Corpi in uso (`public/css/overlay.css`):

| Ruolo | Corpo px | Selettore |
|---|---|---|
| Premio in palio | 76 (adattaTesto fino a 40) | `.premio-testo` |
| Totale / countdown | 98 / 88 | `.totale-valore`, `.timer-cifre` |
| Voto per categoria / punti in classifica | 56 / 36 | `.cat-valore`, `.cl-punti` |
| Titolo traccia | 56 (fino a 30) | `.tab-titolo` |
| Titolo pannello (gotico) | 46 | `.cl-titolo` |
| Artista (gotico) | 35 | `.tab-artista` |
| Barra chat: testo / numeri / tempo | 36 / 44 / 40 | `.chat-cta`, `.chat-cta b`, `.chat-timer` |
| Notifica: titolo / riga sotto | 31 / 25 | `.notifica-titolo`, `.notifica-sotto` |
| Riga classifica: titolo / artista | 27 (fino a 18) / 22 | `.cl-traccia-testo`, `.cl-artista` |
| Frase a rotazione sotto il premio | 27 (fino a 19) | `.premio-invito` |
| Etichette | 22–26 ("In palio" 24, "Top 5" 24, "In ascolto" 23, "Il vincitore si decide tra" 23, "Totale" 22, Beat/Voce/Mix/Chat 26, giudici 24, "posto libero" 22, numeri posizione 26) | vari |
| Vincitore | titolo 104 (fino a 52), artista gotico 66, punti 84, premio 56 | `.vin-*` |
| Spareggio | titolo gotico 150, voci 46, artisti gotico 34, punti 64 | `.spa-*` |
| **Sotto soglia, da alzare nei prossimi** | `.tier` 20, `.cl-badge` (NEW, ▲2) 18 | |

## 5. adattaTesto (testi lunghi senza puntini)

In `public/js/overlay.js`:

```js
function adattaTesto(el, massimo, minimo) {
  let corpo = massimo;
  el.style.fontSize = `${corpo}px`;
  while (el.scrollWidth > el.clientWidth && corpo > minimo) {
    corpo -= 2;
    el.style.fontSize = `${corpo}px`;
  }
}
```

- L'elemento deve avere larghezza limitata: `white-space: nowrap; overflow: hidden;` e, dentro flex o grid, `min-width: 0` (o colonna `minmax(0, 1fr)`). Altrimenti si allarga e non riduce niente. Lascia `text-overflow: ellipsis` come ultima difesa sotto il minimo.
- Chiamala solo quando il testo cambia (confronta `textContent`, come in `disegnaPremio`, `disegnaTabellone`, `disegnaClassifica`).
- Richiamala in `document.fonts?.ready.then(...)`: con i font di Google caricati le larghezze cambiano.
- Su un elemento nascosto con `display:none` le misure sono 0: chiamala quando è visibile (`disegnaVincitore` usa `requestAnimationFrame`).
- In uso: premio 76→40, invito 27→19, titolo tabellone 56→30, titolo in classifica 27→18, vincitore 104→52. Nei prossimi tieni il minimo a 22.
- Solo puntini (senza adattaTesto): `.cl-artista`, `.tab-artista`, `.notifica-sotto`, `.cat-giudice`, `.spa-voce .t`. Se lo studio usa nomi lunghi, aggiungila anche lì.

## 6. Misura se una frase entra

```bash
S=.claude/skills/overlay-live-tiktok/strumenti
node $S/misura-testo.mjs "http://127.0.0.1:4747/overlay.html?anteprima=1&statico=1" "#premio-invito" "Manda la tua traccia su nero.fan/backrooms"
# → serve 554px, disponibili 477px (corpo 27px)  ⚠ TAGLIATO
```

- Lo strumento sostituisce `textContent`: perde gli elementi interni (es. `<b class="link">`) e applica il maiuscolo del contenitore. Misura il caso peggiore.
- Senza ⚠ la frase entra (per un elemento che si restringe "disponibili" = "serve").
- Rimedio usato: link in minuscolo e in oro (`.premio-invito .link`, colore #ffd863, `text-transform: none`, riconosciuto da `LINK` in `scriviInvito`) + adattaTesto. Nella pagina vera la frase scende a 23 px (449 px) ed entra.
- Corpo reale dopo adattaTesto: apri la pagina con Playwright (`_browser.mjs`) e leggi `getComputedStyle(el).fontSize`. La frase a rotazione cambia ogni 6 s (`CAMBIO_INVITO_MS`).

## 7. Palette e podio (`public/css/base.css`, `:root`)

| Variabile | Valore |
|---|---|
| `--viola` / `--viola-chiaro` | #a066ff / #cdb2ff |
| `--magenta` / `--ciano` / `--verde` | #ff4fd8 / #36dcff / #45ffa8 |
| `--rosso` / `--rosso-live` | #ff2d4b / #ff3046 |
| `--podio-oro` | `linear-gradient(160deg, #fff4c2 0%, #ffd863 26%, #f2b52a 52%, #ffd863 74%, #fff0b0 100%)` |
| `--podio-argento` | `linear-gradient(160deg, #ffffff 0%, #e4e8ee 26%, #b6bdc7 52%, #e4e8ee 74%, #ffffff 100%)` |
| `--podio-bronzo` | `linear-gradient(160deg, #ffe1c4 0%, #f3ab70 26%, #d47c3c 52%, #f3ab70 74%, #ffd9b5 100%)` |
| `--oro-testo` (testo dorato con `background-clip: text`) | `linear-gradient(180deg, #fffbe6 0%, #ffe27a 30%, #f5b72a 55%, #c98a0c 70%, #ffe58f 100%)` |
| `--font-dati` / `--font-gotico` | "Barlow Condensed" / "Grenze Gotisch" (caricati da Google Fonts in `overlay.html`) |

Podio in classifica (`overlay.css`): `.cl-riga.pos-1/2/3 .cl-corpo` con fondo `--podio-*`, bordo 2 px `rgba(255,255,255,.85)`, testo #2a1700 (oro), #171a20 (argento), #2b1305 (bronzo); cerchio del numero `.cl-slot:nth-child(1..3) .cl-num` con lo stesso fondo e testo #24160a; riflesso che passa (`::after`, animazione `riflesso` 4,5 s, sfasata 0 / 0,5 / 1 s).
Corona: simbolo SVG `#corona` (in `overlay.html`, gradiente `#g-oro`), `.cl-corona` 40×31 prima del titolo, visibile solo in `.pos-1`; al nuovo primo la classe `incoronato` la fa cadere dall'alto (`corona-arriva`).

Colori delle categorie (`.cat`, tutti espliciti, niente `color-mix()`):

| Categoria | `--colore` | `--colore-fondo` | `--colore-bordo` | `--colore-nome` | `--colore-scuro` |
|---|---|---|---|---|---|
| beat (predefinito) | #a066ff | rgba(160,102,255,.24) | rgba(160,102,255,.65) | #d4bcff | #4b2a8c |
| voce | #36dcff | rgba(54,220,255,.2) | rgba(54,220,255,.6) | #a8efff | #0d5a70 |
| mix | #ff4fd8 | rgba(255,79,216,.2) | rgba(255,79,216,.6) | #ffb3ee | #7a1466 |
| chat | #45ffa8 | rgba(69,255,168,.18) | rgba(69,255,168,.6) | #b4ffd9 | #0d6a42 |

Pannelli: `.pannello` = vetro scuro (radiali viola e ciano su `rgba(26,17,48,.95)`→`rgba(8,6,16,.96)`) + bordo 2,5 px disegnato in `::before` con maschera (gradiente #fff, #a066ff, #4a2a8c, #eadcff, #36dcff). Il premio ha bordo e bagliore oro.
Timer urgente (`.timer.urgente`, ultimi 30 min = `SOGLIA_URGENTE_MS` in `eventi-sonori.js`): cifre #ff3352, fondo rosso scuro, bordo rosso, `lampeggia` 1 s; `.finale` (ultimo minuto, in `cicloTempo`) 0,5 s + `pulsa`; in pausa niente lampeggio.

## 8. Parametri URL, mockup e prima/dopo

| Parametro | Effetto |
|---|---|
| `?anteprima=1` | sfondo scuro al posto della trasparenza (per guardarlo in un browser) |
| `?statico=1` | tutto nello stato finale, senza animazioni né suoni (per i mockup) |
| `?guide=1` | bande dei lati tagliati e delle zone dell'app (solo verticale) |
| `?muto=1` | nessun suono da questa pagina |
| `?w=premio,tabellone,...` | solo i widget elencati (predefiniti: premio, tabellone, classifica, timer, vincitore) |
| `?formato=orizzontale` | tela 1920×1080 |

```bash
cd overlay-live && npm start          # in un altro terminale, porta 4747
S=../.claude/skills/overlay-live-tiktok/strumenti
SCRATCH=/percorso/dello/scratchpad   # file di lavoro fuori dal progetto
# mockup (comando "demo" = classifica e traccia finte; ATTENZIONE: sostituisce la serata, mai sul PC della diretta)
node $S/scatta.mjs "http://127.0.0.1:4747/overlay.html?anteprima=1&statico=1" mockup/verticale.jpg 1080 1920 2500 demo
node $S/scatta.mjs "http://127.0.0.1:4747/overlay.html?anteprima=1&statico=1" mockup/ultimi-minuti.jpg 1080 1920 1500 demo 'countdown={"azione":"avvia","minuti":25}'
node $S/scatta.mjs "http://127.0.0.1:4747/overlay.html?anteprima=1&statico=1&guide=1" mockup/zone-telefono.jpg 1080 1920 2500 demo
# prima/dopo: overlay TRASPARENTE (senza ?anteprima) sopra lo screenshot dello studio, alla stessa scala
node $S/scatta.mjs "http://127.0.0.1:4747/overlay.html?statico=1" $SCRATCH/ov.png 1080 1920 2500 demo
python3 $S/composito.py screenshot-studio.jpg $SCRATCH/ov.png $SCRATCH/prima-dopo.jpg <bordo_sx> <bordo_alto> <larghezza_cornice> <altezza_cornice>
# stampa: k=0.8255  tela visibile x 104…976
```

- `composito.py` incolla la tela intera: ciò che sta fuori da x 104…976 sporge dalla cornice sopra l'interfaccia di LIVE Studio. Serve a vedere cosa si perde; per l'immagine da mandare allo studio non usare `?guide=1`.
- Manda allo studio il prima/dopo (loro screenshot accanto o sotto al composito) e i mockup.

## 9. Formato orizzontale (1920×1080)

- `?formato=orizzontale`: `overlay.js` mette la classe `orizzontale` sul body; `.orizzontale .palco` ha `--larghezza: 1920px; --altezza: 1080px`. Sorgente Link 1920×1080.
- Le posizioni NON usano il blocco di variabili: sono scritte in fondo a `overlay.css` (sezione "Formato orizzontale"), con margine 48 px: timer in alto a sinistra (48, 36, 420×132), premio in alto al centro (560, 28, 800×150), classifica a destra (right 48, top 200, 520×392), notifiche sotto (right 48, top 612), tabellone in basso a sinistra (left 48, bottom 48, 900×282), barra chat sopra il tabellone (bottom 346).
- Le guide sono spente (`.orizzontale .guide { display: none }`), il vincitore è largo 1600 (`.orizzontale .vin-contenuto`), lo spareggio in riga (`.orizzontale .spa-lista`).
- Queste posizioni non vengono da uno screenshot: se lo studio va in orizzontale, chiedi lo screenshot e rifai il metodo (controlla se la tela riempie in larghezza o in altezza).
- `adattaPalco()` scala il palco con `min(innerWidth/LARGHEZZA, innerHeight/ALTEZZA)` da in alto a sinistra: una sorgente di misura diversa non deforma, ma lascia bordi vuoti. Usa sempre la misura esatta.

## 10. Trappole

- Usa `k = altezza_cornice / 1920`, non la larghezza: la larghezza è tagliata.
- Controlli con `getBoundingClientRect()`: timer spento, notifica nascosta e barra chat chiusa hanno `transform` attivo e danno posizioni spostate. Confronta con i valori del CSS.
- Niente `color-mix()` né CSS recente: il browser di OBS / LIVE Studio può essere un Chromium vecchio. Colori espliciti in variabili.
- I font arrivano da Google Fonts: senza internet si vedono Arial Narrow o il font di sistema e le larghezze cambiano (adattaTesto rimedia, la grafica no).
- Se cambi una posizione, aggiorna anche la tabella nel README e rigenera i mockup (anche `zone-telefono.jpg`).
- Nuovo overlay che gira insieme a questo: stessa tela e stesse zone, ma porta diversa in `config.json` ("porta" 4747, "nero.portaWebhook" 4748). Se si sovrappone a questo, lascia liberi i riquadri già occupati (sezione 3).
