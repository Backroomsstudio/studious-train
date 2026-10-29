"use client";

import { CalendarClock, Check, Clock, Disc3, Layers, MessagesSquare, Radio, Send, SlidersVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { discounted, findTier, SERVICE_ORDER, SERVICES, type PaidWith, type ServiceKind } from "@/lib/beats/offers";
import { formatEuro } from "@/lib/beats/plans";
import type { BeatSummary, LevelInfo } from "@/lib/beats/types";
import { usePurchase, useViewer } from "../providers";
import { Dialog } from "../ui/dialog";
import { GlowBadge } from "../ui/glow-badge";
import { PayChoice } from "./pay-choice";

const ICONS: Record<ServiceKind, typeof Disc3> = {
  HIT_PACKAGE: Layers,
  MIX_MASTER: SlidersVertical,
  FEEDBACK: MessagesSquare,
  LIVE_SLOT: Radio,
  RELEASE: Send,
};

type BeatOption = Pick<BeatSummary, "id" | "slug" | "title">;

interface Selection {
  kind: ServiceKind;
  tierId: string;
}

/** Prezzo da mostrare su una scheda: carta (con sconto livello) e/o crediti. */
function TierPrice({ kind, tierId, discountPct }: Selection & { discountPct: number }) {
  const tier = findTier(kind, tierId)!;
  const pct = SERVICES[kind].levelDiscount ? discountPct : 0;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
      {tier.priceCents !== null && (
        <span className="font-display text-2xl font-semibold tracking-tight">
          {formatEuro(discounted(tier.priceCents, pct))}
          {pct > 0 && <s className="ml-2 text-sm font-semibold text-chrome-400">{formatEuro(tier.priceCents)}</s>}
        </span>
      )}
      {tier.credits !== null && (
        <span className="text-sm font-semibold text-electric">
          {tier.priceCents !== null ? "o " : ""}{tier.credits} crediti
        </span>
      )}
    </p>
  );
}

export function StudioServices({
  level,
  catalogBeats,
  ownedBeats,
  preselect,
}: {
  level: LevelInfo | null;
  catalogBeats: BeatOption[];
  ownedBeats: BeatOption[];
  preselect?: { kind: ServiceKind; beatId?: string };
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [beatId, setBeatId] = useState(preselect?.beatId ?? "");
  const discountPct = level?.studioDiscountPct ?? 0;

  useEffect(() => {
    if (!preselect) return;
    document.getElementById(`servizio-${preselect.kind}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preselect]);

  return (
    <>
      <div className="space-y-12">
        {SERVICE_ORDER.map((kind) => {
          const service = SERVICES[kind];
          const Icon = ICONS[kind];
          const hero = kind === "HIT_PACKAGE";
          return (
            <section key={kind} id={`servizio-${kind}`} aria-labelledby={`t-${kind}`} className="scroll-mt-24 space-y-4">
              <div className="flex items-start gap-4">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", hero ? "obsidian text-electric-cyan" : "chrome-surface text-electric")}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 id={`t-${kind}`} className="font-display text-2xl font-semibold tracking-tight">
                    {service.name}
                    {hero && <GlowBadge tone="holo" className="ml-2 align-middle">Il più completo</GlowBadge>}
                  </h2>
                  <p className="text-[15px] text-chrome-500">{service.tagline}</p>
                </div>
              </div>
              <div className={cn("grid gap-4", service.tiers.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
                {service.tiers.map((tier, i) => {
                  const featured = hero && i === 1;
                  return (
                    <article
                      key={tier.id}
                      className={cn("flex flex-col rounded-[24px] p-6", featured ? "obsidian ring-1 ring-electric/50" : "glass")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-lg font-semibold">{tier.name}</h3>
                        {tier.days !== null ? (
                          <span className={cn("inline-flex items-center gap-2 text-xs font-semibold", featured ? "text-chrome-300" : "text-chrome-500")}>
                            <Clock className="size-3.5" /> {tier.days} gg
                          </span>
                        ) : (
                          <span className={cn("inline-flex items-center gap-2 text-xs font-semibold", featured ? "text-chrome-300" : "text-chrome-500")}>
                            <CalendarClock className="size-3.5" /> su prenotazione
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-2 text-sm", featured ? "text-chrome-300" : "text-chrome-500")}>{tier.detail}</p>
                      <div className="mt-4">
                        <TierPrice kind={kind} tierId={tier.id} discountPct={discountPct} />
                      </div>
                      <ul className="mt-4 flex-1 space-y-2 text-sm">
                        {tier.includes.map((inc) => (
                          <li key={inc} className="flex gap-2">
                            <Check className={cn("mt-0 size-4 shrink-0", featured ? "text-electric-cyan" : "text-electric")} /> {inc}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setSelection({ kind, tierId: tier.id })}
                        className={cn(
                          " mt-6 h-12 rounded-full text-sm font-semibold transition active:scale-[0.97]",
                          featured ? "bg-electric text-white" : "chrome-surface text-graphite",
                        )}
                      >
                        Prenota {tier.name}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selection && (
        <ServiceDialog
          selection={selection}
          onClose={() => setSelection(null)}
          discountPct={discountPct}
          beats={selection.kind === "RELEASE" ? ownedBeats : catalogBeats}
          beatId={beatId}
          onBeat={setBeatId}
        />
      )}
    </>
  );
}

function ServiceDialog({
  selection,
  onClose,
  discountPct,
  beats,
  beatId,
  onBeat,
}: {
  selection: Selection;
  onClose: () => void;
  discountPct: number;
  beats: BeatOption[];
  beatId: string;
  onBeat: (id: string) => void;
}) {
  const service = SERVICES[selection.kind];
  const tier = findTier(selection.kind, selection.tierId)!;
  const { data: viewer } = useViewer();
  const purchase = usePurchase();
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<PaidWith | null>(null);
  const pct = service.levelDiscount ? discountPct : 0;
  const minDate = useMemo(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), []);
  const done = purchase.data?.kind === "done" ? purchase.data.message : null;

  const pay = (paidWith: PaidWith) => {
    setMethod(paidWith);
    purchase.mutate(
      {
        url: "/api/services",
        body: {
          kind: selection.kind,
          tierId: selection.tierId,
          beatId: service.needsBeat ? beatId || undefined : undefined,
          notes,
          scheduledFor: service.needsSchedule && date ? new Date(`${date}T18:00:00`).toISOString() : undefined,
          paidWith,
        },
      },
      { onSettled: () => setMethod(null) },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${service.name} · ${tier.name}`}
      description={tier.detail}
    >
      {done ? (
        <div className="space-y-4 text-center">
          <p className="mx-auto grid size-14 place-items-center rounded-full bg-ok/10 text-ok">
            <Check className="size-7" />
          </p>
          <p className="font-display text-lg font-semibold">{done}</p>
          <p className="text-sm text-chrome-500">Trovi l&apos;ordine nella tua Libreria.</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {service.needsBeat && (
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold text-chrome-500">
                {selection.kind === "RELEASE" ? "Il pezzo da far uscire (beat con licenza)" : "Il beat da trasformare in hit"}
              </span>
              <select
                value={beatId}
                onChange={(e) => onBeat(e.target.value)}
                className="chrome-surface h-12 w-full rounded-2xl px-4 text-[15px] font-semibold outline-none"
              >
                <option value="">Scegli un beat…</option>
                {beats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
              {selection.kind === "RELEASE" && !beats.length && (
                <span className="mt-2 block text-xs text-chrome-500">Prima sblocca una licenza sul beat che vuoi pubblicare.</span>
              )}
            </label>
          )}
          {service.needsSchedule && (
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold text-chrome-500">
                {selection.kind === "LIVE_SLOT" ? "Serata della live" : "Data preferita"}
              </span>
              <input
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="chrome-surface h-12 w-full rounded-2xl px-4 text-[15px] outline-none"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-chrome-500">Raccontaci il progetto</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={
                selection.kind === "MIX_MASTER"
                  ? "Quante tracce, riferimenti, che suono cerchi…"
                  : selection.kind === "LIVE_SLOT"
                    ? "Titolo del pezzo e link (SoundCloud, Drive…)"
                    : "Che pezzo vuoi fare, riferimenti, scadenze…"
              }
              className="glass w-full rounded-2xl px-4 py-4 text-[15px] outline-none focus:ring-2 focus:ring-electric/40"
            />
          </label>
          {pct > 0 && (
            <p className="rounded-2xl bg-electric/10 px-4 py-2 text-sm font-semibold text-electric">
              Sconto Resident {viewer?.level.name}: -{pct}% sul prezzo in euro
            </p>
          )}
          <PayChoice
            credits={tier.credits}
            priceCents={tier.priceCents === null ? null : discounted(tier.priceCents, pct)}
            originalCents={tier.priceCents ?? undefined}
            balance={viewer?.creditBalance ?? null}
            pending={purchase.isPending ? method : null}
            onPay={pay}
            label="Prenota"
          />
          {purchase.error && (
            <p role="alert" className="text-center text-sm text-deal">
              {purchase.error.message}
            </p>
          )}
          <p className="text-center text-xs text-chrome-500">Ti contattiamo entro 24 ore per i dettagli. Pagamento sicuro con Stripe.</p>
        </form>
      )}
    </Dialog>
  );
}
