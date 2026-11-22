/**
 * Checkout di backroomsstudio.it/prenota/ — JavaScript senza framework.
 * Riusa la stessa logica del server (listino, sconti, slot), così prezzi e orari mostrati
 * coincidono sempre con quelli che il server ricontrolla prima di incassare.
 */
import {
  BEATSTARS_LICENSE_PRICE,
  BEATSTARS_URL,
  bookingMinutes,
  CANCELLATION_POLICY,
  getPass,
  getService,
  groupOf,
  maxUnitsFor,
  PASS_CHECKOUT_EXTRA_DISCOUNT,
  PASS_PERKS,
  PASS_UNIT_LABELS,
  passCheckoutCents,
  passCovers,
  passesFor,
  serviceGroups,
  type BookableService,
  type GroupId,
  type Pass,
  type PassId,
  type PassUnit,
  type ServiceId,
} from "../booking/catalog.ts";
import { formatDuration, formatEuro, quote, unitLabel } from "../booking/pricing.ts";
import { addDays, DEFAULT_RULES, romeDay, slotsForDay, TIME_ZONE, type Interval, type Slot } from "../booking/slots.ts";
import { studio } from "../booking/studio.ts";

const DAYS_PER_PAGE = 7;

/* ---------- piccoli aiuti DOM ---------- */

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

function h(tag: string, attrs: Attrs = {}, ...children: (Node | string | null | false | undefined)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, ""), v as EventListener);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== false && c !== undefined) el.append(c);
  return el;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function dayLabel(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("it-IT", { ...o, timeZone: "UTC" }).replace(".", "");
  return { weekday: f({ weekday: "short" }), num: d.getUTCDate(), month: f({ month: "short" }), long: f({ weekday: "long", day: "numeric", month: "long" }) };
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

function track(name: string, params: Record<string, unknown> = {}) {
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (g) g("event", name, params);
}

/* ---------- stato ---------- */

const params = new URLSearchParams(location.search);
const today = romeDay(new Date());
const lastDay = addDays(today, DEFAULT_RULES.horizonDays);

const presetPass = getPass(params.get("pass") ?? "") ?? null;
const presetService = getService(params.get("servizio") ?? "")?.id ?? (presetPass ? "registrazione" : null);

const state = {
  /** Primo livello della scelta: Sessione, Beat o Mix & Master */
  groupId: (presetService ? groupOf(presetService).id : null) as GroupId | null,
  /** Secondo livello: il servizio vero e proprio (null finché non si sceglie) */
  serviceId: presetService as ServiceId | null,
  units: 1,
  pageStart: today,
  day: today,
  slotStart: null as string | null,
  payment: "online" as "online" | "contanti",
  availability: { status: "loading" } as { status: "loading" } | { status: "error"; message: string } | { status: "ready"; busy: Interval[]; now: Date },
  /** Pass scelto dalla sezione prezzi del sito (?pass=pro): il primo appuntamento si prenota qui */
  presetPass,
  submitting: false,
  pending: null as Record<string, unknown> | null,
};
let fetchCtrl: AbortController | null = null;

/** Il servizio scelto. Le parti del checkout che lo usano compaiono solo dopo la scelta. */
const service = (): BookableService => getService(state.serviceId ?? "registrazione")!;
const chosen = () => state.serviceId !== null;
const minutes = () => bookingMinutes(service(), state.units);
const inStudio = () => service().where === "studio";
const canPayCash = () => service().cashAllowed && !activePresetPass();
const canPayOnline = () => service().onlineAllowed !== false;
const activePresetPass = (): Pass | null => (state.presetPass && chosen() && passCovers(state.presetPass, service(), state.units) ? state.presetPass : null);
const policyNeeded = () => state.payment === "online" && inStudio();

/* ---------- disponibilità ---------- */

async function loadAvailability() {
  if (!chosen() || !inStudio()) return;
  fetchCtrl?.abort();
  fetchCtrl = new AbortController();
  state.availability = { status: "loading" };
  renderCalendar();
  try {
    const res = await fetch(`/api/disponibilita?da=${state.pageStart}&giorni=${DAYS_PER_PAGE}`, { signal: fetchCtrl.signal, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Calendario non disponibile");
    state.availability = { status: "ready", busy: json.busy, now: new Date(json.now) };
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    state.availability = { status: "error", message: (e as Error).message };
  }
  dropSlotIfTaken();
  renderCalendar();
  renderSummary();
}

function pageDays(): string[] {
  return Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(state.pageStart, i)).filter((d) => d <= lastDay);
}

function slotsOf(day: string): Slot[] {
  if (state.availability.status !== "ready") return [];
  return slotsForDay(day, minutes(), state.availability.busy, state.availability.now);
}

function dropSlotIfTaken() {
  if (!state.slotStart || state.availability.status !== "ready") return;
  const free = pageDays().some((d) => slotsOf(d).some((s) => s.start === state.slotStart && s.state === "libero"));
  if (!free) state.slotStart = null;
}

/* ---------- render ---------- */

function chooseService(id: ServiceId) {
  const s = getService(id)!;
  state.serviceId = id;
  state.units = 1;
  state.slotStart = null;
  if (!s.cashAllowed) state.payment = "online";
  if (s.onlineAllowed === false) state.payment = "contanti";
  track("checkout_servizio", { servizio: id });
  renderAll(true);
  void loadAvailability();
}

function renderServices() {
  $("co-groups").replaceChildren(
    ...serviceGroups.map((g) => {
      const active = g.id === state.groupId;
      return h(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": String(active),
          class: "co-group" + (active ? " on" : ""),
          onclick: () => {
            if (state.groupId === g.id) return;
            state.groupId = g.id;
            // Con una sola opzione (non succede oggi) si sceglie da sola; altrimenti si apre il secondo livello.
            state.serviceId = g.options.length === 1 ? g.options[0].serviceId : null;
            state.slotStart = null;
            track("checkout_famiglia", { famiglia: g.id });
            renderAll(true);
          },
        },
        h("b", {}, g.title),
        h("span", {}, g.text),
        h("i", {}, active ? "Scelto ✓" : "Scegli →"),
      );
    }),
  );

  const sub = $("co-sub");
  const group = serviceGroups.find((g) => g.id === state.groupId);
  sub.hidden = !group;
  if (!group) return;
  $("co-sub-title").textContent = group.id === "sessione" ? "Che tipo di sessione?" : "In presenza o a distanza?";
  $("co-options").replaceChildren(
    ...group.options.map((o) => {
      const s = getService(o.serviceId)!;
      const active = o.serviceId === state.serviceId;
      return h(
        "button",
        { type: "button", role: "radio", "aria-checked": String(active), class: "co-card" + (active ? " on" : ""), onclick: () => chooseService(o.serviceId) },
        s.badge ? h("span", { class: "co-badge" }, s.badge) : null,
        h("span", { class: "co-card-title" }, o.label),
        h("span", { class: "co-card-text" }, o.hint),
      );
    }),
  );
  const bs = $("co-beatstars");
  bs.hidden = !(group.id === "beat" && BEATSTARS_URL);
  if (!bs.hidden) {
    bs.replaceChildren(
      h(
        "a",
        { href: BEATSTARS_URL, target: "_blank", rel: "noopener", class: "co-card co-wide", "data-track": "beatstars" },
        h("span", { class: "co-card-title" }, "Oppure un beat già pronto"),
        h("span", { class: "co-card-text" }, `Licenza base a ${BEATSTARS_LICENSE_PRICE}: scegli e acquisti direttamente sul nostro BeatStars.`),
        h("span", { class: "co-tag" }, "Apri BeatStars ↗"),
      ),
    );
  }
}

function renderQty() {
  const s = service();
  $("co-qty-title").textContent = s.unit.one === "ora" ? "Quante ore?" : s.unit.one === "sessione" ? "Quante sessioni?" : s.unit.one === "beat" ? "Quanti beat?" : "Quanti brani?";
  $("co-qty").replaceChildren(
    ...Array.from({ length: maxUnitsFor(s) }, (_, i) => i + 1).map((n) => {
      const q = quote(s, n);
      const active = n === state.units;
      return h(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": String(active),
          class: "co-chip" + (active ? " on" : ""),
          onclick: () => {
            state.units = n;
            dropSlotIfTaken();
            renderAll();
          },
        },
        h("b", {}, unitLabel(s, n)),
        h("small", {}, formatEuro(q.totalCents) + (q.discountPercent ? ` · −${q.discountPercent}%` : "")),
      );
    }),
  );
  const note = $("co-qty-note");
  note.textContent = s.noDiscount
    ? "Il noleggio della sala ha un prezzo fisso: niente sconti per quantità."
    : "Più ne prendi, meno paghi: da 3 −10%, da 5 −20%." + (inStudio() && s.showDuration ? ` Blocco unico in studio da ${formatDuration(minutes())}.` : "");
}

function renderCalendar() {
  if (!chosen() || !inStudio()) return;

  ($("co-prev") as HTMLButtonElement).disabled = state.pageStart <= today;
  ($("co-next") as HTMLButtonElement).disabled = addDays(state.pageStart, DAYS_PER_PAGE) > lastDay;
  const ready = state.availability.status === "ready";

  $("co-days").replaceChildren(
    ...pageDays().map((d) => {
      const l = dayLabel(d);
      const free = slotsOf(d).filter((s) => s.state === "libero").length;
      const active = d === state.day;
      return h(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": String(active),
          class: "co-day" + (active ? " on" : "") + (ready && !free ? " full" : ""),
          onclick: () => {
            state.day = d;
            renderCalendar();
          },
        },
        h("small", {}, l.weekday),
        h("b", {}, String(l.num)),
        h("small", {}, l.month),
        h("em", {}, ready ? (free ? `${free} liberi` : "pieno") : "…"),
      );
    }),
  );

  $("co-day-label").textContent = dayLabel(state.day).long;
  const box = $("co-slots");
  const status = $("co-cal-status");
  status.replaceChildren();
  box.replaceChildren();

  if (state.availability.status === "loading") {
    status.textContent = "Carico il calendario aggiornato…";
    return;
  }
  if (state.availability.status === "error") {
    status.append(
      h("span", {}, `${state.availability.message}. `),
      h("button", { type: "button", class: "co-link", onclick: () => loadAvailability() }, "Riprova"),
      " oppure ",
      h("a", { class: "co-link", href: `https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(`Ciao ${studio.name}! Vorrei prenotare: ${service().title}.`)}`, target: "_blank", rel: "noopener" }, "prenota su WhatsApp"),
      ".",
    );
    return;
  }
  const visible = slotsOf(state.day).filter((s) => s.state === "libero" || s.state === "occupato");
  if (!visible.length) {
    status.textContent = "Nessun orario prenotabile in questo giorno: prova un altro giorno.";
    return;
  }
  box.append(
    ...visible.map((s) => {
      const free = s.state === "libero";
      const active = s.start === state.slotStart;
      return h(
        "button",
        {
          type: "button",
          disabled: !free,
          "aria-pressed": String(active),
          "aria-label": `${s.label} ${free ? "libero" : "occupato"}`,
          class: "co-slot" + (active ? " on" : "") + (free ? "" : " busy"),
          onclick: () => {
            state.slotStart = s.start;
            renderAll(true);
          },
        },
        s.label,
      );
    }),
  );
}

function renderPay() {
  const cash = $("co-pay-cash") as HTMLButtonElement;
  const online = $("co-pay-online") as HTMLButtonElement;
  if (!canPayCash()) state.payment = "online";
  if (!canPayOnline()) state.payment = "contanti";
  cash.disabled = !canPayCash();
  online.disabled = !canPayOnline();
  $("co-pay-online-text").textContent = canPayOnline()
    ? "Carta, PayPal, Apple Pay o Google Pay. Pagamento sicuro con Stripe."
    : "La sessione di prova si paga solo in studio, il giorno della sessione.";
  $("co-pay-cash-text").textContent = !service().cashAllowed
    ? "Non disponibile per i servizi a distanza."
    : activePresetPass()
      ? "Il Pass si paga online."
      : "Prenoti ora e paghi in contanti il giorno della sessione.";
  online.setAttribute("aria-checked", String(state.payment === "online"));
  cash.setAttribute("aria-checked", String(state.payment === "contanti"));
  online.classList.toggle("on", state.payment === "online");
  cash.classList.toggle("on", state.payment === "contanti");
  const tel = $("co-tel") as HTMLInputElement;
  tel.required = state.payment === "contanti";
  $("co-tel-star").hidden = state.payment !== "contanti";
  // Regola di cancellazione: da accettare per pagare online una sessione in studio.
  const policy = $("co-policy") as HTMLInputElement;
  $("co-policy-row").hidden = !policyNeeded();
  policy.required = policyNeeded();
  $("co-policy-text").textContent = CANCELLATION_POLICY;
}

function renderSummary() {
  const s = service();
  const q = quote(s, state.units);
  const pass = activePresetPass();
  $("co-sum-title").textContent = pass ? `${pass.title} · ${s.title}` : s.title;
  $("co-sum-qty").textContent = unitLabel(s, state.units);
  const whenRow = $("co-sum-when-row");
  whenRow.hidden = !inStudio();
  if (state.slotStart) {
    const end = new Date(Date.parse(state.slotStart) + minutes() * 60000).toISOString();
    $("co-sum-when").textContent = `${dayLabel(romeDay(new Date(state.slotStart))).long}, ${s.showDuration ? `${timeLabel(state.slotStart)} – ${timeLabel(end)}` : `dalle ${timeLabel(state.slotStart)}`}`;
  } else $("co-sum-when").textContent = "da scegliere";

  $("co-sum-pay").textContent = state.payment === "contanti" ? "In studio, il giorno della sessione" : "Online (carta, PayPal, Apple Pay, Google Pay)";
  const disc = $("co-sum-disc-row");
  disc.hidden = pass ? false : q.discountPercent === 0;
  if (pass) {
    $("co-sum-disc-label").textContent = `Pass dal sito −${PASS_CHECKOUT_EXTRA_DISCOUNT}%`;
    $("co-sum-disc").replaceChildren(h("s", {}, formatEuro(pass.monthlyCents)));
    $("co-sum-total").textContent = formatEuro(passCheckoutCents(pass));
    $("co-sum-per").textContent = "/mese";
  } else {
    $("co-sum-disc-label").textContent = `Sconto −${q.discountPercent}%`;
    $("co-sum-disc").replaceChildren(h("s", {}, formatEuro(q.fullCents)), ` −${formatEuro(q.savingCents)}`);
    $("co-sum-total").textContent = formatEuro(q.totalCents);
    $("co-sum-per").textContent = "";
  }

  const submit = $("co-submit") as HTMLButtonElement;
  submit.disabled = state.submitting;
  submit.textContent = state.submitting ? "Un attimo…" : state.payment === "contanti" ? "Conferma prenotazione" : "Vai al pagamento →";
  $("co-sum-note").textContent =
    state.payment === "contanti"
      ? "Lo slot viene riservato subito: paghi in studio il giorno della sessione."
      : "Pagherai sulla pagina sicura di Stripe. Lo slot resta bloccato per te 30 minuti." + (policyNeeded() ? ` ${CANCELLATION_POLICY}` : "");

  const banner = $("co-pass-banner");
  banner.hidden = !pass;
  if (pass) banner.textContent = `Stai attivando il ${pass.title} a ${formatEuro(passCheckoutCents(pass))} al mese: scegli qui la prima sessione.`;
}

/** Quali passaggi si vedono: si aprono uno dopo l'altro, come una matrioska. */
function visibleSteps(): Record<string, boolean> {
  const one = chosen();
  const two = one && (!inStudio() || Boolean(state.slotStart));
  return {
    "st-qty": one && maxUnitsFor(service()) > 1,
    "co-when": one && inStudio(),
    "st-dati": two,
    "st-pay": two,
    "st-sum": two,
  };
}

let firstRender = true;

function renderSteps(scroll: boolean) {
  let newlyShown: HTMLElement | null = null;
  for (const [id, show] of Object.entries(visibleSteps())) {
    const el = $(id);
    if (show && el.hidden) {
      el.hidden = false;
      if (!firstRender) {
        el.classList.remove("reveal");
        void el.offsetWidth;
        el.classList.add("reveal");
        newlyShown ??= el;
      }
    } else if (!show) el.hidden = true;
  }
  // Numeri dei passaggi in ordine, solo per quelli visibili.
  let n = 0;
  document.querySelectorAll<HTMLElement>(".co-step").forEach((step) => {
    if (step.hidden) return;
    n++;
    step.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => (el.textContent = String(n).padStart(2, "0")));
  });
  if (scroll && newlyShown) newlyShown.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAll(scroll = false) {
  renderServices();
  if (chosen()) {
    renderQty();
    renderCalendar();
    renderPay();
    renderSummary();
  }
  renderSteps(scroll);
  firstRender = false;
}

/* ---------- Pass proposto prima di pagare ---------- */

function passCard(p: Pass) {
  return h(
    "article",
    { class: "co-pass" + (p.recommended ? " star" : "") },
    p.recommended ? h("span", { class: "co-pass-badge" }, "Consigliato") : null,
    h("h3", { class: "gold-text" }, p.title),
    h("p", { class: "co-card-text" }, p.tagline),
    h(
      "ul",
      {},
      ...(Object.keys(p.includes) as PassUnit[]).map((k) => h("li", {}, `${p.includes[k]} ${p.includes[k] === 1 ? PASS_UNIT_LABELS[k].one : PASS_UNIT_LABELS[k].many}`)),
    ),
    h("p", { class: "co-pass-price" }, h("b", {}, formatEuro(passCheckoutCents(p))), h("small", {}, "/mese")),
    h("p", { class: "co-pass-was" }, h("s", {}, formatEuro(p.monthlyCents)), ` · valore ${formatEuro(p.valueCents)}`),
    h("button", { type: "button", class: "btn sm", onclick: () => choosePass(p.id) }, `Attiva ${p.title}`),
  );
}

function openPassOffer(eligible: Pass[]) {
  const s = service();
  const q = quote(s, state.units);
  $("co-pass-intro").textContent =
    `Invece di ${formatEuro(q.totalCents)} una volta, attiva il Backrooms Pass: la sessione che hai scelto diventa la prima del mese e ogni mese hai di nuovo sessioni, beat e mix. ${PASS_PERKS.join(" · ")}. Il Pass si paga online, con rinnovo automatico.`;
  $("co-pass-eyebrow").textContent = `Prima di pagare · solo da qui −${PASS_CHECKOUT_EXTRA_DISCOUNT}% ogni mese`;
  $("co-pass-cards").replaceChildren(...eligible.map(passCard));
  $("co-pass-cards").className = "co-pass-grid n" + Math.min(eligible.length, 3);
  $("co-pass-skip-text").textContent = `Oppure continua con ${s.title.toLowerCase()} (${unitLabel(s, state.units)}) a ${formatEuro(q.totalCents)}.`;
  const dlg = $("co-pass-dialog") as HTMLDialogElement;
  if (dlg.showModal) dlg.showModal();
  else dlg.setAttribute("open", "");
  track("checkout_proposta_pass");
}

function choosePass(passId: PassId | null) {
  ($("co-pass-dialog") as HTMLDialogElement).close();
  if (!state.pending) return;
  // Il Pass si paga online: se il cliente aveva scelto "in studio" deve prima accettare le condizioni di cancellazione.
  if (passId && state.pending.policy !== true) {
    state.payment = "online";
    renderPay();
    renderSummary();
    showError("Il Pass si paga online: accetta le condizioni di cancellazione e premi di nuovo «Vai al pagamento».");
    $("co-policy-row").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  track(passId ? "checkout_pass_scelto" : "checkout_pass_rifiutato", { pass: passId ?? "" });
  void send(passId ? { ...state.pending, pass: passId, pagamento: "online" } : state.pending);
}

/* ---------- invio ---------- */

function showError(msg: string | null) {
  const el = $("co-error");
  el.hidden = !msg;
  el.textContent = msg ?? "";
}

async function send(payload: Record<string, unknown>) {
  state.submitting = true;
  showError(null);
  renderSummary();
  try {
    const res = await fetch("/api/prenota", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409) {
        state.slotStart = null;
        void loadAvailability();
      }
      throw new Error(json.error ?? "Qualcosa è andato storto: riprova o scrivici su WhatsApp.");
    }
    track("checkout_invio", { servizio: state.serviceId, pagamento: payload.pagamento, pass: payload.pass ?? "" });
    location.href = json.redirectUrl;
  } catch (e) {
    state.submitting = false;
    showError((e as Error).message);
    renderSummary();
  }
}

function onSubmit(e: Event) {
  e.preventDefault();
  showError(null);
  if (!chosen()) {
    showError("Scegli cosa vuoi prenotare.");
    $("st-1").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (inStudio() && !state.slotStart) {
    showError("Scegli giorno e orario della sessione.");
    $("co-when").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const form = $("co-form") as HTMLFormElement;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const pass = activePresetPass();
  const payload: Record<string, unknown> = {
    servizio: state.serviceId,
    quantita: state.units,
    inizio: state.slotStart,
    nome: data.get("nome"),
    email: data.get("email"),
    telefono: data.get("telefono"),
    note: data.get("note"),
    sito: data.get("sito"),
    privacy: data.get("privacy") === "on",
    policy: data.get("policy") === "on",
    pagamento: state.payment,
  };
  // Pass già scelto dalla sezione prezzi: niente proposta, si va dritti al pagamento mensile.
  if (pass) return void send({ ...payload, pass: pass.id, pagamento: "online" });
  // Prima di pagare si propone il Pass mensile, se ne esiste uno che include questo acquisto.
  const eligible = passesFor(service(), state.units);
  if (eligible.length) {
    state.pending = payload;
    openPassOffer(eligible);
    return;
  }
  void send(payload);
}

/* ---------- avvio ---------- */

function init() {
  $("co-cancelled").hidden = params.get("annullato") !== "1";
  $("co-payee").textContent = `Venditore: ${studio.payee.name} · P.IVA ${studio.payee.vatId}`;

  $("co-prev").addEventListener("click", () => movePage(-1));
  $("co-next").addEventListener("click", () => movePage(1));
  $("co-pay-online").addEventListener("click", () => {
    if (!canPayOnline()) return;
    state.payment = "online";
    renderPay();
    renderSummary();
  });
  $("co-pay-cash").addEventListener("click", () => {
    state.payment = "contanti";
    renderPay();
    renderSummary();
  });
  $("co-form").addEventListener("submit", onSubmit);
  $("co-pass-skip").addEventListener("click", () => choosePass(null));
  $("co-pass-close").addEventListener("click", () => ($("co-pass-dialog") as HTMLDialogElement).close());
  $("co-pass-dialog").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) ($("co-pass-dialog") as HTMLDialogElement).close();
  });
  // Tornando sulla scheda il calendario si aggiorna.
  window.addEventListener("focus", () => void loadAvailability());
  // Usato dalla demo navigabile per ricominciare dopo un pagamento simulato.
  window.addEventListener("br:reset", (e) => {
    state.submitting = false;
    state.slotStart = null;
    window.scrollTo({ top: 0 });
    $("co-cancelled").hidden = !(e as CustomEvent<{ annullato?: boolean }>).detail?.annullato;
    renderAll();
    void loadAvailability();
  });

  renderAll();
  void loadAvailability();
}

function movePage(delta: number) {
  const next = addDays(state.pageStart, delta * DAYS_PER_PAGE);
  state.pageStart = next < today ? today : next > lastDay ? state.pageStart : next;
  state.day = state.pageStart;
  void loadAvailability();
}

init();
