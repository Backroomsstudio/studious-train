import type Stripe from "stripe";
import { bookingMinutes, getPass, getService, maxUnitsFor, passCheckoutCents, passCovers } from "./catalog.ts";
import { quote, unitLabel } from "./pricing.ts";
import { DEFAULT_RULES, isBookable, TIME_ZONE } from "./slots.ts";
import { busyIntervals, deleteEvent, eventsBetween, getEvent, insertEvent, patchEvent, CalendarError, type CalendarEvent } from "./google-calendar.ts";
import { deserializeOrder, orderEvent, passContents, serializeOrder, type Order } from "./order.ts";
import { stripe } from "./stripe.ts";
import { confirmToCustomer, notifyRenewal, notifyStudio } from "./mail.ts";

export class BookingError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Valida i dati inviati dal browser e ricalcola il prezzo dal listino. */
export function parseOrder(body: Record<string, unknown>): Order {
  if (str(body.sito, 100)) throw new BookingError("Richiesta non valida"); // campo trappola anti-bot
  const service = getService(str(body.servizio, 40));
  if (!service) throw new BookingError("Servizio non valido");

  const units = Number(body.quantita);
  if (!Number.isInteger(units) || units < 1 || units > maxUnitsFor(service)) throw new BookingError("Quantità non valida");

  const name = str(body.nome, 80);
  const email = str(body.email, 120).toLowerCase();
  const phone = str(body.telefono, 30);
  const notes = str(body.note, 450);
  if (name.length < 2) throw new BookingError("Inserisci il tuo nome");
  if (!EMAIL_RE.test(email)) throw new BookingError("Email non valida");
  if (body.privacy !== true) throw new BookingError("Serve il consenso al trattamento dei dati");

  // Pass mensile scelto subito prima di pagare: si paga sempre online, ogni mese.
  const rawPass = str(body.pass, 20);
  const pass = rawPass ? getPass(rawPass) : undefined;
  if (rawPass && !pass) throw new BookingError("Pass non valido");
  if (pass && !passCovers(pass, service, units)) throw new BookingError("Questo Pass non include l'acquisto scelto");
  const monthly = Boolean(pass);
  const payment = pass ? "online" : body.pagamento === "contanti" ? "contanti" : "online";
  if (payment === "contanti" && !service.cashAllowed) throw new BookingError("Questo servizio si paga solo online");
  if (payment === "contanti" && phone.length < 6) throw new BookingError("Per pagare in contanti serve un numero di telefono");

  let start: string | undefined;
  let end: string | undefined;
  if (service.where === "studio") {
    const d = new Date(str(body.inizio, 40));
    if (Number.isNaN(d.getTime())) throw new BookingError("Scegli data e ora della sessione");
    start = d.toISOString();
    end = new Date(d.getTime() + bookingMinutes(service, units) * 60000).toISOString();
  }

  if (pass) {
    const totalCents = passCheckoutCents(pass);
    return { serviceId: service.id, units, start, end, name, email, phone, notes, payment, monthly, passId: pass.id, totalCents, fullCents: pass.monthlyCents };
  }
  const q = quote(service, units);
  return { serviceId: service.id, units, start, end, name, email, phone, notes, payment, monthly, totalCents: q.totalCents, fullCents: q.fullCents };
}

/** Lo slot è ancora libero su tutti i calendari? */
async function assertSlotFree(order: Order) {
  const service = getService(order.serviceId)!;
  const start = new Date(order.start!);
  const minutes = bookingMinutes(service, order.units);
  const busy = await busyIntervals(new Date(start.getTime() - 24 * 3600_000), new Date(start.getTime() + 24 * 3600_000));
  if (!isBookable(order.start!, minutes, busy, new Date(), DEFAULT_RULES)) {
    throw new BookingError("Questo orario non è più disponibile: scegline un altro.", 409);
  }
}

/**
 * Dopo aver scritto l'evento, controlla che nessun altro abbia preso lo stesso orario nello stesso istante.
 * In caso di pareggio vince l'evento creato per primo; l'altro viene cancellato.
 */
async function assertNoRace(created: CalendarEvent, order: Order) {
  const others = await eventsBetween(new Date(order.start!), new Date(order.end!));
  const lost = others.some(
    (e) =>
      e.id !== created.id &&
      (Date.parse(e.created ?? "") < Date.parse(created.created ?? "") || (e.created === created.created && (e.id ?? "") < (created.id ?? ""))),
  );
  if (lost) {
    await deleteEvent(created.id!);
    throw new BookingError("Qualcuno ha appena prenotato questo orario: scegline un altro.", 409);
  }
}

export interface BookingResult {
  /** Pagina su cui mandare il cliente: Stripe Checkout o la conferma */
  redirectUrl: string;
}

export async function createBooking(order: Order, origin: string): Promise<BookingResult> {
  const service = getService(order.serviceId)!;
  let hold: CalendarEvent | null = null;

  if (service.where === "studio") {
    await assertSlotFree(order);
    hold = await insertEvent(orderEvent(order, order.payment === "contanti" ? "da-saldare" : "in-attesa"));
    await assertNoRace(hold, order);
  }

  if (order.payment === "contanti") {
    // Contanti: la sessione è subito confermata, in rosso e con promemoria 30 minuti prima.
    await Promise.all([notifyStudio(order, "Nuova prenotazione · DA SALDARE IN CONTANTI"), confirmToCustomer(order, false)]);
    return { redirectUrl: `${origin}/prenota/confermata/?stato=contanti` };
  }

  try {
    const session = await createCheckoutSession(order, origin, hold?.id);
    if (hold?.id) {
      await patchEvent(hold.id, { extendedProperties: { private: { ...hold.extendedProperties?.private, sessione: session.id } } });
    }
    if (!session.url) throw new Error("Stripe non ha restituito l'indirizzo di pagamento");
    return { redirectUrl: session.url };
  } catch (e) {
    if (hold?.id) await deleteEvent(hold.id).catch(() => undefined);
    throw e;
  }
}

async function createCheckoutSession(order: Order, origin: string, eventId?: string) {
  const service = getService(order.serviceId)!;
  const pass = order.passId ? getPass(order.passId) : undefined;
  const metadata: Record<string, string> = { ordine: serializeOrder(order), note: order.notes, evento: eventId ?? "" };
  const when = order.start
    ? new Date(order.start).toLocaleString("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "A distanza";

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: order.monthly ? "subscription" : "payment",
    locale: "it",
    customer_email: order.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: order.totalCents,
          product_data: pass
            ? { name: `${pass.title} — Backrooms Studio`, description: `${passContents(pass)} ogni mese. Prima sessione: ${service.title}, ${when}` }
            : { name: `${service.title} — ${unitLabel(service, order.units)}`, description: when },
          ...(order.monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    metadata,
    success_url: `${origin}/prenota/confermata/?stato=pagato&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: eventId ? `${origin}/api/prenota/annulla?evento=${encodeURIComponent(eventId)}` : `${origin}/prenota/?annullato=1`,
    // Lo slot resta bloccato al massimo ~30 minuti (minimo consentito da Stripe).
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  };
  if (order.monthly) params.subscription_data = { metadata, description: `${pass?.title ?? service.title} — rinnovo mensile` };
  else params.payment_intent_data = { metadata, description: `${service.title} — ${unitLabel(service, order.units)}` };

  return stripe().checkout.sessions.create(params);
}

/** Il cliente ha annullato su Stripe: si chiude la sessione e si libera subito lo slot. */
export async function cancelHold(eventId: string) {
  let event: CalendarEvent;
  try {
    event = await getEvent(eventId);
  } catch (e) {
    if (e instanceof CalendarError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
  const props = event.extendedProperties?.private ?? {};
  if (props.stato !== "in-attesa") return; // mai cancellare una prenotazione pagata o in contanti
  if (props.sessione) await stripe().checkout.sessions.expire(props.sessione).catch(() => undefined);
  await deleteEvent(eventId);
}

function orderFromMetadata(meta: Stripe.Metadata | null | undefined): Order | null {
  if (!meta?.ordine) return null;
  return deserializeOrder(meta.ordine, meta.note ?? "");
}

/** Pagamento riuscito: lo slot diventa verde e partono le email. Idempotente (Stripe può ripetere i webhook). */
export async function confirmPaidSession(session: Stripe.Checkout.Session) {
  const order = orderFromMetadata(session.metadata);
  if (!order) throw new Error(`Sessione ${session.id} senza ordine nei metadati`);
  const eventId = session.metadata?.evento;
  const extra = [`Stripe: ${session.id}`];

  if (eventId) {
    let event: CalendarEvent | null = null;
    try {
      event = await getEvent(eventId);
    } catch (e) {
      if (!(e instanceof CalendarError && (e.status === 404 || e.status === 410))) throw e;
    }
    if (event && event.status !== "cancelled") {
      if (event.extendedProperties?.private?.stato === "pagato") return; // già confermato
      await patchEvent(eventId, { ...orderEvent(order, "pagato", extra) });
    } else {
      // Lo slot era scaduto prima del pagamento: si ricrea l'evento e si segnala di controllare.
      await insertEvent(orderEvent(order, "pagato", [...extra, "⚠️ Pagato dopo la scadenza dello slot: controllare eventuali sovrapposizioni."]));
    }
  }

  await Promise.all([notifyStudio(order, order.passId ? `Nuovo ${getPass(order.passId)?.title ?? "Pass"} attivato` : "Nuovo acquisto pagato online"), confirmToCustomer(order, true)]);
}

export async function releaseExpiredSession(session: Stripe.Checkout.Session) {
  const eventId = session.metadata?.evento;
  if (eventId) await cancelHold(eventId);
}

export async function handleRenewal(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle") return;
  const order = orderFromMetadata(invoice.parent?.subscription_details?.metadata);
  if (!order) return;
  await notifyRenewal(order, invoice.amount_paid);
}
