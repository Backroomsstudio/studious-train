/**
 * Parte "monetizzazione" del backend Prisma: prodotti, servizi, ricariche, gift card, aste,
 * overlay della live e pausa. La logica che muove soldi e crediti è in `commerce.ts`.
 */
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  CREDIT_PACKS,
  GIFT_CARDS,
  LIVE_TIER_RANK,
  PRODUCT_KINDS,
  SERVICES,
  auctionPhase,
  findPack,
  findTier,
  hasAuctionEarlyAccess,
  minNextBid,
  packCredits,
} from "../offers";
import type { AuctionSummary, ServiceOrderSummary } from "../types";
import type { StoreBackend } from "./backend";
import { createPaymentCheckout, pauseSubscription } from "./billing";
import {
  buyProductWithCredits,
  createPendingServiceOrder,
  orderServiceWithCredits,
  placeBid,
  redeemGiftCard,
  residentLevel,
  settleAuction,
} from "./commerce";
import { StoreError } from "./errors";
import { getDb } from "./prisma";
import { beatInclude, toSummary } from "./prisma-backend";

type CommerceBackend = Pick<
  StoreBackend,
  | "products"
  | "buyProduct"
  | "productDownload"
  | "orderService"
  | "orders"
  | "checkout"
  | "giftCards"
  | "redeemGift"
  | "auctions"
  | "auction"
  | "bid"
  | "liveOverlay"
  | "pause"
>;

const artistOf = (u: { artistName: string | null; name: string | null } | null) =>
  u?.artistName ?? u?.name?.split(" ")[0] ?? "Artista";

const auctionInclude = (now: Date) =>
  ({
    beat: { include: beatInclude(now) },
    winner: { select: { artistName: true, name: true } },
    bids: { orderBy: { amountCents: "desc" }, take: 10, include: { user: { select: { artistName: true, name: true } } } },
    _count: { select: { bids: true } },
  }) satisfies Prisma.AuctionInclude;

type AuctionRow = Prisma.AuctionGetPayload<{ include: ReturnType<typeof auctionInclude> }>;

function toAuction(row: AuctionRow, now: Date, viewer: { id: string; levelId: string } | null): AuctionSummary {
  const top = row.bids[0];
  const settled = row.status !== "OPEN";
  return {
    id: row.id,
    beat: toSummary(row.beat),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    phase: auctionPhase(row, now),
    status: row.status,
    live: row.live,
    startPriceCents: row.startPriceCents,
    minIncrementCents: row.minIncrementCents,
    topBidCents: top?.amountCents ?? null,
    minNextBidCents: minNextBid({ ...row, topBidCents: top?.amountCents ?? null }),
    bidCount: row._count.bids,
    leader: settled ? (row.winner ? artistOf(row.winner) : null) : top ? artistOf(top.user) : null,
    bids: row.bids.map((b) => ({ artist: artistOf(b.user), amountCents: b.amountCents, at: b.createdAt.toISOString() })),
    viewer: viewer
      ? {
          isLeader: !settled && top?.userId === viewer.id,
          isWinner: row.winnerId === viewer.id && row.status !== "UNSOLD",
          payBy: row.winnerId === viewer.id && row.status === "AWAITING_PAYMENT" ? (row.paymentDueAt?.toISOString() ?? null) : null,
          earlyAccess: !row.live && hasAuctionEarlyAccess(viewer.levelId as "GOLD"),
        }
      : null,
  };
}

export function createPrismaCommerce(): CommerceBackend {
  const db = getDb();

  async function viewerCtx(viewerId: string | null) {
    if (!viewerId) return null;
    const level = await residentLevel(db, viewerId);
    return { id: viewerId, levelId: level.level.id };
  }

  async function loadAuction(id: string, viewerId: string | null) {
    const now = new Date();
    await settleAuction(db, id, now).catch((error) => {
      if (!(error instanceof StoreError)) throw error;
    });
    const row = await db.auction.findUnique({ where: { id }, include: auctionInclude(now) });
    return row ? toAuction(row, now, await viewerCtx(viewerId)) : null;
  }

  return {
    async products(userId) {
      const rows = await db.product.findMany({
        where: { published: true },
        include: {
          producer: true,
          purchases: { where: { userId: userId ?? "" }, select: { id: true } },
        },
        orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      });
      return rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        kind: p.kind,
        title: p.title,
        description: p.description,
        contents: p.contents,
        priceCents: p.priceCents,
        credits: p.credits,
        coverColor: p.coverColor,
        producer: p.producer ? { name: p.producer.name, accentColor: p.producer.accentColor } : null,
        owned: p.purchases.length > 0,
      }));
    },

    async buyProduct(userId, productId, paidWith, origin) {
      if (paidWith === "CREDITS") {
        const { balance, alreadyOwned } = await buyProductWithCredits(db, { userId, productId });
        return { kind: "done", balance, message: alreadyOwned ? "Ce l'hai già: lo trovi in Libreria." : "Acquistato: scaricalo quando vuoi." };
      }
      const product = await db.product.findFirst({ where: { id: productId, published: true } });
      if (!product) throw new StoreError("NOT_FOUND", "Prodotto non disponibile.");
      if (await db.productPurchase.findUnique({ where: { userId_productId: { userId, productId } } })) {
        throw new StoreError("BAD_REQUEST", "Ce l'hai già: lo trovi in Libreria.");
      }
      const url = await createPaymentCheckout(
        {
          userId,
          purpose: "PRODUCT",
          name: product.title,
          description: PRODUCT_KINDS[product.kind],
          amountCents: product.priceCents,
          metadata: { productId: product.id },
          successPath: "/beats/kit?pagato=1",
          cancelPath: "/beats/kit",
        },
        origin,
      );
      return { kind: "redirect", url };
    },

    async productDownload(userId, productId) {
      const purchase = await db.productPurchase.findUnique({
        where: { userId_productId: { userId, productId } },
        include: { product: true },
      });
      if (!purchase) throw new StoreError("NOT_FOUND", "Non hai acquistato questo prodotto.");
      return {
        kind: "r2",
        objectKey: purchase.product.objectKey,
        contentType: "application/zip",
        filename: `${purchase.product.title} - Backrooms.zip`,
      };
    },

    async orderService(userId, input, origin) {
      const base = {
        userId,
        kind: input.kind,
        tierId: input.tierId,
        beatId: input.beatId,
        notes: input.notes,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
      };
      const service = SERVICES[input.kind];
      const tier = findTier(input.kind, input.tierId);
      if (input.paidWith === "CREDITS") {
        const { balance } = await orderServiceWithCredits(db, base);
        return { kind: "done", balance, message: `${service.name} confermato: ti scriviamo entro 24 ore.` };
      }
      const order = await createPendingServiceOrder(db, base);
      const url = await createPaymentCheckout(
        {
          userId,
          purpose: "SERVICE",
          name: `${service.name} · ${tier?.name}`,
          description: order.discountPct ? `Sconto Resident -${order.discountPct}%` : tier?.detail,
          amountCents: order.amountCents,
          metadata: { orderId: order.id },
          successPath: "/beats/libreria?ordine=confermato",
          cancelPath: "/beats/studio",
        },
        origin,
      );
      return { kind: "redirect", url };
    },

    async orders(userId) {
      const rows = await db.serviceOrder.findMany({
        where: { userId, status: { not: "PENDING_PAYMENT" } },
        include: { beat: { select: { slug: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return rows.map(
        (o): ServiceOrderSummary => ({
          id: o.id,
          kind: o.kind,
          tierId: o.tierId,
          beat: o.beat,
          notes: o.notes,
          scheduledFor: o.scheduledFor?.toISOString() ?? null,
          paidWith: o.paidWith,
          creditsSpent: o.creditsSpent,
          amountCents: o.amountCents,
          discountPct: o.discountPct,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        }),
      );
    },

    async checkout(userId, item, origin) {
      if (item.purpose === "TOPUP") {
        const pack = findPack(CREDIT_PACKS, item.packId);
        if (!pack) throw new StoreError("BAD_REQUEST", "Ricarica non valida.");
        const url = await createPaymentCheckout(
          {
            userId,
            purpose: "TOPUP",
            name: `Ricarica ${packCredits(pack)} crediti`,
            description: "Crediti che non scadono mai",
            amountCents: pack.priceCents,
            metadata: { packId: pack.id },
            successPath: "/beats/libreria?ricarica=ok",
            cancelPath: "/beats/piani",
          },
          origin,
        );
        return { kind: "redirect", url };
      }
      if (item.purpose === "GIFT") {
        const card = findPack(GIFT_CARDS, item.cardId);
        if (!card) throw new StoreError("BAD_REQUEST", "Gift card non valida.");
        const url = await createPaymentCheckout(
          {
            userId,
            purpose: "GIFT",
            name: `Gift card ${packCredits(card)} crediti`,
            description: item.recipientName ? `Per ${item.recipientName}` : "Backrooms Beat Store",
            amountCents: card.priceCents,
            metadata: { cardId: card.id, recipientName: item.recipientName ?? "", message: (item.message ?? "").slice(0, 400) },
            successPath: "/beats/libreria?regalo=ok",
            cancelPath: "/beats/piani",
          },
          origin,
        );
        return { kind: "redirect", url };
      }
      const auction = await db.auction.findUnique({ where: { id: item.auctionId }, include: { beat: true } });
      if (!auction || auction.status !== "AWAITING_PAYMENT" || auction.winnerId !== userId || !auction.winningBidCents) {
        throw new StoreError("BAD_REQUEST", "Non c'è nessuna esclusiva da pagare.");
      }
      const url = await createPaymentCheckout(
        {
          userId,
          purpose: "AUCTION",
          name: `Esclusiva · ${auction.beat.title}`,
          description: "Proprietà esclusiva del beat, con trackout e contratto",
          amountCents: auction.winningBidCents,
          metadata: { auctionId: auction.id },
          successPath: `/beats/aste/${auction.id}?pagato=1`,
          cancelPath: `/beats/aste/${auction.id}`,
          expiresAt: auction.paymentDueAt ?? undefined,
        },
        origin,
      );
      return { kind: "redirect", url };
    },

    async giftCards(userId) {
      const rows = await db.giftCard.findMany({ where: { purchaserId: userId }, orderBy: { createdAt: "desc" }, take: 20 });
      return rows.map((g) => ({
        id: g.id,
        code: g.code,
        credits: g.credits,
        recipientName: g.recipientName,
        redeemed: Boolean(g.redeemedById),
        createdAt: g.createdAt.toISOString(),
      }));
    },

    async redeemGift(userId, code) {
      return redeemGiftCard(db, { userId, code });
    },

    async auctions(viewerId) {
      const now = new Date();
      const ids = await db.auction.findMany({
        where: { OR: [{ status: { in: ["OPEN", "AWAITING_PAYMENT"] } }, { endsAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } }] },
        orderBy: { endsAt: "asc" },
        select: { id: true },
        take: 20,
      });
      const list = await Promise.all(ids.map((a) => loadAuction(a.id, viewerId)));
      return list.filter((a) => a !== null);
    },

    auction: loadAuction,

    async bid(userId, auctionId, amountCents) {
      await placeBid(db, { userId, auctionId, amountCents });
      return (await loadAuction(auctionId, userId))!;
    },

    async liveOverlay() {
      const now = new Date();
      const live = await db.auction.findFirst({
        where: { live: true, status: { in: ["OPEN", "AWAITING_PAYMENT"] }, startsAt: { lte: now } },
        orderBy: { endsAt: "asc" },
        select: { id: true },
      });
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const slots = await db.serviceOrder.findMany({
        where: {
          kind: "LIVE_SLOT",
          status: { in: ["PAID", "IN_PROGRESS"] },
          OR: [{ scheduledFor: null }, { scheduledFor: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } }],
        },
        include: { user: { select: { artistName: true, name: true } } },
        orderBy: { createdAt: "asc" },
        take: 30,
      });
      return {
        auction: live ? await loadAuction(live.id, null) : null,
        queue: slots
          .sort((a, b) => (LIVE_TIER_RANK[a.tierId] ?? 9) - (LIVE_TIER_RANK[b.tierId] ?? 9))
          .map((o) => ({ artist: artistOf(o.user), tier: o.tierId, tierName: findTier("LIVE_SLOT", o.tierId)?.name ?? o.tierId })),
        updatedAt: now.toISOString(),
      };
    },

    async pause(userId, resume) {
      const until = await pauseSubscription(userId, resume);
      return { pausedUntil: until?.toISOString() ?? null };
    },
  };
}

