import { ReelsFeed } from "@/components/beats/engage/reels-feed";
import { loadCatalog } from "@/lib/beats/server/catalog";

export const metadata = { title: "Swipe", description: "I beat in verticale, uno per schermata, come i Reel: scorri, ascolta, salva." };

/** Swipe in stile Reels. Con `?da=<slug>` il feed parte da quel beat. */
export default async function SwipePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { da } = await searchParams;
  const [popular, latest] = await Promise.all([loadCatalog("popular"), loadCatalog("new")]);
  return (
    <>
      <h1 className="sr-only">Swipe</h1>
      <ReelsFeed popular={popular} latest={latest} start={typeof da === "string" ? da : undefined} />
    </>
  );
}
