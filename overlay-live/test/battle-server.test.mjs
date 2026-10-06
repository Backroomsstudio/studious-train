// Prove con un server vero: un processo figlio su una porta libera, con config e cartella dati temporanei.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), "..");
const dormi = (ms) => new Promise((ok) => setTimeout(ok, ms));

let figlio;
let temporanea;
let base;
let porta;
const eventi = [];
let ws;

async function portaLibera() {
  return new Promise((ok) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

async function api(nome, args = {}) {
  const r = await fetch(`${base}/api/${nome}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args) });
  return { stato: r.status, ...(await r.json()) };
}

const statoCorrente = async () => (await fetch(`${base}/api/stato`)).json();

before(async () => {
  porta = await portaLibera();
  base = `http://127.0.0.1:${porta}`;
  temporanea = mkdtempSync(join(tmpdir(), "battle-test-"));
  const config = { porta, host: "127.0.0.1", tiktok: "", layout: "gara", nero: { username: "", portaWebhook: 0 } };
  writeFileSync(join(temporanea, "config.json"), JSON.stringify(config));
  figlio = spawn(process.execPath, ["server.mjs"], {
    cwd: CARTELLA,
    env: { ...process.env, OVERLAY_CONFIG: join(temporanea, "config.json"), OVERLAY_DATI: join(temporanea, "dati"), NERO_API: "http://127.0.0.1:1" },
    stdio: "ignore",
  });
  // Aspetta che il server risponda (al massimo 5 secondi).
  for (let i = 0; i < 50; i++) {
    try {
      await statoCorrente();
      break;
    } catch {
      await dormi(100);
    }
  }
  await statoCorrente();
  ws = new WebSocket(`ws://127.0.0.1:${porta}/ws`);
  ws.on("message", (grezzo) => {
    const msg = JSON.parse(grezzo);
    if (msg.tipo === "stato") eventi.push(...msg.eventi);
  });
  await new Promise((ok) => ws.on("open", ok));
});

after(() => {
  ws?.close();
  figlio?.kill();
  if (temporanea) rmSync(temporanea, { recursive: true, force: true });
});

test("e2e: errori chiari", async () => {
  const senzaNomi = await api("battleAvvia");
  assert.equal(senzaNomi.stato, 400);
  assert.match(senzaNomi.errore, /Mancano i nomi/);
  const fuoriFase = await api("battleRivela");
  assert.equal(fuoriFase.stato, 400);
  assert.match(fuoriFase.errore, /fine round/);
  const sconosciuto = await api("battleBoh");
  assert.equal(sconosciuto.stato, 400);
  assert.match(sconosciuto.errore, /sconosciuto/);
});

test("e2e: un round completo", async () => {
  assert.equal((await api("layout", { nome: "battle" })).ok, true);
  assert.equal((await api("battleScontro", { sx: { nome: "Lince", instagram: "@lince.music" }, dx: { nome: "Nove" } })).ok, true);
  assert.equal((await api("battleTimer", { durataSecondi: 10 })).ok, true);
  assert.equal((await api("battleAvvia")).ok, true);
  assert.equal((await statoCorrente()).battle.fase, "countdown");
  await dormi(3600); // 3-2-1 e via
  assert.equal((await statoCorrente()).battle.fase, "battle");

  for (const [utente, testo] of [["a", "1"], ["b", "SX"], ["c", "!1"], ["d", "2"]]) {
    const r = await api("messaggioChat", { piattaforma: "tiktok", utente, testo });
    assert.equal(r.dati.contato, true, `${utente}: ${testo}`);
  }
  assert.equal((await api("messaggioChat", { piattaforma: "tiktok", utente: "e", testo: "8" })).dati.contato, false, "un punteggio non è un voto");

  assert.equal((await api("battleTermina")).ok, true);
  for (const giudice of ["luca", "freya", "daniele"]) {
    await api("battleVotoGiudice", { giudice, lato: "sx", valore: 8 });
    await api("battleVotoGiudice", { giudice, lato: "dx", valore: 6 });
  }
  const rivela = await api("battleRivela");
  assert.deepEqual(rivela.dati, { vincitore: "sx", pari: false });

  const { battle } = await statoCorrente();
  assert.equal(battle.fase, "risultato");
  assert.equal(battle.risultato.vincitore, "sx");
  assert.equal(battle.quota.sx, 0.75);
  assert.equal(typeof battle.chat.voti, "number", "nessuna mappa dei voti nell'istantanea");
  assert.equal(battle.sx.instagram, "lince.music");

  await dormi(150);
  const gong = eventi.filter((e) => e.nome === "gong").map((e) => e.dati.quando);
  assert.deepEqual(gong, ["inizio", "fine"]);
});

test("e2e: con un altro layout la chat non vota il battle", async () => {
  await api("layout", { nome: "gara" });
  const prima = (await statoCorrente()).battle.chat.voti;
  const r = await api("messaggioChat", { piattaforma: "tiktok", utente: "z", testo: "1" });
  assert.equal(r.dati.contato, false);
  assert.equal((await statoCorrente()).battle.chat.voti, prima);
});

test("e2e: dati di prova, nuova serata e pop-up", async () => {
  assert.equal((await api("battleDemo", { fase: "torneo" })).ok, true);
  const demo = await statoCorrente();
  assert.equal(demo.visibili.bracket, true);
  assert.equal(demo.battle.tabellone.torneo.partecipanti.length, 8);
  assert.equal((await api("battleDemo", { fase: "boh" })).stato, 400);

  assert.equal((await api("tabellone", { modo: "punti", visibile: false })).ok, true);
  assert.equal((await api("torneo", { azione: "azzera" })).ok, true);
  assert.equal((await api("battlePopup", { id: "rime" })).ok, true);
  assert.equal((await api("battlePopup", { id: "non-esiste" })).stato, 400);
  await dormi(150);
  assert.ok(eventi.some((e) => e.nome === "popupBattle" && e.dati.id === "rime"));

  assert.equal((await api("nuovaSerata")).ok, true);
  const dopo = await statoCorrente();
  assert.equal(dopo.battle.round, 1);
  assert.equal(dopo.battle.fase, "attesa");
  assert.equal(dopo.battle.giudici[0].nome, "Luca");
});
