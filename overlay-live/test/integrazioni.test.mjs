import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { EventEmitter } from "node:events";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { WebcastLikeMessage, WebcastGiftMessage, WebcastSocialMessage, Gift, User, CommonMessageData, MessageCommonText } from "tiktok-live-proto/v3";
import { leggiVoto, commentoTikTok, likeTikTok, regaloTikTok, followTikTok, avviaTikTok } from "../lib/chat.mjs";
import { firmaValida, versoCoda, tracciaInOnda, instagramDaNero, avviaNero } from "../lib/nero.mjs";

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
    instagram: "",
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
  assert.deepEqual(tracciaInOnda(codaNero), { neroId: "4f56", titolo: "Notti a Vicenza", artista: "Lince", tier: "superskip", instagram: "" });
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

// ---------- Regali e follow ----------
// Messaggi come li consegna davvero la libreria: scritti e riletti con lo schema vero (tiktok-live-proto v3), non a mano. Un campo
// che manca arriva come 0 o «0», e una parte annidata che manca (gift, user) come undefined.
const vuoto = (Tipo) => Tipo.decode(new Uint8Array());
const sulFilo = (Tipo, campi) => Tipo.decode(Tipo.encode({ ...vuoto(Tipo), ...campi }).finish());
const regaloSulFilo = ({ nome, tipo, utente, ...campi } = {}) =>
  sulFilo(WebcastGiftMessage, {
    ...(nome !== undefined || tipo !== undefined ? { gift: sulFilo(Gift, { name: nome ?? "", type: tipo ?? 0 }) } : {}),
    ...(utente !== undefined ? { user: sulFilo(User, { displayId: utente }) } : {}),
    ...campi,
  });
// Un follow è un messaggio «social» con «follow» nel testo di visualizzazione.
const followSulFilo = ({ utente, chiave = "pm_main_follow_message_viewer_2", ...campi } = {}) =>
  sulFilo(WebcastSocialMessage, {
    common: sulFilo(CommonMessageData, { displayText: sulFilo(MessageCommonText, { key: chiave }) }),
    ...(utente !== undefined ? { user: sulFilo(User, { displayId: utente }) } : {}),
    ...campi,
  });

test("regalo: legge il messaggio vero della libreria (nome, ID testo di cifre, serie finita, utente)", () => {
  const vero = regaloSulFilo({ nome: "Rose", tipo: 1, utente: "mario_99", giftId: "5655", repeatCount: 3, repeatEnd: 1 });
  assert.equal(typeof vero.giftId, "string", "nello schema v3 l'ID del regalo è un testo");
  assert.equal(typeof vero.repeatEnd, "number", "e repeatEnd un numero 0/1");
  assert.deepEqual(regaloTikTok(vero), { utente: "mario_99", nome: "Rose", id: 5655, quantita: 3 });
});

test("regalo: una serie conta solo a repeatEnd, con la quantità; un regalo non a serie conta subito", () => {
  const serie = (campi) => regaloSulFilo({ nome: "Rose", tipo: 1, utente: "mario_99", giftId: "5655", ...campi });
  assert.equal(regaloTikTok(serie({ repeatCount: 1, repeatEnd: 0 })), null, "prima ripetizione: la serie non è finita");
  assert.equal(regaloTikTok(serie({ repeatCount: 5, repeatEnd: 0 })), null, "una serie senza fine non crea niente");
  assert.deepEqual(regaloTikTok(serie({ repeatCount: 7, repeatEnd: 1 })), { utente: "mario_99", nome: "Rose", id: 5655, quantita: 7 });
  assert.equal(regaloTikTok(serie({ repeatCount: 0, repeatEnd: 1 })).quantita, 1, "serie finita senza conteggio: almeno uno");
  const singolo = (campi) => regaloSulFilo({ nome: "Galaxy", tipo: 0, utente: "luca", giftId: "6001", ...campi });
  assert.deepEqual(regaloTikTok(singolo({ repeatCount: 1, repeatEnd: 0 })), { utente: "luca", nome: "Galaxy", id: 6001, quantita: 1 });
  assert.equal(regaloTikTok(singolo({ repeatCount: 0 })).quantita, 1, "senza ripetizioni vale uno");
  assert.equal(regaloTikTok(singolo({ repeatCount: 4 })).quantita, 4);
  // lo stesso donatore due volte: due regali (la funzione non ricorda niente)
  assert.deepEqual(regaloTikTok(singolo({})), regaloTikTok(singolo({})));
});

test("regalo: ripiego sui nomi del vecchio schema", () => {
  const vecchio = { giftDetails: { giftName: "Rose" }, giftType: 1, giftId: 5655, repeatCount: 2, repeatEnd: true, user: { uniqueId: "mario_99" } };
  assert.deepEqual(regaloTikTok(vecchio), { utente: "mario_99", nome: "Rose", id: 5655, quantita: 2 });
  assert.equal(regaloTikTok({ ...vecchio, repeatEnd: false }), null, "anche lì la serie conta alla fine");
  // nomi nuovi e vecchi insieme: vincono i nuovi
  assert.deepEqual(regaloTikTok({ ...vecchio, gift: { name: "Galaxy", type: 0 }, user: { displayId: "nuovo", uniqueId: "vecchio" }, repeatEnd: false }), {
    utente: "nuovo",
    nome: "Galaxy",
    id: 5655,
    quantita: 2,
  });
});

test("regalo: senza nome e ID o senza utente → null; il nome o l'ID da soli bastano", () => {
  assert.equal(regaloTikTok(regaloSulFilo({ utente: "mario_99", repeatCount: 1 })), null, "né nome né ID");
  assert.equal(regaloTikTok(regaloSulFilo({ nome: "Rose", tipo: 0, giftId: "5655", repeatCount: 1 })), null, "senza utente");
  assert.equal(regaloTikTok(regaloSulFilo({ nome: "Rose", tipo: 0, utente: "", giftId: "5655" })), null, "utente vuoto");
  assert.equal(regaloTikTok(regaloSulFilo({ nome: "  ", tipo: 0, utente: "mario", giftId: "0" })), null, "nome di soli spazi");
  for (const dati of [undefined, null, {}, 7, "regalo", [], { user: { displayId: "x" } }, { gift: { name: "Rose" } }, { gift: 5, user: 7 }]) assert.equal(regaloTikTok(dati), null, JSON.stringify(dati));
  assert.deepEqual(regaloTikTok(regaloSulFilo({ nome: "Rose", tipo: 0, utente: "mario", giftId: "0" })), { utente: "mario", nome: "Rose", id: null, quantita: 1 });
  assert.deepEqual(regaloTikTok(regaloSulFilo({ tipo: 0, utente: "mario", giftId: "5655" })), { utente: "mario", nome: "", id: 5655, quantita: 1 });
  // un ID di troppe cifre non vale come numero (resta il nome)
  assert.deepEqual(regaloTikTok(regaloSulFilo({ nome: "Rose", tipo: 0, utente: "mario", giftId: "1234567890123456" })), { utente: "mario", nome: "Rose", id: null, quantita: 1 });
});

test("follow: utente e followCount del messaggio vero", () => {
  const vero = followSulFilo({ utente: "anna", followCount: "1250" });
  assert.equal(typeof vero.followCount, "string", "nello schema v3 il conteggio è un testo di cifre");
  assert.deepEqual(followTikTok(vero), { utente: "anna", totale: 1250 });
  assert.deepEqual(followTikTok({ user: { uniqueId: "luca" }, followCount: "7" }), { utente: "luca", totale: 7 }, "nome del vecchio schema");
  assert.deepEqual(followTikTok({ user: { displayId: "nuovo", uniqueId: "vecchio" } }), { utente: "nuovo", totale: null });
});

test("follow: un followCount non numerico, «0» o di 16 cifre → totale null", () => {
  for (const followCount of ["", "0", "abc", "12e3", "-5", " 7", "12.5", "1234567890123456", 1250, null]) {
    assert.deepEqual(followTikTok({ user: { displayId: "anna" }, followCount }), { utente: "anna", totale: null }, JSON.stringify(followCount));
  }
  assert.deepEqual(followTikTok(followSulFilo({ utente: "anna" })), { utente: "anna", totale: null }, "il campo che manca arriva come «0»");
  assert.deepEqual(followTikTok({ user: { displayId: "anna" }, followCount: "123456789012345" }), { utente: "anna", totale: 123456789012345 }, "15 cifre sono il massimo");
  // senza utente resta il totale, se c'è; senza niente → null
  assert.deepEqual(followTikTok({ followCount: "40" }), { utente: "", totale: 40 });
  for (const dati of [undefined, null, {}, 3, "follow", { followCount: "0" }]) assert.equal(followTikTok(dati), null, JSON.stringify(dati));
});

test("regalo e follow: il connettore consegna i messaggi decodificati com'è e le funzioni li leggono (prova di deriva della libreria)", async () => {
  const connessione = new TikTokLiveConnection("prova", { processInitialData: false });
  const regali = [];
  const follow = [];
  connessione.on(WebcastEvent.GIFT, (dati) => regali.push(regaloTikTok(dati)));
  connessione.on(WebcastEvent.FOLLOW, (dati) => follow.push(followTikTok(dati)));
  await connessione.processDecodedData({ type: "WebcastGiftMessage", data: regaloSulFilo({ nome: "Rose", tipo: 1, utente: "mario_99", giftId: "5655", repeatCount: 3, repeatEnd: 1 }) });
  await connessione.processDecodedData({ type: "WebcastSocialMessage", data: followSulFilo({ utente: "anna", followCount: "1250" }) });
  // un messaggio «social» che non è un follow (una condivisione) non arriva come follow
  await connessione.processDecodedData({ type: "WebcastSocialMessage", data: followSulFilo({ utente: "luca", chiave: "pm_mt_guidance_share" }) });
  assert.deepEqual(regali, [{ utente: "mario_99", nome: "Rose", id: 5655, quantita: 3 }]);
  assert.deepEqual(follow, [{ utente: "anna", totale: 1250 }]);
});

test("avviaTikTok: regali e follow arrivano a suRegalo e suFollow con le stesse protezioni dei Like", async () => {
  const finta = Object.assign(new EventEmitter(), { connect: async () => ({ roomId: "r1" }), disconnect: async () => {} });
  const regali = [];
  const follow = [];
  const like = [];
  const log = [];
  const ferma = avviaTikTok("prova", () => {}, () => {}, (riga) => log.push(riga), {
    suLike: (l) => like.push(l),
    suRegalo: (r) => regali.push(r),
    suFollow: (f) => {
      if (f.utente === "rompi") throw new Error("boom");
      follow.push(f);
    },
    creaConnessione: () => finta,
  });
  try {
    finta.emit(WebcastEvent.GIFT, regaloSulFilo({ nome: "Rose", tipo: 1, utente: "mario_99", giftId: "5655", repeatCount: 1, repeatEnd: 0 })); // serie in corso
    finta.emit(WebcastEvent.GIFT, regaloSulFilo({ nome: "Rose", tipo: 1, utente: "mario_99", giftId: "5655", repeatCount: 3, repeatEnd: 1 }));
    finta.emit(WebcastEvent.GIFT, null); // messaggi rotti: ignorati
    finta.emit(WebcastEvent.GIFT, { gift: 5, user: 7 });
    finta.emit(WebcastEvent.FOLLOW, followSulFilo({ utente: "rompi" })); // chi riceve lancia un errore: gli eventi dopo arrivano lo stesso
    finta.emit(WebcastEvent.FOLLOW, followSulFilo({ utente: "anna", followCount: "10" }));
    finta.emit(WebcastEvent.FOLLOW, {}); // né utente né totale: ignorato
    finta.emit(WebcastEvent.LIKE, likeSulFilo({ count: 2, total: "100" })); // e i Like di prima continuano a funzionare
    assert.deepEqual(regali, [{ utente: "mario_99", nome: "Rose", id: 5655, quantita: 3 }]);
    assert.deepEqual(follow, [{ utente: "anna", totale: 10 }]);
    assert.deepEqual(like, [{ totale: 100, conteggio: 2 }]);
    assert.ok(log.some((riga) => /follow non registrato \(boom\)/.test(riga)), log.join(" | "));
  } finally {
    ferma();
  }
});

test("instagramDaNero: @nome, nome e link del profilo danno il nome; campo mancante, numero o testo con spazi → vuoto", () => {
  assert.equal(instagramDaNero({ submitterInstagram: "@mira.music" }), "mira.music");
  assert.equal(instagramDaNero({ submitterInstagramHandle: "mira_music" }), "mira_music");
  assert.equal(instagramDaNero({ instagram: "https://www.instagram.com/mira.music/?hl=it" }), "mira.music");
  assert.equal(instagramDaNero({ submitter: { instagram: "instagram.com/mira.music" } }), "mira.music");
  assert.equal(instagramDaNero({ submitter: { socials: { instagram: "@mira" } } }), "mira");
  assert.equal(instagramDaNero({ submitterInstagram: "", instagram: "@seconda" }), "seconda", "un campo vuoto passa al successivo");
  for (const rotto of [{}, null, undefined, { instagram: 12345 }, { instagram: "mira music" }, { instagram: "@" }, { instagram: "x".repeat(40) }, { instagram: { a: 1 } }]) assert.equal(instagramDaNero(rotto), "");
});

test("Nero.fan: tracciaInOnda e versoCoda portano l'Instagram dell'artista", () => {
  const coda = { queue: [], current: { streamSubmissionId: "9", submissionName: "Notti", submitterName: "Lince", tier: "throne", submitterInstagram: "@lince.music" } };
  assert.equal(tracciaInOnda(coda).instagram, "lince.music");
  assert.equal(tracciaInOnda({ current: { streamSubmissionId: "9", submissionName: "Notti" } }).instagram, "");
  const voce = versoCoda({ event: "submission.paid", data: { sessionId: "s", timestamp: 5, submissionName: "Notti", submitterName: "Lince", tier: "skip", submitterInstagram: "instagram.com/lince.music/" } }, 0);
  assert.equal(voce.instagram, "lince.music");
  assert.equal(versoCoda({ event: "submission.paid", data: { sessionId: "s", timestamp: 5, submissionName: "Notti" } }, 0).instagram, "");
});
