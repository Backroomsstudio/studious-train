"use client";

import { Zap } from "lucide-react";
import { motion } from "framer-motion";
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
    <header className="beat-header sticky top-0 z-30 border-b border-white/60 bg-white/55 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:h-[72px] lg:gap-4 lg:px-6">
        <Link href="/beats" aria-label="Backrooms Beat Store, home" className="-my-1 shrink-0 rounded-xl p-0.5">
          <Logo3D width={46} />
        </Link>

        {/* Mobile: il nome d'artista è il protagonista della barra */}
        {viewer ? (
          <Link href="/beats/profilo" className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden" aria-label="Il tuo profilo">
            <span className="chrome-surface grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-bold text-graphite ring-2 ring-electric/40">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[17px] font-bold leading-tight text-graphite">{name}</span>
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-chrome-500">
                {plan ? plan.name : "Nessun piano"}
              </span>
            </span>
          </Link>
        ) : (
          <Link href="/beats" className="min-w-0 flex-1 truncate font-display text-sm font-bold uppercase tracking-[0.2em] lg:hidden">
            Backrooms <span className="text-electric">Beats</span>
          </Link>
        )}

        <nav aria-label="Sezioni" className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex xl:gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative isolate inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors xl:px-3.5",
                  active ? "text-white" : item.center ? "text-[#d70015] hover:bg-white/70" : "text-graphite-700 hover:bg-white/70",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={SPRING_MOVE}
                    aria-hidden
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full",
                      item.center ? "bg-[#ff3b30] shadow-[0_0_16px_rgba(255,59,48,0.45)]" : "bg-graphite shadow-glow-sm",
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
              className="glass hidden h-11 max-w-[15rem] items-center gap-2.5 rounded-full py-1 pl-1 pr-4 transition hover:shadow-glow-sm lg:flex"
            >
              <span className="chrome-surface grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold text-graphite ring-2 ring-electric/40">
                {initial}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-display text-[15px] font-bold text-graphite">{name}</span>
                {plan && <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-electric">{plan.name}</span>}
              </span>
            </Link>
          )}
          <SettingsButton />
          {viewer ? (
            <Link
              href="/beats/piani"
              aria-label={`${viewer.creditBalance} crediti disponibili`}
              className="chrome-surface inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 font-mono text-[15px] font-bold tabular-nums text-graphite ring-1 ring-electric/30 shadow-glow-sm transition hover:shadow-glow"
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
