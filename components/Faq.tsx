import { KineticText, Reveal } from "@/components/Reveal";
import { faqs } from "@/lib/content";

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative py-24 sm:py-32">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
        <div>
          <p className="eyebrow">Domande frequenti</p>
          <KineticText id="faq-title" text="Tutto quello che *ti chiedi*." className="mt-5 text-[clamp(2.4rem,5vw,4.5rem)]" />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-mist">
              Prima volta in uno studio di registrazione? Nessun problema: ecco le risposte alle domande che ci fanno più spesso.
            </p>
          </Reveal>
        </div>

        <div className="divide-y divide-white/10 border-y border-white/10">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05} y={16}>
              <details className="faq-item group py-2">
                <summary className="flex items-center justify-between gap-6 py-5 text-left">
                  <h3 className="font-display text-2xl leading-snug text-white transition-colors group-hover:text-chrome sm:text-[1.7rem]">{f.q}</h3>
                  <span
                    aria-hidden="true"
                    className="faq-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl text-chrome transition-transform duration-500"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-base leading-relaxed text-mist">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
