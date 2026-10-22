/**
 * Tutto ciò che si vende oltre all'abbonamento, su PostgreSQL: ricariche, gift card, inviti,
 * livelli Resident, servizi dello studio, prodotti digitali e aste delle esclusive.
 *
 * Stesse garanzie del mastro (`ledger.ts`): ogni spesa in crediti passa da `debit` dentro una
 * transazione con la riga dell'utente bloccata; ogni effetto di un pagamento Stripe è idempotente
 * (chiavi uniche su sessione Checkout e mastro), quindi i webhook possono arrivare due volte.
 */
import { randomInt } from "node:crypto";
import { Prisma, type CreditTransactionType, type LicenseType, type ServiceKind } from "@/lib/generated/prisma/client";
import { LICENSES } from "../licenses";
import {
  AUCTION,
  CREDIT_PACKS,
  GIFT_CARDS,
  hasAuctionEarlyAccess,
  REFERRAL,
  SERVICES,
  checkBid,
  findPack,
  giftCode,
  levelFor,
  normalizeGiftCode,
  packCredits,
  pickWinner,
  quoteService,
  serviceLicense,
} from "../offers";
import { StoreError } from "./errors";
import { debit, isUniqueViolation, lockWallet, type Tx } from "./ledger";
import type { Db } from "./prisma";

const HOUR = 3_600_000;

/* ------------------------------------------------------------------ */
/* Portafoglio                                                         */
/* ------------------------------------------------------------------ */

/**
 * Accredito sul portafoglio (crediti che non scadono), idempotente per `idempotencyKey`.
 * Restituisce il saldo totale dopo l'accredito, o `null` se era già stato fatto.
 */
export async function creditWallet(
  db: Db,
  input: { userId: string; amount: number; type: CreditTransactionType; description: string; idempotencyKey: string },
): Promise<number | null> {
  if (input.amount <= 0) throw new StoreError("BAD_REQUEST", "Importo non valido.");
  try {
    return await db.$transaction((tx) => creditWalletTx(tx, input));
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

async function creditWalletTx(
  tx: Tx,
  input: { userId: string; amount: number; type: CreditTransactionType; description: string; idempotencyKey: string },
): Promise<number> {
  const w = await lockWallet(tx, input.userId);
  const balanceAfter = w.subscription + w.wallet + input.amount;
  // Prima la riga del mastro: se la chiave esiste già fallisce qui e il saldo non si muove.
  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      walletAmount: input.amount,
      balanceAfter,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
    },
  });
  await tx.user.update({ where: { id: input.userId }, data: { walletCredits: { increment: input.amount } } });
  return balanceAfter;
}

/* ------------------------------------------------------------------ */
/* Gift card                                                           */
/* ------------------------------------------------------------------ */

export async function redeemGiftCard(db: Db, input: { userId: string; code: string; now?: Date }) {
  const code = normalizeGiftCode(input.code);
  return db.$transaction(async (tx) => {
    const card = await tx.giftCard.findUnique({ where: { code } });
    if (!card) throw new StoreError("NOT_FOUND", "Codice regalo non valido.");
    // Riscatto condizionato: due richieste concorrenti con lo stesso codice, ne passa una.
    const claimed = await tx.giftCard.updateMany({
      where: { id: card.id, redeemedById: null },
      data: { redeemedById: input.userId, redeemedAt: input.now ?? new Date() },
    });
    if (claimed.count !== 1) throw new StoreError("BAD_REQUEST", "Questa gift card è già stata usata.");
    const balance = await creditWalletTx(tx, {
      userId: input.userId,
      amount: card.credits,
      type: "GIFT_REDEEM",
      description: card.recipientName ? `Gift card per ${card.recipientName}` : "Gift card",
      idempotencyKey: `gift:${card.id}`,
    });
    return { credits: card.credits, balance };
  });
}

/* ------------------------------------------------------------------ */
/* Inviti                                                              */
/* ------------------------------------------------------------------ */

export function newReferralCode(name: string | null | undefined): string {
  const base = (name ?? "artista")
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return `${base || "ARTISTA"}${randomInt(100, 999)}`;
}

/** Codice invito dell'utente, creato al primo bisogno. */
export async function ensureReferralCode(db: Db, userId: string, name: string | null): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReferralCode(name);
    try {
      const updated = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      if (updated.count === 1) return code;
      return (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } })).referralCode!;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Impossibile generare un codice invito");
}

/**
 * Premio inviti, dopo il primo pagamento dell'invitato: crediti a entrambi nel portafoglio.
 * Idempotente; chi invita ha un tetto annuo (contro gli abusi), l'invitato riceve sempre il suo.
 */
export async function rewardReferral(db: Db, invitedUserId: string, now = new Date()): Promise<boolean> {
  const invited = await db.user.findUnique({
    where: { id: invitedUserId },
    select: { id: true, referredById: true, artistName: true, name: true },
  });
  if (!invited?.referredById || invited.referredById === invited.id) return false;
  const inviterId = invited.referredById;
  const invitedName = invited.artistName ?? invited.name ?? "un artista";

  const given = await creditWallet(db, {
    userId: invited.id,
    amount: REFERRAL.invitedCredits,
    type: "REFERRAL",
    description: "Benvenuto: sei arrivato con un invito",
    idempotencyKey: `referral:${invited.id}:invited`,
  });
  const thisYear = await db.creditTransaction.count({
    where: {
      userId: inviterId,
      type: "REFERRAL",
      idempotencyKey: { endsWith: ":inviter" },
      createdAt: { gte: new Date(now.getTime() - 365 * 24 * HOUR) },
    },
  });
  if (thisYear < REFERRAL.maxPerYear) {
    await creditWallet(db, {
      userId: inviterId,
      amount: REFERRAL.inviterCredits,
      type: "REFERRAL",
      description: `Invito: ${invitedName} si è abbonato`,
      idempotencyKey: `referral:${invited.id}:inviter`,
    });
  }
  return given !== null;
}

/* ------------------------------------------------------------------ */
/* Livelli Resident                                                    */
/* ------------------------------------------------------------------ */

/** Mesi di abbonamento pagati: le righe `grant:*` del mastro (gli upgrade non contano). */
export async function residentMonths(db: Db | Tx, userId: string): Promise<number> {
  return db.creditTransaction.count({
    where: { userId, type: "SUBSCRIPTION_GRANT", idempotencyKey: { startsWith: "grant:" } },
  });
}

export async function residentLevel(db: Db | Tx, userId: string) {
  const months = await residentMonths(db, userId);
  return { months, ...levelFor(months) };
}


/* ------------------------------------------------------------------ */
/* Licenze incluse nei servizi e nelle aste                            */
/* ------------------------------------------------------------------ */

async function grantIncludedLicense(tx: Tx, userId: string, beatId: string, type: LicenseType) {
  await tx.license.upsert({
    where: { userId_beatId_type: { userId, beatId, type } },
    create: { userId, beatId, type, creditsSpent: 0, terms: LICENSES[type].terms as unknown as Prisma.InputJsonValue },
    update: {},
  });
}

/* ------------------------------------------------------------------ */
/* Servizi dello studio                                                */
/* ------------------------------------------------------------------ */

export interface ServiceInput {
  userId: string;
  kind: ServiceKind;
  tierId: string;
  beatId?: string;
  notes: string;
  scheduledFor?: Date;
}

async function validateServiceBeat(tx: Tx, input: ServiceInput) {
  const service = SERVICES[input.kind];
  if (!service.needsBeat) return null;
  if (!input.beatId) throw new StoreError("BAD_REQUEST", "Scegli il beat su cui lavorare.");
  const beat = await tx.beat.findFirst({ where: { id: input.beatId, status: "PUBLISHED" }, select: { id: true, title: true } });
  if (!beat) throw new StoreError("NOT_FOUND", "Beat non disponibile.");
  if (input.kind === "RELEASE") {
    // Si distribuisce solo un pezzo con una licenza valida sul beat.
    const owned = await tx.license.count({ where: { userId: input.userId, beatId: beat.id, status: "ACTIVE" } });
    if (!owned) throw new StoreError("BAD_REQUEST", "Per l'uscita serve una licenza su questo beat.");
  }
  return beat;
}

/** Servizio pagato in crediti: addebito, ordine e riga del mastro nella stessa transazione. */
export async function orderServiceWithCredits(db: Db, input: ServiceInput) {
  const quote = quoteService(input.kind, input.tierId, "CREDITS");
  if (!quote.ok) throw new StoreError("BAD_REQUEST", quote.message);
  return db.$transaction(async (tx) => {
    await validateServiceBeat(tx, input);
    const wallet = await lockWallet(tx, input.userId);
    const { walletAmount, balanceAfter } = await debit(tx, input.userId, wallet, quote.credits);
    const order = await tx.serviceOrder.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        tierId: input.tierId,
        beatId: input.beatId,
        notes: input.notes,
        scheduledFor: input.scheduledFor,
        paidWith: "CREDITS",
        creditsSpent: quote.credits,
        status: "PAID",
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "SERVICE",
        amount: -quote.credits,
        walletAmount,
        balanceAfter,
        description: `${SERVICES[input.kind].name} · ${SERVICES[input.kind].tiers.find((t) => t.id === input.tierId)?.name}`,
        idempotencyKey: `service:${order.id}`,
      },
    });
    return { order, balance: balanceAfter };
  });
}

/** Servizio pagato con carta: l'ordine nasce in attesa di pagamento, il webhook lo conferma. */
export async function createPendingServiceOrder(db: Db, input: ServiceInput) {
  const level = await residentLevel(db, input.userId);
  const quote = quoteService(input.kind, input.tierId, "CARD", level.level.studioDiscountPct);
  if (!quote.ok) throw new StoreError("BAD_REQUEST", quote.message);
  return db.$transaction(async (tx) => {
    await validateServiceBeat(tx, input);
    return tx.serviceOrder.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        tierId: input.tierId,
        beatId: input.beatId,
        notes: input.notes,
        scheduledFor: input.scheduledFor,
        paidWith: "CARD",
        amountCents: quote.amountCents,
        discountPct: quote.discountPct,
        status: "PENDING_PAYMENT",
      },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Prodotti digitali                                                   */
/* ------------------------------------------------------------------ */

export async function buyProductWithCredits(db: Db, input: { userId: string; productId: string }) {
  const run = () =>
    db.$transaction(async (tx) => {
      const existing = await tx.productPurchase.findUnique({
        where: { userId_productId: { userId: input.userId, productId: input.productId } },
      });
      const wallet = await lockWallet(tx, input.userId);
      if (existing) return { purchase: existing, balance: wallet.subscription + wallet.wallet, alreadyOwned: true };
      const product = await tx.product.findFirst({ where: { id: input.productId, published: true } });
      if (!product) throw new StoreError("NOT_FOUND", "Prodotto non disponibile.");
      const { walletAmount, balanceAfter } = await debit(tx, input.userId, wallet, product.credits);
      const purchase = await tx.productPurchase.create({
        data: { userId: input.userId, productId: product.id, paidWith: "CREDITS", creditsSpent: product.credits },
      });
      await tx.creditTransaction.create({
        data: {
          userId: input.userId,
          type: "PRODUCT",
          amount: -product.credits,
          walletAmount,
          balanceAfter,
          description: product.title,
          idempotencyKey: `product:${purchase.id}`,
        },
      });
      return { purchase, balance: balanceAfter, alreadyOwned: false };
    });
  try {
    return await run();
  } catch (error) {
    // Due acquisti concorrenti dello stesso prodotto: il secondo trova quello già fatto.
    if (isUniqueViolation(error)) return run();
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Aste delle esclusive                                                */
/* ------------------------------------------------------------------ */

async function lockAuction(tx: Tx, auctionId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Auction" WHERE "id" = ${auctionId} FOR UPDATE`;
  const auction = await tx.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw new StoreError("NOT_FOUND", "Asta non trovata.");
  return auction;
}

/** Offerta: asta bloccata durante il controllo, quindi due offerte concorrenti non si scavalcano male. */
export async function placeBid(db: Db, input: { userId: string; auctionId: string; amountCents: number; now?: Date }) {
  const now = input.now ?? new Date();
  try {
    return await db.$transaction(async (tx) => {
      const auction = await lockAuction(tx, input.auctionId);
      if (auction.status !== "OPEN") throw new StoreError("BAD_REQUEST", "L'asta è chiusa.");
      const top = await tx.bid.findFirst({ where: { auctionId: auction.id }, orderBy: { amountCents: "desc" } });
      if (top?.userId === input.userId) throw new StoreError("BAD_REQUEST", "Sei già tu il miglior offerente.");
      // Prelazione Gold e Platinum: sulle aste non in diretta si offre già 24 ore prima dell'apertura.
      const level = await residentLevel(tx, input.userId);
      const early = !auction.live && hasAuctionEarlyAccess(level.level.id);
      const check = checkBid(
        {
          startsAt: early ? new Date(auction.startsAt.getTime() - 24 * HOUR) : auction.startsAt,
          endsAt: auction.endsAt,
          startPriceCents: auction.startPriceCents,
          minIncrementCents: auction.minIncrementCents,
          topBidCents: top?.amountCents ?? null,
        },
        input.amountCents,
        now,
      );
      if (!check.ok) throw new StoreError("BAD_REQUEST", check.message);
      const bid = await tx.bid.create({ data: { auctionId: auction.id, userId: input.userId, amountCents: input.amountCents, createdAt: now } });
      if (check.newEndsAt.getTime() !== auction.endsAt.getTime()) {
        await tx.auction.update({ where: { id: auction.id }, data: { endsAt: check.newEndsAt } });
      }
      return { bid, endsAt: check.newEndsAt };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new StoreError("BAD_REQUEST", "Qualcuno ha appena offerto la stessa cifra: rilancia.");
    throw error;
  }
}

/**
 * Chiude le aste scadute e passa l'esclusiva al secondo se il vincitore non paga in tempo.
 * Idempotente: si può chiamare a ogni lettura e dal cron.
 */
export async function settleAuction(db: Db, auctionId: string, now = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const auction = await lockAuction(tx, auctionId);
    const ended = auction.status === "OPEN" && auction.endsAt <= now;
    const overdue = auction.status === "AWAITING_PAYMENT" && auction.paymentDueAt !== null && auction.paymentDueAt <= now;
    if (!ended && !overdue) return;
    const skipped = overdue && auction.winnerId ? [...auction.skippedUserIds, auction.winnerId] : auction.skippedUserIds;
    const bids = await tx.bid.findMany({ where: { auctionId }, select: { userId: true, amountCents: true } });
    const winner = pickWinner(bids, skipped);
    await tx.auction.update({
      where: { id: auctionId },
      data: winner
        ? {
            status: "AWAITING_PAYMENT",
            winnerId: winner.userId,
            winningBidCents: winner.amountCents,
            paymentDueAt: new Date(now.getTime() + AUCTION.paymentHours * HOUR),
            skippedUserIds: skipped,
          }
        : { status: "UNSOLD", winnerId: null, winningBidCents: null, paymentDueAt: null, skippedUserIds: skipped },
    });
  });
}

export async function settleDueAuctions(db: Db, now = new Date()): Promise<number> {
  const due = await db.auction.findMany({
    where: {
      OR: [
        { status: "OPEN", endsAt: { lte: now } },
        { status: "AWAITING_PAYMENT", paymentDueAt: { lte: now } },
      ],
    },
    select: { id: true },
  });
  for (const a of due) await settleAuction(db, a.id, now);
  return due.length;
}

/* ------------------------------------------------------------------ */
/* Evasione dei pagamenti con carta (webhook Stripe)                   */
/* ------------------------------------------------------------------ */

export type PaymentPurpose = "TOPUP" | "GIFT" | "PRODUCT" | "SERVICE" | "AUCTION";

export interface PaidSession {
  sessionId: string;
  userId: string;
  amountTotal: number;
  metadata: Record<string, string>;
}

/**
 * Applica gli effetti di un Checkout pagato. Idempotente per `sessionId`.
 * `"stale"`: il pagamento è arrivato quando non era più valido (asta passata al secondo,
 * ordine annullato): il chiamante lo rimborsa.
 */
export async function fulfillPayment(db: Db, purpose: PaymentPurpose, s: PaidSession, now = new Date()): Promise<"ok" | "stale"> {
  switch (purpose) {
    case "TOPUP": {
      const pack = findPack(CREDIT_PACKS, s.metadata.packId ?? "");
      if (!pack) throw new Error(`Ricarica sconosciuta ${s.metadata.packId}`);
      await creditWallet(db, {
        userId: s.userId,
        amount: packCredits(pack),
        type: "TOPUP",
        description: `Ricarica ${pack.credits}${pack.bonus ? ` + ${pack.bonus} bonus` : ""} crediti`,
        idempotencyKey: `topup:${s.sessionId}`,
      });
      return "ok";
    }
    case "GIFT": {
      const card = findPack(GIFT_CARDS, s.metadata.cardId ?? "");
      if (!card) throw new Error(`Gift card sconosciuta ${s.metadata.cardId}`);
      if (await db.giftCard.findUnique({ where: { stripeSessionId: s.sessionId } })) return "ok";
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db.giftCard.create({
            data: {
              code: giftCode(randomInt),
              credits: packCredits(card),
              amountCents: s.amountTotal,
              recipientName: s.metadata.recipientName || null,
              message: s.metadata.message || null,
              purchaserId: s.userId,
              stripeSessionId: s.sessionId,
            },
          });
          return "ok";
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          // Collisione sulla sessione = già evasa; sul codice = si ritenta con un altro codice.
          if (await db.giftCard.findUnique({ where: { stripeSessionId: s.sessionId } })) return "ok";
        }
      }
      throw new Error("Impossibile generare il codice della gift card");
    }
    case "PRODUCT": {
      const productId = s.metadata.productId ?? "";
      try {
        await db.productPurchase.create({
          data: { userId: s.userId, productId, paidWith: "CARD", amountCents: s.amountTotal, stripeSessionId: s.sessionId },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      return "ok";
    }
    case "SERVICE": {
      return db.$transaction(async (tx) => {
        const paid = await tx.serviceOrder.updateMany({
          where: { id: s.metadata.orderId ?? "", userId: s.userId, status: "PENDING_PAYMENT" },
          data: { status: "PAID", stripeSessionId: s.sessionId },
        });
        if (paid.count !== 1) {
          const order = await tx.serviceOrder.findUnique({ where: { id: s.metadata.orderId ?? "" } });
          return order?.stripeSessionId === s.sessionId ? "ok" : "stale";
        }
        const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id: s.metadata.orderId } });
        const license = serviceLicense(order.kind, order.tierId);
        if (license && order.beatId) await grantIncludedLicense(tx, order.userId, order.beatId, license);
        return "ok" as const;
      });
    }
    case "AUCTION": {
      return db.$transaction(async (tx) => {
        const paid = await tx.auction.updateMany({
          where: { id: s.metadata.auctionId ?? "", winnerId: s.userId, status: "AWAITING_PAYMENT" },
          data: { status: "PAID", paidAt: now, stripeSessionId: s.sessionId },
        });
        if (paid.count !== 1) {
          const auction = await tx.auction.findUnique({ where: { id: s.metadata.auctionId ?? "" } });
          return auction?.stripeSessionId === s.sessionId ? "ok" : "stale";
        }
        const auction = await tx.auction.findUniqueOrThrow({ where: { id: s.metadata.auctionId } });
        await grantIncludedLicense(tx, s.userId, auction.beatId, "UNLIMITED");
        // Esclusiva venduta: il beat esce dal catalogo, chi l'aveva già in leasing lo conserva.
        await tx.beat.update({
          where: { id: auction.beatId },
          data: { exclusiveAvailable: false, exclusiveSoldAt: now, status: "ARCHIVED" },
        });
        return "ok" as const;
      });
    }
  }
}
