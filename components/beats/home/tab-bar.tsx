"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SPRING_MOVE, SPRING_PRESS } from "@/lib/beats/motion";
import { haptic, sfx } from "@/lib/beats/ui-feedback";
import { NAV_ITEMS } from "./nav-items";

/**
 * Barra di navigazione in basso su mobile, come Instagram: le 7 sezioni sempre a portata di
 * pollice, con Registra al centro (il tasto rosso, come il REC di uno studio). Nascosta da desktop.
 */
export function TabBar() {
  const pathname = usePathname();
  const feedback = (active: boolean, rec = false) => {
    if (active) return;
    sfx(rec ? "pop" : "tab");
    haptic("select");
  };
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="relative isolate mx-auto grid h-[4.5rem] max-w-xl grid-cols-7">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match, center }) => {
          const active = match(pathname);
          if (center) {
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => feedback(active, true)}
                  data-no-sfx
                  className="flex h-full flex-col items-center justify-end gap-0.5 pb-2 text-[10px] font-bold text-graphite"
                >
                  <motion.span
                    whileTap={{ scale: 0.86 }}
                    transition={SPRING_PRESS}
                    aria-hidden
                    className={cn(
                      "absolute -top-4 grid size-[3.25rem] place-items-center rounded-full bg-gradient-to-b from-[#ff5a4f] to-[#d70015] text-white ring-4 ring-white/90 shadow-[0_10px_26px_-6px_rgba(255,59,48,0.75)] transition",
                      active && "shadow-[0_0_0_3px_rgba(255,59,48,0.35),0_10px_30px_-4px_rgba(255,59,48,0.9)]",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={2.2} />
                  </motion.span>
                  {label}
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => feedback(active)}
                data-no-sfx
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
                  active ? "text-electric" : "text-chrome-500 hover:text-graphite",
                )}
              >
                {active && (
                  <motion.span layoutId="tab-pill" transition={SPRING_MOVE} aria-hidden className="tab-active-pill absolute inset-x-1 inset-y-2 -z-10 rounded-2xl" />
                )}
                <motion.span whileTap={{ scale: 0.8, y: 2 }} transition={SPRING_PRESS} className="grid place-items-center">
                  <Icon className={cn("size-[22px]", active && "drop-shadow-[0_0_8px_rgba(0,102,255,0.6)]")} strokeWidth={active ? 2.3 : 1.8} />
                </motion.span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
