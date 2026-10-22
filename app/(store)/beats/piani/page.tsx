import Link from "next/link";
import { GiftShop, PlanGrid, RedeemGift, TopupPacks } from "@/components/beats/commerce/plans-shop";
import { LICENSE_ORDER, LICENSES } from "@/lib/beats/licenses";
import { PLAN_ORDER, PLANS } from "@/lib/beats/plans";
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
          Cambi piano, lo metti in pausa o disdici quando vuoi. Con l&apos;annuale paghi 10 mesi e ne ricevi 12.
        </p>
      </div>

      <PlanGrid currentTier={currentTier} />

      <TopupPacks viewer={viewer} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GiftShop viewer={viewer} />
        <RedeemGift />
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
        <p className="mt-3 text-xs text-chrome-500">
          Le esclusive non passano dai crediti: si vincono nelle <Link href="/beats/aste" className="font-semibold text-electric">aste</Link>, anche in diretta su TikTok.
        </p>
      </section>
    </div>
  );
}
