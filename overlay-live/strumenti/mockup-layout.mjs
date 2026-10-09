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
      albero: p(116, 282, 848, 914, true), // il tabellone ad albero: dal premio al fondo della barra, sopra a tutto (solo stati albero)
    },
  },
};

// Come si trova ogni pezzo nella pagina: un selettore proprio, altrimenti il suo data-parte.
const SELETTORI = { gara: { premio: ".premio", classifica: ".classifica", timer: ".timer", notifica: ".notifica", tabellone: ".tabellone", chat: ".chat-cta", albero: "#albero" } };
const PAGINE = { gara: "overlay.html" };
// Per ogni layout e stato: i pezzi che devono esserci (e non essere nascosti). Negli ultimi minuti la barra «Vota in chat» è chiusa
// (la conferma chiude il voto) e quindi spenta: la notifica del nuovo primo posto prende il suo posto tra i pezzi da controllare.
const PRESENTI = {
  gara: {
    base: ["premio", "classifica", "timer", "tabellone", "chat"],
    "ultimi-minuti": ["premio", "classifica", "timer", "tabellone", "notifica"],
    // con l'albero acceso gli altri pezzi ci sono ancora ma coperti: si guarda solo lui
    albero: ["albero"],
    "albero-6": ["albero"],
  },
};
const STATO_PREDEFINITO = { gara: "base" };
const NOMI_FILE = { gara: { base: "verticale", "ultimi-minuti": "ultimi-minuti", albero: "gara-albero", "albero-6": "gara-albero-6" } };

// I testi che la pagina della gara adatta al riquadro: il selettore, il pezzo in cui stanno, il corpo di partenza (massimo) e il
// più piccolo accettabile (minimo). La chiave è quella di CORPI in public/js/overlay.js.
export const CORPI_GARA = {
  titolo: { selettore: "#t-titolo", pezzo: "tabellone", base: 52, minimo: 24 },
  artista: { selettore: "#t-artista", pezzo: "tabellone", base: 32, minimo: 18 },
  categoria: { selettore: ".cat-nome", pezzo: "tabellone", base: 24, minimo: 14 },
  giudice: { selettore: ".cat-giudice", pezzo: "tabellone", base: 22, minimo: 12 },
  rigaTraccia: { selettore: ".cl-traccia-testo", pezzo: "classifica", base: 30, minimo: 18 },
  rigaArtista: { selettore: ".cl-artista", pezzo: "classifica", base: 21, minimo: 13 },
  etichettaTimer: { selettore: ".timer-etichetta", pezzo: "timer", base: 22, minimo: 12 },
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

async function main() {
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
  const pagina = await apriPagina(browser);
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
