import type Stripe from "stripe";
import { createHash } from "node:crypto";
import {
  CANCELLATION_HOURS,
  CANCELLATION_POLICY,
  getPackage,
  getPass,
  getService,
  maxUnitsFor,
  normalizeLines,
  passCheckoutCents,
  passCovers,
  planBlocks,
  type CartLine,
} from "./catalog.ts";
import { cartQuote, unitLabel } from "./pricing.ts";
import { DEFAULT_RULES, fitsAt, TIME_ZONE, type Interval } from "./slots.ts";
import { busyIntervals, deleteEvent, eventsBetween, eventsWithPrivate, getEvent, insertEvent, patchEvent, CalendarError, type CalendarEvent } from "./google-calendar.ts";
import { deserializeOrder, orderEvent, orderRecap, passContents, serializeOrder, type Appointment, type Order, type OrderRecap } from "./order.ts";
import { stripe } from "./stripe.ts";
import { confirmToCustomer, notifyRenewal, notifyStudio } from "./mail.ts";
import { notifyTelegram } from "./telegram.ts";

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

/** Righe del carrello dal browser: { righe: [{servizio, quantita}] } oppure il vecchio { servizio, quantita }. */
function readLines(body: Record<string, unknown>): CartLine[] {
  const raw = Array.isArray(body.righe) ? body.righe : body.servizio ? [{ servizio: body.servizio, quantita: body.quantita }] : [];
  const lines: CartLine[] = [];
  for (const r of raw.slice(0, 10)) {
    const row = (r ?? {}) as Record<string, unknown>;
    const service = getService(str(row.servizio, 40));
    if (!service) throw new BookingError("Servizio non valido");
    const units = Number(row.quantita);
    if (!Number.isInteger(units) || units < 1 || units > maxUnitsFor(service)) throw new BookingError("Quantità non valida");
    lines.push({ serviceId: service.id, units });
  }
  return lines;
}

/** Valida i dati inviati dal browser e ricalcola il prezzo dal listino. */
export function parseOrder(body: Record<string, unknown>): Order {
  if (str(body.sito, 100)) throw new BookingError("Richiesta non valida"); // campo trappola anti-bot

  // Pacchetto pronto: le righe arrivano dal listino, non dal browser.
  const rawPackage = str(body.pacchetto, 20);
  const pkg = rawPackage ? getPackage(rawPackage) : undefined;
  if (rawPackage && !pkg) throw new BookingError("Pacchetto non valido");
  const lines = normalizeLines(pkg ? pkg.lines : readLines(body));
  if (!lines.length) throw new BookingError("Scegli almeno un servizio");
  for (const l of lines) if (l.units > maxUnitsFor(getService(l.serviceId)!)) throw new BookingError("Quantità non valida");
  const services = lines.map((l) => getService(l.serviceId)!);
  if (services.some((s) => s.standalone) && lines.length > 1) throw new BookingError("La sessione di prova si prenota da sola");

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
  if (pass && (pkg || !passCovers(pass, lines))) throw new BookingError("Questo Pass non include l'acquisto scelto");
  const monthly = Boolean(pass);

  // Servizi solo in presenza (sessione di prova): si paga sempre in studio.
  const payment = services.some((s) => s.onlineAllowed === false) ? "contanti" : pass ? "online" : body.pagamento === "contanti" ? "contanti" : "online";
  if (payment === "contanti" && services.some((s) => !s.cashAllowed)) {
    throw new BookingError("Nel carrello ci sono servizi a distanza: si pagano online");
  }
  if (payment === "contanti" && phone.replace(/\D/g, "").length < 6) throw new BookingError("Per pagare in studio serve un numero di telefono");

  // Appuntamenti in studio: il browser manda un inizio per ognuno, nello stesso ordine del piano.
  const blocks = planBlocks(lines);
  const starts: unknown[] = Array.isArray(body.inizi) ? body.inizi : body.inizio ? [body.inizio] : [];
  if (starts.length !== blocks.length) throw new BookingError(blocks.length === 1 ? "Scegli data e ora della sessione" : "Scegli data e ora di ogni appuntamento");
  const appointments: Appointment[] = blocks.map((b, i) => {
    const d = new Date(str(starts[i], 40));
    if (Number.isNaN(d.getTime())) throw new BookingError("Scegli data e ora di ogni appuntamento");
    return { serviceId: b.serviceId, units: b.units, start: d.toISOString(), end: new Date(d.getTime() + b.minutes * 60000).toISOString() };
  });

  // Pagamento online con appuntamenti in studio: serve l'accettazione della regola di cancellazione.
  const policyRequired = payment === "online" && appointments.length > 0;
  if (policyRequired && body.policy !== true) {
    throw new BookingError(`Per pagare online accetta le condizioni di cancellazione (avviso entro ${CANCELLATION_HOURS} ore)`);
  }

  const base = { lines, appointments, name, email, phone, notes, payment: payment as Order["payment"], monthly, ...(policyRequired ? { policy: true } : {}) };
  if (pass) return { ...base, passId: pass.id, totalCents: passCheckoutCents(pass), fullCents: pass.monthlyCents };
  const q = cartQuote(lines, pkg?.id);
  return { ...base, ...(pkg ? { packageId: pkg.id } : {}), totalCents: q.totalCents, fullCents: q.fullCents };
}

/** Tutti gli appuntamenti sono ancora liberi (e non si accavallano tra loro)? */
async function assertSlotsFree(order: Order) {
  if (!order.appointments.length) return;
  const startsMs = order.appointments.map((a) => Date.parse(a.start));
  const endsMs = order.appointments.map((a) => Date.parse(a.end));
  const busy: Interval[] = await busyIntervals(new Date(Math.min(...startsMs) - 24 * 3600_000), new Date(Math.max(...endsMs) + 24 * 3600_000));
  const now = new Date();
  for (const a of order.appointments) {
    if (!fitsAt(a.start, (Date.parse(a.end) - Date.parse(a.start)) / 60000, busy, now, DEFAULT_RULES)) {
      throw new BookingError(
        order.appointments.length > 1
          ? `L'orario scelto per ${getService(a.serviceId)!.short.toLowerCase()} non è più disponibile: scegline un altro.`
          : "Questo orario non è più disponibile: scegline un altro.",
        409,
      );
    }
    busy.push({ start: a.start, end: a.end });
  }
}

/**
 * Dopo aver scritto gli eventi, controlla che nessun altro abbia preso gli stessi orari nello stesso istante.
 * In caso di pareggio vince l'evento creato per primo; i nostri vengono cancellati.
 */
async function assertNoRace(created: CalendarEvent[]) {
  const ours = new Set(created.map((e) => e.id));
  for (const ev of created) {
    const others = await eventsBetween(new Date(ev.start.dateTime), new Date(ev.end.dateTime));
    const lost = others.some(
      (e) =>
        !ours.has(e.id) &&
        (Date.parse(e.created ?? "") < Date.parse(ev.created ?? "") || (e.created === ev.created && (e.id ?? "") < (ev.id ?? ""))),
    );
    if (lost) {
      await Promise.all(created.map((e) => deleteEvent(e.id!)));
      throw new BookingError("Qualcuno ha appena prenotato uno di questi orari: scegline un altro.", 409);
    }
  }
}

/** Impronte (non reversibili) di email e telefono, per riconoscere chi ha già fatto la prova. */
export function customerKeys(order: Pick<Order, "email" | "phone">): { prova_email: string; prova_tel: string } {
  const digits = order.phone.replace(/\D/g, "").replace(/^(00)?39(?=\d{9,10}$)/, "");
  const hash = (v: string) => createHash("sha256").update(`backrooms:${v}`).digest("hex").slice(0, 32);
  return { prova_email: hash(order.email.trim().toLowerCase()), prova_tel: hash(digits) };
}

/** La sessione di prova si fa una volta sola: se email o telefono l'hanno già prenotata, si blocca. */
async function assertFirstTime(order: Order) {
  const keys = customerKeys(order);
  const [byEmail, byPhone] = await Promise.all([eventsWithPrivate("prova_email", keys.prova_email), eventsWithPrivate("prova_tel", keys.prova_tel)]);
  if (byEmail.length || byPhone.length) {
    throw new BookingError("Hai già usato la sessione di prova: scegli una sessione di registrazione normale.", 409);
  }
}

export interface BookingResult {
  /** Pagina su cui mandare il cliente: Stripe Checkout o la conferma */
  redirectUrl: string;
  /** Contanti: riepilogo per il pop-up di conferma (il posto è già riservato) */
  recap?: OrderRecap;
}

const onceOnly = (order: Order) => order.lines.some((l) => getService(l.serviceId)?.oncePerCustomer);

export async function createBooking(order: Order, origin: string): Promise<BookingResult> {
  const holds: CalendarEvent[] = [];
  if (onceOnly(order)) await assertFirstTime(order);

  if (order.appointments.length) {
    await assertSlotsFree(order);
    const status = order.payment === "contanti" ? "da-saldare" : "in-attesa";
    try {
      for (let i = 0; i < order.appointments.length; i++) {
        const event = orderEvent(order, i, status);
        if (onceOnly(order)) Object.assign(event.extendedProperties.private, customerKeys(order));
        holds.push(await insertEvent(event));
      }
    } catch (e) {
      await Promise.all(holds.map((h) => deleteEvent(h.id!).catch(() => undefined)));
      throw e;
    }
    await assertNoRace(holds);
  }

  if (order.payment === "contanti") {
    // Contanti: gli appuntamenti sono subito confermati, in rosso e con promemoria 30 minuti prima.
    const headline = "Nuova prenotazione · DA SALDARE IN CONTANTI";
    await Promise.all([notifyStudio(order, headline), confirmToCustomer(order, false), notifyTelegram(order, headline)]);
    return { redirectUrl: `${origin}/prenota/confermata/?stato=contanti`, recap: orderRecap(order, "da-saldare") };
  }

  try {
    const ids = holds.map((h) => h.id!);
    const session = await createCheckoutSession(order, origin, ids);
    await Promise.all(holds.map((h) => patchEvent(h.id!, { extendedProperties: { private: { ...h.extendedProperties?.private, sessione: session.id } } })));
    if (!session.url) throw new Error("Stripe non ha restituito l'indirizzo di pagamento");
    return { redirectUrl: session.url };
  } catch (e) {
    await Promise.all(holds.map((h) => deleteEvent(h.id!).catch(() => undefined)));
    throw e;
  }
}

function productName(order: Order): string {
  const pkg = order.packageId ? getPackage(order.packageId) : undefined;
  if (pkg) return `${pkg.title} — Backrooms Studio`;
  if (order.lines.length === 1) {
    const s = getService(order.lines[0].serviceId)!;
    return `${s.title} — ${unitLabel(s, order.lines[0].units)}`;
  }
  return "Prenotazione Backrooms Studio";
}

function productDescription(order: Order): string {
  const what = order.lines.map((l) => `${getService(l.serviceId)!.short}: ${unitLabel(getService(l.serviceId)!, l.units)}`).join(" · ");
  const when = order.appointments
    .map((a) => new Date(a.start).toLocaleString("it-IT", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))
    .join(", ");
  return (when ? `${what}. In studio: ${when}` : `${what}. A distanza`).slice(0, 480);
}

async function createCheckoutSession(order: Order, origin: string, eventIds: string[]) {
  const pass = order.passId ? getPass(order.passId) : undefined;
  const metadata: Record<string, string> = { ordine: serializeOrder(order), note: order.notes, eventi: eventIds.join(",") };
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
            ? { name: `${pass.title} — Backrooms Studio`, description: `${passContents(pass)} ogni mese. Primo acquisto: ${productDescription(order)}`.slice(0, 480) }
            : { name: productName(order), description: productDescription(order) },
          ...(order.monthly ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    metadata,
    success_url: `${origin}/prenota/confermata/?stato=pagato&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: eventIds.length ? `${origin}/api/prenota/annulla?eventi=${encodeURIComponent(eventIds.join(","))}` : `${origin}/prenota/?annullato=1`,
    ...(order.policy ? { custom_text: { submit: { message: CANCELLATION_POLICY } } } : {}),
    // Gli orari restano bloccati al massimo ~30 minuti (minimo consentito da Stripe).
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  };
  if (order.monthly) params.subscription_data = { metadata, description: `${pass?.title ?? productName(order)} — rinnovo mensile` };
  else params.payment_intent_data = { metadata, description: productName(order) };

  return stripe().checkout.sessions.create(params);
}

/** Id degli eventi dai metadati (nuovo formato "eventi", vecchio "evento"). */
export function eventIdsFrom(meta: Record<string, string | undefined> | null | undefined): string[] {
  const raw = meta?.eventi ?? meta?.evento ?? "";
  return raw.split(",").map((s) => s.trim()).filter((s) => /^[a-v0-9]{5,1024}$/.test(s));
}

/** Il cliente ha annullato su Stripe: si chiude la sessione e si liberano subito gli orari. */
export async function cancelHold(eventIds: string[]) {
  const sessions = new Set<string>();
  for (const id of eventIds) {
    let event: CalendarEvent;
    try {
      event = await getEvent(id);
    } catch (e) {
      if (e instanceof CalendarError && (e.status === 404 || e.status === 410)) continue;
      throw e;
    }
    const props = event.extendedProperties?.private ?? {};
    if (props.stato !== "in-attesa") continue; // mai cancellare una prenotazione pagata o in contanti
    if (props.sessione) sessions.add(props.sessione);
    await deleteEvent(id);
  }
  for (const s of sessions) await stripe().checkout.sessions.expire(s).catch(() => undefined);
}

/** Riepilogo per la pagina di ritorno da Stripe: legge la sessione e dice se il pagamento è andato a buon fine. */
export async function recapForSession(sessionId: string): Promise<OrderRecap | null> {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  const order = orderFromMetadata(session.metadata);
  if (!order) return null;
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  return orderRecap(order, paid ? "pagato" : "in-attesa");
}

function orderFromMetadata(meta: Stripe.Metadata | null | undefined): Order | null {
  if (!meta?.ordine) return null;
  return deserializeOrder(meta.ordine, meta.note ?? "");
}

/** Pagamento riuscito: gli appuntamenti diventano verdi e partono le email. Idempotente (Stripe può ripetere i webhook). */
export async function confirmPaidSession(session: Stripe.Checkout.Session) {
  const order = orderFromMetadata(session.metadata);
  if (!order) throw new Error(`Sessione ${session.id} senza ordine nei metadati`);
  const ids = eventIdsFrom(session.metadata);
  const extra = [`Stripe: ${session.id}`];

  let alreadyDone = order.appointments.length > 0;
  for (let i = 0; i < order.appointments.length; i++) {
    const id = ids[i];
    let event: CalendarEvent | null = null;
    if (id) {
      try {
        event = await getEvent(id);
      } catch (e) {
        if (!(e instanceof CalendarError && (e.status === 404 || e.status === 410))) throw e;
      }
    }
    if (event && event.status !== "cancelled") {
      if (event.extendedProperties?.private?.stato === "pagato") continue; // già confermato
      alreadyDone = false;
      await patchEvent(id!, { ...orderEvent(order, i, "pagato", extra) });
    } else {
      // L'orario era scaduto prima del pagamento: si ricrea l'evento e si segnala di controllare.
      alreadyDone = false;
      await insertEvent(orderEvent(order, i, "pagato", [...extra, "⚠️ Pagato dopo la scadenza dello slot: controllare eventuali sovrapposizioni."]));
    }
  }
  if (alreadyDone) return;

  const headline = order.passId ? `Nuovo ${getPass(order.passId)?.title ?? "Pass"} attivato` : "Nuova prenotazione · PAGATA ONLINE";
  await Promise.all([notifyStudio(order, headline), confirmToCustomer(order, true), notifyTelegram(order, headline)]);
}

export async function releaseExpiredSession(session: Stripe.Checkout.Session) {
  const ids = eventIdsFrom(session.metadata);
  if (ids.length) await cancelHold(ids);
}

export async function handleRenewal(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle") return;
  const order = orderFromMetadata(invoice.parent?.subscription_details?.metadata);
  if (!order) return;
  await notifyRenewal(order, invoice.amount_paid);
}

