import { notFound } from "next/navigation";
import { RecorderStudio } from "@/components/beats/recorder/recorder-studio";
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
export default async function RecordPage({ searchParams }: { searchParams: Promise<{ beat?: string; progetto?: string }> }) {
  const { beat: slug, progetto } = await searchParams;
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

  return (
    <RecorderStudio
      initialBeat={initial}
      requested={!!requested}
      catalog={catalog}
      ownedIds={owned.map((b) => b.id)}
      artist={viewer?.artistName ?? viewer?.name ?? "Artista"}
      projectId={progetto && /^[\w-]{1,64}$/.test(progetto) ? progetto : undefined}
    />
  );
}
