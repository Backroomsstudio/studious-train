import { FeatBoard } from "@/components/beats/feat/feat-board";
import type { FeatBeatOption } from "@/components/beats/feat/publish-dialog";
import { DEFAULT_FILTERS } from "@/lib/beats/filters";
import { getBackend } from "@/lib/beats/server/backend";
import { getFacets, getViewer } from "@/lib/beats/server/queries";

export const metadata = {
  title: "Cerco feat",
  description: "La bacheca degli artisti di Backrooms Studio: trova chi canta, rappa o produce con te e scrivigli in privato.",
};

/** Bacheca "Cerco feat": annunci e casella arrivano dal server, il resto lo gestisce il client. */
export default async function FeatPage() {
  const viewer = await getViewer();
  const backend = await getBackend();
  const [posts, inbox, facets, catalog, library] = await Promise.all([
    backend.featPosts(viewer?.id ?? null),
    viewer ? backend.featInbox(viewer.id) : Promise.resolve(undefined),
    getFacets(),
    backend.search({ ...DEFAULT_FILTERS, sort: "new" }),
    viewer ? backend.library(viewer.id) : Promise.resolve([]),
  ]);

  // Prima i beat già sbloccati, poi le uscite più recenti del catalogo.
  const owned = new Map(library.map((l) => [l.beat.id, l.beat.title]));
  const beats: FeatBeatOption[] = [
    ...[...owned].map(([id, title]) => ({ id, title, owned: true })),
    ...catalog.items.filter((b) => !owned.has(b.id)).map((b) => ({ id: b.id, title: b.title, owned: false })),
  ];
  const genres = facets.genres.filter((g) => !g.parent).map((g) => ({ slug: g.slug, name: g.name }));

  return <FeatBoard initialPosts={posts} initialInbox={inbox} genres={genres} beats={beats} loggedIn={Boolean(viewer)} />;
}
