import { test } from "node:test";
import assert from "node:assert/strict";
import { getService, passesFor } from "../src/booking/catalog.ts";
import { quote } from "../src/booking/pricing.ts";
import { BookingError, customerKeys, parseOrder } from "../src/booking/book.ts";

const prova = getService("prova")!;
const who = { nome: "Giulia", email: "Giulia@Example.com", privacy: true };
const base = { ...who, righe: [{ servizio: "prova", quantita: 1 }], inizi: ["2026-12-10T14:00:00.000Z"] };

test("sessione di prova: 20 €, una sola ora, niente sconti né Pass", () => {
  assert.equal(quote(prova, 1).totalCents, 2000);
  assert.throws(() => quote(prova, 2));
  assert.equal(passesFor([{ serviceId: "prova", units: 1 }]).length, 0);
});

test("sessione di prova: si paga solo in studio, anche se il browser chiede online", () => {
  const order = parseOrder({ ...base, telefono: "333 123 4567", pagamento: "online" });
  assert.equal(order.payment, "contanti");
  assert.equal(order.totalCents, 2000);
  assert.equal(order.monthly, false);
});

test("sessione di prova: serve il telefono, non diventa un Pass e si prenota da sola", () => {
  assert.throws(() => parseOrder({ ...base, telefono: "" }), BookingError);
  assert.throws(() => parseOrder({ ...base, telefono: "3331234567", pass: "start" }), /Pass non include/);
  assert.throws(
    () => parseOrder({ ...base, telefono: "3331234567", righe: [{ servizio: "prova", quantita: 1 }, { servizio: "mix-remoto", quantita: 1 }] }),
    /si prenota da sola/,
  );
});

test("stesso cliente riconosciuto con email in maiuscolo o telefono con +39", () => {
  const a = customerKeys({ email: "Giulia@Example.com", phone: "+39 333 123 4567" });
  const b = customerKeys({ email: "giulia@example.com ", phone: "3331234567" });
  assert.deepEqual(a, b);
  assert.notEqual(a.prova_email, customerKeys({ email: "altro@example.com", phone: "" }).prova_email);
  assert.ok(!a.prova_email.includes("giulia")); // nel calendario non finisce l'email in chiaro
});

const reg = { ...who, righe: [{ servizio: "registrazione", quantita: 2 }], inizi: ["2026-12-10T14:00:00.000Z"] };

test("pagamento online con appuntamenti in studio: serve la regola di cancellazione", () => {
  assert.throws(() => parseOrder({ ...reg, pagamento: "online" }), /condizioni di cancellazione/);
  const ok = parseOrder({ ...reg, pagamento: "online", policy: true });
  assert.equal(ok.policy, true);
  assert.equal(ok.appointments[0].end, "2026-12-10T16:30:00.000Z"); // 2 tracce = 2 h 30
});

test("in contanti o a distanza la regola online non serve", () => {
  assert.equal(parseOrder({ ...reg, pagamento: "contanti", telefono: "3331234567" }).policy, undefined);
  assert.equal(parseOrder({ ...who, righe: [{ servizio: "mix-remoto", quantita: 1 }] }).policy, undefined);
});

test("vecchio formato (un servizio): ancora accettato", () => {
  const o = parseOrder({ ...who, servizio: "registrazione", quantita: 1, inizio: "2026-12-10T14:00:00.000Z", pagamento: "contanti", telefono: "3331234567" });
  assert.equal(o.totalCents, 5000);
  assert.equal(o.appointments.length, 1);
});

test("pacchetto: righe e prezzo dal listino, un inizio per ogni appuntamento", () => {
  const p = { ...who, pacchetto: "ep", pagamento: "online", policy: true };
  assert.throws(() => parseOrder({ ...p, inizi: ["2026-12-10T14:00:00.000Z"] }), /ogni appuntamento/);
  const o = parseOrder({ ...p, righe: [{ servizio: "registrazione", quantita: 1 }], inizi: ["2026-12-10T13:00:00.000Z", "2026-12-11T13:00:00.000Z", "2026-12-12T13:00:00.000Z"] });
  assert.equal(o.packageId, "ep");
  assert.equal(o.totalCents, 69000);
  assert.deepEqual(o.lines.map((l) => l.serviceId), ["beat-studio", "registrazione", "mix-remoto"]); // le righe del browser sono ignorate
  assert.deepEqual(o.appointments.map((a) => [a.serviceId, a.units]), [["beat-studio", 3], ["beat-studio", 2], ["registrazione", 5]]);
});

test("carrello misto: a distanza si paga solo online, sconto per quantità sul totale", () => {
  const cart = { ...who, righe: [{ servizio: "registrazione", quantita: 2 }, { servizio: "beat-remoto", quantita: 1 }], inizi: ["2026-12-10T14:00:00.000Z"] };
  assert.throws(() => parseOrder({ ...cart, pagamento: "contanti", telefono: "3331234567" }), /si pagano online/);
  const o = parseOrder({ ...cart, pagamento: "online", policy: true });
  assert.equal(o.totalCents, 14400); // 160 € − 10%
  assert.equal(o.appointments.length, 1);
});

test("Pass su un carrello: solo se lo copre tutto, mai sui pacchetti", () => {
  const cart = { ...who, righe: [{ servizio: "registrazione", quantita: 2 }], inizi: ["2026-12-10T14:00:00.000Z"], policy: true };
  assert.equal(parseOrder({ ...cart, pass: "start" }).totalCents, 22500);
  assert.throws(() => parseOrder({ ...who, pacchetto: "typebeat", pass: "label", policy: true, inizi: ["2026-12-10T14:00:00.000Z"] }), /Pass non include/);
});
