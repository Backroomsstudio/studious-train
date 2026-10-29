"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Gift, Loader2, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { CREDIT_PACKS, GIFT_CARDS, packCredits } from "@/lib/beats/offers";
import { formatEuro, PLAN_ORDER, PLANS, YEARLY_PRICES, yearlySavingCents, type PlanInterval, type PlanTier } from "@/lib/beats/plans";
import type { Viewer } from "@/lib/beats/types";
import { feedback } from "@/lib/beats/ui-feedback";
import { BillingButton } from "../library/billing-button";
import { api, ApiRequestError, usePurchase, useViewer } from "../providers";
import { ChromeButton } from "../ui/chrome-button";
import { GlowBadge } from "../ui/glow-badge";

/** Piani con selettore mensile / annuale (2 mesi in regalo). */
export function PlanGrid({ currentTier }: { currentTier?: PlanTier }) {
  const [interval, setBilling] = useState<PlanInterval>("MONTH");
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Fatturazione" className="chrome-surface mx-auto flex w-fit gap-2 rounded-full p-2">
        {(["MONTH", "YEAR"] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            onClick={() => setBilling(i)}
            className={cn(
              "h-10 rounded-full px-6 text-sm font-semibold transition",
              interval === i ? "bg-graphite text-white" : "text-graphite-700",
            )}
          >
            {i === "MONTH" ? "Mensile" : "Annuale · 2 mesi gratis"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const plan = PLANS[tier];
          const current = tier === currentTier;
          const yearly = interval === "YEAR";
          return (
            <article
              key={tier}
              className={cn("relative flex flex-col rounded-[28px] p-6", plan.highlighted ? "obsidian ring-1 ring-electric/50" : "glass")}
            >
              {plan.highlighted && (
                <GlowBadge tone="electric" className="absolute right-5 top-5 bg-electric text-white">
                  Il più scelto
                </GlowBadge>
              )}
              <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold tracking-tight">{formatEuro(yearly ? YEARLY_PRICES[tier] : plan.priceCents)}</span>
                <span className={cn("text-sm", plan.highlighted ? "text-chrome-400" : "text-chrome-500")}>{yearly ? "/anno" : "/mese"}</span>
              </p>
              {yearly && (
                <p className="mt-2 text-sm font-semibold text-ok">
                  Risparmi {formatEuro(yearlySavingCents(tier))} · {formatEuro(Math.round(YEARLY_PRICES[tier] / 12))}/mese
                </p>
              )}
              <p className={cn("mt-2 inline-flex items-center gap-2 text-sm font-semibold", plan.highlighted ? "text-electric-cyan" : "text-electric")}> {plan.monthlyCredits} crediti / mese
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <Check className={cn("mt-0 size-4 shrink-0", plan.highlighted ? "text-electric-cyan" : "text-electric")} /> {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <BillingButton variant={plan.highlighted ? "chrome" : "obsidian"}>Gestisci il piano</BillingButton>
                ) : (
                  <BillingButton tier={tier} interval={interval} variant={plan.highlighted ? "electric" : "obsidian"}>
                    {currentTier ? `Passa a ${plan.name}` : `Scegli ${plan.name}`}
                  </BillingButton>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Ricariche oneste: pochi pacchetti, bonus dichiarato, crediti che non scadono. */
export function TopupPacks({ viewer }: { viewer: Viewer | null }) {
  const purchase = usePurchase();
  const [packId, setPackId] = useState<string | null>(null);
  return (
    <section aria-labelledby="ricariche" className="glass rounded-[28px] p-6 sm:p-6">
      <h2 id="ricariche" className="font-display text-xl font-semibold">Ricarica crediti</h2>
      <p className="mt-2 text-sm text-chrome-500">
        Finiti i crediti del mese? Le ricariche non scadono mai e si usano dopo quelli dell&apos;abbonamento. L&apos;abbonamento resta il modo più
        conveniente.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            disabled={purchase.isPending}
            onClick={() => {
              if (!viewer) return window.location.assign("/beats/accedi?nuovo=1");
              setPackId(pack.id);
              purchase.mutate({ url: "/api/checkout", body: { purpose: "TOPUP", packId: pack.id } });
            }}
            className="chrome-surface flex flex-col items-start rounded-[22px] p-4 text-left transition disabled:opacity-60"
          >
            <span className="text-2xl font-semibold tabular-nums text-graphite">
              {packCredits(pack)} <span className="text-base font-normal text-chrome-500">crediti</span>
            </span>
            {pack.bonus > 0 && <span className="mt-2 text-xs font-semibold text-ok">+{pack.bonus} bonus inclusi</span>}
            <span className="mt-4 font-display text-lg font-semibold">
              {purchase.isPending && packId === pack.id ? <Loader2 className="size-4 animate-spin" /> : formatEuro(pack.priceCents)}
            </span>
          </button>
        ))}
      </div>
      {purchase.data?.kind === "done" && <p className="mt-4 text-sm font-semibold text-ok">{purchase.data.message}</p>}
      {purchase.error && <p role="alert" className="mt-4 text-sm text-deal">{purchase.error.message}</p>}
    </section>
  );
}

/** Gift card di crediti: per compleanni, Natale o per il rapper del tuo gruppo. */
export function GiftShop({ viewer }: { viewer: Viewer | null }) {
  const purchase = usePurchase();
  const [cardId, setCardId] = useState(GIFT_CARDS[1].id);
  const [recipientName, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section aria-labelledby="regala" className="obsidian relative overflow-hidden rounded-[28px] p-6 sm:p-6">
      <h2 id="regala" className="relative flex items-center gap-2 font-display text-xl font-semibold">
        <Gift className="size-5 text-studio" /> Regala crediti
      </h2>
      <p className="relative mt-2 text-sm text-chrome-300">Ricevi un codice da girare a chi vuoi: lo riscatta qui e i crediti non scadono.</p>
      <div className="relative mt-4 grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Taglio della gift card">
        {GIFT_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={cardId === card.id}
            onClick={() => setCardId(card.id)}
            className={cn(
              "rounded-[20px] p-4 text-left ring-1 transition",
              cardId === card.id ? "bg-white/15 ring-studio" : "bg-white/5 ring-white/10",
            )}
          >
            <span className="block text-xl font-semibold">{packCredits(card)} crediti</span>
            {card.bonus > 0 && <span className="text-xs font-semibold text-studio">+{card.bonus} in regalo</span>}
            <span className="mt-2 block font-display font-semibold">{formatEuro(card.priceCents)}</span>
          </button>
        ))}
      </div>
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
        <input
          value={recipientName}
          onChange={(e) => setRecipient(e.target.value)}
          maxLength={60}
          placeholder="Per chi è? (facoltativo)"
          className="h-12 rounded-2xl bg-white/10 px-4 text-[15px] text-white outline-none placeholder:text-chrome-400 focus:ring-2 focus:ring-studio/60"
        />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={400}
          placeholder="Un messaggio (facoltativo)"
          className="h-12 rounded-2xl bg-white/10 px-4 text-[15px] text-white outline-none placeholder:text-chrome-400 focus:ring-2 focus:ring-studio/60"
        />
      </div>
      <ChromeButton
        variant="chrome"
        size="lg"
        className="relative mt-4 w-full"
        disabled={purchase.isPending}
        onClick={() =>
          viewer
            ? purchase.mutate({ url: "/api/checkout", body: { purpose: "GIFT", cardId, recipientName: recipientName || undefined, message: message || undefined } })
            : window.location.assign("/beats/accedi?nuovo=1")
        }
      >
        {purchase.isPending ? <Loader2 className="size-4 animate-spin" /> : "Compra la gift card"}
      </ChromeButton>
      {purchase.data?.kind === "done" && <p className="relative mt-4 text-sm font-semibold text-ok">{purchase.data.message}</p>}
      {purchase.error && <p role="alert" className="relative mt-4 text-sm text-deal">{purchase.error.message}</p>}
    </section>
  );
}

export function RedeemGift() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<{ ok?: string; error?: string; pending?: boolean }>({});
  const qc = useQueryClient();
  const router = useRouter();
  const { data: viewer } = useViewer();

  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    if (!viewer) return window.location.assign("/beats/accedi");
    setState({ pending: true });
    try {
      const res = await api<{ credits: number; balance: number }>("/api/gift/redeem", { method: "POST", body: JSON.stringify({ code }) });
      qc.setQueryData<Viewer | null>(["viewer"], (v) => (v ? { ...v, creditBalance: res.balance } : v));
      feedback("coin");
      setState({ ok: `+${res.credits} crediti nel tuo portafoglio.` });
      setCode("");
      router.refresh();
    } catch (error) {
      feedback("error");
      setState({ error: error instanceof ApiRequestError ? error.message : "Errore di rete, riprova." });
    }
  };

  return (
    <form onSubmit={redeem} className="glass self-start rounded-[28px] p-6 sm:p-6" aria-labelledby="riscatta">
      <h2 id="riscatta" className="flex items-center gap-2 font-display text-xl font-semibold">
        <Ticket className="size-5 text-electric" /> Hai un codice regalo?
      </h2>
      <div className="mt-4 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="BR-XXXX-XXXX"
          aria-label="Codice della gift card"
          autoCapitalize="characters"
          className="chrome-surface h-12 min-w-0 flex-1 rounded-2xl px-4 text-[15px] outline-none focus:ring-2 focus:ring-electric/40"
        />
        <ChromeButton type="submit" variant="obsidian" size="md" className="h-12" disabled={state.pending || code.trim().length < 6}>
          {state.pending ? <Loader2 className="size-4 animate-spin" /> : "Riscatta"}
        </ChromeButton>
      </div>
      {state.ok && <p className="mt-2 text-sm font-semibold text-ok">{state.ok}</p>}
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-deal">
          {state.error}
        </p>
      )}
    </form>
  );
}
