// Votazione della gara: intervallo dei voti (chat e giudici), pesi, etichette. Funzioni pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leggiVoto } from "../lib/chat.mjs";
import { normalizzaVoto } from "../lib/validazione.mjs";

const GARA = { min: 4, max: 10 };

test("leggiVoto 4–10 accetta 4, 4.5, 10, «9/10», «7,5» e «!voto 8»", () => {
  const casi = { "4": 4, "4.5": 4.5, "10": 10, "9/10": 9, "7,5": 7.5, "!voto 8": 8, " 6 ": 6, "!v 4": 4 };
  for (const [testo, atteso] of Object.entries(casi)) assert.equal(leggiVoto(testo, GARA), atteso, `"${testo}"`);
});

test("leggiVoto 4–10 ignora 3, 3.9, 10.5, «!voto 3», «0» e gli altri fuori intervallo", () => {
  for (const testo of ["3", "3.9", "10.5", "!voto 3", "0", "0.5", "3/10", "11"]) assert.equal(leggiVoto(testo, GARA), null, `"${testo}"`);
});

test("leggiVoto senza opzioni resta 0–10 (Battle e vecchi usi)", () => {
  assert.equal(leggiVoto("0"), 0);
  assert.equal(leggiVoto("3"), 3);
  assert.equal(leggiVoto("10"), 10);
  assert.equal(leggiVoto("10.5"), null);
  assert.equal(leggiVoto("non è un voto", GARA), null);
});

test("normalizzaVoto 4–10: 3.9 e 10.1 lanciano «Il voto deve essere tra 4 e 10», 4 e 10 passano", () => {
  assert.throws(() => normalizzaVoto(3.9, GARA), /Il voto deve essere tra 4 e 10/);
  assert.throws(() => normalizzaVoto("3", GARA), /tra 4 e 10/);
  assert.throws(() => normalizzaVoto(10.1, GARA), /tra 4 e 10/);
  assert.equal(normalizzaVoto(4, GARA), 4);
  assert.equal(normalizzaVoto(10, GARA), 10);
  assert.equal(normalizzaVoto("9,5", GARA), 9.5);
});

test("normalizzaVoto: vuoto vale «nessun voto» e senza opzioni resta 0–10", () => {
  for (const vuoto of ["", null, undefined]) assert.equal(normalizzaVoto(vuoto, GARA), null);
  assert.equal(normalizzaVoto(0), 0);
  assert.equal(normalizzaVoto("7,25"), 7.3);
  assert.throws(() => normalizzaVoto(11), /Il voto deve essere tra 0 e 10/);
  assert.throws(() => normalizzaVoto(-1), /tra 0 e 10/);
});
