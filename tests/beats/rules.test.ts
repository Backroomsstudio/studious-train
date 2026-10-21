import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FILTERS, filtersToParams, parseFilters } from "../../lib/beats/filters";
import { fuzzyScore } from "../../lib/beats/fuzzy";
import { checkUnlock, planCycleGrant } from "../../lib/beats/ledger-rules";
import { creditCost } from "../../lib/beats/licenses";
import { ALL_KEYS, camelotCode, compatibleKeys, keyName } from "../../lib/beats/music";
import { issueDownloadGrant, verifyDownloadGrant } from "../../lib/beats/server/download-grant";

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
