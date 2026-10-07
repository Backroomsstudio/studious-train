// Ascolto dell'audio di FL Studio nella regia: bande dallo spettro e rilevatore dei colpi (parti pure, senza browser).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANDE, limitiBande, bandeDaSpettro, creaRilevatoreColpi } from "../public/js/regia-audio.js";

test("limitiBande: dodici bande logaritmiche tra 40 Hz e 14 kHz, ognuna con almeno un bin", () => {
  assert.equal(BANDE, 12);
  const limiti = limitiBande(48000, 1024);
  assert.equal(limiti.length, 12);
  for (const [da, a] of limiti) assert.ok(da < a, `banda vuota [${da}, ${a})`);
  assert.equal(limiti[0][0], 1, "la prima parte dal bin 1 (il bin 0 è la componente continua)");
  for (let i = 0; i < 11; i++) assert.equal(limiti[i + 1][0], limiti[i][1], `le bande ${i} e ${i + 1} non sono contigue`);
  const ultimo = limiti[11][1];
  assert.ok(ultimo >= 296 && ultimo <= 300 && ultimo <= 512, `l'ultima banda arriva al bin ${ultimo} (14 kHz sono il bin ~299)`);
  const larghezze = limiti.map(([da, a]) => a - da);
  for (let i = 0; i < 11; i++) assert.ok(larghezze[i] <= larghezze[i + 1], `la banda ${i + 1} è più stretta della precedente: ${larghezze}`);
});

test("limitiBande: anche con altre frequenze di campionamento le bande restano valide", () => {
  for (const [frequenza, fft] of [[44100, 1024], [96000, 1024], [48000, 2048], [32000, 1024]]) {
    const limiti = limitiBande(frequenza, fft);
    assert.equal(limiti.length, 12, `${frequenza}/${fft}`);
    assert.equal(limiti[0][0], 1, `${frequenza}/${fft}: parte dal bin 1`);
    for (let i = 0; i < 12; i++) {
      assert.ok(limiti[i][0] < limiti[i][1], `${frequenza}/${fft}: banda ${i} vuota`);
      if (i < 11) assert.equal(limiti[i + 1][0], limiti[i][1], `${frequenza}/${fft}: bande ${i} e ${i + 1} non contigue`);
    }
    const bin14k = Math.round(14000 / (frequenza / fft));
    assert.equal(limiti[11][1], Math.min(fft / 2, bin14k), `${frequenza}/${fft}: l'ultima banda arriva a 14 kHz`);
  }
});

test("bandeDaSpettro: la media dei bin di ogni banda, in scala 0…100 con la sensibilità", () => {
  const limiti = limitiBande(48000, 1024);
  assert.deepEqual(bandeDaSpettro(new Uint8Array(512).fill(255), limiti, 100), Array(12).fill(100));
  assert.deepEqual(bandeDaSpettro(new Uint8Array(512).fill(0), limiti, 100), Array(12).fill(0));
  assert.deepEqual(bandeDaSpettro(new Uint8Array(512).fill(128), limiti, 100), Array(12).fill(50));
  assert.deepEqual(bandeDaSpettro(new Uint8Array(512).fill(128), limiti, 50), Array(12).fill(25), "sensibilità 50%: metà");
  assert.deepEqual(bandeDaSpettro(new Uint8Array(512).fill(128), limiti, 300), Array(12).fill(100), "sensibilità 300%: si limita a 100");
  const solo3 = new Uint8Array(512);
  for (let bin = limiti[3][0]; bin < limiti[3][1]; bin++) solo3[bin] = 255;
  assert.deepEqual(bandeDaSpettro(solo3, limiti, 100), [0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0]);
  const meta = new Uint8Array(512);
  const [da, a] = limiti[8];
  for (let bin = da; bin < da + Math.floor((a - da) / 2); bin++) meta[bin] = 255;
  const mezza = bandeDaSpettro(meta, limiti, 100)[8];
  assert.ok(mezza > 40 && mezza < 60, `metà dei bin pieni: ${mezza}`);
});

const SILENZIO = Array(12).fill(0);
const COLPO = [90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 0, 0];

test("rilevatore di colpi: silenzio, colpo, rumore continuo, due colpi vicini", () => {
  const silenzio = (r, da, passi) => Array.from({ length: passi }, (_, i) => r.passo(SILENZIO, da + i * 33));
  let r = creaRilevatoreColpi();
  assert.deepEqual(silenzio(r, 0, 30), Array(30).fill(0), "il silenzio non è mai un colpo");
  const colpo = r.passo(COLPO, 1000);
  assert.ok(colpo >= 50 && colpo <= 100, `colpo ${colpo}`);
  const dopo = Array.from({ length: 19 }, (_, i) => r.passo(COLPO, 1033 + i * 33));
  assert.deepEqual(dopo, Array(19).fill(0), "lo stesso suono che continua non è un nuovo colpo");
  r.passo(SILENZIO, 1700);
  assert.ok(r.passo(COLPO, 1800) >= 50, "un nuovo colpo dopo una pausa è un colpo");

  // due colpi a meno di 90 ms: il secondo non conta
  r = creaRilevatoreColpi();
  silenzio(r, 0, 30);
  assert.ok(r.passo(COLPO, 1000) >= 50);
  r.passo(SILENZIO, 1033);
  assert.equal(r.passo(COLPO, 1066), 0, "66 ms dopo il primo");
  r.passo(SILENZIO, 1099);
  assert.ok(r.passo(COLPO, 1132) >= 50, "132 ms dopo il primo: conta");
});

test("rilevatore di colpi: la forza del colpo e le piccole oscillazioni", () => {
  const r = creaRilevatoreColpi();
  for (let i = 0; i < 30; i++) r.passo(SILENZIO, i * 33);
  assert.equal(r.passo([36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1000), 70, "flusso 36 contro la soglia 30: (36−30)/30·100 + 50");
  const r2 = creaRilevatoreColpi();
  for (let i = 0; i < 30; i++) r2.passo(SILENZIO, i * 33);
  assert.equal(r2.passo([31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1000), 53, "appena sopra la soglia: poco più di 50");
  const r3 = creaRilevatoreColpi();
  for (let i = 0; i < 30; i++) r3.passo(SILENZIO, i * 33);
  assert.equal(r3.passo([30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1000), 0, "alla soglia non basta: serve superarla");
  // oscillazioni piccole (±2 per banda) non sono mai colpi
  const r4 = creaRilevatoreColpi();
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const bande = Array.from({ length: 12 }, (_, b) => 40 + (((i + b) % 2) ? 2 : -2));
    assert.equal(r4.passo(bande, (t += 33)), 0, `passo ${i}`);
  }
  // le bande alte (7…11) non contano nel flusso
  const r5 = creaRilevatoreColpi();
  for (let i = 0; i < 30; i++) r5.passo(SILENZIO, i * 33);
  assert.equal(r5.passo([0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100], 1000), 0, "solo acuti: non è un colpo di batteria");
});

test("rilevatore di colpi: il primo passo non è un colpo e la soglia si adatta a un segnale sempre agitato", () => {
  assert.equal(creaRilevatoreColpi().passo(COLPO, 0), 0, "il primo passo non ha un prima con cui confrontarsi");
  // un'onda continua di sali e scendi (flusso 60 a passi alterni): all'inizio suona dei colpi, poi la media sale e la soglia con lei
  const r = creaRilevatoreColpi();
  const forte = [60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let t = 0;
  const colpi = [];
  for (let i = 0; i < 80; i++) colpi.push(r.passo(i % 2 ? SILENZIO : forte, (t += 33)));
  assert.ok(colpi.slice(0, 20).some((c) => c > 0), "all'inizio il segnale agitato dà dei colpi");
  assert.deepEqual(colpi.slice(-30).filter((c) => c > 0), [], "dopo un po' non è più una novità: niente colpi");
  assert.ok(r.passo([300, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], t + 200) >= 50, "un colpo molto più forte del solito lo è sempre");
});
