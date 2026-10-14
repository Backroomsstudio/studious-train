import { test } from "node:test";
import assert from "node:assert/strict";
import { leggiAudio, LimiteFrequenza } from "../lib/audio.mjs";

const bande = (...valori) => [...valori, ...Array(12 - valori.length).fill(50)];

test("leggiAudio: 12 bande e il colpo, interi da 0 a 100", () => {
  assert.deepEqual(leggiAudio({ b: bande(0, 10.4, 100.6), c: 55.5 }), { b: bande(0, 10, 100), c: 56 });
  assert.deepEqual(leggiAudio({ b: bande() }), { b: bande(), c: 0 }, "senza colpo vale 0");
  assert.deepEqual(leggiAudio({ b: bande(-3, 250, 0.4, 99.5), c: 150 }), { b: bande(0, 100, 0, 100), c: 100 });
  assert.equal(leggiAudio({ b: bande(), c: -5 }).c, 0);
  assert.deepEqual(leggiAudio({ tipo: "audio", pin: "1234", b: bande(), c: 3, extra: "x" }), { b: bande(), c: 3 }, "dei dati restano solo i livelli");
  assert.ok(Object.is(leggiAudio({ b: bande(-0.4), c: -0.2 }).b[0], 0) && Object.is(leggiAudio({ b: bande(), c: -0.2 }).c, 0), "mai -0");
});

test("leggiAudio: tutto il resto è scartato", () => {
  const buone = bande(1, 2, 3);
  for (const rotto of [
    null,
    undefined,
    "audio",
    42,
    [],
    [buone],
    {},
    { c: 5 },
    { b: "123456789012", c: 5 },
    { b: { length: 12 }, c: 5 },
    { b: buone.slice(0, 11) },
    { b: [...buone, 7] },
    { b: bande(NaN) },
    { b: bande("7") },
    { b: bande(null) },
    { b: bande(undefined) },
    { b: bande(Infinity) },
    { b: bande(-Infinity) },
    { b: bande({}) },
    { b: bande([5]) },
    { b: bande(true) },
    { b: buone, c: "forte" },
    { b: buone, c: NaN },
    { b: buone, c: null },
    { b: buone, c: Infinity },
    { b: buone, c: [1] },
  ]) {
    assert.equal(leggiAudio(rotto), null, JSON.stringify(rotto));
  }
});

test("LimiteFrequenza: al massimo un messaggio ogni 25 ms", () => {
  const l = new LimiteFrequenza(25);
  assert.equal(l.permetti(0), true);
  assert.equal(l.permetti(10), false);
  assert.equal(l.permetti(25), true);
  assert.equal(l.permetti(30), false);
  assert.equal(l.permetti(50), true);
  assert.equal(l.permetti(50.5), false);
  const predefinito = new LimiteFrequenza();
  assert.deepEqual([predefinito.permetti(1000), predefinito.permetti(1024), predefinito.permetti(1025)], [true, false, true]);
  const raro = new LimiteFrequenza(1000);
  assert.deepEqual([raro.permetti(5), raro.permetti(900), raro.permetti(1005)], [true, false, true]);
});

test("LimiteFrequenza: ogni connessione ha il suo", () => {
  const a = new LimiteFrequenza(25);
  const b = new LimiteFrequenza(25);
  assert.equal(a.permetti(0), true);
  assert.equal(b.permetti(1), true, "il messaggio di A non blocca B");
  assert.equal(a.permetti(2), false);
});
