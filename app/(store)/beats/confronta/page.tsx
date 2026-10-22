import { CompareView } from "@/components/beats/engage/compare-view";
import { rankCandidates } from "@/lib/beats/compare";
import { getBackend } from "@/lib/beats/server/backend";
import { loadCatalog } from "@/lib/beats/server/catalog";

export const metadata = { title: "Confronto A/B", description: "Ascolta due beat nello stesso punto e passa dall'uno all'altro all'istante." };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Confronto A/B: `?a=<slug>&b=<slug>`. Senza B si sceglie il beat più vicino per BPM e tonalità. */
export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const backend = await getBackend();
  const [catalog, fromA, fromB] = await Promise.all([
    loadCatalog("new"),
    one(params.a) ? backend.beatBySlug(one(params.a)!) : null,
    one(params.b) ? backend.beatBySlug(one(params.b)!) : null,
  ]);
  const a = fromA ?? catalog[0];
  const b = a && (fromB && fromB.id !== a.id ? fromB : rankCandidates(a, catalog, 1)[0]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Confronto istantaneo</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight">A o B?</h1>
      </div>
      {a && b ? (
        <CompareView a={a} b={b} catalog={[...catalog].sort((x, y) => x.title.localeCompare(y.title, "it"))} />
      ) : (
        <p className="glass rounded-2xl p-5 text-sm text-chrome-500">Servono almeno due beat nel catalogo per confrontarli.</p>
      )}
    </div>
  );
}
