import { BookingTrigger } from "@/components/BookingModal";
import { KineticText, Reveal } from "@/components/Reveal";
import { ScrollText } from "@/components/ScrollText";
import { TiltCard } from "@/components/TiltCard";
import { gear, services } from "@/lib/content";

function Screw() {
  return (
    <span aria-hidden="true" className="relative block h-3 w-3 rounded-full bg-gradient-to-br from-white/40 to-white/5 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]">
      <span className="absolute left-1/2 top-1/2 h-px w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-obsidian/80" />
    </span>
  );
}

function Leds({ active }: { active: number }) {
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={
            i < active
              ? i >= 4
                ? "h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_#FFB000]"
                : "h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_#45A29E]"
              : "h-1.5 w-1.5 rounded-full bg-white/10"
          }
        />
      ))}
    </span>
  );
}

export function Services() {
  return (
    <section id="servizi" aria-labelledby="servizi-title" className="relative py-24 sm:py-32">
      <ScrollText lines={["Registrazione", "Mix & Mastering", "Produzione"]} className="-mb-10 sm:-mb-24" />

      {/* Luci colorate che il vetro "rifrange" */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-[30%] h-80 w-80 rounded-full bg-gold/20 blur-[100px]" />
        <div className="absolute right-[6%] top-[55%] h-96 w-96 rounded-full bg-signal/25 blur-[110px]" />
      </div>

      <div className="container-x relative">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Servizi & Gear Rack</p>
            <KineticText id="servizi-title" text="Quattro rack. *Un solo* standard." className="mt-5 text-[clamp(2.6rem,6vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              Ogni servizio del nostro studio di registrazione a Vicenza è un modulo della stessa catena: dalla ripresa al master,
              nessun passaggio viene delegato o esternalizzato.
            </p>
          </Reveal>
        </div>

        <ul className="mt-16 grid gap-6 md:grid-cols-2">
          {services.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={(i % 2) * 0.1} className="h-full">
                <TiltCard className="flex flex-col">
                  <article className="flex h-full flex-col p-7 sm:p-9" aria-labelledby={`svc-${s.id}`}>
                    {/* Orecchie del rack */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Screw />
                        <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-signal">
                          {s.unit} · {s.kicker}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Leds active={3 + (i % 3)} />
                        <Screw />
                      </div>
                    </div>

                    <h3 id={`svc-${s.id}`} className="mt-10 font-display text-4xl leading-[1] text-white sm:text-5xl">
                      {s.title}
                    </h3>
                    <p className="mt-5 text-[0.95rem] leading-relaxed text-mist">{s.description}</p>

                    <ul className="mt-6 grid gap-2.5">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-3 text-sm text-white/90">
                          <span aria-hidden="true" className="h-px w-5 bg-gold" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto flex items-end justify-between gap-4 pt-10">
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mist">{s.kicker} · Vicenza</p>
                      <BookingTrigger
                        service={s.id}
                        className="rounded-full border border-white/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:border-gold hover:bg-gold hover:text-obsidian"
                      >
                        Prenota <span className="sr-only">{s.title}</span> →
                      </BookingTrigger>
                    </div>
                  </article>
                </TiltCard>
              </Reveal>
            </li>
          ))}
        </ul>

        {/* Outboard & Microfoni */}
        <Reveal className="mt-6">
          <TiltCard max={4}>
            <article className="p-7 sm:p-10" aria-labelledby="gear-title">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Screw />
                  <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-signal">U-05 · Outboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <Leds active={6} />
                  <Screw />
                </div>
              </div>
              <div className="mt-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <h3 id="gear-title" className="font-display text-5xl leading-none text-white sm:text-6xl">
                  Outboard <em className="text-gradient-gold">&amp;</em> Microfoni
                </h3>
                <p className="max-w-md text-sm leading-relaxed text-mist">
                  La catena analogica che fa la differenza tra &ldquo;registrato&rdquo; e &ldquo;prodotto&rdquo;. Tutto calibrato,
                  cablato e pronto a suonare.
                </p>
              </div>

              <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
                {gear.map((group) => (
                  <div key={group.category} className="bg-obsidian/80 p-6">
                    <h4 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-gold">{group.category}</h4>
                    <ul className="mt-5 grid gap-4">
                      {group.items.map((item) => (
                        <li key={item.name} className="group/item">
                          <span className="flex items-center gap-2 text-[0.95rem] font-semibold text-white">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal transition-colors group-hover/item:bg-gold" />
                            {item.name}
                          </span>
                          <span className="ml-3.5 block text-xs text-mist">{item.note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  );
}
