import { busyIntervals } from "../../src/booking/google-calendar.ts";
import { telegramBotName } from "../../src/booking/telegram.ts";
import { calendarConfigured, mailConfigured, serverConfig, stripeConfigured, telegramConfigured } from "../../src/booking/server-config.ts";
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
      const msg = (e as Error).message;
      out.calendario = msg.includes("notFound") || msg.includes("404")
        ? "errore: calendario non trovato (è condiviso con l'email dell'account di servizio?)"
        : msg.includes("Google token")
          ? "errore: Google rifiuta l'account di servizio (GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY copiati male)"
          : "errore: calendario non leggibile (controlla la condivisione con l'account di servizio)";
    }
  }

  // Mai riportare messaggi d'errore di Stripe: possono contenere pezzi della chiave.
  const key = serverConfig.stripeSecretKey;
  const hook = serverConfig.stripeWebhookSecret;
  if (!stripeConfigured) out.stripe = "manca: STRIPE_SECRET_KEY";
  else if (key.startsWith("whsec_")) out.stripe = "errore: in STRIPE_SECRET_KEY c'è il segreto del webhook (whsec_…). Serve la chiave segreta sk_test_… o sk_live_… (Stripe → Sviluppatori → Chiavi API)";
  else if (key.startsWith("pk_")) out.stripe = "errore: in STRIPE_SECRET_KEY c'è la chiave pubblicabile (pk_…). Serve la chiave segreta sk_test_… o sk_live_…";
  else if (!/^(sk|rk)_(test|live)_/.test(key)) out.stripe = "errore: STRIPE_SECRET_KEY non sembra una chiave segreta Stripe (deve iniziare con sk_test_ o sk_live_)";
  else {
    try {
      await stripe().balance.retrieve();
      out.stripe = key.includes("_live_") ? "ok: modalità LIVE (incassi veri)" : "ok: modalità TEST (nessun incasso vero)";
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      out.stripe = status === 401 ? "errore: Stripe rifiuta la chiave (revocata o copiata male)" : "errore: Stripe non raggiungibile, riprova tra poco";
    }
  }
  if (!hook) out.webhook = "manca: STRIPE_WEBHOOK_SECRET (senza, i pagamenti non diventano verdi in calendario)";
  else if (!hook.startsWith("whsec_")) out.webhook = "errore: STRIPE_WEBHOOK_SECRET deve iniziare con whsec_ (Stripe → Sviluppatori → Webhook → Segreto di firma)";
  else out.webhook = "ok: segreto impostato";
  out.email = mailConfigured ? `ok: notifiche a ${serverConfig.notifyEmails.length} indirizzi` : "manca: SMTP_USER e SMTP_PASS (le prenotazioni funzionano, ma senza email)";

  if (!serverConfig.telegramToken) out.telegram = "manca: TELEGRAM_BOT_TOKEN (le prenotazioni funzionano, ma senza messaggio Telegram)";
  else {
    try {
      const bot = await telegramBotName();
      out.telegram = telegramConfigured
        ? `ok: @${bot} scrive a ${serverConfig.telegramChatIds.length} chat`
        : `manca: TELEGRAM_CHAT_ID (il bot @${bot} funziona, ma non sa a chi scrivere)`;
    } catch {
      out.telegram = "errore: Telegram rifiuta TELEGRAM_BOT_TOKEN (copiato male o revocato)";
    }
  }
  const pronto = [out.calendario, out.stripe, out.webhook].every((v) => String(v).startsWith("ok"));
  return Response.json({ pronto, ...out }, { headers: { "Cache-Control": "no-store" } });
};

export const config = { path: "/api/stato" };
