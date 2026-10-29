import Link from "next/link";
import { HomeHero } from "@/components/beats/home/home-hero";
import { NewArrivals } from "@/components/beats/home/new-arrivals";
import { ProjectsCard } from "@/components/beats/home/projects-card";
import { ResumeCard } from "@/components/beats/home/resume-card";
import { ZoneGrid } from "@/components/beats/home/zone-grid";
import { TrackList } from "@/components/beats/marketplace/track-row";
import { ChromeLink } from "@/components/beats/ui/chrome-button";
import { RevealList } from "@/components/beats/ui/reveal";
import { daysUntilNextDrop } from "@/lib/beats/drops";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { PLANS } from "@/lib/beats/plans";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Home" };

/**
 * Home: il riassunto di tutta l'app. In alto l'artista (nome, piano, crediti, livello e quanto
 * manca al prossimo), poi le zone con un dato vivo, la ripresa dell'ultimo beat e le novità.
 * Il catalogo completo sta in Cerca.
 */
export default async function BeatsHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const backend = await getBackend();
  const viewer = await getViewer();
  const [latest, popular, projects, library, arrivals, auctions, products] = await Promise.all([
    backend.search({ ...DEFAULT_FILTERS, sort: "new" }),
    backend.search({ ...DEFAULT_FILTERS, sort: "popular" }),
    viewer ? backend.projects(viewer.id) : [],
    viewer ? backend.library(viewer.id) : [],
    backend.newArrivals(),
    backend.auctions(viewer?.id ?? null),
    backend.products(viewer?.id ?? null),
  ]);
  const open = auctions.filter((a) => a.status === "OPEN" && a.phase !== "ENDED");
  const last = library[0];
  const name = viewer?.artistName ?? viewer?.name.split(" ")[0] ?? "";

  return (
    <RevealList className="space-y-6 lg:space-y-8">
      {viewer ? (
        <HomeHero
          name={name}
          planName={viewer.plan ? PLANS[viewer.plan.tier].name : null}
          credits={viewer.creditBalance}
          level={viewer.level}
          welcome={params.benvenuto === "1"}
        />
      ) : (
        <section className="obsidian flex flex-col gap-4 rounded-[32px] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-[11px] font-semibold text-[#c9c9ce]">Backrooms · Beat Store</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">Beat dai produttori resident</h1>
            <p className="mt-2 text-[15px] text-chrome-300">
              Da <strong className="text-white">29,90 €/mese</strong>: crediti ogni mese, rollover dei non usati, stems in WAV.
            </p>
          </div>
          <ChromeLink href="/beats/piani" variant="electric">
            Scopri i piani
          </ChromeLink>
        </section>
      )}

      <ZoneGrid
        swipeBeats={popular.items.slice(0, 3)}
        openAuctions={open.length}
        liveAuction={open.some((a) => a.phase === "LIVE")}
        kitCount={products.length}
        unlocked={new Set(library.map((e) => e.beat.id)).size}
      />

      {viewer && (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <ResumeCard lastLicense={last ? { beat: last.beat, type: last.license.type, createdAt: last.license.createdAt } : null} />
          <ProjectsCard projects={projects} />
        </div>
      )}

      <NewArrivals beats={arrivals} daysToNextDrop={daysUntilNextDrop()} />

      <section aria-labelledby="ultimi-title" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="ultimi-title" className="font-display text-2xl font-semibold tracking-tight">
            Ultimi beat
          </h2>
          <Link href="/beats/cerca" className="text-sm font-semibold text-electric hover:underline">
            Tutto il catalogo
          </Link>
        </div>
        <TrackList beats={latest.items.slice(0, 8)} />
      </section>
    </RevealList>
  );
}
