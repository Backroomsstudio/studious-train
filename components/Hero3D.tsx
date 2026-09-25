"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useRef, useState } from "react";
import { BookingTrigger } from "@/components/BookingModal";
import { Magnetic } from "@/components/Magnetic";
import { buttonStyles, cn } from "@/lib/cn";
import { heroFacts } from "@/lib/content";
import { studio } from "@/lib/studio";

// La scena WebGL viene caricata solo lato client e dopo il primo paint:
// il testo (LCP) resta server-rendered e immediato, three.js non blocca il main thread iniziale.
const WaveformScene = dynamic(() => import("@/components/three/WaveformScene"), { ssr: false });

const HEADLINE = ["Il", "primo", "Studio"];

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
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pb-10 pt-28 sm:pb-20 sm:pt-32"
    >
      {/* Poster statico: visibile subito, fa da fallback se WebGL non è disponibile */}
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        <div className="absolute left-1/2 top-[58%] h-[60vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,255,255,0.18),rgba(170,170,170,0.10)_45%,transparent_75%)] blur-2xl motion-safe:animate-pulse" />
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

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,transparent_30%,rgba(13,13,13,0.85)_85%)]" />

      <div className="container-x relative">
        <div className="fade-up mb-6 flex flex-wrap items-center gap-3 sm:mb-8" style={{ ["--d" as string]: "50ms" }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.26em] text-mist">
            Aperto 24/7 · {studio.address.city}, {studio.address.provinceName}
          </span>
        </div>

        <h1 id="hero-title" className="text-white">
          <span className="fade-up eyebrow mb-5 block text-chrome" style={{ ["--d" as string]: "80ms" }}>
            Studio di registrazione · Vicenza
          </span>{" "}
          <span className="block font-sans text-[clamp(2.9rem,8.2vw,8rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.04em]">
            {HEADLINE.map((w) => (
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
                className="kinetic-word font-display text-[1.08em] font-normal normal-case italic tracking-[-0.01em] chrome-text pr-[0.08em]"
                style={{ ["--i" as string]: wordIndex++ }}
              >
                Lounge
              </span>
            </span>
          </span>{" "}
          <span
            className="fade-up mt-4 block max-w-3xl font-display text-[clamp(1.6rem,3.6vw,3rem)] leading-[1.05] text-white/90"
            style={{ ["--d" as string]: "650ms" }}
          >
            di Registrazione e Mix/Master a Vicenza.
          </span>
        </h1>

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <p className="fade-up max-w-xl text-base leading-relaxed text-mist sm:text-lg" style={{ ["--d" as string]: "750ms" }}>
            Un collettivo di <strong className="font-semibold text-white">3 produttori e sound/mix engineer</strong> con oltre 5 anni sul
            campo. 65 mq in stile americano ad Arcugnano, aperti giorno e notte: registri, produci e ti rilassi con la tua crew, nello
            stesso spazio.
          </p>

          <div className="fade-up flex flex-col gap-3 sm:flex-row sm:gap-4 lg:justify-end" style={{ ["--d" as string]: "850ms" }}>
            <Magnetic className="w-full sm:w-auto">
              <BookingTrigger className={cn(buttonStyles.primary, "w-full sm:w-auto")}>
                <span className="relative z-10">Prenota la tua sessione</span>
                <span aria-hidden="true" className="relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  →
                </span>
              </BookingTrigger>
            </Magnetic>
            <Magnetic className="w-full sm:w-auto">
              <a href="#lounge" className={cn(buttonStyles.ghost, "w-full sm:w-auto")}>
                Scopri la Lounge
              </a>
            </Magnetic>
          </div>
        </div>

        <dl className="fade-up mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4 lg:mt-14" style={{ ["--d" as string]: "1000ms" }}>
          {heroFacts.map((f) => (
            <div key={f.label} className="bg-obsidian/80 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-mist">{f.label}</dt>
              <dd className="mt-1 font-display text-4xl leading-none text-white sm:text-5xl">
                <span className="chrome-text">{f.value}</span>
                {f.unit && <span className="ml-1.5 font-sans text-sm text-mist">{f.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
