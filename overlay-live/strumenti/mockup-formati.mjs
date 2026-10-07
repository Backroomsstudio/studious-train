// Mockup e controllo di geometria dei quattro layout nuovi con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-formati.mjs --base http://127.0.0.1:4799 --layout <drum|produzione|reaction|podcast>
//        [--formato orizzontale] [--stato <stato>] [--guida]
//   stati: drum vuoto|meta|sblocco|finale (predefinito meta); produzione e reaction base; podcast completo|base (con la
//   linea di divisione e il pannello Tematiche accesi o spenti).
// Mette il server nel layout con i dati di prova dello stato, apre la pagina (1080×1920, o 1920×1080 per l'orizzontale),
// controlla che ogni pezzo stia dove dice la tabella della spec (±1 px, e dentro x 116…964 / y 230…1200 per i pezzi che lo
// dichiarano) e salva mockup/<layout>[-orizzontale][-<stato>].jpg. Esce con codice 1 e l'elenco dei problemi.
//   --clessidra: il riempimento dei moduli del Drum, con perline e con sabbia: il bordo alto dei grani sta dove dice il
//   progresso (meta: 70%), il modulo attivo è vuoto senza Like, i moduli sbloccati sono pieni e quelli chiusi vuoti.
//   --sblocco-animato: la sequenza di sblocco del Drum dal vivo (pagina non statica, senza suoni): urto subito, banner dopo 1 s,
//   colonna che scorre a 1,8 s, banner via a 4,2 s; una ricarica non la rifà; con la colonna spenta a metà sparisce tutto
//   e riaccesa mostra la finestra aggiornata; due sblocchi di fila: dopo il primo parte solo l'ultimo.
//   --eq: l'equalizzatore del Drum dal vivo, con i livelli audio mandati da un client WebSocket dello strumento (come fa la regia
//   con l'audio di FL Studio): barre alte e cornice che lampeggia al colpo; senza dati, dopo 2,5 s, il «respiro» basso; con
//   «senzaSegnale» spento torna vuoto; lo stile «onda» disegna un'altra cosa (specchiata); nei mockup (?statico=1) c'è un fotogramma fisso.
//   --audio: l'ascolto dell'audio dalla regia con un ingresso finto di Chromium (un WAV con un colpo ogni 500 ms): «Ingresso audio»
//   e «Avvia ascolto» fanno alzare le barre e lampeggiare la cornice del Drum, l'indicatore di livello si muove, la sensibilità
//   conta subito, «Ferma» riporta al respiro, la «Prova» manda lo schema finto di 4 s. (L'«Audio del PC» non si prova qui.)
//   --regia-drum: i controlli del Drum nella regia: Like (+100, +1.000, imposta, riparti da ora), scaletta (salva, errore con il numero di
//   riga, «Suona ora»), brano in esecuzione, artista ospite, «Dona un…» con il richiamo (anche con F2) e il riempimento; i campi
//   in uso non si riscrivono; salva mockup/regia-drum.jpg.
//   --layout podcast [--formato orizzontale] [--stato completo|base]: oltre alla geometria, la targa («Back Rooms Podcast» e la riga
//   dell'episodio, che cambiano dal vivo e restano accese a «In onda»), le tematiche (fatta, attiva, prossima; il bordo oro che scorre;
//   l'elenco che cambia dal vivo, anche a pannello spento; la dimensione dei testi; il lato «dx» in orizzontale), la linea e il pannello
//   che entrano ed escono con la loro animazione (anche spenti e riaccesi subito) e la prima apertura senza animazioni.
//   --testi-lunghi --layout podcast [--formato orizzontale]: targa e otto tematiche al massimo dei caratteri e poi cortissime, con i
//   testi al 200%: niente esce dal suo riquadro e niente sparisce.
//   --testi-lunghi --layout produzione|reaction [--formato orizzontale]: le tre righe del titolo al massimo dei caratteri (produzione 32/28/48,
//   reaction 40/60/60) con i testi al 200%: ogni riga resta nella sua scatola e dentro la targa, senza coprire le altre.
//   --regia-doppio: i titoli di Studio Production e Reaction Release nella regia: i chip dei preset, le tre righe che vanno in onda
//   mentre si scrive (invio ritardato di 150 ms, il campo in uso non si riscrive, un errore mostra l'avviso e rimette il valore
//   in onda), «Ripristina titolo predefinito» e l'anteprima verticale/orizzontale della reaction.
//   --regia-podcast: la regia del Back Rooms Podcast: i quattro moduli a comando (Linea di divisione, Pannello Tematiche, Targa, Fascia
//   social: un clic accende, il secondo spegne), le tematiche (scritte una per riga e salvate, lista cliccabile, Avanti e Indietro, lato
//   del pannello, errore con una nona voce, bozza che lo stato non riscrive), gli ospiti (aggiungi, togli, al massimo quattro, salvati
//   all'uscita dal campo), il titolo e la riga dell'episodio che vanno in onda mentre si scrive e le scorciatoie F2, F3 e F4;
//   salva mockup/regia-podcast.jpg.
//   --testi-lunghi: i testi più lunghi permessi (titolo di tappa e di brano da 60 caratteri, artista da 40, prefisso da 16,
//   slot da 20, ospite con handle da 40) con la dimensione dei testi del Drum al 200%: niente esce dal suo riquadro.
//   --regia: flusso della pagina di regia (selettore dei layout, sezioni, scheda Social del brand, dimensione dei testi,
//   velocità della fascia, spunte «In onda») su 1500×2400, con mockup/regia-formati.jpg.
// Usate un server di prova su una porta libera (OVERLAY_CONFIG e OVERLAY_DATI temporanei): lo strumento ne cambia lo stato.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
    verticale: { titolo: p(116, 282, 848, 160, true), fascia: p(0, 1212, 1080, 92), "finto:A": p(0, 0, 1080, 1212), "finto:B": p(0, 1304, 1080, 616) },
  },
  reaction: {
    verticale: { titolo: p(116, 282, 848, 160, true), fascia: p(0, 1212, 1080, 92), "finto:A": p(0, 0, 1080, 1212), "finto:B": p(0, 1304, 1080, 616) },
    orizzontale: {
      titolo: p(360, 28, 1200, 140),
      finestraA: p(24, 192, 576, 702),
      finestraB: p(648, 192, 1248, 702),
      divisore: p(600, 192, 48, 702),
      fascia: p(0, 920, 1920, 92),
      "finto:A": p(24, 192, 576, 702),
      "finto:B": p(648, 192, 1248, 702),
    },
  },
  podcast: {
    verticale: {
      targa: p(116, 282, 848, 90, true),
      tematiche: p(116, 400, 848, 480, true),
      linea: p(538, 240, 4, 860, true),
      fascia: p(0, 1108, 1080, 92),
      "finto:camera": p(0, 0, 1080, 1920),
    },
    orizzontale: {
      targa: p(48, 36, 512, 90),
      tematiche: p(48, 150, 512, 570),
      linea: p(958, 0, 4, 968),
      fascia: p(0, 968, 1920, 92),
      "finto:camera": p(0, 0, 1920, 1080),
    },
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
  // completo: linea e pannello Tematiche accesi; base: spenti (nascosti)
  podcast: {
    verticale: { completo: tutti("podcast", "verticale"), base: senza("podcast", "verticale", "linea", "tematiche") },
    orizzontale: { completo: tutti("podcast", "orizzontale"), base: senza("podcast", "orizzontale", "linea", "tematiche") },
  },
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
const clessidra = args.includes("--clessidra");
const sbloccoAnimato = args.includes("--sblocco-animato");
const equalizzatore = args.includes("--eq");
const audio = args.includes("--audio");
const regiaDrum = args.includes("--regia-drum");
const regiaDoppio = args.includes("--regia-doppio");
const regiaPodcast = args.includes("--regia-podcast");

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
async function preparaStato(fase = stato) {
  await comando("layout", { nome: layout });
  await comando("widget", { nome: BARRA[layout], visibile: true });
  if (layout === "drum") {
    // partenza pulita: scaletta di base, «Dona un…» di partenza, nessun brano, testi al 100% (poi i dati di prova)
    await comando("drumScaletta", { predefinita: true });
    await comando("drumPriorita", { prefisso: "Dona un", slot: "Rosa", sopra: "Salta la coda · scegli tu il brano", icona: "rosa" });
    await comando("formatoTesti", { formato: "drum", azzera: true });
    await comando("drumDemo", { fase });
  }
  if (layout === "produzione" || layout === "reaction") await comando("formatoTesti", { formato: layout, azzera: true });
  if (layout === "produzione") await comando("produzione", { preset: "cooking" });
  if (layout === "reaction") await comando("reaction", { titolo: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" } });
  if (layout === "podcast") {
    await comando("formatoTesti", { formato: "podcast", azzera: true });
    await comando("podcast", { titolo: { testo: "Back Rooms Podcast", sotto: "Puntata 12" }, ospiti: [OSPITE], tematiche: { titolo: "Tematiche di oggi", elenco: TEMATICHE, attiva: 1, lato: "sx" } });
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
  await pagina.waitForTimeout(300); // la lista si ridisegna con lo stato appena arrivato: il click non deve cadere in mezzo
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
  // il testo della regia si aggiorna quando arriva lo stato nuovo, un attimo dopo che il server lo ha: si aspetta (al massimo 3 s)
  await pagina
    .waitForFunction(() => /120 px\/s · un giro ≈ \d+ s/.test(document.querySelector("#pr-regia .fm-velocita").innerText), null, { timeout: 3000 })
    .catch(async () => errori.push(`velocità di produzione: «${(await pagina.locator("#pr-regia .fm-velocita").innerText()).replace(/\n/g, " ")}»`));
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

// Il bordo alto dei grani disegnati in un canvas (la prima riga con pixel visibili), o null se è vuoto.
const bordoGrani = (pagina, sel) =>
  pagina.evaluate((selettoreCanvas) => {
    const c = document.querySelector(selettoreCanvas);
    const { data, width, height } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 40) return y;
    return null;
  }, sel);

// Il riempimento dei moduli (clessidra) con i due stili, nei tre stati che lo mostrano.
async function provaClessidra() {
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  const dove = (mod) => `#dr-colonna .dr-modulo[data-stato="${mod}"] canvas.dr-fondo`;
  const verifica = async (descrizione, sel, atteso) => {
    const bordo = await bordoGrani(pagina, sel);
    if (atteso === null) {
      if (bordo !== null) errori.push(`${descrizione}: doveva essere vuoto, ha grani da y ${bordo}`);
    } else if (bordo === null || Math.abs(bordo - atteso) > 14) {
      errori.push(`${descrizione}: bordo alto dei grani a ${bordo === null ? "nessuno (vuoto)" : `y ${bordo}`}, atteso ${atteso.toFixed(1)} ± 14`);
    }
  };
  for (const stile of ["perline", "sabbia"]) {
    await comando("layout", { nome: "drum" });
    await comando("drumRiempimento", { stile });
    for (const fase of ["meta", "vuoto", "finale"]) {
      await preparaStato(fase);
      await pagina.goto(`${base}/drum.html?anteprima=1&statico=1`);
      await pagina.evaluate(() => document.fonts?.ready);
      await pagina.waitForTimeout(600);
      const nome = `${stile}/${fase}`;
      if (fase === "meta") {
        await verifica(`${nome}: modulo attivo (70%)`, dove("attiva"), 148 * (1 - 0.7));
        await verifica(`${nome}: modulo sbloccato`, dove("sbloccata"), 0);
        await verifica(`${nome}: modulo chiuso`, `#dr-colonna .dr-modulo[data-stato="chiusa"] canvas.dr-fondo`, null);
        await pagina.screenshot({ path: join(CARTELLA, "mockup", `drum-meta${stile === "sabbia" ? "-sabbia" : ""}.jpg`), type: "jpeg", quality: 88 });
      }
      if (fase === "vuoto") await verifica(`${nome}: modulo attivo senza Like`, dove("attiva"), null);
      if (fase === "finale") for (let i = 0; i < 4; i++) await verifica(`${nome}: modulo ${i}`, `#dr-colonna .dr-modulo:nth-child(${i + 1}) canvas.dr-fondo`, 0);
    }
  }
  await comando("drumRiempimento", { stile: "perline" });
  await browser.close();
  if (errori.length) {
    console.error(`Clessidra: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok clessidra: perline e sabbia riempiono i moduli come dice il progresso (mockup/drum-meta.jpg e drum-meta-sabbia.jpg)");
}

// La sequenza di sblocco dal vivo: quando compare cosa (tempi dall'arrivo dell'evento, con un po' di margine), e i casi limite.
async function provaSbloccoAnimato() {
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const fino = (t0, ms) => attesa(Math.max(0, t0 + ms - Date.now()));
  const foto = () =>
    pagina.evaluate(() => {
      const moduli = [...document.querySelectorAll("#dr-colonna .dr-modulo")];
      const banner = document.querySelector("#dr-sblocco");
      const r = banner.getBoundingClientRect();
      return {
        colonna: moduli.map((m) => Number(m.dataset.indice)),
        stati: moduli.map((m) => m.dataset.stato),
        urto: moduli.filter((m) => m.classList.contains("sblocco")).map((m) => Number(m.dataset.indice)),
        banner: { visibile: !banner.hidden && !banner.classList.contains("fuori"), titolo: banner.querySelector("#dr-sblocco-titolo").textContent, rect: [r.x, r.y, r.width, r.height] },
        colonnaFuori: document.querySelector("#dr-colonna").classList.contains("fuori"),
        colonnaScorre: document.querySelector("#dr-colonna").classList.contains("scorre"),
        effetti: document.querySelectorAll("#dr-effetti > *").length,
        percentuale: document.querySelector('#dr-colonna .dr-modulo[data-stato="attiva"] .dr-modulo-perc')?.textContent ?? null,
        contatore: document.querySelector("#dr-like-numero")?.textContent,
      };
    });
  const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const richiedi = (quando, f, condizione, descrizione) => {
    if (!condizione(f)) errori.push(`${quando}: ${descrizione} (colonna ${JSON.stringify(f.colonna)}, urto ${JSON.stringify(f.urto)}, banner ${f.banner.visibile ? `«${f.banner.titolo}»` : "nascosto"}, effetti ${f.effetti})`);
  };
  const riparti = async () => {
    await preparaStato("meta"); // 11.400 Like, titoli di prova, nessuno sblocco in sospeso
    await comando("widget", { nome: "drumTraguardi", visibile: true });
    await attesa(700);
  };

  await preparaStato("meta");
  await comando("widget", { nome: "drumTraguardi", visibile: true });
  await pagina.goto(`${base}/drum.html?anteprima=1&muto=1`);
  await pagina.evaluate(() => document.fonts?.ready);
  await attesa(2800); // l'entrata della pagina dura 2,4 s
  let f = await foto();
  richiedi("prima dello sblocco", f, (x) => uguali(x.colonna, [6, 7, 8, 9]) && !x.urto.length && !x.banner.visibile && !x.effetti, "la pagina doveva partire ferma con la finestra [6,7,8,9]");

  // 1) lo sblocco della tappa 7 (12K)
  await comando("drumLike", { imposta: 12000 });
  let t0 = Date.now();
  await fino(t0, 400);
  f = await foto();
  richiedi("a 0,4 s", f, (x) => uguali(x.urto, [7]) && x.stati[x.colonna.indexOf(7)] === "sbloccata" && uguali(x.colonna, [6, 7, 8, 9]), "il modulo 7 doveva avere la classe «sblocco» ed essere sbloccato, con la colonna ancora [6,7,8,9]");
  richiedi("a 0,4 s", f, (x) => x.effetti > 0, "doveva esserci l'onda d'urto con le perline");
  richiedi("a 0,4 s", f, (x) => !x.banner.visibile, "il banner compare dopo 1 s");
  await fino(t0, 1700);
  f = await foto();
  richiedi("a 1,7 s", f, (x) => x.banner.visibile && x.banner.titolo === "Livin' on a Prayer", "il banner doveva essere visibile con «Livin' on a Prayer»");
  // mentre la colonna scorre arrivano altri Like: la sequenza non viene toccata (cinque moduli, quello nuovo in fondo) e a fine corsa si vedono
  await fino(t0, 2000);
  await comando("drumLike", { imposta: 12100 });
  await fino(t0, 2350);
  f = await foto();
  richiedi("a 2,35 s, mentre scorre", f, (x) => uguali(x.colonna, [6, 7, 8, 9, 10]) && x.colonnaScorre, "la colonna doveva avere cinque moduli [6,7,8,9,10] e la classe «scorre»");
  const ATTESO_BANNER = GEOMETRIA.drum.verticale.sblocco.r;
  if (f.banner.visibile && ATTESO_BANNER.some((v, i) => Math.abs(v - f.banner.rect[i]) > TOLLERANZA)) errori.push(`banner: è [${f.banner.rect.map(Math.round).join(", ")}], atteso [${ATTESO_BANNER.join(", ")}]`);
  await fino(t0, 3300);
  f = await foto();
  richiedi("a 3,3 s", f, (x) => uguali(x.colonna, [7, 8, 9, 10]) && uguali(x.stati, ["sbloccata", "attiva", "chiusa", "chiusa"]), "la colonna doveva essere scorsa a [7,8,9,10] (sbloccata, attiva, chiusa, chiusa)");
  richiedi("a 3,3 s", f, (x) => !x.urto.length && !x.effetti && !x.colonnaScorre, "nessun modulo con la classe «sblocco», nessun effetto rimasto, la colonna non scorre più");
  richiedi("a 3,3 s", f, (x) => x.percentuale === "3%" && x.contatore === "12.100", "i Like arrivati durante lo scorrimento dovevano vedersi: 12.100 e il 3% della tappa attiva");
  richiedi("a 3,3 s", f, (x) => x.banner.visibile, "il banner resta fino a 4,2 s");
  await fino(t0, 5200);
  f = await foto();
  richiedi("a 5,2 s", f, (x) => !x.banner.visibile && uguali(x.colonna, [7, 8, 9, 10]), "il banner doveva essere sparito");

  // 2) una ricarica a sblocco già annunciato non lo rifà
  await pagina.reload();
  await pagina.evaluate(() => document.fonts?.ready);
  t0 = Date.now();
  for (let ms = 100; ms <= 2200; ms += 100) {
    await fino(t0, ms);
    f = await foto();
    if (f.urto.length || f.banner.visibile || f.effetti) {
      errori.push(`dopo la ricarica (a ${ms} ms): la sequenza è ripartita (urto ${JSON.stringify(f.urto)}, banner ${f.banner.visibile}, effetti ${f.effetti})`);
      break;
    }
  }
  richiedi("dopo la ricarica", f, (x) => uguali(x.colonna, [7, 8, 9, 10]), "la colonna doveva mostrare la finestra [7,8,9,10]");

  // 3) colonna spenta a metà sequenza: sparisce tutto; riaccesa, la finestra è quella aggiornata e senza avanzi
  await riparti();
  await comando("drumLike", { imposta: 12000 });
  t0 = Date.now();
  await fino(t0, 600);
  await comando("widget", { nome: "drumTraguardi", visibile: false });
  await attesa(400);
  f = await foto();
  richiedi("colonna spenta", f, (x) => x.colonnaFuori && !x.urto.length && !x.banner.visibile && !x.effetti, "colonna e banner dovevano sparire, senza moduli «sblocco» né effetti");
  await comando("widget", { nome: "drumTraguardi", visibile: true });
  await fino(t0, 2000);
  f = await foto();
  richiedi("colonna riaccesa", f, (x) => !x.colonnaFuori && uguali(x.colonna, [7, 8, 9, 10]) && !x.urto.length && !x.banner.visibile && !x.effetti, "la colonna doveva mostrare [7,8,9,10] senza moduli «sblocco» né banner a metà");
  await fino(t0, 4600);
  f = await foto();
  richiedi("dopo l'interruzione", f, (x) => !x.banner.visibile && !x.urto.length, "la sequenza interrotta non doveva lasciare timer che mostrano il banner");

  // 4) due sblocchi mentre il primo corre: dopo il primo parte solo l'ultimo (la tappa 9)
  await riparti();
  await comando("drumLike", { imposta: 12000 });
  t0 = Date.now();
  await fino(t0, 400);
  await comando("drumLike", { imposta: 15000 });
  await fino(t0, 700);
  await comando("drumLike", { imposta: 17000 });
  await fino(t0, 1700);
  f = await foto();
  richiedi("coda, a 1,7 s", f, (x) => x.banner.visibile && x.banner.titolo === "Livin' on a Prayer", "il primo sblocco doveva proseguire con il suo banner");
  await fino(t0, 3400);
  f = await foto();
  richiedi("coda, a 3,4 s", f, (x) => uguali(x.urto, [9]) && uguali(x.colonna, [8, 9, 10, 11]), "doveva essere partito solo l'ultimo sblocco (tappa 9), con la finestra [8,9,10,11]");
  richiedi("coda, a 3,4 s", f, (x) => !x.banner.visibile, "il banner del primo sblocco doveva essere già sparito");
  await fino(t0, 4800);
  f = await foto();
  richiedi("coda, a 4,8 s", f, (x) => x.banner.visibile && x.banner.titolo === "Hysteria", "il banner doveva dire «Hysteria»");
  await fino(t0, 6600);
  f = await foto();
  richiedi("coda, a 6,6 s", f, (x) => uguali(x.colonna, [9, 10, 11, 12]) && !x.urto.length && !x.effetti, "la colonna doveva essere scorsa a [9,10,11,12]");
  await fino(t0, 8600);
  f = await foto();
  richiedi("coda, a 8,6 s", f, (x) => !x.banner.visibile && uguali(x.colonna, [9, 10, 11, 12]), "il banner doveva essere sparito");

  await comando("drumDemo", { fase: "meta" });
  await browser.close();
  if (errori.length) {
    console.error(`Sblocco animato: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok sblocco animato: urto, banner a 1 s, colonna che scorre a 1,8 s, banner via a 4,2 s; ricarica, colonna spenta a metà e due sblocchi di fila");
}

// Cosa c'è nel canvas dell'equalizzatore: pixel visibili, riga più alta con qualcosa, barre lungo la riga in basso, metà alta e metà bassa,
// quanto della riga di mezzo è riempito (l'onda è piena, le barre no), impronta.
const misuraEq = (pagina) =>
  pagina.evaluate(() => {
    const c = document.querySelector("#dr-eq");
    const { data, width, height } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    let pieni = 0;
    let alto = null;
    let sopra = 0;
    let sotto = 0;
    let impronta = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        impronta = (Math.imul(impronta, 31) + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) >>> 0;
        if (data[i + 3] > 40) {
          pieni++;
          if (alto === null) alto = y;
          if (y < height / 2) sopra++;
          else sotto++;
        }
      }
    }
    let barre = 0;
    for (let x = 1, dentro = false; x < width; x++) {
      const visibile = data[((height - 3) * width + x) * 4 + 3] > 200; // il corpo pieno della barra, non il suo alone
      if (visibile && !dentro) barre++;
      dentro = visibile;
    }
    let mezzo = 0;
    for (let x = 14; x < width - 14; x++) if (data[((Math.floor(height / 2)) * width + x) * 4 + 3] > 40) mezzo++;
    return { pieni, alto, sopra, sotto, barre, impronta, mezzo: mezzo / (width - 28), altezza: height };
  });

// L'equalizzatore dal vivo: i livelli audio arrivano da un client WebSocket dello strumento, come dalla regia.
async function provaEq() {
  await preparaStato("meta");
  await comando("drumEq", { stile: "barre", senzaSegnale: true });
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const BANDE = [90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 0, 0];
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws`);
  await new Promise((ok, no) => {
    ws.onopen = ok;
    ws.onerror = () => no(new Error("WebSocket dello strumento non aperto"));
  });
  const manda = async (ms, c = 80) => {
    const fine = Date.now() + ms;
    while (Date.now() < fine) {
      ws.send(JSON.stringify({ tipo: "audio", b: BANDE, c }));
      await attesa(33); // 30 Hz
    }
  };
  const canvas = () => misuraEq(pagina);
  const colpi = () => pagina.evaluate(() => window.__colpi);
  const vuoto = (c) => c.pieni === 0;

  await pagina.goto(`${base}/drum.html?anteprima=1&muto=1`);
  await pagina.evaluate(() => {
    window.__colpi = 0;
    const cornice = document.querySelector(".fm-cornice");
    new MutationObserver(() => {
      if (cornice.classList.contains("colpo")) window.__colpi++;
    }).observe(cornice, { attributes: true, attributeFilter: ["class"] });
  });
  await pagina.evaluate(() => document.fonts?.ready);
  await attesa(600);
  let c = await canvas();
  if (vuoto(c) || c.alto < 60) errori.push(`senza dati: il «respiro» doveva essere basso e visibile (pixel ${c.pieni}, riga più alta ${c.alto})`);

  // 1) il segnale: barre alte e cornice che lampeggia
  await manda(1000);
  c = await canvas();
  if (vuoto(c) || c.alto > 30) errori.push(`con il segnale: le barre dovevano essere alte (pixel ${c.pieni}, riga più alta ${c.alto})`);
  if (c.barre < 30 || c.barre > 40) errori.push(`con il segnale: ${c.barre} barre lungo la riga in basso, attese tra 30 e 40`);
  if ((await colpi()) < 1) errori.push("la cornice non ha mai avuto la classe «colpo»");
  const impronteBarre = c.impronta;
  await attesa(500);
  if (await pagina.evaluate(() => document.querySelector(".fm-cornice").classList.contains("colpo"))) errori.push("la classe «colpo» doveva durare 250 ms, è ancora lì dopo mezzo secondo senza colpi");

  // 2) l'invio si interrompe: dopo 2,5 s torna il respiro, basso
  await attesa(2500);
  c = await canvas();
  if (vuoto(c) || c.alto < 60) errori.push(`dopo 2,5 s senza dati: il «respiro» doveva essere basso e visibile (pixel ${c.pieni}, riga più alta ${c.alto})`);

  // 3) senza «respiro» torna vuoto
  await comando("drumEq", { senzaSegnale: false });
  await attesa(1500);
  c = await canvas();
  if (!vuoto(c)) errori.push(`senzaSegnale spento: il canvas doveva tornare vuoto (${c.pieni} pixel)`);
  await manda(600);
  c = await canvas();
  if (vuoto(c)) errori.push("senzaSegnale spento: con il segnale le barre dovevano tornare");
  await attesa(2800);
  c = await canvas();
  if (!vuoto(c)) errori.push(`senzaSegnale spento: finito il segnale il canvas doveva svuotarsi (${c.pieni} pixel)`);

  // 4) lo stile «onda»: un altro disegno, specchiato
  await comando("drumEq", { senzaSegnale: true, stile: "barre" });
  await attesa(300);
  await manda(1200);
  const barre = await canvas();
  await comando("drumEq", { stile: "onda" });
  await attesa(300);
  await manda(1200);
  const onda = await canvas();
  if (vuoto(onda) || onda.alto > 30) errori.push(`onda: doveva essere alta (pixel ${onda.pieni}, riga più alta ${onda.alto})`);
  if (onda.impronta === barre.impronta || onda.impronta === impronteBarre) errori.push("onda: il disegno doveva cambiare rispetto alle barre");
  if (Math.abs(onda.sopra - onda.sotto) > 0.15 * (onda.sopra + onda.sotto)) errori.push(`onda: doveva essere specchiata (pixel sopra ${onda.sopra}, sotto ${onda.sotto})`);
  if (onda.mezzo < 0.9) errori.push(`onda: doveva essere piena (la riga di mezzo è riempita per il ${Math.round(onda.mezzo * 100)}%, attesa almeno il 90%)`);
  await comando("drumEq", { stile: "barre", senzaSegnale: true });

  // 5) nei mockup (statico) c'è un fotogramma fisso, senza animazione
  const fissa = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  fissa.on("pageerror", (e) => errori.push(`pagina statica: ${e.message}`));
  await fissa.goto(`${base}/drum.html?anteprima=1&statico=1`);
  await fissa.evaluate(() => document.fonts?.ready);
  await attesa(500);
  const misura = () => fissa.evaluate(() => {
    const c = document.querySelector("#dr-eq");
    const { data } = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) n++;
    return n;
  });
  const prima = await misura();
  await attesa(700);
  if (prima === 0) errori.push("mockup: l'equalizzatore doveva avere un fotogramma fisso");
  else if ((await misura()) !== prima) errori.push("mockup: il fotogramma doveva restare fermo");

  ws.close();
  await browser.close();
  if (errori.length) {
    console.error(`Equalizzatore: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok eq: barre alte e cornice che lampeggia con il segnale, «respiro» senza dati, vuoto senza «respiro», onda specchiata, mockup fermo");
}

// Un WAV PCM 16 bit mono a 48 kHz di 6 s: ogni 500 ms un colpo (40 ms di rumore e un tonfo a 80 Hz che si spegne in fretta).
function creaWavColpi() {
  const frequenza = 48000;
  const campioni = frequenza * 6;
  const dati = Buffer.alloc(campioni * 2);
  let seme = 12345;
  const rumore = () => {
    seme = (Math.imul(seme, 1664525) + 1013904223) >>> 0;
    return seme / 2147483648 - 1;
  };
  for (let i = 0; i < campioni; i++) {
    const t = (i / frequenza) % 0.5;
    const tonfo = Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t * 14) * 0.7;
    const fruscio = t < 0.04 ? rumore() * (1 - t / 0.04) * 0.5 : 0;
    dati.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tonfo + fruscio)) * 32767), i * 2);
  }
  const testa = Buffer.alloc(44);
  testa.write("RIFF", 0);
  testa.writeUInt32LE(36 + dati.length, 4);
  testa.write("WAVEfmt ", 8);
  testa.writeUInt32LE(16, 16);
  testa.writeUInt16LE(1, 20); // PCM
  testa.writeUInt16LE(1, 22); // mono
  testa.writeUInt32LE(frequenza, 24);
  testa.writeUInt32LE(frequenza * 2, 28);
  testa.writeUInt16LE(2, 32);
  testa.writeUInt16LE(16, 34);
  testa.write("data", 36);
  testa.writeUInt32LE(dati.length, 40);
  return Buffer.concat([testa, dati]);
}

// L'ascolto dell'audio dalla regia: Chromium con un ingresso finto che suona il WAV dei colpi.
async function provaAudio() {
  const cartella = mkdtempSync(join(tmpdir(), "drum-audio-"));
  const wav = join(cartella, "colpi.wav");
  writeFileSync(wav, creaWavColpi());
  await preparaStato("meta");
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`],
  });
  const contesto = await browser.newContext({ viewport: { width: 1500, height: 2400 }, permissions: ["microphone"] });
  const errori = [];
  const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const drum = await contesto.newPage();
  const regiaPagina = await contesto.newPage();
  drum.on("pageerror", (e) => errori.push(`drum: ${e.message}`));
  regiaPagina.on("pageerror", (e) => errori.push(`regia: ${e.message}`));
  await drum.goto(`${base}/drum.html?anteprima=1&muto=1`);
  await drum.evaluate(() => {
    window.__colpi = 0;
    const cornice = document.querySelector(".fm-cornice");
    new MutationObserver(() => {
      if (cornice.classList.contains("colpo")) window.__colpi++;
    }).observe(cornice, { attributes: true, attributeFilter: ["class"] });
  });
  await regiaPagina.goto(`${base}/regia.html`);
  await attesa(1500);
  const colpi = () => drum.evaluate(() => window.__colpi);
  const livello = async () => Number(await regiaPagina.getAttribute("#dr-audio-livello", "aria-valuenow"));
  const testoBottone = () => regiaPagina.textContent("#dr-audio-avvia");
  // Guarda per `ms` millisecondi: la riga più alta delle barre, i livelli dell'indicatore, quanti colpi.
  const osserva = async (ms) => {
    const prima = await colpi();
    const t0 = Date.now();
    let alto = Infinity;
    const livelli = [];
    while (Date.now() - t0 < ms) {
      const m = await misuraEq(drum);
      if (m.alto !== null) alto = Math.min(alto, m.alto);
      livelli.push(await livello());
      await attesa(80);
    }
    return { alto, livelli, colpi: (await colpi()) - prima };
  };

  // 1) «Ingresso audio» e «Avvia ascolto»
  await regiaPagina.selectOption("#dr-audio-sorgente", "ingresso");
  await regiaPagina.click("#dr-audio-avvia");
  let v = await osserva(3000);
  if (v.alto > 50) errori.push(`con l'ascolto acceso la pagina non ha mai mostrato barre alte (riga più alta ${v.alto})`);
  if (v.colpi < 3) errori.push(`la cornice doveva lampeggiare almeno 3 volte in 3 s, ha lampeggiato ${v.colpi} volte`);
  if (new Set(v.livelli).size < 3 || Math.max(...v.livelli) - Math.min(...v.livelli) < 20) errori.push(`l'indicatore di livello doveva muoversi: ${[...new Set(v.livelli)].slice(0, 12).join(", ")}`);
  if (!/Ferma/.test(await testoBottone())) errori.push(`il bottone doveva dire «Ferma ascolto», dice «${await testoBottone()}»`);

  // 2) la sensibilità conta subito: a metà il livello più alto scende
  const forte = Math.max(...(await osserva(1500)).livelli);
  await regiaPagina.locator("#dr-eq-sens").fill("50");
  await attesa(400);
  const debole = Math.max(...(await osserva(1500)).livelli);
  if (!(debole < forte)) errori.push(`con la sensibilità al 50% il livello più alto doveva scendere (100%: ${forte}, 50%: ${debole})`);
  await regiaPagina.locator("#dr-eq-sens").fill("100");
  await attesa(300);

  // 3) «Ferma»: i messaggi smettono, dopo 2,5 s torna il respiro
  await regiaPagina.click("#dr-audio-avvia");
  if (!/Avvia/.test(await testoBottone())) errori.push(`dopo «Ferma» il bottone doveva dire «Avvia ascolto», dice «${await testoBottone()}»`);
  await attesa(2500);
  const fermi = await colpi();
  const respiro = await misuraEq(drum);
  await attesa(1000);
  if ((await colpi()) !== fermi) errori.push("dopo «Ferma» la cornice lampeggiava ancora");
  if (respiro.pieni === 0 || respiro.alto < 60) errori.push(`dopo «Ferma» la pagina doveva tornare al respiro basso (riga più alta ${respiro.alto}, pixel ${respiro.pieni})`);
  if ((await livello()) !== 0) errori.push("dopo «Ferma» l'indicatore doveva tornare a zero");

  // 4) lo stile, il respiro e la sensibilità vanno al server
  await regiaPagina.selectOption("#dr-eq-stile", "onda");
  await regiaPagina.locator("#dr-eq-idle").uncheck();
  await regiaPagina.locator("#dr-eq-sens").fill("150");
  await attesa(500);
  const eq = (await statoServer()).drum.eq;
  if (eq.stile !== "onda" || eq.senzaSegnale !== false || eq.sensibilita !== 150) errori.push(`i controlli dell'equalizzatore non sono arrivati al server: ${JSON.stringify(eq)}`);
  await comando("drumEq", { stile: "barre", senzaSegnale: true, sensibilita: 100 });
  await attesa(500);

  // 5) «Prova»: lo schema finto di 4 s
  const provaPrima = await colpi();
  await regiaPagina.click("#dr-eq-prova");
  v = await osserva(1500);
  if (v.alto > 50 || (await colpi()) - provaPrima < 1) errori.push(`la «Prova» doveva alzare le barre e far lampeggiare la cornice (riga più alta ${v.alto})`);
  await attesa(7000);
  const dopoProva = await misuraEq(drum);
  if (dopoProva.alto < 60) errori.push(`finita la «Prova» la pagina doveva tornare al respiro basso (riga più alta ${dopoProva.alto})`);

  // 6) l'ingresso scelto si ricorda dopo una ricarica
  const ingressi = await regiaPagina.locator("#dr-audio-ingresso option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  if (ingressi.length) {
    const scelto = ingressi[ingressi.length - 1];
    await regiaPagina.selectOption("#dr-audio-ingresso", scelto);
    const nome = await regiaPagina.locator("#dr-audio-ingresso option:checked").textContent();
    // una pagina nuova, non una ricarica (il browser ripristinerebbe da solo il valore dei campi); gli identificatori dei dispositivi
    // possono cambiare da una pagina all'altra (nelle finestre senza profilo succede): conta il nome
    const nuova = await contesto.newPage();
    nuova.on("pageerror", (e) => errori.push(`regia (nuova): ${e.message}`));
    await nuova.goto(`${base}/regia.html`);
    await attesa(1500);
    const ricordato = await nuova.locator("#dr-audio-ingresso option:checked").textContent();
    if (ricordato !== nome) errori.push(`l'ingresso scelto («${nome}») non è stato ricordato in una pagina nuova (c'è «${ricordato}»)`);
  }

  await browser.close();
  if (errori.length) {
    console.error(`Audio: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok audio: ingresso finto → barre alte, cornice che lampeggia e indicatore che si muove; sensibilità subito; «Ferma» e respiro; controlli al server; «Prova» (${ingressi.length} ingressi elencati)`);
}

// I controlli del Drum nella pagina di regia: ogni passo cambia lo stato del server, che si legge con /api/stato.
async function provaRegiaDrum() {
  await comando("nuovaSerata");
  await comando("drumScaletta", { predefinita: true });
  await comando("layout", { nome: "drum" });
  await comando("widget", { nome: "drumPriorita", visibile: true });
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1500, height: 2400 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`regia: ${e.message}`));
  pagina.on("dialog", (d) => d.accept()); // le conferme («Riparti da ora», «Scaletta predefinita»)
  await pagina.goto(`${base}/regia.html`);
  await pagina.evaluate(() => document.fonts?.ready);
  await new Promise((ok) => setTimeout(ok, 1200));
  const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const eventi = [];
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws`);
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.tipo === "stato") for (const e of msg.eventi ?? []) eventi.push(e.nome);
  };
  await new Promise((ok) => (ws.onopen = ok));
  const drum = async () => (await statoServer()).drum;
  const verifica = async (descrizione, condizione) => {
    try {
      await attendi(descrizione, (st) => condizione(st.drum, st));
    } catch (e) {
      errori.push(`${e.message} (stato: ${JSON.stringify(await drum()).slice(0, 220)}…)`);
    }
  };
  const campo = (id) => pagina.locator(`#${id}`);

  // 1) Like
  let prima = (await drum()).contati;
  await campo("dr-like-1000").click();
  await verifica("«+1.000» fa salire i Like di 1000", (d) => d.contati === prima + 1000);
  prima = (await drum()).contati;
  await campo("dr-like-100").click();
  await verifica("«+100» fa salire i Like di 100", (d) => d.contati === prima + 100);
  await campo("dr-like-imposta").fill("12000");
  await campo("dr-like-imposta-ok").click();
  await verifica("«Imposta» a 12000", (d) => d.contati === 12000);
  await attesa(300);
  if ((await campo("dr-like-grande").textContent()).trim() !== "12.000") errori.push(`il contatore grande dice «${await campo("dr-like-grande").textContent()}», non 12.000`);
  if (!/TikTok non collegato/.test(await campo("dr-like-stato").textContent())) errori.push(`lo stato di TikTok dice «${await campo("dr-like-stato").textContent()}»: senza account doveva dire «TikTok non collegato»`);

  // 2) scaletta: salvarla, un errore, «Suona ora»
  await campo("dr-scaletta").fill("1000 | Uno\n2000 | Due");
  await campo("dr-scaletta-salva").click();
  await verifica("la scaletta di 2 tappe", (d) => d.scaletta.length === 2 && d.scaletta[1].titolo === "Due");
  await campo("dr-scaletta").fill("mille | Uno\n2000 | Due");
  await campo("dr-scaletta-salva").click();
  await attesa(400);
  const messaggi = await pagina.locator("#avvisi .avviso.errore").allTextContents();
  if (!messaggi.some((m) => /Riga 1/.test(m))) errori.push(`una scaletta sbagliata doveva mostrare l'errore con il numero di riga (avvisi: ${JSON.stringify(messaggi)})`);
  if ((await drum()).scaletta.length !== 2) errori.push("una scaletta sbagliata ha cambiato lo stato");
  if ((await campo("dr-scaletta").inputValue()) !== "mille | Uno\n2000 | Due") errori.push("dopo un errore il testo scritto doveva restare nel campo");
  await campo("dr-scaletta-salva").click(); // di nuovo l'errore: nessun danno
  await campo("dr-scaletta").fill("1000 | Uno\n2000 | Due");
  await campo("dr-scaletta-salva").click();
  await attesa(500);
  const righe = await pagina.locator("#dr-scaletta-elenco li").count();
  if (righe !== 2) errori.push(`l'elenco della scaletta doveva avere 2 righe, ne ha ${righe}`);
  // salvata la scaletta, il campo non ha più una bozza: segue lo stato anche se cambia da fuori
  await comando("drumScaletta", { testo: "1000 | Uno\n2000 | Due\n3000 | Tre" });
  await pagina.waitForFunction(() => document.querySelector("#dr-scaletta").value.split("\n").length === 3, null, { timeout: 3000 }).catch(() => errori.push("dopo il salvataggio il campo della scaletta doveva seguire lo stato (una scaletta cambiata da fuori non si è vista)"));
  await comando("drumScaletta", { testo: "1000 | Uno\n2000 | Due" });
  await pagina.waitForFunction(() => document.querySelector("#dr-scaletta").value.split("\n").length === 2, null, { timeout: 3000 }).catch(() => errori.push("il campo della scaletta non è tornato a 2 righe"));
  await pagina.locator("#dr-scaletta-elenco li").nth(1).getByRole("button", { name: /Suona ora/ }).click();
  await verifica("«Suona ora» sulla tappa 2 mette «Due» come brano", (d) => d.brano.titolo === "Due");
  // il campo del titolo segue lo stato (non c'è una bozza): quando lo mostra, la regia ha ricevuto il cambiamento
  await pagina.waitForFunction(() => document.querySelector("#dr-brano-titolo-in").value === "Due", null, { timeout: 3000 }).catch(() => errori.push("dopo «Suona ora» il campo del titolo doveva mostrare «Due»"));

  // 3) brano scritto a mano e tolto
  await campo("dr-brano-titolo-in").fill("Prova Titolo");
  await campo("dr-brano-artista-in").fill("Prova Artista");
  await campo("dr-brano-ok").click();
  await verifica("brano scritto a mano", (d) => d.brano.titolo === "Prova Titolo" && d.brano.artista === "Prova Artista");
  await campo("dr-brano-svuota").click();
  await verifica("brano tolto", (d) => d.brano.titolo === "" && d.brano.artista === "");
  await pagina.waitForFunction(() => document.querySelector("#dr-brano-titolo-in").value === "" && document.querySelector("#dr-brano-artista-in").value === "", null, { timeout: 3000 }).catch(() => errori.push("dopo «Togli il brano» i campi del brano dovevano svuotarsi"));
  // anche se il brano era già vuoto (lo stato non cambia), «Togli il brano» butta la bozza scritta nei campi
  await campo("dr-brano-titolo-in").fill("una bozza");
  await campo("dr-brano-svuota").click();
  await pagina.waitForFunction(() => document.querySelector("#dr-brano-titolo-in").value === "", null, { timeout: 3000 }).catch(() => errori.push("«Togli il brano» doveva buttare anche la bozza scritta nel campo del titolo"));

  // 4) artista ospite, «Dona un…», riempimento
  await campo("dr-ospite-handle").fill("@lince.music");
  await campo("dr-ospite-handle").press("Tab");
  await campo("dr-ospite-icona").selectOption("tiktok");
  await verifica("ospite @lince.music con l'icona TikTok", (d) => d.ospite.handle === "@lince.music" && d.ospite.icona === "tiktok");
  await campo("dr-pri-slot-in").fill("Corolla");
  await campo("dr-pri-slot-in").press("Tab");
  await campo("dr-pri-icona-in").selectOption("corona");
  await verifica("«Dona un» con slot «Corolla» e icona corona", (d) => d.priorita.slot === "Corolla" && d.priorita.icona === "corona");
  await campo("dr-riempimento").selectOption("sabbia");
  await verifica("riempimento a sabbia", (d) => d.riempimento === "sabbia");
  await campo("dr-pri-slot-in").fill("   ");
  await campo("dr-pri-slot-in").press("Tab");
  await attesa(500);
  if ((await drum()).priorita.slot !== "Corolla") errori.push("uno slot vuoto non doveva cambiare lo stato");
  if ((await campo("dr-pri-slot-in").inputValue()) !== "Corolla") errori.push(`dopo un errore il campo dello slot doveva tornare a «Corolla», dice «${await campo("dr-pri-slot-in").inputValue()}»`);

  // 5) richiamo: dal pulsante e con F2
  eventi.length = 0;
  await campo("dr-pri-richiamo").click();
  await attesa(500);
  if (!eventi.includes("richiamoDrum")) errori.push("il pulsante «Richiamo» non ha mandato l'evento richiamoDrum");
  eventi.length = 0;
  await pagina.locator("body").click({ position: { x: 5, y: 5 } });
  await pagina.keyboard.press("F2");
  await attesa(500);
  if (!eventi.includes("richiamoDrum")) errori.push("F2 non ha mandato l'evento richiamoDrum");

  // 6) un campo in uso non si riscrive: i Like cambiano mentre si scrive nel brano e nella scaletta
  await campo("dr-brano-titolo-in").focus();
  await campo("dr-brano-titolo-in").fill("sto scrivendo");
  await campo("dr-scaletta").fill("5000 | Tre");
  await comando("drumLike", { aggiungi: 1 });
  await attesa(500);
  if ((await campo("dr-brano-titolo-in").inputValue()) !== "sto scrivendo") errori.push("il campo del titolo, in uso, è stato riscritto dallo stato");
  if ((await campo("dr-scaletta").inputValue()) !== "5000 | Tre") errori.push("il campo della scaletta, con una modifica non salvata, è stato riscritto dallo stato");
  // ... ma se il brano cambia da fuori (un'altra regia, «Suona ora») la bozza decade e il campo segue lo stato
  await comando("drumBrano", { titolo: "Cambiato da fuori" });
  await attesa(500);
  if ((await campo("dr-brano-titolo-in").inputValue()) !== "Cambiato da fuori") errori.push(`un brano cambiato da fuori doveva riempire il campo del titolo, c'è «${await campo("dr-brano-titolo-in").inputValue()}»`);

  // 7) «Riparti da ora» e «Scaletta predefinita» chiedono conferma: con «Annulla» non cambia niente
  const contatiPrima = (await drum()).contati;
  pagina.removeAllListeners("dialog");
  pagina.once("dialog", (d) => d.dismiss());
  await campo("dr-like-ora").click();
  pagina.once("dialog", (d) => d.dismiss());
  await campo("dr-scaletta-predefinita").click();
  await attesa(500);
  if ((await drum()).contati !== contatiPrima || (await drum()).scaletta.length !== 2) errori.push("rispondendo «Annulla» alle conferme lo stato è cambiato lo stesso");
  pagina.on("dialog", (d) => d.accept());
  await campo("dr-like-ora").click();
  await verifica("«Riparti da ora» azzera i Like", (d) => d.contati === 0);
  await campo("dr-scaletta-predefinita").click();
  await verifica("scaletta predefinita di 37 tappe", (d) => d.scaletta.length === 37);
  await attesa(400);
  if ((await campo("dr-scaletta").inputValue()).split("\n").length !== 37) errori.push("dopo «Scaletta predefinita» il campo doveva mostrare le 37 tappe");

  // il mockup della sezione: Like a metà strada, scaletta con i titoli di prova, ospite
  await comando("drumDemo", { fase: "meta" });
  await comando("drumRiempimento", { stile: "perline" });
  await comando("drumOspite", { etichetta: "Artista ospite", handle: "@lince.music", icona: "instagram" });
  await comando("drumPriorita", { slot: "Rosa", icona: "rosa" });
  await comando("drumBrano", { titolo: "Seven Nation Army", artista: "" });
  await attesa(700);
  const campi = await pagina.evaluate(() => Object.fromEntries(["dr-like-grande", "dr-brano-titolo-in", "dr-ospite-handle", "dr-ospite-icona", "dr-pri-slot-in", "dr-pri-icona-in", "dr-riempimento"].map((id) => [id, document.getElementById(id).value ?? document.getElementById(id).textContent])));
  const attesi = { "dr-brano-titolo-in": "Seven Nation Army", "dr-ospite-handle": "@lince.music", "dr-ospite-icona": "instagram", "dr-pri-slot-in": "Rosa", "dr-pri-icona-in": "rosa", "dr-riempimento": "perline" };
  for (const [id, atteso] of Object.entries(attesi)) if (campi[id] !== atteso) errori.push(`il campo ${id} doveva seguire lo stato («${atteso}»), dice «${campi[id]}»`);
  if (!/11\.400/.test(campi["dr-like-grande"])) errori.push(`il contatore grande doveva dire 11.400, dice «${campi["dr-like-grande"]}»`);
  await (await pagina.$("#dr-regia")).screenshot({ path: join(CARTELLA, "mockup", "regia-drum.jpg"), type: "jpeg", quality: 85 });
  ws.close();
  await browser.close();
  if (errori.length) {
    console.error(`Regia Drum: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok regia-drum: Like, scaletta (con l'errore e «Suona ora»), brano, ospite, «Dona un…», richiamo con F2, riempimento, campi in uso; mockup/regia-drum.jpg");
}

// I titoli di Studio Production e Reaction Release nella pagina di regia.
async function provaRegiaDoppio() {
  await comando("nuovaSerata");
  await comando("produzione", { preset: "cooking" });
  await comando("reaction", { titolo: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: "" } });
  await comando("layout", { nome: "produzione" });
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1500, height: 2400 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`regia: ${e.message}`));
  await pagina.goto(`${base}/regia.html`);
  await pagina.evaluate(() => document.fonts?.ready);
  const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  await attesa(1200);
  const campo = (id) => pagina.locator(`#${id}`);
  const stato = async () => statoServer();
  const entro = async (descrizione, condizione, ms = 600) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (condizione(await stato())) return true;
      await attesa(40);
    }
    errori.push(`${descrizione} non è arrivato in ${ms} ms (stato: ${JSON.stringify((await stato()).produzione.titolo)} / ${JSON.stringify((await stato()).reaction.titolo)})`);
    return false;
  };
  const campoVale = (id, valore) => pagina.waitForFunction(([i, v]) => document.getElementById(i).value === v, [id, valore], { timeout: 3000 }).catch(() => errori.push(`il campo #${id} doveva mostrare «${valore}»`));
  const avvisi = () => pagina.locator("#avvisi .avviso.errore").count();

  // 1) i chip dei preset: mandano il preset, il campo segue lo stato, il preset in onda è evidenziato
  await campo("pr-testo").waitFor();
  await pagina.locator('button[data-preset="mix"]').click();
  await entro("il preset «mix»", (st) => st.produzione.titolo.preset === "mix" && st.produzione.titolo.testo === "Mix & Master", 3000);
  await campoVale("pr-testo", "Mix & Master");
  await campoVale("pr-sotto", "Mix e master in diretta");
  const attivi = await pagina.locator("button[data-preset].attivo").evaluateAll((b) => b.map((x) => x.dataset.preset));
  if (JSON.stringify(attivi) !== '["mix"]') errori.push(`il chip in onda doveva essere solo «mix», sono ${JSON.stringify(attivi)}`);
  await pagina.locator('button[data-preset="cooking"]').click();
  await entro("il preset «cooking»", (st) => st.produzione.titolo.preset === "cooking", 3000);
  await pagina.waitForFunction(() => document.querySelector("button[data-preset].attivo")?.dataset.preset === "cooking", null, { timeout: 3000 }).catch(() => errori.push("il chip evidenziato doveva diventare «cooking»"));

  // 2) si scrive e va in onda: carattere per carattere, il campo non si riscrive, entro 600 ms dall'ultimo tasto lo stato è aggiornato
  await campo("pr-testo").fill("");
  await attesa(400);
  await campo("pr-testo").pressSequentially("Beat live 3", { delay: 30 });
  const ultimoTasto = Date.now();
  if ((await campo("pr-testo").inputValue()) !== "Beat live 3") errori.push(`durante la digitazione il campo è stato riscritto: c'è «${await campo("pr-testo").inputValue()}», doveva restare «Beat live 3»`);
  let arrivato = false;
  while (Date.now() - ultimoTasto < 600 && !arrivato) {
    arrivato = (await stato()).produzione.titolo.testo === "Beat live 3";
    if (!arrivato) await attesa(40);
  }
  if (!arrivato) errori.push(`«Beat live 3» doveva essere in onda entro 600 ms dall'ultimo tasto (c'è «${(await stato()).produzione.titolo.testo}»)`);
  await attesa(500);
  if ((await campo("pr-testo").inputValue()) !== "Beat live 3") errori.push("dopo l'invio il campo è cambiato");

  // 3) il titolo vuoto (mentre lo si riscrive) non si manda e non dà errori; un testo troppo lungo dà l'avviso e torna il valore in onda
  const avvisiPrima = await avvisi();
  await campo("pr-testo").fill("");
  await attesa(500);
  if ((await stato()).produzione.titolo.testo !== "Beat live 3") errori.push("un titolo vuoto non doveva cambiare quello in onda");
  if ((await avvisi()) !== avvisiPrima) errori.push("un titolo vuoto, mentre lo si riscrive, non doveva dare un avviso");
  await campo("pr-testo").fill("x".repeat(29));
  await attesa(500);
  if ((await avvisi()) <= avvisiPrima) errori.push("un testo di 29 caratteri doveva mostrare un avviso");
  if ((await stato()).produzione.titolo.testo !== "Beat live 3") errori.push("un testo di 29 caratteri non doveva cambiare quello in onda");
  await campoVale("pr-testo", "Beat live 3");

  // 4) un cambio da fuori arriva nei campi che non si stanno usando, ma non in quello in uso
  await comando("produzione", { titolo: { sotto: "Da fuori" } });
  await campoVale("pr-sotto", "Da fuori");
  await campo("pr-sopra").focus();
  await campo("pr-sopra").pressSequentially("ab", { delay: 30 });
  await comando("produzione", { titolo: { sopra: "Cambiato da fuori" } });
  await attesa(500);
  if ((await campo("pr-sopra").inputValue()) !== "Backrooms Studio · Liveab" && !(await campo("pr-sopra").inputValue()).endsWith("ab")) errori.push(`il campo in uso (#pr-sopra) è stato riscritto dallo stato: «${await campo("pr-sopra").inputValue()}»`);
  await campo("pr-sopra").fill("Backrooms Studio · Live");
  await attesa(400);

  // 5) reaction: lo stesso, e «Ripristina titolo predefinito»
  await comando("layout", { nome: "reaction" });
  await campo("re-testo").waitFor();
  await campo("re-testo").fill("");
  await attesa(300);
  await campo("re-testo").pressSequentially("Ep. 12 · Lince", { delay: 30 });
  const finito = Date.now();
  let ok = false;
  while (Date.now() - finito < 600 && !ok) {
    ok = (await stato()).reaction.titolo.testo === "Ep. 12 · Lince";
    if (!ok) await attesa(40);
  }
  if (!ok) errori.push(`«Ep. 12 · Lince» doveva essere in onda entro 600 ms (c'è «${(await stato()).reaction.titolo.testo}»)`);
  await campo("re-sotto").fill("Con ospite");
  await entro("la riga sotto della reaction", (st) => st.reaction.titolo.sotto === "Con ospite");
  await campo("re-ripristina").click();
  await entro("il titolo predefinito della reaction", (st) => st.reaction.titolo.testo === "REACTION RELEASE DELLA SETTIMANA" && st.reaction.titolo.sopra === "Ogni giovedì · ore 01:00" && st.reaction.titolo.sotto === "", 3000);
  await campoVale("re-testo", "REACTION RELEASE DELLA SETTIMANA");
  await campo("re-testo").fill("y".repeat(61));
  await attesa(500);
  if ((await stato()).reaction.titolo.testo !== "REACTION RELEASE DELLA SETTIMANA") errori.push("un titolo di 61 caratteri non doveva cambiare quello in onda");
  await campoVale("re-testo", "REACTION RELEASE DELLA SETTIMANA");

  // 6) l'anteprima della reaction: verticale e orizzontale
  const iframe = pagina.locator("#re-regia .sp-anteprima iframe");
  await pagina.locator('#re-regia [data-anteprima-formato="orizzontale"]').click();
  const src = await iframe.getAttribute("src");
  if (!/formato=orizzontale/.test(src) || (await iframe.getAttribute("width")) !== "1920") errori.push(`l'anteprima orizzontale della reaction non è collegata (src ${src})`);
  await pagina.locator('#re-regia [data-anteprima-formato="verticale"]').click();
  if (/formato=orizzontale/.test(await iframe.getAttribute("src"))) errori.push("l'anteprima della reaction non è tornata in verticale");

  await comando("produzione", { preset: "cooking" });
  await browser.close();
  if (errori.length) {
    console.error(`Regia doppio: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok regia-doppio: preset, titolo in onda mentre si scrive (150 ms), errori con avviso, campi in uso, ripristino della reaction e anteprima");
}

// La regia del Back Rooms Podcast: i quattro moduli a comando, le tematiche (elenco, scelta dell'attiva, avanti e indietro, lato),
// gli ospiti e il titolo con la riga dell'episodio, e le scorciatoie F2, F3 e F4.
async function provaRegiaPodcast() {
  const PARTENZA = { titolo: { testo: "Back Rooms Podcast", sotto: "" }, ospiti: [], tematiche: { titolo: "Tematiche di oggi", elenco: [], attiva: 0, lato: "sx" } };
  const ripulisci = async () => {
    await comando("layout", { nome: "podcast" });
    await comando("podcast", PARTENZA);
    for (const [nome, visibile] of [["poTitolo", true], ["poBarra", true], ["poLinea", false], ["poTematiche", false]]) await comando("widget", { nome, visibile });
  };
  await comando("nuovaSerata");
  await ripulisci();
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1500, height: 2400 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`regia: ${e.message}`));
  await pagina.goto(`${base}/regia.html`);
  await pagina.evaluate(() => document.fonts?.ready);
  const attesa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  await attesa(1200);
  const campo = (id) => pagina.locator(`#${id}`);
  const modulo = (nome) => pagina.locator(`button[data-modulo="${nome}"]`);
  const stato = async () => statoServer();
  const entro = async (descrizione, condizione, ms = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (condizione(await stato())) return true;
      await attesa(40);
    }
    const st = await stato();
    errori.push(`${descrizione} non è arrivato in ${ms} ms (podcast: ${JSON.stringify(st.podcast)}, visibili: ${JSON.stringify(Object.fromEntries(["poTitolo", "poBarra", "poLinea", "poTematiche"].map((n) => [n, st.visibili[n]])))})`);
    return false;
  };
  // Gli avvisi di errore restano a schermo 4,5 s: si riconoscono dal testo, non contandoli (uno vecchio può sparire mentre se ne aspetta uno nuovo).
  const tosti = (testo) => pagina.locator("#avvisi .avviso.errore", { hasText: testo }).count();
  const aspettaTosto = async (testo, descrizione) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 2500) {
      if ((await tosti(testo)) > 0) return true;
      await attesa(40);
    }
    errori.push(`${descrizione}: doveva comparire un avviso con «${testo}»`);
    return false;
  };
  const voci = () => pagina.locator("#po-tem-lista li").evaluateAll((li) => li.map((x) => ({ testo: x.querySelector(".po-tem-testo")?.textContent, stato: x.querySelector("button")?.dataset.stato })));
  const vociSono = async (descrizione, attese) => {
    const t0 = Date.now();
    let trovate = [];
    while (Date.now() - t0 < 3000) {
      trovate = await voci();
      if (JSON.stringify(trovate) === JSON.stringify(attese)) return;
      await attesa(40);
    }
    errori.push(`${descrizione}: la lista della regia mostra ${JSON.stringify(trovate)}, doveva mostrare ${JSON.stringify(attese)}`);
  };

  // 1) i quattro moduli a comando: nomi, stato in onda, un clic accende e il secondo spegne
  await modulo("poLinea").waitFor();
  const NOMI = { poLinea: "Linea di divisione", poTematiche: "Pannello Tematiche", poTitolo: "Targa", poBarra: "Fascia social" };
  for (const [nome, etichetta] of Object.entries(NOMI)) {
    const testo = await modulo(nome).textContent();
    if (!testo.includes(etichetta)) errori.push(`il pulsante ${nome} doveva dire «${etichetta}» (dice «${testo.trim()}»)`);
  }
  const premuti = async () => JSON.stringify(await Promise.all(Object.keys(NOMI).map((n) => modulo(n).getAttribute("aria-pressed"))));
  const premutiSono = (attesi, descrizione) =>
    pagina.waitForFunction(([nomi, v]) => JSON.stringify(nomi.map((n) => document.querySelector(`button[data-modulo="${n}"]`).getAttribute("aria-pressed"))) === v, [Object.keys(NOMI), JSON.stringify(attesi)], { timeout: 3000 }).catch(async () => errori.push(`${descrizione}: i pulsanti mostrano ${await premuti()}, dovevano mostrare ${JSON.stringify(attesi)}`));
  // il pulsante segue lo stato in onda: i clic e F4 calcolano il nuovo valore da quello che la regia ha visto, quindi si aspetta che lo mostri
  const modPremuto = (nome, valore) => pagina.waitForFunction(([n, v]) => document.querySelector(`button[data-modulo="${n}"]`).getAttribute("aria-pressed") === v, [nome, String(valore)], { timeout: 3000 }).catch(() => errori.push(`il pulsante ${nome} doveva mostrare ${valore ? "in onda" : "fuori onda"}`));
  await premutiSono(["false", "false", "true", "true"], "all'inizio (linea e tematiche spente, targa e fascia accese)");
  await modulo("poLinea").click();
  await entro("la linea in onda", (st) => st.visibili.poLinea === true);
  await premutiSono(["true", "false", "true", "true"], "con la linea accesa");
  if (!(await modulo("poLinea").evaluate((b) => b.classList.contains("attivo")))) errori.push("il pulsante della linea in onda doveva essere evidenziato");
  await modulo("poLinea").click();
  await entro("la linea spenta al secondo clic", (st) => st.visibili.poLinea === false);
  await premutiSono(["false", "false", "true", "true"], "con la linea di nuovo spenta");
  for (const [nome, prima] of [["poTematiche", false], ["poTitolo", true], ["poBarra", true]]) {
    await modulo(nome).click();
    await entro(`${nome} cambiato`, (st) => st.visibili[nome] === !prima);
    await modPremuto(nome, !prima);
    await modulo(nome).click();
    await entro(`${nome} com'era`, (st) => st.visibili[nome] === prima);
    await modPremuto(nome, prima);
  }

  // 2) tre tematiche scritte una per riga (le righe vuote e gli spazi si saltano) e salvate: l'attiva è la prima; la lista le mostra
  if (!(await campo("po-tem-vuoto").isVisible())) errori.push("senza tematiche la regia doveva dire che non ce ne sono");
  await campo("po-tem-titolo").fill("Argomenti di stasera");
  await campo("po-tem-elenco").fill("Prima\n\nSeconda\n  Terza  \n");
  await campo("po-tem-salva").click();
  await entro("le tre tematiche con la prima attiva", (st) => st.podcast.tematiche.elenco.length === 3 && st.podcast.tematiche.attiva === 0 && st.podcast.tematiche.titolo === "Argomenti di stasera");
  await vociSono("dopo il salvataggio", [{ testo: "Prima", stato: "attiva" }, { testo: "Seconda", stato: "prossima" }, { testo: "Terza", stato: "prossima" }]);
  if (await campo("po-tem-vuoto").isVisible()) errori.push("con delle tematiche la nota «Nessuna tematica» doveva sparire");
  if ((await stato()).podcast.tematiche.elenco.join("|") !== "Prima|Seconda|Terza") errori.push(`le righe vuote e gli spazi dovevano saltarsi (c'è ${JSON.stringify((await stato()).podcast.tematiche.elenco)})`);

  // 3) un clic su una voce la rende attiva, avanti e indietro la spostano, le scorciatoie fanno lo stesso
  await pagina.locator("#po-tem-lista li:nth-child(2) button").click();
  await entro("la seconda tematica attiva", (st) => st.podcast.tematiche.attiva === 1);
  await vociSono("con la seconda attiva", [{ testo: "Prima", stato: "fatta" }, { testo: "Seconda", stato: "attiva" }, { testo: "Terza", stato: "prossima" }]);
  await pagina.keyboard.press("F2");
  await entro("F2: la terza tematica", (st) => st.podcast.tematiche.attiva === 2);
  await pagina.keyboard.press("F3");
  await entro("F3: di nuovo la seconda", (st) => st.podcast.tematiche.attiva === 1);
  await campo("po-tem-avanti").click();
  await entro("«Avanti»: la terza", (st) => st.podcast.tematiche.attiva === 2);
  await campo("po-tem-avanti").click();
  await attesa(300);
  if ((await stato()).podcast.tematiche.attiva !== 2) errori.push("«Avanti» all'ultima tematica non doveva andare oltre");
  await campo("po-tem-indietro").click();
  await entro("«Indietro»: la seconda", (st) => st.podcast.tematiche.attiva === 1);
  const prima = (await stato()).visibili.poTematiche;
  await pagina.keyboard.press("F4");
  await entro("F4: il pannello Tematiche cambia", (st) => st.visibili.poTematiche === !prima);
  await modPremuto("poTematiche", !prima);
  await pagina.keyboard.press("F4");
  await entro("F4 di nuovo: il pannello com'era", (st) => st.visibili.poTematiche === prima);
  await modPremuto("poTematiche", prima);
  // le scorciatoie sono del podcast: con un altro layout in onda non toccano le tematiche
  await comando("layout", { nome: "drum" });
  await attesa(300);
  await pagina.keyboard.press("F3");
  await attesa(400);
  if ((await stato()).podcast.tematiche.attiva !== 1) errori.push("con il Drum in onda F3 non doveva spostare le tematiche del podcast");
  await comando("layout", { nome: "podcast" });
  await attesa(300);

  // 4) il lato del pannello
  await campo("po-tem-lato").selectOption("dx");
  await entro("il pannello a destra", (st) => st.podcast.tematiche.lato === "dx");
  await campo("po-tem-lato").selectOption("sx");
  await entro("il pannello a sinistra", (st) => st.podcast.tematiche.lato === "sx");
  await comando("podcast", { tematiche: { lato: "dx" } }); // un cambio da fuori arriva nella scelta
  await pagina.waitForFunction(() => document.querySelector("#po-tem-lato").value === "dx", null, { timeout: 3000 }).catch(() => errori.push("il lato cambiato da fuori doveva comparire nella scelta"));
  await comando("podcast", { tematiche: { lato: "sx" } });
  await pagina.waitForFunction(() => document.querySelector("#po-tem-lato").value === "sx", null, { timeout: 3000 }).catch(() => errori.push("il lato tornato a sinistra doveva comparire nella scelta"));

  // 5) una nona tematica dà l'avviso e lascia l'elenco com'era (la casella resta com'è scritta); una bozza non si perde se lo stato cambia
  await campo("po-tem-elenco").fill(Array.from({ length: 9 }, (_, i) => `Voce ${i + 1}`).join("\n"));
  await campo("po-tem-salva").click();
  await aspettaTosto("8 voci", "una nona tematica");
  if ((await stato()).podcast.tematiche.elenco.join("|") !== "Prima|Seconda|Terza") errori.push("con una nona tematica l'elenco in onda doveva restare com'era");
  if ((await campo("po-tem-elenco").inputValue()).split("\n").length !== 9) errori.push("dopo l'errore la casella doveva restare com'era scritta");
  await comando("podcastTematica", { avanti: true });
  await attesa(600);
  if ((await campo("po-tem-elenco").inputValue()).split("\n").length !== 9) errori.push("la bozza dell'elenco è stata riscritta dallo stato");
  await campo("po-tem-elenco").fill("Prima\nSeconda\nTerza");
  await campo("po-tem-salva").click();
  await entro("l'elenco salvato di nuovo", (st) => st.podcast.tematiche.elenco.join("|") === "Prima|Seconda|Terza");
  // salvato, i campi tornano a seguire lo stato: un cambio da fuori arriva nel titolo e nell'elenco
  await comando("podcast", { tematiche: { titolo: "Da fuori", elenco: ["Alfa", "Beta"] } });
  await pagina.waitForFunction(() => document.querySelector("#po-tem-titolo").value === "Da fuori" && document.querySelector("#po-tem-elenco").value === "Alfa\nBeta", null, { timeout: 3000 }).catch(() => errori.push("dopo il salvataggio il titolo e l'elenco cambiati da fuori dovevano comparire nei campi"));
  await comando("podcast", { tematiche: { titolo: "Argomenti di stasera", elenco: ["Prima", "Seconda", "Terza"], attiva: 1 } });
  await entro("l'elenco di prima", (st) => st.podcast.tematiche.elenco.join("|") === "Prima|Seconda|Terza" && st.podcast.tematiche.attiva === 1);

  // 6) gli ospiti: si aggiunge, si salva all'uscita dal campo (le righe senza nome non si mandano), si toglie; al massimo quattro
  const righeOspiti = () => pagina.locator("#po-ospiti li");
  await campo("po-ospiti-aggiungi").click();
  await righeOspiti().first().locator('[name="nome"]').fill("Lince");
  await righeOspiti().first().locator('[name="handle"]').fill("@lince.music");
  await righeOspiti().first().locator('[name="handle"]').evaluate((e) => e.blur());
  await entro("l'ospite Lince", (st) => JSON.stringify(st.podcast.ospiti) === JSON.stringify([{ nome: "Lince", handle: "@lince.music", icona: "instagram" }]));
  await campo("po-ospiti-aggiungi").click();
  await righeOspiti().nth(1).locator('[name="handle"]').fill("@solo.handle");
  await righeOspiti().nth(1).locator('[name="handle"]').evaluate((e) => e.blur());
  await attesa(500);
  if ((await tosti(/Ospite/)) > 0) errori.push("una riga di ospite ancora senza nome non doveva dare un avviso");
  if ((await stato()).podcast.ospiti.length !== 1) errori.push("una riga di ospite ancora senza nome non doveva andare in onda");
  await righeOspiti().nth(1).locator('[name="nome"]').fill("Freya");
  await righeOspiti().nth(1).locator('[name="handle"]').fill("@freya");
  await righeOspiti().nth(1).locator('[name="icona"]').selectOption("tiktok");
  await entro("l'ospite Freya con l'icona TikTok", (st) => st.podcast.ospiti.length === 2 && st.podcast.ospiti[1].nome === "Freya" && st.podcast.ospiti[1].icona === "tiktok");
  await righeOspiti().first().locator("button[data-togli]").click();
  await entro("solo Freya dopo aver tolto Lince", (st) => st.podcast.ospiti.length === 1 && st.podcast.ospiti[0].nome === "Freya");
  for (const nome of ["Uno", "Due", "Tre"]) {
    await campo("po-ospiti-aggiungi").click();
    await righeOspiti().last().locator('[name="nome"]').fill(nome);
    await righeOspiti().last().locator('[name="nome"]').evaluate((e) => e.blur());
    await entro(`l'ospite ${nome}`, (st) => st.podcast.ospiti.some((o) => o.nome === nome));
  }
  await pagina.waitForFunction(() => document.querySelector("#po-ospiti-aggiungi").disabled, null, { timeout: 3000 }).catch(() => errori.push("con quattro ospiti «Aggiungi ospite» doveva essere spento"));
  // un cambio da fuori arriva nelle righe (e «Aggiungi ospite» si riaccende)
  await comando("podcast", { ospiti: [{ nome: "Esterno", handle: "@esterno", icona: "youtube" }] });
  await pagina.waitForFunction(() => {
    const righe = [...document.querySelectorAll("#po-ospiti li")];
    return righe.length === 1 && righe[0].querySelector('[name="nome"]').value === "Esterno" && righe[0].querySelector('[name="icona"]').value === "youtube" && !document.querySelector("#po-ospiti-aggiungi").disabled;
  }, null, { timeout: 3000 }).catch(() => errori.push("gli ospiti cambiati da fuori dovevano comparire nelle righe"));

  // 7) il titolo e la riga dell'episodio vanno in onda mentre si scrive (150 ms dopo l'ultimo tasto); un testo troppo lungo dà l'avviso
  await campo("po-testo").fill("");
  await attesa(300);
  await campo("po-testo").pressSequentially("Puntata 7", { delay: 30 });
  const ultimoTasto = Date.now();
  if ((await campo("po-testo").inputValue()) !== "Puntata 7") errori.push(`durante la digitazione il campo del titolo è stato riscritto: «${await campo("po-testo").inputValue()}»`);
  let arrivato = false;
  while (Date.now() - ultimoTasto < 600 && !arrivato) {
    arrivato = (await stato()).podcast.titolo.testo === "Puntata 7";
    if (!arrivato) await attesa(40);
  }
  if (!arrivato) errori.push(`«Puntata 7» doveva essere in onda entro 600 ms dall'ultimo tasto (c'è «${(await stato()).podcast.titolo.testo}»)`);
  await campo("po-sotto").fill("Con ospiti");
  await entro("la riga dell'episodio", (st) => st.podcast.titolo.sotto === "Con ospiti");
  await campo("po-testo").fill("x".repeat(33));
  await aspettaTosto("32 caratteri", "un titolo di 33 caratteri");
  if ((await stato()).podcast.titolo.testo !== "Puntata 7") errori.push("un titolo di 33 caratteri non doveva cambiare quello in onda");
  await pagina.waitForFunction(() => document.querySelector("#po-testo").value === "Puntata 7", null, { timeout: 3000 }).catch(() => errori.push("dopo l'errore il campo del titolo doveva tornare a «Puntata 7»"));

  await pagina.screenshot({ path: join(CARTELLA, "mockup", "regia-podcast.jpg"), type: "jpeg", quality: 88 });
  await ripulisci();
  await browser.close();
  if (errori.length) {
    console.error(`Regia podcast: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok regia-podcast: moduli a comando, tematiche (elenco, scelta, avanti e indietro, lato, errori), ospiti, titolo in onda mentre si scrive e scorciatoie F2/F3/F4, mockup in mockup/regia-podcast.jpg");
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

// Il titolo di Studio Production e di Reaction Release: cosa dice la targa all'avvio (dallo stato di prova).
const TITOLO_ATTESO = {
  produzione: { sopra: "Backrooms Studio · Live", testo: "Cooking Beats", sotto: "Un beat da zero, in diretta", accento: "oro", icona: "#ic-cappello" },
  reaction: { sopra: "Ogni giovedì · ore 01:00", testo: "REACTION RELEASE DELLA SETTIMANA", sotto: null, accento: "magenta", icona: null },
};

const leggiTitolo = (pagina) =>
  pagina.evaluate(() => {
    const el = (sel) => document.querySelector(sel);
    const sotto = el("#fm-titolo-sotto");
    const icona = el("#fm-titolo-icona");
    return {
      sopra: el("#fm-titolo-sopra")?.textContent,
      testo: el("#fm-titolo-testo")?.textContent,
      sotto: sotto && !sotto.hidden && getComputedStyle(sotto).display !== "none" ? sotto.textContent : null,
      accento: el("#fm-titolo")?.dataset.accento,
      icona: icona && !icona.hidden && getComputedStyle(icona).display !== "none" ? icona.querySelector("use")?.getAttribute("href") : null,
    };
  });

async function controllaTitolo(pagina, errori) {
  const trovato = await leggiTitolo(pagina);
  const atteso = TITOLO_ATTESO[layout];
  for (const campo of Object.keys(atteso)) if (trovato[campo] !== atteso[campo]) errori.push(`titolo: ${campo} è «${trovato[campo]}», atteso «${atteso[campo]}»`);
}

// Dal vivo: il titolo cambiato dalla regia compare in meno di 700 ms con un effetto flip breve; il cambio dopo vince.
async function controllaTitoloVivo(browser, dimensioni, url, errori) {
  const pagina = await browser.newPage({ viewport: dimensioni });
  pagina.on("pageerror", (e) => errori.push(`pagina (dal vivo): ${e.message}`));
  await pagina.goto(url.replace("&statico=1", ""));
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(2800); // l'entrata della pagina dura 2,4 s
  if (!(await pagina.$("#fm-titolo-testo"))) {
    errori.push("titolo: nella pagina dal vivo manca #fm-titolo-testo");
    return pagina.close();
  }
  await pagina.evaluate(() => {
    window.__flip = 0;
    const el = document.querySelector("#fm-titolo-testo");
    new MutationObserver(() => {
      if (el.classList.contains("flip")) window.__flip++;
    }).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  const entro = async (descrizione, condizione, ms = 700) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (condizione(await leggiTitolo(pagina))) return;
      await pagina.waitForTimeout(40);
    }
    errori.push(`titolo: ${descrizione} non è comparso entro ${ms} ms (c'è ${JSON.stringify(await leggiTitolo(pagina))})`);
  };
  const cambia = layout === "produzione" ? (titolo) => comando("produzione", { titolo }) : (titolo) => comando("reaction", { titolo });
  if (layout === "produzione") {
    await comando("produzione", { preset: "mix" });
    await entro("il preset «Mix & Master» con l'accento ciano", (t) => t.testo === "Mix & Master" && t.accento === "ciano" && t.icona === "#ic-manopole");
    await comando("produzione", { preset: "sessione" });
    await entro("il preset «Sessione Beat» con l'accento magenta", (t) => t.testo === "Sessione Beat" && t.accento === "magenta" && t.icona === "#ic-cuffie");
    await comando("produzione", { preset: "cooking" });
    await entro("il preset «Cooking Beats» con l'accento oro", (t) => t.testo === "Cooking Beats" && t.accento === "oro");
  }
  await cambia({ testo: "Primo" });
  await pagina.waitForTimeout(80);
  await cambia({ testo: "Secondo" }); // due cambi di fila: vince l'ultimo
  await entro("il titolo «Secondo»", (t) => t.testo === "Secondo");
  await pagina.waitForTimeout(600);
  const dopo = await leggiTitolo(pagina);
  if (dopo.testo !== "Secondo") errori.push(`titolo: dopo due cambi di fila doveva restare «Secondo», c'è «${dopo.testo}»`);
  const flip = await pagina.evaluate(() => ({ volte: window.__flip, durata: parseFloat(getComputedStyle(document.querySelector("#fm-titolo-testo")).animationDuration) * (getComputedStyle(document.querySelector("#fm-titolo-testo")).animationDuration.endsWith("ms") ? 0.001 : 1) }));
  if (flip.volte < 2) errori.push(`titolo: l'effetto flip doveva partire a ogni cambio (partito ${flip.volte} volte)`);
  if (!(flip.durata > 0 && flip.durata <= 0.4)) errori.push(`titolo: l'effetto flip doveva durare al massimo 400 ms (dura ${flip.durata} s)`);
  const luccica = await pagina.evaluate(() => getComputedStyle(document.querySelector("#fm-titolo-testo")).animationName);
  if (!luccica.includes("fm-luccica")) errori.push(`titolo: dopo un cambio lo scintillio del cromo doveva continuare (animazioni: ${luccica})`);
  await cambia({ testo: TITOLO_ATTESO[layout].testo });
  await entro("il titolo di partenza", (t) => t.testo === TITOLO_ATTESO[layout].testo);

  // la dimensione dei testi scelta in regia vale subito (senza cambiare le parole) e si toglie con «Ripristina»
  const corpo = () => pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#fm-titolo-testo")).fontSize));
  await cambia({ testo: "Prova" }); // un titolo corto: il corpo sta al massimo e il 60% si nota
  await entro("il titolo «Prova»", (t) => t.testo === "Prova");
  await pagina.waitForTimeout(300);
  const intero = await corpo();
  await comando("formatoTesti", { formato: layout, valori: { titolo: 60 } });
  await pagina.waitForTimeout(300);
  const piccolo = await corpo();
  if (!(piccolo < intero * 0.8)) errori.push(`titolo: con il testo al 60% il corpo doveva scendere (100%: ${intero} px, 60%: ${piccolo} px)`);
  await comando("formatoTesti", { formato: layout, azzera: true });
  await pagina.waitForTimeout(300);
  if (Math.abs((await corpo()) - intero) > 1) errori.push("titolo: «Ripristina tutti al 100%» doveva riportare il corpo com'era");
  await cambia({ testo: TITOLO_ATTESO[layout].testo });
  await entro("il titolo di partenza", (t) => t.testo === TITOLO_ATTESO[layout].testo);

  // spento da «In onda» la targa esce, riacceso torna
  const widget = layout === "produzione" ? "prTitolo" : "reTitolo";
  const fuori = () => pagina.evaluate(() => document.querySelector("#fm-titolo").classList.contains("fuori"));
  await comando("widget", { nome: widget, visibile: false });
  await pagina.waitForTimeout(300);
  if (!(await fuori())) errori.push("titolo: spento da «In onda» la targa doveva uscire");
  await comando("widget", { nome: widget, visibile: true });
  await pagina.waitForTimeout(300);
  if (await fuori()) errori.push("titolo: riacceso da «In onda» la targa doveva tornare");
  await pagina.close();
}

// Le tre righe della targa del titolo al massimo dei caratteri e con la dimensione dei testi al 200% (Review Focus 4).
async function provaTestiLunghiTitolo() {
  const righe = layout === "produzione" ? { sopra: 32, testo: 28, sotto: 48 } : { sopra: 40, testo: 60, sotto: 60 };
  await preparaStato();
  await comando(layout, { titolo: Object.fromEntries(Object.entries(righe).map(([riga, n]) => [riga, lungo(n)])) });
  await comando("formatoTesti", { formato: layout, valori: { sopra: 200, titolo: 200, sotto: 200 } });
  const orizzontale = formato === "orizzontale";
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: orizzontale ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  await pagina.goto(`${base}/${layout}.html?anteprima=1&statico=1${orizzontale ? "&formato=orizzontale" : ""}`);
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(800);
  if (!(await pagina.$("#fm-titolo")) || !(await pagina.$("#fm-titolo-testo"))) {
    console.error("Testi lunghi: elemento assente: titolo");
    await browser.close();
    process.exit(1);
  }
  const misure = await pagina.evaluate(() => {
    const estensione = (e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      const b = r.getBoundingClientRect();
      return { x: b.x, y: b.y + b.height * 0.12, w: b.width, h: b.height * 0.76 }; // l'inchiostro: senza l'aria sopra e sotto le lettere
    };
    const targa = document.querySelector("#fm-titolo").getBoundingClientRect();
    const linee = ["#fm-titolo-sopra", "#fm-titolo-testo", "#fm-titolo-sotto"].map((sel) => {
      const e = document.querySelector(sel);
      const corpo = parseFloat(getComputedStyle(e).fontSize);
      const scatola = e.getBoundingClientRect();
      return { sel, nascosto: e.hidden, corpo, scatola: { su: scatola.top, giu: scatola.bottom }, largo: e.scrollWidth > e.clientWidth, alto: e.scrollHeight > e.clientHeight + corpo * 0.3, ...estensione(e) };
    });
    return { targa: { x: targa.x, y: targa.y, w: targa.width, h: targa.height }, linee };
  });
  const atteso = GEOMETRIA[layout][formato].titolo.r;
  const t = misure.targa;
  if (atteso.some((v, i) => Math.abs(v - [t.x, t.y, t.w, t.h][i]) > TOLLERANZA)) errori.push(`titolo: con i testi lunghi la targa è [${[t.x, t.y, t.w, t.h].map(Math.round).join(", ")}], attesa [${atteso.join(", ")}]`);
  const visibili = misure.linee.filter((l) => !l.nascosto);
  for (const l of visibili) {
    if (l.largo) errori.push(`${l.sel} (${Math.round(l.corpo)} px): il testo esce dalla riga in larghezza`);
    if (l.alto) errori.push(`${l.sel} (${Math.round(l.corpo)} px): il testo esce dalla riga in altezza`);
    if (l.x < t.x - 1 || l.x + l.w > t.x + t.w + 1 || l.y < t.y - 1 || l.y + l.h > t.y + t.h + 1) errori.push(`${l.sel}: esce dalla targa (testo x ${Math.round(l.x)}…${Math.round(l.x + l.w)}, y ${Math.round(l.y)}…${Math.round(l.y + l.h)})`);
    if (l.y < l.scatola.su - 2 || l.y + l.h > l.scatola.giu + 2) errori.push(`${l.sel} (${Math.round(l.corpo)} px): il testo sporge dalla sua scatola (testo y ${Math.round(l.y)}…${Math.round(l.y + l.h)}, scatola y ${Math.round(l.scatola.su)}…${Math.round(l.scatola.giu)})`);
  }
  for (let i = 0; i < visibili.length; i++) {
    for (let j = i + 1; j < visibili.length; j++) {
      const a = visibili[i];
      const b = visibili[j];
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (dx > 4 && dy > 0.3 * Math.min(a.h, b.h)) errori.push(`${a.sel} e ${b.sel} si sovrappongono`);
    }
  }
  const nome = `${layout}${orizzontale ? "-orizzontale" : ""}-testi-lunghi.jpg`;
  await pagina.screenshot({ path: join(CARTELLA, "mockup", nome), type: "jpeg", quality: 88 });
  await comando("formatoTesti", { formato: layout, azzera: true });
  await preparaStato();
  await browser.close();
  if (errori.length) {
    console.error(`Testi lunghi (${layout}${orizzontale ? ", orizzontale" : ""}): problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok testi lunghi ${layout}${orizzontale ? "/orizzontale" : ""}: le tre righe restano dentro la targa con i testi al 200% (corpi ${visibili.map((l) => `${l.sel.slice(11)} ${Math.round(l.corpo)} px`).join(", ")}), mockup in mockup/${nome}`);
}

// Il podcast: la targa, le tematiche con la loro tappa attiva, gli ospiti sulla fascia.
const leggiPodcast = (pagina) =>
  pagina.evaluate(() => ({
    targa: document.querySelector("#po-targa-testo")?.textContent,
    sotto: (() => {
      const e = document.querySelector("#po-targa-sotto");
      return e && !e.hidden && getComputedStyle(e).display !== "none" ? e.textContent : null;
    })(),
    titoloTematiche: document.querySelector("#po-tematiche-titolo")?.textContent,
    temi: [...document.querySelectorAll("#po-tematiche .po-tema")].map((t) => {
      const icona = t.querySelector(".po-tema-segno svg");
      return { stato: t.dataset.stato, testo: t.querySelector(".po-tema-testo")?.textContent, corpo: parseFloat(getComputedStyle(t.querySelector(".po-tema-testo")).fontSize), y: t.getBoundingClientRect().y, opacita: Number(getComputedStyle(t).opacity), icona: icona && !icona.hasAttribute("hidden") ? icona.querySelector("use").getAttribute("href") : null };
    }),
    cursore: (() => {
      const c = document.querySelector("#po-tematiche .po-cursore");
      return c ? c.getBoundingClientRect().y : null;
    })(),
    fascia: document.querySelector("#sp-nastro")?.textContent ?? "",
  }));

const STATI_TEMI = (attiva, quanti) => Array.from({ length: quanti }, (_, i) => (i < attiva ? "fatta" : i === attiva ? "attiva" : "prossima"));

async function controllaPodcast(pagina, errori) {
  const t = await leggiPodcast(pagina);
  if (t.targa !== "Back Rooms Podcast") errori.push(`targa: «${t.targa}» invece di «Back Rooms Podcast»`);
  if (t.sotto !== "Puntata 12") errori.push(`targa, riga episodio: «${t.sotto}» invece di «Puntata 12»`);
  if (!t.fascia.includes("Lince · @lince.music")) errori.push(`la fascia doveva contenere l'ospite «Lince · @lince.music»: «${t.fascia.replace(/\s+/g, " ").slice(0, 120)}»`);
  if (stato === "completo") {
    if (t.titoloTematiche !== "Tematiche di oggi") errori.push(`pannello Tematiche: intestazione «${t.titoloTematiche}»`);
    const atteso = STATI_TEMI(1, 5);
    if (JSON.stringify(t.temi.map((x) => x.stato)) !== JSON.stringify(atteso)) errori.push(`le tematiche hanno gli stati ${JSON.stringify(t.temi.map((x) => x.stato))}, attesi ${JSON.stringify(atteso)}`);
    if (JSON.stringify(t.temi.map((x) => x.testo)) !== JSON.stringify(TEMATICHE)) errori.push(`i testi delle tematiche sono ${JSON.stringify(t.temi.map((x) => x.testo))}`);
    const ICONA = { fatta: "#ic-spunta", attiva: "#ic-play", prossima: null };
    for (const [i, voce] of t.temi.entries()) {
      if (voce.icona !== ICONA[voce.stato]) errori.push(`tematica ${i + 1} (${voce.stato}): segno ${voce.icona} invece di ${ICONA[voce.stato]}`);
      if (voce.stato === "fatta" ? !(voce.opacita < 0.7) : !(voce.opacita > 0.99)) errori.push(`tematica ${i + 1} (${voce.stato}): opacità ${voce.opacita} (le fatte sono attenuate, le altre no)`);
      if (!(voce.corpo >= 14)) errori.push(`tematica ${i + 1}: il testo è sparito (corpo ${voce.corpo} px)`);
    }
  }
}

// Con `lato: "dx"`: in orizzontale il pannello va a destra (x 1360), in verticale resta al centro.
async function controllaPodcastLato(browser, dimensioni, url, errori) {
  await comando("podcast", { tematiche: { lato: "dx" } });
  const pagina = await browser.newPage({ viewport: dimensioni });
  pagina.on("pageerror", (e) => errori.push(`pagina (lato dx): ${e.message}`));
  await pagina.goto(url);
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(600);
  const r = await pagina.evaluate(() => {
    const b = document.querySelector('[data-parte="tematiche"]').getBoundingClientRect();
    return [b.x, b.y, b.width, b.height];
  });
  const atteso = formato === "orizzontale" ? [1360, 150, 512, 570] : GEOMETRIA.podcast.verticale.tematiche.r;
  if (atteso.some((v, i) => Math.abs(v - r[i]) > TOLLERANZA)) errori.push(`con lato «dx» il pannello Tematiche è [${r.map(Math.round).join(", ")}], atteso [${atteso.join(", ")}]`);
  await pagina.close();
  await comando("podcast", { tematiche: { lato: "sx" } });
}

// Dal vivo: titolo che cambia, tematica attiva che avanza (con il bordo che si sposta), linea e pannello che entrano ed escono.
async function controllaPodcastVivo(browser, dimensioni, url, errori) {
  const pagina = await browser.newPage({ viewport: dimensioni });
  pagina.on("pageerror", (e) => errori.push(`pagina (dal vivo): ${e.message}`));
  await pagina.goto(url.replace("&statico=1", ""));
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(2800);
  const entro = async (descrizione, condizione, ms = 700) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await condizione()) return true;
      await pagina.waitForTimeout(40);
    }
    errori.push(`${descrizione} non è comparso entro ${ms} ms`);
    return false;
  };
  const stati = async () => (await leggiPodcast(pagina)).temi.map((t) => t.stato);
  const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  await comando("podcast", { titolo: { testo: "Puntata 3", sotto: "Con Lince" } });
  await entro("il titolo «Puntata 3» con «Con Lince»", async () => {
    const t = await leggiPodcast(pagina);
    return t.targa === "Puntata 3" && t.sotto === "Con Lince";
  });
  await comando("podcast", { titolo: { testo: "Back Rooms Podcast", sotto: "Puntata 12" } });
  await entro("il titolo di partenza", async () => (await leggiPodcast(pagina)).targa === "Back Rooms Podcast");
  const luccica = await pagina.evaluate(() => getComputedStyle(document.querySelector("#po-targa-testo")).animationName);
  if (!luccica.includes("fm-luccica")) errori.push(`targa: dopo un cambio lo scintillio del cromo doveva continuare (animazioni: ${luccica})`);

  // la targa si spegne e si riaccende con «In onda» (poTitolo)
  const opacita = (sel) => pagina.evaluate((x) => Number(getComputedStyle(document.querySelector(x)).opacity), sel);
  await comando("widget", { nome: "poTitolo", visibile: false });
  await entro("la targa spenta (dissolta)", async () => (await opacita("#po-targa")) < 0.05, 1200);
  await comando("widget", { nome: "poTitolo", visibile: true });
  await entro("la targa riaccesa", async () => (await opacita("#po-targa")) > 0.95, 1200);

  // la dimensione dei testi scelta in regia vale subito (senza cambiare le parole) e si toglie con «Ripristina»
  const corpoTema = () => pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#po-tematiche .po-tema-testo") ?? document.querySelector("#po-targa-testo")).fontSize));
  const corpoTarga = () => pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#po-targa-testo")).fontSize));
  const interoTarga = await corpoTarga();
  await comando("formatoTesti", { formato: "podcast", valori: { targa: 60 } });
  await pagina.waitForTimeout(300);
  const piccoloTarga = await corpoTarga();
  if (!(piccoloTarga < interoTarga * 0.8)) errori.push(`targa: con il testo al 60% il corpo doveva scendere (100%: ${interoTarga} px, 60%: ${piccoloTarga} px)`);
  await comando("formatoTesti", { formato: "podcast", azzera: true });
  await pagina.waitForTimeout(300);
  if (Math.abs((await corpoTarga()) - interoTarga) > 1) errori.push("targa: «Ripristina tutti al 100%» doveva riportare il corpo com'era");

  if (stato === "completo") {
    const interoTema = await corpoTema();
    await comando("formatoTesti", { formato: "podcast", valori: { tematiche: 60 } });
    await pagina.waitForTimeout(300);
    const piccoloTema = await corpoTema();
    if (!(piccoloTema < interoTema * 0.8)) errori.push(`tematiche: con il testo al 60% il corpo doveva scendere (100%: ${interoTema} px, 60%: ${piccoloTema} px)`);
    await comando("formatoTesti", { formato: "podcast", azzera: true });
    await pagina.waitForTimeout(300);
    if (Math.abs((await corpoTema()) - interoTema) > 1) errori.push("tematiche: «Ripristina tutti al 100%» doveva riportare il corpo com'era");

    const y0 = (await leggiPodcast(pagina)).temi;
    const cursore0 = (await leggiPodcast(pagina)).cursore;
    await comando("podcastTematica", { avanti: true });
    await entro("la tematica attiva avanzata", async () => uguali(await stati(), STATI_TEMI(2, 5)));
    await pagina.waitForTimeout(80);
    const durante = (await leggiPodcast(pagina)).cursore;
    if (!(durante > cursore0 + 2 && durante < y0[2].y - 2)) errori.push(`il bordo dorato doveva scorrere da una tematica all'altra (partenza y ${Math.round(cursore0)}, dopo 120 ms y ${Math.round(durante)}, arrivo y ${Math.round(y0[2].y)})`);
    await pagina.waitForTimeout(700); // il bordo si sposta con una transizione
    const dopo = await leggiPodcast(pagina);
    if (dopo.cursore === null || Math.abs(dopo.cursore - dopo.temi[2].y) > 3) errori.push(`il bordo dorato doveva stare sulla tematica attiva (bordo y ${dopo.cursore}, riga y ${dopo.temi[2].y})`);
    if (Math.abs(dopo.temi[2].y - y0[2].y) > 1) errori.push("le righe non dovevano spostarsi quando cambia la tematica attiva");
    await comando("podcastTematica", { indietro: true });
    await entro("la tematica attiva tornata", async () => uguali(await stati(), STATI_TEMI(1, 5)));

    // l'intestazione cambia dal vivo
    await comando("podcast", { tematiche: { titolo: "Altro titolo" } });
    await entro("l'intestazione «Altro titolo»", async () => (await leggiPodcast(pagina)).titoloTematiche === "Altro titolo");
    await comando("podcast", { tematiche: { titolo: "Tematiche di oggi" } });
    await entro("l'intestazione di partenza", async () => (await leggiPodcast(pagina)).titoloTematiche === "Tematiche di oggi");

    // l'elenco cambia dal vivo: meno voci, nessuna voce (sparisce anche il bordo), poi di nuovo le cinque di prima
    await comando("podcast", { tematiche: { elenco: ["Uno", "Due", "Tre"], attiva: 0 } });
    await entro("tre tematiche con la prima attiva", async () => uguali(await stati(), STATI_TEMI(0, 3)));
    const tre = (await leggiPodcast(pagina)).temi.map((x) => x.testo);
    if (!uguali(tre, ["Uno", "Due", "Tre"])) errori.push(`le tematiche dovevano essere «Uno», «Due», «Tre» (c'è ${JSON.stringify(tre)})`);
    await comando("podcast", { tematiche: { elenco: [] } });
    await entro("l'elenco vuoto, senza righe", async () => (await stati()).length === 0);
    if (!(await pagina.evaluate(() => document.querySelector("#po-cursore").hidden))) errori.push("senza tematiche il bordo oro doveva sparire");
    await comando("podcast", { tematiche: { elenco: TEMATICHE, attiva: 1 } });
    await entro("le cinque tematiche di prima", async () => uguali(await stati(), STATI_TEMI(1, 5)));
    await pagina.waitForTimeout(700);

    const nascosto = (sel) => pagina.evaluate((x) => document.querySelector(x).hidden, sel);
    // il pannello si dissolve scorrendo e solo dopo l'uscita è nascosto
    const trasformazione = (sel) => pagina.evaluate((x) => getComputedStyle(document.querySelector(x)).transform, sel);
    await comando("widget", { nome: "poTematiche", visibile: false });
    await pagina.waitForTimeout(250);
    const uscendo = await opacita("#po-tematiche");
    if (await nascosto("#po-tematiche") || !(uscendo > 0.02 && uscendo < 0.98)) errori.push(`il pannello doveva uscire con una dissolvenza (a 250 ms l'opacità è ${uscendo.toFixed(2)}, nascosto: ${await nascosto("#po-tematiche")})`);
    await entro("il pannello Tematiche spento (nascosto dopo l'uscita)", () => nascosto("#po-tematiche"), 1200);
    // le voci cambiate a pannello spento si leggono appena acceso (si misurano a pannello presente, non da nascosto)
    await comando("podcast", { tematiche: { elenco: ["Altra uno", "Altra due", "Altra tre"], attiva: 1 } });
    await comando("widget", { nome: "poTematiche", visibile: true });
    await pagina.waitForTimeout(150);
    const mezzo = await opacita("#po-tematiche");
    if (!(mezzo > 0.02 && mezzo < 0.98)) errori.push(`il pannello doveva entrare con una dissolvenza (a 150 ms l'opacità è ${mezzo.toFixed(2)})`);
    if (["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(await trasformazione("#po-tematiche"))) errori.push("il pannello doveva entrare scorrendo (a 150 ms non è ancora al suo posto)");
    await entro("il pannello Tematiche riacceso", async () => !(await nascosto("#po-tematiche")) && (await opacita("#po-tematiche")) > 0.98, 1200);
    const rimesse = (await leggiPodcast(pagina)).temi;
    if (!uguali(rimesse.map((x) => x.testo), ["Altra uno", "Altra due", "Altra tre"]) || rimesse.some((x) => !(x.corpo >= 14))) errori.push(`le voci cambiate a pannello spento dovevano leggersi appena acceso (${JSON.stringify(rimesse.map((x) => [x.testo, x.corpo]))})`);
    await comando("podcast", { tematiche: { elenco: TEMATICHE, attiva: 1 } });
    await entro("le cinque tematiche di prima", async () => uguali(await stati(), STATI_TEMI(1, 5)));
    await pagina.waitForTimeout(700);
    // spento e riacceso subito: l'uscita di prima non lo deve nascondere, e il bordo non deve scorrere da dove stava
    await comando("widget", { nome: "poTematiche", visibile: false });
    await pagina.waitForTimeout(200);
    await comando("podcastTematica", { indice: 3 });
    await comando("widget", { nome: "poTematiche", visibile: true });
    await pagina.waitForTimeout(100);
    const subito = await leggiPodcast(pagina);
    if (subito.cursore === null || Math.abs(subito.cursore - subito.temi[3].y) > 3) errori.push(`riacceso, il bordo doveva stare già sulla tematica attiva (bordo y ${subito.cursore}, riga y ${subito.temi[3].y})`);
    await pagina.waitForTimeout(1000);
    if (await nascosto("#po-tematiche")) errori.push("il pannello spento e riacceso subito non doveva restare nascosto dall'uscita di prima");
    await comando("podcastTematica", { indice: 1 });

    // la linea si ritira verso il centro, poi è nascosta; riaccesa si disegna dal centro verso gli estremi
    const caselle = () => pagina.evaluate(() => {
      const r = document.querySelector("#po-linea").getBoundingClientRect();
      return { y: r.y, h: r.height };
    });
    const { r: [, yLinea, , altezzaLinea] } = GEOMETRIA.podcast[formato].linea;
    await comando("widget", { nome: "poLinea", visibile: false });
    await pagina.waitForTimeout(250);
    const inUscita = await caselle();
    if (await nascosto("#po-linea") || !(inUscita.h > altezzaLinea * 0.03 && inUscita.h < altezzaLinea * 0.97) || (await opacita("#po-linea")) < 0.9) errori.push(`la linea doveva ritirarsi verso il centro, senza svanire (a 250 ms è alta ${Math.round(inUscita.h)} px su ${altezzaLinea}, opacità ${(await opacita("#po-linea")).toFixed(2)})`);
    await entro("la linea spenta (nascosta dopo che si è ritirata)", () => nascosto("#po-linea"), 1500);
    await comando("widget", { nome: "poLinea", visibile: true });
    await pagina.waitForTimeout(150);
    const mentre = await caselle();
    if (!(mentre.h > altezzaLinea * 0.03 && mentre.h < altezzaLinea * 0.97)) errori.push(`la linea doveva disegnarsi (a 150 ms è alta ${Math.round(mentre.h)} px su ${altezzaLinea})`);
    if (Math.abs(mentre.y + mentre.h / 2 - (yLinea + altezzaLinea / 2)) > 3) errori.push("la linea doveva crescere dal centro verso gli estremi");
    await pagina.waitForTimeout(900);
    const intera = await caselle();
    if (Math.abs(intera.h - altezzaLinea) > 2) errori.push(`la linea riaccesa doveva tornare alta ${altezzaLinea} px (è ${Math.round(intera.h)})`);
    // spenta e riaccesa subito: non deve restare nascosta
    await comando("widget", { nome: "poLinea", visibile: false });
    await pagina.waitForTimeout(200);
    await comando("widget", { nome: "poLinea", visibile: true });
    await pagina.waitForTimeout(1100);
    if (await nascosto("#po-linea")) errori.push("la linea spenta e riaccesa subito non doveva restare nascosta dall'uscita di prima");
  }
  await pagina.close();
}

// Alla prima apertura la pagina mostra tutto già com'è, senza animazioni: LIVE Studio può ricaricare la sorgente in qualsiasi momento.
// Ogni transizione che parte su targa, linea o pannello (e dentro di loro) viene registrata: al primo disegno non ne deve partire nessuna.
async function controllaPodcastPrimoDisegno(browser, dimensioni, url, errori) {
  const pagina = await browser.newPage({ viewport: dimensioni });
  pagina.on("pageerror", (e) => errori.push(`pagina (primo disegno): ${e.message}`));
  await pagina.addInitScript(() => {
    window.__transizioni = [];
    document.addEventListener(
      "transitionrun",
      (e) => {
        const pezzo = e.target.closest?.("#po-targa, #po-linea, #po-tematiche");
        if (pezzo) window.__transizioni.push(`${pezzo.id}:${e.propertyName}`);
      },
      true,
    );
  });
  await pagina.goto(url.replace("&statico=1", ""));
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(1500);
  const m = await pagina.evaluate(() => {
    const el = (sel) => document.querySelector(sel);
    const r = el("#po-linea").getBoundingClientRect();
    const t = el("#po-tematiche");
    return { transizioni: window.__transizioni, pannello: { opacita: Number(getComputedStyle(t).opacity), nascosto: t.hidden, trasformazione: getComputedStyle(t).transform }, linea: { h: r.height, nascosta: el("#po-linea").hidden }, targa: Number(getComputedStyle(el("#po-targa")).opacity) };
  });
  const { r: [, , , altezzaLinea] } = GEOMETRIA.podcast[formato].linea;
  if (m.transizioni.length) errori.push(`primo disegno: niente doveva animarsi alla prima apertura (transizioni partite: ${[...new Set(m.transizioni)].join(", ")})`);
  if (m.targa < 0.98) errori.push(`primo disegno: la targa doveva esserci subito (opacità ${m.targa.toFixed(2)})`);
  if (stato === "completo") {
    if (m.pannello.nascosto || m.pannello.opacita < 0.98 || !["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(m.pannello.trasformazione)) errori.push(`primo disegno: il pannello Tematiche doveva esserci, fermo (opacità ${m.pannello.opacita.toFixed(2)}, ${m.pannello.trasformazione})`);
    if (m.linea.nascosta || Math.abs(m.linea.h - altezzaLinea) > 2) errori.push(`primo disegno: la linea doveva esserci per intero (alta ${Math.round(m.linea.h)} px su ${altezzaLinea})`);
  } else if (!m.pannello.nascosto || !m.linea.nascosta) errori.push("primo disegno: con linea e tematiche spente dovevano essere nascoste subito");
  await pagina.close();
}

// Le righe della targa e le otto tematiche al massimo dei caratteri (la larghezza è il limite) e, in un secondo passaggio, con testi
// cortissimi (il limite è l'altezza della scatola), con i testi al 200%: niente esce dal suo riquadro e niente sparisce.
async function provaTestiLunghiPodcast() {
  await preparaStato();
  await comando("formatoTesti", { formato: "podcast", valori: { targa: 200, tematiche: 200 } });
  const orizzontale = formato === "orizzontale";
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: orizzontale ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 } });
  const errori = [];
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  const nome = `podcast${orizzontale ? "-orizzontale" : ""}-testi-lunghi.jpg`;
  const PASSAGGI = [
    ["testi lunghi", { titolo: { testo: lungo(32), sotto: lungo(48) }, tematiche: { titolo: lungo(32), elenco: Array.from({ length: 8 }, (_, i) => lungo(48 - i)), attiva: 3 } }],
    ["testi corti", { titolo: { testo: "Podcast", sotto: "Ep. 1" }, tematiche: { titolo: "Oggi", elenco: ["Sì", "No", "Forse", "Mah", "Ok", "Ehi", "Bene", "Via"], attiva: 3 } }],
  ];
  for (const [passaggio, dati] of PASSAGGI) {
    await comando("podcast", dati);
    await pagina.goto(`${base}/podcast.html?anteprima=1&statico=1${orizzontale ? "&formato=orizzontale" : ""}`);
    await pagina.evaluate(() => document.fonts?.ready);
    await pagina.waitForTimeout(800);
    const misure = await pagina.evaluate(() => {
      const estensione = (e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        const b = r.getBoundingClientRect();
        return { x: b.x, y: b.y + b.height * 0.12, w: b.width, h: b.height * 0.76 }; // l'inchiostro: senza l'aria sopra e sotto le lettere
      };
      const rect = (sel) => {
        const b = document.querySelector(sel).getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const riga = (el, contenitore) => {
        const corpo = parseFloat(getComputedStyle(el).fontSize);
        const scatola = el.getBoundingClientRect();
        return { nome: el.id || el.className, contenitore, corpo, scatola: { su: scatola.top, giu: scatola.bottom }, largo: el.scrollWidth > el.clientWidth, alto: el.scrollHeight > el.clientHeight + corpo * 0.3, ...estensione(el) };
      };
      const targa = ["#po-targa-testo", "#po-targa-sotto"].map((sel) => riga(document.querySelector(sel), "targa"));
      const pannello = [document.querySelector("#po-tematiche-titolo"), ...document.querySelectorAll("#po-tematiche .po-tema-testo")].map((e) => riga(e, "tematiche"));
      return { rettangoli: { targa: rect("#po-targa"), tematiche: rect("#po-tematiche") }, righe: [...targa, ...pannello] };
    });
    const errore = (testo) => errori.push(`${passaggio}: ${testo}`);
    for (const chiave of ["targa", "tematiche"]) {
      const attesi = GEOMETRIA.podcast[formato][chiave].r;
      const r = misure.rettangoli[chiave];
      if (attesi.some((v, i) => Math.abs(v - [r.x, r.y, r.w, r.h][i]) > TOLLERANZA)) errore(`${chiave}: è [${[r.x, r.y, r.w, r.h].map(Math.round).join(", ")}], atteso [${attesi.join(", ")}]`);
    }
    for (const l of misure.righe) {
      const dentro = misure.rettangoli[l.contenitore];
      if (!(l.corpo >= 12) || !(l.w > 8)) errore(`${l.nome}: il testo è sparito (corpo ${Math.round(l.corpo)} px, largo ${Math.round(l.w)} px)`);
      if (l.largo) errore(`${l.nome} (${Math.round(l.corpo)} px): il testo esce dalla riga in larghezza`);
      if (l.alto) errore(`${l.nome} (${Math.round(l.corpo)} px): il testo esce dalla riga in altezza`);
      if (l.x < dentro.x - 1 || l.x + l.w > dentro.x + dentro.w + 1 || l.y < dentro.y - 1 || l.y + l.h > dentro.y + dentro.h + 1) errore(`${l.nome}: esce da ${l.contenitore}`);
      if (l.y < l.scatola.su - 2 || l.y + l.h > l.scatola.giu + 2) errore(`${l.nome} (${Math.round(l.corpo)} px): il testo sporge dalla sua scatola`);
    }
    for (const gruppo of ["targa", "tematiche"]) {
      const righe = misure.righe.filter((l) => l.contenitore === gruppo);
      for (let i = 0; i < righe.length; i++) {
        for (let j = i + 1; j < righe.length; j++) {
          const a = righe[i];
          const b = righe[j];
          const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          if (dx > 4 && dy > 0.3 * Math.min(a.h, b.h)) errore(`${a.nome} e ${b.nome} si sovrappongono`);
        }
      }
    }
    if (passaggio === "testi lunghi") await pagina.screenshot({ path: join(CARTELLA, "mockup", nome), type: "jpeg", quality: 88 });
  }
  await comando("formatoTesti", { formato: "podcast", azzera: true });
  await preparaStato();
  await browser.close();
  if (errori.length) {
    console.error(`Testi lunghi (podcast${orizzontale ? ", orizzontale" : ""}): problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok testi lunghi podcast${orizzontale ? "/orizzontale" : ""}: con i testi al 200% targa e otto tematiche restano nei loro riquadri e leggibili, lunghissimi e cortissimi, mockup in mockup/${nome}`);
}

async function main() {
  if (clessidra) return provaClessidra();
  if (sbloccoAnimato) return provaSbloccoAnimato();
  if (equalizzatore) return provaEq();
  if (audio) return provaAudio();
  if (regiaDrum) return provaRegiaDrum();
  if (regiaDoppio) return provaRegiaDoppio();
  if (regiaPodcast) return provaRegiaPodcast();
  if (testiLunghi) return layout === "drum" ? provaTestiLunghi() : layout === "podcast" ? provaTestiLunghiPodcast() : provaTestiLunghiTitolo();
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
  if (layout === "produzione" || layout === "reaction") await controllaTitolo(pagina, errori);
  if (layout === "podcast") await controllaPodcast(pagina, errori);
  await pagina.close();
  await controllaFasciaViva(browser, dimensioni, url, errori);
  if (layout === "produzione" || layout === "reaction") await controllaTitoloVivo(browser, dimensioni, url, errori);
  if (layout === "podcast") {
    if (stato === "completo") await controllaPodcastLato(browser, dimensioni, url, errori);
    await controllaPodcastPrimoDisegno(browser, dimensioni, url, errori);
    await controllaPodcastVivo(browser, dimensioni, url, errori);
  }
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
