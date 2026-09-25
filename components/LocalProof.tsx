"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { KineticText, Marquee, Reveal } from "@/components/Reveal";
import { proofPoints } from "@/lib/content";
import { studio } from "@/lib/studio";

function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, reduce, to]);

  return (
    <span ref={ref}>
      {value.toFixed(decimals).replace(".", ",")}
      {suffix}
    </span>
  );
}

const ICONS = [
  // Acustica: diffusore a pannelli
  <svg key="a" viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <rect x="6" y="6" width="36" height="36" rx="3" />
    <path d="M14 6v36M22 6v36M30 6v36M38 6v36" opacity=".5" />
    <path d="M6 18h8M14 28h8M22 14h8M30 32h8" />
  </svg>,
  // Preamp valvolare
  <svg key="b" viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M18 40V20a6 6 0 0 1 12 0v20" />
    <path d="M14 40h20M20 26h8M24 20v12" />
    <path d="M24 10c-3 0-4-3-4-4M24 10c3 0 4-3 4-4" opacity=".6" />
  </svg>,
  // Mastering: VU meter
  <svg key="c" viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <rect x="4" y="10" width="40" height="28" rx="3" />
    <path d="M10 32a14 14 0 0 1 28 0" />
    <path d="M24 32l7-11" strokeLinecap="round" />
    <path d="M12 26l2 1M16 21l1.5 1.5M24 18v2M32 21l-1.5 1.5M36 26l-2 1" opacity=".6" />
  </svg>,
];

export function LocalProof() {
  return (
    <section id="studio" aria-labelledby="studio-title" className="relative py-24 sm:py-32">
      {/* Banner rating dinamico */}
      <div className="border-y border-white/10 bg-titanium/40 py-5">
        <Marquee
          className="font-display text-2xl italic text-white sm:text-3xl"
          items={[
            `${studio.rating.value.toFixed(1).replace(".", ",")} ★★★★★ su Google Reviews`,
            "Il primo studio a Vicenza",
            `${studio.rating.count}+ artisti del Veneto`,
            "Registrazione · Mix · Mastering",
            "Trap · Pop · Rock · Acoustic · Podcast",
          ]}
        />
      </div>

      <div className="container-x mt-20 grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <p className="eyebrow">Local proof · Vicenza</p>
          <KineticText id="studio-title" text="Lo studio che *Vicenza* ascolta." className="mt-5 text-[clamp(2.6rem,6vw,5.5rem)]" />
          <Reveal delay={0.15}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-mist">
              {studio.name} è lo studio di registrazione a Vicenza scelto da rapper, band, cantautori e podcaster di tutto il
              Veneto: da {studio.areaServed.slice(1, 5).join(", ")} fino a Padova e Verona. Tre professionisti, una sala progettata
              per suonare bene prima ancora di accendere un plugin.
            </p>
          </Reveal>

          <Reveal delay={0.25}>
            <a
              href={studio.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass mt-10 inline-flex items-center gap-6 rounded-3xl p-6 pr-10 transition-colors hover:border-gold/50"
              data-cursor="Google"
            >
              <span className="font-display text-7xl leading-none text-white">
                <CountUp to={studio.rating.value} decimals={1} />
              </span>
              <span>
                <span className="block text-xl tracking-[0.2em] text-gold" aria-hidden="true">
                  ★★★★★
                </span>
                <span className="mt-1 block text-sm font-semibold text-white">su Google Reviews</span>
                <span className="block font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mist">
                  <CountUp to={studio.rating.count} suffix="+" /> recensioni
                </span>
              </span>
              <span className="sr-only">
                Valutazione {studio.rating.value} su 5 basata su {studio.rating.count} recensioni Google. Apri su Google Maps.
              </span>
            </a>
          </Reveal>
        </div>

        <ul className="grid gap-5">
          {proofPoints.map((point, i) => (
            <li key={point.title}>
              <Reveal delay={i * 0.1}>
                <div className="group relative flex gap-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-titanium/70 to-obsidian-2 p-7 transition-colors duration-500 hover:border-signal/50">
                  <div
                    aria-hidden="true"
                    className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-signal/0 blur-3xl transition-colors duration-700 group-hover:bg-signal/20"
                  />
                  <div className="shrink-0 text-gold">{ICONS[i]}</div>
                  <div className="relative">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-signal">0{i + 1}</p>
                    <h3 className="mt-2 font-display text-3xl leading-tight text-white">{point.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-mist">{point.text}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
