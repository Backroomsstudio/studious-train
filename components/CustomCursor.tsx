"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

type Variant = "default" | "hover" | "label";

/**
 * Cursore custom a due livelli (punto + anello con inerzia).
 * - Si ingrandisce su link e pulsanti
 * - Mostra un'etichetta sugli elementi con data-cursor="Testo"
 * Attivo solo con puntatori precisi (mouse/trackpad) e senza reduced-motion.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [variant, setVariant] = useState<Variant>("default");
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled || !dotRef.current || !ringRef.current) return;
    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    const dotX = gsap.quickTo(dotRef.current, "x", { duration: 0.12, ease: "power3.out" });
    const dotY = gsap.quickTo(dotRef.current, "y", { duration: 0.12, ease: "power3.out" });
    const ringX = gsap.quickTo(ringRef.current, "x", { duration: 0.5, ease: "power3.out" });
    const ringY = gsap.quickTo(ringRef.current, "y", { duration: 0.5, ease: "power3.out" });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
      setVisible(true);
    };

    const onOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const labelled = target.closest<HTMLElement>("[data-cursor]");
      if (labelled) {
        setVariant("label");
        setLabel(labelled.dataset.cursor ?? "");
        return;
      }
      const interactive = target.closest("a, button, [role='button'], input, select, textarea, label, summary");
      setVariant(interactive ? "hover" : "default");
      setLabel("");
    };

    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      root.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [enabled]);

  if (!enabled) return null;

  const ringScale = variant === "label" ? 3.4 : variant === "hover" ? 2 : 1;

  return (
    <div
      aria-hidden="true"
      className="custom-cursor pointer-events-none fixed inset-0 z-[100] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div ref={ringRef} className="absolute left-0 top-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-500 ease-[var(--ease-expo)]"
          style={{
            transform: `translate(-50%, -50%) scale(${pressed ? ringScale * 0.85 : ringScale})`,
            borderColor: variant === "default" ? "rgba(197,198,199,0.5)" : "rgba(255,255,255,0.9)",
            backgroundColor: variant === "label" ? "rgba(255,255,255,0.95)" : variant === "hover" ? "rgba(255,255,255,0.08)" : "transparent",
          }}
        >
          <span
            className="whitespace-nowrap font-mono text-[3.2px] font-bold uppercase tracking-[0.2em] text-obsidian transition-opacity duration-300"
            style={{ opacity: variant === "label" ? 1 : 0 }}
          >
            {label}
          </span>
        </div>
      </div>
      <div ref={dotRef} className="absolute left-0 top-0">
        <div
          className="h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chrome shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-opacity duration-300"
          style={{ opacity: variant === "label" ? 0 : 1 }}
        />
      </div>
    </div>
  );
}
