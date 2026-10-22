import { redirect } from "next/navigation";
import { ArtistRoom } from "@/components/beats/engage/artist-room";
import { PLANS } from "@/lib/beats/plans";
import { SIGN_IN_PATH } from "@/lib/beats/server/auth";
import { getBackend } from "@/lib/beats/server/backend";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "La tua stanza" };

/** La stanza dell'artista: profilo con tema a scelta, beat sbloccati, badge e tessera. */
export default async function RoomPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(SIGN_IN_PATH);
  const library = await (await getBackend()).library(viewer.id);
  const beats = [...new Map(library.map((e) => [e.beat.id, e.beat])).values()];
  return (
    <ArtistRoom
      profile={{
        artistName: viewer.artistName ?? viewer.name,
        level: viewer.level,
        planName: viewer.plan ? PLANS[viewer.plan.tier].name : null,
        library: beats,
      }}
    />
  );
}
