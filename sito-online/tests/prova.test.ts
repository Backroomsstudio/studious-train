import { test } from "node:test";
import assert from "node:assert/strict";
import { getService, passesFor } from "../src/booking/catalog.ts";
import { quote } from "../src/booking/pricing.ts";
import { BookingError, customerKeys, parseOrder } from "../src/booking/book.ts";

const prova = getService("prova")!;
const base = { servizio: "prova", quantita: 1, nome: "Giulia", email: "Giulia@Example.com", privacy: true, inizio: "2026-12-10T14:00:00.000Z" };

test("sessione di prova: 20 €, una sola ora, niente sconti né Pass", () => {
  assert.equal(quote(prova, 1).totalCents, 2000);
  assert.throws(() => quote(prova, 2));
  assert.equal(passesFor(prova, 1).length, 0);
});

test("sessione di prova: si paga solo in studio, anche se il browser chiede online", () => {
  const order = parseOrder({ ...base, telefono: "333 123 4567", pagamento: "online" });
  assert.equal(order.payment, "contanti");
  assert.equal(order.totalCents, 2000);
  assert.equal(order.monthly, false);
});

test("sessione di prova: serve il telefono e non si può trasformare in Pass", () => {
  assert.throws(() => parseOrder({ ...base, telefono: "" }), BookingError);
  assert.throws(() => parseOrder({ ...base, telefono: "3331234567", pass: "start" }), /Pass non include/);
});

test("stesso cliente riconosciuto con email in maiuscolo o telefono con +39", () => {
  const a = customerKeys({ email: "Giulia@Example.com", phone: "+39 333 123 4567" });
  const b = customerKeys({ email: "giulia@example.com ", phone: "3331234567" });
  assert.deepEqual(a, b);
  assert.notEqual(a.prova_email, customerKeys({ email: "altro@example.com", phone: "" }).prova_email);
  assert.ok(!a.prova_email.includes("giulia")); // nel calendario non finisce l'email in chiaro
});

const reg = { servizio: "registrazione", quantita: 2, nome: "Giulia", email: "giulia@example.com", privacy: true, inizio: "2026-12-10T14:00:00.000Z" };

test("pagamento online di una sessione in studio: serve la regola di cancellazione", () => {
  assert.throws(() => parseOrder({ ...reg, pagamento: "online" }), /condizioni di cancellazione/);
  const ok = parseOrder({ ...reg, pagamento: "online", policy: true });
  assert.equal(ok.policy, true);
});

test("in contanti o a distanza la regola online non serve", () => {
  assert.equal(parseOrder({ ...reg, pagamento: "contanti", telefono: "3331234567" }).policy, undefined);
  assert.equal(parseOrder({ servizio: "mix-remoto", quantita: 1, nome: "Giulia", email: "giulia@example.com", privacy: true }).policy, undefined);
});
