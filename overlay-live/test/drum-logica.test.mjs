// Parti pure della pagina del Drum: formato dei Like, finestra della colonna, testo della scaletta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formattaLike, etichettaLike, finestraScaletta, testoScaletta, titoloBrano, SBLOCCO } from "../public/js/drum-logica.js";
import { posizioniGrani, STILI } from "../public/js/drum-clessidra.js";
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

const CAMPO = { larghezza: 264, altezza: 148, raggio: 7 };
const bordoAlto = (grani, raggio) => Math.min(...grani.map((g) => g.y)) - raggio;

test("clessidra: i grani a nido d'ape, dal basso, deterministici", () => {
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: 0 }), []);
  const pieno = posizioniGrani({ ...CAMPO, livello: 1 });
  assert.ok(pieno.length >= 150, `${pieno.length} grani`);
  assert.equal(pieno.length, 216, "12 righe da 18");
  for (const g of pieno) {
    assert.ok(g.x >= 7 && g.x <= 264 - 7 && g.y >= 7 && g.y <= 148 - 7, `centro fuori dai limiti: ${g.x}, ${g.y}`);
    assert.ok(Number.isInteger(g.colore) && g.colore >= 0 && g.colore < 5);
  }
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: 1 }), pieno, "stessi parametri, stesso risultato");
  assert.notDeepEqual(posizioniGrani({ ...CAMPO, livello: 1, seme: 8 }), pieno, "un altro seme mescola in modo diverso");
  assert.equal(new Set(pieno.map((g) => `${g.x}|${g.y}`)).size, pieno.length, "nessun posto occupato due volte");
  // nido d'ape: due grani non si sovrappongono mai e ogni grano della seconda riga poggia su due della prima a distanza 2·raggio
  let minima = Infinity;
  for (let i = 0; i < pieno.length; i++) for (let j = i + 1; j < pieno.length; j++) minima = Math.min(minima, Math.hypot(pieno[i].x - pieno[j].x, pieno[i].y - pieno[j].y));
  assert.ok(minima >= 14 - 0.001, `due grani si sovrappongono (distanza ${minima.toFixed(2)})`);
  const prima = pieno.filter((g) => Math.abs(g.y - 141) < 0.01);
  const seconda = pieno.filter((g) => Math.abs(g.y - (141 - 7 * Math.sqrt(3))) < 0.01);
  assert.deepEqual([prima.length, seconda.length], [18, 18]);
  for (const g of seconda) {
    const vicini = prima.filter((p) => Math.abs(Math.hypot(p.x - g.x, p.y - g.y) - 14) < 0.01);
    assert.equal(vicini.length, g.x + 7 <= 257 ? 2 : 1, `il grano ${g.x} poggia su ${vicini.length} grani`); // l'ultimo, al bordo, su uno solo
  }
});

test("clessidra: i grani posati non si spostano, il livello è la loro quantità", () => {
  const meta = posizioniGrani({ ...CAMPO, livello: 0.5 });
  const otto = posizioniGrani({ ...CAMPO, livello: 0.8 });
  assert.equal(meta.length, 108);
  assert.deepEqual(otto.slice(0, meta.length), meta, "quelli a 0,5 sono i primi di quelli a 0,8");
  assert.ok(Math.abs(bordoAlto(meta, 7) - 74) <= 13, `bordo alto ${bordoAlto(meta, 7)}`);
  for (const livello of [0.1, 0.3, 0.7, 0.9, 1]) {
    const atteso = 148 * (1 - livello);
    const trovato = bordoAlto(posizioniGrani({ ...CAMPO, livello }), 7);
    assert.ok(Math.abs(trovato - atteso) <= 14, `livello ${livello}: bordo ${trovato.toFixed(1)}, atteso ${atteso.toFixed(1)}`);
  }
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: 2 }), posizioniGrani({ ...CAMPO, livello: 1 }), "livello oltre 1: si limita a 1");
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: -1 }), [], "livello sotto 0: si limita a 0");
  assert.deepEqual(posizioniGrani({ ...CAMPO, livello: NaN }), [], "un livello che non è un numero vale 0");
  const sotto = posizioniGrani({ ...CAMPO, livello: 0.5 }).filter((g) => g.y < 74 - 7 - 13);
  assert.deepEqual(sotto, [], "nessun grano sopra la superficie");
});

test("clessidra: la sabbia ha grani piccoli e tanti, i colori seguono la tavolozza", () => {
  const sabbia = posizioniGrani({ larghezza: 264, altezza: 148, raggio: 2.5, livello: 1 });
  assert.ok(sabbia.length >= 1500, `${sabbia.length} grani`);
  for (const g of sabbia) assert.ok(g.x >= 2.5 && g.x <= 261.5 && g.y >= 2.5 && g.y <= 145.5);
  const colori = posizioniGrani({ ...CAMPO, livello: 1, colori: 3 });
  assert.deepEqual([...new Set(colori.map((g) => g.colore))].sort(), [0, 1, 2]);
  assert.deepEqual(Object.keys(STILI), ["perline", "sabbia"]);
  assert.deepEqual([STILI.perline.raggio, STILI.sabbia.raggio, STILI.perline.lucido, STILI.sabbia.lucido], [7, 2.5, true, false]);
  assert.equal(STILI.perline.colori.length, 5);
  assert.equal(STILI.sabbia.colori.length, 4);
});
