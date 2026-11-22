import type { Metadata } from "next";
import { Checkout } from "@/components/checkout/Checkout";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { getService, landingServiceToBookable, type ServiceId } from "@/lib/booking/catalog";
import { studio } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Prenota e paga online",
  description: `Prenota la tua sessione da ${studio.name} ad Arcugnano (Vicenza): calendario aggiornato in tempo reale, pagamento con carta, PayPal o in contanti in studio.`,
  alternates: { canonical: "/prenota", languages: { "it-IT": "/prenota" } },
  robots: { index: true, follow: true },
};

export default async function PrenotaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = typeof params.servizio === "string" ? params.servizio : "";
  const initial = (getService(raw)?.id ?? landingServiceToBookable[raw]) as ServiceId | undefined;

  return (
    <>
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <div className="container-x pb-24 pt-32 sm:pt-40">
          <p className="eyebrow">Prenotazione · Aperto 24/7</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.95] text-white sm:text-7xl">
            Prenota e paga la tua <em className="chrome-text">sessione</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-mist">
            Scegli il servizio, guarda gli orari liberi nel calendario aggiornato e paga online con carta o PayPal, oppure in contanti il giorno della sessione.
          </p>
          <div className="mt-14">
            <Checkout initialService={initial} cancelled={params.annullato === "1"} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
