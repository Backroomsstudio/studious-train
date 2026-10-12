import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { analyticsEnabled } from "@/lib/analytics";
import { fullAddress, studio } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Privacy e cookie",
  description: `Come ${studio.name} tratta i dati personali e i cookie di questo sito.`,
  alternates: { canonical: "/privacy", languages: { "it-IT": "/privacy" } },
  robots: { index: true, follow: true },
};

const h2 = "mt-10 font-display text-3xl text-white";
const p = "mt-4 text-base leading-relaxed text-mist";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        <article className="container-x max-w-3xl pb-24 pt-32 sm:pt-40">
          <p className="eyebrow">Informativa</p>
          <h1 className="mt-5 font-display text-5xl text-white sm:text-6xl">Privacy e cookie</h1>
          <p className={p}>Ultimo aggiornamento: 12 ottobre 2026.</p>

          <h2 className={h2}>Chi tratta i dati</h2>
          <p className={p}>
            Titolari del trattamento sono i professionisti che gestiscono {studio.name}, {fullAddress}:{" "}
            {studio.vatHolders.map((h) => `${h.name} (P.IVA ${h.vatId})`).join(" e ")}. Per qualsiasi richiesta scrivi a{" "}
            <a className="text-white underline underline-offset-4" href={`mailto:${studio.email}`}>
              {studio.email}
            </a>
            .
          </p>

          <h2 className={h2}>Quali dati e perché</h2>
          <ul className={p + " list-disc space-y-3 pl-6"}>
            <li>
              <strong className="text-white">Richieste e prenotazioni.</strong> Quando prenoti o ci scrivi (modulo del sito, WhatsApp, email,
              telefono) trattiamo i dati che ci dai (nome, contatti, richiesta) per rispondere e organizzare la sessione. Base giuridica:
              esecuzione di misure precontrattuali e contratto. Il modulo apre il tuo programma di posta o WhatsApp: il messaggio passa dal
              servizio che usi, non da un nostro server.
            </li>
            <li>
              <strong className="text-white">Pagamenti.</strong> Se paghi con un link di pagamento, i dati della carta sono gestiti da Stripe;
              noi riceviamo solo l&apos;esito e l&apos;importo. Conserviamo i documenti contabili per il tempo richiesto dalla legge.
            </li>
            <li>
              <strong className="text-white">Statistiche di visita (Google Analytics).</strong>{" "}
              {analyticsEnabled
                ? "Solo se lo accetti dal banner, usiamo Google Analytics 4 per sapere quante persone visitano il sito, da dove arrivano e quali pulsanti usano (telefono, WhatsApp, prenotazione). L'indirizzo IP è anonimizzato, le funzioni pubblicitarie e di profilazione sono disattivate. Base giuridica: il tuo consenso, che puoi revocare in ogni momento da «Gestisci cookie» nel fondo pagina."
                : "Al momento il sito non usa strumenti di statistica."}
            </li>
            <li>
              <strong className="text-white">Contenuti di terzi.</strong> La mappa di Google Maps si carica solo quando premi «Carica mappa
              interattiva». La playlist è un contenuto incorporato di Spotify: quando viene mostrata, Spotify può usare cookie propri secondo la
              sua informativa.
            </li>
            <li>
              <strong className="text-white">Dati tecnici.</strong> Il sito è ospitato da Netlify, che registra per sicurezza dati tecnici delle
              richieste (come l&apos;indirizzo IP) per un periodo limitato.
            </li>
          </ul>

          <h2 className={h2}>Cookie</h2>
          <p className={p}>
            Il sito non usa cookie di profilazione né pubblicitari.{" "}
            {analyticsEnabled
              ? "Se accetti le statistiche, Google Analytics salva i cookie _ga e _ga_* (fino a 2 anni) per riconoscere in forma anonima la stessa visita nel tempo. Se rifiuti, o finché non scegli, non viene salvato nessun cookie di Analytics. La tua scelta è conservata nel tuo browser."
              : "Non servono cookie per usare il sito."}
          </p>

          <h2 className={h2}>I tuoi diritti</h2>
          <p className={p}>
            Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione scrivendo a {studio.email} (artt. 15-22
            GDPR). Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it). I dati delle richieste sono
            conservati per il tempo necessario a gestirle e, se nasce un rapporto di lavoro, per gli obblighi di legge.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
