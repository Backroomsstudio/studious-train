"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { KineticText, Reveal } from "@/components/Reveal";
import { BookingTrigger } from "@/components/BookingModal";
import { studioPhotos } from "@/lib/content";
import { buttonStyles, cn } from "@/lib/cn";

type Photo = (typeof studioPhotos)[number];

/** Foto con parallax interno allo scroll e zoom lento all'hover. */
function ParallaxPhoto({ photo, className, sizes, index }: { photo: Photo; className?: string; sizes: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <figure ref={ref} className={cn("group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-titanium", className)}>
      <motion.div className="absolute inset-[-10%]" style={reduce ? undefined : { y }}>
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-[1600ms] ease-[var(--ease-expo)] group-hover:scale-105"
        />
      </motion.div>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/10 to-transparent" />
      <figcaption className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
        <span className="font-display text-3xl leading-none text-white sm:text-4xl">{photo.caption}</span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-mist">0{index + 1}</span>
      </figcaption>
    </figure>
  );
}

export function Gallery() {
  const [hero, ...rest] = studioPhotos;

  return (
    <section id="studio-foto" aria-labelledby="studio-foto-title" className="relative py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.18),transparent)] blur-2xl" />
      </div>

      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Lo studio · Vicenza</p>
            <KineticText id="studio-foto-title" text="Entra nella *stanza*." className="mt-5 text-[clamp(2.6rem,6vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-mist">
              Pannelli acustici su tutte le pareti, diffusori sul fondo, monitor Focal e una sala pensata per farti sentire a casa:
              è qui che nasce il tuo prossimo brano.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <ParallaxPhoto photo={hero} index={0} sizes="(min-width: 1024px) 66vw, 100vw" className="aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[36rem]" />
          </Reveal>
          <div className="grid gap-5 lg:col-span-4">
            {rest.slice(0, 2).map((photo, i) => (
              <Reveal key={photo.src} delay={0.1 * (i + 1)}>
                <ParallaxPhoto photo={photo} index={i + 1} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[4/3]" />
              </Reveal>
            ))}
          </div>
          {rest[2] && (
            <Reveal className="lg:col-span-12">
              <div className="grid gap-5 lg:grid-cols-12">
                <ParallaxPhoto photo={rest[2]} index={3} sizes="(min-width: 1024px) 58vw, 100vw" className="aspect-[4/3] lg:col-span-7 lg:aspect-[16/9]" />
                <div className="glass flex flex-col justify-between gap-8 rounded-[1.75rem] p-8 lg:col-span-5 sm:p-10">
                  <div>
                    <p className="eyebrow">Prenota una visita</p>
                    <p className="mt-5 font-display text-4xl leading-tight text-white sm:text-5xl">
                      Vieni a sentire <em className="text-gradient-gold">come suona</em>.
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-mist">
                      Passa in studio prima di registrare: ascolti la sala, conosci il team e parliamo del tuo progetto.
                    </p>
                  </div>
                  <BookingTrigger className={cn(buttonStyles.primary, "self-start")} notes="Vorrei passare in studio per una visita prima di registrare.">
                    Prenota una visita →
                  </BookingTrigger>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
