import { test } from "node:test";
import assert from "node:assert/strict";
import { deserializeOrder, orderEvent, serializeOrder, describeOrderForHumans, orderRecap, telegramText, CALENDAR_COLORS, type Order } from "../src/booking/order.ts";

const order: Order = {
  lines: [{ serviceId: "registrazione", units: 2 }],
  appointments: [{ serviceId: "registrazione", units: 2, start: "2026-12-10T14:00:00.000Z", end: "2026-12-10T16:30:00.000Z" }],
  name: "Giulia B.",
  email: "giulia@example.com",
  phone: "3331234567",
  notes: "Trap, 2 brani",
  payment: "contanti",
  monthly: false,
  totalCents: 10000,
  fullCents: 10000,
};

/** EP: 2 appuntamenti di beat, 1 di registrazione e il mix a distanza. */
const ep: Order = {
  packageId: "ep",
  lines: [
    { serviceId: "beat-studio", units: 5 },
    { serviceId: "registrazione", units: 5 },
    { serviceId: "mix-remoto", units: 5 },
  ],
  appointments: [
    { serviceId: "beat-studio", units: 3, start: "2026-12-10T13:00:00.000Z", end: "2026-12-10T17:30:00.000Z" },
    { serviceId: "beat-studio", units: 2, start: "2026-12-11T13:00:00.000Z", end: "2026-12-11T16:00:00.000Z" },
    { serviceId: "registrazione", units: 5, start: "2026-12-12T13:00:00.000Z", end: "2026-12-12T18:30:00.000Z" },
  ],
  name: "Marco",
  email: "marco@example.com",
  phone: "",
  notes: "",
  payment: "online",
  policy: true,
  monthly: false,
  totalCents: 69000,
  fullCents: 90000,
};

test("l'ordine sta nei metadati di Stripe (max 500 caratteri) e torna identico", () => {
  const raw = serializeOrder({ ...ep, name: "x".repeat(300), email: "y".repeat(300) });
  assert.ok(raw.length <= 500, String(raw.length));
  assert.deepEqual(deserializeOrder(serializeOrder(order), order.notes), order);
  assert.deepEqual(deserializeOrder(serializeOrder(ep), ep.notes), ep);
  assert.equal(deserializeOrder("non json"), null);
  assert.equal(deserializeOrder(JSON.stringify({ s: "inventato" })), null);
  assert.equal(deserializeOrder(JSON.stringify({ v: 2, l: "z9" })), null);
});

test("pagamenti avviati prima dell'aggiornamento: il vecchio formato si legge ancora", () => {
  const old = JSON.stringify({ s: "beat-studio", u: 1, a: "2026-12-10T14:00:00.000Z", b: "2026-12-10T15:30:00.000Z", n: "Leo", e: "leo@example.com", p: "", m: 0, k: "", pc: 1, t: 6000, f: 6000, y: "o" });
  const o = deserializeOrder(old)!;
  assert.deepEqual(o.lines, [{ serviceId: "beat-studio", units: 1 }]);
  assert.equal(o.appointments[0].end, "2026-12-10T15:30:00.000Z");
  assert.equal(o.policy, true);
});

test("contanti: evento rosso, DA SALDARE, promemoria 30 minuti prima", () => {
  const ev = orderEvent(order, 0, "da-saldare");
  assert.equal(ev.colorId, CALENDAR_COLORS["da-saldare"]);
  assert.match(ev.summary, /DA SALDARE · Registrazione 2 tracce · Giulia/);
  assert.match(ev.description, /DA SALDARE IN CONTANTI: 100\s?€/);
  assert.deepEqual(ev.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] });
  assert.equal(ev.extendedProperties.private.stato, "da-saldare");
});

test("pagato online: evento verde con promemoria normali", () => {
  const ev = orderEvent({ ...order, payment: "online", monthly: true }, 0, "pagato");
  assert.equal(ev.colorId, CALENDAR_COLORS.pagato);
  assert.match(ev.summary, /PAGATO/);
  assert.match(ev.description, /rinnovo mensile attivo/);
  assert.deepEqual(ev.reminders, { useDefault: true });
});

test("pacchetto: un evento per appuntamento, con il resto dell'ordine in descrizione", () => {
  const first = orderEvent(ep, 0, "in-attesa");
  assert.match(first.summary, /Beat in studio 3 beat \(1\/2\) · EP 5 brani · Marco/);
  assert.match(first.description, /Altri appuntamenti/);
  assert.match(first.description, /Registrazione — 5 tracce/);
  assert.match(first.description, /Da fare a distanza[\s\S]*Mix & Master — 5 brani/);
  assert.equal(first.extendedProperties.private.parte, "1/3");
  const rec = orderEvent(ep, 2, "pagato");
  assert.equal(rec.start.dateTime, "2026-12-12T13:00:00.000Z");
  assert.match(rec.summary, /Registrazione 5 tracce · EP 5 brani/);
});

test("contanti con più appuntamenti: si salda tutto al primo", () => {
  const cash = { ...ep, payment: "contanti" as const, policy: undefined };
  assert.match(orderEvent(cash, 0, "da-saldare").description, /DA SALDARE IN CONTANTI: 690\s?€ \(tutto l'ordine/);
  assert.match(orderEvent(cash, 1, "da-saldare").description, /si salda al primo appuntamento/);
});

test("ordine con Pass: torna identico dai metadati e il calendario lo dice", () => {
  const withPass: Order = { ...order, payment: "online", monthly: true, passId: "pro", totalCents: 27000, fullCents: 30000 };
  assert.deepEqual(deserializeOrder(serializeOrder(withPass), withPass.notes), withPass);
  const ev = orderEvent(withPass, 0, "pagato");
  assert.match(ev.summary, /Pass Pro/);
  assert.match(ev.description, /primo del Pass/);
});

test("email: elenca servizi, appuntamenti e cosa si fa a distanza", () => {
  const text = describeOrderForHumans(ep).join("\n");
  assert.match(text, /Pacchetto: EP 5 brani/);
  assert.match(text, /In studio:/);
  assert.match(text, /A distanza: Mix & Master — 5 brani/);
  assert.match(text, /Totale: 690\s?€/);
});


test("riepilogo per il pop-up: niente email né telefono, appuntamenti e totale", () => {
  const r = orderRecap(ep, "pagato");
  assert.equal(r.nome, "Marco");
  assert.equal(r.appuntamenti.length, 3);
  assert.equal(r.aDistanza.length, 1);
  assert.match(r.totale, /690/);
  assert.equal(r.stato, "pagato");
  const json = JSON.stringify(orderRecap(order, "da-saldare"));
  assert.ok(!json.includes("giulia@example.com"));
  assert.ok(!json.includes("3331234567"));
});

test("messaggio Telegram allo studio: cliente, appuntamenti, totale e pagamento", () => {
  const t = telegramText(order, "Nuova prenotazione · DA SALDARE IN CONTANTI");
  assert.match(t, /Giulia B\./);
  assert.match(t, /3331234567/);
  assert.match(t, /In studio/);
  assert.match(t, /contanti/);
  assert.ok(t.length < 1500);
  const t2 = telegramText(ep, "Nuova prenotazione · PAGATA ONLINE");
  assert.match(t2, /pagato online/);
  assert.match(t2, /A distanza/);
  const t3 = telegramText({ ...order, name: "<b>Tom & Jerry</b>" }, "x");
  assert.match(t3, /&lt;b&gt;Tom &amp; Jerry&lt;\/b&gt;/);
});
