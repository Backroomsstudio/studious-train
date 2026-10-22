import Image from "next/image";
import { HomePromos } from "@/components/beats/commerce/home-promos";
import { BeatOfTheDay } from "@/components/beats/home/beat-of-the-day";
import { ProjectsCard } from "@/components/beats/home/projects-card";
import { NewArrivals } from "@/components/beats/home/new-arrivals";
import { ResumeCard } from "@/components/beats/home/resume-card";
import { daysUntilNextDrop } from "@/lib/beats/drops";
import { Marketplace } from "@/components/beats/marketplace/marketplace";
import { ChromeLink } from "@/components/beats/ui/chrome-button";
import { parseFilters } from "@/lib/beats/filters";
import { PLANS } from "@/lib/beats/plans";
import { getBackend } from "@/lib/beats/server/backend";
import { getFacets, getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Home" };

export default async function BeatsHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const benvenuto = params.benvenuto === "1";
  const filters = parseFilters(params);
  const backend = await getBackend();
  const viewer = await getViewer();
  const [facets, result, beatOfTheDay, projects, library, arrivals, auctions] = await Promise.all([
    getFacets(),
    backend.search(filters),
    backend.beatOfTheDay(),
    viewer ? backend.projects(viewer.id) : [],
    viewer ? backend.library(viewer.id) : [],
    backend.newArrivals(),
    backend.auctions(viewer?.id ?? null),
  ]);
  const liveAuction = auctions.find((a) => a.status === "OPEN" && a.phase === "LIVE") ?? null;
  const last = library[0];
  const firstName = viewer?.artistName ?? viewer?.name.split(" ")[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="flex items-center gap-4" aria-labelledby="home-title">
        <Image
          src="/brand/logo-br-120.webp"
          alt="Backrooms Studio"
          width={72}
          height={72}
          priority
          className="obsidian size-16 shrink-0 rounded-2xl object-contain p-1.5 sm:size-[72px]"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Backrooms · Beat Store</p>
          {viewer ? (
            <h1 id="home-title" className="mt-1 font-display leading-none tracking-tight">
              <span className="block text-lg font-semibold text-chrome-500">{benvenuto ? "Benvenuto nel Beat Store," : "Bentornato,"}</span>
              {/* Il nome d'artista è il protagonista della pagina */}
              <span className="chrome-text block truncate text-[clamp(2.8rem,11vw,6rem)] font-black">{firstName}</span>
            </h1>
          ) : (
            <h1 id="home-title" className="chrome-text mt-1 font-display text-[2rem] font-black leading-none tracking-tight sm:text-5xl">
              Beat dai produttori resident
            </h1>
          )}
          <p className="mt-1.5 truncate text-sm text-chrome-500">
            {viewer
              ? viewer.plan
                ? `${PLANS[viewer.plan.tier].name} · Resident ${viewer.level.name} · ${viewer.creditBalance} crediti`
                : "Scegli un piano per ricevere i tuoi crediti ogni mese"
              : "Abbonati, ricevi crediti ogni mese e sblocca beat, stems e licenze."}
          </p>
        </div>
      </section>

      {!viewer && (
        <div className="obsidian flex flex-col gap-4 rounded-[28px] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-chrome-200">
            Da <strong className="text-white">29,90 €/mese</strong>: crediti ogni mese, rollover dei non usati, stems in WAV.
          </p>
          <ChromeLink href="/beats/piani" variant="electric">
            Scopri i piani
          </ChromeLink>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <ResumeCard lastLicense={last ? { beat: last.beat, type: last.license.type, createdAt: last.license.createdAt } : null} />
          {viewer && <ProjectsCard projects={projects} />}
        </div>
        {beatOfTheDay && <BeatOfTheDay beat={beatOfTheDay} />}
      </div>

      <NewArrivals beats={arrivals} daysToNextDrop={daysUntilNextDrop()} />

      <HomePromos auction={liveAuction} level={viewer?.level ?? null} />

      <section aria-labelledby="catalogo-title" className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 id="catalogo-title" className="font-display text-2xl font-bold tracking-tight">
            Catalogo
          </h2>
        </div>
        <Marketplace initialFilters={filters} initialResult={result} facets={facets} />
      </section>
    </div>
  );
}
