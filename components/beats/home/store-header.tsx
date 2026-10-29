"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SPRING_MOVE } from "@/lib/beats/motion";
import { PLANS } from "@/lib/beats/plans";
import { Logo3D } from "../experience/logo-3d";
import { useViewer } from "../providers";
import { SettingsButton } from "../settings/settings-sheet";
import { GlowBadge } from "../ui/glow-badge";
import { NAV_ITEMS } from "./nav-items";

/**
 * Barra superiore. Mobile: logo, nome d'artista ben leggibile, impostazioni e crediti (le sezioni
 * stanno nella barra in basso). Desktop: le stesse 7 sezioni al centro e, a destra, la scheda
 * dell'artista (nome + piano) separata dalla nav, così niente si sovrappone.
 * Respira a tempo col beat in riproduzione (classe `beat-header`).
 */
export function StoreHeader({ demo }: { demo: boolean }) {
  const { data: viewer } = useViewer();
  const pathname = usePathname();
  const plan = viewer?.plan ? PLANS[viewer.plan.tier] : null;
  const name = viewer?.artistName ?? viewer?.name ?? "";
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <header className="beat-header sticky top-0 z-30 border-b border-chrome-200 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 lg:h-[72px] lg:gap-4 lg:px-6">
        <Link href="/beats" aria-label="Backrooms Beat Store, home" className="-my-2 shrink-0 rounded-xl p-0">
          <Logo3D width={46} />
        </Link>

        {/* Mobile: il nome d'artista è il protagonista della barra */}
        {viewer ? (
          <Link href="/beats/profilo" className="flex min-w-0 flex-1 items-center gap-2 lg:hidden" aria-label="Il tuo profilo">
            <span className="chrome-surface grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-semibold text-graphite ring-2 ring-electric/40">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[17px] font-semibold leading-tight text-graphite">{name}</span>
              <span className="block truncate text-[11px] font-semibold text-chrome-500">
                {plan ? plan.name : "Nessun piano"}
              </span>
            </span>
          </Link>
        ) : (
          <Link href="/beats" className="min-w-0 flex-1 truncate font-display text-sm font-semibold lg:hidden">
            Backrooms <span className="text-electric">Beats</span>
          </Link>
        )}

        <nav aria-label="Sezioni" className="hidden min-w-0 flex-1 items-center justify-center gap-0 lg:flex xl:gap-2">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative isolate inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors xl:px-4",
                  active ? "text-white" : item.center ? "text-[#c0245a] hover:bg-white/70" : "text-graphite-700 hover:bg-white/70",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={SPRING_MOVE}
                    aria-hidden
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full",
                      item.center ? "bg-[#e0306c]" : "bg-graphite",
                    )}
                  />
                )}
                {item.center && <item.icon className="size-4" aria-hidden />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/* Il wrapper nasconde il badge sugli schermi stretti: su GlowBadge `hidden` perderebbe contro `inline-flex`. */}
          {demo && (
            <span className="hidden 2xl:inline-flex">
              <GlowBadge tone="chrome">Demo</GlowBadge>
            </span>
          )}
          {viewer && (
            <Link
              href="/beats/profilo"
              aria-label="Il tuo profilo"
              className="glass hidden h-11 max-w-[15rem] items-center gap-2 rounded-full py-2 pl-2 pr-4 transition lg:flex"
            >
              <span className="chrome-surface grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-semibold text-graphite ring-2 ring-electric/40">
                {initial}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-display text-[15px] font-semibold text-graphite">{name}</span>
                {plan && <span className="block truncate text-[10px] font-semibold text-electric">{plan.name}</span>}
              </span>
            </Link>
          )}
          <SettingsButton />
          {viewer ? (
            <Link
              href="/beats/piani"
              aria-label={`${viewer.creditBalance} crediti disponibili`}
              className="chrome-surface inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold tabular-nums text-graphite ring-1 ring-electric/30 transition"
            >
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
