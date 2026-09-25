"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Card in vetro con rotazione 3D al passaggio del cursore:
 * - tilt prospettico con spring fisica
 * - riflesso speculare che segue il puntatore
 * - bordo "rifrattivo" con aberrazione cromatica oro/ciano
 */
export function TiltCard({
  children,
  className,
  max = 10,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.18), rgba(255,176,0,0.06) 25%, transparent 55%)`;
  const edgeShift = useTransform(px, [0, 1], [-6, 6]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div className="[perspective:1400px]">
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn("glass group relative h-full rounded-[1.75rem] will-change-transform", className)}
      >
        {/* bordo rifrattivo con aberrazione cromatica */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-[1.75rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            x: edgeShift,
            background: "linear-gradient(135deg, rgba(255,176,0,0.55), transparent 30%, transparent 70%, rgba(69,162,158,0.55))",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: 1,
          }}
        />
        {glare && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-0 mix-blend-screen transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: glareBg }}
          />
        )}
        <div className="relative h-full [transform:translateZ(40px)]">{children}</div>
      </motion.div>
    </div>
  );
}
