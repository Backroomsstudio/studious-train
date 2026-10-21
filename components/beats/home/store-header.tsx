"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PLANS } from "@/lib/beats/plans";
import { useViewer } from "../providers";
import { GlowBadge } from "../ui/glow-badge";
import { NAV_ITEMS } from "./nav-items";

/** Barra superiore: avatar, badge del piano, saldo crediti (sempre visibile) e navigazione desktop. */
export function StoreHeader({ demo }: { demo: boolean }) {
  const { data: viewer } = useViewer();
  const pathname = usePathname();
  const plan = viewer?.plan ? PLANS[viewer.plan.tier] : null;
  const initial = (viewer?.artistName ?? viewer?.name ?? "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/55 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:h-[72px] lg:px-6">
        {viewer ? (
          <Link href="/beats/libreria" className="flex min-w-0 items-center gap-3" aria-label="Il tuo account">
            <span className="chrome-surface relative grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-bold text-graphite ring-2 ring-electric/40 shadow-glow-sm">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] font-bold leading-tight">{viewer.artistName ?? viewer.name}</span>
              {plan ? (
                <GlowBadge tone={plan.tier === "ELITE" ? "holo" : "chrome"} className="mt-1 px-2 py-0.5 text-[10px]">
                  {plan.name}
                </GlowBadge>
              ) : (
                <span className="text-xs text-chrome-500">Nessun piano</span>
              )}
            </span>
          </Link>
        ) : (
          <Link href="/beats" className="font-display text-sm font-bold uppercase tracking-[0.2em]">
            Backrooms <span className="text-electric">Beats</span>
          </Link>
        )}

        <nav aria-label="Sezioni" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-semibold transition",
                  active ? "bg-graphite text-white shadow-glow-sm" : "text-graphite-700 hover:bg-white/70",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {demo && <GlowBadge tone="chrome" className="hidden sm:inline-flex">Demo</GlowBadge>}
          {viewer ? (
            <Link
              href="/beats/piani"
              aria-label={`${viewer.creditBalance} crediti disponibili`}
              className="chrome-surface inline-flex h-11 items-center gap-2 rounded-full px-4 font-mono text-[15px] font-bold tabular-nums text-graphite ring-1 ring-electric/30 shadow-glow-sm transition hover:shadow-glow"
            >
              <Zap className="size-4 fill-electric text-electric" aria-hidden />
              {viewer.creditBalance}
            </Link>
          ) : (
            <Link href="/beats/accedi" className="inline-flex h-10 items-center rounded-full bg-graphite px-4 text-sm font-semibold text-white">
              Accedi
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
