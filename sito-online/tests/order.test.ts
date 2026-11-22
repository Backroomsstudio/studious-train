import { test } from "node:test";
import assert from "node:assert/strict";
import { deserializeOrder, orderEvent, serializeOrder, CALENDAR_COLORS, type Order } from "../src/booking/order.ts";

const order: Order = {
  serviceId: "registrazione",
  units: 2,
  start: "2026-12-10T14:00:00.000Z",
  end: "2026-12-10T16:00:00.000Z",
  name: "Giulia B.",
  email: "giulia@example.com",
  phone: "3331234567",
  notes: "Trap, 2 brani",
  payment: "contanti",
  monthly: false,
  totalCents: 10000,
  fullCents: 10000,
};

test("l'ordine sta nei metadati di Stripe (max 500 caratteri) e torna identico", () => {
  const raw = serializeOrder({ ...order, name: "x".repeat(300), email: "y".repeat(300) });
  assert.ok(raw.length <= 500, String(raw.length));
  assert.deepEqual(deserializeOrder(serializeOrder(order), order.notes), order);
  assert.equal(deserializeOrder("non json"), null);
  assert.equal(deserializeOrder(JSON.stringify({ s: "inventato" })), null);
});

test("contanti: evento rosso, DA SALDARE, promemoria 30 minuti prima", () => {
  const ev = orderEvent(order, "da-saldare");
  assert.equal(ev.colorId, CALENDAR_COLORS["da-saldare"]);
  assert.match(ev.summary, /DA SALDARE/);
  assert.match(ev.description, /DA SALDARE IN CONTANTI: 100\s?€/);
  assert.deepEqual(ev.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] });
  assert.equal(ev.extendedProperties.private.stato, "da-saldare");
});

test("pagato online: evento verde con promemoria normali", () => {
  const ev = orderEvent({ ...order, payment: "online", monthly: true }, "pagato");
  assert.equal(ev.colorId, CALENDAR_COLORS.pagato);
  assert.match(ev.summary, /PAGATO/);
  assert.match(ev.description, /rinnovo mensile attivo/);
  assert.deepEqual(ev.reminders, { useDefault: true });
});

test("ordine con Pass: torna identico dai metadati e il calendario lo dice", () => {
  const withPass: Order = { ...order, payment: "online", monthly: true, passId: "pro", totalCents: 27000, fullCents: 30000 };
  assert.deepEqual(deserializeOrder(serializeOrder(withPass), withPass.notes), withPass);
  const ev = orderEvent(withPass, "pagato");
  assert.match(ev.summary, /Pass Pro/);
  assert.match(ev.description, /prima del Pass/);
});
