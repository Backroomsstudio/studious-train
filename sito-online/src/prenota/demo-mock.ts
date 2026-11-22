/**
 * Demo navigabile del checkout: sostituisce il server con una simulazione nel browser.
 * Calendario finto, pagamento Stripe simulato (nessun dato di carta, nessun addebito),
 * e un pannello che mostra cosa succederebbe nel Google Calendar e nelle email dello studio.
 * Va importato PRIMA di main.ts.
 */
import { bookingMinutes, getPass, getService, maxUnitsFor, passCheckoutCents, passCovers } from "../booking/catalog.ts";
import { CALENDAR_COLORS, describeOrderForHumans, orderDescription, orderTitle, passContents, type Order, type OrderStatus } from "../booking/order.ts";
import { formatEuro, quote, unitLabel } from "../booking/pricing.ts";
import { addDays, DEFAULT_RULES, isBookable, romeToUtc, TIME_ZONE, type Interval } from "../booking/slots.ts";
import { studio } from "../booking/studio.ts";

interface DemoEvent {
  id: number;
  order: Order;
  status: OrderStatus;
}
interface DemoMail {
  to: string;
  subject: string;
  body: string;
}

const events: DemoEvent[] = [];
const mails: DemoMail[] = [];
const usedTrial = new Set<string>();
let pendingId: number | null = null;
let nextId = 1;

const COLOR_HEX: Record<string, string> = { [CALENDAR_COLORS["in-attesa"]]: "#616161", [CALENDAR_COLORS.pagato]: "#0b8043", [CALENDAR_COLORS["da-saldare"]]: "#d50000" };

/* ---------- calendario finto: qualche impegno fisso ogni giorno ---------- */

function demoBusy(from: string, days: number): Interval[] {
  const out: Interval[] = [];
  for (let i = -1; i <= days; i++) {
    const d = addDays(from, i);
    const seed = Number(d.slice(-2));
    out.push({ start: romeToUtc(d, 10 + (seed % 4)).toISOString(), end: romeToUtc(d, 13 + (seed % 4)).toISOString() });
    if (seed % 3 !== 0) out.push({ start: romeToUtc(d, 18).toISOString(), end: romeToUtc(d, 21).toISOString() });
  }
  for (const e of events) if (e.order.start && e.order.end) out.push({ start: e.order.start, end: e.order.end });
  return out;
}

/* ---------- server simulato ---------- */

class DemoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function book(body: Record<string, unknown>): string {
  const service = getService(str(body.servizio, 40));
  if (!service) throw new DemoError("Servizio non valido");
  const units = Number(body.quantita);
  if (!Number.isInteger(units) || units < 1 || units > maxUnitsFor(service)) throw new DemoError("Quantità non valida");
  const name = str(body.nome, 80);
  const email = str(body.email, 120).toLowerCase();
  const phone = str(body.telefono, 30);
  if (name.length < 2) throw new DemoError("Inserisci il tuo nome");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new DemoError("Email non valida");
  if (body.privacy !== true) throw new DemoError("Serve il consenso al trattamento dei dati");
  const pass = str(body.pass, 20) ? getPass(str(body.pass, 20)) : undefined;
  if (pass && !passCovers(pass, service, units)) throw new DemoError("Questo Pass non include l'acquisto scelto");
  const payment = service.onlineAllowed === false ? "contanti" : pass ? "online" : body.pagamento === "contanti" ? "contanti" : "online";
  if (payment === "contanti" && !service.cashAllowed) throw new DemoError("Questo servizio si paga solo online");
  if (payment === "contanti" && phone.replace(/\D/g, "").length < 6) throw new DemoError("Per pagare in studio serve un numero di telefono");

  if (service.oncePerCustomer) {
    const tel = phone.replace(/\D/g, "").replace(/^(00)?39(?=\d{9,10}$)/, "");
    if (usedTrial.has(email) || usedTrial.has(tel)) throw new DemoError("Hai già usato la sessione di prova: scegli una sessione di registrazione normale.", 409);
    usedTrial.add(email);
    usedTrial.add(tel);
  }

  let start: string | undefined;
  let end: string | undefined;
  if (service.where === "studio") {
    const d = new Date(str(body.inizio, 40));
    if (Number.isNaN(d.getTime())) throw new DemoError("Scegli data e ora della sessione");
    start = d.toISOString();
    const minutes = bookingMinutes(service, units);
    end = new Date(d.getTime() + minutes * 60000).toISOString();
    const from = addDays(start.slice(0, 10), -1);
    if (!isBookable(start, minutes, demoBusy(from, 3), new Date(), DEFAULT_RULES)) throw new DemoError("Questo orario non è più disponibile: scegline un altro.", 409);
  }

  const q = quote(service, units);
  const order: Order = {
    serviceId: service.id,
    units,
    start,
    end,
    name,
    email,
    phone,
    notes: str(body.note, 450),
    payment,
    monthly: Boolean(pass),
    ...(pass ? { passId: pass.id } : {}),
    totalCents: pass ? passCheckoutCents(pass) : q.totalCents,
    fullCents: pass ? pass.monthlyCents : q.fullCents,
  };

  if (payment === "contanti") {
    const ev: DemoEvent = { id: nextId++, order, status: "da-saldare" };
    if (service.where === "studio") events.push(ev);
    sendMails(order, "Nuova prenotazione · DA SALDARE IN CONTANTI", false);
    lastConfirmed = ev;
    return "#prenotato";
  }
  const ev: DemoEvent = { id: nextId++, order, status: "in-attesa" };
  if (service.where === "studio") events.push(ev);
  pendingId = ev.id;
  pendingOrder = ev;
  return "#pagamento";
}

let pendingOrder: DemoEvent | null = null;
let lastConfirmed: DemoEvent | null = null;

function sendMails(order: Order, headline: string, paid: boolean) {
  const lines = describeOrderForHumans(order);
  mails.unshift(
    { to: `${studio.email} (voi)`, subject: `${headline} · ${order.name}`, body: [headline, "", ...lines, "", `Cliente: ${order.name}`, `Email: ${order.email}`, order.phone ? `Telefono: ${order.phone}` : ""].filter(Boolean).join("\n") },
    {
      to: `${order.email} (cliente)`,
      subject: `Prenotazione confermata · ${studio.name}`,
      body: [`Ciao ${order.name},`, "", paid ? "il pagamento è andato a buon fine: la tua prenotazione è confermata." : "la tua prenotazione è confermata.", "", ...lines, "", `${studio.payee.name} · P.IVA ${studio.payee.vatId}`].join("\n"),
    },
  );
  updateBadge();
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "https://demo.local");
  await new Promise((r) => setTimeout(r, 250)); // un attimo di attesa, come un server vero
  if (url.pathname === "/api/disponibilita") {
    const from = url.searchParams.get("da") ?? "";
    const days = Number(url.searchParams.get("giorni")) || 7;
    return Response.json({ busy: demoBusy(from, days), rules: DEFAULT_RULES, now: new Date().toISOString() });
  }
  if (url.pathname === "/api/prenota") {
    try {
      return Response.json({ redirectUrl: book(JSON.parse(String(init?.body ?? "{}"))) });
    } catch (e) {
      const err = e as DemoError;
      return Response.json({ error: err.message }, { status: err.status ?? 400 });
    }
  }
  return realFetch(input, init);
};

/* ---------- interfaccia della demo ---------- */

const h = (tag: string, cls = "", text = "") => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};

function when(order: Order) {
  if (!order.start) return "A distanza · nessuno slot in calendario";
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("it-IT", { ...o, timeZone: TIME_ZONE });
  return `${f(order.start, { weekday: "long", day: "numeric", month: "long" })}, ${f(order.start, { hour: "2-digit", minute: "2-digit" })} – ${f(order.end!, { hour: "2-digit", minute: "2-digit" })}`;
}

function eventCard(ev: DemoEvent) {
  const card = h("article", "dm-ev");
  card.style.setProperty("--ev", COLOR_HEX[CALENDAR_COLORS[ev.status]]);
  card.append(h("p", "dm-ev-title", orderTitle(ev.order, ev.status)), h("p", "dm-ev-when", when(ev.order)));
  if (ev.status === "da-saldare") card.append(h("p", "dm-ev-bell", "🔔 Notifica sul telefono 30 minuti prima: da saldare"));
  const pre = h("pre", "dm-ev-desc", orderDescription(ev.order, ev.status));
  card.append(pre);
  return card;
}

function overlay(id: string) {
  let el = document.getElementById(id) as HTMLDialogElement | null;
  if (!el) {
    el = document.createElement("dialog");
    el.id = id;
    el.className = "dm-dialog";
    document.body.append(el);
  }
  el.replaceChildren();
  return el;
}

function openDialog(d: HTMLDialogElement) {
  if (!d.open) d.showModal();
}

function showStripe() {
  if (!pendingOrder) return;
  const o = pendingOrder.order;
  const s = getService(o.serviceId)!;
  const pass = o.passId ? getPass(o.passId) : undefined;
  const d = overlay("dm-stripe");
  const box = h("div", "dm-stripe");
  box.append(
    h("p", "dm-flag", "Pagina di pagamento Stripe · simulata"),
    h("p", "dm-merchant", `${studio.name} · ${studio.payee.name}`),
    h("p", "dm-amount", formatEuro(o.totalCents) + (o.monthly ? " al mese" : "")),
    h("p", "dm-prod", pass ? `${pass.title}: ${passContents(pass)} ogni mese` : `${s.title} — ${unitLabel(s, o.units)}`),
    h("p", "dm-prod", when(o)),
  );
  const methods = h("div", "dm-methods");
  for (const m of ["Carta", "PayPal", "Apple Pay", "Google Pay"]) methods.append(h("span", "", m));
  box.append(methods, h("p", "dm-note", "In questa demo non si inseriscono dati di carta e non viene addebitato nulla. Sul sito vero qui c'è la pagina sicura di Stripe."));
  const acts = h("div", "dm-acts");
  const pay = h("button", "btn", "Simula pagamento riuscito");
  pay.setAttribute("type", "button");
  pay.addEventListener("click", () => {
    const ev = pendingOrder!;
    ev.status = "pagato";
    sendMails(ev.order, ev.order.passId ? `Nuovo ${getPass(ev.order.passId)?.title} attivato` : "Nuovo acquisto pagato online", true);
    lastConfirmed = ev;
    pendingOrder = null;
    pendingId = null;
    d.close();
    location.hash = "pagato";
  });
  const cancel = h("button", "btn-ghost", "Annulla e torna indietro");
  cancel.setAttribute("type", "button");
  cancel.addEventListener("click", () => {
    const i = events.findIndex((e) => e.id === pendingId);
    if (i >= 0) events.splice(i, 1);
    pendingOrder = null;
    pendingId = null;
    d.close();
    clearHash();
    window.dispatchEvent(new CustomEvent("br:reset", { detail: { annullato: true } }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  acts.append(pay, cancel);
  box.append(acts);
  d.append(box);
  openDialog(d);
}

function showConfirmation(cash: boolean) {
  const ev = lastConfirmed;
  if (!ev) return;
  const d = overlay("dm-ok");
  const box = h("div", "dm-ok");
  box.append(
    h("p", "eyebrow", cash ? "Prenotazione registrata" : "Pagamento ricevuto"),
    h("h2", "gold-text", "Ci vediamo in studio"),
    h(
      "p",
      "dm-lead",
      cash
        ? "Il cliente vede questa conferma: l'orario è riservato e paga in studio il giorno della sessione."
        : "Il cliente vede questa conferma e riceve l'email di riepilogo con la ricevuta di Stripe.",
    ),
  );
  const cols = h("div", "dm-cols");
  const cal = h("section", "dm-col");
  cal.append(h("h3", "", "Nel vostro Google Calendar"));
  if (ev.order.start) cal.append(eventCard(ev));
  else cal.append(h("p", "dm-note", "Servizio a distanza: nessun evento in calendario, vi arriva solo l'email."));
  const mailCol = h("section", "dm-col");
  mailCol.append(h("h3", "", "Email inviate"));
  for (const m of mails.slice(0, 2)) {
    const card = h("article", "dm-mail");
    card.append(h("p", "dm-mail-to", `A: ${m.to}`), h("p", "dm-mail-sub", m.subject), h("pre", "", m.body));
    mailCol.append(card);
  }
  cols.append(cal, mailCol);
  box.append(cols);
  const again = h("button", "btn", "Fai un'altra prenotazione");
  again.setAttribute("type", "button");
  again.addEventListener("click", () => {
    d.close();
    clearHash();
    window.dispatchEvent(new CustomEvent("br:reset"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  box.append(again);
  d.append(box);
  openDialog(d);
}

function showStudioView() {
  const d = overlay("dm-studio");
  const box = h("div", "dm-ok");
  const close = h("button", "x", "✕");
  close.setAttribute("type", "button");
  close.setAttribute("aria-label", "Chiudi");
  close.addEventListener("click", () => d.close());
  box.append(close, h("p", "eyebrow", "Vista dello studio"), h("h2", "gold-text", "Calendario ed email"));
  const sorted = [...events].sort((a, b) => Date.parse(a.order.start ?? "") - Date.parse(b.order.start ?? ""));
  const legend = h("p", "dm-legend");
  legend.innerHTML = '<span style="--ev:#616161"></span>In attesa di pagamento <span style="--ev:#0b8043"></span>Pagato <span style="--ev:#d50000"></span>Da saldare in studio';
  box.append(legend);
  const cols = h("div", "dm-cols");
  const cal = h("section", "dm-col");
  cal.append(h("h3", "", `Google Calendar (${sorted.length})`));
  if (!sorted.length) cal.append(h("p", "dm-note", "Ancora nessuna prenotazione: prova a prenotarne una. Gli altri orari occupati della demo sono impegni finti."));
  sorted.forEach((e) => cal.append(eventCard(e)));
  const mailCol = h("section", "dm-col");
  mailCol.append(h("h3", "", `Email (${mails.length})`));
  if (!mails.length) mailCol.append(h("p", "dm-note", "Qui compaiono le email che riceverebbero lo studio e il cliente."));
  for (const m of mails) {
    const card = h("article", "dm-mail");
    card.append(h("p", "dm-mail-to", `A: ${m.to}`), h("p", "dm-mail-sub", m.subject), h("pre", "", m.body));
    mailCol.append(card);
  }
  cols.append(cal, mailCol);
  box.append(cols);
  d.append(box);
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  openDialog(d);
}

let badge: HTMLElement | null = null;
let confirmed = 0;
function updateBadge() {
  confirmed = mails.length / 2;
  if (badge) badge.textContent = String(confirmed);
}

function clearHash() {
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    location.hash = "";
  }
}

function route() {
  if (location.hash === "#pagamento") showStripe();
  else if (location.hash === "#pagato") showConfirmation(false);
  else if (location.hash === "#prenotato") showConfirmation(true);
}
window.addEventListener("hashchange", route);

document.addEventListener("DOMContentLoaded", () => {
  const bar = h("div", "dm-bar");
  bar.append(h("span", "dm-bar-tag", "Demo"), h("span", "", "Calendario finto e pagamento simulato: nessun addebito. I prezzi e le regole sono quelli veri."));
  document.body.prepend(bar);
  const fab = h("button", "dm-fab");
  fab.setAttribute("type", "button");
  fab.append(h("span", "", "Vista studio"));
  badge = h("b", "", "0");
  fab.append(badge);
  fab.addEventListener("click", showStudioView);
  document.body.append(fab);
  if (location.hash) clearHash();
});
