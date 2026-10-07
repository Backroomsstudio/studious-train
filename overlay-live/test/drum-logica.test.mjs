// Parti pure della pagina del Drum: formato dei Like, finestra della colonna, testo della scaletta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formattaLike, etichettaLike, finestraScaletta, testoScaletta, titoloBrano, SBLOCCO } from "../public/js/drum-logica.js";
import { scalettaPredefinita, leggiScaletta } from "../lib/drum.mjs";

test("formattaLike: i punti delle migliaia anche sotto 10.000", () => {
  assert.deepEqual([0, 7, 999, 1000, 1234, 12480, 500000, 1000000].map(formattaLike), ["0", "7", "999", "1.000", "1.234", "12.480", "500.000", "1.000.000"]);
  assert.equal(formattaLike(1234.6), "1.235", "arrotonda");
});

test("etichettaLike: 12K, 1M, oppure il numero con i punti", () => {
  assert.deepEqual([1000, 12000, 500000, 1000000, 2000000, 1500, 750, 0, 1001].map(etichettaLike), ["1K", "12K", "500K", "1M", "2M", "1.500", "750", "0", "1.001"]);
});

test("finestraScaletta: l'ultima sbloccata, l'attiva e le successive", () => {
  const scaletta = scalettaPredefinita();
  const stati = (f) => f.voci.map((v) => v.stato);
  const indici = (f) => f.voci.map((v) => v.indice);
  let f = finestraScaletta(scaletta, 0);
  assert.equal(f.inizio, 0);
  assert.deepEqual(stati(f), ["attiva", "chiusa", "chiusa", "chiusa"]);
  f = finestraScaletta(scaletta, 1);
  assert.deepEqual([f.inizio, stati(f)], [0, ["sbloccata", "attiva", "chiusa", "chiusa"]]);
  f = finestraScaletta(scaletta, 7);
  assert.equal(f.inizio, 6);
  assert.deepEqual(indici(f), [6, 7, 8, 9]);
  assert.deepEqual(stati(f), ["sbloccata", "attiva", "chiusa", "chiusa"]);
  assert.deepEqual(f.voci[1], { indice: 7, like: 12000, titolo: "", stato: "attiva" });
  f = finestraScaletta(scaletta, 36);
  assert.deepEqual([f.inizio, stati(f)], [33, ["sbloccata", "sbloccata", "sbloccata", "attiva"]]);
  f = finestraScaletta(scaletta, 37);
  assert.deepEqual([f.inizio, stati(f)], [33, ["sbloccata", "sbloccata", "sbloccata", "sbloccata"]], "con tutte sbloccate, le ultime 4");
  assert.deepEqual(indici(f), [33, 34, 35, 36]);
  f = finestraScaletta(scaletta, 35);
  assert.deepEqual([f.inizio, indici(f)], [33, [33, 34, 35, 36]], "la finestra non va oltre la fine");
});

test("finestraScaletta: scalette corte e quante diverso", () => {
  const corta = scalettaPredefinita().slice(0, 2);
  assert.equal(finestraScaletta(corta, 0, 4).voci.length, 2);
  assert.deepEqual(finestraScaletta(corta, 0, 4).voci.map((v) => v.stato), ["attiva", "chiusa"]);
  const tutte = finestraScaletta(corta, 2, 4);
  assert.deepEqual([tutte.inizio, tutte.voci.map((v) => v.stato)], [0, ["sbloccata", "sbloccata"]], "mai un inizio negativo");
  assert.deepEqual(finestraScaletta(corta, 1, 4).voci.map((v) => v.stato), ["sbloccata", "attiva"]);
  assert.equal(finestraScaletta(scalettaPredefinita(), 10, 3).voci.length, 3);
  assert.deepEqual(finestraScaletta(scalettaPredefinita(), 10, 3).voci.map((v) => v.indice), [9, 10, 11]);
});

test("testoScaletta: una riga per tappa e il giro con leggiScaletta", () => {
  const scaletta = scalettaPredefinita();
  scaletta[0].titolo = "Back in Black";
  scaletta[2].titolo = "Titolo con | barra";
  const testo = testoScaletta(scaletta);
  assert.equal(testo.split("\n").length, 37);
  assert.equal(testo.split("\n")[0], "1000 | Back in Black");
  assert.equal(testo.split("\n")[1], "2000 |", "titolo vuoto: solo «like |»");
  assert.deepEqual(leggiScaletta(testo), scaletta);
  assert.deepEqual(leggiScaletta(testoScaletta(scalettaPredefinita())), scalettaPredefinita());
});

test("titoloBrano: senza titolo è un brano a sorpresa", () => {
  assert.equal(titoloBrano(""), "Brano a sorpresa");
  assert.equal(titoloBrano(undefined), "Brano a sorpresa");
  assert.equal(titoloBrano("Billie Jean"), "Billie Jean");
});

test("SBLOCCO: i tempi della sequenza stanno insieme", () => {
  assert.ok(SBLOCCO.bannerDopoMs > SBLOCCO.urtoMs);
  assert.ok(SBLOCCO.scorriDopoMs + SBLOCCO.scorriDurataMs <= SBLOCCO.totaleMs);
  assert.ok(SBLOCCO.bannerDopoMs + SBLOCCO.bannerDurataMs > SBLOCCO.scorriDopoMs, "il banner è ancora su quando la colonna scorre");
  assert.deepEqual(SBLOCCO, { urtoMs: 0, titoloMs: 150, bannerDopoMs: 1000, bannerDurataMs: 3200, scorriDopoMs: 1800, scorriDurataMs: 700, totaleMs: 2600 });
});
