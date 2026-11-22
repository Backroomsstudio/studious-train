import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { buttonStyles } from "@/lib/cn";
import { studio, whatsappLink } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Prenotazione confermata",
  robots: { index: false, follow: false },
};

export default async function ConfermataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { stato } = await searchParams;
  const cash = stato === "contanti";
  const wa = whatsappLink(`Ciao ${studio.name}! Ho appena prenotato dal sito.`);

  return (
    <>
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <div className="container-x max-w-3xl pb-24 pt-32 sm:pt-40">
          <p className="eyebrow">{cash ? "Prenotazione registrata" : "Pagamento ricevuto"}</p>
          <h1 className="mt-5 font-display text-5xl leading-[0.95] text-white sm:text-7xl">
            Ci vediamo in <em className="chrome-text">studio</em> ✦
          </h1>
          <p className="mt-6 text-base leading-relaxed text-mist">
            {cash
              ? "Il tuo orario è riservato. Porta i contanti il giorno della sessione: ti abbiamo mandato un'email con tutti i dettagli."
              : "Grazie! La prenotazione è confermata: tra pochi istanti ricevi un'email di riepilogo e la ricevuta di pagamento."}
          </p>
          <p className="mt-4 text-base leading-relaxed text-mist">
            Se hai scelto un servizio a distanza ti scriviamo noi per ricevere il materiale. Non trovi l&apos;email? Controlla lo spam o scrivici.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className={buttonStyles.primary}>
              Torna al sito
            </Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonStyles.ghost}>
                Scrivici su WhatsApp
              </a>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
