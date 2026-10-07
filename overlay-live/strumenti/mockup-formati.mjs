// Mockup e controllo di geometria dei quattro layout nuovi con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout <drum|produzione|reaction|podcast>
//        [--formato orizzontale] [--stato <stato>] [--guida]
//   stati: drum vuoto|meta|sblocco|finale (predefinito meta); produzione e reaction base; podcast completo|base (con la
//   linea di divisione e il pannello Tematiche accesi o spenti).
// Mette il server nel layout con i dati di prova dello stato, apre la pagina (1080×1920, o 1920×1080 per l'orizzontale),
// controlla che ogni pezzo stia dove dice la tabella della spec (±1 px, e dentro x 116…964 / y 230…1200 per i pezzi che lo
// dichiarano) e salva mockup/<layout>[-orizzontale][-<stato>].jpg. Esce con codice 1 e l'elenco dei problemi.
//   --regia: flusso della pagina di regia (selettore dei layout, sezioni, scheda Social del brand, dimensione dei testi,
//   velocità della fascia, spunte «In onda») su 1500×2400, con mockup/regia-formati.jpg.
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
const regia = args.includes("--regia");

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

const statoServer = async () => (await fetch(`${base}/api/stato`)).json();

// Aspetta (al massimo 3 s) che il server abbia lo stato voluto: la regia manda i comandi con un piccolo ritardo.
async function attendi(descrizione, condizione) {
  for (let i = 0; i < 30; i++) {
    if (condizione(await statoServer())) return;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error(`atteso: ${descrizione}`);
}

// La pagina di regia: con ogni layout in onda si accende solo la sua sezione, la scheda «Social del brand» è accesa solo
// per i layout con la barra, e i controlli comuni (testi, velocità, «In onda») arrivano al server.
async function provaRegia() {
  await comando("nuovaSerata");
  const SEZIONI = { gara: null, senzaPremio: "#sp-regia", studio: "#st-regia", battle: "#bt-regia", drum: "#dr-regia", produzione: "#pr-regia", podcast: "#po-regia", reaction: "#re-regia" };
  const CON_SOCIAL = ["senzaPremio", "studio", "drum", "produzione", "podcast", "reaction"];
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1500, height: 2400 } });
  const errori = [];
  pagina.setDefaultTimeout(5000);
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  await pagina.goto(`${base}/regia`);
  await pagina.waitForSelector("#layout");

  const opzioni = await pagina.$$eval("#layout option", (o) => o.map((x) => x.value));
  if (opzioni.join() !== Object.keys(SEZIONI).join()) errori.push(`selettore dei layout: ${opzioni.join(", ")}`);
  for (const [nome, sezione] of Object.entries(SEZIONI)) {
    await pagina.selectOption("#layout", nome);
    await attendi(`layout ${nome}`, (st) => st.layout === nome);
    await pagina.waitForTimeout(200);
    const accese = await pagina.evaluate((mappa) => Object.fromEntries(Object.entries(mappa).map(([l, sel]) => [l, sel ? document.querySelector(sel)?.classList.contains("attivo") ?? null : false])), SEZIONI);
    for (const [l, acceso] of Object.entries(accese)) {
      if (acceso === null) errori.push(`${l}: la sezione ${SEZIONI[l]} non esiste`);
      else if (acceso !== (l === nome && Boolean(sezione))) errori.push(`con ${nome} in onda la sezione di ${l} è ${acceso ? "accesa" : "spenta"}`);
    }
    const sociale = await pagina.evaluate(() => document.querySelector("#social-regia")?.classList.contains("attivo") ?? null);
    if (sociale !== CON_SOCIAL.includes(nome)) errori.push(`con ${nome} in onda «Social del brand» è ${sociale ? "accesa" : "spenta"}`);
  }
  const righe = await pagina.locator("#social-regia #sp-voci li").count();
  if (righe < 5) errori.push(`«Social del brand»: ${righe} voci invece di almeno 5`);
  if (await pagina.locator("#sp-regia #sp-voci").count()) errori.push("la lista dei social è ancora nella sezione «Senza premio»");

  // la lista dei social, spostata nella sua scheda, modifica ancora la barra
  const prima = (await statoServer()).senzaPremio.voci.length;
  await pagina.click("#sp-aggiungi");
  const riga = pagina.locator("#sp-voci li").last();
  await riga.locator('[name="etichetta"]').fill("Prova");
  await riga.locator('[name="testo"]').fill("@prova.prova");
  await riga.locator('[name="testo"]').press("Tab");
  await attendi("una voce social in più", (st) => st.senzaPremio.voci.length === prima + 1);
  await pagina.locator("#sp-voci li").last().locator("[data-togli]").click();
  await attendi("la voce social tolta", (st) => st.senzaPremio.voci.length === prima);

  // dimensione dei testi, velocità e spunte «In onda» di ogni sezione
  await pagina.selectOption("#layout", "drum");
  const testo = pagina.locator('#dr-regia input[data-testo="contatore"]');
  await testo.fill("140");
  await attendi("drum.testi.contatore 140", (st) => st.drum.testi.contatore === 140);
  await pagina.click('#dr-regia [data-testi-azzera="drum"]');
  await attendi("drum.testi tornati a 100", (st) => Object.values(st.drum.testi).every((v) => v === 100));
  await pagina.locator("#pr-regia .fm-velocita input[type=range]").fill("120");
  await attendi("produzione.velocita 120", (st) => st.produzione.velocita === 120);
  const nota = await pagina.locator("#pr-regia .fm-velocita").innerText();
  if (!/120 px\/s · un giro ≈ \d+ s/.test(nota)) errori.push(`velocità di produzione: «${nota.replace(/\n/g, " ")}»`);
  const interruttore = pagina.locator('#po-regia input[data-widget="poLinea"]');
  await interruttore.check();
  await attendi("visibili.poLinea acceso", (st) => st.visibili.poLinea === true);
  await interruttore.uncheck();
  await attendi("visibili.poLinea spento", (st) => st.visibili.poLinea === false);
  for (const [sigla, widget] of [["dr", ["drumCornice", "drumTraguardi", "drumBrano", "drumPriorita", "drumBarra"]], ["pr", ["prTitolo", "prBarra"]], ["po", ["poTitolo", "poLinea", "poTematiche", "poBarra"]], ["re", ["reTitolo", "reBarra"]]]) {
    const trovati = await pagina.$$eval(`#${sigla}-regia [data-widget]`, (c) => c.map((x) => x.dataset.widget));
    if (trovati.join() !== widget.join()) errori.push(`#${sigla}-regia: spunte «In onda» ${trovati.join(", ")} invece di ${widget.join(", ")}`);
  }

  // l'anteprima di podcast e reaction passa da verticale a orizzontale
  for (const [sezione, pagineNome] of [["#po-regia", "podcast"], ["#re-regia", "reaction"]]) {
    await pagina.click(`${sezione} [data-anteprima-formato="orizzontale"]`);
    const orizzontale = await pagina.evaluate((sel) => {
      const f = document.querySelector(`${sel} .sp-anteprima iframe`);
      return { src: f.getAttribute("src"), larghezza: f.width, altezza: f.height, attivo: document.querySelector(`${sel} [data-anteprima-formato="orizzontale"]`).classList.contains("attivo") };
    }, sezione);
    if (!orizzontale.src.includes(`${pagineNome}.html`) || !orizzontale.src.includes("formato=orizzontale") || orizzontale.larghezza !== "1920" || orizzontale.altezza !== "1080" || !orizzontale.attivo) {
      errori.push(`${sezione}: anteprima orizzontale ${JSON.stringify(orizzontale)}`);
    }
    await pagina.click(`${sezione} [data-anteprima-formato="verticale"]`);
    const verticale = await pagina.evaluate((sel) => document.querySelector(`${sel} .sp-anteprima iframe`).getAttribute("src"), sezione);
    if (verticale.includes("formato=orizzontale")) errori.push(`${sezione}: l'anteprima non torna in verticale`);
  }

  await pagina.waitForTimeout(500);
  const file = join(CARTELLA, "mockup", "regia-formati.jpg");
  await (await pagina.$("#po-regia")).screenshot({ path: file, type: "jpeg", quality: 85 });
  await browser.close();
  if (errori.length) {
    console.error(`Regia: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok regia: sezioni, scheda Social del brand, testi, velocità e spunte «In onda», mockup in ${file}`);
}

async function main() {
  if (regia) return provaRegia();
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
