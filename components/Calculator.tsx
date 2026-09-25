"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { useBooking, WhatsAppIcon } from "@/components/BookingModal";
import { KineticText, Reveal } from "@/components/Reveal";
import { pricing, type AddOnId } from "@/lib/content";
import { buttonStyles, cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format";
import { mailtoLink, studio, whatsappLink } from "@/lib/studio";

const PLURALS: Record<string, string> = { brano: "brani", episodio: "episodi" };

function pluralUnit(unit: string, qty: number): string {
  return qty === 1 ? unit : (PLURALS[unit] ?? unit);
}

const HOUR_PRESETS = [2, 4, 8, 20];
const MAX_HOURS = 40;
const MAX_QTY = 20;

function AnimatedEuro({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(display, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1], onUpdate: setDisplay });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return <span className={className}>{formatEuro(display)}</span>;
}

function Stepper({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg text-white transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center gap-2" role="group" aria-labelledby={id}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Rimuovi un'unità: ${label}`}>
        −
      </button>
      <output className="w-7 text-center font-mono text-base text-white" aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(Math.min(MAX_QTY, value + 1))} disabled={value === MAX_QTY} aria-label={`Aggiungi un'unità: ${label}`}>
        +
      </button>
    </div>
  );
}

export function Calculator() {
  const { open } = useBooking();
  const [hours, setHours] = useState(4);
  const [qty, setQty] = useState<Record<AddOnId, number>>({
    editing: 1,
    mix: 1,
    "master-digital": 0,
    "master-analog": 1,
    beat: 0,
    podcast: 0,
  });

  const quote = useMemo(() => {
    const hoursBase = hours * pricing.hourlyRate;
    const discount = pricing.hourDiscounts.find((d) => hours >= d.minHours);
    const hoursDiscount = discount ? hoursBase * discount.rate : 0;
    const lines = pricing.addOns
      .filter((a) => qty[a.id] > 0)
      .map((a) => ({ ...a, qty: qty[a.id], total: a.price * qty[a.id] }));
    const addOnsTotal = lines.reduce((sum, l) => sum + l.total, 0);
    const total = hoursBase - hoursDiscount + addOnsTotal;
    return { hoursBase, discount, hoursDiscount, lines, total };
  }, [hours, qty]);

  const summaryText = useMemo(() => {
    const rows = [
      `Ciao ${studio.name}! Ho calcolato un preventivo dal sito:`,
      "",
      `• Studio con tecnico: ${hours} ${hours === 1 ? "ora" : "ore"} (${formatEuro(quote.hoursBase)})`,
      quote.discount ? `• Sconto ${quote.discount.label}: −${formatEuro(quote.hoursDiscount)}` : null,
      ...quote.lines.map((l) => `• ${l.label}: ${l.qty} ${pluralUnit(l.unit, l.qty)} (${formatEuro(l.total)})`),
      "",
      `Totale indicativo: ${formatEuro(quote.total)}`,
      "",
      "Vorrei confermare disponibilità e dettagli.",
    ].filter((r): r is string => r !== null);
    return rows.join("\n");
  }, [hours, quote]);

  const fill = (hours / MAX_HOURS) * 100;

  return (
    <section id="preventivo" aria-labelledby="preventivo-title" className="relative py-24 sm:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Preventivo in tempo reale</p>
            <KineticText id="preventivo-title" text="Il tuo progetto, *al centesimo*." className="mt-5 text-[clamp(2.6rem,6vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              Scegli ore di studio e servizi: il prezzo si aggiorna mentre muovi i comandi. Nessun costo nascosto, nessuna sorpresa a
              fine sessione.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* Controlli */}
          <Reveal>
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-titanium/60 to-obsidian-2 p-6 sm:p-10">
              <fieldset>
                <legend className="flex w-full flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="font-display text-3xl text-white">Ore di studio</span>
                  <span className="font-mono text-sm text-mist">{formatEuro(pricing.hourlyRate)}/ora · tecnico incluso</span>
                </legend>
                <div className="mt-8 flex items-center gap-6">
                  <label htmlFor="hours" className="sr-only">
                    Numero di ore di studio
                  </label>
                  <input
                    id="hours"
                    type="range"
                    min={0}
                    max={MAX_HOURS}
                    step={1}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="range-studio flex-1"
                    style={{ ["--fill" as string]: `${fill}%` }}
                    aria-valuetext={`${hours} ore`}
                  />
                  <output htmlFor="hours" className="w-20 text-right font-display text-5xl leading-none text-gold">
                    {hours}
                    <span className="ml-1 font-sans text-base text-mist">h</span>
                  </output>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {HOUR_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHours(h)}
                      aria-pressed={hours === h}
                      className={cn(
                        "rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] transition-colors",
                        hours === h ? "border-gold bg-gold text-obsidian" : "border-white/15 text-mist hover:border-white/40 hover:text-white",
                      )}
                    >
                      {h}h{h === 8 ? " · giornata" : h === 20 ? " · pacchetto" : ""}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-mist">
                  Sconto automatico: −10% da 8 ore, −15% da 20 ore di studio.
                </p>
              </fieldset>

              <div className="hairline my-10" />

              <fieldset>
                <legend className="font-display text-3xl text-white">Servizi di post-produzione</legend>
                <ul className="mt-6 divide-y divide-white/10">
                  {pricing.addOns.map((a) => {
                    const labelId = `addon-${a.id}`;
                    const active = qty[a.id] > 0;
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                          <p id={labelId} className={cn("font-semibold transition-colors", active ? "text-white" : "text-mist")}>
                            {a.label}
                          </p>
                          <p className="font-mono text-xs text-mist">
                            {formatEuro(a.price)} / {a.unit}
                          </p>
                        </div>
                        <Stepper id={labelId} label={a.label} value={qty[a.id]} onChange={(v) => setQty((q) => ({ ...q, [a.id]: v }))} />
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
          </Reveal>

          {/* Riepilogo */}
          <Reveal delay={0.1} className="self-start lg:sticky lg:top-28">
            <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
              <p className="eyebrow relative">Riepilogo sessione</p>

              <dl className="relative mt-8 grid gap-3 font-mono text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-mist">
                    Studio · {hours} {hours === 1 ? "ora" : "ore"}
                  </dt>
                  <dd className="text-white">{formatEuro(quote.hoursBase)}</dd>
                </div>
                {quote.discount && (
                  <div className="flex justify-between gap-4 text-signal-bright">
                    <dt>{quote.discount.label}</dt>
                    <dd>−{formatEuro(quote.hoursDiscount)}</dd>
                  </div>
                )}
                {quote.lines.map((l) => (
                  <div key={l.id} className="flex justify-between gap-4">
                    <dt className="text-mist">
                      {l.label} × {l.qty}
                    </dt>
                    <dd className="text-white">{formatEuro(l.total)}</dd>
                  </div>
                ))}
              </dl>

              <div className="hairline relative my-8" />

              <div className="relative flex items-end justify-between gap-4">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-mist">Totale indicativo</p>
                <p aria-live="polite" aria-atomic="true">
                  <AnimatedEuro value={quote.total} className="font-display text-6xl leading-none text-white sm:text-7xl" />
                </p>
              </div>
              <p className="relative mt-4 text-xs leading-relaxed text-mist">{pricing.vatNote}</p>

              <div className="relative mt-8 grid gap-3">
                <a
                  href={whatsappLink(summaryText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonStyles.primary, "w-full")}
                  data-cursor="Invia"
                >
                  <WhatsAppIcon />
                  Conferma e invia su WhatsApp
                </a>
                <a href={mailtoLink("Preventivo dal sito", summaryText)} className={cn(buttonStyles.ghost, "w-full")}>
                  Invia via Email
                </a>
                <button
                  type="button"
                  onClick={() => open({ notes: summaryText })}
                  className="mt-1 text-center text-xs font-semibold uppercase tracking-[0.16em] text-mist underline-offset-4 transition-colors hover:text-gold hover:underline"
                >
                  Oppure prenota con data e orario →
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
