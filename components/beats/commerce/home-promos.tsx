import { ArrowRight, Crown } from "lucide-react";
import Link from "next/link";
import type { AuctionSummary, LevelInfo } from "@/lib/beats/types";
import { AuctionCard } from "./auction-card";

/** Le offerte dello studio in home: l'asta in corso, il pacchetto hit, il livello Resident. */
export function HomePromos({ auction, level }: { auction: AuctionSummary | null; level: LevelInfo | null }) {
  return (
    <section aria-label="Dallo studio" className="grid gap-4 lg:grid-cols-2">
      {auction && <AuctionCard auction={auction} large />}
      <Link
        href="/beats/studio?servizio=HIT_PACKAGE"
        className="glass group relative flex items-center gap-4 overflow-hidden rounded-[26px] p-4 transition hover:shadow-glow sm:p-6"
      >
        <span className="obsidian grid size-14 shrink-0 place-items-center rounded-2xl text-electric-cyan sm:size-20">
          <Crown className="size-7 sm:size-9" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-electric">Studio Lounge</span>
          <span className="block font-display text-lg font-bold sm:text-2xl">Dal beat alla hit</span>
          <span className="block text-sm text-chrome-500">
            Beat, registrazione, mix e master da 199 €{level && level.studioDiscountPct > 0 ? ` · -${level.studioDiscountPct}% per te` : ""}
          </span>
        </span>
        <ArrowRight className="size-5 text-chrome-400 transition group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
