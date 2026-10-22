/**
 * Monetizzazione nel backend dimostrativo: stesse regole del DB (offers.ts, ledger-rules.ts),
 * stato in memoria. I pagamenti con carta sono simulati e risultano pagati all'istante.
 */
import { DEMO_PRODUCERS, DEMO_PRODUCTS } from "../demo-data";
import {
  AUCTION,
  CREDIT_PACKS,
  GIFT_CARDS,
  LIVE_TIER_RANK,
  SERVICES,
  auctionPhase,
  checkBid,
  findPack,
  findTier,
  giftCode,
  hasAuctionEarlyAccess,
  levelFor,
  minNextBid,
  normalizeGiftCode,
  packCredits,
  pickWinner,
  quoteService,
  serviceLicense,
} from "../offers";
import { totalCredits } from "../ledger-rules";
import type { AuctionSummary, GiftCardSummary, ProductSummary, ServiceOrderSummary } from "../types";
import type { StoreBackend } from "./backend";
import { DEMO_USER_ID, demoBeatById, demoDebit, demoLedger, state, toSummary, type DemoState } from "./demo-backend";
import { StoreError } from "./errors";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Kael è Gold: 7 mesi da Resident. */
const DEMO_LEVEL = levelFor(7).level;

interface DemoAuction {
  id: string;
  beatSlug: string;
  startsAt: number;
  endsAt: number;
  live: boolean;
  status: AuctionSummary["status"];
  winner: string | null;
  winningBidCents: number | null;
  paymentDueAt: number | null;
  bids: Array<{ userId: string; artist: string; amountCents: number; at: number }>;
}

export interface DemoCommerceState {
  ownedProducts: string[];
  orders: ServiceOrderSummary[];
  giftCards: GiftCardSummary[];
  /** Codici riscattabili: quelli comprati più uno dimostrativo. */
  giftCodes: Record<string, { credits: number; redeemed: boolean }>;
  auctions: DemoAuction[];
}

function liveAuction(now: number): DemoAuction {
  return {
    id: "demo-asta-level-37",
    beatSlug: "level-37",
    startsAt: now - 10 * MIN,
    endsAt: now + 35 * MIN,
    live: true,
    status: "OPEN",
    winner: null,
    winningBidCents: null,
    paymentDueAt: null,
    bids: [
      { userId: "bot-tommy", artist: "Tommy K", amountCents: 37500, at: now - 3 * MIN },
      { userId: "bot-sara", artist: "Sara V", amountCents: 32500, at: now - 6 * MIN },
      { userId: "bot-nebbia", artist: "Nebbia", amountCents: 30000, at: now - 9 * MIN },
    ],
  };
}

export function initialCommerceState(now: number): DemoCommerceState {
  return {
    ownedProducts: ["demo-prod-voce-chrome"],
    orders: [],
    giftCards: [],
    giftCodes: { "BR-DEMO-2026": { credits: 10, redeemed: false } },
    auctions: [
      liveAuction(now),
      {
        id: "demo-asta-ultimo-piano",
        beatSlug: "ultimo-piano",
        // Apre tra 20 ore: Kael (Gold) può già offrire grazie alla prelazione.
        startsAt: now + 20 * HOUR,
        endsAt: now + 22 * HOUR,
        live: false,
        status: "OPEN",
        winner: null,
        winningBidCents: null,
        paymentDueAt: null,
        bids: [],
      },
      {
        id: "demo-asta-polvere",
        beatSlug: "polvere",
        startsAt: now - 4 * DAY,
        endsAt: now - 3 * DAY,
        live: true,
        status: "PAID",
        winner: "Luce",
        winningBidCents: 45000,
        paymentDueAt: null,
        bids: [
          { userId: "bot-luce", artist: "Luce", amountCents: 45000, at: now - 3 * DAY - 2 * MIN },
          { userId: "bot-tommy", artist: "Tommy K", amountCents: 42500, at: now - 3 * DAY - 5 * MIN },
        ],
      },
    ],
  };
}

const productId = (slug: string) => `demo-prod-${slug}`;
const findProduct = (id: string) => DEMO_PRODUCTS.find((p) => productId(p.slug) === id);
const beatBySlug = (slug: string) => demoBeatById(`demo-${slug}`);

function requireDemoUser(userId: string): DemoState {
  if (userId !== DEMO_USER_ID) throw new StoreError("UNAUTHENTICATED");
  return state();
}

/** Chiusura delle aste demo; quella in diretta riparte da capo quando è finita da un po'. */
function settle(a: DemoAuction, now: number) {
  if (a.status === "OPEN" && a.endsAt <= now) {
    const top = pickWinner(a.bids, []);
    if (!top) a.status = "UNSOLD";
    else if (top.userId === DEMO_USER_ID) {
      a.status = "AWAITING_PAYMENT";
      a.winner = "Kael";
      a.winningBidCents = top.amountCents;
      a.paymentDueAt = now + AUCTION.paymentHours * HOUR;
    } else {
      a.status = "PAID";
      a.winner = top.artist;
      a.winningBidCents = top.amountCents;
    }
  }
  if (a.id === "demo-asta-level-37" && a.status !== "AWAITING_PAYMENT" && a.winner !== "Kael" && a.endsAt < now - 15 * MIN) {
    Object.assign(a, liveAuction(now));
  }
}

function toAuction(a: DemoAuction, now: number, viewer: boolean): AuctionSummary {
  const beat = beatBySlug(a.beatSlug)!;
  const sorted = [...a.bids].sort((x, y) => y.amountCents - x.amountCents);
  const top = sorted[0];
  const settled = a.status !== "OPEN";
  const view = { startsAt: new Date(a.startsAt), endsAt: new Date(a.endsAt) };
  return {
    id: a.id,
    beat: toSummary(beat),
    startsAt: view.startsAt.toISOString(),
    endsAt: view.endsAt.toISOString(),
    phase: auctionPhase(view, new Date(now)),
    status: a.status,
    live: a.live,
    startPriceCents: AUCTION.startPriceCents,
    minIncrementCents: AUCTION.minIncrementCents,
    topBidCents: top?.amountCents ?? null,
    minNextBidCents: minNextBid({
      ...view,
      startPriceCents: AUCTION.startPriceCents,
      minIncrementCents: AUCTION.minIncrementCents,
      topBidCents: top?.amountCents ?? null,
    }),
    bidCount: a.bids.length,
    leader: settled ? a.winner : (top?.artist ?? null),
    bids: sorted.slice(0, 10).map((b) => ({ artist: b.artist, amountCents: b.amountCents, at: new Date(b.at).toISOString() })),
    viewer: viewer
      ? {
          isLeader: !settled && top?.userId === DEMO_USER_ID,
          isWinner: a.winner === "Kael" && a.status !== "UNSOLD",
          payBy: a.winner === "Kael" && a.status === "AWAITING_PAYMENT" && a.paymentDueAt ? new Date(a.paymentDueAt).toISOString() : null,
          earlyAccess: !a.live && hasAuctionEarlyAccess(DEMO_LEVEL.id),
        }
      : null,
  };
}

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

export function createDemoCommerce(): CommerceBackend {
  return {
    async products(userId) {
      const owned = userId === DEMO_USER_ID ? state().ownedProducts : [];
      return DEMO_PRODUCTS.map((p): ProductSummary => {
        const producer = DEMO_PRODUCERS.find((d) => d.slug === p.producer);
        return {
          id: productId(p.slug),
          slug: p.slug,
          kind: p.kind,
          title: p.title,
          description: p.description,
          contents: p.contents,
          priceCents: p.priceCents,
          credits: p.credits,
          coverColor: p.coverColor,
          producer: producer ? { name: producer.name, accentColor: producer.accentColor } : null,
          owned: owned.includes(productId(p.slug)),
        };
      });
    },

    async buyProduct(userId, id, paidWith) {
      const s = requireDemoUser(userId);
      const product = findProduct(id);
      if (!product) throw new StoreError("NOT_FOUND", "Prodotto non disponibile.");
      if (s.ownedProducts.includes(id)) return { kind: "done", balance: totalCredits(s.credits), message: "Ce l'hai già: lo trovi in Libreria." };
      if (paidWith === "CREDITS") {
        demoDebit(s, product.credits);
        demoLedger(s, { type: "PRODUCT", amount: -product.credits, description: product.title });
      }
      s.ownedProducts.push(id);
      return {
        kind: "done",
        balance: totalCredits(s.credits),
        message: paidWith === "CARD" ? "Pagamento simulato (demo): scaricalo quando vuoi." : "Acquistato: scaricalo quando vuoi.",
      };
    },

    async productDownload(userId, id) {
      const s = requireDemoUser(userId);
      const product = findProduct(id);
      if (!product || !s.ownedProducts.includes(id)) throw new StoreError("NOT_FOUND", "Non hai acquistato questo prodotto.");
      return {
        kind: "text",
        filename: `${product.title} (DEMO).txt`,
        body: `${product.title}\n${product.description}\n\nContenuto:\n${product.contents.map((c) => `- ${c}`).join("\n")}\n\nVersione dimostrativa: in produzione qui scarichi lo ZIP da R2.\n`,
      };
    },

    async orderService(userId, input) {
      const s = requireDemoUser(userId);
      const service = SERVICES[input.kind];
      const quote = quoteService(input.kind, input.tierId, input.paidWith, DEMO_LEVEL.studioDiscountPct);
      if (!quote.ok) throw new StoreError("BAD_REQUEST", quote.message);
      let beat = null;
      if (service.needsBeat) {
        beat = input.beatId ? demoBeatById(input.beatId) : undefined;
        if (!beat) throw new StoreError("BAD_REQUEST", "Scegli il beat su cui lavorare.");
        if (input.kind === "RELEASE" && !s.licenses.some((l) => l.beatId === beat!.id)) {
          throw new StoreError("BAD_REQUEST", "Per l'uscita serve una licenza su questo beat.");
        }
      }
      const tier = findTier(input.kind, input.tierId)!;
      if (quote.paidWith === "CREDITS") {
        demoDebit(s, quote.credits);
        demoLedger(s, { type: "SERVICE", amount: -quote.credits, description: `${service.name} · ${tier.name}` });
      }
      const order: ServiceOrderSummary = {
        id: `demo-ord-${s.orders.length + 1}`,
        kind: input.kind,
        tierId: input.tierId,
        beat: beat ? { slug: beat.slug, title: beat.title } : null,
        notes: input.notes,
        scheduledFor: input.scheduledFor ?? null,
        paidWith: quote.paidWith,
        creditsSpent: quote.credits,
        amountCents: quote.amountCents,
        discountPct: quote.discountPct,
        status: "PAID",
        createdAt: new Date().toISOString(),
      };
      s.orders.unshift(order);
      const license = serviceLicense(input.kind, input.tierId);
      if (license && beat && !s.licenses.some((l) => l.beatId === beat!.id && l.type === license)) {
        s.licenses.push({ id: `demo-lic-${beat.slug}-${license.toLowerCase()}`, beatId: beat.id, type: license, creditsSpent: 0, createdAt: order.createdAt });
      }
      return {
        kind: "done",
        balance: totalCredits(s.credits),
        message: `${service.name} confermato${quote.paidWith === "CARD" ? " (pagamento simulato)" : ""}: ti scriviamo entro 24 ore.`,
      };
    },

    async orders(userId) {
      return userId === DEMO_USER_ID ? state().orders : [];
    },

    async checkout(userId, item) {
      const s = requireDemoUser(userId);
      if (item.purpose === "TOPUP") {
        const pack = findPack(CREDIT_PACKS, item.packId);
        if (!pack) throw new StoreError("BAD_REQUEST", "Ricarica non valida.");
        s.credits.wallet += packCredits(pack);
        demoLedger(s, { type: "TOPUP", amount: packCredits(pack), description: `Ricarica ${pack.credits}${pack.bonus ? ` + ${pack.bonus} bonus` : ""} crediti` });
        return { kind: "done", balance: totalCredits(s.credits), message: `+${packCredits(pack)} crediti (pagamento simulato).` };
      }
      if (item.purpose === "GIFT") {
        const card = findPack(GIFT_CARDS, item.cardId);
        if (!card) throw new StoreError("BAD_REQUEST", "Gift card non valida.");
        const code = giftCode((n) => Math.floor(Math.random() * n));
        s.giftCodes[code] = { credits: packCredits(card), redeemed: false };
        s.giftCards.unshift({
          id: `demo-gift-${s.giftCards.length + 1}`,
          code,
          credits: packCredits(card),
          recipientName: item.recipientName ?? null,
          redeemed: false,
          createdAt: new Date().toISOString(),
        });
        return { kind: "done", balance: totalCredits(s.credits), message: `Gift card pronta: ${code} (pagamento simulato).` };
      }
      const auction = s.auctions.find((a) => a.id === item.auctionId);
      if (!auction || auction.status !== "AWAITING_PAYMENT" || auction.winner !== "Kael") {
        throw new StoreError("BAD_REQUEST", "Non c'è nessuna esclusiva da pagare.");
      }
      auction.status = "PAID";
      const beat = beatBySlug(auction.beatSlug)!;
      if (!s.licenses.some((l) => l.beatId === beat.id && l.type === "UNLIMITED")) {
        s.licenses.push({ id: `demo-lic-${beat.slug}-unlimited`, beatId: beat.id, type: "UNLIMITED", creditsSpent: 0, createdAt: new Date().toISOString() });
      }
      return { kind: "done", balance: totalCredits(s.credits), message: `L'esclusiva di ${beat.title} è tua (pagamento simulato).` };
    },

    async giftCards(userId) {
      return userId === DEMO_USER_ID ? state().giftCards : [];
    },

    async redeemGift(userId, raw) {
      const s = requireDemoUser(userId);
      const code = normalizeGiftCode(raw);
      const card = s.giftCodes[code];
      if (!card) throw new StoreError("NOT_FOUND", "Codice regalo non valido.");
      if (card.redeemed) throw new StoreError("BAD_REQUEST", "Questa gift card è già stata usata.");
      card.redeemed = true;
      const bought = s.giftCards.find((g) => g.code === code);
      if (bought) bought.redeemed = true;
      s.credits.wallet += card.credits;
      demoLedger(s, { type: "GIFT_REDEEM", amount: card.credits, description: "Gift card" });
      return { credits: card.credits, balance: totalCredits(s.credits) };
    },

    async auctions(viewerId) {
      const s = state();
      const now = Date.now();
      s.auctions.forEach((a) => settle(a, now));
      return s.auctions.map((a) => toAuction(a, now, viewerId === DEMO_USER_ID));
    },

    async auction(id, viewerId) {
      const s = state();
      const a = s.auctions.find((x) => x.id === id);
      if (!a) return null;
      const now = Date.now();
      settle(a, now);
      return toAuction(a, now, viewerId === DEMO_USER_ID);
    },

    async bid(userId, auctionId, amountCents) {
      const s = requireDemoUser(userId);
      const a = s.auctions.find((x) => x.id === auctionId);
      if (!a) throw new StoreError("NOT_FOUND", "Asta non trovata.");
      const now = Date.now();
      settle(a, now);
      if (a.status !== "OPEN") throw new StoreError("BAD_REQUEST", "L'asta è chiusa.");
      const top = pickWinner(a.bids, []);
      if (top?.userId === DEMO_USER_ID) throw new StoreError("BAD_REQUEST", "Sei già tu il miglior offerente.");
      const early = !a.live && hasAuctionEarlyAccess(DEMO_LEVEL.id);
      const check = checkBid(
        {
          startsAt: new Date(early ? a.startsAt - DAY : a.startsAt),
          endsAt: new Date(a.endsAt),
          startPriceCents: AUCTION.startPriceCents,
          minIncrementCents: AUCTION.minIncrementCents,
          topBidCents: top?.amountCents ?? null,
        },
        amountCents,
        new Date(now),
      );
      if (!check.ok) throw new StoreError("BAD_REQUEST", check.message);
      a.bids.push({ userId: DEMO_USER_ID, artist: "Kael", amountCents, at: now });
      a.endsAt = check.newEndsAt.getTime();
      return toAuction(a, now, true);
    },

    async liveOverlay() {
      const s = state();
      const now = Date.now();
      s.auctions.forEach((a) => settle(a, now));
      const live = s.auctions.find((a) => a.live && a.startsAt <= now && (a.status === "OPEN" || a.status === "AWAITING_PAYMENT"));
      const queue = [
        { artist: "Sara V", tier: "super-skip" },
        { artist: "Nebbia", tier: "skip" },
        { artist: "Tommy K", tier: "skip" },
        ...s.orders.filter((o) => o.kind === "LIVE_SLOT").map((o) => ({ artist: "Kael", tier: o.tierId })),
      ]
        .sort((a, b) => (LIVE_TIER_RANK[a.tier] ?? 9) - (LIVE_TIER_RANK[b.tier] ?? 9))
        .map((q) => ({ ...q, tierName: findTier("LIVE_SLOT", q.tier)?.name ?? q.tier }));
      return { auction: live ? toAuction(live, now, false) : null, queue, updatedAt: new Date(now).toISOString() };
    },

    async pause(userId, resume) {
      const s = requireDemoUser(userId);
      if (resume) s.pausedUntil = null;
      else {
        // Come su Stripe: la pausa parte dal prossimo rinnovo (tra 24 giorni) e dura un mese.
        s.pausedUntil ??= new Date(Date.now() + (24 + 30) * DAY).toISOString();
      }
      return { pausedUntil: s.pausedUntil };
    },
  };
}
