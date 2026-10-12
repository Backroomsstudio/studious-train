import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { studio } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Termini di servizio",
  description: `Termini di servizio di ${studio.name} e dello strumento interno Backrooms Studio Hub.`,
  alternates: { canonical: "/termini", languages: { "it-IT": "/termini" } },
  robots: { index: true, follow: true },
};

const h2 = "mt-10 font-display text-3xl text-white";
const p = "mt-4 text-base leading-relaxed text-mist";

export default function TerminiPage() {
  return (
    <>
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <article className="container-x max-w-3xl pb-24 pt-32 sm:pt-40">
          <p className="eyebrow">Informativa</p>
          <h1 className="mt-5 font-display text-5xl text-white sm:text-6xl">Termini di servizio</h1>
          <p className={p}>Backrooms Studio Hub · ultimo aggiornamento: ottobre 2026.</p>

          <h2 className={h2}>Oggetto</h2>
          <p className={p}>
            Backrooms Studio Hub è un&apos;applicazione interna di {studio.name}, usata esclusivamente dai suoi soci per la gestione dello studio e la consultazione delle
            statistiche dei canali ufficiali. Non è disponibile al pubblico e non prevede registrazioni.
          </p>

          <h2 className={h2}>Uso consentito</h2>
          <ul className={p + " list-disc space-y-2 pl-6"}>
            <li>L&apos;accesso è riservato ai soci di {studio.name} con credenziali personali.</li>
            <li>I collegamenti a TikTok e Instagram riguardano solo gli account ufficiali dello studio e sono in sola lettura.</li>
            <li>L&apos;applicazione rispetta i termini d&apos;uso delle piattaforme collegate.</li>
          </ul>

          <h2 className={h2}>Responsabilità</h2>
          <p className={p}>
            I report sono forniti a scopo informativo interno. Le statistiche dipendono dai dati resi disponibili dalle piattaforme e possono subire ritardi o variazioni.
          </p>

          <h2 className={h2}>Revoca</h2>
          <p className={p}>
            L&apos;autorizzazione concessa all&apos;applicazione può essere revocata in qualsiasi momento dalle impostazioni dell&apos;account TikTok o Instagram.
          </p>

          <h2 className={h2}>Contatti</h2>
          <p className={p}>
            <a className="text-white underline underline-offset-4" href={`mailto:${studio.email}`}>
              {studio.email}
            </a>
          </p>

          <section lang="en" className="mt-14 border-t border-white/10 pt-10">
            <h2 className="font-display text-4xl text-white">Terms of Service</h2>
            <p className={p}>
              Backrooms Studio Hub is an internal application of {studio.name}, used only by its partners to manage the studio and view analytics of the studio&apos;s
              official channels. It is not available to the public and has no sign-up.
            </p>
            <p className={p}>
              Access is restricted to the studio&apos;s partners with personal credentials. TikTok and Instagram connections concern only the studio&apos;s official
              accounts and are read-only. The app complies with the connected platforms&apos; terms. Reports are for internal information only and depend on the data the
              platforms provide. Authorization can be revoked at any time from the TikTok or Instagram account settings.
            </p>
            <p className={p}>
              Contact:{" "}
              <a className="text-white underline underline-offset-4" href={`mailto:${studio.email}`}>
                {studio.email}
              </a>
            </p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
