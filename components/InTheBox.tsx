import { KineticText, Reveal } from "@/components/Reveal";
import { itbBenefits, itbBrands } from "@/lib/content";

export function InTheBox() {
  return (
    <section id="tecnologia" aria-labelledby="itb-title" className="relative overflow-x-clip py-20 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.07),transparent)]" />

      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow">Tecnologia · 100% In-The-Box</p>
            <KineticText id="itb-title" text="Tutto dentro. *Zero compromessi.*" className="mt-5 text-[clamp(2.5rem,6.5vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-lg text-base leading-relaxed text-mist sm:text-lg">
              Il nostro workflow è interamente in-the-box: plugin, DSP e software d&apos;avanguardia di livello mondiale. Significa
              flessibilità assoluta, recall istantaneo, sonorità moderne e una velocità d&apos;esecuzione che mette la musica, non la
              tecnica, al centro della sessione.
            </p>
          </Reveal>
        </div>

        {/* Ecosistema software */}
        <Reveal className="mt-12 sm:mt-16">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/10 sm:grid-cols-5" aria-label="Software e plugin utilizzati">
            {itbBrands.map((brand, i) => (
              <li
                key={brand}
                className={
                  "group flex min-h-24 items-center justify-center bg-obsidian/90 px-4 py-8 text-center transition-colors duration-500 hover:bg-white/[0.04] sm:min-h-32" +
                  (i === itbBrands.length - 1 ? " col-span-2 sm:col-span-1" : "")
                }
              >
                <span className="chrome-text font-sans text-xl font-extrabold uppercase tracking-[-0.02em] sm:text-2xl">{brand}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {itbBenefits.map((b, i) => (
            <li key={b.title}>
              <Reveal delay={i * 0.08} className="h-full">
                <article className="chrome-border glass h-full rounded-[1.5rem] p-6 sm:p-7">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-mist">0{i + 1}</p>
                  <h3 className="mt-4 font-display text-3xl leading-tight text-white">{b.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{b.text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
