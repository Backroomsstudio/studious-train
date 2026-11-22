"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  BEATSTARS_LICENSE_PRICE,
  BEATSTARS_URL,
  bookableServices,
  bookingMinutes,
  getService,
  maxUnitsFor,
  PASS_CHECKOUT_EXTRA_DISCOUNT,
  PASS_PERKS,
  PASS_UNIT_LABELS,
  passCheckoutCents,
  passesFor,
  type Pass,
  type PassId,
  type PassUnit,
  type ServiceId,
} from "@/lib/booking/catalog";
import { formatDuration, formatEuro, quote, unitLabel } from "@/lib/booking/pricing";
import { addDays, DEFAULT_RULES, romeDay, slotsForDay, TIME_ZONE, type Interval, type Slot } from "@/lib/booking/slots";
import { buttonStyles, cn } from "@/lib/cn";
import { studio, whatsappLink } from "@/lib/studio";

const DAYS_PER_PAGE = 7;

const fieldClass =
  "w-full rounded-xl border border-white/12 bg-obsidian/60 px-4 py-3 text-white placeholder:text-mist/60 transition-colors focus:border-chrome focus:outline-none";
const labelClass = "mb-2 block font-mono text-[0.7rem] uppercase tracking-[0.2em] text-mist";
const stepTitle = "font-display text-3xl leading-none text-white sm:text-4xl";

function dayLabel(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("it-IT", { weekday: "short", timeZone: "UTC" }).replace(".", ""),
    num: d.getUTCDate(),
    month: d.toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" }).replace(".", ""),
    long: d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
  };
}

type Availability =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; busy: Interval[]; now: Date; from: string };

export function Checkout({ initialService, cancelled }: { initialService?: ServiceId; cancelled?: boolean }) {
  const [serviceId, setServiceId] = useState<ServiceId>(initialService ?? "registrazione");
  const service = getService(serviceId)!;
  const [units, setUnits] = useState(1);
  const maxUnits = maxUnitsFor(service);
  const minutes = bookingMinutes(service, units);
  const price = quote(service, units);

  const today = useMemo(() => romeDay(new Date()), []);
  const lastDay = addDays(today, DEFAULT_RULES.horizonDays);
  const [pageStart, setPageStart] = useState(today);
  const [day, setDay] = useState(today);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const [payment, setPayment] = useState<"online" | "contanti">("online");
  const [submitting, setSubmitting] = useState(false);
  // Proposta del Pass mensile subito prima di pagare
  const passDialog = useRef<HTMLDialogElement>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const eligiblePasses = passesFor(service, units);
  const [error, setError] = useState<string | null>(null);

  const inStudio = service.where === "studio";

  // Cambio servizio: si riparte da 1 unità e si azzera l'orario scelto.
  const chooseService = (id: ServiceId) => {
    setServiceId(id);
    setUnits(1);
    setSlotStart(null);
    const next = getService(id)!;
    if (!next.cashAllowed) setPayment("online");
  };

  useEffect(() => {
    if (!inStudio) return;
    const controller = new AbortController();
    setAvailability({ status: "loading" });
    fetch(`/api/disponibilita?da=${pageStart}&giorni=${DAYS_PER_PAGE}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Calendario non disponibile");
        setAvailability({ status: "ready", busy: json.busy, now: new Date(json.now), from: pageStart });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setAvailability({ status: "error", message: e.message });
      });
    return () => controller.abort();
  }, [inStudio, pageStart, reloadKey]);

  // Ricarica quando si torna sulla scheda: il calendario resta aggiornato.
  useEffect(() => {
    const onFocus = () => setReloadKey((k) => k + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const pageDays = useMemo(() => Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(pageStart, i)).filter((d) => d <= lastDay), [pageStart, lastDay]);

  const slotsByDay = useMemo(() => {
    const out: Record<string, Slot[]> = {};
    if (availability.status !== "ready" || !inStudio) return out;
    for (const d of pageDays) out[d] = slotsForDay(d, minutes, availability.busy, availability.now);
    return out;
  }, [availability, pageDays, minutes, inStudio]);

  // Se cambiano durata o disponibilità e l'orario scelto non è più libero, lo si toglie.
  useEffect(() => {
    if (!slotStart) return;
    const stillFree = Object.values(slotsByDay).some((list) => list.some((s) => s.start === slotStart && s.state === "libero"));
    if (availability.status === "ready" && !stillFree) setSlotStart(null);
  }, [slotsByDay, slotStart, availability.status]);

  const daySlots = slotsByDay[day] ?? [];
  const visibleSlots = daySlots.filter((s) => s.state !== "passato" && s.state !== "fuori-orizzonte");

  const movePage = (delta: number) => {
    const next = addDays(pageStart, delta * DAYS_PER_PAGE);
    const clamped = next < today ? today : next > lastDay ? pageStart : next;
    setPageStart(clamped);
    setDay(clamped);
  };

  const selectedLabel = useMemo(() => {
    if (!slotStart) return null;
    const start = new Date(slotStart);
    const end = new Date(start.getTime() + minutes * 60000);
    const fmt = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
    return {
      day: dayLabel(romeDay(start)).long,
      time: service.showDuration ? `${fmt(start)} – ${fmt(end)}` : `dalle ${fmt(start)}`,
    };
  }, [slotStart, minutes, service.showDuration]);

  const canPayCash = service.cashAllowed;
  const ready = !inStudio || Boolean(slotStart);

  const send = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/prenota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSlotStart(null);
          setReloadKey((k) => k + 1);
        }
        throw new Error(json.error ?? "Qualcosa è andato storto");
      }
      window.location.href = json.redirectUrl;
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!ready) {
      setError("Scegli giorno e orario della sessione.");
      return;
    }
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      servizio: serviceId,
      quantita: units,
      inizio: slotStart,
      nome: data.get("nome"),
      email: data.get("email"),
      telefono: data.get("telefono"),
      note: data.get("note"),
      sito: data.get("sito"),
      privacy: data.get("privacy") === "on",
      pagamento: canPayCash ? payment : "online",
    };
    // Prima di pagare si propone il Pass mensile, se ne esiste uno che include questo acquisto.
    if (eligiblePasses.length > 0) {
      setPendingPayload(payload);
      passDialog.current?.showModal();
      return;
    }
    void send(payload);
  };

  const choosePass = (passId: PassId | null) => {
    passDialog.current?.close();
    if (!pendingPayload) return;
    void send(passId ? { ...pendingPayload, pass: passId, pagamento: "online" } : pendingPayload);
  };

  const wa = whatsappLink(`Ciao ${studio.name}! Vorrei informazioni per prenotare: ${service.title}.`);

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14" noValidate>
      <div className="grid gap-14">
        {cancelled && (
          <p className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-sm text-mist" role="status">
            Pagamento annullato: non ti è stato addebitato nulla e l&apos;orario è di nuovo libero.
          </p>
        )}

        {/* 1 · Servizio */}
        <section aria-labelledby="step-servizio">
          <p className="eyebrow">01 · Servizio</p>
          <h2 id="step-servizio" className={cn(stepTitle, "mt-3")}>
            Cosa vuoi fare?
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="step-servizio">
            {bookableServices.map((s) => {
              const active = s.id === serviceId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseService(s.id)}
                  className={cn(
                    "press flex flex-col gap-2 rounded-2xl border p-5 text-left transition-colors",
                    active ? "border-white bg-white/[0.08]" : "border-white/12 bg-white/[0.02] hover:border-white/40",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-mist">{s.where === "studio" ? "In studio" : "A distanza"}</span>
                    <span className="font-mono text-sm text-white">
                      {formatEuro(s.unitPriceCents)}
                      <span className="text-mist">/{s.id === "registrazione" ? "ora" : s.unit.one}</span>
                    </span>
                  </span>
                  <span className="font-display text-2xl leading-tight text-white">{s.title}</span>
                  <span className="text-sm leading-relaxed text-mist">{s.summary}</span>
                  {s.showDuration && s.minutesPerUnit > 0 && (
                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-mist">
                      {formatDuration(s.minutesPerUnit)} a {s.unit.one}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {BEATSTARS_URL && (
            <a
              href={BEATSTARS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press mt-3 flex flex-col gap-1 rounded-2xl border border-dashed border-white/20 p-5 transition-colors hover:border-white/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <span className="block font-display text-2xl text-white">Catalogo beat già pronti</span>
                <span className="text-sm text-mist">Licenza base a {BEATSTARS_LICENSE_PRICE}: scegli e acquisti direttamente sul nostro BeatStars.</span>
              </span>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-white">Apri BeatStars ↗</span>
            </a>
          )}
        </section>

        {/* 2 · Quantità */}
        <section aria-labelledby="step-quantita">
          <p className="eyebrow">02 · Quantità</p>
          <h2 id="step-quantita" className={cn(stepTitle, "mt-3")}>
            Quant{service.unit.one === "ora" ? "e ore" : "i"}?
          </h2>
          <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="step-quantita">
            {Array.from({ length: maxUnits }, (_, i) => i + 1).map((n) => {
              const q = quote(service, n);
              const active = n === units;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setUnits(n)}
                  className={cn(
                    "press flex min-w-[6.5rem] flex-col items-start rounded-2xl border px-4 py-3 text-left transition-colors",
                    active ? "border-white bg-white text-obsidian" : "border-white/15 text-white hover:border-white/50",
                  )}
                >
                  <span className="font-display text-2xl leading-none">{unitLabel(service, n)}</span>
                  <span className={cn("mt-1 font-mono text-xs", active ? "text-obsidian/70" : "text-mist")}>
                    {formatEuro(q.totalCents)}
                    {q.discountPercent > 0 && ` · −${q.discountPercent}%`}
                  </span>
                </button>
              );
            })}
          </div>
          {inStudio && service.showDuration && (
            <p className="mt-4 text-sm text-mist">Blocco unico in studio da {formatDuration(minutes)}.</p>
          )}
        </section>

        {/* 3 · Data e ora */}
        {inStudio && (
          <section aria-labelledby="step-quando">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">03 · Data e ora</p>
                <h2 id="step-quando" className={cn(stepTitle, "mt-3")}>
                  Quando?
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => movePage(-1)}
                  disabled={pageStart <= today}
                  className="press flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white disabled:opacity-30"
                  aria-label="Settimana precedente"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => movePage(1)}
                  disabled={addDays(pageStart, DAYS_PER_PAGE) > lastDay}
                  className="press flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white disabled:opacity-30"
                  aria-label="Settimana successiva"
                >
                  →
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2" role="tablist" aria-label="Giorno">
              {pageDays.map((d) => {
                const l = dayLabel(d);
                const free = (slotsByDay[d] ?? []).filter((s) => s.state === "libero").length;
                const active = d === day;
                const loaded = availability.status === "ready";
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDay(d)}
                    className={cn(
                      "press flex flex-col items-center rounded-2xl border px-1 py-3 transition-colors",
                      active ? "border-white bg-white text-obsidian" : "border-white/12 text-white hover:border-white/40",
                      loaded && free === 0 && !active && "opacity-40",
                    )}
                  >
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em]">{l.weekday}</span>
                    <span className="font-display text-2xl leading-none">{l.num}</span>
                    <span className="font-mono text-[0.6rem] uppercase">{l.month}</span>
                    <span className={cn("mt-1 font-mono text-[0.6rem]", active ? "text-obsidian/70" : "text-mist")}>{loaded ? (free ? `${free} liberi` : "pieno") : "…"}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6" role="tabpanel" aria-live="polite">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm capitalize text-white">{dayLabel(day).long}</p>
                <div className="flex items-center gap-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm border border-white/50" aria-hidden="true" /> Libero
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-white/10" aria-hidden="true" /> Occupato
                  </span>
                </div>
              </div>

              {availability.status === "loading" && <p className="text-sm text-mist">Carico il calendario aggiornato…</p>}
              {availability.status === "error" && (
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-sm text-mist">
                  <p>{availability.message}.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" className={buttonStyles.small} onClick={() => setReloadKey((k) => k + 1)}>
                      Riprova
                    </button>
                    {wa && (
                      <a className="text-white underline underline-offset-4" href={wa} target="_blank" rel="noopener noreferrer">
                        Prenota su WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}
              {availability.status === "ready" &&
                (visibleSlots.length === 0 ? (
                  <p className="text-sm text-mist">Nessun orario prenotabile in questo giorno: prova un altro giorno.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {visibleSlots.map((s) => {
                      const free = s.state === "libero";
                      const active = s.start === slotStart;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          disabled={!free}
                          aria-pressed={active}
                          aria-label={`${s.label} ${free ? "libero" : "occupato"}`}
                          onClick={() => setSlotStart(s.start)}
                          className={cn(
                            "press rounded-xl border px-2 py-3 font-mono text-sm transition-colors",
                            active && "border-white bg-white text-obsidian",
                            !active && free && "border-white/40 text-white hover:border-white",
                            !free && "cursor-not-allowed border-transparent bg-white/[0.06] text-mist/50 line-through",
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              <p className="mt-3 text-xs text-mist/80">
                Gli orari barrati sono già occupati (o il blocco da {formatDuration(minutes)} non ci sta). Il calendario si aggiorna in tempo reale.
              </p>
            </div>
          </section>
        )}

        {/* 4 · Dati */}
        <section aria-labelledby="step-dati">
          <p className="eyebrow">{inStudio ? "04" : "03"} · I tuoi dati</p>
          <h2 id="step-dati" className={cn(stepTitle, "mt-3")}>
            Chi sei?
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="co-nome" className={labelClass}>
                Nome / Nome d&apos;arte *
              </label>
              <input id="co-nome" name="nome" required minLength={2} maxLength={80} autoComplete="name" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="co-email" className={labelClass}>
                Email *
              </label>
              <input id="co-email" name="email" type="email" required maxLength={120} autoComplete="email" className={fieldClass} placeholder="Per la conferma" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-tel" className={labelClass}>
                Telefono {payment === "contanti" && canPayCash ? "*" : ""}
              </label>
              <input
                id="co-tel"
                name="telefono"
                type="tel"
                maxLength={30}
                autoComplete="tel"
                required={payment === "contanti" && canPayCash}
                className={fieldClass}
                placeholder="Per contattarti se serve"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-note" className={labelClass}>
                Note sul progetto
              </label>
              <textarea id="co-note" name="note" rows={3} maxLength={450} className={cn(fieldClass, "resize-y")} placeholder="Genere, reference, quante persone porti…" />
            </div>
            {/* Campo trappola per i bot: invisibile alle persone */}
            <div aria-hidden="true" className="hidden">
              <label htmlFor="co-sito">Sito</label>
              <input id="co-sito" name="sito" tabIndex={-1} autoComplete="off" />
            </div>
          </div>
        </section>

        {/* 5 · Pagamento */}
        <section aria-labelledby="step-pagamento">
          <p className="eyebrow">{inStudio ? "05" : "04"} · Pagamento</p>
          <h2 id="step-pagamento" className={cn(stepTitle, "mt-3")}>
            Come paghi?
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="step-pagamento">
            <PayOption
              active={payment === "online" || !canPayCash}
              onSelect={() => setPayment("online")}
              title="Online"
              text="Carta, PayPal, Apple Pay o Google Pay. Pagamento sicuro con Stripe."
            />
            <PayOption
              active={payment === "contanti" && canPayCash}
              disabled={!canPayCash}
              onSelect={() => setPayment("contanti")}
              title="Contanti in studio"
              text={!service.cashAllowed ? "Non disponibile per i servizi a distanza." : "Prenoti ora e paghi il giorno della sessione."}
            />
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-mist">
            <input type="checkbox" name="privacy" required className="mt-1 h-4 w-4 accent-white" />
            <span>
              Ho letto l&apos;
              <Link href="/privacy" className="text-white underline underline-offset-4" target="_blank">
                informativa privacy
              </Link>{" "}
              e acconsento al trattamento dei miei dati per gestire la prenotazione. *
            </span>
          </label>
        </section>
      </div>

      {/* Riepilogo */}
      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Riepilogo">
        <div className="rounded-3xl border border-white/10 bg-titanium/80 p-6 sm:p-8">
          <p className="eyebrow">Riepilogo</p>
          <p className="mt-4 font-display text-3xl leading-tight text-white">{service.title}</p>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-mist">Quantità</dt>
              <dd className="text-white">{unitLabel(service, units)}</dd>
            </div>
            {inStudio && (
              <div className="flex justify-between gap-4">
                <dt className="text-mist">Quando</dt>
                <dd className="text-right capitalize text-white">{selectedLabel ? `${selectedLabel.day}, ${selectedLabel.time}` : "da scegliere"}</dd>
              </div>
            )}
            {price.discountPercent > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-mist">Sconto −{price.discountPercent}%</dt>
                <dd className="text-white">
                  <s className="mr-2 text-mist">{formatEuro(price.fullCents)}</s>−{formatEuro(price.savingCents)}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
              <dt className="text-mist">Totale</dt>
              <dd className="font-display text-4xl text-white">
                {formatEuro(price.totalCents)}
              </dd>
            </div>
          </dl>

          {error && (
            <p className="mt-5 rounded-xl border border-white/20 bg-white/[0.06] p-3 text-sm text-white" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className={cn(buttonStyles.primary, "mt-6 w-full disabled:opacity-60")}>
            {submitting ? "Un attimo…" : payment === "contanti" && canPayCash ? "Conferma prenotazione" : "Vai al pagamento →"}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-mist/80">
            {payment === "contanti" && canPayCash
              ? "Lo slot viene riservato subito: porta i contanti il giorno della sessione."
              : "Sarai portato sulla pagina di pagamento sicura di Stripe. Lo slot resta bloccato per te per 30 minuti."}
          </p>
        </div>
      </aside>

      <dialog
        ref={passDialog}
        data-lenis-prevent
        aria-labelledby="pass-title"
        className="m-auto w-[min(100%-2rem,56rem)] max-h-[92dvh] overflow-y-auto rounded-3xl border border-white/10 bg-titanium/95 p-0 text-mist shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop:bg-black/70"
        onClick={(e) => {
          if (e.target === passDialog.current) passDialog.current?.close();
        }}
      >
        <div className="p-6 sm:p-10">
          <p className="eyebrow">Prima di pagare · Solo da qui −{PASS_CHECKOUT_EXTRA_DISCOUNT}% ogni mese</p>
          <h2 id="pass-title" className="mt-3 font-display text-4xl leading-none text-white sm:text-5xl">
            Fallo diventare un <em className="chrome-text">Pass</em>
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-mist">
            Invece di {formatEuro(price.totalCents)} una volta, attiva il Backrooms Pass: la sessione che hai scelto diventa la prima del mese e ogni mese hai di
            nuovo sessioni, beat e mix. {PASS_PERKS.join(" · ")}. Il Pass si paga online, con rinnovo automatico.
          </p>
          <div className={cn("mt-8 grid gap-4", eligiblePasses.length === 2 && "md:grid-cols-2", eligiblePasses.length >= 3 && "md:grid-cols-3")}>
            {eligiblePasses.map((p) => (
              <PassCard key={p.id} pass={p} onChoose={() => choosePass(p.id)} disabled={submitting} />
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
            <p className="text-sm text-mist">
              Oppure continua con {service.title.toLowerCase()} ({unitLabel(service, units)}) a {formatEuro(price.totalCents)}.
            </p>
            <button type="button" onClick={() => choosePass(null)} disabled={submitting} className={buttonStyles.ghost}>
              No grazie, continua
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}

function PassCard({ pass, onChoose, disabled }: { pass: Pass; onChoose: () => void; disabled: boolean }) {
  const monthly = passCheckoutCents(pass);
  return (
    <article className={cn("relative flex flex-col rounded-2xl border p-5", pass.recommended ? "border-white bg-white/[0.06]" : "border-white/15")}>
      {pass.recommended && (
        <span className="absolute -top-3 left-5 rounded-full bg-white px-3 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-obsidian">Consigliato</span>
      )}
      <h3 className="font-display text-3xl text-white">{pass.title}</h3>
      <p className="text-sm text-mist">{pass.tagline}</p>
      <ul className="mt-4 grid gap-1.5 text-sm text-white/90">
        {(Object.keys(pass.includes) as PassUnit[]).map((k) => (
          <li key={k}>
            {pass.includes[k]} {pass.includes[k] === 1 ? PASS_UNIT_LABELS[k].one : PASS_UNIT_LABELS[k].many}
          </li>
        ))}
      </ul>
      <p className="mt-5 font-display text-4xl text-white">
        {formatEuro(monthly)}
        <span className="font-sans text-sm text-mist">/mese</span>
      </p>
      <p className="text-xs text-mist">
        <s>{formatEuro(pass.monthlyCents)}</s> · valore {formatEuro(pass.valueCents)}
      </p>
      <button type="button" onClick={onChoose} disabled={disabled} className={cn(buttonStyles.small, "mt-5 w-full")}>
        Attiva {pass.title}
      </button>
    </article>
  );
}

function PayOption({ active, disabled, onSelect, title, text }: { active: boolean; disabled?: boolean; onSelect: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "press flex flex-col gap-1 rounded-2xl border p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "border-white bg-white/[0.08]" : "border-white/12 hover:border-white/40",
      )}
    >
      <span className="font-display text-2xl text-white">{title}</span>
      <span className="text-sm text-mist">{text}</span>
    </button>
  );
}
