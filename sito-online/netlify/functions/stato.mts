import { busyIntervals } from "../../src/booking/google-calendar.ts";
import { calendarConfigured, mailConfigured, serverConfig, stripeConfigured } from "../../src/booking/server-config.ts";
import { stripe } from "../../src/booking/stripe.ts";

/**
 * GET /api/stato — controllo della messa online: dice se calendario, Stripe ed email sono collegati.
 * Non mostra chiavi né dati dei clienti: solo "ok" o cosa manca.
 */
export default async () => {
  const out: Record<string, unknown> = {};

  if (!calendarConfigured) out.calendario = "manca: GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY";
  else {
    try {
      const now = new Date();
      const busy = await busyIntervals(now, new Date(now.getTime() + 7 * 24 * 3600_000));
      out.calendario = `ok: letti ${serverConfig.busyCalendarIds.length} calendari, ${busy.length} impegni nei prossimi 7 giorni`;
    } catch (e) {
      out.calendario = `errore: ${(e as Error).message.slice(0, 200)} (il calendario è condiviso con l'account di servizio?)`;
    }
  }

  if (!stripeConfigured) out.stripe = "manca: STRIPE_SECRET_KEY";
  else {
    try {
      await stripe().balance.retrieve();
      out.stripe = serverConfig.stripeSecretKey.startsWith("sk_live_") ? "ok: modalità LIVE (incassi veri)" : "ok: modalità TEST (nessun incasso vero)";
    } catch (e) {
      out.stripe = `errore: ${(e as Error).message.slice(0, 200)}`;
    }
  }
  out.webhook = serverConfig.stripeWebhookSecret ? "ok: segreto impostato" : "manca: STRIPE_WEBHOOK_SECRET (senza, i pagamenti non diventano verdi in calendario)";
  out.email = mailConfigured ? `ok: notifiche a ${serverConfig.notifyEmails.length} indirizzi` : "manca: SMTP_USER e SMTP_PASS (le prenotazioni funzionano, ma senza email)";

  const pronto = [out.calendario, out.stripe, out.webhook].every((v) => String(v).startsWith("ok"));
  return Response.json({ pronto, ...out }, { headers: { "Cache-Control": "no-store" } });
};

export const config = { path: "/api/stato" };
