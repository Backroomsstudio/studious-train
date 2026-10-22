import { Gavel, Radio } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/beats/plans";
import type { AuctionSummary } from "@/lib/beats/types";
import { BeatCover } from "../ui/beat-cover";
import { Countdown } from "./countdown";

/** Scheda di un'asta (lista aste e home). */
export function AuctionCard({ auction, large = false }: { auction: AuctionSummary; large?: boolean }) {
  const live = auction.phase === "LIVE" && auction.status === "OPEN";
  return (
    <Link
      href={`/beats/aste/${auction.id}`}
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-[26px] p-4 transition hover:shadow-glow",
        live ? "obsidian ring-1 ring-electric/50" : "glass",
        large && "sm:p-6",
      )}
    >
      {live && <span aria-hidden className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-electric/30 blur-3xl" />}
      <BeatCover beat={auction.beat} size={large ? "lg" : "md"} />
      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-deal">
              <span className="size-2 animate-pulse rounded-full bg-deal shadow-[0_0_10px_#ef4444]" />
              {auction.live ? "In diretta" : "Aperta"}
            </span>
          ) : auction.phase === "SCHEDULED" ? (
            <span className="text-electric">Prossima asta</span>
          ) : (
            <span className="text-chrome-400">Chiusa</span>
          )}
          {auction.live && <Radio className="size-3.5 text-chrome-400" aria-label="Asta in live TikTok" />}
        </p>
        <p className={cn("truncate font-display font-bold", large ? "text-2xl" : "text-lg")}>Esclusiva · {auction.beat.title}</p>
        <p className={cn("truncate text-sm", live ? "text-chrome-300" : "text-chrome-500")}>
          {auction.topBidCents ? `${formatEuro(auction.topBidCents)} · ${auction.leader}` : `Base ${formatEuro(auction.startPriceCents)}`}
          {" · "}
          {auction.bidCount} offerte
        </p>
      </div>
      <div className="relative text-right">
        {auction.phase !== "ENDED" && auction.status === "OPEN" ? (
          <>
            <p className={cn("text-[11px] font-semibold", live ? "text-chrome-400" : "text-chrome-500")}>
              {auction.phase === "SCHEDULED" ? "apre tra" : "chiude tra"}
            </p>
            <Countdown
              to={auction.phase === "SCHEDULED" ? auction.startsAt : auction.endsAt}
              className={cn("font-mono text-lg font-black tabular-nums", live ? "text-electric-cyan" : "text-graphite")}
            />
          </>
        ) : (
          <Gavel className="size-6 text-chrome-400" />
        )}
      </div>
    </Link>
  );
}
