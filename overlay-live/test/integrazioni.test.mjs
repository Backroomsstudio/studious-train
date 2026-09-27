import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { leggiVoto, commentoTikTok } from "../lib/chat.mjs";
import { firmaValida, versoCoda, tracciaInOnda, avviaNero } from "../lib/nero.mjs";

test("riconosce i voti scritti nei commenti", () => {
  const casi = {
    "8": 8,
    " 7.5 ": 7.5,
    "7,5": 7.5,
    "10": 10,
    "0": 0,
    "9/10": 9,
    "!voto 6": 6,
    "!v 6.5": 6.5,
    "10.0": 10,
    "10.5": null,
    "11": null,
    "07": null,
    "8 bomba": null,
    "-3": null,
    "": null,
  };
  for (const [testo, atteso] of Object.entries(casi)) assert.equal(leggiVoto(testo), atteso, `"${testo}"`);
});

test("legge i commenti della live TikTok (schema attuale e precedente)", () => {
  // Forma reale osservata su una live (ottobre 2026), ridotta ai campi che servono.
  const attuale = { content: "8.5", user: { id: "7161302817247413250", nickname: "☆Mario☆", displayId: "mario_99" } };
  assert.deepEqual(commentoTikTok(attuale), { piattaforma: "tiktok", utente: "mario_99", testo: "8.5" });
  assert.deepEqual(commentoTikTok({ comment: "7", user: { uniqueId: "luca", nickname: "Luca" } }), {
    piattaforma: "tiktok",
    utente: "luca",
    testo: "7",
  });
  assert.equal(commentoTikTok({ content: "8", user: { nickname: "senza id" } }), null);
});

test("webhook Nero.fan: accetta solo la firma giusta", () => {
  const corpo = Buffer.from('{"event":"submission.paid"}');
  const firma = `sha256=${createHmac("sha256", "segreto").update(corpo).digest("hex")}`;
  assert.equal(firmaValida(corpo, firma, "segreto"), true);
  assert.equal(firmaValida(corpo, firma.toUpperCase().replace("SHA256", "sha256"), "segreto"), true);
  assert.equal(firmaValida(corpo, firma, "altro"), false);
  assert.equal(firmaValida(corpo, undefined, "segreto"), false);
  assert.equal(firmaValida(corpo, firma, ""), false);
});

test("webhook Nero.fan: una submission pagata diventa una voce di coda", () => {
  const voce = versoCoda(
    {
      event: "submission.paid",
      data: { sessionId: "s1", tier: "superskip", amountPaid: 15, submitterName: "Lince", submissionName: "Notti a Vicenza", timestamp: 1700 },
    },
    0,
  );
  assert.deepEqual(voce, {
    id: "nero-s1-1700-Notti a Vicenza",
    titolo: "Notti a Vicenza",
    artista: "Lince",
    tier: "superskip",
    importo: 15,
    ricevutoAlle: 1700,
  });
  assert.equal(versoCoda({ event: "goal.reached", data: {} }, 0), null);
});

// Forma reale di /queue/<sessione>/slim (ottobre 2026), ridotta ai campi che servono.
const codaNero = {
  queue: [],
  current: { streamSubmissionId: "4f56", submissionName: " Notti a Vicenza ", submitterName: "Lince", tier: "superskip", status: "current" },
  meta: { queueCount: 0 },
};

test("Nero.fan: la traccia in riproduzione diventa la traccia del tabellone", () => {
  assert.deepEqual(tracciaInOnda(codaNero), { neroId: "4f56", titolo: "Notti a Vicenza", artista: "Lince", tier: "superskip" });
  assert.equal(tracciaInOnda({ queue: [], current: null }), null);
  assert.equal(tracciaInOnda(null), null);
});

test("Nero.fan: trova la sessione live dal profilo e legge la coda", async () => {
  const chiesti = [];
  const scarica = async (url) => {
    chiesti.push(url.replace(/\?_t=\d+$/, ""));
    const dati = url.includes("/profile") ? { liveSession: { id: "s1", isLive: true } } : codaNero;
    return { ok: true, json: async () => dati };
  };
  const stati = [];
  const traccia = await new Promise((risolvi) => {
    const ferma = avviaNero("backrooms", (t) => (ferma(), risolvi(t)), (s) => stati.push(s.stato), { scarica, intervallo: 10 });
  });
  assert.equal(traccia.titolo, "Notti a Vicenza");
  assert.deepEqual(chiesti, ["https://api.nero.fan/users/backrooms/profile", "https://api.nero.fan/queue/s1/slim"]);
  assert.deepEqual(stati, ["collegato"]);
});
