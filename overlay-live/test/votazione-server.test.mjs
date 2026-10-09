// La votazione della gara con un server vero: comando, voti della chat e partenza da config.json e da stato.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avviaServer } from "./aiuti-server.mjs";

const PREDEFINITA = { pesi: { beat: 3, voce: 3, mix: 3, chat: 1 }, min: 4, max: 10, etichette: { beat: "Beat", voce: "Voce", mix: "Mix", chat: "Chat" } };

// Ogni prova ha il suo server (config e stato di partenza diversi) e lo ferma anche se fallisce.
async function conServer(opzioni, prova) {
  const srv = await avviaServer(opzioni);
  try {
    await prova(srv);
  } finally {
    await srv.ferma();
  }
}

const votazione = async (srv) => (await srv.statoCorrente()).votazione;

test("e2e: la serata parte con pesi 3/3/3/1, voti 4–10 e le etichette di partenza", () =>
  conServer({}, async (srv) => {
    assert.deepEqual(await votazione(srv), PREDEFINITA);
  }));

test("e2e: POST /api/votazione cambia intervallo, pesi ed etichette e GET /api/stato li mostra", () =>
  conServer({}, async (srv) => {
    const r = await srv.api("votazione", { min: 5, max: 9, pesi: { chat: 2 }, etichette: { beat: "Strumentale" } });
    assert.equal(r.ok, true);
    const v = await votazione(srv);
    assert.deepEqual([v.min, v.max, v.pesi, v.etichette.beat, v.etichette.voce], [5, 9, { beat: 3, voce: 3, mix: 3, chat: 2 }, "Strumentale", "Voce"]);

    // un valore sbagliato dice perché e non cambia niente, nemmeno i valori buoni mandati insieme
    const no = await srv.api("votazione", { min: 9, pesi: { beat: 50 } });
    assert.equal(no.ok, false);
    assert.match(no.errore, /Il voto minimo deve essere più basso del massimo/);
    assert.deepEqual(await votazione(srv), v);
    const peso = await srv.api("votazione", { pesi: { beat: 0, voce: 0, mix: 0, chat: 0 } });
    assert.equal(peso.ok, false);
    assert.match(peso.errore, /Almeno un peso/);
  }));

test("e2e: il voto di un giudice sotto il minimo è rifiutato, e dopo aver abbassato il minimo passa", () =>
  conServer({}, async (srv) => {
    const no = await srv.api("voto", { categoria: "beat", valore: 3 });
    assert.equal(no.ok, false);
    assert.match(no.errore, /Il voto deve essere tra 4 e 10/);
    assert.equal((await srv.api("voto", { categoria: "beat", valore: 4 })).ok, true);
    assert.equal((await srv.api("votazione", { min: 0 })).ok, true);
    assert.equal((await srv.api("voto", { categoria: "voce", valore: 3 })).ok, true);
    const { corrente } = await srv.statoCorrente();
    assert.deepEqual([corrente.punteggi.beat, corrente.punteggi.voce], [4, 3]);
  }));

test("e2e: con il voto chat aperto un commento «3» non vota e «5» sì", () =>
  conServer({}, async (srv) => {
    assert.equal((await srv.api("apriChat", { secondi: 0 })).ok, true);
    const commenta = async (utente, testo) => (await srv.api("messaggioChat", { piattaforma: "tiktok", utente, testo })).dati.contato;
    assert.equal(await commenta("mario", "3"), false);
    assert.equal(await commenta("mario", "!voto 3"), false);
    assert.equal(await commenta("mario", "3.9"), false);
    assert.equal((await srv.statoCorrente()).corrente.punteggi.chatVoti, 0);
    assert.equal(await commenta("mario", "5"), true);
    assert.equal(await commenta("luca", "9/10"), true);
    const { corrente } = await srv.statoCorrente();
    assert.deepEqual([corrente.punteggi.chatVoti, corrente.punteggi.chat], [2, 7]);

    // con l'intervallo allargato il «3» è un voto
    await srv.api("votazione", { min: 0 });
    assert.equal(await commenta("anna", "3"), true);
  }));

test("e2e: voti 8, 8, 8 e chat 4 danno 7,6 alla conferma (giudici 30% ciascuno, chat 10%)", () =>
  conServer({}, async (srv) => {
    for (const categoria of ["beat", "voce", "mix"]) await srv.api("voto", { categoria, valore: 8 });
    await srv.api("apriChat", { secondi: 0 });
    await srv.api("messaggioChat", { piattaforma: "tiktok", utente: "mario", testo: "4" });
    const r = await srv.api("conferma");
    assert.equal(r.ok, true);
    assert.equal(r.dati.risultato.totale, 7.6);
    assert.equal((await srv.statoCorrente()).classifica[0].totale, 7.6);
  }));

test("e2e: un config.json con i vecchi pesi 1/1/1/1 parte con 3/3/3/1, uno con pesi scelti a mano li tiene", async () => {
  // il config copiato dal modello di prima: pesi uguali e nessun votoMin, votoMax ed etichette
  await conServer({ config: { pesi: { beat: 1, voce: 1, mix: 1, chat: 1 } } }, async (srv) => {
    assert.deepEqual(await votazione(srv), PREDEFINITA);
  });
  await conServer({ config: { pesi: { beat: 2, voce: 2, mix: 2, chat: 1 } } }, async (srv) => {
    assert.deepEqual((await votazione(srv)).pesi, { beat: 2, voce: 2, mix: 2, chat: 1 });
  });
  // pesi uguali ma non quelli del vecchio modello (2/2/2/2) sono una scelta: restano
  await conServer({ config: { pesi: { beat: 2, voce: 2, mix: 2, chat: 2 } } }, async (srv) => {
    assert.deepEqual((await votazione(srv)).pesi, { beat: 2, voce: 2, mix: 2, chat: 2 });
  });
});

test("e2e: votoMin, votoMax ed etichette del config.json sono i valori di partenza", () =>
  conServer({ config: { votoMin: 5, votoMax: 9, etichette: { beat: "Strumentale", chat: "Pubblico" } } }, async (srv) => {
    assert.deepEqual(await votazione(srv), { ...PREDEFINITA, min: 5, max: 9, etichette: { beat: "Strumentale", voce: "Voce", mix: "Mix", chat: "Pubblico" } });
    // e il commento «4» non vota più
    await srv.api("apriChat", { secondi: 0 });
    assert.equal((await srv.api("messaggioChat", { piattaforma: "tiktok", utente: "mario", testo: "4" })).dati.contato, false);
  }));

test("e2e: uno stato.json senza votazione parte con i predefiniti e non perde i dati che c'erano", () => {
  const risultato = { id: "r1", titolo: "Specchi Neri", artista: "Nove", tier: null, beat: 8, voce: 8, mix: 8, chat: 8, chatVoti: 3, totale: 8, confermatoAlle: 1000 };
  return conServer({ stato: { premio: "Premio salvato", risultati: [risultato] } }, async (srv) => {
    assert.deepEqual(await votazione(srv), PREDEFINITA);
    const s = await srv.statoCorrente();
    assert.equal(s.premio, "Premio salvato");
    assert.deepEqual(s.risultati.map((r) => [r.titolo, r.totale]), [["Specchi Neri", 8]], "i risultati già confermati restano come sono");
  });
});

test("e2e: uno stato.json con una votazione la tiene e ripara i valori rotti campo per campo", () =>
  conServer(
    { stato: { votazione: { pesi: { beat: 2, voce: "x" }, min: 6, max: 3, etichette: { beat: "Strumentale", voce: "" } } } },
    async (srv) => {
      assert.deepEqual(await votazione(srv), { pesi: { beat: 2, voce: 3, mix: 3, chat: 1 }, min: 6, max: 10, etichette: { beat: "Strumentale", voce: "Voce", mix: "Mix", chat: "Chat" } });
    },
  ));

test("e2e: «nuova serata» e «demo» conservano la votazione scelta", () =>
  conServer({}, async (srv) => {
    await srv.api("votazione", { min: 5, pesi: { chat: 2 }, etichette: { chat: "Pubblico" } });
    const scelta = await votazione(srv);
    assert.equal(scelta.min, 5);
    assert.equal((await srv.api("nuovaSerata")).ok, true);
    assert.deepEqual(await votazione(srv), scelta);
    assert.equal((await srv.api("demo")).ok, true);
    assert.deepEqual(await votazione(srv), scelta);
  }));

test("e2e: la chat simulata sta dentro l'intervallo della votazione", () =>
  conServer({}, async (srv) => {
    await srv.api("votazione", { min: 9 });
    await srv.api("apriChat", { secondi: 0 });
    assert.equal((await srv.api("simulaChat", { quanti: 40 })).ok, true);
    const { corrente } = await srv.statoCorrente();
    assert.ok(corrente.punteggi.chatVoti > 0);
    assert.ok(corrente.punteggi.chat >= 9 && corrente.punteggi.chat <= 10, `media della chat simulata: ${corrente.punteggi.chat}`);
  }));
