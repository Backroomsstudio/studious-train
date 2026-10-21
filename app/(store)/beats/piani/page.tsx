import { Check, Zap } from "lucide-react";
import { BillingButton } from "@/components/beats/library/billing-button";
import { GlowBadge } from "@/components/beats/ui/glow-badge";
import { cn } from "@/lib/cn";
import { LICENSE_ORDER, LICENSES } from "@/lib/beats/licenses";
import { formatEuro, PLAN_ORDER, PLANS } from "@/lib/beats/plans";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Piani" };

export default async function PlansPage() {
  const viewer = await getViewer();
  const currentTier = viewer?.plan?.tier;

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Abbonamento</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight sm:text-5xl">Crediti ogni mese</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-chrome-500">
          Ogni mese ricevi crediti da spendere su beat, WAV e stems. Quelli che non usi passano al mese dopo (fino al tetto del piano).
          Cambi piano o disdici quando vuoi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const plan = PLANS[tier];
          const current = tier === currentTier;
          return (
            <article
              key={tier}
              className={cn(
                "relative flex flex-col rounded-[28px] p-6",
                plan.highlighted ? "obsidian ring-1 ring-electric/50 shadow-glow" : "glass",
              )}
            >
              {plan.highlighted && (
                <GlowBadge tone="electric" className="absolute right-5 top-5 bg-electric text-white">
                  Il più scelto
                </GlowBadge>
              )}
              <h2 className="font-display text-xl font-bold">{plan.name}</h2>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-black tracking-tight">{formatEuro(plan.priceCents)}</span>
                <span className={cn("text-sm", plan.highlighted ? "text-chrome-400" : "text-chrome-500")}>/mese</span>
              </p>
              <p className={cn("mt-2 inline-flex items-center gap-1.5 font-mono text-sm font-bold", plan.highlighted ? "text-electric-cyan" : "text-electric")}>
                <Zap className="size-4 fill-current" /> {plan.monthlyCredits} crediti / mese
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <Check className={cn("mt-0.5 size-4 shrink-0", plan.highlighted ? "text-electric-cyan" : "text-electric")} /> {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <BillingButton variant={plan.highlighted ? "chrome" : "obsidian"}>Gestisci il piano</BillingButton>
                ) : (
                  <BillingButton tier={tier} variant={plan.highlighted ? "electric" : "obsidian"}>
                    {currentTier ? `Passa a ${plan.name}` : `Scegli ${plan.name}`}
                  </BillingButton>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section aria-labelledby="licenze-title" className="glass rounded-[28px] p-5 sm:p-6">
        <h2 id="licenze-title" className="font-display text-xl font-bold">Quanto costa ogni licenza</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-chrome-500">
              <tr>
                <th className="py-2 font-bold">Licenza</th>
                <th className="py-2 font-bold">Crediti</th>
                <th className="py-2 font-bold">File</th>
                <th className="py-2 font-bold">Stream</th>
                <th className="py-2 font-bold">Piani</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-200">
              {LICENSE_ORDER.map((type) => {
                const l = LICENSES[type];
                return (
                  <tr key={type}>
                    <td className="py-3 font-semibold">{l.name}</td>
                    <td className="py-3 font-mono font-bold text-electric">{l.credits}</td>
                    <td className="py-3 text-chrome-500">{l.assets.join(" + ")}</td>
                    <td className="py-3 text-chrome-500">{l.terms.streams ? l.terms.streams.toLocaleString("it-IT") : "Illimitati"}</td>
                    <td className="py-3 text-chrome-500">
                      {PLAN_ORDER.filter((t) => PLANS[t].licenses.includes(type))
                        .map((t) => PLANS[t].name)
                        .join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-chrome-500">Le esclusive non passano dai crediti: scrivici per trattare direttamente con i produttori.</p>
      </section>
    </div>
  );
}
