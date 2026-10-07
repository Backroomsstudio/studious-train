// Mockup e controllo di geometria del battle con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-battle.mjs --base http://127.0.0.1:4747 --fase battle [--guida] [--secondi 20]
//   fasi: attesa, countdown, battle, voto, risultato, pari, torneo, punti
//   --fase risultato --vittoria: la schermata del vincitore a tutta pagina (mockup/battle-vittoria.jpg)
// Mette il server in layout battle con i dati di prova della fase, apre la pagina a 1080×1920, controlla che ogni
// pezzo stia dove dice la tabella della spec (±1 px, e dentro x 116…964 tranne la camera) e salva mockup/battle-<fase>.jpg.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), "..");

// [x, y, larghezza, altezza] in pixel della tela 1080×1920.
export const GEOMETRIA = {
  barre: [116, 282, 848, 90],
  modalita: [116, 398, 530, 146],
  timer: [660, 398, 304, 146],
  popup: [116, 566, 848, 78],
  camera: [0, 656, 1080, 608],
  artisti: [116, 1072, 848, 124],
  giudici: [116, 1292, 848, 150],
  chat: [116, 1456, 848, 78],
  tabellone: [116, 282, 848, 1252],
  conto: [0, 0, 1080, 1920],
  vittoria: [0, 0, 1080, 1920],
};
const FISSI = ["barre", "modalita", "timer", "camera", "artisti", "giudici", "chat"];
// Pezzi a tutta larghezza: non devono stare dentro x 116…964.
const A_TUTTA_LARGHEZZA = ["camera", "conto", "vittoria"];
// Il contenuto della schermata del vincitore sta nella zona libera: sotto l'intestazione di TikTok (230), sopra la chat (1200).
const Y_MIN = 230;
const Y_MAX = 1200;
const TOLLERANZA = 1;
const X_MIN = 116;
const X_MAX = 964;

const args = process.argv.slice(2);
const opzione = (nome, predefinito) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : predefinito;
};
const base = opzione("base", "http://127.0.0.1:4747");
const fase = opzione("fase", "battle");
const guida = args.includes("--guida");
const secondi = opzione("secondi");
const conto = opzione("conto");
const popup = args.includes("--popup");
const vittoria = args.includes("--vittoria");
const regia = args.includes("--regia");
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
}

const attesi = () => {
  const parti = [...FISSI];
  if (popup) parti.push("popup");
  if (conto) parti.push("conto");
  if (vittoria) parti.push("vittoria");
  if (fase === "torneo" || fase === "punti") parti.push("tabellone");
  return parti;
};

// La schermata del vincitore: nome intero e ogni pezzo del contenuto dentro x 116…964 e y 230…1200.
async function controllaVittoria(pagina, errori) {
  const trovati = await pagina.evaluate(() => {
    const nome = document.querySelector("#bt-vit-nome");
    const pezzi = [".bt-vit-coppa", ".bt-vit-titolo", ".bt-vit-nome", "#bt-vit-ig", ".bt-vit-totale", "#bt-vit-voti"].map((sel) => {
      const e = document.querySelector(sel);
      const r = e.getBoundingClientRect();
      return { sel, nascosto: e.hidden, x: r.x, y: r.y, w: r.width, h: r.height };
    });
    return { nomeTagliato: nome.scrollWidth > nome.clientWidth, voti: document.querySelectorAll(".bt-vit-voto").length, pezzi };
  });
  if (trovati.nomeTagliato) errori.push("vittoria: il nome del vincitore è tagliato");
  if (trovati.voti !== 4) errori.push(`vittoria: ${trovati.voti} voti invece di 4 (Luca, Freya, Daniele, chat)`);
  for (const p of trovati.pezzi) {
    if (p.nascosto) continue;
    if (p.x < X_MIN - TOLLERANZA || p.x + p.w > X_MAX + TOLLERANZA || p.y < Y_MIN || p.y + p.h > Y_MAX + TOLLERANZA) {
      errori.push(`vittoria: ${p.sel} fuori dalla zona libera (x ${Math.round(p.x)}…${Math.round(p.x + p.w)}, y ${Math.round(p.y)}…${Math.round(p.y + p.h)})`);
    }
  }
}

// Flusso della regia: layout Battle, nomi, 3-2-1, fine, sei voti, Rivela. Controlla fase e risultato e salva mockup/regia-battle.jpg.
async function provaRegia() {
  await comando("nuovaSerata");
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1500, height: 2400 } });
  const errori = [];
  pagina.setDefaultTimeout(5000);
  pagina.on("pageerror", (e) => errori.push(`pagina: ${e.message}`));
  await pagina.goto(`${base}/regia`);
  await pagina.selectOption("#layout", "battle");
  await pagina.waitForSelector("#bt-regia.attivo", { timeout: 3000 });
  const scontro = '#f-bt-scontro';
  await pagina.fill(`${scontro} [name="sxNome"]`, "Lince");
  await pagina.fill(`${scontro} [name="sxInstagram"]`, "@lince.music");
  await pagina.fill(`${scontro} [name="dxNome"]`, "Nove");
  await pagina.click(`${scontro} button.primario`);
  await pagina.waitForFunction(() => document.querySelector("#bt-sx-nome-giudici")?.textContent.includes("Lince"), null, { timeout: 3000 });
  // Tabellone: torneo da 4, creato dalla regia, acceso e spento.
  await pagina.click('#bt-modo-tabellone [data-modo="torneo"]');
  await pagina.fill("#bt-partecipanti", "Lince\nNove\nKappa\nMira");
  await pagina.click("#bt-torneo-crea");
  await pagina.waitForFunction(() => document.querySelectorAll("#bt-partite li").length === 3);
  await pagina.click("#bt-bracket");
  await pagina.waitForFunction(() => document.querySelector("#bt-bracket").textContent.includes("Nascondi"));
  if (!(await (await fetch(`${base}/api/stato`)).json()).visibili.bracket) errori.push("il tabellone non si è acceso");
  await pagina.click("#bt-bracket");
  await pagina.waitForFunction(() => document.querySelector("#bt-bracket").textContent.includes("Mostra"));
  // Lo scontro è la prima semifinale: «Carica» la lega al torneo (altrimenti Avvia chiede conferma).
  await pagina.click("#bt-partite li:first-child button");
  await pagina.waitForFunction(() => document.querySelector("#bt-partite li.in-campo"));
  await pagina.click("#bt-avvia");
  await pagina.waitForTimeout(3700);
  await pagina.click("#bt-termina");
  const voti = [];
  for (const giudice of ["luca", "freya", "daniele"]) for (const [lato, valore] of [["sx", "8"], ["dx", "6"]]) voti.push([giudice, lato, valore]);
  for (const [giudice, lato, valore] of voti.slice(0, -1)) {
    const campo = pagina.locator(`[data-giudice="${giudice}"][data-lato="${lato}"]`);
    await campo.fill(valore);
    await campo.press("Enter");
  }
  // L'ultimo voto resta scritto nel campo, senza Invio: F4 deve salvarlo prima di rivelare.
  const [ultimoGiudice, ultimoLato, ultimoValore] = voti.at(-1);
  const ultimo = pagina.locator(`[data-giudice="${ultimoGiudice}"][data-lato="${ultimoLato}"]`);
  await ultimo.fill(ultimoValore);
  await ultimo.press("F4");
  await pagina.waitForFunction(() => document.querySelector("#bt-fase")?.textContent.includes("Risultato"), null, { timeout: 3000 });
  const stato = await (await fetch(`${base}/api/stato`)).json();
  if (stato.battle.fase !== "risultato" || stato.battle.risultato?.vincitore !== "sx") errori.push(`stato inatteso: ${stato.battle.fase}, vincitore ${stato.battle.risultato?.vincitore}`);
  const finale = stato.battle.tabellone.torneo.partite.find((p) => p.id === "f1");
  if (finale?.sx?.nome !== "Lince") errori.push(`il vincitore non è avanzato in finale (f1: ${finale?.sx?.nome ?? "vuota"})`);
  await (await pagina.$("#bt-regia")).screenshot({ path: join(CARTELLA, "mockup", "regia-battle.jpg"), type: "jpeg", quality: 85 });
  await browser.close();
  if (errori.length) {
    console.error(`Regia battle: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log("ok regia: flusso completo, mockup in mockup/regia-battle.jpg");
}

// Controlli sulle animazioni e sui testi: i nomi lunghi devono entrare nei riquadri e «VIA!» deve restare visibile
// abbastanza da leggerlo (con il battle in onda: cambia lo stato del server, usate una porta di prova).
async function provaControlli() {
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errori = [];
  await comando("nuovaSerata");
  await comando("layout", { nome: "battle" });

  // 1. nomi lunghi (fino a 24 caratteri) nelle barre della vita e nei box degli artisti
  await comando("battleScontro", { sx: { nome: "Rizzo Freestyle" }, dx: { nome: "MC Lince Vicentino Jr" } });
  const fissa = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await fissa.goto(`${base}/battle.html?anteprima=1&statico=1`);
  await fissa.evaluate(() => document.fonts?.ready);
  await fissa.waitForTimeout(600);
  const tagliati = await fissa.evaluate(() =>
    ["#bt-nome-sx", "#bt-nome-dx", "#bt-art-nome-sx", "#bt-art-nome-dx"].filter((sel) => {
      const e = document.querySelector(sel);
      return e.scrollWidth > e.clientWidth;
    }),
  );
  if (tagliati.length) errori.push(`nomi tagliati: ${tagliati.join(", ")}`);
  await fissa.close();

  // 2. «VIA!» visibile per almeno 600 ms tra la fine del 3-2-1 e lo spacco
  await comando("battleReset");
  await comando("battleScontro", { sx: { nome: "A" }, dx: { nome: "B" } });
  const viva = await browser.newPage({ viewport: { width: 540, height: 960 } });
  await viva.addInitScript(() => {
    window.__via = 0;
    setInterval(() => {
      const strato = document.querySelector("#bt-conto");
      if (strato && !strato.hidden && document.querySelector("#bt-conto-numero").textContent === "VIA!") window.__via += 20;
    }, 20);
  });
  await viva.goto(`${base}/battle.html?anteprima=1&muto=1`);
  await viva.waitForTimeout(700);
  await comando("battleAvvia");
  await viva.waitForTimeout(4800);
  const ms = await viva.evaluate(() => window.__via);
  if (ms < 600) errori.push(`«VIA!» resta visibile solo ${ms} ms (minimo 600)`);
  await comando("battleReset");

  // 3. schermata del vincitore con un nome lungo: nome intero, quattro voti, tutto nella zona libera
  await comando("battleScontro", { sx: { nome: "Rizzo Freestyle Vicenti" }, dx: { nome: "MC Lince" } });
  await comando("battleAvvia");
  await viva.waitForTimeout(3600);
  await comando("battleTermina");
  for (const giudice of ["luca", "freya", "daniele"]) {
    await comando("battleVotoGiudice", { giudice, lato: "sx", valore: 9.5 });
    await comando("battleVotoGiudice", { giudice, lato: "dx", valore: 4 });
  }
  await comando("battleRivela");
  const vincitore = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await vincitore.goto(`${base}/battle.html?anteprima=1&statico=1&vittoria=1`);
  await vincitore.evaluate(() => document.fonts?.ready);
  await vincitore.waitForTimeout(600);
  await controllaVittoria(vincitore, errori);
  await comando("battleProssimo");
  await browser.close();
  if (errori.length) {
    console.error(`Controlli: problemi\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok controlli: nomi lunghi dentro i riquadri, «VIA!» visibile ${ms} ms, schermata del vincitore nella zona libera`);
}

async function main() {
  if (regia) return provaRegia();
  if (controlli) return provaControlli();
  await comando("layout", { nome: "battle" });
  await comando("battleDemo", { fase, ...(secondi ? { secondi: Number(secondi) } : {}) });
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const parametri = ["anteprima=1", "statico=1", ...(guida ? ["guide=1"] : []), ...(conto ? [`conto=${conto}`] : []), ...(popup ? ["popup=1"] : []), ...(vittoria ? ["vittoria=1"] : [])];
  await pagina.goto(`${base}/battle.html?${parametri.join("&")}`);
  await pagina.evaluate(() => document.fonts?.ready);
  await pagina.waitForTimeout(700);

  const errori = [];
  for (const parte of attesi()) {
    const rect = await pagina.evaluate((nome) => {
      const el = document.querySelector(`[data-parte="${nome}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, nascosto: el.hidden || r.width === 0 };
    }, parte);
    if (!rect) {
      errori.push(`${parte}: elemento assente`);
      continue;
    }
    if (rect.nascosto) {
      errori.push(`${parte}: nascosto`);
      continue;
    }
    const [x, y, w, h] = GEOMETRIA[parte];
    const trovato = [rect.x, rect.y, rect.w, rect.h];
    if ([x, y, w, h].some((v, i) => Math.abs(v - trovato[i]) > TOLLERANZA)) {
      errori.push(`${parte}: trovato [${trovato.map((n) => Math.round(n)).join(", ")}], atteso [${x}, ${y}, ${w}, ${h}]`);
    }
    if (!A_TUTTA_LARGHEZZA.includes(parte) && (rect.x < X_MIN - TOLLERANZA || rect.x + rect.w > X_MAX + TOLLERANZA)) {
      errori.push(`${parte}: esce da x ${X_MIN}…${X_MAX}`);
    }
  }
  if (vittoria) await controllaVittoria(pagina, errori);
  const file = join(CARTELLA, "mockup", popup ? "battle-popup.jpg" : vittoria ? "battle-vittoria.jpg" : `battle-${fase}.jpg`);
  await pagina.screenshot({ path: file, type: "jpeg", quality: 88 });
  await browser.close();
  if (errori.length) {
    console.error(`Geometria non corretta (${fase}):\n - ${errori.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`ok ${fase}: geometria rispettata, mockup in ${file}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
