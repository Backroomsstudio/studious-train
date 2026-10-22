"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

/**
 * Tab bar inferiore su mobile (raggiungibile col pollice), nascosta da desktop.
 * Al centro il tasto rosso "Registra", come il tasto REC di uno studio.
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((item) => !item.desktopOnly).map(({ href, label, icon: Icon, match, center }) => {
          const active = match(pathname);
          if (center) {
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-end gap-1 pb-2 text-[11px] font-bold text-graphite"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -top-5 grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#ff5a4f] to-[#d70015] text-white ring-4 ring-white/90 shadow-[0_10px_26px_-6px_rgba(255,59,48,0.75)] transition",
                      active && "shadow-[0_0_0_3px_rgba(255,59,48,0.35),0_10px_30px_-4px_rgba(255,59,48,0.9)]",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={2.2} />
                  </span>
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
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition",
                  active ? "text-electric" : "text-chrome-500 hover:text-graphite",
                )}
              >
                <Icon className={cn("size-[22px]", active && "drop-shadow-[0_0_8px_rgba(0,102,255,0.6)]")} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
