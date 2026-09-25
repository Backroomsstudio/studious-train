"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { KineticText, Reveal } from "@/components/Reveal";
import { BookingTrigger } from "@/components/BookingModal";
import { streamFeatures, streamPlatforms } from "@/lib/content";
import { buttonStyles } from "@/lib/cn";

/** Timecode che scorre: dà vita al monitor della diretta (puramente decorativo). */
function Timecode() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setT((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hh = String(Math.floor(t / 3600)).padStart(2, "0");
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return (
    <span className="font-mono text-xs tabular-nums text-white">
      {hh}:{mm}:{ss}
    </span>
  );
}

export function LiveStreaming() {
  return (
    <section id="live" aria-labelledby="live-title" className="relative overflow-x-clip py-20 sm:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Live Streaming 24/7 · Exposure per gli artisti</p>
            <KineticText id="live-title" text="La tua sessione *va in onda*." className="mt-5 text-[clamp(2.5rem,6.5vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              Mentre registri, la community ti guarda crescere. Il dietro le quinte del tuo processo creativo diventa contenuto, e il
              tuo brano arriva alle orecchie giuste prima ancora di uscire.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-12">
          {/* Monitor della diretta */}
          <Reveal>
            <figure className="chrome-border relative overflow-hidden rounded-[1.75rem] bg-titanium">
              <div className="relative aspect-[4/5] sm:aspect-video">
                <Image
                  src="/images/postazione-produzione-musicale.webp"
                  alt="Inquadratura della postazione di produzione dello studio, come appare in diretta"
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover grayscale contrast-125"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/10 to-obsidian/40" />
                {/* Scanlines */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-20 mix-blend-overlay [background:repeating-linear-gradient(0deg,rgba(255,255,255,0.15)_0px,rgba(255,255,255,0.15)_1px,transparent_1px,transparent_3px)]"
                />

                <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-3 sm:left-5 sm:right-5 sm:top-5">
                  <span className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-obsidian">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-obsidian opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-obsidian" />
                    </span>
                    Live
                  </span>
                  <span className="flex items-center gap-2">
                    <Timecode />
                    <span className="rounded-md border border-white/60 px-2 py-0.5 font-mono text-[0.65rem] font-bold text-white">4K</span>
                  </span>
                </div>

                <figcaption className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5">
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-mist">In simulcast su</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Piattaforme della diretta">
                    {streamPlatforms.map((p) => (
                      <li key={p} className="rounded-full border border-white/25 bg-obsidian/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        {p}
                      </li>
                    ))}
                  </ul>
                </figcaption>
              </div>
            </figure>
          </Reveal>

          <div className="grid gap-4">
            {streamFeatures.map((f, i) => (
              <Reveal key={f.title} delay={0.08 * i}>
                <article className="chrome-border glass rounded-[1.5rem] p-6">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-[0.68rem] text-mist">0{i + 1}</span>
                    <h3 className="font-display text-3xl leading-tight text-white">{f.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{f.text}</p>
                </article>
              </Reveal>
            ))}
            <Reveal delay={0.25}>
              <BookingTrigger className={buttonStyles.primary + " w-full sm:w-auto"} notes="Vorrei registrare in diretta con il live streaming dello studio.">
                Registra in diretta →
              </BookingTrigger>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
