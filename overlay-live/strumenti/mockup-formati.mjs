// Mockup e controllo di geometria dei quattro layout nuovi con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout <drum|produzione|reaction|podcast>
//        [--formato orizzontale] [--stato <stato>] [--guida]
//   stati: drum vuoto|meta|sblocco|finale (predefinito meta); produzione e reaction base; podcast completo|base (con la
//   linea di divisione e il pannello Tematiche accesi o spenti).
// Mette il server nel layout con i dati di prova dello stato, apre la pagina (1080×1920, o 1920×1080 per l'orizzontale),
// controlla che ogni pezzo stia dove dice la tabella della spec (±1 px, e dentro x 116…964 / y 230…1200 per i pezzi che lo
// dichiarano) e salva mockup/<layout>[-orizzontale][-<stato>].jpg. Esce con codice 1 e l'elenco dei problemi.
// Usate un server di prova su una porta libera (OVERLAY_CONFIG e OVERLAY_DATI temporanei): lo strumento ne cambia lo stato.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), "..");

// Un pezzo: [x, y, larghezza, altezza] in pixel della tela; `dentro` = deve stare nella zona libera dei telefoni.
const p = (x, y, w, h, dentro = false) => ({ r: [x, y, w, h], dentro });

// Una voce per pezzo: la chiave è il suo data-parte, oppure «finto:<nome>» per i finti schermi [data-finto].
export const GEOMETRIA = {
  drum: {
    verticale: { fascia: p(0, 1108, 1080, 92), "finto:camera": p(0, 0, 1080, 1920) },
  },
  produzione: {
    verticale: { fascia: p(0, 1212, 1080, 92), "finto:A": p(0, 0, 1080, 1212), "finto:B": p(0, 1304, 1080, 616) },
  },
  reaction: {
    verticale: { fascia: p(0, 1212, 1080, 92), "finto:A": p(0, 0, 1080, 1212), "finto:B": p(0, 1304, 1080, 616) },
    orizzontale: { fascia: p(0, 920, 1920, 92), "finto:A": p(24, 192, 576, 702), "finto:B": p(648, 192, 1248, 702) },
  },
  podcast: {
    verticale: { fascia: p(0, 1108, 1080, 92), "finto:camera": p(0, 0, 1080, 1920) },
    orizzontale: { fascia: p(0, 968, 1920, 92), "finto:camera": p(0, 0, 1920, 1080) },
  },
};

const tutti = (layout, formato) => Object.keys(GEOMETRIA[layout][formato]);
const stati = (layout, formato, elenco) => Object.fromEntries(elenco.map((stato) => [stato, tutti(layout, formato)]));
// Per ogni layout, formato e stato: i pezzi che devono esserci (e non essere nascosti).
export const PRESENTI = {
  drum: { verticale: stati("drum", "verticale", ["vuoto", "meta", "sblocco", "finale"]) },
  produzione: { verticale: stati("produzione", "verticale", ["base"]) },
  reaction: { verticale: stati("reaction", "verticale", ["base"]), orizzontale: stati("reaction", "orizzontale", ["base"]) },
  podcast: { verticale: stati("podcast", "verticale", ["completo", "base"]), orizzontale: stati("podcast", "orizzontale", ["completo", "base"]) },
};
const STATO_PREDEFINITO = { drum: "meta", produzione: "base", reaction: "base", podcast: "completo" };
const BARRA = { drum: "drumBarra", produzione: "prBarra", reaction: "reBarra", podcast: "poBarra" };

// Zona libera dei telefoni: sotto l'intestazione di TikTok (230), sopra la chat (1200), tra x 116 e 964.
const X_MIN = 116;
const X_MAX = 964;
const Y_MIN = 230;
const Y_MAX = 1200;
const TOLLERANZA = 1;

const args = process.argv.slice(2);
const opzione = (nome, predefinito) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : predefinito;
};
const base = opzione("base", "http://127.0.0.1:4747");
const layout = opzione("layout", "drum");
const formato = opzione("formato", "verticale");
const stato = opzione("stato", STATO_PREDEFINITO[layout]);
const guida = args.includes("--guida");

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
}

const OSPITE = { nome: "Lince", handle: "@lince.music", icona: "instagram" };
const TEMATICHE = ["Come nasce un beat", "Il primo disco", "Social e musica", "Cosa ascoltiamo", "Domande dal pubblico"];

// Dati di prova dello stato scelto, come li mostrerebbe la regia.
async function preparaStato() {
  await comando("layout", { nome: layout });
  await comando("widget", { nome: BARRA[layout], visibile: true });
  if (layout === "drum") await comando("drumDemo", { fase: stato });
  if (layout === "produzione") await comando("produzione", { preset: "cooking" });
  if (layout === "podcast") {
    await comando("podcast", { titolo: { testo: "Back Rooms Podcast", sotto: "Puntata 12" }, ospiti: [OSPITE], tematiche: { elenco: TEMATICHE, attiva: 1 } });
    for (const nome of ["poLinea", "poTematiche"]) await comando("widget", { nome, visibile: stato === "completo" });
  }
}

const selettore = (chiave) => (chiave.startsWith("finto:") ? `[data-finto="${chiave.slice(6)}"]` : `[data-parte="${chiave}"]`);

// La fascia scorre davvero (senza ?statico=1), con almeno un pezzo, e il nastro copre tutta la larghezza.
async function controllaFasciaViva(browser, dimensioni, url, errori) {
  const pagina = await browser.newPage({ viewport: dimensioni });
  const pezzi = [];
  pagina.on("pageerror", (e) => pezzi.push(`pagina: ${e.message}`));
  await pagina.goto(url.replace("&statico=1", ""));
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(1200);
  const tx = () =>
    pagina.evaluate(() => {
      const n = document.querySelector("#sp-nastro");
      return { x: new DOMMatrix(getComputedStyle(n).transform).m41, pezzi: n.querySelectorAll(".sp-pezzo").length, destra: n.lastElementChild?.getBoundingClientRect().right ?? 0 };
    });
  const prima = await tx();
  await pagina.waitForTimeout(1500);
  const dopo = await tx();
  await pagina.close();
  errori.push(...pezzi);
  if (!dopo.pezzi) errori.push("fascia: nessun pezzo nel nastro");
  else if (dopo.x >= prima.x - 20) errori.push(`fascia: non scorre (x ${prima.x.toFixed(1)} → ${dopo.x.toFixed(1)} in 1,5 s)`);
  if (dopo.destra < dimensioni.width) errori.push(`fascia: il nastro finisce a x ${Math.round(dopo.destra)}, prima del bordo destro (${dimensioni.width})`);
}

async function main() {
  const tabella = GEOMETRIA[layout]?.[formato];
  const pezziAttesi = PRESENTI[layout]?.[formato]?.[stato];
  if (!tabella || !pezziAttesi) {
    const esistenti = Object.entries(PRESENTI).flatMap(([l, fs]) => Object.entries(fs).flatMap(([f, ss]) => Object.keys(ss).map((s) => `${l}/${f}/${s}`)));
    console.error(`Combinazione sconosciuta: ${layout}/${formato}/${stato}. Valide: ${esistenti.join(", ")}`);
    process.exit(2);
  }
  await preparaStato();
  const orizzontale = formato === "orizzontale";
  const dimensioni = orizzontale ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: dimensioni });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  const parametri = ["anteprima=1", "statico=1", ...(guida ? ["guide=1"] : []), ...(orizzontale ? ["formato=orizzontale"] : [])];
  const url = `${base}/${layout}.html?${parametri.join("&")}`;
  await pagina.goto(url);
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

  const nome = `${layout}${orizzontale ? "-orizzontale" : ""}${stato === STATO_PREDEFINITO[layout] && layout !== "drum" ? "" : `-${stato}`}${guida ? "-guide" : ""}`;
  const file = join(CARTELLA, "mockup", `${nome}.jpg`);
  await pagina.screenshot({ path: file, type: "jpeg", quality: 88 });
  await pagina.close();
  await controllaFasciaViva(browser, dimensioni, url, errori);
  await browser.close();
  if (errori.length) {
    console.error(`Problemi in ${layout}/${formato}/${stato}:\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok ${layout}/${formato}/${stato}: geometria rispettata, la fascia scorre, mockup in ${file}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
