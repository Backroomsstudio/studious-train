"use client";

import { motion, useReducedMotion } from "framer-motion";
import { KineticText, Marquee, Reveal } from "@/components/Reveal";
import { loungeFeatures, type LoungeIcon } from "@/lib/content";
import { cn } from "@/lib/cn";

const ICONS: Record<LoungeIcon, React.ReactNode> = {
  space: (
    <>
      <rect x="6" y="10" width="36" height="28" rx="2" />
      <path d="M6 18h8M34 30h8M20 10v6M28 38v-6" opacity=".6" />
    </>
  ),
  crew: (
    <>
      <circle cx="24" cy="16" r="5" />
      <circle cx="12" cy="20" r="4" opacity=".7" />
      <circle cx="36" cy="20" r="4" opacity=".7" />
      <path d="M14 38c0-6 4.5-10 10-10s10 4 10 10" />
      <path d="M4 36c0-4.5 3.5-8 8-8M44 36c0-4.5-3.5-8-8-8" opacity=".7" />
    </>
  ),
  tv: (
    <>
      <rect x="4" y="9" width="40" height="25" rx="2" />
      <path d="M18 40h12M24 34v6" />
      <path d="M2 13v17M46 13v17" opacity=".5" strokeDasharray="2 3" />
    </>
  ),
  console: (
    <>
      <path d="M14 16h20c5 0 8 4 9 9l1.5 7c.6 3-2.8 5.2-5 3.2L33 30H15l-6.5 5.2c-2.2 2-5.6-.2-5-3.2L5 25c1-5 4-9 9-9Z" />
      <path d="M14 21v6M11 24h6" />
      <circle cx="32" cy="22" r="1.4" />
      <circle cx="36" cy="26" r="1.4" />
    </>
  ),
  stream: (
    <>
      <rect x="6" y="10" width="36" height="24" rx="3" />
      <path d="M21 17v10l8-5-8-5Z" />
      <path d="M16 40h16" opacity=".6" />
    </>
  ),
  sofa: (
    <>
      <path d="M8 22v-5a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v5" />
      <path d="M4 26a4 4 0 0 1 8 0v4h24v-4a4 4 0 0 1 8 0v8H4v-8Z" />
      <path d="M8 34v4M40 34v4" />
    </>
  ),
  bar: (
    <>
      <path d="M10 14h20v14a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V14Z" />
      <path d="M30 18h3a5 5 0 0 1 0 10h-3" />
      <path d="M16 6c0 2 2 2 2 4M22 6c0 2 2 2 2 4" opacity=".6" />
      <path d="M8 42h24" />
    </>
  ),
};

function FeatureIcon({ name }: { name: LoungeIcon }) {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** Barra proporzionale mq: rende visivo il salto da ~30 a 65 mq. */
function SizeBar({ sqm, label, highlight }: { sqm: number; label: string; highlight?: boolean }) {
  const reduce = useReducedMotion();
  const pct = (sqm / 65) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={cn("text-sm", highlight ? "font-semibold text-white" : "text-mist")}>{label}</span>
        <span className={cn("font-display text-4xl leading-none", highlight ? "chrome-text" : "text-mist")}>
          {highlight ? "" : "~"}
          {sqm}
          <span className="ml-1 font-sans text-sm text-mist">mq</span>
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className={cn("h-full rounded-full", highlight ? "chrome-surface" : "bg-white/25")}
          initial={reduce ? false : { width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          style={reduce ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}

export function Lounge() {
  return (
    <section id="lounge" aria-labelledby="lounge-title" className="relative py-20 sm:py-32">
      <div className="border-y border-white/10 bg-titanium/40 py-4 sm:py-5">
        <Marquee
          className="font-display text-2xl italic text-white sm:text-3xl"
          items={["The First Italian Lounge Studio", "65 mq · stile americano", "Fino a 6 ospiti", "Aperto 24/7", "Arcugnano · Vicenza", "Live 4K"]}
        />
      </div>

      <div className="container-x mt-16 sm:mt-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div>
            <p className="eyebrow">Studio Lounge Experience</p>
            <KineticText id="lounge-title" text="Non uno studio. *Una Lounge.*" className="mt-5 text-[clamp(2.6rem,7vw,6rem)]" />
            <Reveal delay={0.15}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
                Dimentica le stanzette claustrofobiche e formali. Backrooms è il primo Studio Lounge di Vicenza: 65 mq concepiti come gli
                studi di registrazione americani, un unico grande ambiente dove musica, relax e convivialità vivono insieme.{" "}
                <strong className="font-semibold text-white">
                  Il punto di ritrovo dove fare musica, passare il tempo, creare networking e staccare la testa.
                </strong>
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="glass chrome-border rounded-[2rem] p-6 sm:p-9">
              <p className="eyebrow">Lo spazio, a confronto</p>
              <div className="mt-7 grid gap-7">
                <SizeBar sqm={30} label="Studio tradizionale italiano, spesso" />
                <SizeBar sqm={65} label="Backrooms Studio Lounge" highlight />
              </div>
              <div className="hairline my-7" />
              <ul className="grid gap-3 text-sm">
                <li className="flex gap-3 text-mist">
                  <span aria-hidden="true" className="text-white/40">—</span>
                  Altrove: sala stretta, la crew aspetta fuori.
                </li>
                <li className="flex gap-3 text-white">
                  <span aria-hidden="true" className="chrome-text font-bold">+</span>
                  Qui: fino a 6 persone con te, comode, dentro la sessione.
                </li>
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Feature: carosello swipe su mobile, griglia su desktop */}
        <ul
          className="no-scrollbar -mx-5 mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:mt-20 lg:grid-cols-4"
          aria-label="Cosa trovi nella Lounge"
        >
          {loungeFeatures.map((f, i) => (
            <li key={f.title} className={cn("w-[78vw] max-w-[20rem] shrink-0 snap-start sm:w-auto sm:max-w-none", i === 0 && "lg:col-span-2")}>
              <Reveal delay={(i % 4) * 0.08} className="h-full">
                <article className="chrome-border press group flex h-full flex-col rounded-[1.5rem] bg-gradient-to-b from-titanium/80 to-obsidian-2 p-6 transition-transform duration-500 sm:p-7 lg:hover:-translate-y-1.5">
                  <FeatureIcon name={f.icon} />
                  <h3 className="mt-6 font-display text-3xl leading-tight text-white">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{f.text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center font-mono text-[0.65rem] uppercase tracking-[0.24em] text-mist sm:hidden" aria-hidden="true">
          Scorri →
        </p>
      </div>
    </section>
  );
}
