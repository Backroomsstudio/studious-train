/**
 * Prenotazione di backroomsstudio.it/prenota/ — un questionario, una domanda alla volta.
 * Si parte da un pacchetto pronto o si compone su misura (tracce, beat, mix & master), il calcolatore
 * traduce le tracce in tempo di sala, poi si sceglie un orario per ogni appuntamento in studio.
 * Riusa la stessa logica del server (listino, sconti, appuntamenti, slot): prezzi e orari mostrati
 * coincidono sempre con quelli che il server ricontrolla prima di incassare.
 */
import {
  BEATSTARS_LICENSE_PRICE,
  BEATSTARS_URL,
  CANCELLATION_POLICY,
  getPackage,
  getPass,
  getService,
  maxUnitsFor,
  packages,
  PASS_CHECKOUT_EXTRA_DISCOUNT,
  PASS_PERKS,
  PASS_UNIT_LABELS,
  passCheckoutCents,
  passCovers,
  passesFor,
  planBlocks,
  type Block,
  type CartLine,
  type Package,
  type PackageId,
  type Pass,
  type PassId,
  type PassUnit,
  type ServiceId,
} from "../booking/catalog.ts";
import { cartQuote, formatDuration, formatEuro, unitLabel } from "../booking/pricing.ts";
import { addDays, bookableWindow, DEFAULT_RULES, romeDay, slotsForDay, TIME_ZONE, type Interval, type Slot } from "../booking/slots.ts";
import { studio } from "../booking/studio.ts";

const DAYS_PER_PAGE = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- piccoli aiuti DOM ---------- */

type Child = Node | string | null | false | undefined;
type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, ""), v as EventListener);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== false && c !== undefined) el.append(c);
  return el;
}

const svgNS = "http://www.w3.org/2000/svg";
function s(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function dayLabel(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("it-IT", { ...o, timeZone: "UTC" }).replace(".", "");
  return { weekday: f({ weekday: "short" }), num: d.getUTCDate(), month: f({ month: "short" }), long: f({ weekday: "long", day: "numeric", month: "long" }) };
}

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function whenLabel(startIso: string, minutes: number, showDuration = true) {
  const end = new Date(Date.parse(startIso) + minutes * 60000).toISOString();
  return `${cap(dayLabel(romeDay(new Date(startIso))).long)}, ${showDuration ? `${timeLabel(startIso)}–${timeLabel(end)}` : `dalle ${timeLabel(startIso)}`}`;
}

function track(name: string, params: Record<string, unknown> = {}) {
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (g) g("event", name, params);
}

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- stato ---------- */

type Mode = "pacchetto" | "misura" | "noleggio" | "prova";
type StepId = "start" | "tracce" | "beat" | "mix" | "ore" | "quando" | "dati" | "paga";
type Where = "studio" | "remoto" | "no";

const params = new URLSearchParams(location.search);
const today = romeDay(new Date());
const lastDay = addDays(today, DEFAULT_RULES.horizonDays);
const presetPass = getPass(params.get("pass") ?? "") ?? null;

const state = {
  step: "start" as StepId,
  mode: null as Mode | null,
  packageId: null as PackageId | null,
  tracks: 1,
  beatWhere: null as Where | null,
  beats: 1,
  mixWhere: null as Where | null,
  mixes: 1,
  hours: 1,
  /** Appuntamenti in giorni diversi o tutti di fila lo stesso giorno */
  schedule: "separati" as "separati" | "fila",
  /** Inizio scelto per ogni appuntamento (stesso ordine di planBlocks) */
  starts: [] as (string | null)[],
  blockKey: "",
  active: 0,
  pageStart: today,
  day: today,
  availability: { status: "idle" } as { status: "idle" | "loading" } | { status: "error"; message: string } | { status: "ready"; busy: Interval[]; now: Date },
  payment: "online" as "online" | "contanti",
  form: { nome: "", email: "", telefono: "", note: "", sito: "", privacy: false, policy: false },
  presetPass,
  submitting: false,
  pending: null as Record<string, unknown> | null,
  error: null as string | null,
};
let fetchCtrl: AbortController | null = null;
let loadedFor = "";

/* ---------- carrello ---------- */

function lines(): CartLine[] {
  switch (state.mode) {
    case "pacchetto":
      return getPackage(state.packageId ?? "")?.lines ?? [];
    case "noleggio":
      return [{ serviceId: "noleggio", units: state.hours }];
    case "prova":
      return [{ serviceId: "prova", units: 1 }];
    case "misura": {
      const out: CartLine[] = [];
      if (state.beatWhere === "studio") out.push({ serviceId: "beat-studio", units: state.beats });
      if (state.beatWhere === "remoto") out.push({ serviceId: "beat-remoto", units: state.beats });
      if (state.tracks > 0) out.push({ serviceId: "registrazione", units: state.tracks });
      if (state.mixWhere === "studio") out.push({ serviceId: "mix-studio", units: state.mixes });
      if (state.mixWhere === "remoto") out.push({ serviceId: "mix-remoto", units: state.mixes });
      return out;
    }
    default:
      return [];
  }
}

const blocks = (): Block[] => planBlocks(lines());
const totalStudioMinutes = () => blocks().reduce((sum, b) => sum + b.minutes, 0);
const services = () => lines().map((l) => getService(l.serviceId)!);
const canPayCash = () => services().every((x) => x.cashAllowed) && !activePresetPass();
const canPayOnline = () => services().every((x) => x.onlineAllowed !== false);
const activePresetPass = (): Pass | null => (state.presetPass && state.mode === "misura" && passCovers(state.presetPass, lines()) ? state.presetPass : null);
const policyNeeded = () => state.payment === "online" && blocks().length > 0;
/** Tutto di fila lo stesso giorno: possibile solo se l'intera sequenza sta nella fascia 14:00–02:00. */
const windowMinutes = () => {
  const w = bookableWindow(today);
  return (w.close.getTime() - w.open.getTime()) / 60000;
};
const canChain = () => blocks().length > 1 && totalStudioMinutes() <= windowMinutes();

function quoteNow() {
  const l = lines();
  if (!l.length) return null;
  try {
    return cartQuote(l, state.mode === "pacchetto" ? (state.packageId ?? undefined) : undefined);
  } catch {
    return null;
  }
}

/** Quando cambiano gli appuntamenti necessari si azzerano gli orari scelti. */
function syncBlocks() {
  const key = blocks().map((b) => `${b.serviceId}:${b.units}`).join("|");
  if (key === state.blockKey) return;
  state.blockKey = key;
  state.starts = blocks().map(() => null);
  state.active = 0;
  if (!canChain()) state.schedule = "separati";
}

/* ---------- passaggi del questionario ---------- */

function steps(): StepId[] {
  const out: StepId[] = ["start"];
  if (state.mode === "misura") out.push("tracce", "beat", "mix");
  if (state.mode === "noleggio") out.push("ore");
  if (state.mode && blocks().length) out.push("quando");
  out.push("dati", "paga");
  return out;
}

const STEP_LABELS: Record<StepId, string> = { start: "Cosa", tracce: "Tracce", beat: "Beat", mix: "Mix", ore: "Ore", quando: "Quando", dati: "Chi sei", paga: "Paga" };

function stepError(step: StepId): string | null {
  switch (step) {
    case "start":
      return state.mode ? null : "Scegli da dove partire.";
    case "beat":
      return state.beatWhere ? null : "Dicci se ti serve il beat.";
    case "mix":
      if (!state.mixWhere) return "Dicci se ti serve il mix & master.";
      return lines().length ? null : "Scegli almeno una cosa: tracce, beat o mix.";
    case "quando":
      return state.starts.every(Boolean) ? null : blocks().length > 1 ? "Scegli giorno e ora di ogni appuntamento." : "Scegli giorno e ora.";
    case "dati":
      if (state.form.nome.trim().length < 2) return "Scrivi il tuo nome o nome d'arte.";
      if (!EMAIL_RE.test(state.form.email.trim())) return "Scrivi un'email valida: ti mandiamo la conferma lì.";
      return null;
    case "paga":
      if (state.payment === "contanti" && state.form.telefono.replace(/\D/g, "").length < 6) return "Per pagare in studio serve un numero di telefono (lo trovi al passaggio prima).";
      if (policyNeeded() && !state.form.policy) return "Per pagare online accetta le condizioni di cancellazione.";
      if (!state.form.privacy) return "Serve il consenso al trattamento dei dati.";
      return null;
    default:
      return null;
  }
}

function go(step: StepId, focus = true) {
  state.step = step;
  state.error = null;
  if (step === "quando") void loadAvailability();
  render(true);
  if (focus) {
    const top = $("bk-main").getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top, behavior: reduceMotion() ? "auto" : "smooth" });
  }
  track("prenota_passo", { passo: step });
}

function next() {
  const err = stepError(state.step);
  if (err) {
    state.error = err;
    render();
    return;
  }
  const list = steps();
  const i = list.indexOf(state.step);
  if (i < list.length - 1) go(list[i + 1]);
  else void submit();
}

function back() {
  const list = steps();
  const i = list.indexOf(state.step);
  if (i > 0) go(list[i - 1]);
}

/* ---------- disponibilità ---------- */

async function loadAvailability(force = false) {
  if (!blocks().length) return;
  const key = state.pageStart;
  if (!force && loadedFor === key && state.availability.status === "ready") return renderStage();
  fetchCtrl?.abort();
  fetchCtrl = new AbortController();
  state.availability = { status: "loading" };
  renderStage();
  try {
    const res = await fetch(`/api/disponibilita?da=${state.pageStart}&giorni=${DAYS_PER_PAGE}`, { signal: fetchCtrl.signal, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Calendario non disponibile");
    state.availability = { status: "ready", busy: json.busy, now: new Date(json.now) };
    loadedFor = key;
    // Si apre sul primo giorno con orari liberi.
    if (!slotsOf(state.day).some((x) => x.state === "libero")) {
      const firstFree = pageDays().find((d) => slotsOf(d).some((x) => x.state === "libero"));
      if (firstFree) state.day = firstFree;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    state.availability = { status: "error", message: (e as Error).message };
  }
  if (state.step === "quando") renderStage();
}

function pageDays(): string[] {
  return Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(state.pageStart, i)).filter((d) => d <= lastDay);
}

/** Impegni del calendario più gli altri appuntamenti già scelti in questo ordine. */
function busyFor(exceptIndex: number | null): Interval[] {
  if (state.availability.status !== "ready") return [];
  const own: Interval[] = [];
  blocks().forEach((b, i) => {
    const st = state.starts[i];
    if (st && i !== exceptIndex) own.push({ start: st, end: new Date(Date.parse(st) + b.minutes * 60000).toISOString() });
  });
  return [...state.availability.busy, ...own];
}

function activeMinutes(): number {
  return state.schedule === "fila" ? totalStudioMinutes() : (blocks()[state.active]?.minutes ?? 60);
}

function slotsOf(day: string): Slot[] {
  if (state.availability.status !== "ready") return [];
  const busy = state.schedule === "fila" ? state.availability.busy : busyFor(state.active);
  return slotsForDay(day, activeMinutes(), busy, state.availability.now);
}

function pickSlot(start: string) {
  const bl = blocks();
  if (state.schedule === "fila") {
    let t = Date.parse(start);
    state.starts = bl.map((b) => {
      const iso = new Date(t).toISOString();
      t += b.minutes * 60000;
      return iso;
    });
  } else {
    state.starts[state.active] = start;
    const nextFree = state.starts.findIndex((x) => !x);
    if (nextFree >= 0) state.active = nextFree;
  }
  state.error = null;
  track("prenota_orario", { appuntamenti: bl.length });
  render();
}

/* ---------- render: barra di avanzamento ---------- */

function renderProgress() {
  const list = steps();
  const cur = list.indexOf(state.step);
  $("bk-progress").replaceChildren(
    ...list.map((id, i) =>
      h(
        "li",
        { class: i < cur ? "done" : i === cur ? "on" : "" },
        h(
          "button",
          {
            type: "button",
            disabled: i > cur,
            "aria-current": i === cur ? "step" : undefined,
            onclick: () => i < cur && go(id),
          },
          h("i", {}, String(i + 1)),
          h("span", {}, STEP_LABELS[id]),
        ),
      ),
    ),
  );
  ($("bk-progress") as HTMLElement).style.setProperty("--p", String(list.length > 1 ? cur / (list.length - 1) : 0));
}

/* ---------- render: le domande ---------- */

function question(eyebrow: string, title: string, lead?: string) {
  return [h("div", { class: "eyebrow" }, eyebrow), h("h2", { class: "bk-q gold-text t3d" }, title), lead ? h("p", { class: "bk-lead" }, lead) : null];
}

/** Scheda inclinabile in 3D che segue il mouse. */
function tilt(el: HTMLElement) {
  if (reduceMotion()) return el;
  el.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  el.addEventListener("pointerleave", () => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  });
  return el;
}

/** "1 beat su misura", "2 tracce registrate", "5 mix & master" */
function packageLineText(l: CartLine): string {
  if (l.serviceId.startsWith("beat")) return `${l.units} beat su misura`;
  if (l.serviceId === "registrazione") return l.units === 1 ? "1 traccia registrata" : `${l.units} tracce registrate`;
  if (l.serviceId.startsWith("mix")) return `${l.units} mix & master`;
  return unitLabel(getService(l.serviceId)!, l.units);
}

function packageCard(p: Package) {
  const q = cartQuote(p.lines, p.id);
  const active = state.mode === "pacchetto" && state.packageId === p.id;
  return tilt(
    h(
      "button",
      {
        type: "button",
        class: "bk-pkg" + (active ? " on" : "") + (p.badge ? " star" : ""),
        "aria-pressed": String(active),
        onclick: () => {
          state.mode = "pacchetto";
          state.packageId = p.id;
          syncBlocks();
          track("prenota_pacchetto", { pacchetto: p.id });
          next();
        },
      },
      p.badge ? h("span", { class: "bk-ribbon" }, p.badge) : null,
      h("span", { class: "bk-pkg-title" }, p.title),
      h("span", { class: "bk-pkg-for" }, p.forWho),
      h(
        "ul",
        { class: "bk-pkg-list" },
        p.lines.map((l) => h("li", {}, packageLineText(l))),
      ),
      h(
        "span",
        { class: "bk-pkg-price" },
        h("b", { class: "gold-text" }, formatEuro(p.priceCents)),
        h("s", {}, formatEuro(q.fullCents)),
      ),
      h("span", { class: "bk-save" }, `Risparmi ${formatEuro(q.savingCents)}`),
      h("span", { class: "bk-go" }, "Scegli →"),
    ),
  );
}

function stepStart() {
  return [
    ...question("Da dove partiamo", "Cosa facciamo insieme?", "Scegli un pacchetto pronto oppure componi tu: registrazione, beat e mix & master, anche tutti insieme."),
    h("div", { class: "bk-pkgs" }, packages.map(packageCard)),
    tilt(
      h(
        "button",
        {
          type: "button",
          class: "bk-custom" + (state.mode === "misura" ? " on" : ""),
          onclick: () => {
            if (state.mode !== "misura") {
              state.mode = "misura";
              state.packageId = null;
              syncBlocks();
            }
            track("prenota_su_misura");
            next();
          },
        },
        h("span", { class: "bk-custom-ic", "aria-hidden": "true" }, "✦"),
        h("span", {}, h("b", {}, "Componi su misura"), h("small", {}, "Ti facciamo 3 domande: quante tracce, se ti serve il beat, se ti serve il mix. Il resto lo calcoliamo noi.")),
        h("span", { class: "bk-go" }, "Inizia →"),
      ),
    ),
    h(
      "div",
      { class: "bk-extra" },
      h(
        "button",
        {
          type: "button",
          class: "bk-mini" + (state.mode === "prova" ? " on" : ""),
          onclick: () => {
            state.mode = "prova";
            state.packageId = null;
            state.payment = "contanti";
            syncBlocks();
            next();
          },
        },
        h("b", {}, "Prima volta?"),
        h("span", {}, "Sessione di prova: 1 ora a 20 € invece di 50 €, si paga in studio."),
      ),
      h(
        "button",
        {
          type: "button",
          class: "bk-mini" + (state.mode === "noleggio" ? " on" : ""),
          onclick: () => {
            state.mode = "noleggio";
            state.packageId = null;
            syncBlocks();
            next();
          },
        },
        h("b", {}, "Sala senza fonico"),
        h("span", {}, "La Lounge tutta per te: 35 € l'ora, prezzo fisso."),
      ),
    ),
  ];
}

/** Numero grande con − e +: il cuore del questionario. */
function stepper(value: number, min: number, max: number, onChange: (n: number) => void, label: string, unit: (n: number) => string) {
  const set = (n: number) => {
    const v = Math.min(max, Math.max(min, n));
    if (v !== value) onChange(v);
  };
  return h(
    "div",
    { class: "bk-stepper", role: "group", "aria-label": label },
    h("button", { type: "button", class: "bk-round", disabled: value <= min, "aria-label": `${label}: meno`, onclick: () => set(value - 1) }, "−"),
    h("output", { class: "bk-num", "aria-live": "polite" }, h("b", { class: "gold-text" }, String(value)), h("small", {}, unit(value))),
    h("button", { type: "button", class: "bk-round", disabled: value >= max, "aria-label": `${label}: più`, onclick: () => set(value + 1) }, "+"),
  );
}

/** Il calcolatore: anello che si riempie con le ore di sala. */
function calcRing(minutes: number, caption: string) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, minutes / (6 * 60));
  const svg = s("svg", { viewBox: "0 0 120 120", class: "bk-ring-svg", "aria-hidden": "true" });
  const defs = s("defs");
  const grad = s("linearGradient", { id: "bkRing", x1: "0", y1: "0", x2: "1", y2: "1" });
  grad.append(s("stop", { offset: "0", "stop-color": "#ffffff" }), s("stop", { offset: ".5", "stop-color": "#8e9cff" }), s("stop", { offset: "1", "stop-color": "#c9d2df" }));
  defs.append(grad);
  svg.append(defs, s("circle", { cx: 60, cy: 60, r, class: "bk-ring-bg" }));
  const arc = s("circle", { cx: 60, cy: 60, r, class: "bk-ring-fg", "stroke-dasharray": `${c}`, "stroke-dashoffset": `${c}` });
  svg.append(arc);
  requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute("stroke-dashoffset", String(c * (1 - frac)))));
  return h(
    "div",
    { class: "bk-calc" },
    h("div", { class: "bk-ring" }, svg, h("div", { class: "bk-ring-label" }, h("b", {}, minutes ? formatDuration(minutes).replace(" min", "′") : "—"), h("small", {}, "in sala"))),
    h("p", { class: "bk-calc-text" }, caption),
  );
}

function stepTracks() {
  const reg = getService("registrazione")!;
  const minutes = state.tracks ? planBlocks([{ serviceId: "registrazione", units: state.tracks }]).reduce((a, b) => a + b.minutes, 0) : 0;
  return [
    ...question("Domanda 1 di 3", "Quante tracce vuoi registrare?", `${formatEuro(reg.unitPriceCents)} a traccia. Non vendiamo ore: il tempo che serve lo calcoliamo noi.`),
    stepper(
      state.tracks,
      0,
      maxUnitsFor(reg),
      (n) => {
        state.tracks = n;
        syncBlocks();
        renderStage();
        renderReceipt();
      },
      "Tracce da registrare",
      (n) => (n === 1 ? "traccia" : "tracce"),
    ),
    calcRing(
      minutes,
      state.tracks
        ? `Il nostro calcolatore: per ${unitLabel(reg, state.tracks)} servono ${formatDuration(minutes)} in sala con l'engineer${minutes > 360 ? ", divise in più giorni" : ""}.`
        : "Nessuna registrazione: va bene anche così, per esempio se ti serve solo il beat o il mix.",
    ),
  ];
}

function whereChoice(current: Where | null, options: { id: Where; title: string; text: string }[], onPick: (w: Where) => void) {
  return h(
    "div",
    { class: "bk-choices", role: "radiogroup" },
    options.map((o) =>
      tilt(
        h(
          "button",
          { type: "button", role: "radio", "aria-checked": String(current === o.id), class: "bk-choice" + (current === o.id ? " on" : ""), onclick: () => onPick(o.id) },
          h("b", {}, o.title),
          h("span", {}, o.text),
        ),
      ),
    ),
  );
}

function stepBeat() {
  const beat = getService("beat-studio")!;
  const svc = state.beatWhere === "remoto" ? getService("beat-remoto")! : beat;
  const blocksMin = state.beatWhere === "studio" ? planBlocks([{ serviceId: "beat-studio", units: state.beats }]).reduce((a, b) => a + b.minutes, 0) : 0;
  return [
    ...question("Domanda 2 di 3", "Ti serve il beat?", `Beat su misura, costruito da zero: ${formatEuro(beat.unitPriceCents)} a beat.`),
    whereChoice(
      state.beatWhere,
      [
        { id: "studio", title: "Sì, in studio", text: "Fianco a fianco con il producer: 1 h 30 a beat." },
        { id: "remoto", title: "Sì, a distanza", text: "Ci mandi le reference, te lo consegniamo online." },
        { id: "no", title: "No, ce l'ho già", text: "Registri sul tuo beat o su un type beat." },
      ],
      (w) => {
        if (state.beatWhere === null || state.beatWhere === "no") state.beats = Math.max(1, state.tracks);
        state.beatWhere = w;
        syncBlocks();
        state.error = null;
        renderStage();
        renderReceipt();
      },
    ),
    state.beatWhere && state.beatWhere !== "no"
      ? h(
          "div",
          { class: "bk-sub" },
          h("p", { class: "bk-sub-q" }, "Quanti beat?"),
          stepper(
            state.beats,
            1,
            maxUnitsFor(svc),
            (n) => {
              state.beats = n;
              syncBlocks();
              renderStage();
              renderReceipt();
            },
            "Beat",
            () => "beat",
          ),
          state.beatWhere === "studio" ? h("p", { class: "bk-hint" }, `In sala con il producer: ${formatDuration(blocksMin)}${blocksMin > 360 ? ", divise in più giorni" : ""}.`) : null,
        )
      : null,
    BEATSTARS_URL
      ? h(
          "a",
          { class: "bk-link-card", href: BEATSTARS_URL, target: "_blank", rel: "noopener", "data-track": "beatstars" },
          h("b", {}, "Oppure un beat già pronto"),
          h("span", {}, `Licenza base a ${BEATSTARS_LICENSE_PRICE} sul nostro BeatStars ↗`),
        )
      : null,
  ];
}

function stepMix() {
  const mix = getService("mix-remoto")!;
  const svc = state.mixWhere === "studio" ? getService("mix-studio")! : mix;
  return [
    ...question("Domanda 3 di 3", "Mix & master?", `Il brano pronto per Spotify e tutte le piattaforme: ${formatEuro(mix.unitPriceCents)} a brano.`),
    whereChoice(
      state.mixWhere,
      [
        { id: "remoto", title: "Sì, lo fate voi", text: "Lavoriamo noi, tu ascolti e approvi da casa." },
        { id: "studio", title: "Sì, in studio con me", text: "Lo ascolti crescere in sala e decidi tutto con l'engineer." },
        { id: "no", title: "No, grazie", text: "Il mix lo fai tu o ce l'hai già." },
      ],
      (w) => {
        if (state.mixWhere === null || state.mixWhere === "no") state.mixes = Math.max(1, state.tracks, state.beatWhere && state.beatWhere !== "no" ? state.beats : 0);
        state.mixWhere = w;
        syncBlocks();
        state.error = null;
        renderStage();
        renderReceipt();
      },
    ),
    state.mixWhere && state.mixWhere !== "no"
      ? h(
          "div",
          { class: "bk-sub" },
          h("p", { class: "bk-sub-q" }, "Quanti brani?"),
          stepper(
            state.mixes,
            1,
            maxUnitsFor(svc),
            (n) => {
              state.mixes = n;
              syncBlocks();
              renderStage();
              renderReceipt();
            },
            "Brani da mixare",
            (n) => (n === 1 ? "brano" : "brani"),
          ),
        )
      : null,
  ];
}

function stepHours() {
  const nol = getService("noleggio")!;
  return [
    ...question("Sala senza fonico", "Quante ore ti servono?", `${formatEuro(nol.unitPriceCents)} l'ora, prezzo fisso. Porti il tuo fonico o lavori in autonomia.`),
    stepper(
      state.hours,
      1,
      maxUnitsFor(nol),
      (n) => {
        state.hours = n;
        syncBlocks();
        renderStage();
        renderReceipt();
      },
      "Ore di sala",
      (n) => (n === 1 ? "ora" : "ore"),
    ),
  ];
}

function appointmentTitle(b: Block) {
  const svc = getService(b.serviceId)!;
  return `${svc.short} · ${unitLabel(svc, b.units)}`;
}

function stepWhen() {
  const bl = blocks();
  const multi = bl.length > 1;
  const out: Child[] = [
    ...question(
      "In studio",
      multi ? "Quando vieni?" : "Quando vieni in studio?",
      multi ? `Servono ${bl.length} appuntamenti in sala: scegli un orario per ognuno, oppure tutti di fila nello stesso giorno.` : "Scegli giorno e ora sul calendario vero dello studio.",
    ),
  ];

  if (canChain()) {
    out.push(
      h(
        "div",
        { class: "bk-seg", role: "radiogroup", "aria-label": "Come vuoi organizzare gli appuntamenti" },
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(state.schedule === "separati"),
            class: state.schedule === "separati" ? "on" : "",
            onclick: () => {
              state.schedule = "separati";
              state.starts = bl.map(() => null);
              state.active = 0;
              render();
            },
          },
          "Giorni diversi",
        ),
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(state.schedule === "fila"),
            class: state.schedule === "fila" ? "on" : "",
            onclick: () => {
              state.schedule = "fila";
              state.starts = bl.map(() => null);
              render();
            },
          },
          `Tutto di fila · ${formatDuration(totalStudioMinutes())}`,
        ),
      ),
    );
  }

  if (multi) {
    out.push(
      h(
        "ol",
        { class: "bk-tickets" },
        bl.map((b, i) => {
          const st = state.starts[i];
          const active = state.schedule === "separati" ? i === state.active : true;
          const svc = getService(b.serviceId)!;
          return h(
            "li",
            {},
            h(
              "button",
              {
                type: "button",
                class: "bk-ticket" + (active ? " on" : "") + (st ? " set" : ""),
                disabled: state.schedule === "fila",
                onclick: () => {
                  state.active = i;
                  renderStage();
                },
              },
              h("i", {}, String(i + 1)),
              h("span", {}, h("b", {}, appointmentTitle(b)), h("small", {}, st ? whenLabel(st, b.minutes, svc.showDuration) : svc.showDuration ? `${formatDuration(b.minutes)} · da scegliere` : "da scegliere")),
            ),
          );
        }),
      ),
    );
  }

  const minutes = activeMinutes();
  const activeBlock = bl[state.active];
  out.push(
    h(
      "div",
      { class: "bk-cal" },
      h(
        "div",
        { class: "bk-cal-head" },
        h(
          "p",
          { class: "bk-cal-for" },
          state.schedule === "fila"
            ? `Inizio della giornata · ${formatDuration(minutes)} di fila`
            : multi
              ? `Appuntamento ${state.active + 1}: ${activeBlock ? appointmentTitle(activeBlock) : ""}`
              : activeBlock && getService(activeBlock.serviceId)!.showDuration
                ? `${appointmentTitle(activeBlock)} · ${formatDuration(minutes)}`
                : activeBlock
                  ? appointmentTitle(activeBlock)
                  : "",
        ),
        h(
          "div",
          { class: "bk-arrows" },
          h("button", { type: "button", class: "bk-round sm", "aria-label": "Settimana precedente", disabled: state.pageStart <= today, onclick: () => movePage(-1) }, "←"),
          h("button", { type: "button", class: "bk-round sm", "aria-label": "Settimana successiva", disabled: addDays(state.pageStart, DAYS_PER_PAGE) > lastDay, onclick: () => movePage(1) }, "→"),
        ),
      ),
      calendarBody(),
    ),
    h(
      "p",
      { class: "bk-hint" },
      "Si prenota online almeno 24 ore prima, dalle 14:00 alle 02:00 (le ore dopo mezzanotte sono in fondo al giorno). Per altri orari ",
      h("a", { href: `https://wa.me/${studio.whatsapp}`, target: "_blank", rel: "noopener" }, "scrivici su WhatsApp"),
      ".",
    ),
  );
  return out;
}

function calendarBody(): HTMLElement {
  const ready = state.availability.status === "ready";
  const wrap = h("div", { class: "bk-cal-body" });
  wrap.append(
    h(
      "div",
      { class: "bk-days", role: "tablist", "aria-label": "Giorno" },
      pageDays().map((d) => {
        const l = dayLabel(d);
        const free = slotsOf(d).filter((x) => x.state === "libero").length;
        const active = d === state.day;
        const chosenHere = state.starts.some((st) => st && romeDay(new Date(st)) === d);
        return h(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(active),
            class: "bk-day" + (active ? " on" : "") + (ready && !free ? " full" : "") + (chosenHere ? " mark" : ""),
            onclick: () => {
              state.day = d;
              renderStage();
            },
          },
          h("small", {}, l.weekday),
          h("b", {}, String(l.num)),
          h("small", {}, l.month),
          h("em", {}, ready ? (free ? `${free} ${free === 1 ? "libero" : "liberi"}` : "pieno") : "…"),
        );
      }),
    ),
  );

  if (state.availability.status === "loading" || state.availability.status === "idle") {
    wrap.append(h("div", { class: "bk-cal-msg bk-shimmer" }, "Carico il calendario dello studio…"));
    return wrap;
  }
  if (state.availability.status === "error") {
    wrap.append(
      h(
        "div",
        { class: "bk-cal-msg" },
        `${state.availability.message}. `,
        h("button", { type: "button", class: "bk-link", onclick: () => loadAvailability(true) }, "Riprova"),
        " oppure ",
        h("a", { class: "bk-link", href: `https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(`Ciao ${studio.name}! Vorrei prenotare.`)}`, target: "_blank", rel: "noopener" }, "prenota su WhatsApp"),
        ".",
      ),
    );
    return wrap;
  }
  const visible = slotsOf(state.day).filter((x) => x.state === "libero" || x.state === "occupato");
  wrap.append(h("p", { class: "bk-day-label" }, cap(dayLabel(state.day).long)));
  if (!visible.length) {
    wrap.append(h("div", { class: "bk-cal-msg" }, "Nessun orario prenotabile in questo giorno: prova un altro giorno."));
    return wrap;
  }
  const chosen = state.schedule === "fila" ? state.starts[0] : state.starts[state.active];
  wrap.append(
    h(
      "div",
      { class: "bk-slots" },
      visible.map((sl) => {
        const free = sl.state === "libero";
        const on = sl.start === chosen;
        return h(
          "button",
          {
            type: "button",
            disabled: !free,
            "aria-pressed": String(on),
            "aria-label": `${sl.label} ${free ? "libero" : "occupato"}`,
            class: "bk-slot" + (on ? " on" : "") + (free ? "" : " busy"),
            onclick: () => pickSlot(sl.start),
          },
          sl.label,
        );
      }),
    ),
  );
  return wrap;
}

function movePage(delta: number) {
  const nextPage = addDays(state.pageStart, delta * DAYS_PER_PAGE);
  state.pageStart = nextPage < today ? today : nextPage > lastDay ? state.pageStart : nextPage;
  state.day = state.pageStart;
  void loadAvailability();
}

function field(label: string, key: "nome" | "email" | "telefono" | "note", attrs: Attrs, area = false) {
  const input = h(area ? "textarea" : "input", {
    ...attrs,
    id: `bk-${key}`,
    name: key,
    oninput: (e: Event) => {
      state.form[key] = (e.target as HTMLInputElement).value;
      if (state.error) {
        state.error = null;
        renderNav();
      }
    },
  }) as HTMLInputElement;
  input.value = state.form[key];
  return h("label", { class: "bk-field" }, h("span", {}, label), input);
}

function stepData() {
  return [
    ...question("Quasi fatto", "Chi sei?", "Ti mandiamo la conferma per email. Il telefono serve se paghi in studio."),
    h(
      "div",
      { class: "bk-fields" },
      h(
        "div",
        { class: "bk-two" },
        field("Nome / nome d'arte *", "nome", { required: true, minlength: 2, maxlength: 80, autocomplete: "name" }),
        field("Email *", "email", { type: "email", required: true, maxlength: 120, autocomplete: "email", placeholder: "Per la conferma" }),
      ),
      field("Telefono", "telefono", { type: "tel", maxlength: 30, autocomplete: "tel", placeholder: "Per contattarti se serve" }),
      field("Note sul progetto", "note", { rows: 3, maxlength: 450, placeholder: "Genere, reference, quante persone porti…" }, true),
      h(
        "div",
        { hidden: true, "aria-hidden": "true" },
        h("label", {}, "Sito", h("input", { id: "bk-sito", tabindex: "-1", autocomplete: "off", oninput: (e: Event) => (state.form.sito = (e.target as HTMLInputElement).value) })),
      ),
    ),
  ];
}

function stepPay() {
  if (!canPayCash()) state.payment = "online";
  if (!canPayOnline()) state.payment = "contanti";
  const cashText = !services().every((x) => x.cashAllowed)
    ? "Nel carrello ci sono servizi a distanza: si pagano online."
    : activePresetPass()
      ? "Il Pass si paga online."
      : blocks().length > 1
        ? "Prenoti ora e saldi tutto in contanti al primo appuntamento."
        : "Prenoti ora e paghi in contanti il giorno della sessione.";
  const check = (key: "policy" | "privacy", content: Child[]) => {
    const input = h("input", {
      type: "checkbox",
      id: `bk-${key}`,
      onchange: (e: Event) => {
        state.form[key] = (e.target as HTMLInputElement).checked;
        state.error = null;
        renderNav();
      },
    }) as HTMLInputElement;
    input.checked = state.form[key];
    return h("label", { class: "bk-check" + (key === "policy" ? " bk-policy" : "") }, input, h("span", {}, content));
  };
  return [
    ...question("Ultimo passo", "Come paghi?"),
    h(
      "div",
      { class: "bk-choices two", role: "radiogroup" },
      tilt(
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(state.payment === "online"),
            class: "bk-choice" + (state.payment === "online" ? " on" : ""),
            disabled: !canPayOnline(),
            onclick: () => {
              state.payment = "online";
              render();
            },
          },
          h("b", {}, "Online"),
          h("span", {}, canPayOnline() ? "Carta, PayPal, Apple Pay o Google Pay. Pagamento sicuro con Stripe." : "La sessione di prova si paga solo in studio."),
        ),
      ),
      tilt(
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(state.payment === "contanti"),
            class: "bk-choice" + (state.payment === "contanti" ? " on" : ""),
            disabled: !canPayCash(),
            onclick: () => {
              state.payment = "contanti";
              render();
            },
          },
          h("b", {}, "In studio"),
          h("span", {}, cashText),
        ),
      ),
    ),
    policyNeeded() ? check("policy", [h("b", {}, "Condizioni di cancellazione *"), ` — ${CANCELLATION_POLICY} `, h("a", { href: "/prenota/condizioni/", target: "_blank" }, "Leggi le condizioni")]) : null,
    check("privacy", ["Ho letto l'", h("a", { href: "/privacy/", target: "_blank" }, "informativa privacy"), " e acconsento al trattamento dei miei dati per gestire la prenotazione. *"]),
    h("p", { class: "bk-hint" }, state.payment === "contanti" ? "Gli orari vengono riservati subito." : "Pagherai sulla pagina sicura di Stripe: gli orari restano bloccati per te 30 minuti."),
    h("p", { class: "bk-hint dim" }, `Venditore: ${studio.payee.name} · P.IVA ${studio.payee.vatId}`),
  ];
}

const RENDERERS: Record<StepId, () => Child[]> = {
  start: stepStart,
  tracce: stepTracks,
  beat: stepBeat,
  mix: stepMix,
  ore: stepHours,
  quando: stepWhen,
  dati: stepData,
  paga: stepPay,
};

let lastStep: StepId | null = null;

function renderStage(animate = false) {
  const stage = $("bk-stage");
  const card = h("div", { class: "bk-card" + (animate && lastStep !== state.step && !reduceMotion() ? " enter" : "") }, RENDERERS[state.step]());
  stage.replaceChildren(card);
  lastStep = state.step;
  renderNav();
}

function renderNav() {
  const list = steps();
  const i = list.indexOf(state.step);
  const backBtn = $("bk-back") as HTMLButtonElement;
  const nextBtn = $("bk-next") as HTMLButtonElement;
  backBtn.hidden = i <= 0;
  const last = i === list.length - 1;
  // Sulla prima domanda si va avanti scegliendo una scheda.
  nextBtn.hidden = state.step === "start" && !state.mode;
  nextBtn.disabled = state.submitting;
  nextBtn.textContent = state.submitting ? "Un attimo…" : last ? (state.payment === "contanti" ? "Conferma prenotazione" : "Vai al pagamento →") : "Avanti →";
  nextBtn.classList.toggle("bk-final", last);
  const err = $("bk-error");
  err.hidden = !state.error;
  err.textContent = state.error ?? "";
}

/* ---------- render: lo scontrino ---------- */

function renderReceipt() {
  const box = $("bk-receipt");
  const l = lines();
  const q = quoteNow();
  const pass = activePresetPass();
  const pkg = state.mode === "pacchetto" ? getPackage(state.packageId ?? "") : undefined;
  const bl = blocks();

  if (!l.length || !q) {
    box.replaceChildren(
      h("h4", {}, "Il tuo carrello"),
      h("p", { class: "bk-r-empty" }, "Rispondi alle domande: qui il conto si aggiorna da solo, con il tempo di sala calcolato per te."),
    );
    $("bk-bar-total").textContent = "—";
    return;
  }

  const rows = l.map((line) => {
    const svc = getService(line.serviceId)!;
    return h(
      "div",
      { class: "rl" },
      h("span", {}, svc.short, h("small", {}, ` · ${unitLabel(svc, line.units)}`)),
      h("span", { class: "v" }, pkg ? "incluso" : formatEuro(svc.unitPriceCents * line.units)),
    );
  });

  const studioMin = totalStudioMinutes();
  const showDur = bl.every((b) => getService(b.serviceId)!.showDuration);
  const appts = bl.length
    ? h(
        "div",
        { class: "bk-r-appts" },
        h("p", { class: "bk-r-sub" }, bl.length > 1 ? `${bl.length} appuntamenti in studio${showDur ? ` · ${formatDuration(studioMin)}` : ""}` : `In studio${showDur ? ` · ${formatDuration(studioMin)}` : ""}`),
        bl.map((b, i) => {
          const st = state.starts[i];
          const svc = getService(b.serviceId)!;
          return h("p", { class: "bk-r-appt" + (st ? " set" : "") }, h("i", {}, String(i + 1)), h("span", {}, svc.short, h("small", {}, st ? whenLabel(st, b.minutes, svc.showDuration) : svc.showDuration ? formatDuration(b.minutes) : "da fissare")));
        }),
      )
    : null;

  const remote = l.filter((x) => getService(x.serviceId)!.where === "remoto");
  const total = pass ? passCheckoutCents(pass) : q.totalCents;

  const parts: Child[] = [
    h("h4", {}, pass ? pass.title : pkg ? "Pacchetto" : state.mode === "misura" ? "Su misura" : "Il tuo carrello"),
    h("p", { class: "co-sum-title" }, pkg ? pkg.title : state.mode === "misura" ? "Il tuo progetto" : getService(l[0].serviceId)!.title),
    ...rows,
    appts,
    remote.length ? h("p", { class: "bk-r-remote" }, `A distanza: ${remote.map((x) => getService(x.serviceId)!.short.toLowerCase()).join(" e ")}, senza appuntamento.`) : null,
    pass
      ? h("div", { class: "rl" }, h("span", {}, `Pass dal sito −${PASS_CHECKOUT_EXTRA_DISCOUNT}%`), h("span", { class: "v" }, h("s", {}, formatEuro(pass.monthlyCents))))
      : q.savingCents > 0
        ? h("div", { class: "rl bk-r-save" }, h("span", {}, pkg ? "Risparmi con il pacchetto" : `Sconto quantità −${q.discountPercent}%`), h("span", { class: "v" }, `−${formatEuro(q.savingCents)}`))
        : null,
    h("div", { class: "rtotal" }, h("div", {}, h("div", { class: "lb" }, "Totale")), h("div", { class: "big gold-text" }, formatEuro(total), pass ? h("small", { class: "co-per" }, "/mese") : null)),
    !pkg && state.mode === "misura" && !pass && q.discountUnits > 0 && q.discountUnits < 3
      ? h("p", { class: "bk-r-tip" }, `Con ${3 - q.discountUnits === 1 ? "1 servizio" : `${3 - q.discountUnits} servizi`} in più scatta il −10% su tutto.`)
      : null,
  ];
  box.replaceChildren(...parts.filter((p): p is Node => p instanceof Node));
  $("bk-bar-total").textContent = formatEuro(total) + (pass ? "/mese" : "");
}

function render(animate = false) {
  syncBlocks();
  renderProgress();
  renderStage(animate);
  renderReceipt();
  const banner = $("bk-pass-banner");
  const pass = activePresetPass();
  banner.hidden = !pass;
  if (pass) banner.textContent = `Stai attivando il ${pass.title} a ${formatEuro(passCheckoutCents(pass))} al mese: componi qui il primo acquisto del mese.`;
}

/* ---------- Pass proposto prima di pagare ---------- */

function passCard(p: Pass) {
  return h(
    "article",
    { class: "co-pass" + (p.recommended ? " star" : "") },
    p.recommended ? h("span", { class: "co-pass-badge" }, "Consigliato") : null,
    h("h3", { class: "gold-text" }, p.title),
    h("p", { class: "co-card-text" }, p.tagline),
    h("ul", {}, (Object.keys(p.includes) as PassUnit[]).map((k) => h("li", {}, `${p.includes[k]} ${p.includes[k] === 1 ? PASS_UNIT_LABELS[k].one : PASS_UNIT_LABELS[k].many}`))),
    h("p", { class: "co-pass-price" }, h("b", {}, formatEuro(passCheckoutCents(p))), h("small", {}, "/mese")),
    h("p", { class: "co-pass-was" }, h("s", {}, formatEuro(p.monthlyCents)), ` · valore ${formatEuro(p.valueCents)}`),
    h("button", { type: "button", class: "btn sm", onclick: () => choosePass(p.id) }, `Attiva ${p.title}`),
  );
}

function openPassOffer(eligible: Pass[]) {
  const q = quoteNow()!;
  $("co-pass-intro").textContent =
    `Invece di ${formatEuro(q.totalCents)} una volta, attiva il Backrooms Pass: questo acquisto diventa il primo del mese e ogni mese hai di nuovo sessioni, beat e mix. ${PASS_PERKS.join(" · ")}. Il Pass si paga online, con rinnovo automatico.`;
  $("co-pass-eyebrow").textContent = `Prima di pagare · solo da qui −${PASS_CHECKOUT_EXTRA_DISCOUNT}% ogni mese`;
  $("co-pass-cards").replaceChildren(...eligible.map(passCard));
  $("co-pass-cards").className = "co-pass-grid n" + Math.min(eligible.length, 3);
  $("co-pass-skip-text").textContent = `Oppure continua con un pagamento unico di ${formatEuro(q.totalCents)}.`;
  const dlg = $("co-pass-dialog") as HTMLDialogElement;
  if (dlg.showModal) dlg.showModal();
  else dlg.setAttribute("open", "");
  track("checkout_proposta_pass");
}

function choosePass(passId: PassId | null) {
  ($("co-pass-dialog") as HTMLDialogElement).close();
  if (!state.pending) return;
  // Il Pass si paga online: con "in studio" scelto, prima vanno accettate le condizioni di cancellazione.
  if (passId && blocks().length && !state.form.policy) {
    state.payment = "online";
    render();
    state.error = "Il Pass si paga online: accetta le condizioni di cancellazione e premi di nuovo «Vai al pagamento».";
    renderNav();
    return;
  }
  track(passId ? "checkout_pass_scelto" : "checkout_pass_rifiutato", { pass: passId ?? "" });
  void send(passId ? { ...state.pending, pass: passId, pagamento: "online" } : state.pending);
}

/* ---------- invio ---------- */

async function send(payload: Record<string, unknown>) {
  state.submitting = true;
  state.error = null;
  renderNav();
  try {
    const res = await fetch("/api/prenota", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409 && blocks().length) {
        // Un orario è stato preso nel frattempo: si torna al calendario aggiornato.
        state.starts = blocks().map(() => null);
        state.active = 0;
        state.submitting = false;
        go("quando");
        void loadAvailability(true);
        state.error = json.error ?? "Uno degli orari non è più disponibile: scegline un altro.";
        renderNav();
        return;
      }
      throw new Error(json.error ?? "Qualcosa è andato storto: riprova o scrivici su WhatsApp.");
    }
    track("checkout_invio", { pagamento: payload.pagamento, pass: payload.pass ?? "", pacchetto: payload.pacchetto ?? "" });
    location.href = json.redirectUrl;
  } catch (e) {
    state.submitting = false;
    state.error = (e as Error).message;
    renderNav();
  }
}

async function submit() {
  for (const st of steps()) {
    const err = stepError(st);
    if (err) {
      if (st !== state.step) go(st);
      state.error = err;
      renderNav();
      return;
    }
  }
  const pass = activePresetPass();
  const payload: Record<string, unknown> = {
    ...(state.mode === "pacchetto" ? { pacchetto: state.packageId } : {}),
    righe: lines().map((l) => ({ servizio: l.serviceId, quantita: l.units })),
    inizi: state.starts,
    nome: state.form.nome,
    email: state.form.email,
    telefono: state.form.telefono,
    note: state.form.note,
    sito: state.form.sito,
    privacy: state.form.privacy,
    policy: state.form.policy,
    pagamento: state.payment,
  };
  // Pass già scelto dalla sezione prezzi: niente proposta, si va dritti al pagamento mensile.
  if (pass) return void send({ ...payload, pass: pass.id, pagamento: "online" });
  // Prima di pagare si propone il Pass mensile, se ne esiste uno che include tutto il carrello (non sui pacchetti).
  const eligible = state.mode === "misura" ? passesFor(lines()) : [];
  if (eligible.length) {
    state.pending = payload;
    openPassOffer(eligible);
    return;
  }
  void send(payload);
}

/* ---------- avvio ---------- */

/** I link del sito aprono il questionario già sulla scelta giusta: ?pacchetto=ep, ?servizio=beat-studio, ?pass=pro. */
function applyPreset() {
  const pkg = getPackage(params.get("pacchetto") ?? "");
  const svc = (params.get("servizio") ?? "") as ServiceId;
  if (pkg) {
    state.mode = "pacchetto";
    state.packageId = pkg.id;
    syncBlocks();
    state.step = blocks().length ? "quando" : "dati";
    return;
  }
  if (svc === "prova" || svc === "noleggio") {
    state.mode = svc;
    if (svc === "prova") state.payment = "contanti";
    syncBlocks();
    state.step = svc === "prova" ? "quando" : "ore";
    return;
  }
  if (["registrazione", "beat-studio", "beat-remoto", "mix-studio", "mix-remoto"].includes(svc) || state.presetPass) {
    state.mode = "misura";
    if (svc.startsWith("beat")) {
      state.tracks = 0;
      state.beatWhere = svc === "beat-studio" ? "studio" : "remoto";
      state.step = "beat";
    } else if (svc.startsWith("mix")) {
      state.tracks = 0;
      state.beatWhere = "no";
      state.mixWhere = svc === "mix-studio" ? "studio" : "remoto";
      state.step = "mix";
    } else {
      state.tracks = 1;
      state.step = "tracce";
    }
    syncBlocks();
  }
}

function init() {
  $("bk-cancelled").hidden = params.get("annullato") !== "1";
  $("bk-back").addEventListener("click", back);
  $("bk-form").addEventListener("submit", (e) => {
    e.preventDefault();
    next();
  });
  $("bk-bar-go").addEventListener("click", () => $("bk-side").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }));
  $("co-pass-skip").addEventListener("click", () => choosePass(null));
  $("co-pass-close").addEventListener("click", () => ($("co-pass-dialog") as HTMLDialogElement).close());
  $("co-pass-dialog").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) ($("co-pass-dialog") as HTMLDialogElement).close();
  });
  // Tornando sulla scheda il calendario si aggiorna.
  window.addEventListener("focus", () => state.step === "quando" && void loadAvailability(true));

  applyPreset();
  render();
  if (state.step === "quando") void loadAvailability();
  document.documentElement.classList.add("bk-ready");
}

init();
