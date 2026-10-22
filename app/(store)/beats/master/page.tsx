import { Headphones } from "lucide-react";
import type { Metadata } from "next";
import { MasterStudio } from "@/components/beats/master/master-studio";
import { ChromeLink } from "@/components/beats/ui/chrome-button";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { SERVICES } from "@/lib/beats/offers";
import { formatEuro } from "@/lib/beats/plans";
import { getBackend } from "@/lib/beats/server/backend";

export const metadata: Metadata = {
  title: "Master A/B",
  description: "Masterizza la tua demo nel browser e confronta prima e dopo: più forte, più compatta, più brillante.",
};

/** Master A/B: anteprima del master automatico, con il master vero dello studio come passo successivo. */
export default async function MasterPage({ searchParams }: { searchParams: Promise<{ sorgente?: string }> }) {
  const { sorgente } = await searchParams;
  const { items } = await (await getBackend()).search({ ...DEFAULT_FILTERS, sort: "new" });
  const beats = items.slice(0, 6).map((b) => ({
    id: b.id,
    title: b.title,
    bpm: b.bpm,
    by: b.producers.map((p) => p.name).join(" & "),
  }));
  const [solo, mix] = SERVICES.MIX_MASTER.tiers;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Anteprima del master</p>
        <h1 className="chrome-text mt-1 font-display text-[clamp(2.4rem,7vw,4rem)] font-black leading-none tracking-tight">Prima e dopo</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-chrome-500">
          Carica il tuo mix e senti come suonerebbe masterizzato: più forte, più compatto, più brillante. Il file resta sul tuo
          dispositivo, il master si fa qui nel browser.
        </p>
      </div>

      <MasterStudio beats={beats} autoDemo={sorgente === "demo"} />

      <section className="glass flex flex-wrap items-center gap-4 rounded-[28px] p-5 sm:p-6" aria-labelledby="master-vero">
        <span className="chrome-surface grid size-12 shrink-0 place-items-center rounded-2xl text-electric">
          <Headphones className="size-5" />
        </span>
        <div className="min-w-[200px] flex-1">
          <h2 id="master-vero" className="font-display text-lg font-bold">
            Il master vero, fatto a orecchio
          </h2>
          <p className="text-sm text-chrome-500">
            Astral, Freya o Plugghe ascoltano il tuo pezzo e lo portano al volume degli store, con una revisione inclusa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChromeLink href="/beats/studio?servizio=MIX_MASTER" variant="electric">
            {solo.name} · {formatEuro(solo.priceCents ?? 0)}
            {solo.credits ? ` o ${solo.credits} crediti` : ""}
          </ChromeLink>
          <ChromeLink href="/beats/studio?servizio=MIX_MASTER" variant="obsidian">
            {mix.name} · {formatEuro(mix.priceCents ?? 0)}
          </ChromeLink>
        </div>
      </section>
    </div>
  );
}
