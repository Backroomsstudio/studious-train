import { Gavel, Package } from "lucide-react";
import Link from "next/link";
import { LevelCard } from "@/components/beats/commerce/level-card";
import { StudioServices } from "@/components/beats/commerce/studio-services";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { SERVICE_ORDER, type ServiceKind } from "@/lib/beats/offers";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Studio" };

/** Servizi dello studio: dal pacchetto "dal beat alla hit" al feedback 1:1 e agli slot in live. */
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ servizio?: string; beat?: string }> }) {
  const { servizio, beat } = await searchParams;
  const viewer = await getViewer();
  const backend = await getBackend();
  const [catalog, library] = await Promise.all([
    backend.search({ ...DEFAULT_FILTERS, sort: "new" }),
    viewer ? backend.library(viewer.id) : [],
  ]);
  const owned = [...new Map(library.map((e) => [e.beat.id, { id: e.beat.id, slug: e.beat.slug, title: e.beat.title }])).values()];
  const catalogBeats = [...new Map([...owned, ...catalog.items.map((b) => ({ id: b.id, slug: b.slug, title: b.title }))].map((b) => [b.id, b])).values()];
  const kind = SERVICE_ORDER.includes(servizio as ServiceKind) ? (servizio as ServiceKind) : undefined;
  const preselectBeat = beat ? catalogBeats.find((b) => b.slug === beat)?.id : undefined;

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Backrooms Studio · Arcugnano</p>
          <h1 className="chrome-text mt-1 font-display text-[clamp(2.4rem,7vw,4rem)] font-black leading-none tracking-tight">
            Dal beat alla hit
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-chrome-500">
            Tre produttori, uno studio, tutto quello che serve per far uscire il tuo pezzo: registrazione, mix, master, copertina e lancio.
          </p>
        </div>
        {viewer && <LevelCard level={viewer.level} compact />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/beats/kit" className="glass group flex items-center gap-4 rounded-[24px] p-4 transition hover:shadow-glow-sm">
          <span className="chrome-surface grid size-12 place-items-center rounded-2xl text-electric">
            <Package className="size-5" />
          </span>
          <span>
            <span className="block font-display font-bold">Kit, sample e preset</span>
            <span className="text-sm text-chrome-500">I suoni dei nostri beat, da 6 crediti</span>
          </span>
        </Link>
        <Link href="/beats/aste" className="obsidian group flex items-center gap-4 rounded-[24px] p-4 transition hover:shadow-glow-sm">
          <span className="grid size-12 place-items-center rounded-2xl bg-electric/20 text-electric-cyan">
            <Gavel className="size-5" />
          </span>
          <span>
            <span className="block font-display font-bold">Aste delle esclusive</span>
            <span className="text-sm text-chrome-400">Anche in diretta su TikTok</span>
          </span>
        </Link>
      </div>

      <StudioServices
        level={viewer?.level ?? null}
        catalogBeats={catalogBeats}
        ownedBeats={owned}
        preselect={kind ? { kind, beatId: preselectBeat } : undefined}
      />
    </div>
  );
}
