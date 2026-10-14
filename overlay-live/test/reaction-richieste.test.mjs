// Reaction Release: scaletta della serata, regalo che fa partire le richieste e coda delle richieste (stato e server).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../lib/formati.mjs";
import { avviaServer } from "./aiuti-server.mjs";

const nuova = () => ({ reaction: F.reactionIniziale() });

test("scaletta: 8 voci ok e 9 errore; voce da 60 caratteri ok e da 61 errore; modo e tempi con i loro limiti; un errore non cambia niente", () => {
  const s = nuova();
  F.impostaReaction(s, { scaletta: { voci: Array.from({ length: 8 }, (_, i) => `Brano ${i + 1}`) } });
  assert.equal(s.reaction.scaletta.voci.length, 8);
  const prima = structuredClone(s.reaction);
  assert.throws(() => F.impostaReaction(s, { scaletta: { voci: Array.from({ length: 9 }, (_, i) => `B${i}`) } }), /8/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { voci: ["x".repeat(61)] } }), /60/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { voci: ["ok", " "] } }), /vuot/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { voci: "Brano" } }), /elenco/i);
  assert.throws(() => F.impostaReaction(s, { scaletta: { modo: "boh" } }), /fisso|comparsa/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { titolo: "x".repeat(33) } }), /32/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { ogniMinuti: 0 } }), /1/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { ogniMinuti: 61 } }), /60/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { durataSecondi: 4 } }), /5/);
  assert.throws(() => F.impostaReaction(s, { scaletta: { durataSecondi: 121 } }), /120/);
  assert.throws(() => F.impostaReaction(s, { durataRichiesta: 2 }), /3/);
  assert.throws(() => F.impostaReaction(s, { durataRichiesta: 61 }), /60/);
  assert.throws(() => F.impostaReaction(s, { regalo: "x".repeat(41) }), /40/);
  assert.throws(() => F.impostaReaction(s, { velocita: 100, scaletta: { modo: "boh" } }));
  assert.deepEqual(s.reaction, prima, "un errore lascia lo stato com'era");
  F.impostaReaction(s, { scaletta: { titolo: "Stasera", modo: "comparsa", ogniMinuti: 3, durataSecondi: 20, voci: ["x".repeat(60)] }, durataRichiesta: 30, regalo: "Rose" });
  assert.deepEqual([s.reaction.scaletta.titolo, s.reaction.scaletta.modo, s.reaction.scaletta.ogniMinuti, s.reaction.scaletta.durataSecondi, s.reaction.durataRichiesta, s.reaction.richieste.regalo], ["Stasera", "comparsa", 3, 20, 30, "Rose"]);
  F.impostaReaction(s, { regalo: "" });
  assert.equal(s.reaction.richieste.regalo, "", "regalo vuoto = richieste spente");
});

test("fondiReaction: uno stato senza scaletta, richieste o durata le ritrova; campo per campo", () => {
  const vecchio = F.fondiReaction({ velocita: 100, titolo: { testo: "Titolo X" } });
  assert.deepEqual(vecchio.scaletta, F.reactionIniziale().scaletta);
  assert.deepEqual(vecchio.richieste, { regalo: "", coda: [] });
  assert.equal(vecchio.durataRichiesta, 10);
  const rotto = F.fondiReaction({ scaletta: { titolo: "Sera", voci: 5, modo: "comparsa", ogniMinuti: 999 }, durataRichiesta: "tanto", richieste: { regalo: "Rose", coda: [{ id: "a", utente: "mario", stato: "attesa" }, "no"] } });
  assert.deepEqual([rotto.scaletta.titolo, rotto.scaletta.voci, rotto.scaletta.modo, rotto.scaletta.ogniMinuti], ["Sera", [], "comparsa", 5]);
  assert.equal(rotto.durataRichiesta, 10);
  assert.equal(rotto.richieste.regalo, "Rose");
  assert.deepEqual(rotto.richieste.coda.map((r) => r.id), ["a"]);
});

async function conServer(opzioni, prova) {
  const srv = await avviaServer(opzioni);
  try {
    await prova(srv);
  } finally {
    await srv.ferma();
  }
}

test("e2e: con un regalo scelto, regaloEvento crea una richiesta in coda (solo con la Reaction in onda); senza regalo no", () =>
  conServer({}, async (srv) => {
    await srv.api("layout", { nome: "reaction" });
    await srv.api("regaloEvento", { nome: "Rose", utente: "mario" });
    assert.deepEqual((await srv.statoCorrente()).reaction.richieste.coda, [], "regalo non scelto: nessuna richiesta");
    assert.equal((await srv.api("reaction", { regalo: "Rose" })).ok, true);
    assert.equal((await srv.api("regaloEvento", { nome: "rose", utente: "mario", quantita: 2 })).ok, true);
    await srv.api("regaloEvento", { nome: "Leone", utente: "lucia" });
    const coda = (await srv.statoCorrente()).reaction.richieste.coda;
    assert.deepEqual(coda.map((r) => [r.utente, r.quantita, r.stato]), [["mario", 2, "attesa"]]);
    await srv.api("layout", { nome: "gara" });
    await srv.api("regaloEvento", { nome: "Rose", utente: "anna" });
    assert.equal((await srv.statoCorrente()).reaction.richieste.coda.length, 1, "con un altro layout in onda le richieste non si accodano");
  }));

test("e2e: richiesta inOnda con il titolo la mette in onda, fatta la chiude, scarta la toglie; nuova serata svuota la coda e tiene scaletta e regalo", () =>
  conServer({}, async (srv) => {
    await srv.api("layout", { nome: "reaction" });
    await srv.api("reaction", { regalo: "Rose", scaletta: { titolo: "Stasera", voci: ["Uno", "Due"] } });
    await srv.api("regaloEvento", { nome: "Rose", utente: "mario" });
    await srv.api("regaloEvento", { nome: "Rose", utente: "lucia" });
    let [a, b] = (await srv.statoCorrente()).reaction.richieste.coda;
    assert.equal((await srv.api("richiesta", { formato: "reaction", azione: "inOnda", id: a.id })).ok, false, "serve il brano");
    assert.equal((await srv.api("richiesta", { formato: "reaction", azione: "inOnda", id: a.id, brano: { titolo: "Satellite", artista: "Mira" } })).ok, true);
    let coda = (await srv.statoCorrente()).reaction.richieste.coda;
    assert.deepEqual([coda[0].stato, coda[0].brano.titolo, coda[1].stato], ["inOnda", "Satellite", "attesa"]);
    assert.equal((await srv.api("richiesta", { formato: "reaction", azione: "fatta", id: a.id })).ok, true);
    assert.equal((await srv.api("richiesta", { formato: "reaction", azione: "scarta", id: b.id })).ok, true);
    coda = (await srv.statoCorrente()).reaction.richieste.coda;
    assert.deepEqual(coda.map((r) => r.stato), ["fatta"]);
    assert.equal((await srv.api("richiesta", { formato: "boh", azione: "fatta", id: a.id })).ok, false);
    assert.equal((await srv.api("richiesta", { formato: "reaction", azione: "fatta", id: "non-esiste" })).ok, false);
    assert.equal((await srv.api("nuovaSerata")).ok, true);
    const r = (await srv.statoCorrente()).reaction;
    assert.deepEqual([r.richieste.coda.length, r.richieste.regalo, r.scaletta.titolo, r.scaletta.voci], [0, "Rose", "Stasera", ["Uno", "Due"]]);
  }));

test("e2e: scalettaMostra emette l'evento; i widget reScaletta e reRichiesta partono accesi", () =>
  conServer({}, async (srv) => {
    const ws = await srv.apriWs();
    assert.equal((await srv.api("scalettaMostra")).ok, true);
    await new Promise((ok) => setTimeout(ok, 150));
    assert.ok(ws.eventi.some((e) => e.nome === "scalettaMostra"));
    ws.chiudi();
    const s = await srv.statoCorrente();
    assert.deepEqual([s.visibili.reScaletta, s.visibili.reRichiesta], [true, true]);
  }));
