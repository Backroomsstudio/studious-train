import type { Metadata, Viewport } from "next";
import { StoreHeader } from "@/components/beats/home/store-header";
import { TabBar } from "@/components/beats/home/tab-bar";
import { PlayerDock } from "@/components/beats/player/player-dock";
import { BeatsProviders } from "@/components/beats/providers";
import { UnlockDialog } from "@/components/beats/unlock/unlock-dialog";
import { storeEnv } from "@/lib/beats/server/env";
import { getViewer } from "@/lib/beats/server/queries";
import { SITE_URL } from "@/lib/studio";
import "./store.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Beat Store", template: "%s · Backrooms Beat Store" },
  description:
    "Beat, stems e licenze dei produttori resident di Backrooms Studio. Abbonati, ricevi crediti ogni mese e sblocca i beat che ami.",
  applicationName: "Backrooms Beat Store",
  // Finché il catalogo è dimostrativo il negozio non va indicizzato.
  robots: storeEnv.demoMode ? { index: false, follow: false } : { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f8f9fa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Root layout del negozio (gruppo di route separato dalla landing): tema chiaro cromato,
 * niente smooth scroll né cursore custom. Header, player, tab bar e modale di sblocco vivono qui,
 * quindi la riproduzione non si interrompe navigando tra le pagine del negozio.
 */
export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();
  return (
    <html lang="it">
      <body className="pb-[calc(10.5rem+env(safe-area-inset-bottom))] lg:pb-32">
        <BeatsProviders viewer={viewer}>
          <a
            href="#contenuto"
            className="sr-only z-50 rounded-full bg-graphite px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Vai al contenuto
          </a>
          <StoreHeader demo={storeEnv.demoMode} />
          <main id="contenuto" className="mx-auto max-w-6xl px-4 pt-5 lg:px-6 lg:pt-8">
            {children}
          </main>
          <PlayerDock />
          <TabBar />
          <UnlockDialog />
        </BeatsProviders>
      </body>
    </html>
  );
}
