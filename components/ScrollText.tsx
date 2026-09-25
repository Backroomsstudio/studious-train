"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/cn";

/**
 * Tipografia cinetica guidata dallo scroll (GSAP ScrollTrigger):
 * righe giganti che scorrono in direzioni opposte mentre la pagina avanza.
 */
export function ScrollText({ lines, className }: { lines: string[]; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-line]").forEach((line, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        gsap.fromTo(
          line,
          { xPercent: dir === -1 ? 0 : -18 },
          {
            xPercent: dir === -1 ? -18 : 0,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
          },
        );
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} aria-hidden="true" className={cn("overflow-hidden py-6", className)}>
      {lines.map((line, i) => (
        <div
          key={line}
          data-line
          className={cn(
            // testo decorativo generato via CSS (::before): non è contenuto, non entra nei controlli di contrasto
            "whitespace-nowrap font-display text-[clamp(4rem,13vw,12rem)] leading-[0.95] will-change-transform before:content-[attr(data-text)]",
            i % 2 === 0 ? "text-white/[0.07]" : "italic text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.35)]",
          )}
          data-text={`${line} · ${line} · ${line}`}
        />
      ))}
    </div>
  );
}
