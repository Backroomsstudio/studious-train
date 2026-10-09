// Aiuto per le prove con un server vero: un processo figlio su una porta libera, con config e cartella dati temporanei.
// Non è un test: lo importano i file *-server.test.mjs. Uso:
//   const srv = await avviaServer({ stato: { layout: "studio" } });   // `stato` = dati/stato.json di partenza
//   await srv.api("layout", { nome: "drum" });  // → { stato: 200, ok: true, dati }  (stato = codice HTTP)
//   const ws = await srv.apriWs();              // ws.messaggi e ws.eventi si riempiono; ws.invia({…}); ws.chiudi()
//   await srv.ferma();
import { after } from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const CARTELLA_PROGETTO = join(dirname(fileURLToPath(import.meta.url)), "..");
const dormi = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Rete di sicurezza: un test che fallisce a metà non deve lasciare server accesi (e il processo dei test appeso).
const attivi = new Set();
after(async () => {
  for (const ferma of [...attivi]) await ferma();
});

function portaLibera() {
  return new Promise((ok) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

// `config` si aggiunge a quello di prova; `stato` è il file dati/stato.json iniziale. Con `cartella` si riusa una cartella
// già usata (per un riavvio con lo stato salvato): chi la passa la cancella da sé.
export async function avviaServer({ config = {}, stato = null, cartella = null } = {}) {
  const porta = await portaLibera();
  const base = `http://127.0.0.1:${porta}`;
  const propria = !cartella;
  const radice = cartella ?? mkdtempSync(join(tmpdir(), "overlay-test-"));
  const configCompleto = { porta, host: "127.0.0.1", tiktok: "", layout: "gara", nero: { username: "", portaWebhook: 0 }, ...config };
  writeFileSync(join(radice, "config.json"), JSON.stringify(configCompleto));
  if (stato) {
    mkdirSync(join(radice, "dati"), { recursive: true });
    writeFileSync(join(radice, "dati", "stato.json"), JSON.stringify(stato));
  }
  let uscita = "";
  const figlio = spawn(process.execPath, ["server.mjs"], {
    cwd: CARTELLA_PROGETTO,
    env: { ...process.env, OVERLAY_CONFIG: join(radice, "config.json"), OVERLAY_DATI: join(radice, "dati"), NERO_API: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const raccogli = (pezzo) => {
    uscita = (uscita + pezzo).slice(-4000);
  };
  figlio.stdout.on("data", raccogli);
  figlio.stderr.on("data", raccogli);

  const api = async (nome, args = {}, { pin } = {}) => {
    const intestazioni = { "content-type": "application/json", ...(pin ? { "x-pin": pin } : {}) };
    const r = await fetch(`${base}/api/${nome}`, { method: "POST", headers: intestazioni, body: JSON.stringify(args) });
    return { stato: r.status, ...(await r.json()) };
  };
  const statoCorrente = async () => (await fetch(`${base}/api/stato`)).json();

  // Aspetta che il server risponda (al massimo 8 secondi).
  let pronto = false;
  for (let i = 0; i < 80 && !pronto; i++) {
    try {
      await statoCorrente();
      pronto = true;
    } catch {
      await dormi(100);
    }
  }

  const aperti = new Set();
  const ferma = async () => {
    attivi.delete(ferma);
    for (const ws of aperti) ws.close();
    if (figlio.exitCode === null && figlio.signalCode === null) {
      const finito = new Promise((ok) => figlio.once("exit", ok));
      figlio.kill();
      await finito;
    }
    if (propria) rmSync(radice, { recursive: true, force: true });
  };
  attivi.add(ferma);
  if (!pronto) {
    await ferma();
    throw new Error(`Il server di prova non è partito. Uscita:\n${uscita}`);
  }

  // Un client WebSocket come una pagina o la regia: `messaggi` raccoglie tutto quello che arriva, `eventi` gli eventi dei
  // messaggi di stato.
  const apriWs = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${porta}/ws`);
    const client = { ws, messaggi: [], eventi: [], invia: (oggetto) => ws.send(JSON.stringify(oggetto)), chiudi: () => ws.close() };
    ws.on("message", (grezzo) => {
      const msg = JSON.parse(grezzo);
      client.messaggi.push(msg);
      if (msg.tipo === "stato") client.eventi.push(...msg.eventi);
    });
    aperti.add(ws);
    ws.on("close", () => aperti.delete(ws));
    await new Promise((ok, ko) => {
      ws.once("open", ok);
      ws.once("error", ko);
    });
    return client;
  };

  return { base, porta, cartella: radice, api, statoCorrente, apriWs, ferma };
}
