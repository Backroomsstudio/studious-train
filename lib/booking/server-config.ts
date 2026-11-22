import "server-only";
import { studio } from "@/lib/studio";

/**
 * Configurazione lato server, letta dalle variabili d'ambiente (Netlify → Site configuration →
 * Environment variables). Nessun segreto finisce nel codice o nel browser.
 */

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const serverConfig = {
  stripeSecretKey: env("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: env("STRIPE_WEBHOOK_SECRET"),

  /** Account di servizio Google (Google Cloud → IAM → Account di servizio → chiave JSON) */
  googleClientEmail: env("GOOGLE_CLIENT_EMAIL"),
  /** Chiave privata dell'account di servizio; i "\n" scritti come testo vengono convertiti in a capo */
  googlePrivateKey: env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  /** Calendario in cui vengono scritte le prenotazioni */
  calendarId: env("GOOGLE_CALENDAR_ID") || studio.email,
  /** Calendari che rendono "occupato" uno slot (separati da virgola). Di default solo quello delle prenotazioni. */
  busyCalendarIds: (env("GOOGLE_BUSY_CALENDAR_IDS") || env("GOOGLE_CALENDAR_ID") || studio.email)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  /** Email (Gmail con "password per le app") usata per inviare le notifiche */
  smtpUser: env("SMTP_USER"),
  smtpPass: env("SMTP_PASS"),
  /** Dove arrivano le notifiche dei nuovi acquisti (separati da virgola) */
  notifyEmails: (env("NOTIFY_EMAILS") || studio.email)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export const calendarConfigured = Boolean(serverConfig.googleClientEmail && serverConfig.googlePrivateKey);
export const stripeConfigured = Boolean(serverConfig.stripeSecretKey);
export const mailConfigured = Boolean(serverConfig.smtpUser && serverConfig.smtpPass);
