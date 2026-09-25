import { BookingTrigger } from "@/components/BookingModal";
import { KineticText, Reveal } from "@/components/Reveal";
import { ScrollText } from "@/components/ScrollText";
import { TiltCard } from "@/components/TiltCard";
import { services } from "@/lib/content";
import { cn } from "@/lib/cn";

const MODE_STYLE: Record<string, string> = {
  "In studio": "border-white/30 text-white",
  "A distanza": "border-white/20 text-mist",
  "Su misura": "chrome-surface border-transparent text-obsidian",
};

export function Services() {
  return (
    <section id="servizi" aria-labelledby="servizi-title" className="relative py-20 sm:py-32">
      <ScrollText lines={["Registrazione", "Produzione", "Mix & Master"]} className="-mb-8 sm:-mb-24" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-[30%] h-80 w-80 rounded-full bg-white/[0.07] blur-[100px]" />
        <div className="absolute right-[6%] top-[60%] h-96 w-96 rounded-full bg-white/[0.05] blur-[110px]" />
      </div>

      <div className="container-x relative">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Servizi · Modulari e personalizzabili</p>
            <KineticText id="servizi-title" text="Mix e Master, produzione e *registrazione a Vicenza*." className="mt-5 max-w-4xl text-[clamp(2.3rem,5.5vw,5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              In studio ad Arcugnano o a distanza, ovunque tu sia: scegli il singolo servizio o combinali in un pacchetto su misura per
              il tuo progetto.
            </p>
          </Reveal>
        </div>

        <ul className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
          {services.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={(i % 3) * 0.08} className="h-full">
                <TiltCard className="flex flex-col">
                  <article className="flex h-full flex-col p-6 sm:p-8" aria-labelledby={`svc-${s.id}`}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-[0.7rem] text-mist">{String(i + 1).padStart(2, "0")}</span>
                      <span className={cn("rounded-full border px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em]", MODE_STYLE[s.mode])}>
                        {s.mode}
                      </span>
                    </div>

                    <h3 id={`svc-${s.id}`} className="mt-8 font-display text-[2.1rem] leading-[1] text-white sm:text-[2.6rem]">
                      {s.title}
                    </h3>
                    <p className="mt-4 text-[0.95rem] leading-relaxed text-mist">{s.description}</p>

                    <ul className="mt-5 grid gap-2.5">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-3 text-sm text-white/90">
                          <span aria-hidden="true" className="h-px w-5 bg-gradient-to-r from-white to-white/30" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-8">
                      <BookingTrigger
                        service={s.id}
                        className="press inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/25 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:border-white hover:bg-white hover:text-obsidian sm:w-auto"
                      >
                        Richiedi <span className="sr-only">{s.title}</span> →
                      </BookingTrigger>
                    </div>
                  </article>
                </TiltCard>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
