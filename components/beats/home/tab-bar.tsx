"use client";

import { motion } from "motion/react";
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-chrome-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                  className="flex h-full flex-col items-center justify-end gap-0 pb-2 text-[10px] font-semibold text-graphite"
                >
                  <motion.span
                    whileTap={{ scale: 0.86 }}
                    transition={SPRING_PRESS}
                    aria-hidden
                    className={cn(
                      "absolute -top-4 grid size-[3.25rem] place-items-center rounded-full bg-electric text-white ring-4 ring-white/90 transition",
                      false,
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
                  "relative flex h-full flex-col items-center justify-center gap-2 text-[10px] font-semibold transition-colors",
                  active ? "text-electric" : "text-chrome-500 hover:text-graphite",
                )}
              >
                {active && (
                  <motion.span layoutId="tab-pill" transition={SPRING_MOVE} aria-hidden className="tab-active-pill absolute inset-x-1 inset-y-2 -z-10 rounded-2xl" />
                )}
                <motion.span whileTap={{ scale: 0.8, y: 2 }} transition={SPRING_PRESS} className="grid place-items-center">
                  <Icon className={cn("size-[22px]", false)} strokeWidth={active ? 2.3 : 1.8} />
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
