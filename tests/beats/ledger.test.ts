/**
 * Test del libro mastro su un PostgreSQL vero (le garanzie dipendono da lock e vincoli del DB).
 * Si attivano con TEST_DATABASE_URL, su un database già migrato e popolato (`prisma migrate deploy && prisma db seed`).
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { StoreError } from "../../lib/beats/server/errors";
import { expireCreditsAtSubscriptionEnd, grantCycleCredits, requestCustomization, unlockWithCredits } from "../../lib/beats/server/ledger";

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : "TEST_DATABASE_URL non impostato";
const db = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (null as unknown as PrismaClient);

const run = `${Date.now()}`;
let userId = "";
let subscriptionId = "";
let beatId = "";
let collabBeatId = "";

before(async () => {
  if (!url) return;
  const user = await db.user.create({ data: { email: `test-${run}@example.com` } });
  userId = user.id;
  const now = Date.now();
  const sub = await db.subscription.create({
    data: {
      userId,
      stripeSubscriptionId: `sub_${run}`,
      stripePriceId: "price_pro",
      tier: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date(now - 1000),
      currentPeriodEnd: new Date(now + 30 * 86_400_000),
    },
  });
  subscriptionId = sub.id;
  beatId = (await db.beat.findUniqueOrThrow({ where: { slug: "level-0" } })).id;
  collabBeatId = (await db.beat.findUniqueOrThrow({ where: { slug: "corridoio" } })).id;
});

after(async () => {
  if (!url) return;
  await db.user.delete({ where: { id: userId } }).catch(() => undefined);
  await db.$disconnect();
});

const balance = async () => (await db.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance;

test("accredito idempotente per fattura", { skip }, async () => {
  const input = { userId, subscriptionId, tier: "PRO" as const, invoiceId: `in_${run}_1`, reason: "renewal" as const, periodStart: new Date(0) };
  assert.equal(await grantCycleCredits(db, input), true);
  assert.equal(await grantCycleCredits(db, input), false, "il secondo webhook non accredita");
  assert.equal(await balance(), 20);
});

test("rinnovo con rollover: il saldo torna al tetto prima del nuovo accredito", { skip }, async () => {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { creditBalance: 26 } }),
    db.creditTransaction.create({ data: { userId, type: "BONUS", amount: 6, balanceAfter: 26 } }),
  ]);
  await grantCycleCredits(db, { userId, subscriptionId, tier: "PRO", invoiceId: `in_${run}_2`, reason: "renewal", periodStart: new Date(0) });
  assert.equal(await balance(), 40);
  const expiry = await db.creditTransaction.findUniqueOrThrow({ where: { idempotencyKey: `rollover:in_${run}_2` } });
  assert.equal(expiry.amount, -6);
});

test("sblocchi concorrenti dello stesso beat addebitano una volta sola", { skip }, async () => {
  const before = await balance();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => unlockWithCredits(db, { userId, beatId, license: "WAV_LEASE" })),
  );
  assert.equal(results.filter((r) => !r.alreadyOwned).length, 1);
  assert.equal(await balance(), before - 4);
  assert.equal(await db.license.count({ where: { userId, beatId } }), 1);
});

test("sblocchi concorrenti di beat diversi non vanno mai sotto zero", { skip }, async () => {
  await db.user.update({ where: { id: userId }, data: { creditBalance: 10 } });
  const beats = await db.beat.findMany({ where: { id: { notIn: [beatId] }, deals: { none: {} } }, take: 6 });
  const outcomes = await Promise.allSettled(beats.map((b) => unlockWithCredits(db, { userId, beatId: b.id, license: "MP3_LEASE" })));
  const ok = outcomes.filter((o) => o.status === "fulfilled").length;
  const refused = outcomes.filter((o) => o.status === "rejected" && o.reason instanceof StoreError && o.reason.code === "INSUFFICIENT_CREDITS");
  assert.equal(ok, 5, "10 crediti = 5 MP3 Lease");
  assert.equal(refused.length, 1);
  assert.equal(await balance(), 0);
});

test("licenza fuori piano rifiutata senza addebito", { skip }, async () => {
  await db.user.update({ where: { id: userId }, data: { creditBalance: 50 } });
  await assert.rejects(unlockWithCredits(db, { userId, beatId: collabBeatId, license: "UNLIMITED" }), (e: unknown) => e instanceof StoreError && e.code === "PLAN_REQUIRED");
  assert.equal(await balance(), 50);
});

test("fine abbonamento: i crediti scadono una volta sola", { skip }, async () => {
  await db.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELED", currentPeriodEnd: new Date(Date.now() - 1000) } });
  await expireCreditsAtSubscriptionEnd(db, { userId, subscriptionId });
  await expireCreditsAtSubscriptionEnd(db, { userId, subscriptionId });
  assert.equal(await balance(), 0);
  assert.equal(await db.creditTransaction.count({ where: { userId, type: "SUBSCRIPTION_END_EXPIRY" } }), 1);
});

test("il saldo in cache coincide con l'ultima riga del mastro", { skip }, async () => {
  const last = await db.creditTransaction.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: "desc" } });
  // Le righe "manuali" dei test sopra aggiornano il saldo senza mastro: qui controlliamo solo l'ultima operazione.
  assert.equal(last.balanceAfter, await balance());
});

test("personalizzazioni: addebito atomico, limite di richieste aperte e saldo insufficiente", { skip }, async () => {
  await db.subscription.update({ where: { id: subscriptionId }, data: { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
  await db.user.update({ where: { id: userId }, data: { creditBalance: 30 } });
  const input = { userId, beatId, options: ["KEY" as const, "KEY" as const], express: false, notes: "Abbassalo di un tono" };
  const results = await Promise.all([1, 2, 3].map(() => requestCustomization(db, input)));
  assert.deepEqual(results.map((r) => r.request.creditsSpent), [9, 9, 9], "opzioni duplicate contate una volta");
  assert.equal(await balance(), 3);
  await db.user.update({ where: { id: userId }, data: { creditBalance: 50 } });
  await assert.rejects(requestCustomization(db, input), (e: unknown) => e instanceof StoreError && e.code === "BAD_REQUEST");
  await db.customizationRequest.updateMany({ where: { userId }, data: { status: "DELIVERED" } });
  await db.user.update({ where: { id: userId }, data: { creditBalance: 5 } });
  await assert.rejects(requestCustomization(db, input), (e: unknown) => e instanceof StoreError && e.code === "INSUFFICIENT_CREDITS");
  assert.equal(await balance(), 5);
  assert.equal(await db.creditTransaction.count({ where: { userId, type: "CUSTOMIZATION" } }), 3);
});
