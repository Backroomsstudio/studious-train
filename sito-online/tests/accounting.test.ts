import { test } from "node:test";
import assert from "node:assert/strict";
import { accountingEntry, findTargetRow, sheetDateSerial, sheetTitleFor } from "../src/booking/accounting.ts";
import type { Order } from "../src/booking/order.ts";

const cash: Order = {
  lines: [
    { serviceId: "beat-studio", units: 1 },
    { serviceId: "registrazione", units: 2 },
  ],
  appointments: [
    { serviceId: "beat-studio", units: 1, start: "2026-11-28T21:00:00.000Z", end: "2026-11-28T22:30:00.000Z" },
    { serviceId: "registrazione", units: 2, start: "2026-11-29T22:00:00.000Z", end: "2026-11-30T00:30:00.000Z" },
  ],
  name: "Mario Rossi",
  email: "m@example.com",
  phone: "3331234567",
  notes: "",
  payment: "contanti",
  monthly: false,
  totalCents: 14500,
  fullCents: 14500,
};

test("foglio del mese e data in formato Fogli Google (ora di Roma)", () => {
  assert.equal(sheetTitleFor(new Date("2026-11-23T16:00:00Z")), "Registro Nov26");
  // 31/12 23:30 UTC = 1° gennaio 00:30 a Roma: va nel registro di gennaio 2027
  assert.equal(sheetTitleFor(new Date("2026-12-31T23:30:00Z")), "Registro Gen27");
  assert.equal(sheetTitleFor(new Date("2027-08-01T10:00:00Z")), "Registro Ago27");
  assert.equal(sheetDateSerial(new Date("2026-11-23T16:00:00Z")), 46349);
});

test("contanti: DA PAGARE, totale, cliente, sessione e quando paga nelle note", () => {
  const e = accountingEntry(cash, { paid: false, at: new Date("2026-11-23T16:00:00Z"), ref: "abc123" });
  assert.equal(e.sheet, "Registro Nov26");
  assert.deepEqual(e.values.slice(1), ["Mario Rossi", "Beat in studio — 1 beat + Registrazione — 2 tracce", 145, "DA PAGARE", "", "Contante"]);
  assert.match(e.note, /Sessione: Beat in studio: sabato 28 novembre, 22:00–23:30/);
  assert.match(e.note, /Paga in contanti il sab 28\/11 alla sessione/);
  assert.match(e.note, /rif\. abc123/);
});

test("pagato online: PAGATO, incassato da Luca con carta", () => {
  const e = accountingEntry({ ...cash, payment: "online", packageId: "singolo" }, { paid: true, at: new Date("2026-11-23T16:00:00Z"), ref: "x" });
  assert.equal(e.values[4], "PAGATO");
  assert.equal(e.values[5], "Luca");
  assert.equal(e.values[6], "Carta");
  assert.match(e.values[2], /^Pacchetto /);
  assert.match(e.note, /Pagato online/);
});

test("riga di destinazione: prima riga libera prima dei totali, mai due volte la stessa prenotazione", () => {
  const filled = (n: number) => Array.from({ length: n }, (_, i) => [`0${i}/11/2026`, "X", "Pacchetto", "100", "PAGATO"]);
  const sheet = [...filled(3), [], [], ["TOTALE INCASSATO (righe PAGATO)"], ["TOTALE DA INCASSARE"]];
  assert.deepEqual(findTargetRow(sheet, "r1"), { row: 8, insert: false });
  // buco in mezzo: si riempie
  assert.deepEqual(findTargetRow([filled(1)[0], [], filled(1)[0], [], ["TOTALE"]], "r1"), { row: 6, insert: false });
  // pieno fino alla riga vuota prima dei totali: nuova riga inserita
  assert.deepEqual(findTargetRow([...filled(3), [], ["TOTALE"]], "r1"), { row: 8, insert: true });
  assert.deepEqual(findTargetRow([...filled(3), ["TOTALE"]], "r1"), { row: 8, insert: true });
  // già scritta
  const dup = [[...filled(1)[0], "", "", "", "", "", "Dal sito · rif. r1"], [], ["TOTALE"]];
  assert.equal(findTargetRow(dup, "r1"), "duplicato");
});
