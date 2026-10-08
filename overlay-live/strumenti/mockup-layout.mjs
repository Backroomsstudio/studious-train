// Mockup e controllo di geometria dei layout verticali con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout gara [--stato <stato>] [--guida] [--controlli]
//   layout: gara (premio, classifica, timer, tabellone con il blocco voti, barra «Vota in chat»); stato: base (la serata demo).
// Mette il server nel layout con i dati di prova, apre la pagina (1080×1920, ?anteprima=1&statico=1), controlla che ogni pezzo
// stia dove dice la tabella (±1 px, e dentro x 116…964 / y 230…1200 per i pezzi che lo dichiarano), che nessun pezzo ne copra
// un altro, e salva mockup/<nome>.jpg (la gara in stato base è mockup/verticale.jpg). Esce con codice 1 e l'elenco dei problemi.
//   --controlli: le righe di testo del layout non hanno lettere tagliate dalla loro riga (si confrontano i pixel con e senza
//   `overflow: hidden`: discendenti e accenti che sporgono sparirebbero senza che nessuna misura se ne accorga).
// Usate un server di prova su una porta libera (OVERLAY_CONFIG e OVERLAY_DATI temporanei): lo strumento ne cambia lo stato.
// Autonomo: non importa niente dagli altri strumenti (le funzioni dei pixel sono una copia di quelle di mockup-formati.mjs).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), "..");

// Un pezzo: [x, y, larghezza, altezza] in pixel della tela; `dentro` = deve stare nella zona libera dei telefoni.
const p = (x, y, w, h, dentro = false) => ({ r: [x, y, w, h], dentro });

// Una voce per pezzo. I numeri sono quelli di public/css/overlay.css (`.verticale .palco`): test/geometria.test.mjs li confronta.
export const GEOMETRIA = {
  gara: {
    verticale: {
      premio: p(116, 282, 848, 156, true),
      classifica: p(116, 454, 432, 392, true),
      timer: p(564, 454, 400, 132, true),
      tabellone: p(116, 858, 848, 260, true),
      chat: p(116, 1130, 848, 66, true), // il fondo, y 1196, sta appena sopra i commenti di TikTok (1200)
    },
  },
};

// Come si trova ogni pezzo nella pagina: un selettore proprio, altrimenti il suo data-parte.
const SELETTORI = { gara: { premio: ".premio", classifica: ".classifica", timer: ".timer", tabellone: ".tabellone", chat: ".chat-cta" } };
const PAGINE = { gara: "overlay.html" };
// Per ogni layout e stato: i pezzi che devono esserci (e non essere nascosti).
const PRESENTI = { gara: { base: Object.keys(GEOMETRIA.gara.verticale) } };
const STATO_PREDEFINITO = { gara: "base" };
// Le righe di testo che `--controlli` guarda una a una.
const RIGHE = {
  gara: [".cl-traccia-testo", ".cl-artista", ".cl-punti", "#t-titolo", "#t-artista", ".cat-nome", ".cat-giudice", ".cat-valore", ".cta-testo"],
};

// Zona libera dei telefoni: sotto l'intestazione di TikTok (230), sopra la chat (1200), tra x 116 e 964.
const X_MIN = 116;
const X_MAX = 964;
const Y_MIN = 230;
const Y_MAX = 1200;
const TOLLERANZA = 1;
const VISTA = { width: 1080, height: 1920 };

// Le coppie di pezzi che si coprono (oltre la tolleranza). Bordi che si toccano o si sfiorano non contano.
export function sovrapposizioni(tabella, tolleranza = TOLLERANZA) {
  const nomi = Object.keys(tabella);
  const trovate = [];
  for (let i = 0; i < nomi.length; i++) {
    for (let j = i + 1; j < nomi.length; j++) {
      const [ax, ay, aw, ah] = tabella[nomi[i]].r;
      const [bx, by, bw, bh] = tabella[nomi[j]].r;
      const larghezza = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
      const altezza = Math.min(ay + ah, by + bh) - Math.max(ay, by);
      if (larghezza > tolleranza && altezza > tolleranza) trovate.push(`${nomi[i]} e ${nomi[j]} si sovrappongono per ${Math.round(larghezza)} × ${Math.round(altezza)} px`);
    }
  }
  return trovate;
}

const args = process.argv.slice(2);
const opzione = (nome, predefinito) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : predefinito;
};
const base = opzione("base", "http://127.0.0.1:4747");
const layout = opzione("layout", "gara");
const stato = opzione("stato", STATO_PREDEFINITO[layout]);
const guida = args.includes("--guida");
const controlli = args.includes("--controlli");

function caricaPlaywright() {
  try {
    return createRequire(import.meta.url)("playwright");
  } catch {
    return createRequire(`${execSync("npm root -g").toString().trim()}/`)("playwright");
  }
}

async function comando(nome, corpo = {}) {
  const r = await fetch(`${base}/api/${nome}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  const esito = await r.json();
  if (!esito.ok) throw new Error(`${nome}: ${esito.errore}`);
  return esito.dati;
}

// Dati di prova dello stato scelto, come li mostrerebbe la regia.
async function preparaStato() {
  await comando("layout", { nome: layout });
  if (layout === "gara") await comando("demo"); // classifica, traccia con voti, voto della chat aperto e countdown
}

const selettore = (chiave) => SELETTORI[layout]?.[chiave] ?? `[data-parte="${chiave}"]`;

// ----- Lettere tagliate (copia delle funzioni di mockup-formati.mjs) -----

// Quanti pixel (con una differenza netta di colore) cambiano tra due fotografie PNG della stessa zona (gira dentro la pagina).
const contaPixelDiversi = async ([a64, b64]) => {
  const carica = (b64) =>
    new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.src = `data:image/png;base64,${b64}`;
    });
  const [ia, ib] = await Promise.all([carica(a64), carica(b64)]);
  const c = document.createElement("canvas");
  c.width = ia.width;
  c.height = ia.height;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(ia, 0, 0);
  const da = x.getImageData(0, 0, c.width, c.height).data;
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(ib, 0, 0);
  const db = x.getImageData(0, 0, c.width, c.height).data;
  let diversi = 0;
  for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) diversi++;
  return diversi;
};

// Il testo di una riga non è tagliato dalla riga stessa. Le righe hanno un'altezza fissa e `overflow: hidden`: le lettere che
// sporgono sopra o sotto (discendenti, accenti) vengono tagliate senza che nessuna misura di larghezza o altezza se ne accorga.
// Per questo si fotografa la stessa zona con `overflow: hidden` e con `overflow: visible` sul solo elemento: devono essere uguali.
// Ombre, riflessi e il cromo del testo si tolgono prima (sfumano oltre la riga anche senza tagli, e un testo con sfondo ritagliato
// a lettera non si vedrebbe fuori dalla scatola). Ritorna le righe tagliate.
async function inchiostroTagliato(pagina, selettori) {
  const tagliate = [];
  const vista = pagina.viewportSize();
  for (const sel of selettori) {
    const luoghi = await pagina.locator(sel).all();
    for (const [indice, luogo] of luoghi.entries()) {
      const box = await luogo.boundingBox();
      const testo = ((await luogo.textContent()) ?? "").trim();
      if (!box || box.width < 1 || box.height < 1 || !testo) continue;
      const x = Math.max(0, box.x - 24);
      const y = Math.max(0, box.y - 36);
      const clip = { x, y, width: Math.min(vista.width - x, box.width + 48), height: Math.min(vista.height - y, box.height + 72) };
      await luogo.evaluate((e) => {
        e.dataset.provaStile = e.getAttribute("style") ?? "";
        for (const [nome, valore] of [["text-shadow", "none"], ["filter", "none"], ["animation", "none"], ["background", "none"], ["color", "#fff"], ["-webkit-text-fill-color", "#fff"]]) e.style.setProperty(nome, valore, "important");
      });
      const chiusa = await pagina.screenshot({ clip, animations: "disabled", caret: "hide" });
      await luogo.evaluate((e) => e.style.setProperty("overflow", "visible", "important"));
      const aperta = await pagina.screenshot({ clip, animations: "disabled", caret: "hide" });
      const corpo = await luogo.evaluate((e) => {
        const c = parseFloat(getComputedStyle(e).fontSize);
        e.setAttribute("style", e.dataset.provaStile);
        delete e.dataset.provaStile;
        return c;
      });
      const diversi = await pagina.evaluate(contaPixelDiversi, [chiusa.toString("base64"), aperta.toString("base64")]);
      if (diversi > 2) tagliate.push({ sel, indice, testo: testo.slice(0, 24), pixel: diversi, corpo });
    }
  }
  return tagliate;
}
const descriviTagliate = (tagliate, contesto) => tagliate.map((t) => `${t.sel}${t.indice ? `[${t.indice}]` : ""} («${t.testo}…», ${Math.round(t.corpo)} px, ${contesto}): le lettere sporgono dalla riga e vengono tagliate (${t.pixel} pixel)`);

async function main() {
  const tabella = GEOMETRIA[layout]?.verticale;
  const pezziAttesi = PRESENTI[layout]?.[stato];
  if (!tabella || !pezziAttesi) {
    const valide = Object.entries(PRESENTI).flatMap(([l, ss]) => Object.keys(ss).map((s) => `${l}/${s}`));
    console.error(`Combinazione sconosciuta: ${layout}/${stato}. Valide: ${valide.join(", ")}`);
    process.exit(2);
  }
  await preparaStato();
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: VISTA });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  await pagina.goto(`${base}/${PAGINE[layout]}?anteprima=1&statico=1${guida ? "&guide=1" : ""}`);
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(700);

  for (const chiave of pezziAttesi) {
    const rect = await pagina.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, nascosto: el.hidden || r.width === 0 || getComputedStyle(el).display === "none" };
    }, selettore(chiave));
    if (!rect) {
      errori.push(`${chiave}: elemento assente`);
      continue;
    }
    if (rect.nascosto) {
      errori.push(`${chiave}: nascosto`);
      continue;
    }
    const { r: [x, y, w, h], dentro } = tabella[chiave];
    const trovato = [rect.x, rect.y, rect.w, rect.h];
    if ([x, y, w, h].some((v, i) => Math.abs(v - trovato[i]) > TOLLERANZA)) {
      errori.push(`${chiave}: trovato [${trovato.map((n) => Math.round(n)).join(", ")}], atteso [${x}, ${y}, ${w}, ${h}]`);
    }
    if (dentro && (rect.x < X_MIN - TOLLERANZA || rect.x + rect.w > X_MAX + TOLLERANZA || rect.y < Y_MIN - TOLLERANZA || rect.y + rect.h > Y_MAX + TOLLERANZA)) {
      errori.push(`${chiave}: esce dalla zona libera (x ${X_MIN}…${X_MAX}, y ${Y_MIN}…${Y_MAX})`);
    }
  }
  errori.push(...sovrapposizioni(Object.fromEntries(pezziAttesi.map((chiave) => [chiave, tabella[chiave]]))));

  const nome = layout === "gara" && stato === STATO_PREDEFINITO.gara ? "verticale" : `${layout}-${stato}`;
  const file = join(CARTELLA, "mockup", `${nome}${guida ? "-guide" : ""}.jpg`);
  await pagina.screenshot({ path: file, type: "jpeg", quality: 88 });
  if (controlli) errori.push(...descriviTagliate(await inchiostroTagliato(pagina, RIGHE[layout] ?? []), `${layout}/${stato}`));
  await browser.close();
  if (errori.length) {
    console.error(`Problemi in ${layout}/${stato}:\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok ${layout}/${stato}: geometria rispettata${controlli ? ", nessuna lettera tagliata" : ""}, mockup in ${file}`);
}

// Importato (dai test) non parte da solo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
