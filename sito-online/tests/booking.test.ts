import { test } from "node:test";
import assert from "node:assert/strict";
import { bookableServices, getService, bookingMinutes, unitsPerBlock, planBlocks, packages, getPackage } from "../src/booking/catalog.ts";
import { quote, discountFor, formatEuro, cartQuote } from "../src/booking/pricing.ts";
import { slotsForDay, romeToUtc, romeDay, isBookable, fitsAt, addDays, isValidDay, DEFAULT_RULES } from "../src/booking/slots.ts";

const ALL_DAY = { ...DEFAULT_RULES, minNoticeMinutes: 3 * 60, openHour: 0, closeHour: 0 };

const reg = getService("registrazione")!;
const beat = getService("beat-studio")!;
const mix = getService("mix-studio")!;

test("prezzi del listino", () => {
  assert.equal(reg.unitPriceCents, 5000);
  assert.equal(reg.unit.one, "traccia");
  assert.equal(beat.unitPriceCents, 6000);
  assert.equal(getService("beat-remoto")!.unitPriceCents, 6000);
  assert.equal(mix.unitPriceCents, 7000);
  assert.equal(getService("mix-remoto")!.unitPriceCents, 7000);
});

test("calcolatore del tempo: tracce + 30 minuti, beat 1 h 30, mix 2 ore", () => {
  assert.equal(bookingMinutes(reg, 1), 90);
  assert.equal(bookingMinutes(reg, 2), 150); // 2 tracce = 2 h 30
  assert.equal(bookingMinutes(reg, 3), 210); // 3 tracce = 3 h 30
  assert.equal(bookingMinutes(beat, 2), 180);
  assert.equal(bookingMinutes(mix, 1), 120);
  assert.equal(bookingMinutes(getService("mix-remoto")!, 3), 0);
});

test("ogni appuntamento resta entro 6 ore: oltre si divide in più appuntamenti", () => {
  for (const s of bookableServices.filter((x) => x.where === "studio")) {
    assert.ok(bookingMinutes(s, unitsPerBlock(s)) <= 360, s.id);
  }
  assert.deepEqual(
    planBlocks([{ serviceId: "beat-studio", units: 5 }, { serviceId: "registrazione", units: 5 }, { serviceId: "mix-remoto", units: 5 }]).map((b) => [b.serviceId, b.units, b.minutes]),
    [["beat-studio", 3, 270], ["beat-studio", 2, 180], ["registrazione", 5, 330]],
  );
  assert.deepEqual(planBlocks([{ serviceId: "registrazione", units: 8 }]).map((b) => b.units), [4, 4]);
  assert.deepEqual(planBlocks([{ serviceId: "mix-remoto", units: 2 }]), []);
});

test("scala sconti a servizio singolo: 1–2 listino, 3+ −10%, 5+ −20%", () => {
  assert.equal(quote(reg, 1).totalCents, 5000);
  assert.equal(quote(reg, 2).totalCents, 10000);
  assert.equal(quote(reg, 3).totalCents, 13500); // 150 € − 10%
  assert.equal(quote(reg, 5).totalCents, 20000); // 250 € − 20%
  assert.equal(quote(beat, 4).totalCents, 21600); // 240 € − 10%
  assert.equal(quote(getService("mix-remoto")!, 5).totalCents, 28000); // 350 € − 20%
});

test("carrello libero: sconto su tutti i servizi insieme, in qualsiasi combinazione", () => {
  // 2 tracce + 1 beat = 3 servizi → −10%: 160 € → 144 €
  const q = cartQuote([{ serviceId: "registrazione", units: 2 }, { serviceId: "beat-remoto", units: 1 }]);
  assert.equal(q.fullCents, 16000);
  assert.equal(q.discountPercent, 10);
  assert.equal(q.totalCents, 14400);
  // la sala senza fonico non si sconta e non conta
  const n = cartQuote([{ serviceId: "registrazione", units: 2 }, { serviceId: "noleggio", units: 2 }]);
  assert.equal(n.discountPercent, 0);
  assert.equal(n.totalCents, 17000);
  assert.throws(() => cartQuote([]));
});

test("pacchetti: prezzo fisso, sotto il listino", () => {
  assert.deepEqual(packages.map((p) => [p.id, p.title, p.priceCents]), [
    ["singolo", "Singolo completo", 15900],
    ["typebeat", "Type beat", 10900],
    ["doppio", "Doppio singolo", 30900],
    ["ep", "EP 5 brani", 69000],
  ]);
  for (const p of packages) {
    const q = cartQuote(p.lines, p.id);
    assert.equal(q.totalCents, p.priceCents);
    assert.ok(q.fullCents > p.priceCents, p.id);
    // il master nei pacchetti è a distanza: in calendario solo beat e registrazione
    assert.ok(!planBlocks(p.lines).some((b) => b.serviceId.startsWith("mix")), p.id);
  }
  assert.equal(cartQuote(getPackage("singolo")!.lines, "singolo").fullCents, 18000);
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
  assert.throws(() => quote(reg, 11));
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
  const rules = { minNoticeMinutes: 0, horizonDays: 400, stepMinutes: 60, openHour: 0, closeHour: 0 };
  assert.equal(slotsForDay("2027-03-28", 60, [], now, rules).length, 23);
  assert.equal(slotsForDay("2026-10-25", 60, [], now, rules).length, 24);
});

test("slot occupati, passati e liberi", () => {
  const now = new Date("2026-12-10T08:00:00Z"); // 9:00 a Roma
  const busy = [{ start: "2026-12-10T14:00:00Z", end: "2026-12-10T16:00:00Z" }]; // 15–17 a Roma
  const slots = slotsForDay("2026-12-10", 90, busy, now, ALL_DAY);
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
  assert.equal(isBookable("2026-12-10T11:00:00.000Z", 60, busy, now, ALL_DAY), true);
  assert.equal(isBookable("2026-12-10T13:00:00.000Z", 120, busy, now, ALL_DAY), false);
  assert.equal(isBookable("2026-12-10T11:30:00.000Z", 60, busy, now, ALL_DAY), false); // non è un inizio valido
  assert.equal(isBookable("spazzatura", 60, busy, now, ALL_DAY), false);
});

test("utilità sulle date", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(isValidDay("2026-02-30"), false);
  assert.equal(isValidDay("2026-02-28"), true);
});

import { passes, passesFor, passCheckoutCents, getPass, BEATSTARS_URL } from "../src/booking/catalog.ts";

test("noleggio studio: 35 € l'ora, mai sconti", () => {
  const nol = getService("noleggio")!;
  assert.equal(quote(nol, 1).totalCents, 3500);
  assert.equal(quote(nol, 3).totalCents, 10500);
  assert.equal(quote(nol, 6).totalCents, 21000);
  assert.equal(quote(nol, 6).discountPercent, 0);
  assert.equal(passesFor([{ serviceId: "noleggio", units: 1 }]).length, 0); // il Pass non include il noleggio
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
  const r = (n: number) => [{ serviceId: "registrazione" as const, units: n }];
  assert.deepEqual(passesFor(r(2)).map((p) => p.id), ["start", "pro", "label"]);
  assert.deepEqual(passesFor(r(5)).map((p) => p.id), ["pro", "label"]);
  assert.deepEqual(passesFor(r(6)).map((p) => p.id), ["label"]);
  assert.deepEqual(passesFor([{ serviceId: "beat-studio", units: 2 }]).map((p) => p.id), ["pro", "label"]);
  // carrello misto: 2 tracce + 2 beat + 3 mix sta nel Pro e nel Label
  assert.deepEqual(passesFor([...r(2), { serviceId: "beat-remoto", units: 2 }, { serviceId: "mix-remoto", units: 3 }]).map((p) => p.id), ["pro", "label"]);
});

test("link BeatStars impostato", () => {
  assert.equal(BEATSTARS_URL, "https://beatstars.com/backroomss");
});

test("fascia oraria prenotabile, anche oltre la mezzanotte", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const base = { minNoticeMinutes: 0, horizonDays: 400, stepMinutes: 60 };
  const day = slotsForDay("2026-12-10", 60, [], now, { ...base, openHour: 10, closeHour: 3 }).map((s) => s.label);
  assert.equal(day[0], "10:00");
  assert.equal(day.at(-1), "02:00");
  assert.ok(!day.includes("03:00") && !day.includes("09:00") && day.includes("23:00") && day.includes("00:00"));
  assert.equal(slotsForDay("2026-12-10", 60, [], now, { ...base, openHour: 0, closeHour: 0 }).length, 24);
});

test("orari online dello studio: dalle 14:00 alle 02:00 della notte dopo", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const slots = slotsForDay("2026-12-10", 60, [], now);
  assert.deepEqual(
    slots.map((s) => s.label),
    ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00"],
  );
  // 00:00 e 01:00 sono la notte tra giovedì 10 e venerdì 11
  assert.equal(slots.at(-1)!.start, "2026-12-11T00:00:00.000Z");
  // Un blocco di 2 ore finisce entro le 02:00: ultimo inizio a mezzanotte
  assert.equal(slotsForDay("2026-12-10", 120, [], now).at(-1)!.label, "00:00");
});

test("il server accetta gli inizi dopo mezzanotte e rifiuta quelli fuori fascia", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  assert.equal(isBookable("2026-12-11T00:00:00.000Z", 60, [], now), true); // 01:00 di venerdì, fascia di giovedì
  assert.equal(isBookable("2026-12-11T00:00:00.000Z", 120, [], now), false); // finirebbe alle 03:00
  assert.equal(isBookable("2026-12-11T01:00:00.000Z", 60, [], now), false); // 02:00: studio chiuso
  assert.equal(isBookable("2026-12-10T12:00:00.000Z", 60, [], now), false); // 13:00: prima dell'apertura
  assert.equal(isBookable("2026-12-10T13:00:00.000Z", 60, [], now), true); // 14:00
});

test("non si prenota a meno di 24 ore dall'inizio", () => {
  const now = new Date("2026-12-10T13:00:00Z"); // 14:00 a Roma
  const today = slotsForDay("2026-12-10", 60, [], now).filter((s) => s.state === "libero");
  assert.equal(today.length, 0);
  const tomorrow = slotsForDay("2026-12-11", 60, [], now);
  assert.equal(tomorrow.find((s) => s.label === "14:00")?.state, "libero"); // esattamente 24 ore dopo
  assert.equal(isBookable("2026-12-11T12:00:00.000Z", 60, [], now), false); // 13:00 di domani: fuori fascia
});

test("appuntamenti di fila: si può iniziare alla mezz'ora, dentro la fascia 14–02", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  // beat 14:00–15:30 poi registrazione 15:30–18:00 (ora di Roma = UTC+1)
  assert.equal(fitsAt("2026-12-10T14:30:00.000Z", 150, [{ start: "2026-12-10T13:00:00.000Z", end: "2026-12-10T14:30:00.000Z" }], now), true);
  assert.equal(fitsAt("2026-12-10T14:15:00.000Z", 60, [], now), false); // non è una mezz'ora
  assert.equal(fitsAt("2026-12-10T12:30:00.000Z", 60, [], now), false); // 13:30, prima dell'apertura
  assert.equal(fitsAt("2026-12-11T00:30:00.000Z", 30, [], now), true); // 01:30–02:00
  assert.equal(fitsAt("2026-12-11T00:30:00.000Z", 60, [], now), false); // finirebbe alle 02:30
  assert.equal(fitsAt("2026-12-10T13:00:00.000Z", 60, [{ start: "2026-12-10T13:30:00.000Z", end: "2026-12-10T14:00:00.000Z" }], now), false);
});


test("controllo doppie prenotazioni: gli eventi «Disponibile» non contano", async () => {
  const { lostRace } = await import("../src/booking/book.ts");
  const ours = { id: "nostro", summary: "x", created: "2026-11-23T16:00:00Z", start: { dateTime: "2026-11-25T23:00:00+01:00" }, end: { dateTime: "2026-11-26T02:00:00+01:00" } };
  const libero = { id: "a", summary: "Plugghe madrid", created: "2026-11-22T19:00:00Z", transparency: "transparent", start: { dateTime: "2026-11-25T21:30:00+01:00" }, end: { dateTime: "2026-11-26T00:30:00+01:00" } };
  const occupato = { ...libero, id: "b", transparency: undefined };
  const dopo = { ...occupato, id: "c", created: "2026-11-23T16:00:05Z" };
  assert.equal(lostRace(ours, [ours, libero], new Set(["nostro"])), false);
  assert.equal(lostRace(ours, [ours, occupato], new Set(["nostro"])), true);
  assert.equal(lostRace(ours, [ours, dopo], new Set(["nostro"])), false);
});
