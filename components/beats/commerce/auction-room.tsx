"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Loader2, Radio, ShieldCheck, Timer } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { AUCTION } from "@/lib/beats/offers";
import { formatEuro } from "@/lib/beats/plans";
import type { AuctionSummary } from "@/lib/beats/types";
import { feedback } from "@/lib/beats/ui-feedback";
import { usePlayer } from "../player/player-store";
import { api, ApiRequestError, usePurchase, useViewer } from "../providers";
import { BeatCover } from "../ui/beat-cover";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { Countdown, useSecondsLeft } from "./countdown";

/**
 * Stanza dell'asta: si aggiorna ogni 2 secondi mentre è aperta (le offerte arrivano anche
 * dalla live TikTok), con rilanci rapidi e proroga anti-cecchino visibile.
 */
export function AuctionRoom({ initial }: { initial: AuctionSummary }) {
  const qc = useQueryClient();
  const { data: viewer } = useViewer();
  const key = ["auction", initial.id];
  const { data: auction = initial } = useQuery({
    queryKey: key,
    queryFn: async () => (await api<{ auction: AuctionSummary }>(`/api/auctions/${encodeURIComponent(initial.id)}`)).auction,
    initialData: initial,
    refetchInterval: (q) => (q.state.data?.status === "OPEN" ? 2000 : false),
  });
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pay = usePurchase();
  const play = usePlayer((s) => s.play);
  const endsIn = useSecondsLeft(auction.endsAt);
  const open = auction.status === "OPEN";
  const live = auction.phase === "LIVE" && open;
  const canBid = open && (live || auction.viewer?.earlyAccess);
  const bid = amount ?? auction.minNextBidCents;

  const placeBid = async (cents: number) => {
    setPending(true);
    setError(null);
    try {
      const res = await api<{ auction: AuctionSummary }>(`/api/auctions/${encodeURIComponent(auction.id)}/bids`, {
        method: "POST",
        body: JSON.stringify({ amountCents: cents }),
      });
      qc.setQueryData(key, res.auction);
      setAmount(null);
      feedback("pop", "select");
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "UNAUTHENTICATED") window.location.assign("/beats/accedi");
      setError((e as Error).message);
      feedback("error", "warning");
      void qc.invalidateQueries({ queryKey: key });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className={cn("relative overflow-hidden rounded-[32px] p-6 sm:p-8", live ? "obsidian ring-1 ring-electric/50" : "glass")}>
        <div className="relative flex items-center gap-4">
          <button type="button" onClick={() => play(auction.beat)} aria-label={`Ascolta ${auction.beat.title}`}>
            <BeatCover beat={auction.beat} size="lg" />
          </button>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold">
              {live ? (
                <span className="inline-flex items-center gap-2 text-deal">
                  <span className="size-2 animate-pulse rounded-full bg-deal" /> {auction.live ? "In diretta su TikTok" : "Asta aperta"}
                </span>
              ) : (
                <span className={live ? "text-chrome-400" : "text-chrome-500"}>
                  {auction.phase === "SCHEDULED" ? "Prossima asta" : "Asta chiusa"}
                </span>
              )}
              {auction.live && <Radio className="size-3.5" />}
            </p>
            <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{auction.beat.title}</h1>
            <p className={cn("text-sm", live ? "text-chrome-300" : "text-chrome-500")}>
              Esclusiva · {auction.beat.bpm} BPM · {auction.beat.producers.map((p) => p.name).join(" & ")}
            </p>
          </div>
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-4">
          <div>
            <p className={cn("text-[11px] font-semibold", live ? "text-chrome-400" : "text-chrome-500")}>
              {auction.topBidCents ? "Offerta più alta" : "Base d'asta"}
            </p>
            <p className={cn("font-display text-4xl font-semibold tabular-nums sm:text-5xl", live && "text-white")}>
              {formatEuro(auction.topBidCents ?? auction.startPriceCents)}
            </p>
            {auction.leader && (
              <p className={cn("mt-2 inline-flex items-center gap-2 text-sm font-semibold", live ? "text-electric-cyan" : "text-electric")}>
                {auction.viewer?.isLeader || auction.viewer?.isWinner ? "Tu" : auction.leader}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className={cn("text-[11px] font-semibold", live ? "text-chrome-400" : "text-chrome-500")}>
              {open ? (auction.phase === "SCHEDULED" ? "Apre tra" : "Chiude tra") : "Stato"}
            </p>
            {open ? (
              <Countdown
                to={auction.phase === "SCHEDULED" ? auction.startsAt : auction.endsAt}
                className={cn(" text-4xl font-semibold tabular-nums sm:text-5xl", live && endsIn < 60 ? "text-deal" : live ? "text-electric-cyan" : "")}
              />
            ) : (
              <p className="font-display text-2xl font-semibold">
                {auction.status === "PAID" ? "Venduta" : auction.status === "UNSOLD" ? "Invenduta" : "In attesa di pagamento"}
              </p>
            )}
            {live && endsIn < AUCTION.antiSnipeSeconds && (
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-deal">
                <Timer className="size-3.5" /> Ogni offerta allunga di {AUCTION.antiSnipeSeconds}s
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-8">
          {auction.viewer?.payBy ? (
            <div className="space-y-4">
              <p className="rounded-2xl bg-ok/15 px-4 py-4 text-sm font-semibold text-ok">
                Hai vinto l&apos;esclusiva! Completa il pagamento entro <Countdown to={auction.viewer.payBy} className="" />, poi passa
                al secondo offerente.
              </p>
              <ChromeButton
                variant="electric"
                size="lg"
                className="w-full"
                disabled={pay.isPending}
                onClick={() => pay.mutate({ url: "/api/checkout", body: { purpose: "AUCTION", auctionId: auction.id } }, { onSuccess: () => void qc.invalidateQueries({ queryKey: key }) })}
              >
                {pay.isPending ? <Loader2 className="size-4 animate-spin" /> : `Paga ${formatEuro(auction.topBidCents ?? 0)}`}
              </ChromeButton>
              {pay.error && <p className="text-center text-sm text-deal">{pay.error.message}</p>}
            </div>
          ) : auction.viewer?.isWinner && auction.status === "PAID" ? (
            <p className="rounded-2xl bg-ok/15 px-4 py-4 text-sm font-semibold text-ok">
              L&apos;esclusiva è tua: trovi il beat con licenza Unlimited in Libreria. Ti mandiamo il contratto via email.
            </p>
          ) : canBid ? (
            <div className="space-y-4">
              {auction.viewer?.isLeader && (
                <p className="rounded-2xl bg-electric/15 px-4 py-2 text-sm font-semibold text-electric-cyan">Sei in testa: resta sintonizzato.</p>
              )}
              {!live && auction.viewer?.earlyAccess && (
                <p className="rounded-2xl bg-electric/10 px-4 py-2 text-sm font-semibold text-electric">
                  Prelazione {viewer?.level.name}: puoi offrire prima dell&apos;apertura.
                </p>
              )}
              <div className="flex gap-2">
                {[0, 2500, 5000, 10000].map((extra) => {
                  const value = auction.minNextBidCents + extra;
                  return (
                    <button
                      key={extra}
                      type="button"
                      onClick={() => setAmount(value)}
                      className={cn(
                        "h-10 flex-1 rounded-full text-[13px] font-semibold tabular-nums transition",
                        bid === value ? "bg-electric text-white" : live ? "bg-white/10 text-chrome-100" : "chrome-surface text-graphite-700",
                      )}
                    >
                      {formatEuro(value).replace(",00", "")}
                    </button>
                  );
                })}
              </div>
              <ChromeButton
                variant="electric"
                size="lg"
                className="w-full"
                disabled={pending || auction.viewer?.isLeader}
                onClick={() => (viewer ? placeBid(bid) : window.location.assign("/beats/accedi"))}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : (
                  <>
                    <Gavel className="size-4" /> Offri {formatEuro(bid)}
                  </>
                )}
              </ChromeButton>
              {error && (
                <p role="alert" className="text-center text-sm text-deal">
                  {error}
                </p>
              )}
            </div>
          ) : auction.phase === "SCHEDULED" ? (
            <p className="rounded-2xl bg-chrome-100 px-4 py-4 text-sm text-chrome-500">
              L&apos;asta apre il {new Date(auction.startsAt).toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.
              Dal livello Gold puoi offrire con 24 ore di anticipo.
            </p>
          ) : (
            <ChromeLink href="/beats/aste" variant="chrome" className="w-full">
              Vedi le altre aste
            </ChromeLink>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-[28px] p-6" aria-labelledby="offerte">
          <h2 id="offerte" className="font-display text-lg font-semibold">
            Offerte <span className="text-chrome-400">· {auction.bidCount}</span>
          </h2>
          <ol className="mt-4 space-y-2" aria-live="polite">
            {auction.bids.map((b, i) => (
              <li key={`${b.at}-${b.amountCents}`} className={cn("flex items-center justify-between rounded-2xl px-4 py-2", i === 0 ? "bg-electric/10" : "bg-white/50")}>
                <span className="flex items-center gap-2 font-semibold">
                  {b.artist}
                </span>
                <span className="font-semibold tabular-nums">{formatEuro(b.amountCents)}</span>
              </li>
            ))}
            {!auction.bids.length && <li className="text-sm text-chrome-500">Nessuna offerta: la prima parte da {formatEuro(auction.startPriceCents)}.</li>}
          </ol>
        </section>
        <section className="glass rounded-[28px] p-6 text-sm text-chrome-500">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-graphite">
            <ShieldCheck className="size-4 text-electric" /> Come funziona
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Rilancio minimo {formatEuro(auction.minIncrementCents)}.</li>
            <li>Un&apos;offerta nell&apos;ultimo minuto allunga l&apos;asta di {AUCTION.antiSnipeSeconds} secondi.</li>
            <li>Chi vince paga entro {AUCTION.paymentHours} ore, altrimenti l&apos;esclusiva passa al secondo.</li>
            <li>Ricevi trackout, contratto di esclusiva e il beat esce dal catalogo.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
