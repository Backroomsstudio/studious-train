// Mockup e controllo di geometria del battle con Playwright (installato a parte: non è una dipendenza di npm test).
// Uso: node strumenti/mockup-battle.mjs --base http://127.0.0.1:4747 --fase battle [--guida] [--secondi 20]
//   fasi: attesa, countdown, battle, voto, risultato, pari, torneo, punti
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
  artisti: [116, 1100, 848, 96],
  giudici: [116, 1292, 848, 150],
  chat: [116, 1456, 848, 78],
  tabellone: [116, 282, 848, 1252],
  conto: [0, 0, 1080, 1920],
};
const FISSI = ["barre", "modalita", "timer", "camera", "artisti", "giudici", "chat"];
// Pezzi a tutta larghezza: non devono stare dentro x 116…964.
const A_TUTTA_LARGHEZZA = ["camera", "conto"];
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
  if (fase === "torneo" || fase === "punti") parti.push("tabellone");
  return parti;
};

async function main() {
  await comando("layout", { nome: "battle" });
  await comando("battleDemo", { fase, ...(secondi ? { secondi: Number(secondi) } : {}) });
  const { chromium } = caricaPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pagina = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const parametri = ["anteprima=1", "statico=1", ...(guida ? ["guide=1"] : []), ...(conto ? [`conto=${conto}`] : []), ...(popup ? ["popup=1"] : [])];
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
  const file = join(CARTELLA, "mockup", popup ? "battle-popup.jpg" : `battle-${fase}.jpg`);
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
