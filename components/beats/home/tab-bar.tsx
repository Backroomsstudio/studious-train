"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

/** Tab bar inferiore su mobile (raggiungibile col pollice), nascosta da desktop. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((item) => !item.desktopOnly).map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
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
