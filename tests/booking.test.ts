import { test } from "node:test";
import assert from "node:assert/strict";
import { bookableServices, getService, maxUnitsFor, bookingMinutes } from "../lib/booking/catalog.ts";
import { quote, discountFor, formatEuro } from "../lib/booking/pricing.ts";
import { slotsForDay, romeToUtc, romeDay, isBookable, addDays, isValidDay } from "../lib/booking/slots.ts";

const reg = getService("registrazione")!;
const beat = getService("beat-studio")!;
const mix = getService("mix-studio")!;

test("prezzi del listino", () => {
  assert.equal(reg.unitPriceCents, 5000);
  assert.equal(beat.unitPriceCents, 6000);
  assert.equal(getService("beat-remoto")!.unitPriceCents, 6000);
  assert.equal(mix.unitPriceCents, 7000);
  assert.equal(getService("mix-remoto")!.unitPriceCents, 7000);
});

test("tetto di 6 ore per i servizi in studio", () => {
  assert.equal(maxUnitsFor(reg), 6);
  assert.equal(maxUnitsFor(beat), 4);
  assert.equal(maxUnitsFor(mix), 3);
  for (const s of bookableServices.filter((x) => x.where === "studio")) {
    assert.ok(bookingMinutes(s, maxUnitsFor(s)) <= 360, s.id);
  }
});

test("scala sconti del calcolatore: 1–2 listino, 3+ −10%, 5+ −20%", () => {
  assert.equal(quote(reg, 1).totalCents, 5000);
  assert.equal(quote(reg, 2).totalCents, 10000);
  assert.equal(quote(reg, 3).totalCents, 13500); // 150 € − 10%
  assert.equal(quote(reg, 4).totalCents, 18000); // 200 € − 10%
  assert.equal(quote(reg, 5).totalCents, 20000); // 250 € − 20%
  assert.equal(quote(reg, 6).totalCents, 24000); // 300 € − 20%
  assert.equal(quote(beat, 4).totalCents, 21600); // 240 € − 10%
  assert.equal(quote(mix, 3).totalCents, 18900); // 210 € − 10%
  assert.equal(quote(getService("mix-remoto")!, 5).totalCents, 28000); // 350 € − 20%
});

test("sconto a scaglioni, arrotondato all'euro", () => {
  const table = { 2: 5, 3: 10, 5: 15 };
  assert.equal(discountFor(reg, 1, table), 0);
  assert.equal(discountFor(reg, 4, table), 10);
  const q = quote(reg, 3, table); // 150 € − 10% = 135 €
  assert.equal(q.totalCents, 13500);
  assert.equal(q.savingCents, 1500);
  const q2 = quote(beat, 2, { 2: 7 }); // 120 € − 7% = 111,60 → 112 €
  assert.equal(q2.totalCents, 11200);
});

test("quantità fuori intervallo rifiutate", () => {
  assert.throws(() => quote(reg, 0));
  assert.throws(() => quote(reg, 7));
  assert.throws(() => quote(beat, 5));
  assert.throws(() => quote(reg, 1.5));
});

test("formattazione in euro", () => {
  assert.match(formatEuro(5000), /50\s?€/);
});

test("ora di Roma: inverno ed estate", () => {
  assert.equal(romeToUtc("2026-12-10", 15).toISOString(), "2026-12-10T14:00:00.000Z");
  assert.equal(romeToUtc("2026-07-10", 15).toISOString(), "2026-07-10T13:00:00.000Z");
  assert.equal(romeDay(new Date("2026-12-10T23:30:00Z")), "2026-12-11");
});

test("giorni del cambio d'ora: 23 e 24 inizi da orologio, nessun doppione", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const rules = { minNoticeMinutes: 0, horizonDays: 400, stepMinutes: 60 };
  assert.equal(slotsForDay("2027-03-28", 60, [], now, rules).length, 23);
  assert.equal(slotsForDay("2026-10-25", 60, [], now, rules).length, 24);
});

test("slot occupati, passati e liberi", () => {
  const now = new Date("2026-12-10T08:00:00Z"); // 9:00 a Roma
  const busy = [{ start: "2026-12-10T14:00:00Z", end: "2026-12-10T16:00:00Z" }]; // 15–17 a Roma
  const slots = slotsForDay("2026-12-10", 90, busy, now);
  const by = Object.fromEntries(slots.map((s) => [s.label, s.state]));
  assert.equal(by["10:00"], "passato"); // preavviso di 3 ore
  assert.equal(by["12:00"], "libero");
  assert.equal(by["14:00"], "occupato"); // 14:00–15:30 tocca l'impegno
  assert.equal(by["13:00"], "libero"); // 13:00–14:30 finisce prima delle 15
  assert.equal(by["16:00"], "occupato");
  assert.equal(by["17:00"], "libero");
});

test("il server ricontrolla il blocco richiesto", () => {
  const now = new Date("2026-12-10T08:00:00Z");
  const busy = [{ start: "2026-12-10T14:00:00Z", end: "2026-12-10T16:00:00Z" }];
  assert.equal(isBookable("2026-12-10T11:00:00.000Z", 60, busy, now), true);
  assert.equal(isBookable("2026-12-10T13:00:00.000Z", 120, busy, now), false);
  assert.equal(isBookable("2026-12-10T11:30:00.000Z", 60, busy, now), false); // non è un inizio valido
  assert.equal(isBookable("spazzatura", 60, busy, now), false);
});

test("utilità sulle date", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(isValidDay("2026-02-30"), false);
  assert.equal(isValidDay("2026-02-28"), true);
});

import { passes, passesFor, passCheckoutCents, getPass, BEATSTARS_URL } from "../lib/booking/catalog.ts";

test("noleggio studio: 35 € l'ora, mai sconti", () => {
  const nol = getService("noleggio")!;
  assert.equal(quote(nol, 1).totalCents, 3500);
  assert.equal(quote(nol, 3).totalCents, 10500);
  assert.equal(quote(nol, 6).totalCents, 21000);
  assert.equal(quote(nol, 6).discountPercent, 0);
  assert.equal(passesFor(nol, 1).length, 0); // il Pass non include il noleggio
});

test("Pass: valore coerente con il listino e ulteriore sconto dal checkout", () => {
  for (const p of passes) {
    const value = p.includes.sessions * 5000 + p.includes.beats * 6000 + p.includes.mixes * 7000;
    assert.equal(p.valueCents, value, p.id);
  }
  assert.equal(passCheckoutCents(getPass("start")!), 22500);
  assert.equal(passCheckoutCents(getPass("pro")!), 27000);
  assert.equal(passCheckoutCents(getPass("label")!), 40500);
});

test("si propongono solo i Pass che includono l'acquisto", () => {
  assert.deepEqual(passesFor(reg, 2).map((p) => p.id), ["start", "pro", "label"]);
  assert.deepEqual(passesFor(reg, 5).map((p) => p.id), ["pro", "label"]);
  assert.deepEqual(passesFor(reg, 6).map((p) => p.id), ["label"]);
  assert.deepEqual(passesFor(beat, 2).map((p) => p.id), ["pro", "label"]);
  assert.deepEqual(passesFor(mix, 3).map((p) => p.id), ["pro", "label"]);
});

test("link BeatStars impostato", () => {
  assert.equal(BEATSTARS_URL, "https://beatstars.com/backroomss");
});
