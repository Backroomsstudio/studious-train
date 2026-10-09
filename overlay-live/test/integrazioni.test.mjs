import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { WebcastLikeMessage } from "tiktok-live-proto/v3";
import { leggiVoto, commentoTikTok, likeTikTok } from "../lib/chat.mjs";
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
  // Con l'intervallo della gara (4–10) gli stessi commenti valgono uguale; i voti sotto il 4 tornano commenti normali.
  for (const [testo, atteso] of Object.entries(casi)) {
    assert.equal(leggiVoto(testo, { min: 4, max: 10 }), atteso !== null && atteso >= 4 ? atteso : null, `gara "${testo}"`);
  }
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

test("like: legge totale e conteggio dell'evento", () => {
  assert.deepEqual(likeTikTok({ likeCount: 15, totalLikeCount: 12480 }), { totale: 12480, conteggio: 15 });
  assert.deepEqual(likeTikTok({ likeCount: 3 }), { totale: null, conteggio: 3 });
  assert.deepEqual(likeTikTok({ totalLikeCount: 500 }), { totale: 500, conteggio: 0 });
  assert.deepEqual(likeTikTok({ likeCount: 2.9, totalLikeCount: 10.7 }), { totale: 10, conteggio: 2 });
  for (const dati of [{}, null, undefined, { likeCount: -2, totalLikeCount: NaN }, { totalLikeCount: "7" }]) assert.equal(likeTikTok(dati), null, JSON.stringify(dati));
});

// Un messaggio come lo consegna davvero la libreria: scritto e riletto con lo schema vero (tiktok-live-proto v3), non a mano.
// Lì i campi si chiamano `count` (numero) e `total` (testo di cifre, int64); un campo mancante arriva come 0 e "0".
const likeSulFilo = (campi) => WebcastLikeMessage.decode(WebcastLikeMessage.encode({ ...WebcastLikeMessage.decode(new Uint8Array()), ...campi }).finish());

test("like: legge il messaggio vero della libreria (count numero, total testo di cifre)", () => {
  const vero = likeSulFilo({ count: 15, total: "12480" });
  assert.equal(typeof vero.total, "string", "nello schema v3 il totale è un testo");
  assert.deepEqual(likeTikTok(vero), { totale: 12480, conteggio: 15 });
  assert.deepEqual(likeTikTok(likeSulFilo({ count: 1, total: "1234567890123" })), { totale: 1234567890123, conteggio: 1 });
});

test("like: il totale che manca nel messaggio vero arriva come «0» e non vale come totale", () => {
  assert.deepEqual(likeTikTok(likeSulFilo({ count: 3 })), { totale: null, conteggio: 3 });
  assert.equal(likeTikTok(likeSulFilo({})), null);
});

test("like: il connettore consegna il messaggio decodificato com'è e likeTikTok lo legge (prova di deriva della libreria)", async () => {
  const connessione = new TikTokLiveConnection("prova", { processInitialData: false });
  const visti = [];
  connessione.on(WebcastEvent.LIKE, (dati) => visti.push(likeTikTok(dati)));
  await connessione.processDecodedData({ type: "WebcastLikeMessage", data: likeSulFilo({ count: 15, total: "12480" }) });
  assert.deepEqual(visti, [{ totale: 12480, conteggio: 15 }]);
});

test("like: un totale testo che non è fatto di sole cifre non vale; i nomi vecchi restano accettati ma solo come numeri", () => {
  for (const total of ["", "12e3", "-5", "12480.5", " 7", "1234567890123456", "abc"]) assert.equal(likeTikTok({ total }), null, JSON.stringify(total));
  assert.deepEqual(likeTikTok({ count: 4, total: "x" }), { totale: null, conteggio: 4 });
  assert.deepEqual(likeTikTok({ count: 2, total: "900", likeCount: 99, totalLikeCount: 1 }), { totale: 900, conteggio: 2 }, "i nomi nuovi vincono");
  assert.deepEqual(likeTikTok({ likeCount: 15, totalLikeCount: 12480 }), { totale: 12480, conteggio: 15 });
});
