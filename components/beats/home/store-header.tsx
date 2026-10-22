"use client";

import { Search, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PLANS } from "@/lib/beats/plans";
import { Logo3D } from "../experience/logo-3d";
import { FeatInboxBadge } from "../feat/inbox-badge";
import { useViewer } from "../providers";
import { SettingsButton } from "../settings/settings-sheet";
import { GlowBadge } from "../ui/glow-badge";
import { NAV_ITEMS } from "./nav-items";

/**
 * Barra superiore: logo 3D, avatar, badge del piano, saldo crediti (sempre visibile), impostazioni
 * e navigazione desktop. Respira a tempo col beat in riproduzione (classe `beat-header`).
 */
export function StoreHeader({ demo }: { demo: boolean }) {
  const { data: viewer } = useViewer();
  const pathname = usePathname();
  const plan = viewer?.plan ? PLANS[viewer.plan.tier] : null;
  const initial = (viewer?.artistName ?? viewer?.name ?? "?").charAt(0).toUpperCase();

  return (
    <header className="beat-header sticky top-0 z-30 border-b border-white/60 bg-white/55 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:h-[72px] lg:px-6">
        <Link href="/beats" aria-label="Backrooms Beat Store, home" className="-my-1 shrink-0 rounded-xl p-0.5">
          <Logo3D width={46} />
        </Link>
        {viewer ? (
          <Link href="/beats/libreria" className="flex min-w-0 items-center gap-3" aria-label="Il tuo account">
            <span className="chrome-surface relative grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-bold text-graphite ring-2 ring-electric/40 shadow-glow-sm">
              {initial}
            </span>
            {/* Da desktop la nav lunga si prende lo spazio: resta l'avatar (il nome torna sugli schermi larghi). */}
            <span className="min-w-0 lg:hidden 2xl:block">
              <span className="block truncate font-display text-[15px] font-bold leading-tight">{viewer.artistName ?? viewer.name}</span>
              {plan ? (
                <span className="mt-1 hidden min-w-0 max-w-full overflow-hidden rounded-full min-[420px]:flex">
                  <GlowBadge tone={plan.tier === "ELITE" ? "holo" : "chrome"} className="min-w-0 max-w-full px-2 py-0.5 text-[10px]">
                    <span className="truncate">{plan.name}</span>
                  </GlowBadge>
                </span>
              ) : (
                <span className="hidden text-xs text-chrome-500 min-[420px]:block">Nessun piano</span>
              )}
            </span>
          </Link>
        ) : (
          <Link href="/beats" className="font-display text-sm font-bold uppercase tracking-[0.2em]">
            Backrooms <span className="text-electric">Beats</span>
          </Link>
        )}

        <nav aria-label="Sezioni" className="ml-3 hidden items-center gap-0.5 lg:flex xl:ml-6 xl:gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-2 text-sm font-semibold transition xl:px-3.5",
                  active ? "bg-graphite text-white shadow-glow-sm" : "text-graphite-700 hover:bg-white/70",
                )}
              >
                {item.label}
                {item.featBadge && <FeatInboxBadge className="ml-1" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Il wrapper nasconde il badge su mobile: su GlowBadge `hidden` perderebbe contro `inline-flex`. */}
          {demo && (
            <span className="hidden sm:inline-flex">
              <GlowBadge tone="chrome">Demo</GlowBadge>
            </span>
          )}
          <Link
            href="/beats/cerca"
            aria-label="Cerca un beat"
            className="chrome-surface grid size-11 place-items-center rounded-full text-graphite-700 lg:hidden"
          >
            <Search className="size-[18px]" aria-hidden />
          </Link>
          <SettingsButton />
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
