import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FILTERS, filtersToParams, parseFilters } from "../../lib/beats/filters";
import { fuzzyScore } from "../../lib/beats/fuzzy";
import { addMonths, checkUnlock, planCycleGrant, splitDebit, yearlyMonthsStarted } from "../../lib/beats/ledger-rules";
import { creditCost } from "../../lib/beats/licenses";
import { ALL_KEYS, camelotCode, compatibleKeys, keyName } from "../../lib/beats/music";
import { issueDownloadGrant, verifyDownloadGrant } from "../../lib/beats/server/download-grant";
import { checkBid, giftCode, levelFor, minNextBid, pickWinner, quoteService } from "../../lib/beats/offers";

test("Camelot: A minore è 8A, compatibili 8B, 7A e 9A", () => {
  const aMinor = { root: 9, mode: "MINOR" as const };
  assert.equal(camelotCode(aMinor), "8A");
  assert.deepEqual(compatibleKeys(aMinor).map(camelotCode), ["8A", "8B", "7A", "9A"]);
  assert.equal(keyName(compatibleKeys(aMinor)[1]), "C maj");
  assert.equal(new Set(ALL_KEYS.map(camelotCode)).size, 24);
});

test("Camelot: la ruota si chiude (12A ↔ 1A)", () => {
  const twelveA = ALL_KEYS.find((k) => camelotCode(k) === "12A")!;
  assert.ok(compatibleKeys(twelveA).map(camelotCode).includes("1A"));
});

test("filtri: parsing tollerante e serializzazione minima", () => {
  const f = parseFilters(new URLSearchParams("q=  trap &producers=astral,FREYA,freya&bpmMin=300&bpmMax=90&key=9m&compatible=1&sort=boh"));
  assert.equal(f.q, "trap");
  assert.deepEqual(f.producers, ["astral", "freya"]);
  assert.equal(f.bpmMin, 60);
  assert.equal(f.bpmMax, 90);
  assert.equal(f.compatible, true);
  assert.equal(f.sort, "relevance");
  assert.equal(filtersToParams(DEFAULT_FILTERS).toString(), "");
  assert.deepEqual(parseFilters(filtersToParams(f)), f);
});

test("filtri: 'compatibili' senza tonalità viene ignorato", () => {
  assert.equal(parseFilters({ compatible: "1" }).compatible, false);
});

test("fuzzy: tollera i refusi ma scarta il rumore", () => {
  assert.ok(fuzzyScore("travis scot", "level 0 astral trap travis scott type beat") > 0.6);
  assert.ok(fuzzyScore("frya", "ronzio freya r&b") > 0.3);
  assert.equal(fuzzyScore("zzzz", "ronzio freya r&b"), 0);
});

test("rinnovo: l'eccedenza sul tetto di rollover scade prima dell'accredito", () => {
  assert.deepEqual(planCycleGrant({ tier: "STARTER", balance: 14, reason: "renewal", grantedThisPeriod: 0 }), {
    expire: 4,
    grant: 10,
    balanceAfterExpiry: 10,
    balanceAfter: 20,
  });
  assert.equal(planCycleGrant({ tier: "PRO", balance: 3, reason: "renewal", grantedThisPeriod: 0 }).expire, 0);
});

test("upgrade a metà periodo: si accredita solo la differenza", () => {
  const plan = planCycleGrant({ tier: "PRO", balance: 6, reason: "upgrade", grantedThisPeriod: 10 });
  assert.equal(plan.grant, 10);
  assert.equal(plan.balanceAfter, 16);
  assert.equal(planCycleGrant({ tier: "STARTER", balance: 6, reason: "upgrade", grantedThisPeriod: 20 }).grant, 0);
});

test("sblocco: piano, saldo e sconto del beat del giorno", () => {
  assert.equal(creditCost("WAV_LEASE", 30), 3);
  assert.equal(creditCost("MP3_LEASE", 90), 1);
  assert.deepEqual(checkUnlock({ tier: "STARTER", balance: 50, license: "TRACKOUT" }), { ok: false, reason: "PLAN_REQUIRED", cost: 8 });
  assert.deepEqual(checkUnlock({ tier: "PRO", balance: 7, license: "TRACKOUT" }), { ok: false, reason: "INSUFFICIENT_CREDITS", cost: 8 });
  assert.deepEqual(checkUnlock({ tier: "PRO", balance: 7, license: "TRACKOUT", discountPct: 30 }), { ok: true, cost: 6 });
  assert.equal(checkUnlock({ tier: null, balance: 5, license: "MP3_LEASE" }).ok, true);
});

test("permesso di download: firma, scadenza e manomissione", () => {
  const key = "chiave-di-test";
  const now = Date.now();
  const token = issueDownloadGrant({ userId: "u1", licenseId: "l1", asset: "WAV" }, { key, now, ttlSeconds: 60 });
  assert.deepEqual(verifyDownloadGrant(token, { key, now }), { userId: "u1", licenseId: "l1", asset: "WAV", exp: Math.floor(now / 1000) + 60 });
  assert.equal(verifyDownloadGrant(token, { key, now: now + 61_000 }), null, "scaduto");
  assert.equal(verifyDownloadGrant(token, { key: "altra", now }), null, "chiave sbagliata");
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify(["u2", "l1", "WAV", Math.floor(now / 1000) + 60])).toString("base64url");
  assert.equal(verifyDownloadGrant(`${forged}.${sig}`, { key, now }), null, "payload manomesso");
  assert.equal(verifyDownloadGrant(`${payload}.${sig}.x`, { key, now }), null);
});

test("password: hash con sale, verifica e rifiuto", async () => {
  const { hashPassword, verifyPassword } = await import("../../lib/beats/server/password");
  const a = await hashPassword("Studio2026");
  const b = await hashPassword("Studio2026");
  assert.notEqual(a, b, "sale casuale: due hash diversi per la stessa password");
  assert.ok(!a.includes("Studio2026"));
  assert.equal(await verifyPassword("Studio2026", a), true);
  assert.equal(await verifyPassword("studio2026", a), false);
  assert.equal(await verifyPassword("Studio2026", null), false);
  assert.equal(await verifyPassword("Studio2026", "scrypt$rotto"), false);
});

test("personalizzazione: costo, consegna in giorni lavorativi e drop settimanale", async () => {
  const { customizationCost, customizationDueDate } = await import("../../lib/beats/customizations");
  const { isNewRelease, nextDrop } = await import("../../lib/beats/drops");
  assert.equal(customizationCost(["KEY", "TEMPO"], false), 12);
  assert.equal(customizationCost(["KEY"], true), 13);
  const friday = new Date(2026, 9, 23, 12);
  assert.equal(customizationDueDate(friday, true).getDay(), 2, "venerdì + 2 lavorativi = martedì");
  assert.equal(customizationDueDate(friday, false).getDate(), 30, "venerdì + 5 lavorativi = venerdì dopo");
  const wednesday = new Date(2026, 9, 21, 15);
  assert.equal(nextDrop(wednesday).getDay(), 1);
  assert.equal(nextDrop(wednesday).getDate(), 26);
  assert.equal(isNewRelease(new Date(2026, 9, 15, 16), wednesday), true);
  assert.equal(isNewRelease(new Date(2026, 9, 13), wednesday), false);
});

test("portafoglio: prima i crediti dell'abbonamento, poi quelli che non scadono", () => {
  assert.deepEqual(splitDebit({ subscription: 3, wallet: 10 }, 4), { fromSubscription: 3, fromWallet: 1 });
  assert.deepEqual(splitDebit({ subscription: 8, wallet: 10 }, 4), { fromSubscription: 4, fromWallet: 0 });
  assert.equal(splitDebit({ subscription: 1, wallet: 2 }, 4), null);
});

test("annuale: mensilità iniziate e fine mese senza sforare", () => {
  const start = new Date("2026-01-31T10:00:00Z");
  assert.equal(addMonths(start, 1).toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(yearlyMonthsStarted(start, new Date("2026-01-31T10:00:00Z")), 1);
  assert.equal(yearlyMonthsStarted(start, new Date("2026-03-30T00:00:00Z")), 2);
  assert.equal(yearlyMonthsStarted(start, new Date("2027-06-01T00:00:00Z")), 12);
});

test("servizi: metodo di pagamento e sconto del livello", () => {
  assert.deepEqual(quoteService("MIX_MASTER", "mix", "CREDITS"), { ok: true, paidWith: "CREDITS", credits: 20, amountCents: 0, discountPct: 0 });
  assert.equal(quoteService("HIT_PACKAGE", "studio", "CREDITS").ok, false);
  const hit = quoteService("HIT_PACKAGE", "studio", "CARD", 10);
  assert.ok(hit.ok && hit.amountCents === 26910 && hit.discountPct === 10);
  const mix = quoteService("MIX_MASTER", "mix", "CARD", 10);
  assert.ok(mix.ok && mix.amountCents === 4900, "lo sconto vale solo sui servizi in studio");
  assert.equal(levelFor(7).level.id, "GOLD");
  assert.equal(levelFor(7).monthsToNext, 5);
});

test("aste: offerta minima e proroga anti-cecchino", () => {
  const now = new Date("2026-10-22T20:00:00Z");
  const a = { startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 30_000), startPriceCents: 30000, minIncrementCents: 2500, topBidCents: 32500 };
  assert.equal(minNextBid(a), 35000);
  assert.equal(checkBid(a, 34000, now).ok, false);
  const ok = checkBid(a, 35000, now);
  assert.ok(ok.ok && ok.newEndsAt.getTime() === now.getTime() + 60_000);
  const calm = checkBid({ ...a, endsAt: new Date(now.getTime() + 600_000) }, 35000, now);
  assert.ok(calm.ok && calm.newEndsAt.getTime() === now.getTime() + 600_000);
  assert.equal(checkBid({ ...a, startsAt: new Date(now.getTime() + 1000) }, 35000, now).ok, false);
  assert.equal(pickWinner([{ userId: "a", amountCents: 1 }, { userId: "b", amountCents: 2 }], ["b"])?.userId, "a");
  assert.match(giftCode(() => 0), /^BR-AAAA-AAAA$/);
});

test("filtro 'together': serve più di un produttore e finisce nell'URL", async () => {
  const { parseFilters, filtersToParams } = await import("../../lib/beats/filters");
  const { producerPairs } = await import("../../lib/beats/pairs");
  assert.equal(parseFilters({ producers: "astral", together: "1" }).together, false);
  const f = parseFilters({ producers: "astral,freya", together: "1" });
  assert.equal(f.together, true);
  assert.equal(filtersToParams(f).get("together"), "1");
  const p = (slug: string) => ({ slug, name: slug, accentColor: null });
  const pairs = producerPairs([{ producers: [p("freya"), p("astral")] }, { producers: [p("astral"), p("freya")] }, { producers: [p("plugghe")] }]);
  assert.deepEqual(pairs.map((x) => [x.slugs, x.count]), [[["astral", "freya"], 2]]);
});
