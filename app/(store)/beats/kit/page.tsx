import { ProductGrid } from "@/components/beats/commerce/product-grid";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Kit e preset" };

/** Drum kit, sample pack e preset voce dei produttori resident: in crediti o con carta. */
export default async function KitPage({ searchParams }: { searchParams: Promise<{ pagato?: string }> }) {
  const { pagato } = await searchParams;
  const viewer = await getViewer();
  const products = await (await getBackend()).products(viewer?.id ?? null);

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-electric">Suoni Backrooms</p>
        <h1 className="chrome-text mt-1 font-display text-4xl font-black tracking-tight sm:text-5xl">Kit, sample e preset</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-chrome-500">
          Gli stessi suoni con cui produciamo i beat del catalogo, royalty-free. Li paghi con i crediti che hai o con carta, e restano
          tuoi per sempre.
        </p>
      </div>
      {pagato && (
        <p role="status" className="rounded-2xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
          Pagamento ricevuto: il download è pronto qui sotto e in Libreria.
        </p>
      )}
      <ProductGrid products={products} />
    </div>
  );
}
