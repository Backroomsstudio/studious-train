import { notFound, redirect } from "next/navigation";
import { StaffConsole } from "@/components/beats/staff/staff-console";
import { isStaffRole, launchLabel, storeOpen } from "@/lib/beats/launch";
import { storeEnv } from "@/lib/beats/server/env";
import { getViewer } from "@/lib/beats/server/queries";
import { staffOverview } from "@/lib/beats/server/staff";

export const metadata = { title: "Gestione", robots: { index: false, follow: false } };

/** Area dei producer: catalogo in ogni stato, caricamento di beat e kit, profilo e lancio. */
export default async function StaffPage() {
  if (storeEnv.demoMode) {
    return (
      <div className="glass mx-auto max-w-xl rounded-[28px] p-6">
        <h1 className="font-display text-2xl font-semibold">Gestione</h1>
        <p className="mt-2 text-sm text-chrome-500">
          In modalità demo non c&apos;è un database: l&apos;area per caricare beat e kit si attiva con il sito online.
        </p>
      </div>
    );
  }
  const viewer = await getViewer();
  if (!viewer) redirect("/beats/accedi");
  if (!isStaffRole(viewer.role)) notFound();

  const overview = await staffOverview();
  const launchAt = storeEnv.launchAt;
  return (
    <StaffConsole
      initialBeats={overview.beats}
      initialProducts={overview.products}
      initialProducers={overview.producers}
      genres={overview.genres}
      stemRequests={overview.stemRequests}
      viewerProducer={viewer.producerSlug}
      launch={launchAt ? { at: launchAt.toISOString(), label: launchLabel(launchAt), open: storeOpen(launchAt) } : null}
      waitlist={overview.waitlist}
      members={overview.members}
    />
  );
}
