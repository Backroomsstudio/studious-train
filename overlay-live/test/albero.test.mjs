// Tabellone ad albero: costruisciAlbero disegna un tabellone dai risultati confermati della serata (la classifica); è solo un
// disegno, nessuno scontro vero. Funzione pura: nessun server, nessun browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { costruisciAlbero } from "../lib/albero.mjs";
import * as S from "../lib/stato.mjs";
import { confronta } from "../lib/stato.mjs";

// n risultati con il totale che scende: r1 è il primo, r2 il secondo… (confermati uno dopo l'altro).
const risultati = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, titolo: `Titolo ${i + 1}`, artista: `Artista ${i + 1}`, totale: 10 - i * 0.25, confermatoAlle: 1000 + i }));

// Le partite di un turno come «posto-posto» (i posti vuoti sono «—»).
const coppie = (turno) => turno.partite.map((p) => `${p.a?.posto ?? "—"}-${p.b?.posto ?? "—"}`);
const nomi = (albero) => albero.turni.map((t) => t.nome);

test("meno di 2 risultati → null (anche con elenchi sbagliati)", () => {
  assert.equal(costruisciAlbero([]), null);
  assert.equal(costruisciAlbero(risultati(1)), null);
  for (const sbagliato of [undefined, null, "r1", 7, {}]) assert.equal(costruisciAlbero(sbagliato), null, String(sbagliato));
});

test("4 risultati: dimensione 4, semifinali 1° contro 4° e 2° contro 3°, poi la finale tra i vincitori", () => {
  const a = costruisciAlbero(risultati(4));
  assert.equal(a.dimensione, 4);
  assert.equal(a.esclusi, 0);
  assert.deepEqual(nomi(a), ["Semifinali", "Finale"]);
  assert.deepEqual(coppie(a.turni[0]), ["1-4", "2-3"]);
  assert.deepEqual(a.turni[0].partite.map((p) => p.vince), ["a", "a"], "vince il totale più alto");
  assert.deepEqual(coppie(a.turni[1]), ["1-2"], "la finale è tra i vincitori delle semifinali");
  assert.equal(a.turni[1].partite[0].vince, "a");
  // ogni lato porta titolo, artista, totale e posto in classifica
  assert.deepEqual(a.turni[0].partite[0].a, { id: "r1", titolo: "Titolo 1", artista: "Artista 1", totale: 10, posto: 1 });
  assert.deepEqual(a.turni[0].partite[0].b, { id: "r4", titolo: "Titolo 4", artista: "Artista 4", totale: 9.25, posto: 4 });
});

test("2 e 3 risultati: dimensione 4 con i posti vuoti che danno il passaggio", () => {
  const due = costruisciAlbero(risultati(2));
  assert.equal(due.dimensione, 4);
  assert.deepEqual(coppie(due.turni[0]), ["1-—", "2-—"]);
  assert.deepEqual(coppie(due.turni[1]), ["1-2"]);
  const tre = costruisciAlbero(risultati(3));
  assert.deepEqual(coppie(tre.turni[0]), ["1-—", "2-3"]);
  assert.deepEqual(coppie(tre.turni[1]), ["1-2"]);
});

test("5 risultati: dimensione 8, i posti 6, 7 e 8 vuoti danno il passaggio alle teste 3, 2 e 1", () => {
  const a = costruisciAlbero(risultati(5));
  assert.equal(a.dimensione, 8);
  assert.deepEqual(nomi(a), ["Quarti di finale", "Semifinali", "Finale"]);
  assert.deepEqual(coppie(a.turni[0]), ["1-—", "4-5", "2-—", "3-—"]);
  const [uno, quattro, due, tre] = a.turni[0].partite;
  for (const p of [uno, due, tre]) assert.deepEqual([p.b, p.vince], [null, "a"], "contro un posto vuoto passa la testa di serie");
  assert.equal(quattro.vince, "a", "4° contro 5°: vince il totale più alto");
  assert.deepEqual(coppie(a.turni[1]), ["1-4", "2-3"]);
  assert.deepEqual(coppie(a.turni[2]), ["1-2"]);
});

test("16 risultati: ottavi 1-16, 8-9, 4-13, 5-12, 2-15, 7-10, 3-14, 6-11 e poi quarti, semifinali e finale", () => {
  const a = costruisciAlbero(risultati(16));
  assert.equal(a.dimensione, 16);
  assert.equal(a.esclusi, 0);
  assert.deepEqual(nomi(a), ["Ottavi di finale", "Quarti di finale", "Semifinali", "Finale"]);
  assert.deepEqual(coppie(a.turni[0]), ["1-16", "8-9", "4-13", "5-12", "2-15", "7-10", "3-14", "6-11"]);
  assert.deepEqual(coppie(a.turni[1]), ["1-8", "4-5", "2-7", "3-6"]);
  assert.deepEqual(coppie(a.turni[2]), ["1-4", "2-3"]);
  assert.deepEqual(coppie(a.turni[3]), ["1-2"], "1 e 2 si incontrano solo in finale");
  assert.deepEqual(a.turni.map((t) => t.partite.length), [8, 4, 2, 1]);
});

test("20 risultati: l'albero è dei primi 16 e gli altri 4 restano fuori", () => {
  const a = costruisciAlbero(risultati(20));
  assert.equal(a.dimensione, 16);
  assert.equal(a.esclusi, 4);
  const presenti = new Set(a.turni[0].partite.flatMap((p) => [p.a?.id, p.b?.id]));
  assert.deepEqual([...presenti].sort(), risultati(16).map((r) => r.id).sort());
});

test("massimo: si può abbassare (12 risultati con massimo 8 → dimensione 8, 4 esclusi) e valori strani tornano a 16", () => {
  const otto = costruisciAlbero(risultati(12), { massimo: 8 });
  assert.deepEqual([otto.dimensione, otto.esclusi], [8, 4]);
  assert.equal(costruisciAlbero(risultati(12), { massimo: 10 }).dimensione, 16, "10 posti stanno in un albero da 16");
  for (const strano of [0, 1, -3, 2.5, NaN, "otto", null, undefined]) {
    const a = costruisciAlbero(risultati(20), { massimo: strano });
    assert.ok([4, 16].includes(a.dimensione) && a.turni.length >= 2, `massimo ${strano}`);
  }
  assert.equal(costruisciAlbero(risultati(40), { massimo: 99 }).dimensione, 16, "mai più di 16");
  assert.equal(costruisciAlbero(risultati(40), { massimo: 99 }).esclusi, 24);
});

test("ordine come la classifica: totale più alto prima, a pari totale chi è stato confermato prima, qualunque sia l'ordine d'ingresso", () => {
  const rimescolati = [
    { id: "c", titolo: "C", artista: "x", totale: 7, confermatoAlle: 300 },
    { id: "a", titolo: "A", artista: "x", totale: 9, confermatoAlle: 100 },
    { id: "d", titolo: "D", artista: "x", totale: 7, confermatoAlle: 200 },
    { id: "b", titolo: "B", artista: "x", totale: 8, confermatoAlle: 400 },
  ];
  const a = costruisciAlbero(rimescolati);
  const posto = (id) => a.turni[0].partite.flatMap((p) => [p.a, p.b]).find((l) => l.id === id).posto;
  assert.deepEqual(["a", "b", "d", "c"].map(posto), [1, 2, 3, 4]);
});

test("pari merito: passa chi è stato confermato prima", () => {
  const pari = [
    { id: "tardi", titolo: "Tardi", artista: "x", totale: 8, confermatoAlle: 900 },
    { id: "presto", titolo: "Presto", artista: "x", totale: 8, confermatoAlle: 100 },
    { id: "basso", titolo: "Basso", artista: "x", totale: 5, confermatoAlle: 50 },
    { id: "ultimo", titolo: "Ultimo", artista: "x", totale: 4, confermatoAlle: 60 },
  ];
  const a = costruisciAlbero(pari);
  // semifinali: 1° (presto) contro 4° (ultimo), 2° (tardi) contro 3° (basso); finale presto contro tardi
  assert.deepEqual(a.turni[0].partite.map((p) => [p.a.id, p.b.id, p.vince]), [["presto", "ultimo", "a"], ["tardi", "basso", "a"]]);
  const finale = a.turni[1].partite[0];
  assert.deepEqual([finale.a.id, finale.b.id, finale.vince], ["presto", "tardi", "a"]);
  // anche con totale e istante di conferma identici il risultato è lo stesso a ogni chiamata (decide l'ordine d'ingresso)
  const identici = ["x", "y", "z", "w"].map((id) => ({ id, titolo: id, artista: id, totale: 6, confermatoAlle: 1 }));
  assert.deepEqual(costruisciAlbero(identici), costruisciAlbero(identici));
  assert.deepEqual(costruisciAlbero(identici).turni[0].partite[0].a.id, "x");
});

test("non modifica l'elenco ricevuto e dà sempre lo stesso risultato", () => {
  const elenco = risultati(7).reverse();
  const copia = structuredClone(elenco);
  const primo = costruisciAlbero(elenco);
  assert.deepEqual(elenco, copia, "l'elenco ricevuto resta com'è, anche nell'ordine");
  assert.deepEqual(costruisciAlbero(elenco), primo);
  assert.deepEqual(costruisciAlbero(structuredClone(elenco)), primo);
  // i lati sono copie: cambiarli non tocca i risultati
  primo.turni[0].partite[0].a.titolo = "cambiato";
  assert.deepEqual(elenco, copia);
});

test("l'ordine delle teste è quello della classifica (confronta di lib/stato.mjs), anche con tanti pari merito", () => {
  // elenco di prova ripetibile: totali a mezzo punto (tanti uguali) e istanti di conferma in parte uguali
  let seme = 7;
  const caso = () => (seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648;
  const elenco = Array.from({ length: 16 }, (_, i) => ({ id: `r${i}`, titolo: `T${i}`, artista: "x", totale: 5 + Math.floor(caso() * 6) / 2, confermatoAlle: Math.floor(caso() * 4) * 100 }));
  const attesi = [...elenco].sort(confronta).map((r) => r.id);
  const lati = costruisciAlbero(elenco).turni[0].partite.flatMap((p) => [p.a, p.b]);
  assert.deepEqual(lati.sort((x, y) => x.posto - y.posto).map((l) => l.id), attesi);
});

// ---------- Stato: accendere e spegnere il tabellone ad albero ----------

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, topN: 3, premio: "Mix" };

test("il widget albero parte spento e lo stato ha durata 30 s e nessuna scadenza", () => {
  const stato = S.statoIniziale(config);
  assert.ok(S.WIDGET.includes("albero") && S.WIDGET_SPENTI.includes("albero"));
  assert.equal(stato.visibili.albero, false);
  assert.deepEqual(stato.albero, { durataSecondi: 30, finoAlle: null });
});

test("mostraAlbero accende il widget e imposta finoAlle = ora + durata (null con durata 0)", () => {
  const stato = S.statoIniziale(config);
  S.mostraAlbero(stato, {}, 1000);
  assert.equal(stato.visibili.albero, true);
  assert.equal(stato.albero.finoAlle, 31_000, "30 s di partenza");
  S.mostraAlbero(stato, { durataSecondi: 12 }, 2000);
  assert.deepEqual(stato.albero, { durataSecondi: 12, finoAlle: 14_000 });
  S.mostraAlbero(stato, {}, 5000);
  assert.equal(stato.albero.finoAlle, 17_000, "la durata scelta resta per le volte dopo");
  S.mostraAlbero(stato, { durataSecondi: 0 }, 6000);
  assert.deepEqual([stato.visibili.albero, stato.albero.finoAlle, stato.albero.durataSecondi], [true, null, 0], "durata 0: resta finché non lo spegni");
  S.mostraAlbero(stato, { durataSecondi: "45" }, 7000);
  assert.equal(stato.albero.finoAlle, 52_000, "anche un testo di cifre");
});

test("mostraAlbero con una durata fuori da 0–600 dà un errore in italiano e non cambia niente", () => {
  const stato = S.statoIniziale(config);
  for (const sbagliata of [601, -1, "tanto", NaN, null, {}]) {
    assert.throws(() => S.mostraAlbero(stato, { durataSecondi: sbagliata }, 1000), /Durata del tabellone .*: tra 0 e 600/, String(sbagliata));
    assert.deepEqual([stato.visibili.albero, stato.albero], [false, { durataSecondi: 30, finoAlle: null }], String(sbagliata));
  }
  S.mostraAlbero(stato, { durataSecondi: 600 }, 0);
  assert.equal(stato.albero.finoAlle, 600_000);
});

test("chiudiAlberoSeScaduto lo spegne alla scadenza e solo allora; nascondiAlbero lo spegne subito", () => {
  const stato = S.statoIniziale(config);
  assert.equal(S.chiudiAlberoSeScaduto(stato, 10 ** 9), false, "spento: niente da chiudere");
  S.mostraAlbero(stato, { durataSecondi: 30 }, 0);
  assert.equal(S.chiudiAlberoSeScaduto(stato, 29_999), false);
  assert.equal(stato.visibili.albero, true);
  assert.equal(S.chiudiAlberoSeScaduto(stato, 30_000), true);
  assert.deepEqual([stato.visibili.albero, stato.albero.finoAlle], [false, null]);
  assert.equal(S.chiudiAlberoSeScaduto(stato, 40_000), false, "una volta sola");
  // durata 0: non si spegne mai da solo
  S.mostraAlbero(stato, { durataSecondi: 0 }, 0);
  assert.equal(S.chiudiAlberoSeScaduto(stato, 10 ** 12), false);
  assert.equal(stato.visibili.albero, true);
  // acceso a mano dal widget (senza scadenza) e poi spento: nascondiAlbero azzera anche la scadenza
  S.mostraAlbero(stato, { durataSecondi: 20 }, 0);
  S.nascondiAlbero(stato);
  assert.deepEqual([stato.visibili.albero, stato.albero.finoAlle], [false, null]);
});

test("fondiAlbero: stato vecchio o rotto → durata 30 e nessuna scadenza, i valori buoni restano", () => {
  for (const vuoto of [undefined, null, "rotto", 7, []]) assert.deepEqual(S.fondiAlbero(vuoto), { durataSecondi: 30, finoAlle: null }, String(vuoto));
  assert.deepEqual(S.fondiAlbero({ durataSecondi: 45, finoAlle: 99 }), { durataSecondi: 45, finoAlle: 99 });
  assert.deepEqual(S.fondiAlbero({ durataSecondi: 9999, finoAlle: "x" }), { durataSecondi: 30, finoAlle: null });
  assert.deepEqual(S.fondiAlbero({ durataSecondi: 0 }), { durataSecondi: 0, finoAlle: null });
  assert.deepEqual(S.fondiAlbero({ finoAlle: Infinity }), { durataSecondi: 30, finoAlle: null });
});

test("istantanea.albero porta durata, scadenza e il disegno dei risultati confermati", () => {
  const stato = S.statoIniziale(config);
  assert.deepEqual(S.istantanea(stato, config, 0).albero, { durataSecondi: 30, finoAlle: null, disegno: null });
  for (const [i, voto] of [9, 8, 7, 6].entries()) {
    stato.corrente = S.tracciaVuota({ titolo: `T${i}`, artista: `A${i}` });
    for (const categoria of S.CATEGORIE) S.impostaVoto(stato, { categoria, valore: voto });
    S.conferma(stato, config, 100 + i);
    if (i === 0) assert.equal(S.istantanea(stato, config, 0).albero.disegno, null, "con un solo risultato non c'è un albero");
  }
  S.mostraAlbero(stato, { durataSecondi: 20 }, 1000);
  const foto = S.istantanea(stato, config, 1000).albero;
  assert.deepEqual([foto.durataSecondi, foto.finoAlle, foto.disegno.dimensione], [20, 21_000, 4]);
  assert.deepEqual(foto.disegno.turni[0].partite.map((p) => [p.a.titolo, p.b.titolo]), [["T0", "T3"], ["T1", "T2"]]);
});
