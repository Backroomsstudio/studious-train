"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion, usePrefs } from "@/lib/beats/prefs";
import { haptic, sfx } from "@/lib/beats/ui-feedback";

const LOGO = "/brand/logo-br.webp";

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Logo cromato in 3D: strati sovrapposti in profondità (translateZ) danno lo spessore del metallo,
 * un riflesso segue il puntatore. Si inclina seguendo il mouse e, se attivato nelle impostazioni,
 * il giroscopio del telefono. Un tocco lo fa girare su sé stesso.
 * Con movimento ridotto o modalità leggera resta fermo (solo il riflesso statico).
 */
export function Logo3D({ width = 52, layers = 8, className }: { width?: number; layers?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const gyro = usePrefs((s) => s.gyro);
  const lite = usePrefs((s) => s.lite);

  useEffect(() => {
    const el = ref.current;
    if (!el || lite || prefersReducedMotion()) return;
    const tilt = { x: 0, y: 0 };
    let frame = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--rx", `${(-tilt.y * 18).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(tilt.x * 32).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(50 + tilt.x * 42).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(45 + tilt.y * 40).toFixed(1)}%`);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // Distanza dal logo, normalizzata su mezza finestra: il logo "guarda" il puntatore.
      const r = el.getBoundingClientRect();
      tilt.x = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
      tilt.y = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
      queue();
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt.x = clamp(e.gamma / 30);
      tilt.y = clamp((e.beta - 45) / 30);
      queue();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    if (gyro) window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onOrient);
      cancelAnimationFrame(frame);
      for (const p of ["--rx", "--ry", "--gx", "--gy"]) el.style.removeProperty(p);
    };
  }, [gyro, lite]);

  const spin = () => {
    const el = ref.current;
    if (!el || usePrefs.getState().lite || prefersReducedMotion()) return;
    el.classList.remove("spin");
    void el.offsetWidth; // riavvia l'animazione
    el.classList.add("spin");
    haptic("select");
    sfx("pop");
    window.setTimeout(() => el.classList.remove("spin"), 1100);
  };

  return (
    <span
      ref={ref}
      aria-hidden
      onPointerDown={spin}
      className={cn("logo3d", className)}
      style={{ "--logo": `url(${LOGO})`, width } as CSSProperties}
    >
      <span className="l3">
        <span className="l3-float">
          {Array.from({ length: layers }, (_, i) => {
            const z = layers - i;
            return <i key={z} style={{ "--z": -z * 1.1, "--b": (0.16 + 0.3 * (1 - z / layers)).toFixed(2) } as CSSProperties} />;
          })}
          <i className="front" style={{ "--z": 0, "--b": 1 } as CSSProperties} />
          <i className="glint" style={{ "--z": 0.6, "--b": 1 } as CSSProperties} />
        </span>
      </span>
    </span>
  );
}
