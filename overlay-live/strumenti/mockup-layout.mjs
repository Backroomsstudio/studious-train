// Mockup e controllo di geometria dei layout verticali con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-layout.mjs --base http://127.0.0.1:4799 --layout gara [--stato <stato>] [--guida] [--controlli]
//   layout: gara (premio, classifica, timer, tabellone con il blocco voti, barra «Vota in chat»);
//   stati: base (la serata demo), ultimi-minuti (timer rosso e, appena arrivata, la notifica «Nuovo primo posto!») e il tabellone
//   ad albero: albero (16 tracce con titoli e artisti lunghi) e albero-6 (6 tracce con nomi brevi). L'albero sta sopra a tutto il
//   resto: si controlla che stia in x 116…964 e y 282…1196 e che nessun testo sia tagliato (nomi lunghi: ridotti e poi i puntini).
// Mette il server nel layout con i dati di prova, apre la pagina (1080×1920, ?anteprima=1&statico=1), controlla che ogni pezzo
// stia dove dice la tabella (±1 px, e dentro x 116…964 / y 230…1200 per i pezzi che lo dichiarano), che nessun pezzo ne copra
// un altro, e salva mockup/<nome>.jpg (gara base: mockup/verticale.jpg; gara ultimi-minuti: mockup/ultimi-minuti.jpg).
// Esce con codice 1 e l'elenco dei problemi.
//   --controlli: i testi della gara con dati brevi e poi lunghi (titolo da 60 caratteri, artista da 40, nomi lunghi in classifica,
//   giudici e voci con i nomi più lunghi). Ogni testo (1) sta nel riquadro del suo pezzo; (2) se non entra nemmeno al corpo minimo
//   finisce con i puntini, mai con lettere tagliate a metà: si confrontano i pixel con e senza `overflow: hidden`, perché
//   discendenti e accenti che sporgono sparirebbero senza che nessuna misura se ne accorga; (3) con testi brevi sta al corpo
//   massimo, cioè la riga è abbastanza alta per il corpo di partenza. I corpi sono quelli di CORPI in public/js/overlay.js
//   (test/geometria.test.mjs li confronta). Salva mockup/gara-testi-lunghi.jpg.
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
      notifica: p(564, 604, 400, 92, true), // solo mentre c'è (stato ultimi-minuti); è alta almeno 92
      tabellone: p(116, 858, 848, 260, true),
      chat: p(116, 1130, 848, 66, true), // il fondo, y 1196, sta appena sopra i commenti di TikTok (1200)
      goal: p(564, 712, 400, 120, true), // il Goal (public/js/goal-logica.js): nel vuoto sotto timer e notifica
      albero: p(116, 282, 848, 914, true), // il tabellone ad albero: dal premio al fondo della barra, sopra a tutto (solo stati albero)
    },
  },
  senzaPremio: {
    verticale: {
      banner: p(116, 284, 848, 330, true),
      goal: p(116, 650, 400, 120, true), // sul bordo alto della camera (un buco della pagina), sotto il banner
      scheda: p(116, 1064, 848, 190), // sale da dietro la barra: finisce a 1254, sotto il mento di chi parla
      barra: p(0, 1266, 1080, 92),
    },
  },
};

// Come si trova ogni pezzo nella pagina: un selettore proprio, altrimenti il suo data-parte.
const SELETTORI = { senzaPremio: { banner: ".sp-banner", scheda: "#sp-scheda", barra: ".sp-barra", goal: ".gl" }, gara: { premio: ".premio", classifica: ".classifica", timer: ".timer", notifica: ".notifica", tabellone: ".tabellone", chat: ".chat-cta", goal: ".gl", albero: "#albero" } };
const PAGINE = { gara: "overlay.html", senzaPremio: "senza-premio.html" };
const SCHEDE = ["standard", "skip", "superskip", "throne", "studio"]; // --layout senzaPremio --scheda <tipo>
// Per ogni layout e stato: i pezzi che devono esserci (e non essere nascosti). Negli ultimi minuti la barra «Vota in chat» è chiusa
// (la conferma chiude il voto) e quindi spenta: la notifica del nuovo primo posto prende il suo posto tra i pezzi da controllare.
const PRESENTI = {
  senzaPremio: {
    base: ["banner", "barra", "goal"],
    standard: ["banner", "scheda", "barra", "goal"],
    skip: ["banner", "scheda", "barra", "goal"],
    superskip: ["banner", "scheda", "barra", "goal"],
    throne: ["banner", "scheda", "barra", "goal"],
    studio: ["banner", "scheda", "barra", "goal"],
  },
  gara: {
    base: ["premio", "classifica", "timer", "tabellone", "chat", "goal"],
    "ultimi-minuti": ["premio", "classifica", "timer", "tabellone", "notifica", "goal"],
    // la traccia in ascolto ha un Instagram: sta sulla riga dell'artista, dentro il tabellone
    instagram: ["premio", "classifica", "timer", "tabellone", "chat", "goal"],
    // con l'albero acceso gli altri pezzi ci sono ancora ma coperti: si guarda solo lui
    albero: ["albero"],
    "albero-6": ["albero"],
  },
};
const STATO_PREDEFINITO = { gara: "base", senzaPremio: "base" };
const NOMI_FILE = { senzaPremio: { base: "senza-premio", standard: "senza-premio-gratis", skip: "senza-premio-skip", superskip: "senza-premio-superskip", throne: "senza-premio-throne", studio: "senza-premio-spot" }, gara: { base: "verticale", "ultimi-minuti": "ultimi-minuti", instagram: "gara-instagram", albero: "gara-albero", "albero-6": "gara-albero-6" } };

// I testi che la pagina della gara adatta al riquadro: il selettore, il pezzo in cui stanno, il corpo di partenza (massimo) e il
// più piccolo accettabile (minimo). La chiave è quella di CORPI in public/js/overlay.js.
export const CORPI_GARA = {
  titolo: { selettore: "#t-titolo", pezzo: "tabellone", base: 52, minimo: 24 },
  artista: { selettore: "#t-artista", pezzo: "tabellone", base: 32, minimo: 18 },
  categoria: { selettore: ".cat-nome", pezzo: "tabellone", base: 26, minimo: 14 },
  giudice: { selettore: ".cat-giudice", pezzo: "tabellone", base: 24, minimo: 12 },
  rigaTraccia: { selettore: ".cl-traccia-testo", pezzo: "classifica", base: 32, minimo: 18 },
  rigaArtista: { selettore: ".cl-artista", pezzo: "classifica", base: 22, minimo: 14 },
  etichettaTimer: { selettore: ".timer-etichetta", pezzo: "timer", base: 22, minimo: 12 },
  instagram: { selettore: "#t-ig-testo", pezzo: "tabellone", base: 24, minimo: 14 },
};
// Testi che non si adattano (corpo fisso) ma devono comunque restare nel riquadro e senza lettere tagliate.
const TESTI_FISSI_GARA = [
  { selettore: ".cl-punti", pezzo: "classifica" },
  { selettore: ".cat-valore", pezzo: "tabellone" },
  { selettore: ".cta-testo", pezzo: "chat" },
];
// I testi del tabellone ad albero: il corpo minimo è quello di public/js/albero.js (poi i puntini).
const TESTI_ALBERO = [
  { selettore: ".alb-titolo", pezzo: "albero", minimo: 11 },
  { selettore: ".alb-artista", pezzo: "albero", minimo: 10 },
  { selettore: ".alb-nome-turno", pezzo: "albero", minimo: 9 },
  { selettore: ".alb-campione-titolo", pezzo: "albero", minimo: 11 },
  { selettore: ".alb-punti", pezzo: "albero" },
  { selettore: ".alb-campione-punti", pezzo: "albero" },
];
const STATI_ALBERO = { albero: { tracce: 16, lunghi: true }, "albero-6": { tracce: 6, lunghi: false } };

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
const stato = opzione("scheda", opzione("stato", STATO_PREDEFINITO[layout]));
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

const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));
const selettore = (chiave) => SELETTORI[layout]?.[chiave] ?? `[data-parte="${chiave}"]`;
const apriPagina = async (browser, parametri = "") => {
  const pagina = await browser.newPage({ viewport: VISTA });
  pagina.on("pageerror", (e) => console.error(`pagina: ${e.message}`));
  await pagina.goto(`${base}/${PAGINE[layout]}?anteprima=1&statico=1${guida ? "&guide=1" : ""}${parametri}`);
  await pagina.evaluate(() => document.fonts?.ready);
  await attendi(700);
  return pagina;
};

// Dati di prova dello stato scelto, come li mostrerebbe la regia.
async function preparaStato() {
  await comando("layout", { nome: layout });
  if (layout === "gara" && STATI_ALBERO[stato]) {
    await comando("nuovaSerata");
    await confermaRisultati(STATI_ALBERO[stato].tracce, STATI_ALBERO[stato].lunghi);
    await comando("albero", { mostra: true, durataSecondi: 0 }); // resta acceso finché la pagina non l'ha fotografato
    return;
  }
  if (layout === "gara") await comando("demo"); // classifica, traccia con voti, voto della chat aperto e countdown
  if (layout === "gara" && stato === "ultimi-minuti") await comando("countdown", { azione: "avvia", minuti: 4 }); // timer rosso
  if (layout === "gara" && stato === "instagram") await comando("correggiTraccia", { instagram: "https://instagram.com/lince.music/" });
}

// Un nuovo primo in classifica mentre la pagina è aperta: dopo il ritardo della classifica compare la notifica.
async function nuovoPrimo() {
  await comando("traccia", { titolo: "Cielo Rosso", artista: "Vale B" });
  for (const categoria of ["beat", "voce", "mix"]) await comando("voto", { categoria, valore: 10 });
  await comando("conferma");
  await attendi(1700 + 900); // RITARDO_CLASSIFICA_MS della pagina, poi la notifica è in vista per 6 s
}

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
// a lettera non si vedrebbe fuori dalla scatola). Ritorna le righe tagliate. Le righe che finiscono con i puntini (non entrano
// nemmeno al corpo minimo) si saltano: lì il testo che sporge è proprio quello che i puntini nascondono (le giudica `controllaTesti`).
async function inchiostroTagliato(pagina, selettori) {
  const tagliate = [];
  // Le cifre del countdown cambiano ogni secondo e starebbero nella zona fotografata accanto all'etichetta: si nascondono per la misura.
  const stileTimer = await pagina.addStyleTag({ content: ".timer *:not(.timer-etichetta) { visibility: hidden !important; }" });
  const vista = pagina.viewportSize();
  for (const sel of selettori) {
    const luoghi = await pagina.locator(sel).all();
    for (const [indice, luogo] of luoghi.entries()) {
      const box = await luogo.boundingBox();
      const testo = ((await luogo.textContent()) ?? "").trim();
      if (!box || box.width < 1 || box.height < 1 || !testo) continue;
      if (await luogo.evaluate((e) => e.scrollWidth > e.clientWidth + 1)) continue;
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
  await stileTimer.evaluate((e) => e.remove());
  return tagliate;
}
const descriviTagliate = (tagliate, contesto) => tagliate.map((t) => `${t.sel}${t.indice ? `[${t.indice}]` : ""} («${t.testo}…», ${Math.round(t.corpo)} px, ${contesto}): le lettere sporgono dalla riga e vengono tagliate (${t.pixel} pixel)`);

// ----- Testi della gara (--controlli) -----

// Un testo di prova lungo `n` caratteri, con gli spazi di una frase vera (che va a capo) e senza spazio alla fine.
const lungo = (n) => "Lunghissimo titolo di prova con tante parole per la riga ".repeat(3).slice(0, n).trimEnd().padEnd(n, "x");

// `n` tracce confermate una dopo l'altra, con il totale che scende (la prima è la prima in classifica), con nomi brevi o al
// massimo permesso (titolo da 60 caratteri, artista da 40).
const NOMI_BREVI = ["Notte", "Alba", "Neon", "Blu", "Oro", "Luna", "Sole", "Mare", "Vento", "Fuoco", "Terra", "Cielo", "Nebbia", "Onda", "Pietra", "Brace"];
const ARTISTI_BREVI = ["Lince", "Mira", "Dama", "Nove", "Rizzo", "Vale B", "Kappa", "Sole Nero", "Fra", "Lia", "Dino", "Ivo", "Zeta", "Ugo", "Gea", "Tom"];
async function confermaRisultati(n, lunghi) {
  for (let i = 0; i < n; i++) {
    await comando("traccia", lunghi ? { titolo: `${i + 1} ${lungo(58)}`, artista: lungo(40) } : { titolo: NOMI_BREVI[i % NOMI_BREVI.length], artista: ARTISTI_BREVI[i % ARTISTI_BREVI.length] });
    for (const categoria of ["beat", "voce", "mix"]) await comando("voto", { categoria, valore: Math.round((10 - i * 0.35) * 100) / 100 });
    await comando("conferma");
  }
}

const PASSATE_GARA = [
  { nome: "testi brevi", lunghi: false },
  { nome: "testi lunghi", lunghi: true },
];

// Cinque risultati in classifica, la traccia in ascolto, i giudici e le quattro voci con testi brevi o al massimo permesso.
async function preparaTestiGara(lunghi) {
  await comando("nuovaSerata");
  await comando("layout", { nome: "gara" });
  await comando("countdown", { azione: "avvia", minuti: 180 }); // senza countdown il timer è spento (e spostato)
  await comando("votazione", { min: 4, max: 10, etichette: lunghi ? { beat: "Strumentale", voce: "Voce solista", mix: "Mix e master", chat: "Chat TikTok" } : { beat: "Beat", voce: "Voce", mix: "Mix", chat: "Chat" } });
  await comando("giudici", lunghi ? { beat: lungo(40), voce: lungo(40), mix: lungo(40) } : { beat: "Dan", voce: "Lu", mix: "Mia" });
  await confermaRisultati(5, lunghi);
  await comando("traccia", { titolo: lunghi ? lungo(60) : "Sole", artista: lunghi ? lungo(40) : "Lince", tier: "throne" });
  await comando("correggiTraccia", { instagram: lunghi ? "lunghissimo.handle.instagram.x" : "lince.music" }); // 30 caratteri: il massimo
  for (const [categoria, valore] of [["beat", 8.5], ["voce", 7.5], ["mix", 9]]) await comando("voto", { categoria, valore });
  await comando("apriChat", { secondi: 60 });
  await comando("simulaChat", { quanti: lunghi ? 137 : 7 });
}

// Misure di ogni riga di testo dei selettori dati (solo quelle con del testo e visibili).
const misureRighe = (pagina, selettori) =>
  pagina.evaluate((elenco) => {
    const trovate = [];
    for (const sel of elenco) {
      document.querySelectorAll(sel).forEach((e, indice) => {
        const testo = (e.textContent ?? "").trim();
        const r = e.getBoundingClientRect();
        if (!testo || r.width < 1 || r.height < 1) return;
        const cs = getComputedStyle(e);
        trovate.push({ sel, indice, testo: testo.slice(0, 24), x: r.x, y: r.y, w: r.width, h: r.height, corpo: parseFloat(cs.fontSize), troncato: e.scrollWidth > e.clientWidth + 1, puntini: cs.textOverflow === "ellipsis" });
      });
    }
    return trovate;
  }, selettori);

async function controllaTesti(pagina, righe, passata, errori) {
  const tabella = GEOMETRIA.gara.verticale;
  const misure = await misureRighe(pagina, righe.map((r) => r.selettore));
  const nome = (m) => `${m.sel}${m.indice ? `[${m.indice}]` : ""} («${m.testo}…», ${m.corpo.toFixed(1)} px, ${passata.nome})`;
  for (const riga of righe) {
    const pezzo = tabella[riga.pezzo].r;
    for (const m of misure.filter((x) => x.sel === riga.selettore)) {
      // 1. dentro il riquadro del suo pezzo
      if (m.x < pezzo[0] - TOLLERANZA || m.y < pezzo[1] - TOLLERANZA || m.x + m.w > pezzo[0] + pezzo[2] + TOLLERANZA || m.y + m.h > pezzo[1] + pezzo[3] + TOLLERANZA) {
        errori.push(`${nome(m)}: esce dal riquadro «${riga.pezzo}» [${pezzo.join(", ")}] (sta in [${[m.x, m.y, m.w, m.h].map(Math.round).join(", ")}])`);
      }
      // 2. se non entra va ridotto al minimo e chiuso con i puntini
      if (m.troncato) {
        if (riga.minimo === undefined) errori.push(`${nome(m)}: il testo sporge dalla riga e il suo corpo non si adatta`);
        else if (m.corpo > riga.minimo + 0.5) errori.push(`${nome(m)}: non entra ma il corpo non è sceso al minimo (${riga.minimo} px)`);
        else if (!m.puntini) errori.push(`${nome(m)}: non entra nemmeno al minimo e non finisce con i puntini`);
      }
      // 3. con testi brevi sta al corpo massimo; con testi lunghi mai sotto il minimo
      if (riga.base !== undefined) {
        if (!passata.lunghi && m.corpo < riga.base - 0.5) errori.push(`${nome(m)}: con testi brevi il corpo è sceso sotto il massimo (${riga.base} px): la riga è troppo bassa o stretta`);
        if (m.corpo < riga.minimo - 0.5) errori.push(`${nome(m)}: sotto il corpo minimo (${riga.minimo} px)`);
      }
    }
    if (!misure.some((x) => x.sel === riga.selettore)) errori.push(`${riga.selettore}: nessun testo da misurare (${passata.nome})`);
  }
  errori.push(...descriviTagliate(await inchiostroTagliato(pagina, righe.map((r) => r.selettore)), passata.nome));
}

async function provaControlli() {
  if (layout !== "gara") {
    console.error(`--controlli: per ora solo il layout gara (non ${layout})`);
    process.exit(2);
  }
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errori = [];
  for (const passata of PASSATE_GARA) {
    await preparaTestiGara(passata.lunghi);
    const pagina = await apriPagina(browser);
    await controllaTesti(pagina, [...Object.values(CORPI_GARA), ...TESTI_FISSI_GARA], passata, errori);
    if (passata.lunghi) await pagina.screenshot({ path: join(CARTELLA, "mockup", "gara-testi-lunghi.jpg"), type: "jpeg", quality: 88 });
    await pagina.close();
  }
  await browser.close();
  if (errori.length) {
    console.error(`Problemi nei testi della gara:\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok testi della gara: dentro i loro riquadri, ridotti al minimo e poi con i puntini, nessuna lettera tagliata; mockup in mockup/gara-testi-lunghi.jpg");
}

// ----- Regia del Goal (--regia-goal) -----
// Apre la regia, scrive obiettivi, follower di adesso e posizione, preme «Mostra ora» e controlla cosa è andato in onda (stato del
// server e pagina del layout). Salva mockup/regia-goal.jpg.
async function provaRegiaGoal() {
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errori = [];
  const stato = async () => (await fetch(`${base}/api/stato`).then((r) => r.json())).dati ?? (await fetch(`${base}/api/stato`).then((r) => r.json()));
  const pagina = await browser.newPage({ viewport: { width: 1100, height: 2600 } });
  await pagina.goto(`${base}/regia.html`);
  await pagina.waitForSelector("#goal-regia");
  const campo = (form, nome) => pagina.locator(`${form} [name="${nome}"]`);
  const scrivi = async (form, nome, valore) => {
    await campo(form, nome).fill(String(valore));
  };
  await scrivi("#f-goal", "like-obiettivo", 20000);
  await scrivi("#f-goal", "like-passo", 2000);
  await scrivi("#f-goal", "follower-obiettivo", 100);
  await pagina.click("#f-goal button");
  await pagina.waitForTimeout(300);
  await scrivi("#f-goal-follower", "totale", 87);
  await pagina.click("#f-goal-follower button:not([data-aggiungi])");
  await pagina.waitForTimeout(300);
  await pagina.click("#f-goal-follower [data-aggiungi=\"10\"]");
  await pagina.waitForTimeout(300);
  await pagina.selectOption("#goal-layout", "gara");
  await scrivi("#f-goal-posizione", "x", 300);
  await scrivi("#f-goal-posizione", "y", 720);
  await pagina.click("#f-goal-posizione button");
  await pagina.waitForTimeout(300);
  await pagina.click("[data-muovi=\"8,0\"]");
  await pagina.waitForTimeout(300);
  let s = await (await fetch(`${base}/api/stato`)).json();
  s = s.dati ?? s;
  const g = s.goal;
  const dice = (cosa, vero) => vero || errori.push(cosa);
  dice(`obiettivi: ${JSON.stringify([g.like.obiettivo, g.like.passo, g.follower.obiettivo])}, attesi [20000, 2000, 100]`, g.like.obiettivo === 20000 && g.like.passo === 2000 && g.follower.obiettivo === 100);
  dice(`follower di adesso: ${g.follower.totale}, atteso 97 (87 + 10)`, g.follower.totale === 97);
  dice(`posizione della gara: ${JSON.stringify(g.posizioni.gara)}, attesa x 308 (300 + 8) e y 720`, g.posizioni.gara?.x === 308 && g.posizioni.gara?.y === 720);
  const anteprima = await pagina.textContent("#goal-anteprima");
  dice(`anteprima: «${anteprima}» non dice «Mancano 3 follower»`, /Mancano 3 follower/.test(anteprima));
  dice("l'avviso «Imposta i follower» è ancora acceso", await pagina.locator("#goal-avviso").isHidden());
  // «Ripristina posizione» toglie quella scelta
  await pagina.click("#goal-ripristina");
  await pagina.waitForTimeout(300);
  s = await (await fetch(`${base}/api/stato`)).json();
  s = s.dati ?? s;
  dice("«Ripristina posizione» non ha tolto la posizione della gara", s.goal.posizioni.gara === undefined);
  // «Mostra ora»: la pagina della gara lo riceve (in modo «a comparsa» compare per la durata scelta)
  await fetch(`${base}/api/goal`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modo: "comparsa", ogniMinuti: 60, durataSecondi: 5 }) });
  const gara = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await gara.goto(`${base}/overlay.html?anteprima=1`);
  await gara.waitForTimeout(6500);
  dice("a comparsa: dopo la prima comparsa il Goal doveva essere sparito", await gara.locator(".gl.fuori").count() === 1);
  await pagina.click("#goal-mostra");
  await gara.waitForTimeout(700);
  dice("«Mostra ora»: il Goal doveva comparire", await gara.locator(".gl:not(.fuori)").count() === 1);
  await pagina.screenshot({ path: join(CARTELLA, "mockup", "regia-goal.jpg"), type: "jpeg", quality: 85, fullPage: false, clip: { x: 0, y: (await pagina.locator("#goal-regia").boundingBox()).y - 10, width: 1100, height: 900 } });
  await browser.close();
  if (errori.length) {
    console.error(`Problemi nella regia del Goal:\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok regia del Goal: obiettivi, follower di adesso, posizione, ripristino e «Mostra ora»; mockup in mockup/regia-goal.jpg");
}

// Instagram dell'artista nel tabellone della gara: con `corrente.instagram` impostato (comando correggiTraccia) compare «@nome» con
// l'icona sulla riga dell'artista, dentro il riquadro del tabellone e senza lettere tagliate; senza, la riga non c'è.
async function controllaInstagram(pagina, atteso, errori) {
  const f = await pagina.evaluate(() => {
    const ig = document.querySelector("#t-ig");
    const t = document.querySelector(".tabellone").getBoundingClientRect();
    const r = ig.getBoundingClientRect();
    const testo = document.querySelector("#t-ig-testo");
    const artista = document.querySelector("#t-artista").getBoundingClientRect();
    return { visibile: !ig.hidden && r.width > 0, testo: testo.textContent, dentro: r.x >= t.x && r.right <= t.right && r.y >= t.y && r.bottom <= t.bottom, tagliato: testo.scrollWidth > testo.clientWidth + 1, adestra: r.x >= artista.right - 1, icona: ig.querySelector("svg").getBoundingClientRect().width };
  });
  if (!atteso) {
    if (f.visibile) errori.push("Instagram: la riga c'è ma la traccia non ha un Instagram");
    return;
  }
  if (!f.visibile || f.testo !== "@lince.music") errori.push(`Instagram: «${f.testo}» (visibile ${f.visibile}), doveva esserci «@lince.music»`);
  if (!f.dentro) errori.push("Instagram: esce dal riquadro del tabellone");
  if (f.tagliato) errori.push("Instagram: il testo finisce con i puntini");
  if (!f.adestra) errori.push("Instagram: non sta a destra dell'artista");
  if (f.icona < 10) errori.push("Instagram: l'icona non si vede");
  if ((await inchiostroTagliato(pagina, ["#t-ig-testo"])).length) errori.push("Instagram: lettere tagliate dalla riga");
}

// ----- Scheda «Ora in ascolto» del layout senza premio (--layout senzaPremio --scheda <tipo>) -----
// Colori (scheda grigia con testo bianco per chi non paga; dorata con testo nero per Skip, Super Skip e Throne; stessa cosa per
// banner e barra), testi interi (niente puntini con i dati di prova), Instagram con l'icona e nessun testo tagliato dalla sua riga.
async function controllaScheda(pagina, errori) {
  const pagato = ["skip", "superskip", "throne"].includes(stato);
  const f = await pagina.evaluate(() => {
    const colore = (sel) => getComputedStyle(document.querySelector(sel)).color;
    const sfondo = (sel) => getComputedStyle(document.querySelector(sel)).backgroundImage;
    const tronca = (sel) => {
      const e = document.querySelector(sel);
      return e && !e.hidden && e.scrollWidth > e.clientWidth + 1;
    };
    return {
      pagata: document.querySelector(".palco").classList.contains("pagata"),
      artista: colore("#sp-scheda-artista"),
      titolo: colore("#sp-scheda-titolo"),
      sfondoScheda: sfondo("#sp-scheda"),
      sfondoBanner: sfondo(".sp-banner"),
      sfondoBarra: sfondo(".sp-barra"),
      bannerTitolo: colore("#sp-titolo"),
      ig: !document.querySelector("#sp-scheda-ig").hidden,
      testoIg: document.querySelector("#sp-scheda-ig-testo").textContent,
      tagliati: ["#sp-scheda-artista", "#sp-scheda-titolo", "#sp-scheda-ig-testo", "#sp-sopra", "#sp-titolo", "#sp-link"].filter(tronca),
      etichetta: document.querySelector("#sp-scheda-sopra").textContent,
    };
  });
  const NERO = "rgb(10, 10, 10)";
  const BIANCO = "rgb(255, 255, 255)";
  const oro = (sfondo) => /rgb\(242, 181, 42\)|rgb\(255, 241, 184\)/.test(sfondo);
  if (stato === "studio") return;
  if (f.pagata !== pagato) errori.push(`palco: la classe «pagata» è ${f.pagata}, doveva essere ${pagato}`);
  if (f.artista !== (pagato ? NERO : BIANCO)) errori.push(`nome dell'artista: colore ${f.artista}, doveva essere ${pagato ? "nero" : "bianco"}`);
  if (oro(f.sfondoScheda) !== pagato) errori.push(`scheda: ${pagato ? "doveva essere dorata" : "non doveva essere dorata"} (${f.sfondoScheda.slice(0, 60)})`);
  if (oro(f.sfondoBanner) !== pagato) errori.push(`banner: ${pagato ? "doveva essere dorato" : "non doveva essere dorato"}`);
  if (f.bannerTitolo !== (pagato ? NERO : BIANCO)) errori.push(`banner, «La tua musica!»: colore ${f.bannerTitolo}, doveva essere ${pagato ? "nero" : "bianco"}`);
  if (!f.ig || f.testoIg !== "@lince.music") errori.push(`Instagram: «${f.testoIg}» (visibile ${f.ig}), doveva esserci «@lince.music»`);
  if (f.tagliati.length) errori.push(`testi con i puntini o tagliati: ${f.tagliati.join(", ")}`);
}

// ----- Scheda dal vivo (--scheda-animata) -----
// Il layout senza premio con la pagina non statica: la scheda sale con la traccia e RESTA (scheda fissa), con lo spot esce la
// traccia e lo spot scende dall'alto per 10 s, poi rientra la traccia; ricaricando la pagina la scheda c'è subito; «scheda» spenta in
// «In onda» la fa scendere e nessuna traccia la rialza finché non si riaccende. Con «scheda fissa» spenta scade da sola.
async function provaSchedaAnimata() {
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errori = [];
  const dice = (cosa, vero) => vero || errori.push(cosa);
  await comando("layout", { nome: "senzaPremio" });
  await comando("senzaPremio", { schedaFissa: true, durate: { standard: 4 } });
  await comando("widget", { nome: "scheda", visibile: true });
  const pagina = await browser.newPage({ viewport: VISTA });
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  await pagina.goto(`${base}/senza-premio.html?anteprima=1&muto=1`);
  await attendi(800);
  const su = () => pagina.evaluate(() => ({ su: document.querySelector("#sp-scheda").classList.contains("su"), spot: document.querySelector("#sp-scheda").classList.contains("studio"), artista: document.querySelector("#sp-scheda-artista").textContent }));
  dice("senza traccia la scheda non doveva esserci", !(await su()).su);
  await comando("traccia", { titolo: "Notti a Vicenza", artista: "Lince", tier: "skip" });
  await attendi(1200);
  let f = await su();
  dice(`la traccia doveva comparire (su ${f.su}, artista «${f.artista}»)`, f.su && f.artista === "Lince" && !f.spot);
  await attendi(5000);
  dice("scheda fissa: dopo 5 secondi (durata 4) la scheda doveva esserci ancora", (await su()).su);
  await comando("spotStudio");
  await attendi(300);
  dice("con lo spot la traccia doveva scendere", !(await su()).su);
  await attendi(900);
  f = await su();
  dice(`lo spot doveva essere su (su ${f.su}, spot ${f.spot})`, f.su && f.spot);
  await attendi(10_500);
  await attendi(1500);
  f = await su();
  dice(`dopo lo spot doveva rientrare la traccia (su ${f.su}, spot ${f.spot}, artista «${f.artista}»)`, f.su && !f.spot && f.artista === "Lince");
  await pagina.reload();
  await attendi(1200);
  dice("ricaricando, la scheda della traccia in onda doveva esserci subito", (await su()).su);
  await comando("widget", { nome: "scheda", visibile: false });
  await attendi(1200);
  dice("con la scheda spenta doveva scendere", !(await su()).su);
  await comando("traccia", { titolo: "Altra", artista: "Mira" });
  await attendi(1200);
  dice("spenta, una traccia nuova non doveva rialzarla", !(await su()).su);
  await comando("widget", { nome: "scheda", visibile: true });
  await attendi(1200);
  f = await su();
  dice(`riaccesa, doveva rientrare l'ultima traccia (su ${f.su}, «${f.artista}»)`, f.su && f.artista === "Mira");
  await comando("senzaPremio", { schedaFissa: false });
  await comando("traccia", { titolo: "A tempo", artista: "Vale B" });
  await attendi(1200);
  dice("a tempo: la traccia doveva comparire", (await su()).su);
  await attendi(4300 + 900);
  dice("a tempo: dopo i 4 secondi della durata doveva scendere", !(await su()).su);
  await browser.close();
  if (errori.length) {
    console.error(`Problemi nella scheda dal vivo:\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok scheda dal vivo: fissa, spot dall'alto e rientro della traccia, ricarica, spenta e riaccesa, a tempo");
}

async function main() {
  if (args.includes("--scheda-animata")) return provaSchedaAnimata();  if (args.includes("--regia-goal")) return provaRegiaGoal();
  if (controlli) return provaControlli();
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
  const pagina = await apriPagina(browser, layout === "senzaPremio" && SCHEDE.includes(stato) ? `&scheda=${stato}` : "");
  const errori = [];
  if (layout === "gara" && stato === "ultimi-minuti") await nuovoPrimo();

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
    // la notifica è alta «almeno» quanto dice la tabella: cresce con il testo
    const diversa = [x, y, w, h].some((v, i) => Math.abs(v - trovato[i]) > TOLLERANZA && !(chiave === "notifica" && i === 3 && trovato[i] > v));
    if (diversa) errori.push(`${chiave}: trovato [${trovato.map((n) => Math.round(n)).join(", ")}], atteso [${x}, ${y}, ${w}, ${h}]`);
    if (dentro && (rect.x < X_MIN - TOLLERANZA || rect.x + rect.w > X_MAX + TOLLERANZA || rect.y < Y_MIN - TOLLERANZA || rect.y + rect.h > Y_MAX + TOLLERANZA)) {
      errori.push(`${chiave}: esce dalla zona libera (x ${X_MIN}…${X_MAX}, y ${Y_MIN}…${Y_MAX})`);
    }
  }
  if (layout === "senzaPremio" && SCHEDE.includes(stato)) await controllaScheda(pagina, errori);
  if (layout === "gara") await controllaInstagram(pagina, stato === "instagram", errori);
  // La notifica fuori dal suo stato è spenta (trasparente): non conta per le sovrapposizioni.
  errori.push(...sovrapposizioni(Object.fromEntries(pezziAttesi.map((chiave) => [chiave, tabella[chiave]]))));

  const file = join(CARTELLA, "mockup", `${NOMI_FILE[layout][stato]}${guida ? "-guide" : ""}.jpg`);
  await pagina.screenshot({ path: file, type: "jpeg", quality: 88 });
  if (layout === "gara" && STATI_ALBERO[stato]) await controllaTesti(pagina, TESTI_ALBERO, { nome: stato, lunghi: STATI_ALBERO[stato].lunghi }, errori);
  await browser.close();
  if (errori.length) {
    console.error(`Problemi in ${layout}/${stato}:\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok ${layout}/${stato}: geometria rispettata, mockup in ${file}`);
}

// Importato (dai test) non parte da solo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
