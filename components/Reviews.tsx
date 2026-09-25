"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KineticText, Reveal } from "@/components/Reveal";
import { REVIEWS_ARE_EXAMPLES, reviews } from "@/lib/content";
import { studio } from "@/lib/studio";
import { cn } from "@/lib/cn";

const AUTOPLAY_MS = 6000;

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-1 text-gold" aria-label={`${value} stelle su 5`} role="img">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" fill={i < value ? "currentColor" : "none"} stroke="currentColor" aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

export function Reviews() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const scrollToIndex = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const count = track.children.length;
    const next = ((i % count) + count) % count;
    const card = track.children[next] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  // Sincronizza l'indice attivo con lo scroll (swipe, trackpad, tastiera)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setIndex(cards.indexOf(visible.target as HTMLElement));
      },
      { root: track, threshold: [0.6, 0.9] },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  // Autoplay (in pausa su hover/focus e con reduced-motion)
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      scrollToIndex(atEnd ? 0 : index + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [index, paused, scrollToIndex]);

  const navBtn =
    "flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white transition-colors duration-300 hover:border-gold hover:bg-gold hover:text-obsidian";

  return (
    <section
      id="recensioni"
      aria-labelledby="recensioni-title"
      aria-roledescription="carosello"
      className="relative py-24 sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Recensioni · Vicenza e Veneto</p>
            <KineticText id="recensioni-title" text="Parlano *gli artisti*." className="mt-5 text-[clamp(2.6rem,6vw,5.5rem)]" />
          </div>
          <Reveal delay={0.1}>
            <div className="flex items-center gap-6">
              <div>
                <p className="font-display text-6xl leading-none text-white">{studio.rating.value.toFixed(1).replace(".", ",")}</p>
                <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-mist">{studio.rating.count}+ recensioni Google</p>
              </div>
              <div className="flex gap-3">
                <button type="button" className={navBtn} onClick={() => scrollToIndex(index - 1)} aria-label="Recensione precedente">
                  ←
                </button>
                <button type="button" className={navBtn} onClick={() => scrollToIndex(index + 1)} aria-label="Recensione successiva">
                  →
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal delay={0.15}>
        <ul
          ref={trackRef}
          className="no-scrollbar mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-[max(1.25rem,calc((100vw-88rem)/2+3rem))] pb-4"
          aria-label="Recensioni dei clienti"
        >
          {reviews.map((r, i) => (
            <li
              key={`${r.author}-${i}`}
              className="w-[85vw] max-w-[28rem] shrink-0 snap-start sm:w-[26rem]"
              aria-roledescription="slide"
              aria-label={`${i + 1} di ${reviews.length}`}
            >
              <figure
                className={cn(
                  "flex h-full flex-col rounded-[1.75rem] border p-8 transition-colors duration-700",
                  i === index ? "border-gold/40 bg-gradient-to-b from-titanium/80 to-obsidian-2" : "border-white/10 bg-titanium/30",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <Stars value={r.rating} />
                  {REVIEWS_ARE_EXAMPLES && (
                    <span className="rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-mist">
                      Esempio
                    </span>
                  )}
                </div>
                <blockquote className="mt-6 flex-1 font-display text-2xl leading-snug text-white">
                  <p>&ldquo;{r.text}&rdquo;</p>
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-4 border-t border-white/10 pt-6">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-gold to-signal font-display text-lg text-obsidian"
                  >
                    {r.author.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{r.author}</span>
                    <span className="block text-xs text-mist">
                      {r.role} · {r.city} · {r.service}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="container-x mt-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex gap-2" aria-hidden="true">
          {reviews.map((_, i) => (
            <span key={i} className={cn("h-1 rounded-full transition-all duration-500", i === index ? "w-10 bg-gold" : "w-4 bg-white/20")} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            href={studio.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-mist underline-offset-4 transition-colors hover:text-gold hover:underline"
          >
            Leggi tutte le recensioni su Google ↗
          </a>
          {studio.googleReviewUrl && (
            <a
              href={studio.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-gold underline-offset-4 hover:underline"
            >
              Hai registrato da noi? Lascia una recensione ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
