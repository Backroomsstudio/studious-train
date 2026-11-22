import nodemailer from "nodemailer";
import { studio } from "./studio.ts";
import { mailConfigured, serverConfig } from "./server-config.ts";
import { getPass } from "./catalog.ts";
import { describeOrderForHumans, passContents, type Order } from "./order.ts";

/**
 * Email di notifica tramite Gmail (SMTP con "password per le app").
 * Se le credenziali mancano le email vengono saltate: la prenotazione resta comunque nel calendario.
 */

function transport() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: serverConfig.smtpUser, pass: serverConfig.smtpPass },
  });
}

async function send(to: string | string[], subject: string, text: string, replyTo?: string) {
  if (!mailConfigured) {
    console.warn(`[mail] SMTP non configurato, email non inviata: ${subject}`);
    return;
  }
  try {
    await transport().sendMail({ from: `"${studio.name}" <${serverConfig.smtpUser}>`, to, subject, text, replyTo });
  } catch (e) {
    // Una email non partita non deve far fallire la prenotazione.
    console.error("[mail] invio fallito", e);
  }
}

export async function notifyStudio(order: Order, headline: string) {
  const lines = [
    headline,
    "",
    ...describeOrderForHumans(order),
    "",
    `Cliente: ${order.name}`,
    `Email: ${order.email}`,
    order.phone ? `Telefono: ${order.phone}` : null,
    order.notes ? `Note: ${order.notes}` : null,
  ].filter((l): l is string => l !== null);
  await send(serverConfig.notifyEmails, `${headline} · ${order.name}`, lines.join("\n"), order.email);
}

export async function confirmToCustomer(order: Order, paid: boolean) {
  const lines = [
    `Ciao ${order.name},`,
    "",
    paid ? "il pagamento è andato a buon fine: la tua prenotazione è confermata." : "la tua prenotazione è confermata.",
    "",
    ...describeOrderForHumans(order),
    "",
    `Ci trovi in ${studio.address.street}, ${studio.address.postalCode} ${studio.address.city} (${studio.address.province}).`,
    `Per qualsiasi cosa scrivici su WhatsApp al ${studio.phone} o rispondi a questa email.`,
    "",
    studio.name,
    `${studio.payee.name} · P.IVA ${studio.payee.vatId}`,
  ];
  await send(order.email, `Prenotazione confermata · ${studio.name}`, lines.join("\n"), studio.email);
}

export async function notifyRenewal(order: Order, amountCents: number) {
  const euro = (amountCents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const pass = order.passId ? getPass(order.passId) : undefined;
  await send(
    serverConfig.notifyEmails,
    `Rinnovo ${pass?.title ?? "mensile"} pagato · ${order.name}`,
    [
      `Rinnovo mensile incassato: ${euro}.`,
      "",
      pass ? `${pass.title}: questo mese il cliente ha di nuovo ${passContents(pass)}.` : describeOrderForHumans({ ...order, start: undefined, end: undefined }).join("\n"),
      "",
      `Contattalo per fissare le sessioni del mese.`,
      `Email: ${order.email}${order.phone ? ` · Telefono: ${order.phone}` : ""}`,
    ].join("\n"),
    order.email,
  );
}
