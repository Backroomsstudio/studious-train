import { constructWebhookEvent, handleStripeEvent } from "@/lib/beats/server/billing";
import { errorResponse } from "@/lib/beats/server/errors";

/**
 * Webhook Stripe (configura su Stripe gli eventi: checkout.session.completed, invoice.payment_succeeded,
 * customer.subscription.created/updated/deleted). Il corpo va letto grezzo per verificare la firma.
 * Una risposta 5xx fa ritentare Stripe: gli effetti sono idempotenti.
 */
export async function POST(request: Request) {
  try {
    const event = constructWebhookEvent(await request.text(), request.headers.get("stripe-signature"));
    await handleStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
