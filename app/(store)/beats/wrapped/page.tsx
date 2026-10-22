import { redirect } from "next/navigation";
import { WrappedStories } from "@/components/beats/engage/wrapped-stories";
import { SIGN_IN_PATH } from "@/lib/beats/server/auth";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Il tuo anno su Backrooms" };

/** Wrapped: storie con le statistiche d'ascolto (registro locale) e la libreria dal server. */
export default async function WrappedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(SIGN_IN_PATH);
  const library = await (await getBackend()).library(viewer.id);
  const beats = [...new Map(library.map((e) => [e.beat.id, e.beat])).values()];
  return (
    <WrappedStories
      profile={{
        artistName: viewer.artistName ?? viewer.name,
        levelName: viewer.level.name,
        levelColor: viewer.level.color,
        unlocked: beats.length,
        library: beats,
      }}
    />
  );
}
