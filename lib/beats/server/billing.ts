/**
 * Stripe: abbonamenti (mensili e annuali), pausa, portale clienti, pagamenti singoli
 * (ricariche, gift card, prodotti, servizi, aste) e webhook che muovono crediti e ordini.
 *
 * Regola d'oro: lo stato dell'abbonamento si legge sempre fresco da Stripe (`subscriptions.retrieve`)
 * invece di fidarsi del payload, così gli eventi possono arrivare in qualsiasi ordine o duplicati.
 */
import "server-only";
import Stripe from "stripe";
import type { BillingInterval, PlanTier, SubscriptionStatus } from "@/lib/generated/prisma/client";
import { addMonths, yearlyMonthsStarted } from "../ledger-rules";
import { PAUSE } from "../offers";
import { PLANS, type PlanInterval } from "../plans";
import { fulfillPayment, rewardReferral, settleDueAuctions, type PaymentPurpose } from "./commerce";
import { storeEnv } from "./env";
import { StoreError } from "./errors";
import { expireCreditsAtSubscriptionEnd, grantCycleCredits } from "./ledger";
import { getDb } from "./prisma";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = storeEnv.stripe.secretKey;
  if (!key) throw new StoreError("NOT_CONFIGURED", "Pagamenti non ancora configurati.");
  client ??= new Stripe(key, { appInfo: { name: "Backrooms Beat Store" } });
  return client;
}

function priceFor(tier: PlanTier, interval: PlanInterval): string {
  const price = (interval === "YEAR" ? storeEnv.stripe.yearlyPrices : storeEnv.stripe.prices)[tier];
  if (!price) {
    throw new StoreError("NOT_CONFIGURED", `Prezzo Stripe ${interval === "YEAR" ? "annuale " : ""}del piano ${PLANS[tier].name} non impostato.`);
  }
  return price;
}

function planForPrice(priceId: string): { tier: PlanTier; interval: BillingInterval } | null {
  for (const [interval, prices] of [
    ["MONTH", storeEnv.stripe.prices],
    ["YEAR", storeEnv.stripe.yearlyPrices],
  ] as const) {
    const tier = (Object.keys(prices) as PlanTier[]).find((t) => prices[t] === priceId);
    if (tier) return { tier, interval };
  }
  return null;
}

const STATUS: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  unpaid: "UNPAID",
  paused: "PAUSED",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
};

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

async function ensureCustomer(userId: string): Promise<string> {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create(
    { email: user.email ?? undefined, name: user.artistName ?? user.name ?? undefined, metadata: { userId } },
    { idempotencyKey: `customer:${userId}` },
  );
  await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(userId: string, tier: PlanTier, origin: string, interval: PlanInterval = "MONTH"): Promise<string> {
  const db = getDb();
  const current = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
  });
  // Chi ha già un abbonamento cambia piano dal portale (con proration), non con un secondo abbonamento.
  if (current) return createPortalSession(userId, origin);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await ensureCustomer(userId),
    client_reference_id: userId,
    line_items: [{ price: priceFor(tier, interval), quantity: 1 }],
    subscription_data: { metadata: { userId, tier, interval } },
    allow_promotion_codes: true,
    success_url: `${origin}/beats?abbonamento=attivo`,
    cancel_url: `${origin}/beats/piani`,
  });
  if (!session.url) throw new Error("Checkout Stripe senza URL");
  return session.url;
}

export async function createPortalSession(userId: string, origin: string): Promise<string> {
  const portal = await stripe().billingPortal.sessions.create({
    customer: await ensureCustomer(userId),
    return_url: `${origin}/beats/profilo`,
  });
  return portal.url;
}

/**
 * Pausa al posto della disdetta: Stripe sospende gli addebiti per un mese (le fatture vengono
 * annullate, quindi niente nuovi crediti), il saldo resta intatto. Una pausa ogni 6 mesi.
 */
export async function pauseSubscription(userId: string, resume = false, now = new Date()): Promise<Date | null> {
  const db = getDb();
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
    orderBy: { currentPeriodEnd: "desc" },
  });
  if (!sub) throw new StoreError("PLAN_REQUIRED", "Non hai un abbonamento attivo da mettere in pausa.");
  if (resume) {
    await stripe().subscriptions.update(sub.stripeSubscriptionId, { pause_collection: "" });
    await db.subscription.update({ where: { id: sub.id }, data: { pausedUntil: null } });
    return null;
  }
  if (sub.pausedUntil && sub.pausedUntil > now) return sub.pausedUntil;
  if (sub.lastPausedAt && addMonths(sub.lastPausedAt, PAUSE.cooldownMonths) > now) {
    throw new StoreError("BAD_REQUEST", "Puoi mettere in pausa l'abbonamento una volta ogni 6 mesi.");
  }
  const resumesAt = addMonths(sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now, PAUSE.months);
  await stripe().subscriptions.update(sub.stripeSubscriptionId, {
    pause_collection: { behavior: "void", resumes_at: Math.floor(resumesAt.getTime() / 1000) },
    cancel_at_period_end: false,
  });
  await db.subscription.update({ where: { id: sub.id }, data: { pausedUntil: resumesAt, lastPausedAt: now, cancelAtPeriodEnd: false } });
  return resumesAt;
}

/* ------------------------------------------------------------------ */
/* Pagamenti singoli                                                   */
/* ------------------------------------------------------------------ */

export interface PaymentRequest {
  userId: string;
  purpose: PaymentPurpose;
  name: string;
  description?: string;
  amountCents: number;
  metadata: Record<string, string>;
  successPath: string;
  cancelPath: string;
  /** Scadenza del Checkout (es. termine per pagare un'asta). */
  expiresAt?: Date;
}

/** Checkout in modalità `payment` con prezzo calcolato dal server (mai dal client). */
export async function createPaymentCheckout(req: PaymentRequest, origin: string): Promise<string> {
  const metadata = { ...req.metadata, purpose: req.purpose, userId: req.userId };
  const expires = req.expiresAt
    ? Math.min(Math.max(req.expiresAt.getTime(), Date.now() + 31 * 60_000), Date.now() + 23 * 3_600_000)
    : undefined;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer: await ensureCustomer(req.userId),
    client_reference_id: req.userId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: req.amountCents,
          product_data: { name: req.name, description: req.description },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    invoice_creation: { enabled: true },
    expires_at: expires ? Math.floor(expires / 1000) : undefined,
    success_url: `${origin}${req.successPath}${req.successPath.includes("?") ? "&" : "?"}sessione={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${req.cancelPath}`,
  });
  if (!session.url) throw new Error("Checkout Stripe senza URL");
  return session.url;
}

const PURPOSES: PaymentPurpose[] = ["TOPUP", "GIFT", "PRODUCT", "SERVICE", "AUCTION"];

async function onPaymentCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const purpose = session.metadata?.purpose as PaymentPurpose | undefined;
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!purpose || !PURPOSES.includes(purpose) || !userId) return;
  const outcome = await fulfillPayment(getDb(), purpose, {
    sessionId: session.id,
    userId,
    amountTotal: session.amount_total ?? 0,
    metadata: session.metadata ?? {},
  });
  // Pagamento arrivato fuori tempo (asta già passata al secondo): si restituisce subito.
  const paymentIntent = idOf(session.payment_intent);
  if (outcome === "stale" && paymentIntent) {
    await stripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `stale-refund:${session.id}` });
  }
}

/* ------------------------------------------------------------------ */
/* Abbonamenti                                                         */
/* ------------------------------------------------------------------ */

/** Allinea la riga `Subscription` allo stato reale su Stripe. */
async function syncSubscription(subscriptionId: string) {
  const db = getDb();
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error(`Abbonamento ${sub.id} senza voci`);
  const plan = planForPrice(item.price.id);
  if (!plan) throw new Error(`Prezzo ${item.price.id} non associato a nessun piano`);

  const customerId = idOf(sub.customer);
  const user = await db.user.findFirst({
    where: { OR: [{ stripeCustomerId: customerId ?? "" }, { id: sub.metadata.userId ?? "" }] },
  });
  if (!user) throw new Error(`Nessun utente per il cliente ${customerId}`);

  const resumesAt = sub.pause_collection?.resumes_at;
  const data = {
    stripePriceId: item.price.id,
    tier: plan.tier,
    interval: plan.interval,
    status: STATUS[sub.status] ?? "INCOMPLETE",
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    pausedUntil: sub.pause_collection ? (resumesAt ? new Date(resumesAt * 1000) : new Date(item.current_period_end * 1000)) : null,
  };
  return db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { ...data, userId: user.id, stripeSubscriptionId: sub.id },
    update: data,
  });
}

/** Inizio della mensilità di crediti in corso (per gli annuali non coincide con l'inizio del periodo). */
function currentMonthStart(periodStart: Date, interval: BillingInterval, now: Date): Date {
  if (interval === "MONTH") return periodStart;
  return addMonths(periodStart, Math.max(0, yearlyMonthsStarted(periodStart, now) - 1));
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId || !invoice.id) return;
  const reason =
    invoice.billing_reason === "subscription_create" || invoice.billing_reason === "subscription_cycle"
      ? "renewal"
      : invoice.billing_reason === "subscription_update"
        ? "upgrade"
        : null;
  if (!reason) return;

  const db = getDb();
  const sub = await syncSubscription(subscriptionId);
  await grantCycleCredits(db, {
    userId: sub.userId,
    subscriptionId: sub.id,
    tier: sub.tier,
    cycleKey: invoice.id,
    invoiceId: invoice.id,
    reason,
    periodStart: currentMonthStart(sub.currentPeriodStart, sub.interval, new Date()),
  });
  // Primo pagamento di chi è arrivato con un invito: crediti a entrambi.
  if (invoice.billing_reason === "subscription_create") await rewardReferral(db, sub.userId);
}

/**
 * Cron mensile: accredita le mensilità già iniziate degli abbonamenti annuali (la prima arriva
 * con la fattura) e chiude le aste scadute. Idempotente: si può lanciare ogni ora.
 */
export async function runScheduledJobs(now = new Date()) {
  const db = getDb();
  const yearly = await db.subscription.findMany({
    where: { interval: "YEAR", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: now } },
  });
  let granted = 0;
  for (const sub of yearly) {
    if (sub.pausedUntil && sub.pausedUntil > now) continue;
    const started = yearlyMonthsStarted(sub.currentPeriodStart, now);
    for (let m = 1; m < started; m++) {
      const ok = await grantCycleCredits(db, {
        userId: sub.userId,
        subscriptionId: sub.id,
        tier: sub.tier,
        cycleKey: `${sub.id}:${sub.currentPeriodStart.toISOString()}:m${m}`,
        reason: "renewal",
        periodStart: addMonths(sub.currentPeriodStart, m),
      });
      if (ok) granted++;
    }
  }
  const auctions = await settleDueAuctions(db, now);
  return { granted, auctions };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.mode === "payment") {
        await onPaymentCompleted(session);
      } else {
        const subscriptionId = idOf(session.subscription);
        if (subscriptionId) await syncSubscription(subscriptionId);
      }
      break;
    }
    case "invoice.payment_succeeded":
      await onInvoicePaid(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object.id);
      break;
    case "customer.subscription.deleted": {
      const sub = await syncSubscription(event.data.object.id);
      await expireCreditsAtSubscriptionEnd(db, { userId: sub.userId, subscriptionId: sub.id });
      break;
    }
    default:
      break;
  }

  // Registrato solo a elaborazione riuscita: se qualcosa fallisce, Stripe ritenta e gli effetti
  // già applicati non si ripetono grazie agli idempotencyKey del mastro.
  await db.stripeEvent.create({ data: { id: event.id, type: event.type } }).catch(() => undefined);
}

export function constructWebhookEvent(payload: string, signature: string | null): Stripe.Event {
  const secret = storeEnv.stripe.webhookSecret;
  if (!secret) throw new StoreError("NOT_CONFIGURED", "STRIPE_WEBHOOK_SECRET non impostato.");
  if (!signature) throw new StoreError("BAD_REQUEST", "Firma Stripe mancante.");
  try {
    return stripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    throw new StoreError("BAD_REQUEST", "Firma Stripe non valida.");
  }
}
