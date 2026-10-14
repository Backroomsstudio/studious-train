// Regali di TikTok: il confronto con il regalo scelto in regia, l'elenco dei «regali visti» e la coda delle richieste.
// Funzioni pure sullo stato di un formato (Reaction o Drum), che tiene { regalo, coda }.
import { test } from "node:test";
import assert from "node:assert/strict";
import { regaloCorrisponde, registraVisto, richiesteIniziali, impostaMappatura, aggiungiRichiesta, segnaRichiesta, controllaRichieste } from "../lib/regali.mjs";

// Un regalo come lo dà regaloTikTok.
const regalo = (campi = {}) => ({ utente: "mario_99", nome: "Rose", id: 5655, quantita: 1, ...campi });
const con = (mappatura) => ({ ...richiesteIniziali(), regalo: mappatura });

test("richiesteIniziali: nessun regalo scelto e coda vuota", () => {
  assert.deepEqual(richiesteIniziali(), { regalo: "", coda: [] });
  assert.notEqual(richiesteIniziali().coda, richiesteIniziali().coda, "ogni volta una coda nuova");
});

test("mappatura vuota non fa partire richieste", () => {
  for (const vuota of ["", "   ", undefined, null, 0, {}, []]) {
    assert.equal(regaloCorrisponde(regalo(), vuota), false, JSON.stringify(vuota));
    const r = con(vuota);
    assert.equal(aggiungiRichiesta(r, regalo(), 1000), null, JSON.stringify(vuota));
    assert.deepEqual(r.coda, []);
  }
});

test("regaloCorrisponde: per nome senza maiuscole («rose» = «Rose») e per ID («5655»)", () => {
  for (const mappatura of ["Rose", "rose", "ROSE", "  rose  "]) assert.equal(regaloCorrisponde(regalo(), mappatura), true, mappatura);
  assert.equal(regaloCorrisponde(regalo(), "Rosa"), false);
  assert.equal(regaloCorrisponde(regalo(), "Ros"), false, "il nome intero, non una parte");
  // una mappatura di sole cifre è un ID: si confronta con l'ID e non con il nome
  assert.equal(regaloCorrisponde(regalo(), "5655"), true);
  assert.equal(regaloCorrisponde(regalo(), " 5655 "), true);
  assert.equal(regaloCorrisponde(regalo(), 5655), true, "anche scritta come numero");
  assert.equal(regaloCorrisponde(regalo(), "5656"), false);
  assert.equal(regaloCorrisponde(regalo({ id: null }), "5655"), false, "un regalo senza ID non corrisponde a un ID");
  assert.equal(regaloCorrisponde(regalo({ nome: "5655", id: 1 }), "5655"), false, "le cifre sono un ID: un regalo che si chiama così non conta");
  assert.equal(regaloCorrisponde(regalo({ nome: "" }), "Rose"), false, "un regalo senza nome non corrisponde a un nome");
  assert.equal(regaloCorrisponde(regalo({ nome: "" }), "5655"), true, "ma per ID sì");
  // regali o mappature malformati: mai un'eccezione
  for (const rotto of [null, undefined, 7, "Rose", {}, { nome: 5, id: "x" }]) assert.equal(regaloCorrisponde(rotto, "Rose"), false, JSON.stringify(rotto));
});

test("lo stesso donatore due volte = due richieste, ognuna con la sua quantità", () => {
  const r = con("rose");
  const a = aggiungiRichiesta(r, regalo({ quantita: 3 }), 1000);
  const b = aggiungiRichiesta(r, regalo({ quantita: 1 }), 2000);
  assert.equal(r.coda.length, 2);
  assert.notEqual(a.id, b.id);
  assert.deepEqual({ ...a, id: undefined }, { id: undefined, utente: "mario_99", nome: "Rose", quantita: 3, alle: 1000, stato: "attesa", brano: null });
  assert.deepEqual(r.coda.map((x) => [x.quantita, x.alle]), [[3, 1000], [1, 2000]]);
  assert.equal(aggiungiRichiesta(r, regalo({ nome: "Galaxy", id: 6001 }), 3000), null, "un altro regalo non parte");
  assert.equal(r.coda.length, 2);
});

test("oltre 30 richieste escono le più vecchie", () => {
  const r = con("rose");
  for (let i = 0; i < 33; i++) aggiungiRichiesta(r, regalo({ utente: `u${i}` }), 1000 + i);
  assert.equal(r.coda.length, 30);
  assert.deepEqual([r.coda[0].utente, r.coda.at(-1).utente], ["u3", "u32"]);
});

test("la richiesta in onda non esce dalla coda, nemmeno se è la più vecchia", () => {
  const r = con("rose");
  const prima = aggiungiRichiesta(r, regalo({ utente: "prima" }), 1);
  for (let i = 0; i < 29; i++) aggiungiRichiesta(r, regalo({ utente: `u${i}` }), 10 + i);
  segnaRichiesta(r, { id: prima.id, azione: "inOnda", brano: { titolo: "Brano" } });
  for (let i = 0; i < 5; i++) aggiungiRichiesta(r, regalo({ utente: `n${i}` }), 100 + i);
  assert.equal(r.coda.length, 30);
  assert.equal(r.coda[0].utente, "prima", "quella in onda resta");
  assert.deepEqual([r.coda[1].utente, r.coda.at(-1).utente], ["u5", "n4"], "escono le più vecchie tra le altre");
});

test("inOnda: una sola alla volta, serve un titolo, errori in italiano", () => {
  const r = con("rose");
  const a = aggiungiRichiesta(r, regalo({ utente: "a" }), 1);
  const b = aggiungiRichiesta(r, regalo({ utente: "b" }), 2);
  const stati = () => r.coda.map((x) => x.stato);

  segnaRichiesta(r, { id: a.id, azione: "inOnda", brano: { titolo: "  Notti a Vicenza  ", artista: "Lince" } });
  assert.deepEqual(stati(), ["inOnda", "attesa"]);
  assert.deepEqual(r.coda[0].brano, { titolo: "Notti a Vicenza", artista: "Lince" }, "i testi si ripuliscono dagli spazi");

  segnaRichiesta(r, { id: b.id, azione: "inOnda", brano: { titolo: "Asfalto" } });
  assert.deepEqual(stati(), ["attesa", "inOnda"], "la prima torna in attesa");
  assert.deepEqual(r.coda[1].brano, { titolo: "Asfalto", artista: "" }, "l'artista può mancare");

  const prima = structuredClone(r);
  const casi = [
    [{ id: a.id, azione: "inOnda" }, /Brano: scrivi almeno il titolo/],
    [{ id: a.id, azione: "inOnda", brano: {} }, /Titolo del brano: non può essere vuoto/],
    [{ id: a.id, azione: "inOnda", brano: { titolo: "   " } }, /non può essere vuoto/],
    [{ id: a.id, azione: "inOnda", brano: { titolo: 7 } }, /serve un testo/],
    [{ id: a.id, azione: "inOnda", brano: { titolo: "x".repeat(61) } }, /al massimo 60 caratteri/],
    [{ id: a.id, azione: "inOnda", brano: { titolo: "ok", artista: "y".repeat(41) } }, /Artista del brano: al massimo 40 caratteri/],
    [{ id: "inesistente", azione: "fatta" }, /Richiesta non più in coda/],
    [{ id: a.id, azione: "boh" }, /Azione sulla richiesta non valida/],
    [{ azione: "fatta" }, /Richiesta non più in coda/],
  ];
  for (const [args, atteso] of casi) {
    assert.throws(() => segnaRichiesta(r, args), atteso, JSON.stringify(args));
    assert.deepEqual(r, prima, `niente cambia: ${JSON.stringify(args)}`);
  }
  assert.doesNotThrow(() => segnaRichiesta(r, { id: a.id, azione: "inOnda", brano: { titolo: "x".repeat(60), artista: "y".repeat(40) } }), "60 e 40 sono i massimi");
});

test("fatta e scarta", () => {
  const r = con("rose");
  const [a, b, c] = ["a", "b", "c"].map((u, i) => aggiungiRichiesta(r, regalo({ utente: u }), i));
  segnaRichiesta(r, { id: a.id, azione: "inOnda", brano: { titolo: "Uno", artista: "X" } });
  segnaRichiesta(r, { id: a.id, azione: "fatta" });
  assert.deepEqual([r.coda[0].stato, r.coda[0].brano], ["fatta", { titolo: "Uno", artista: "X" }], "da fatta resta il brano");
  segnaRichiesta(r, { id: b.id, azione: "fatta" });
  assert.equal(r.coda[1].stato, "fatta", "si può chiudere anche senza averla messa in onda");
  const tolta = segnaRichiesta(r, { id: c.id, azione: "scarta" });
  assert.equal(tolta.id, c.id);
  assert.deepEqual(r.coda.map((x) => x.utente), ["a", "b"]);
  assert.throws(() => segnaRichiesta(r, { id: c.id, azione: "scarta" }), /non più in coda/, "una volta sola");
  // scartare quella in onda la toglie e lascia in onda nessuna
  const d = aggiungiRichiesta(r, regalo({ utente: "d" }), 9);
  segnaRichiesta(r, { id: d.id, azione: "inOnda", brano: { titolo: "Due" } });
  segnaRichiesta(r, { id: d.id, azione: "scarta" });
  assert.equal(r.coda.some((x) => x.stato === "inOnda"), false);
});

test("regali visti: ultimi 12 distinti per nome e ID, il più recente in cima, con l'ultimo utente", () => {
  let visti = [];
  visti = registraVisto(visti, regalo({ nome: "Rose", id: 5655, utente: "a" }), 1);
  visti = registraVisto(visti, regalo({ nome: "Galaxy", id: 6001, utente: "b" }), 2);
  assert.deepEqual(visti, [
    { nome: "Galaxy", id: 6001, utente: "b", alle: 2 },
    { nome: "Rose", id: 5655, utente: "a", alle: 1 },
  ]);
  // lo stesso regalo (anche con le maiuscole diverse) risale in cima con l'ultimo utente, senza doppioni
  visti = registraVisto(visti, regalo({ nome: "ROSE", id: 5655, utente: "c" }), 3);
  assert.deepEqual(visti.map((v) => [v.nome, v.utente, v.alle]), [["ROSE", "c", 3], ["Galaxy", "b", 2]]);
  // 14 regali diversi: restano gli ultimi 12
  for (let i = 0; i < 14; i++) visti = registraVisto(visti, regalo({ nome: `Regalo ${i}`, id: 100 + i, utente: "x" }), 10 + i);
  assert.equal(visti.length, 12);
  assert.deepEqual([visti[0].nome, visti.at(-1).nome], ["Regalo 13", "Regalo 2"]);
  // un regalo con solo il nome e uno con solo l'ID sono due cose
  const misti = registraVisto(registraVisto([], regalo({ nome: "Rose", id: null }), 1), regalo({ nome: "", id: 5655 }), 2);
  assert.equal(misti.length, 2);
});

test("regali visti: non modifica l'elenco ricevuto e ignora i regali senza nome né ID e gli elenchi rotti", () => {
  const prima = [{ nome: "Rose", id: 5655, utente: "a", alle: 1 }];
  const copia = structuredClone(prima);
  const dopo = registraVisto(prima, regalo({ nome: "Galaxy", id: 6001 }), 2);
  assert.deepEqual(prima, copia);
  assert.notEqual(dopo, prima);
  assert.deepEqual(registraVisto(prima, regalo({ nome: "", id: null }), 3), prima);
  assert.deepEqual(registraVisto(prima, null, 3), prima);
  for (const rotto of [undefined, null, "x", 7, {}]) assert.deepEqual(registraVisto(rotto, regalo(), 1).map((v) => v.nome), ["Rose"], JSON.stringify(rotto));
});

test("impostaMappatura: il regalo che fa partire le richieste, fino a 40 caratteri e anche vuoto", () => {
  const r = richiesteIniziali();
  impostaMappatura(r, "  Rose ");
  assert.equal(r.regalo, "Rose");
  impostaMappatura(r, "5655");
  assert.equal(r.regalo, "5655");
  impostaMappatura(r, "");
  assert.equal(r.regalo, "", "vuoto = nessuna richiesta");
  impostaMappatura(r, "x".repeat(40));
  assert.throws(() => impostaMappatura(r, "x".repeat(41)), /al massimo 40 caratteri/);
  assert.throws(() => impostaMappatura(r, 7), /serve un testo/);
  assert.throws(() => impostaMappatura(r, undefined), /serve un testo/);
  assert.equal(r.regalo.length, 40, "un errore non cambia niente");
});

test("controllaRichieste: dati rotti → richieste vuote, quelle valide si tengono", () => {
  for (const rotto of [undefined, null, "x", 7, [], true]) assert.deepEqual(controllaRichieste(rotto), { regalo: "", coda: [] }, JSON.stringify(rotto));
  assert.deepEqual(controllaRichieste({ regalo: 7, coda: "x" }), { regalo: "", coda: [] });
  const buona = { id: "r1", utente: "mario", nome: "Rose", quantita: 3, alle: 1234, stato: "inOnda", brano: { titolo: "Notti", artista: "Lince" } };
  assert.deepEqual(controllaRichieste({ regalo: " Rose ", coda: [buona] }), { regalo: "Rose", coda: [buona] }, "una richiesta valida passa com'è");

  const sporche = [
    null,
    "x",
    7,
    { utente: "senza id" },
    { id: "", utente: "id vuoto" },
    { id: "r2", utente: "mario", nome: "Rose", quantita: -4, alle: "domani", stato: "boh", brano: "x" },
    { id: "r3", utente: 5, nome: ["x"], quantita: 2.7, alle: Infinity, stato: "fatta", brano: { titolo: "", artista: "x" } },
    { id: "r1", utente: "doppione" },
  ];
  const r = controllaRichieste({ regalo: "Rose", coda: [buona, ...sporche] });
  assert.deepEqual(r.coda.map((x) => x.id), ["r1", "r2", "r3"], "scartati i non oggetti, quelli senza id e il doppione");
  assert.deepEqual(r.coda[1], { id: "r2", utente: "mario", nome: "Rose", quantita: 1, alle: 0, stato: "attesa", brano: null }, "i campi rotti tornano di partenza");
  assert.deepEqual(r.coda[2], { id: "r3", utente: "", nome: "", quantita: 2, alle: 0, stato: "fatta", brano: null });
  assert.equal(r.coda[0].stato, "inOnda");
});

test("controllaRichieste: al massimo 30 (le più recenti), una sola in onda (l'ultima) e in onda solo con un brano", () => {
  const voce = (i, campi = {}) => ({ id: `r${i}`, utente: "u", nome: "Rose", quantita: 1, alle: i, stato: "attesa", brano: null, ...campi });
  const tante = controllaRichieste({ regalo: "Rose", coda: Array.from({ length: 35 }, (_, i) => voce(i)) });
  assert.deepEqual([tante.coda.length, tante.coda[0].id, tante.coda.at(-1).id], [30, "r5", "r34"]);
  const onda = (i) => voce(i, { stato: "inOnda", brano: { titolo: `B${i}`, artista: "" } });
  const due = controllaRichieste({ regalo: "x", coda: [onda(1), voce(2), onda(3)] });
  assert.deepEqual(due.coda.map((x) => x.stato), ["attesa", "attesa", "inOnda"]);
  const senzaBrano = controllaRichieste({ regalo: "x", coda: [voce(1, { stato: "inOnda" })] });
  assert.deepEqual([senzaBrano.coda[0].stato, senzaBrano.coda[0].brano], ["attesa", null], "in onda senza brano non ha senso");
  // la fusione non modifica quello che riceve
  const ricevuto = { regalo: "Rose", coda: [onda(1)] };
  const copia = structuredClone(ricevuto);
  controllaRichieste(ricevuto);
  assert.deepEqual(ricevuto, copia);
});
