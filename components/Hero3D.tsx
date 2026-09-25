"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useRef, useState } from "react";
import { BookingTrigger } from "@/components/BookingModal";
import { Magnetic } from "@/components/Magnetic";
import { buttonStyles, cn } from "@/lib/cn";
import { studio } from "@/lib/studio";

// La scena WebGL viene caricata solo lato client e dopo il primo paint:
// il testo (LCP) resta server-rendered e immediato, three.js non blocca il main thread iniziale.
const WaveformScene = dynamic(() => import("@/components/three/WaveformScene"), { ssr: false });

const HEADLINE_LINE_1 = ["Il", "suono", "di", "livello", "mondiale,"];
const HEADLINE_LINE_2 = ["nel", "cuore", "di"];

/**
 * Monta la scena 3D alla prima interazione reale dell'utente (movimento del mouse, tocco, scroll, tastiera).
 * Su desktop avviene di fatto subito (basta muovere il mouse), ma three.js resta fuori dal percorso critico:
 * zero Total Blocking Time al caricamento e LCP immediato sul testo.
 */
function useMountOnInteraction(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const events = ["pointermove", "pointerdown", "touchstart", "wheel", "scroll", "keydown"] as const;
    const trigger = () => {
      setReady(true);
      events.forEach((e) => window.removeEventListener(e, trigger));
    };
    events.forEach((e) => window.addEventListener(e, trigger, { once: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, trigger));
  }, []);
  return ready;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Hero3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const mountReady = useMountOnInteraction();
  const [webgl, setWebgl] = useState(false);
  const [inView, setInView] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setWebgl(supportsWebGL());
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setCompact(window.matchMedia("(max-width: 767px)").matches);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  let wordIndex = 0;

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pb-14 pt-32 sm:pb-20"
    >
      {/* Poster statico: visibile subito, fa da fallback se WebGL non è disponibile */}
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        <div className="absolute left-1/2 top-[58%] h-[60vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,176,0,0.18),rgba(69,162,158,0.10)_45%,transparent_75%)] blur-2xl motion-safe:animate-pulse" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,var(--color-obsidian),transparent)]" />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 transition-opacity duration-[2000ms] ease-[var(--ease-expo)]"
        style={{ opacity: canvasReady ? 1 : 0 }}
      >
        {mountReady && webgl ? (
          <WaveformScene eventSource={sectionRef} active={inView} reduced={reduced} compact={compact} onReady={() => setCanvasReady(true)} />
        ) : null}
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,transparent_30%,rgba(11,12,16,0.85)_85%)]" />

      <div className="container-x relative">
        <div className="fade-up mb-8 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "50ms" }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
          </span>
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-mist">
            Sessioni aperte · {studio.address.city} ({studio.address.province})
          </span>
        </div>

        <h1 id="hero-title" className="text-white">
          <span className="fade-up eyebrow mb-6 block text-gold" style={{ ["--d" as string]: "80ms" }}>
            Studio di registrazione a Vicenza
          </span>{" "}
          <span className="block font-sans max-w-[18ch] text-[clamp(2.5rem,6.4vw,6.6rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.035em]">
            {HEADLINE_LINE_1.map((w) => (
              <Fragment key={w}>
                <span className="kinetic-mask">
                  <span className="kinetic-word" style={{ ["--i" as string]: wordIndex++ }}>
                    {w}
                  </span>
                </span>{" "}
              </Fragment>
            ))}
            {HEADLINE_LINE_2.map((w) => (
              <Fragment key={w}>
                <span className="kinetic-mask">
                  <span className="kinetic-word" style={{ ["--i" as string]: wordIndex++ }}>
                    {w}
                  </span>
                </span>{" "}
              </Fragment>
            ))}
            <span className="kinetic-mask">
              <span
                className="kinetic-word font-display text-[1.12em] font-normal normal-case italic tracking-[-0.01em] text-gradient-gold pr-[0.08em]"
                style={{ ["--i" as string]: wordIndex++ }}
              >
                Vicenza.
              </span>
            </span>
          </span>
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <p className="fade-up max-w-xl text-base leading-relaxed text-mist sm:text-lg" style={{ ["--d" as string]: "700ms" }}>
            Acustica progettata su misura, catena analogica vintage e mastering ibrido: il tuo brano esce dallo studio pronto per
            Spotify, radio e club. <strong className="font-semibold text-white">Registrazione, mix e master in un unico posto</strong>, a
            10 minuti dal centro di Vicenza.
          </p>

          <div className="fade-up flex flex-col gap-4 sm:flex-row lg:justify-end" style={{ ["--d" as string]: "850ms" }}>
            <Magnetic>
              <BookingTrigger className={cn(buttonStyles.primary, "w-full sm:w-auto")}>
                <span className="relative z-10">Prenota una Sessione</span>
                <span aria-hidden="true" className="relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  →
                </span>
              </BookingTrigger>
            </Magnetic>
            <Magnetic>
              <a href="#ascolta" className={cn(buttonStyles.ghost, "w-full sm:w-auto")} data-cursor="Play">
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-current">
                  <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
                    <path d="M0 0l8 5-8 5z" />
                  </svg>
                </span>
                Ascolta i Nostri Master
              </a>
            </Magnetic>
          </div>
        </div>

        <div className="fade-up mt-16 flex items-center justify-between border-t border-white/10 pt-6" style={{ ["--d" as string]: "1000ms" }}>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-mist">
            <span className="text-gold">★ {studio.rating.value.toFixed(1)}</span> su Google · {studio.rating.count}+ recensioni
          </p>
          <a href="#studio" className="hidden items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-mist transition-colors hover:text-gold sm:flex">
            Scopri lo studio
            <span aria-hidden="true" className="block h-8 w-px animate-pulse bg-gradient-to-b from-gold to-transparent" />
          </a>
        </div>
      </div>
    </section>
  );
}
