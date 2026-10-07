// Mockup e controllo di geometria dei quattro layout nuovi con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout <drum|produzione|reaction|podcast>
//        [--formato orizzontale] [--stato <stato>] [--guida]
//   stati: drum vuoto|meta|sblocco|finale (predefinito meta); produzione e reaction base; podcast completo|base (con la
//   linea di divisione e il pannello Tematiche accesi o spenti).
// Mette il server nel layout con i dati di prova dello stato, apre la pagina (1080×1920, o 1920×1080 per l'orizzontale),
// controlla che ogni pezzo stia dove dice la tabella della spec (±1 px, e dentro x 116…964 / y 230…1200 per i pezzi che lo
// dichiarano) e salva mockup/<layout>[-orizzontale][-<stato>].jpg. Esce con codice 1 e l'elenco dei problemi.
//   --testi-lunghi: i testi più lunghi permessi (titolo di tappa e di brano da 60 caratteri, artista da 40, prefisso da 16,
//   slot da 20, ospite con handle da 40) con la dimensione dei testi del Drum al 200%: niente esce dal suo riquadro.
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
    verticale: {
      brano: p(116, 282, 524, 80, true),
      priorita: p(116, 380, 524, 106, true),
      contatore: p(676, 282, 288, 68, true),
      colonna: p(676, 366, 288, 640, true),
      eq: p(116, 1016, 848, 84, true),
      cornice: p(116, 262, 848, 838, true),
      sblocco: p(116, 520, 524, 170, true),
      fascia: p(0, 1108, 1080, 92),
      "finto:camera": p(0, 0, 1080, 1920),
    },
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
const senza = (layout, formato, ...esclusi) => tutti(layout, formato).filter((chiave) => !esclusi.includes(chiave));
const stati = (layout, formato, elenco) => Object.fromEntries(elenco.map((stato) => [stato, tutti(layout, formato)]));
// Per ogni layout, formato e stato: i pezzi che devono esserci (e non essere nascosti).
export const PRESENTI = {
  // vuoto: niente brano in esecuzione e niente banner; meta e finale: niente banner; sblocco: la sequenza finita, con il banner
  drum: {
    verticale: {
      vuoto: senza("drum", "verticale", "brano", "sblocco"),
      meta: senza("drum", "verticale", "sblocco"),
      sblocco: tutti("drum", "verticale"),
      finale: senza("drum", "verticale", "sblocco"),
    },
  },
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
const testiLunghi = args.includes("--testi-lunghi");

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
  if (layout === "drum") {
    // partenza pulita: scaletta di base, «Dona un…» di partenza, nessun brano, testi al 100% (poi i dati di prova)
    await comando("drumScaletta", { predefinita: true });
    await comando("drumPriorita", { prefisso: "Dona un", slot: "Rosa", sopra: "Salta la coda · scegli tu il brano", icona: "rosa" });
    await comando("formatoTesti", { formato: "drum", azzera: true });
    await comando("drumDemo", { fase: stato });
  }
  if (layout === "produzione") await comando("produzione", { preset: "cooking" });
  if (layout === "podcast") {
    await comando("podcast", { titolo: { testo: "Back Rooms Podcast", sotto: "Puntata 12" }, ospiti: [OSPITE], tematiche: { elenco: TEMATICHE, attiva: 1 } });
    for (const nome of ["poLinea", "poTematiche"]) await comando("widget", { nome, visibile: stato === "completo" });
  }
}

// I quattro moduli della colonna per stato: [indice, stato, bersaglio], e quello che devono scrivere.
const MODULI_DRUM = {
  vuoto: [[0, "attiva", "1K"], [1, "chiusa", "2K"], [2, "chiusa", "3K"], [3, "chiusa", "5K"]],
  meta: [[6, "sbloccata", "10K"], [7, "attiva", "12K"], [8, "chiusa", "15K"], [9, "chiusa", "17K"]],
  sblocco: [[7, "sbloccata", "12K"], [8, "attiva", "15K"], [9, "chiusa", "17K"], [10, "chiusa", "20K"]],
  finale: [[33, "sbloccata", "350K"], [34, "sbloccata", "400K"], [35, "sbloccata", "450K"], [36, "sbloccata", "500K"]],
};
const CONTATORE_DRUM = { vuoto: "0", meta: "11.400", sblocco: "12.000", finale: "500.000" };

async function controllaDrum(pagina, errori) {
  const trovati = await pagina.evaluate(() =>
    [...document.querySelectorAll("#dr-colonna .dr-modulo")].map((m) => ({
      indice: Number(m.dataset.indice),
      stato: m.dataset.stato,
      like: m.querySelector(".dr-modulo-like")?.textContent,
      titolo: m.querySelector(".dr-modulo-titolo")?.textContent,
      manca: m.querySelector(".dr-modulo-manca")?.textContent ?? "",
      perc: m.querySelector(".dr-modulo-perc")?.textContent ?? "",
    })),
  );
  const attesi = MODULI_DRUM[stato];
  const letti = trovati.map((m) => [m.indice, m.stato, m.like]);
  if (JSON.stringify(letti) !== JSON.stringify(attesi)) errori.push(`moduli: trovati ${JSON.stringify(letti)}, attesi ${JSON.stringify(attesi)}`);
  const contatore = await pagina.evaluate(() => document.querySelector("#dr-like-numero")?.textContent);
  if (contatore !== CONTATORE_DRUM[stato]) errori.push(`contatore: «${contatore}» invece di «${CONTATORE_DRUM[stato]}»`);
  if (stato === "meta" && trovati.length === 4) {
    if (trovati[0].titolo !== "Another One Bites the Dust") errori.push(`modulo sbloccato: «${trovati[0].titolo}»`);
    if (trovati[1].titolo !== "Brano segreto") errori.push(`modulo attivo: «${trovati[1].titolo}»`);
    if (!trovati[1].manca.includes("600")) errori.push(`modulo attivo: «${trovati[1].manca}» non dice che mancano 600`);
    if (trovati[1].perc !== "70%") errori.push(`modulo attivo: percentuale «${trovati[1].perc}»`);
    const brano = await pagina.evaluate(() => document.querySelector("#dr-brano-titolo")?.textContent);
    if (brano !== "Seven Nation Army") errori.push(`brano in esecuzione: «${brano}»`);
  }
  if (stato === "sblocco") {
    const titolo = await pagina.evaluate(() => document.querySelector("#dr-sblocco-titolo")?.textContent);
    if (titolo !== "Livin' on a Prayer") errori.push(`banner di sblocco: «${titolo}»`);
  }
  const priorita = await pagina.evaluate(() => [document.querySelector("#dr-pri-prefisso")?.textContent, document.querySelector("#dr-pri-slot")?.textContent]);
  if (priorita.join("|") !== "Dona un|Rosa") errori.push(`«Dona un…»: ${priorita.join(" ")}`);
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

// Un testo di prova lungo `n` caratteri, con gli spazi di una frase vera (che va a capo) e senza spazio alla fine.
const lungo = (n) => "Lunghissimo titolo di prova con tante parole per la riga ".repeat(3).slice(0, n).trimEnd().padEnd(n, "x");

// I testi più lunghi nei riquadri fissi del Drum, con la dimensione dei testi al massimo (Review Focus 4).
async function provaTestiLunghi() {
  await comando("nuovaSerata");
  await comando("layout", { nome: "drum" });
  const likes = [1000, 2000, 3000, 5000, 7000, 9000, 10000, 12000, 15000, 17000, 20000, 22000];
  const righe = likes.map((like, i) => (i === 6 ? `${like} | ${lungo(60)}` : i === 5 ? `${like} | Titolo breve` : `${like} |`));
  await comando("drumScaletta", { testo: righe.join("\n") });
  await comando("drumLike", { imposta: 11400 });
  await comando("drumBrano", { titolo: lungo(60), artista: lungo(40) });
  await comando("drumPriorita", { prefisso: "Regala una super", slot: "Corolla di cristallo" });
  await comando("drumOspite", { handle: `@${"a".repeat(39)}` });
  await comando("formatoTesti", { formato: "drum", valori: { contatore: 200, traguardi: 200, brano: 200, priorita: 200, sblocco: 200 } });
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  await pagina.goto(`${base}/drum.html?anteprima=1&statico=1&sblocco=1`);
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(800);
  const misure = await pagina.evaluate(() => {
    const larghezza = (sel) => [...document.querySelectorAll(sel)].map((e) => ({ sel, testo: e.textContent.slice(0, 20), tagliato: e.scrollWidth > e.clientWidth, alto: e.scrollHeight > e.clientHeight + parseFloat(getComputedStyle(e).fontSize) * 0.35, corpo: parseFloat(getComputedStyle(e).fontSize) }));
    return [".dr-modulo-titolo", "#dr-brano-titolo", "#dr-brano-artista", "#dr-pri-prefisso", "#dr-pri-slot", "#dr-pri-sopra", "#dr-like-numero", "#dr-sblocco-titolo", ".dr-modulo-like"].flatMap(larghezza);
  });
  for (const m of misure) {
    if (m.tagliato) errori.push(`${m.sel} («${m.testo}…», ${Math.round(m.corpo)} px): il testo esce dal riquadro in larghezza`);
    if (m.alto) errori.push(`${m.sel} («${m.testo}…», ${Math.round(m.corpo)} px): il testo esce dal riquadro in altezza`);
  }
  const tabella = GEOMETRIA.drum.verticale;
  for (const chiave of ["colonna", "brano", "priorita", "contatore", "sblocco"]) {
    const r = await pagina.evaluate((sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return [b.x, b.y, b.width, b.height];
    }, selettore(chiave));
    const attesi = tabella[chiave].r;
    if (attesi.some((v, i) => Math.abs(v - r[i]) > TOLLERANZA)) errori.push(`${chiave}: con i testi lunghi è [${r.map(Math.round).join(", ")}], atteso [${attesi.join(", ")}]`);
  }
  // Ogni testo (il suo contenuto, anche se sporge dall'elemento) resta dentro il suo widget e non copre gli altri testi.
  const posizioni = await pagina.evaluate(() => {
    // L'inchiostro del testo: il rettangolo del contenuto senza l'aria sopra e sotto le lettere (12% per lato).
    const estensione = (e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      const b = r.getBoundingClientRect();
      return { x: b.x, y: b.y + b.height * 0.12, w: b.width, h: b.height * 0.76 };
    };
    const widget = [
      ...[...document.querySelectorAll(".dr-modulo:not([hidden])")].map((m) => ({ nome: `modulo ${m.dataset.indice}`, el: m, testi: [".dr-modulo-like", ".dr-modulo-titolo", ".dr-modulo-manca", ".dr-modulo-perc"] })),
      { nome: "brano", el: document.querySelector("#dr-brano"), testi: ["#dr-brano-titolo", "#dr-brano-artista"] },
      { nome: "priorità", el: document.querySelector("#dr-priorita"), testi: ["#dr-pri-sopra", "#dr-pri-prefisso", "#dr-pri-slot"] },
      { nome: "contatore", el: document.querySelector("#dr-contatore"), testi: ["#dr-like-numero"] },
      { nome: "banner", el: document.querySelector("#dr-sblocco"), testi: [".dr-sblocco-etichetta", "#dr-sblocco-titolo"] },
    ];
    return widget.map((w) => {
      const r = w.el.getBoundingClientRect();
      const teste = w.testi.map((sel) => w.el.querySelector(sel)).filter((e) => e && !e.hidden && e.textContent.trim());
      return { nome: w.nome, riquadro: { x: r.x, y: r.y, w: r.width, h: r.height }, testi: teste.map((e) => ({ id: e.id || e.className, ...estensione(e) })) };
    });
  });
  for (const w of posizioni) {
    for (const t of w.testi) {
      const fuori = t.x < w.riquadro.x - 1 || t.y < w.riquadro.y - 1 || t.x + t.w > w.riquadro.x + w.riquadro.w + 1 || t.y + t.h > w.riquadro.y + w.riquadro.h + 1;
      if (fuori) errori.push(`${w.nome}: «${t.id}» esce dal riquadro (testo x ${Math.round(t.x)}…${Math.round(t.x + t.w)}, y ${Math.round(t.y)}…${Math.round(t.y + t.h)}; riquadro x ${Math.round(w.riquadro.x)}…${Math.round(w.riquadro.x + w.riquadro.w)}, y ${Math.round(w.riquadro.y)}…${Math.round(w.riquadro.y + w.riquadro.h)})`);
    }
    for (let i = 0; i < w.testi.length; i++) {
      for (let j = i + 1; j < w.testi.length; j++) {
        const a = w.testi[i];
        const b = w.testi[j];
        const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (dx > 4 && dy > 0.3 * Math.min(a.h, b.h)) errori.push(`${w.nome}: «${a.id}» e «${b.id}» si sovrappongono`);
      }
    }
  }
  const corpi = misure.filter((m) => m.sel === ".dr-modulo-titolo" || m.sel === "#dr-brano-titolo").map((m) => `${m.sel} ${Math.round(m.corpo)} px`);
  await pagina.screenshot({ path: join(CARTELLA, "mockup", "drum-testi-lunghi.jpg"), type: "jpeg", quality: 88 });
  await comando("formatoTesti", { formato: "drum", azzera: true });
  await comando("drumBrano", { svuota: true });
  await browser.close();
  if (errori.length) {
    console.error(`Testi lunghi: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok testi lunghi: tutto dentro i riquadri con i testi al 200% (${corpi.join(", ")}), mockup in mockup/drum-testi-lunghi.jpg`);
}

async function main() {
  if (testiLunghi) return provaTestiLunghi();
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
  const parametri = ["anteprima=1", "statico=1", ...(guida ? ["guide=1"] : []), ...(orizzontale ? ["formato=orizzontale"] : []), ...(layout === "drum" && stato === "sblocco" ? ["sblocco=1"] : [])];
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

  // I pezzi che in questo stato non devono esserci (es. il brano senza titolo, il banner senza sblocco) sono nascosti.
  for (const chiave of Object.keys(tabella).filter((k) => !pezziAttesi.includes(k))) {
    const visibile = await pagina.evaluate((sel) => {
      const el = document.querySelector(sel);
      return Boolean(el) && !el.hidden && getComputedStyle(el).display !== "none";
    }, selettore(chiave));
    if (visibile) errori.push(`${chiave}: in questo stato dovrebbe essere nascosto`);
  }

  const nome = `${layout}${orizzontale ? "-orizzontale" : ""}${stato === STATO_PREDEFINITO[layout] && layout !== "drum" ? "" : `-${stato}`}${guida ? "-guide" : ""}`;
  const file = join(CARTELLA, "mockup", `${nome}.jpg`);
  await pagina.screenshot({ path: file, type: "jpeg", quality: 88 });
  if (layout === "drum") await controllaDrum(pagina, errori);
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
