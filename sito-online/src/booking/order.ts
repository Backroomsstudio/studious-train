/**
 * L'ordine e la sua rappresentazione nel calendario (titolo, colore, promemoria, descrizione).
 * Modulo puro: testabile senza Google né Stripe.
 */
import { getPass, getService, PASS_UNIT_LABELS, type BookableService, type Pass, type PassId, type PassUnit, type ServiceId } from "./catalog.ts";
import { formatEuro, formatDuration, unitLabel } from "./pricing.ts";
import { TIME_ZONE } from "./slots.ts";

export type PaymentMethod = "online" | "contanti";
export type OrderStatus = "in-attesa" | "pagato" | "da-saldare";

export interface Order {
  serviceId: ServiceId;
  units: number;
  /** Inizio in ISO UTC (solo servizi in studio) */
  start?: string;
  end?: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  payment: PaymentMethod;
  /** true = abbonamento mensile (oggi solo tramite Pass) */
  monthly: boolean;
  /** Pass attivato al checkout: l'acquisto diventa la prima sessione del Pass */
  passId?: PassId;
  totalCents: number;
  fullCents: number;
}

/** Colori standard di Google Calendar */
export const CALENDAR_COLORS = {
  "in-attesa": "8", // Grafite: slot tenuto mentre il cliente paga
  pagato: "10", // Basilico (verde)
  "da-saldare": "11", // Pomodoro (rosso): si paga in contanti
} as const satisfies Record<OrderStatus, string>;

const STATUS_PREFIX: Record<OrderStatus, string> = {
  "in-attesa": "⏳ IN ATTESA DI PAGAMENTO",
  pagato: "✅ PAGATO",
  "da-saldare": "💵 DA SALDARE",
};

export function orderTitle(order: Order, status: OrderStatus): string {
  const service = getService(order.serviceId)!;
  const pass = order.passId ? getPass(order.passId) : undefined;
  return `${STATUS_PREFIX[status]} · ${service.title}${pass ? ` (${pass.title})` : ""} · ${order.name}`;
}

export function orderDescription(order: Order, status: OrderStatus, extra: string[] = []): string {
  const service = getService(order.serviceId)!;
  const lines = [
    status === "da-saldare" ? `⚠️ DA SALDARE IN CONTANTI: ${formatEuro(order.totalCents)}` : null,
    status === "pagato" ? `Pagato online: ${formatEuro(order.totalCents)}${order.monthly ? " (rinnovo mensile attivo)" : ""}` : null,
    order.passId ? `${getPass(order.passId)?.title ?? "Pass"}: ${passContents(getPass(order.passId)!)} al mese. Questa sessione è la prima del Pass.` : null,
    status === "in-attesa" ? "Il cliente sta pagando online: se non completa entro 30 minuti lo slot si libera da solo." : null,
    "",
    `Servizio: ${service.title}`,
    `Quantità: ${unitLabel(service, order.units)}`,
    order.fullCents !== order.totalCents ? `Prezzo pieno: ${formatEuro(order.fullCents)} · Totale: ${formatEuro(order.totalCents)}` : `Totale: ${formatEuro(order.totalCents)}`,
    "",
    `Cliente: ${order.name}`,
    `Email: ${order.email}`,
    order.phone ? `Telefono: ${order.phone}` : null,
    order.notes ? `Note: ${order.notes}` : null,
    ...(extra.length ? ["", ...extra] : []),
    "",
    "Prenotato dal sito backroomsstudio.it",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/** Evento di calendario per un ordine in studio. */
export function orderEvent(order: Order, status: OrderStatus, extra: string[] = []) {
  if (!order.start || !order.end) throw new Error("Ordine senza orario");
  return {
    summary: orderTitle(order, status),
    description: orderDescription(order, status, extra),
    colorId: CALENDAR_COLORS[status],
    start: { dateTime: order.start, timeZone: TIME_ZONE },
    end: { dateTime: order.end, timeZone: TIME_ZONE },
    // Contanti: notifica 30 minuti prima per ricordarsi di incassare.
    reminders:
      status === "da-saldare"
        ? { useDefault: false, overrides: [{ method: "popup" as const, minutes: 30 }] }
        : { useDefault: true },
    extendedProperties: { private: { stato: status, ordine: serializeOrder(order) } },
  };
}

/** L'ordine viaggia compresso nei metadati di Stripe e del calendario (limite Stripe: 500 caratteri per valore). */
export function serializeOrder(order: Order): string {
  const compact = {
    s: order.serviceId,
    u: order.units,
    a: order.start ?? "",
    b: order.end ?? "",
    n: order.name.slice(0, 80),
    e: order.email.slice(0, 120),
    p: order.phone.slice(0, 30),
    m: order.monthly ? 1 : 0,
    k: order.passId ?? "",
    t: order.totalCents,
    f: order.fullCents,
    y: order.payment === "contanti" ? "c" : "o",
  };
  return JSON.stringify(compact);
}

export function deserializeOrder(raw: string, notes = ""): Order | null {
  try {
    const c = JSON.parse(raw);
    if (!getService(c.s)) return null;
    return {
      serviceId: c.s,
      units: Number(c.u),
      start: c.a || undefined,
      end: c.b || undefined,
      name: String(c.n),
      email: String(c.e),
      phone: String(c.p ?? ""),
      notes,
      payment: c.y === "c" ? "contanti" : "online",
      monthly: c.m === 1,
      ...(c.k && getPass(c.k) ? { passId: c.k as PassId } : {}),
      totalCents: Number(c.t),
      fullCents: Number(c.f),
    };
  } catch {
    return null;
  }
}

export function describeOrderForHumans(order: Order, service: BookableService = getService(order.serviceId)!): string[] {
  const when = order.start
    ? new Date(order.start).toLocaleString("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;
  return [
    order.passId ? `${getPass(order.passId)!.title}: ${passContents(getPass(order.passId)!)} ogni mese` : null,
    `${service.title} — ${unitLabel(service, order.units)}${order.passId ? " (prima sessione del Pass)" : ""}`,
    when ? `Quando: ${when}${service.showDuration && order.end ? ` (${formatDuration((Date.parse(order.end) - Date.parse(order.start!)) / 60000)})` : ""}` : "A distanza: ti scriviamo noi per i dettagli e il materiale.",
    `Totale: ${formatEuro(order.totalCents)}${order.monthly ? " al mese" : ""}`,
    order.payment === "contanti" ? "Pagamento: in contanti in studio, il giorno della sessione." : "Pagamento: online.",
  ].filter((l): l is string => l !== null);
}

export function passContents(pass: Pass): string {
  return (Object.keys(pass.includes) as PassUnit[])
    .map((k) => `${pass.includes[k]} ${pass.includes[k] === 1 ? PASS_UNIT_LABELS[k].one : PASS_UNIT_LABELS[k].many}`)
    .join(", ");
}
