import type Stripe from "stripe";
import { confirmPaidSession, handleRenewal, releaseExpiredSession } from "../../src/booking/book.ts";
import { serverConfig } from "../../src/booking/server-config.ts";
import { stripe } from "../../src/booking/stripe.ts";

/**
 * POST /api/stripe/webhook — Stripe avvisa il sito quando un pagamento va a buon fine, scade o si rinnova.
 * Eventi da attivare nella dashboard: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, checkout.session.expired, invoice.paid.
 */
export default async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !serverConfig.stripeWebhookSecret) return new Response("Firma mancante", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, serverConfig.stripeWebhookSecret);
  } catch {
    return new Response("Firma non valida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (event.data.object.payment_status !== "unpaid") await confirmPaidSession(event.data.object);
        break;
      case "checkout.session.async_payment_succeeded":
        await confirmPaidSession(event.data.object);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await releaseExpiredSession(event.data.object);
        break;
      case "invoice.paid":
        await handleRenewal(event.data.object);
        break;
    }
  } catch (e) {
    console.error(`[webhook] ${event.type}`, e);
    return new Response("Errore", { status: 500 }); // Stripe riprova più tardi
  }
  return new Response("ok");
};

export const config = { path: "/api/stripe/webhook" };
