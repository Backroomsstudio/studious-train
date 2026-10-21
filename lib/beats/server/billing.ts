/**
 * Stripe Billing: checkout degli abbonamenti, portale clienti e webhook che muovono i crediti.
 *
 * Regola d'oro: lo stato dell'abbonamento si legge sempre fresco da Stripe (`subscriptions.retrieve`)
 * invece di fidarsi del payload, così gli eventi possono arrivare in qualsiasi ordine o duplicati.
 */
import "server-only";
import Stripe from "stripe";
import type { PlanTier, SubscriptionStatus } from "@/lib/generated/prisma/client";
import { PLANS } from "../plans";
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

function priceFor(tier: PlanTier): string {
  const price = storeEnv.stripe.prices[tier];
  if (!price) throw new StoreError("NOT_CONFIGURED", `Prezzo Stripe del piano ${PLANS[tier].name} non impostato.`);
  return price;
}

function tierForPrice(priceId: string): PlanTier | null {
  const prices = storeEnv.stripe.prices;
  return (Object.keys(prices) as PlanTier[]).find((tier) => prices[tier] === priceId) ?? null;
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

export async function createCheckoutSession(userId: string, tier: PlanTier, origin: string): Promise<string> {
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
    line_items: [{ price: priceFor(tier), quantity: 1 }],
    subscription_data: { metadata: { userId, tier } },
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
    return_url: `${origin}/beats/libreria`,
  });
  return portal.url;
}

/** Allinea la riga `Subscription` allo stato reale su Stripe. */
async function syncSubscription(subscriptionId: string) {
  const db = getDb();
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error(`Abbonamento ${sub.id} senza voci`);
  const tier = tierForPrice(item.price.id);
  if (!tier) throw new Error(`Prezzo ${item.price.id} non associato a nessun piano`);

  const customerId = idOf(sub.customer);
  const user = await db.user.findFirst({
    where: { OR: [{ stripeCustomerId: customerId ?? "" }, { id: sub.metadata.userId ?? "" }] },
  });
  if (!user) throw new Error(`Nessun utente per il cliente ${customerId}`);

  const data = {
    stripePriceId: item.price.id,
    tier,
    status: STATUS[sub.status] ?? "INCOMPLETE",
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };
  return db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { ...data, userId: user.id, stripeSubscriptionId: sub.id },
    update: data,
  });
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

  const sub = await syncSubscription(subscriptionId);
  await grantCycleCredits(getDb(), {
    userId: sub.userId,
    subscriptionId: sub.id,
    tier: sub.tier,
    invoiceId: invoice.id,
    reason,
    periodStart: sub.currentPeriodStart,
  });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const subscriptionId = idOf(event.data.object.subscription);
      if (subscriptionId) await syncSubscription(subscriptionId);
      break;
    }
    case "invoice.payment_succeeded":
      await onInvoicePaid(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
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
