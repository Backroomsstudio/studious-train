/**
 * L'ordine (un carrello con uno o più servizi) e la sua rappresentazione nel calendario:
 * un evento per ogni appuntamento in studio, con titolo, colore, promemoria e descrizione.
 * Modulo puro: testabile senza Google né Stripe.
 */
import {
  bookingMinutes,
  CANCELLATION_HOURS,
  getPackage,
  getPass,
  getService,
  PASS_UNIT_LABELS,
  type CartLine,
  type PackageId,
  type Pass,
  type PassId,
  type PassUnit,
  type ServiceId,
} from "./catalog.ts";
import { formatDuration, formatEuro, unitLabel } from "./pricing.ts";
import { TIME_ZONE } from "./slots.ts";

export type PaymentMethod = "online" | "contanti";
export type OrderStatus = "in-attesa" | "pagato" | "da-saldare";

/** Un appuntamento in studio con il suo orario. */
export interface Appointment {
  serviceId: ServiceId;
  units: number;
  /** Inizio e fine in ISO UTC */
  start: string;
  end: string;
}

export interface Order {
  /** Pacchetto pronto scelto (prezzo fisso), se c'è */
  packageId?: PackageId;
  /** Cosa compra: servizi e quantità */
  lines: CartLine[];
  /** Appuntamenti in studio, in ordine di lavoro (beat, registrazione, mix) */
  appointments: Appointment[];
  name: string;
  email: string;
  phone: string;
  notes: string;
  payment: PaymentMethod;
  /** true = abbonamento mensile (oggi solo tramite Pass) */
  monthly: boolean;
  /** Pass attivato al checkout: l'acquisto diventa il primo del Pass */
  passId?: PassId;
  /** Il cliente ha accettato la regola di cancellazione (pagamenti online con appuntamenti in studio) */
  policy?: boolean;
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

function lineText(l: { serviceId: ServiceId; units: number }): string {
  const s = getService(l.serviceId)!;
  return `${s.short} — ${unitLabel(s, l.units)}`;
}

function whenText(a: Appointment): string {
  const s = getService(a.serviceId)!;
  const day = new Date(a.start).toLocaleString("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
  const from = new Date(a.start).toLocaleTimeString("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const to = new Date(a.end).toLocaleTimeString("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return s.showDuration ? `${day}, ${from}–${to} (${formatDuration((Date.parse(a.end) - Date.parse(a.start)) / 60000)})` : `${day}, dalle ${from}`;
}

/** Nome del pacchetto o del Pass, se c'è. */
function offerName(order: Order): string | null {
  if (order.passId) return getPass(order.passId)?.title ?? "Pass";
  if (order.packageId) return getPackage(order.packageId)?.title ?? null;
  return null;
}

/** Righe da fare a distanza (beat o mix senza appuntamento). */
function remoteLines(order: Order): CartLine[] {
  return order.lines.filter((l) => getService(l.serviceId)?.where === "remoto");
}

export function orderTitle(order: Order, index: number, status: OrderStatus): string {
  const a = order.appointments[index];
  const s = getService(a.serviceId)!;
  const same = order.appointments.filter((x) => x.serviceId === a.serviceId);
  const part = same.length > 1 ? ` (${same.indexOf(a) + 1}/${same.length})` : "";
  const offer = offerName(order);
  return `${STATUS_PREFIX[status]} · ${s.short} ${unitLabel(s, a.units)}${part}${offer ? ` · ${offer}` : ""} · ${order.name}`;
}

export function orderDescription(order: Order, index: number, status: OrderStatus, extra: string[] = []): string {
  const a = order.appointments[index];
  const first = index === 0;
  const offer = offerName(order);
  const others = order.appointments.filter((_, i) => i !== index);
  const remote = remoteLines(order);
  const lines = [
    status === "da-saldare"
      ? first
        ? `⚠️ DA SALDARE IN CONTANTI: ${formatEuro(order.totalCents)}${order.appointments.length > 1 ? " (tutto l'ordine, a questo primo appuntamento)" : ""}`
        : `Contanti: tutto l'ordine (${formatEuro(order.totalCents)}) si salda al primo appuntamento.`
      : null,
    status === "pagato" ? `Pagato online: ${formatEuro(order.totalCents)}${order.monthly ? " (rinnovo mensile attivo)" : ""}${order.appointments.length > 1 ? " · tutto l'ordine" : ""}` : null,
    order.passId ? `${offer}: ${passContents(getPass(order.passId)!)} al mese. Questo acquisto è il primo del Pass.` : null,
    status === "in-attesa" ? "Il cliente sta pagando online: se non completa entro 30 minuti lo slot si libera da solo." : null,
    "",
    `Questo appuntamento: ${lineText(a)}`,
    others.length ? `Altri appuntamenti dello stesso ordine:\n${others.map((o) => `• ${lineText(o)}: ${whenText(o)}`).join("\n")}` : null,
    remote.length ? `Da fare a distanza (senza l'artista):\n${remote.map((r) => `• ${lineText(r)}`).join("\n")}` : null,
    "",
    offer && order.packageId ? `Pacchetto: ${offer}` : null,
    order.fullCents !== order.totalCents ? `Prezzo pieno: ${formatEuro(order.fullCents)} · Totale ordine: ${formatEuro(order.totalCents)}` : `Totale ordine: ${formatEuro(order.totalCents)}`,
    "",
    `Cliente: ${order.name}`,
    `Email: ${order.email}`,
    order.phone ? `Telefono: ${order.phone}` : null,
    order.notes ? `Note: ${order.notes}` : null,
    order.policy ? `Ha accettato la regola di cancellazione: avviso entro ${CANCELLATION_HOURS} ore, altrimenti non rimborsabile.` : null,
    ...(extra.length ? ["", ...extra] : []),
    "",
    "Prenotato dal sito backroomsstudio.it",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/** Evento di calendario per l'appuntamento numero `index` dell'ordine. */
export function orderEvent(order: Order, index: number, status: OrderStatus, extra: string[] = []) {
  const a = order.appointments[index];
  if (!a) throw new Error("Ordine senza appuntamento");
  return {
    summary: orderTitle(order, index, status),
    description: orderDescription(order, index, status, extra),
    colorId: CALENDAR_COLORS[status],
    start: { dateTime: a.start, timeZone: TIME_ZONE },
    end: { dateTime: a.end, timeZone: TIME_ZONE },
    // Contanti: notifica 30 minuti prima per ricordarsi di incassare.
    reminders:
      status === "da-saldare"
        ? { useDefault: false, overrides: [{ method: "popup" as const, minutes: 30 }] }
        : { useDefault: true },
    extendedProperties: { private: { stato: status, ordine: serializeOrder(order), parte: `${index + 1}/${order.appointments.length}` } as Record<string, string> },
  };
}

/* ---------- l'ordine compresso nei metadati di Stripe (max 500 caratteri per valore) ---------- */

const CODES: Record<ServiceId, string> = {
  prova: "p",
  registrazione: "r",
  "beat-studio": "b",
  "beat-remoto": "B",
  "mix-studio": "m",
  "mix-remoto": "M",
  noleggio: "n",
};
const FROM_CODE = Object.fromEntries(Object.entries(CODES).map(([k, v]) => [v, k])) as Record<string, ServiceId>;

export function serializeOrder(order: Order): string {
  const compact = {
    v: 2,
    k: order.packageId ?? "",
    l: order.lines.map((l) => `${CODES[l.serviceId]}${l.units}`).join(","),
    // inizio in minuti dall'epoch, in base 36: la fine si ricalcola dal listino
    a: order.appointments.map((a) => `${CODES[a.serviceId]}${a.units}@${Math.round(Date.parse(a.start) / 60000).toString(36)}`).join(","),
    n: order.name.slice(0, 60),
    e: order.email.slice(0, 100),
    p: order.phone.slice(0, 24),
    m: order.monthly ? 1 : 0,
    ps: order.passId ?? "",
    pc: order.policy ? 1 : 0,
    t: order.totalCents,
    f: order.fullCents,
    y: order.payment === "contanti" ? "c" : "o",
  };
  return JSON.stringify(compact);
}

function parseUnits(token: string): { serviceId: ServiceId; units: number } | null {
  const m = /^([a-zA-Z])(\d{1,2})$/.exec(token);
  if (!m || !FROM_CODE[m[1]]) return null;
  return { serviceId: FROM_CODE[m[1]], units: Number(m[2]) };
}

export function deserializeOrder(raw: string, notes = ""): Order | null {
  try {
    const c = JSON.parse(raw);
    const common = {
      name: String(c.n),
      email: String(c.e),
      phone: String(c.p ?? ""),
      notes,
      payment: (c.y === "c" ? "contanti" : "online") as PaymentMethod,
      monthly: c.m === 1,
      ...(c.pc === 1 ? { policy: true } : {}),
      totalCents: Number(c.t),
      fullCents: Number(c.f),
    };
    if (c.v === 2) {
      const lines = String(c.l || "")
        .split(",")
        .filter(Boolean)
        .map(parseUnits);
      if (!lines.length || lines.some((l) => !l)) return null;
      const appointments: Appointment[] = [];
      for (const token of String(c.a || "").split(",").filter(Boolean)) {
        const [u, t] = token.split("@");
        const unit = parseUnits(u);
        if (!unit || !t) return null;
        const start = parseInt(t, 36) * 60000;
        appointments.push({ ...unit, start: new Date(start).toISOString(), end: new Date(start + bookingMinutes(getService(unit.serviceId)!, unit.units) * 60000).toISOString() });
      }
      return {
        ...(c.k && getPackage(c.k) ? { packageId: c.k as PackageId } : {}),
        lines: lines as CartLine[],
        appointments,
        ...common,
        ...(c.ps && getPass(c.ps) ? { passId: c.ps as PassId } : {}),
      };
    }
    // Formato precedente (un solo servizio): pagamenti avviati prima dell'aggiornamento del sito.
    if (!getService(c.s)) return null;
    const line = { serviceId: c.s as ServiceId, units: Number(c.u) };
    return {
      lines: [line],
      appointments: c.a && c.b ? [{ ...line, start: c.a, end: c.b }] : [],
      ...common,
      ...(c.k && getPass(c.k) ? { passId: c.k as PassId } : {}),
    };
  } catch {
    return null;
  }
}

/** Riepilogo dell'ordine per il pop-up di conferma: niente email né telefono del cliente. */
export interface OrderRecap {
  nome: string;
  titolo: string;
  stato: OrderStatus;
  righe: string[];
  appuntamenti: { titolo: string; quando: string; inizio: string; fine: string }[];
  aDistanza: string[];
  totale: string;
  mensile: boolean;
  pagamento: PaymentMethod;
  regola: boolean;
}

export function orderRecap(order: Order, stato: OrderStatus): OrderRecap {
  const offer = offerName(order);
  const single = order.lines.length === 1 ? getService(order.lines[0].serviceId)!.title : null;
  return {
    nome: order.name,
    titolo: offer ?? single ?? "Il tuo progetto",
    stato,
    righe: order.lines.map(lineText),
    appuntamenti: order.appointments.map((a) => ({ titolo: lineText(a), quando: whenText(a), inizio: a.start, fine: a.end })),
    aDistanza: remoteLines(order).map(lineText),
    totale: formatEuro(order.totalCents),
    mensile: order.monthly,
    pagamento: order.payment,
    regola: Boolean(order.policy),
  };
}

/** Messaggio WhatsApp per lo studio: corto, leggibile dal telefono. */
export function whatsappText(order: Order, headline: string): string {
  const offer = offerName(order);
  const remote = remoteLines(order);
  return [
    `🎧 *${headline}*`,
    "",
    `👤 ${order.name}`,
    order.phone ? `📞 ${order.phone}` : null,
    `✉️ ${order.email}`,
    "",
    offer ? `📦 ${offer}` : null,
    ...order.lines.map((l) => `• ${lineText(l)}`),
    ...(order.appointments.length ? ["", "🗓 *In studio*", ...order.appointments.map((a) => `• ${getService(a.serviceId)!.short}: ${whenText(a)}`)] : []),
    remote.length ? `\n🌐 A distanza: ${remote.map(lineText).join(", ")}` : null,
    "",
    `💶 *${formatEuro(order.totalCents)}*${order.monthly ? " al mese" : ""} · ${order.payment === "contanti" ? "DA SALDARE in contanti al primo appuntamento" : "pagato online"}`,
    order.notes ? `📝 ${order.notes.slice(0, 300)}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Riepilogo leggibile per le email. */
export function describeOrderForHumans(order: Order): string[] {
  const offer = offerName(order);
  const remote = remoteLines(order);
  return [
    order.passId ? `${offer}: ${passContents(getPass(order.passId)!)} ogni mese` : null,
    order.packageId ? `Pacchetto: ${offer}` : null,
    ...order.lines.map((l) => `• ${lineText(l)}`),
    "",
    ...(order.appointments.length ? ["In studio:", ...order.appointments.map((a) => `• ${getService(a.serviceId)!.short}: ${whenText(a)}`)] : []),
    remote.length ? `A distanza: ${remote.map((r) => lineText(r)).join(", ")}. Ti scriviamo noi per i dettagli e il materiale.` : null,
    "",
    `Totale: ${formatEuro(order.totalCents)}${order.monthly ? " al mese" : ""}`,
    order.payment === "contanti" ? "Pagamento: in contanti in studio, al primo appuntamento." : "Pagamento: online.",
    order.policy ? `Cancellazioni: avvisaci almeno ${CANCELLATION_HOURS} ore prima; dopo, il pagamento non è rimborsabile.` : null,
  ].filter((l): l is string => l !== null);
}

export function passContents(pass: Pass): string {
  return (Object.keys(pass.includes) as PassUnit[])
    .map((k) => `${pass.includes[k]} ${pass.includes[k] === 1 ? PASS_UNIT_LABELS[k].one : PASS_UNIT_LABELS[k].many}`)
    .join(", ");
}
