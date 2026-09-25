"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Blocco che entra dal basso quando diventa visibile. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 32,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const word: Variants = {
  hidden: { y: "110%", rotate: 4 },
  visible: { y: "0%", rotate: 0, transition: { duration: 1.2, ease: EASE } },
};

/**
 * Tipografia cinetica: ogni parola sale dalla propria maschera con stagger.
 * Le parti tra *asterischi* vengono rese in serif corsivo oro.
 */
export function KineticText({
  text,
  as: Tag = "h2",
  className,
  id,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const tokens = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  const words: { value: string; accent: boolean; suffix: string }[] = [];
  for (const token of tokens) {
    const accent = token.startsWith("*") && token.endsWith("*");
    const clean = accent ? token.slice(1, -1) : token;
    for (const w of clean.split(/\s+/).filter(Boolean)) {
      const prev = words[words.length - 1];
      // la punteggiatura isolata ("*parola*.") resta attaccata alla parola precedente
      if (prev && /^[.,;:!?]+$/.test(w) && !/\s$/.test(token.slice(0, token.indexOf(w)))) prev.suffix += w;
      else words.push({ value: w, accent, suffix: "" });
    }
  }

  return (
    <Tag id={id} className={cn("font-display leading-[0.95] text-white", className)}>
      <motion.span
        className="block"
        variants={container}
        initial={reduce ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      >
        {words.map((w, i) => (
          <Fragment key={`${w.value}-${i}`}>
            <span className="kinetic-mask">
              <motion.span variants={word} className={cn("inline-block", w.accent && "italic chrome-text pr-[0.06em]")}>
                {w.value}
              </motion.span>
              {w.suffix ? (
                <motion.span variants={word} className={cn("inline-block", w.accent && "-ml-[0.1em]")}>
                  {w.suffix}
                </motion.span>
              ) : null}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </motion.span>
    </Tag>
  );
}

/** Marquee testuale infinito (CSS), con pausa al passaggio del mouse. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={cn("group relative flex overflow-hidden", className)} aria-hidden="true">
      <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10 group-hover:[animation-play-state:paused]">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            {item}
            <span className="text-chrome">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
