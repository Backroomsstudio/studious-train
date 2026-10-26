import { notFound } from "next/navigation";
import { StudioServices } from "@/components/beats/commerce/studio-services";
import { RecorderStudio } from "@/components/beats/recorder/recorder-studio";
import { SERVICE_ORDER, type ServiceKind } from "@/lib/beats/offers";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";
import type { BeatSummary } from "@/lib/beats/types";

export const metadata = {
  title: "Registra",
  description: "Lo studio in app: registra la voce sul beat, autotune nella scala giusta, le catene voce Backrooms ed export della demo.",
};

/** Massimo di pagine del catalogo caricate per il foglio "Cambia beat". */
const MAX_PAGES = 10;

/**
 * Studio di registrazione in app. Il beat arriva da `?beat=<slug>`, altrimenti l'ultimo che possiedi
 * o il più recente del catalogo. `?progetto=<id>` riapre una demo salvata sul dispositivo.
 */
export default async function RecordPage({ searchParams }: { searchParams: Promise<{ beat?: string; progetto?: string; servizio?: string }> }) {
  const { beat: slug, progetto, servizio } = await searchParams;
  const viewer = await getViewer();
  const backend = await getBackend();

  const first = await backend.search({ ...DEFAULT_FILTERS, sort: "new" });
  const rest = await Promise.all(
    Array.from({ length: Math.min(MAX_PAGES, first.pageCount) - 1 }, (_, i) => backend.search({ ...DEFAULT_FILTERS, sort: "new", page: i + 2 })),
  );
  const library = viewer ? await backend.library(viewer.id) : [];
  const owned = library.map((e) => e.beat);
  const catalog: BeatSummary[] = [...new Map([...owned, ...first.items, ...rest.flatMap((r) => r.items)].map((b) => [b.id, b])).values()];

  const requested = slug ? ((await backend.beatBySlug(slug)) ?? null) : null;
  const initial = requested ?? owned[0] ?? catalog[0];
  if (!initial) notFound();

  // Servizi dello studio (ex pagina Studio): dopo la demo, il passo successivo è farla uscire con noi.
  const ownedRefs = [...new Map(owned.map((b) => [b.id, { id: b.id, slug: b.slug, title: b.title }])).values()];
  const catalogRefs = catalog.map((b) => ({ id: b.id, slug: b.slug, title: b.title }));
  const kind = SERVICE_ORDER.includes(servizio as ServiceKind) ? (servizio as ServiceKind) : undefined;

  return (
    <div className="space-y-12">
    <RecorderStudio
      initialBeat={initial}
      requested={!!requested}
      catalog={catalog}
      ownedIds={owned.map((b) => b.id)}
      artist={viewer?.artistName ?? viewer?.name ?? "Artista"}
      projectId={progetto && /^[\w-]{1,64}$/.test(progetto) ? progetto : undefined}
    />
      <section id="servizi" aria-labelledby="servizi-title" className="scroll-mt-24 space-y-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Backrooms Studio · Arcugnano</p>
          <h2 id="servizi-title" className="chrome-text mt-1 font-display text-[clamp(2rem,6vw,3.25rem)] font-black leading-none tracking-tight">
            Dalla demo alla hit
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-chrome-500">
            Registrazione in studio, mix, master, copertina e lancio: quando la demo ti convince, la facciamo uscire insieme.
          </p>
        </div>
        <StudioServices
          level={viewer?.level ?? null}
          catalogBeats={catalogRefs}
          ownedBeats={ownedRefs}
          preselect={kind ? { kind, beatId: requested?.id ?? initial.id } : undefined}
        />
      </section>
    </div>
  );
}
