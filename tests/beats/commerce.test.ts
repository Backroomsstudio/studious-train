/**
 * Test di portafoglio, gift card, inviti, servizi, prodotti e aste su PostgreSQL vero.
 * Si attivano con TEST_DATABASE_URL, su un database migrato e popolato.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { StoreError } from "../../lib/beats/server/errors";
import { unlockWithCredits } from "../../lib/beats/server/ledger";
import {
  buyProductWithCredits,
  creditWallet,
  fulfillPayment,
  orderServiceWithCredits,
  placeBid,
  redeemGiftCard,
  residentLevel,
  rewardReferral,
  settleAuction,
} from "../../lib/beats/server/commerce";

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : "TEST_DATABASE_URL non impostato";
const db = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (null as unknown as PrismaClient);

const run = `${Date.now()}`;
const users: string[] = [];
let beatId = "";
/** Beat creato apposta per aste e pacchetti: l'asta lo archivia, gli altri test non lo vedono. */
let ownBeatId = "";
let productId = "";

async function newUser(data: { creditBalance?: number; walletCredits?: number; referredById?: string } = {}) {
  const user = await db.user.create({ data: { email: `c-${run}-${users.length}@example.com`, artistName: `Artist${users.length}`, ...data } });
  users.push(user.id);
  return user.id;
}

const wallet = async (id: string) => {
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  return { subscription: u.creditBalance, wallet: u.walletCredits };
};
const isCode = (code: string) => (e: unknown) => e instanceof StoreError && e.code === code;

before(async () => {
  if (!url) return;
  beatId = (await db.beat.findFirstOrThrow({ where: { slug: "moquette" } })).id;
  ownBeatId = (
    await db.beat.create({
      data: {
        slug: `asta-${run}`,
        title: "Asta Test",
        status: "PUBLISHED",
        bpm: 140,
        keyRoot: 9,
        keyMode: "MINOR",
        durationSec: 150,
        waveformPeaks: [],
        previewObjectKey: "p",
        mp3ObjectKey: "m",
        wavObjectKey: "w",
      },
    })
  ).id;
  productId = (
    await db.product.create({
      data: { slug: `kit-${run}`, kind: "DRUM_KIT", title: "Test Kit", description: "x", contents: [], priceCents: 2490, credits: 8, objectKey: "kits/test.zip" },
    })
  ).id;
});

after(async () => {
  if (!url) return;
  await db.auction.deleteMany({ where: { beatId: ownBeatId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.product.delete({ where: { id: productId } }).catch(() => undefined);
  await db.beat.delete({ where: { id: ownBeatId } }).catch(() => undefined);
  await db.$disconnect();
});

test("le spese pescano prima dall'abbonamento, poi dal portafoglio", { skip }, async () => {
  const id = await newUser({ creditBalance: 3, walletCredits: 10 });
  await db.subscription.create({
    data: {
      userId: id,
      stripeSubscriptionId: `sub_c_${run}`,
      stripePriceId: "p",
      tier: "PRO",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 1000),
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    },
  });
  const result = await unlockWithCredits(db, { userId: id, beatId, license: "WAV_LEASE" });
  assert.equal(result.balance, 9);
  assert.deepEqual(await wallet(id), { subscription: 0, wallet: 9 });
  const row = await db.creditTransaction.findFirstOrThrow({ where: { userId: id, type: "UNLOCK" } });
  assert.equal(row.walletAmount, -1);
  assert.equal(row.balanceAfter, 9);
});

test("ricarica idempotente: il webhook doppio accredita una volta", { skip }, async () => {
  const id = await newUser();
  const session = { sessionId: `cs_${run}_topup`, userId: id, amountTotal: 3990, metadata: { packId: "medium" } };
  await fulfillPayment(db, "TOPUP", session);
  await fulfillPayment(db, "TOPUP", session);
  assert.deepEqual(await wallet(id), { subscription: 0, wallet: 13 });
});

test("gift card: riscatto concorrente, ne passa uno solo", { skip }, async () => {
  const buyer = await newUser();
  await fulfillPayment(db, "GIFT", { sessionId: `cs_${run}_gift`, userId: buyer, amountTotal: 7990, metadata: { cardId: "gift-25", recipientName: "Luca" } });
  await fulfillPayment(db, "GIFT", { sessionId: `cs_${run}_gift`, userId: buyer, amountTotal: 7990, metadata: { cardId: "gift-25" } });
  const cards = await db.giftCard.findMany({ where: { purchaserId: buyer } });
  assert.equal(cards.length, 1);
  assert.match(cards[0].code, /^BR-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const [a, b] = [await newUser(), await newUser()];
  const results = await Promise.allSettled([
    redeemGiftCard(db, { userId: a, code: cards[0].code.toLowerCase() }),
    redeemGiftCard(db, { userId: b, code: ` ${cards[0].code} ` }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const totals = [(await wallet(a)).wallet, (await wallet(b)).wallet].sort((x, y) => x - y);
  assert.deepEqual(totals, [0, 25]);
  await assert.rejects(redeemGiftCard(db, { userId: a, code: "BR-XXXX-XXXX" }), isCode("NOT_FOUND"));
});

test("invito: 5 crediti a entrambi, una volta sola", { skip }, async () => {
  const inviter = await newUser();
  const invited = await newUser({ referredById: inviter });
  assert.equal(await rewardReferral(db, invited), true);
  assert.equal(await rewardReferral(db, invited), false);
  assert.equal((await wallet(inviter)).wallet, 5);
  assert.equal((await wallet(invited)).wallet, 5);
});

test("prodotto in crediti: acquisti concorrenti addebitano una volta", { skip }, async () => {
  const id = await newUser({ walletCredits: 20 });
  const results = await Promise.all([1, 2, 3].map(() => buyProductWithCredits(db, { userId: id, productId })));
  assert.equal(results.filter((r) => !r.alreadyOwned).length, 1);
  assert.equal((await wallet(id)).wallet, 12);
  await creditWallet(db, { userId: id, amount: 1, type: "ADJUSTMENT", description: "t", idempotencyKey: `adj:${run}` });
  assert.equal((await wallet(id)).wallet, 13);
});

test("servizi: crediti solo dove previsti, saldo mai negativo, uscita solo con licenza", { skip }, async () => {
  const id = await newUser({ walletCredits: 12 });
  const base = { userId: id, notes: "Mix della mia traccia" };
  const { balance } = await orderServiceWithCredits(db, { ...base, kind: "LIVE_SLOT", tierId: "throne" });
  assert.equal(balance, 0);
  await assert.rejects(orderServiceWithCredits(db, { ...base, kind: "LIVE_SLOT", tierId: "skip" }), isCode("INSUFFICIENT_CREDITS"));
  await assert.rejects(orderServiceWithCredits(db, { ...base, kind: "HIT_PACKAGE", tierId: "online", beatId: ownBeatId }), isCode("BAD_REQUEST"));
  assert.equal(await db.serviceOrder.count({ where: { userId: id } }), 1);

  const order = await db.serviceOrder.create({
    data: { userId: id, kind: "HIT_PACKAGE", tierId: "premium", beatId: ownBeatId, notes: "x", paidWith: "CARD", amountCents: 39900 },
  });
  const paid = { sessionId: `cs_${run}_svc`, userId: id, amountTotal: 39900, metadata: { orderId: order.id } };
  assert.equal(await fulfillPayment(db, "SERVICE", paid), "ok");
  assert.equal(await fulfillPayment(db, "SERVICE", paid), "ok");
  assert.equal(await db.license.count({ where: { userId: id, beatId: ownBeatId, type: "UNLIMITED" } }), 1, "il Premium include l'Unlimited");
});

test("aste: rilancio minimo, anti-cecchino, vincitore che non paga, pagamento fuori tempo", { skip }, async () => {
  const [a, b] = [await newUser(), await newUser()];
  const now = new Date();
  const auction = await db.auction.create({
    data: { beatId: ownBeatId, startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 30_000), startPriceCents: 30000, minIncrementCents: 2500 },
  });
  await assert.rejects(placeBid(db, { userId: a, auctionId: auction.id, amountCents: 29000 }), isCode("BAD_REQUEST"));
  const first = await placeBid(db, { userId: a, auctionId: auction.id, amountCents: 30000 });
  assert.ok(first.endsAt.getTime() > auction.endsAt.getTime(), "offerta nell'ultimo minuto: l'asta si allunga");
  await assert.rejects(placeBid(db, { userId: a, auctionId: auction.id, amountCents: 40000 }), isCode("BAD_REQUEST"));
  const race = await Promise.allSettled([
    placeBid(db, { userId: b, auctionId: auction.id, amountCents: 32500 }),
    placeBid(db, { userId: b, auctionId: auction.id, amountCents: 32500 }),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);

  const later = new Date(now.getTime() + 5 * 60_000);
  await settleAuction(db, auction.id, later);
  let row = await db.auction.findUniqueOrThrow({ where: { id: auction.id } });
  assert.equal(row.status, "AWAITING_PAYMENT");
  assert.equal(row.winnerId, b);

  await settleAuction(db, auction.id, new Date(later.getTime() + 49 * 3_600_000));
  row = await db.auction.findUniqueOrThrow({ where: { id: auction.id } });
  assert.equal(row.winnerId, a, "il vincitore non ha pagato: l'esclusiva passa al secondo");
  assert.equal(row.winningBidCents, 30000);

  const late = { sessionId: `cs_${run}_late`, userId: b, amountTotal: 32500, metadata: { auctionId: auction.id } };
  assert.equal(await fulfillPayment(db, "AUCTION", late), "stale", "pagamento fuori tempo: va rimborsato");
  const ok = { sessionId: `cs_${run}_auc`, userId: a, amountTotal: 30000, metadata: { auctionId: auction.id } };
  assert.equal(await fulfillPayment(db, "AUCTION", ok), "ok");
  assert.equal(await fulfillPayment(db, "AUCTION", ok), "ok");
  assert.equal((await db.beat.findUniqueOrThrow({ where: { id: ownBeatId } })).status, "ARCHIVED");
});

test("livello Resident dai mesi pagati (gli upgrade non contano)", { skip }, async () => {
  const id = await newUser();
  for (const key of ["grant:a", "grant:b", "grant:c", "upgrade:d"]) {
    await db.creditTransaction.create({ data: { userId: id, type: "SUBSCRIPTION_GRANT", amount: 1, balanceAfter: 1, idempotencyKey: `${key}-${run}` } });
  }
  const level = await residentLevel(db, id);
  assert.equal(level.months, 3);
  assert.equal(level.level.id, "SILVER");
  assert.equal(level.next?.id, "GOLD");
});
