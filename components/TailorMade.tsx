"use client";

import { useMemo, useState } from "react";
import { useBooking, WhatsAppIcon } from "@/components/BookingModal";
import { KineticText, Reveal } from "@/components/Reveal";
import { packageOptions, type HourOptionId, type TrackOptionId } from "@/lib/content";
import { buttonStyles, cn } from "@/lib/cn";
import { mailtoLink, studio, whatsappLink } from "@/lib/studio";

const MAX_HOURS = 40;
const MAX_TRACKS = 20;

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function Stepper({
  labelId,
  label,
  value,
  max,
  onChange,
}: {
  labelId: string;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "press flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-xl text-white transition-colors hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center gap-2" role="group" aria-labelledby={labelId}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Diminuisci: ${label}`}>
        −
      </button>
      <output className="w-8 text-center font-mono text-lg text-white" aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value === max} aria-label={`Aumenta: ${label}`}>
        +
      </button>
    </div>
  );
}

/**
 * Configuratore "Tailor-Made": l'artista compone il proprio monte ore e i brani da lavorare
 * e invia la richiesta già compilata. Nessun prezzo: i dettagli si concordano in privato.
 */
export function TailorMade() {
  const { open } = useBooking();
  const [hours, setHours] = useState<Record<HourOptionId, number>>({ rec: 4, prod: 0 });
  const [tracks, setTracks] = useState<Record<TrackOptionId, number>>({ "prod-remote": 0, "mix-studio": 1, "mix-remote": 0 });

  const lines = useMemo(() => {
    const h = packageOptions.hours.filter((o) => hours[o.id] > 0).map((o) => ({ label: o.label, value: `${hours[o.id]} ${plural(hours[o.id], "ora", "ore")}` }));
    const t = packageOptions.tracks
      .filter((o) => tracks[o.id] > 0)
      .map((o) => ({ label: o.label, value: `${tracks[o.id]} ${plural(tracks[o.id], "brano", "brani")}` }));
    return [...h, ...t];
  }, [hours, tracks]);

  const summaryText = useMemo(
    () =>
      [`Ciao ${studio.name}! Ho composto un pacchetto Tailor-Made dal sito:`, "", ...lines.map((l) => `• ${l.label}: ${l.value}`), "", "Vorrei sapere disponibilità e dettagli."].join(
        "\n",
      ),
    [lines],
  );

  const isEmpty = lines.length === 0;
  const wa = whatsappLink(summaryText);
  const mail = mailtoLink("Pacchetto Tailor-Made dal sito", summaryText);

  return (
    <section id="tailor-made" aria-labelledby="tailor-title" className="relative py-20 sm:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Pacchetti Tailor-Made</p>
            <KineticText id="tailor-title" text="Costruisci il tuo *pacchetto*." className="mt-5 text-[clamp(2.5rem,6vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              Singolo, EP o album: combina ore di registrazione e produzione con i brani da mixare e masterizzare. Ci arriva la tua
              richiesta già pronta e costruiamo insieme la sessione.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 lg:mt-14 lg:grid-cols-[1.35fr_1fr] lg:gap-6">
          <Reveal>
            <div className="chrome-border rounded-[2rem] bg-gradient-to-b from-titanium/80 to-obsidian-2 p-5 sm:p-10">
              <fieldset>
                <legend className="font-display text-3xl text-white">Ore in studio</legend>
                <div className="mt-6 grid gap-8">
                  {packageOptions.hours.map((o) => {
                    const fill = (hours[o.id] / MAX_HOURS) * 100;
                    return (
                      <div key={o.id}>
                        <div className="flex items-baseline justify-between gap-4">
                          <label htmlFor={`h-${o.id}`} className="font-semibold text-white">
                            {o.label}
                            <span className="block text-xs font-normal text-mist">{o.hint}</span>
                          </label>
                          <output htmlFor={`h-${o.id}`} className="font-display text-4xl leading-none text-white">
                            {hours[o.id]}
                            <span className="ml-1 font-sans text-sm text-mist">h</span>
                          </output>
                        </div>
                        <input
                          id={`h-${o.id}`}
                          type="range"
                          min={0}
                          max={MAX_HOURS}
                          step={1}
                          value={hours[o.id]}
                          onChange={(e) => setHours((h) => ({ ...h, [o.id]: Number(e.target.value) }))}
                          className="range-studio mt-4"
                          style={{ ["--fill" as string]: `${fill}%` }}
                          aria-valuetext={`${hours[o.id]} ore`}
                        />
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <div className="hairline my-8 sm:my-10" />

              <fieldset>
                <legend className="font-display text-3xl text-white">Brani da lavorare</legend>
                <ul className="mt-4 divide-y divide-white/10">
                  {packageOptions.tracks.map((o) => {
                    const labelId = `t-${o.id}`;
                    return (
                      <li key={o.id} className="flex items-center justify-between gap-4 py-4">
                        <p id={labelId} className={cn("font-semibold transition-colors", tracks[o.id] > 0 ? "text-white" : "text-mist")}>
                          {o.label}
                        </p>
                        <Stepper
                          labelId={labelId}
                          label={o.label}
                          value={tracks[o.id]}
                          max={MAX_TRACKS}
                          onChange={(v) => setTracks((t) => ({ ...t, [o.id]: v }))}
                        />
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="self-start lg:sticky lg:top-28">
            <div className="glass chrome-border relative overflow-hidden rounded-[2rem] p-5 sm:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <p className="eyebrow relative">Il tuo pacchetto</p>

              <ul className="relative mt-6 grid gap-3 font-mono text-sm" aria-live="polite">
                {lines.map((l) => (
                  <li key={l.label} className="flex justify-between gap-4">
                    <span className="text-mist">{l.label}</span>
                    <span className="shrink-0 text-white">{l.value}</span>
                  </li>
                ))}
                {isEmpty && <li className="text-mist">Aggiungi ore o brani per comporre il pacchetto.</li>}
              </ul>

              <div className="hairline relative my-8" />

              <p className="relative font-display text-3xl leading-tight text-white sm:text-4xl">
                Su misura, <em className="chrome-text">come il tuo suono</em>.
              </p>

              <div className="relative mt-8 grid gap-3">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonStyles.primary, "w-full", isEmpty && "pointer-events-none opacity-40")}
                    aria-disabled={isEmpty}
                    tabIndex={isEmpty ? -1 : undefined}
                    data-cursor="Invia"
                  >
                    <WhatsAppIcon />
                    Invia su WhatsApp
                  </a>
                )}
                {mail && (
                  <a
                    href={mail}
                    className={cn(wa ? buttonStyles.ghost : buttonStyles.primary, "w-full", isEmpty && "pointer-events-none opacity-40")}
                    aria-disabled={isEmpty}
                    tabIndex={isEmpty ? -1 : undefined}
                  >
                    Invia via Email
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => open({ service: "tailor-made", notes: summaryText })}
                  className={cn(wa || mail ? "press mt-1 min-h-11 text-center text-xs font-semibold uppercase tracking-[0.16em] text-mist underline-offset-4 transition-colors hover:text-white hover:underline" : cn(buttonStyles.primary, "w-full"))}
                >
                  {wa || mail ? "Oppure prenota con data e orario →" : "Prenota con data e orario →"}
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
