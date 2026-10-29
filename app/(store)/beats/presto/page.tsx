import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Countdown } from "@/components/beats/launch/countdown";
import { WaitlistForm } from "@/components/beats/launch/waitlist-form";
import { isStaffRole, launchLabel, storeOpen } from "@/lib/beats/launch";
import { storeEnv } from "@/lib/beats/server/env";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Presto online", robots: { index: false, follow: false } };

/**
 * Pagina d'attesa fino al lancio: il proxy riscrive qui ogni pagina del negozio per chi non è dello staff.
 * Lo staff la vede come anteprima di ciò che vede il pubblico.
 */
export default async function ComingSoonPage() {
  const launchAt = storeEnv.launchAt;
  if (!launchAt || storeOpen(launchAt)) redirect("/beats");
  const viewer = await getViewer();

  return (
    <div className="space-y-6">
      {isStaffRole(viewer?.role) && (
        <p className="rounded-2xl bg-chrome-100 px-4 py-4 text-sm text-chrome-500">
          Anteprima: questa è la pagina che vede il pubblico fino al lancio.{" "}
          <Link href="/beats/gestione" className="font-semibold text-graphite underline">
            Torna alla Gestione
          </Link>
        </p>
      )}
      <section className="chrome-pink overflow-hidden rounded-[32px] p-6 text-white sm:p-8">
        <Image src="/brand/logo-br-120.webp" alt="Backrooms Studio" width={60} height={47} priority />
        <p className="mt-8 text-sm text-white/70">Backrooms Beat Store</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Apriamo il {launchLabel(launchAt)}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/80">
          Beat, stems, loop kit e sample kit dei producer di Backrooms Studio. Abbonati, ricevi crediti ogni mese e sblocca i beat che
          ami.
        </p>
        <Countdown to={launchAt.toISOString()} serverNow={Date.now()} className="mt-8" />
      </section>
      <WaitlistForm />
      <p className="text-center text-sm text-chrome-500">
        Sei un producer dello studio?{" "}
        <Link href="/beats/accedi" className="font-semibold text-graphite underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}
