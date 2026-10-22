import { AuctionCard } from "@/components/beats/commerce/auction-card";
import { RevealList } from "@/components/beats/ui/reveal";
import { AUCTION } from "@/lib/beats/offers";
import { formatEuro } from "@/lib/beats/plans";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Aste delle esclusive" };

export default async function AuctionsPage() {
  const viewer = await getViewer();
  const auctions = await (await getBackend()).auctions(viewer?.id ?? null);
  const open = auctions.filter((a) => a.status === "OPEN" && a.phase === "LIVE");
  const upcoming = auctions.filter((a) => a.status === "OPEN" && a.phase === "SCHEDULED");
  const closed = auctions.filter((a) => a.status !== "OPEN");

  return (
    <RevealList className="space-y-8" items="li, article, [data-reveal], section > a">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Esclusive</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight sm:text-5xl">Aste dei beat</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-chrome-500">
          Un solo artista porta a casa il beat, per sempre. Le aste partono da {formatEuro(AUCTION.startPriceCents)} e spesso le facciamo in
          diretta su TikTok: offri da qui, le offerte compaiono in live.
        </p>
      </div>

      {open.length > 0 && (
        <section aria-labelledby="aste-live" className="space-y-3">
          <h2 id="aste-live" className="font-display text-xl font-bold">In corso</h2>
          {open.map((a) => (
            <AuctionCard key={a.id} auction={a} large />
          ))}
        </section>
      )}
      {upcoming.length > 0 && (
        <section aria-labelledby="aste-next" className="space-y-3">
          <h2 id="aste-next" className="font-display text-xl font-bold">In arrivo</h2>
          {upcoming.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </section>
      )}
      {closed.length > 0 && (
        <section aria-labelledby="aste-closed" className="space-y-3">
          <h2 id="aste-closed" className="font-display text-xl font-bold">Concluse</h2>
          {closed.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </section>
      )}
      {!auctions.length && <p className="glass rounded-2xl p-5 text-sm text-chrome-500">Nessuna asta in programma: seguici su TikTok per la prossima.</p>}
    </RevealList>
  );
}
