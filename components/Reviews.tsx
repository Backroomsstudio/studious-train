"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KineticText, Reveal } from "@/components/Reveal";
import { reviews } from "@/lib/content";
import { cn } from "@/lib/cn";

const AUTOPLAY_MS = 6500;

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-1 text-white" role="img" aria-label={`${value} stelle su 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" fill={i < value ? "currentColor" : "none"} stroke="currentColor" aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Testimonianze reali degli artisti. La sezione non viene mostrata finché la lista è vuota. */
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
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

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

  useEffect(() => {
    if (paused || reviews.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      scrollToIndex(atEnd ? 0 : index + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [index, paused, scrollToIndex]);

  if (reviews.length === 0) return null;

  const navBtn =
    "press flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white transition-colors duration-300 hover:border-white hover:bg-white hover:text-obsidian";

  return (
    <section
      id="recensioni"
      aria-labelledby="recensioni-title"
      aria-roledescription="carosello"
      className="relative py-20 sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="container-x flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Testimonianze · Recensioni 5★ su Google</p>
          <KineticText id="recensioni-title" text="Parlano *gli artisti*." className="mt-5 text-[clamp(2.5rem,6.5vw,5.5rem)]" />
        </div>
        {reviews.length > 1 && (
          <div className="flex gap-3">
            <button type="button" className={navBtn} onClick={() => scrollToIndex(index - 1)} aria-label="Testimonianza precedente">
              ←
            </button>
            <button type="button" className={navBtn} onClick={() => scrollToIndex(index + 1)} aria-label="Testimonianza successiva">
              →
            </button>
          </div>
        )}
      </div>

      <Reveal delay={0.1}>
        <ul
          ref={trackRef}
          className="no-scrollbar mt-12 flex items-start snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[max(1.25rem,calc((100vw-88rem)/2+3rem))] pb-4"
          aria-label="Testimonianze degli artisti"
        >
          {reviews.map((r, i) => (
            <li key={`${r.author}-${i}`} className="w-[86vw] max-w-[30rem] shrink-0 snap-start sm:w-[28rem]" aria-roledescription="slide" aria-label={`${i + 1} di ${reviews.length}`}>
              <figure
                className={cn(
                  "chrome-border flex h-full flex-col rounded-[1.75rem] p-7 transition-colors duration-700 sm:p-8",
                  i === index ? "bg-gradient-to-b from-titanium to-obsidian-2" : "bg-titanium/40",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <Stars value={r.rating} />
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-mist">su {r.source}</span>
                </div>
                <blockquote className="mt-6 flex-1 whitespace-pre-line font-display text-2xl leading-snug text-white">
                  <p>&ldquo;{r.text}&rdquo;</p>
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-4 border-t border-white/10 pt-6">
                  <span aria-hidden="true" className="chrome-surface flex h-11 w-11 items-center justify-center rounded-full font-display text-lg">
                    {r.author.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{r.author}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>

      {reviews.length > 1 && (
        <div className="container-x mt-6 flex gap-2" aria-hidden="true">
          {reviews.map((_, i) => (
            <span key={i} className={cn("h-1 rounded-full transition-all duration-500", i === index ? "w-10 bg-white" : "w-4 bg-white/20")} />
          ))}
        </div>
      )}
    </section>
  );
}
