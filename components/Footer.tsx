import Image from "next/image";
import { BookingTrigger } from "@/components/BookingModal";
import { Magnetic } from "@/components/Magnetic";
import { MapEmbed } from "@/components/MapEmbed";
import { KineticText } from "@/components/Reveal";
import { buttonStyles } from "@/lib/cn";
import { services } from "@/lib/content";
import { activeSocials, directionsUrl, fullAddress, phoneHref, studio } from "@/lib/studio";

const headingClass = "font-mono text-[0.7rem] uppercase tracking-[0.24em] text-white";

export function Footer() {
  const year = new Date().getFullYear();
  const socials = activeSocials();

  return (
    <footer id="contatti" aria-labelledby="contatti-title" className="relative overflow-hidden border-t border-white/10 pt-20 sm:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[30rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.12),transparent)]" />

      {/* CTA finale */}
      <div className="container-x text-center">
        <Image src="/brand/logo-br.webp" alt="" width={160} height={125} className="mx-auto mb-8 h-24 w-auto drop-shadow-[0_0_40px_rgba(255,255,255,0.2)] sm:mb-10 sm:h-28" />
        <p className="eyebrow">Aperto 24/7 · Arcugnano, Vicenza</p>
        <KineticText id="contatti-title" text="La Lounge ti aspetta. *Porta la crew.*" className="mx-auto mt-6 max-w-5xl text-[clamp(2.6rem,8vw,7rem)]" />
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center sm:gap-4">
          <Magnetic className="w-full sm:w-auto">
            <BookingTrigger className={buttonStyles.primary + " w-full sm:w-auto"}>Prenota la tua sessione →</BookingTrigger>
          </Magnetic>
          {studio.phone && (
            <Magnetic className="w-full sm:w-auto">
              <a href={`tel:${phoneHref()}`} className={buttonStyles.ghost + " w-full sm:w-auto"}>
                Chiama {studio.phone}
              </a>
            </Magnetic>
          )}
        </div>
      </div>

      {/* Mappa + orari */}
      <div className="container-x mt-20 grid gap-8 sm:mt-24 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
        <MapEmbed />

        <div className="grid content-start gap-8">
          <div className="chrome-border glass rounded-[1.75rem] p-6 sm:p-8">
            <h2 className={headingClass}>Orari di apertura</h2>
            <p className="mt-4 font-display text-6xl leading-none sm:text-7xl">
              <span className="chrome-text">24/7</span>
            </p>
            <p className="mt-3 text-sm text-mist">Aperto 24 ore su 24, 7 giorni su 7. Prenota la fascia che preferisci, anche di notte.</p>
          </div>

          <div className="chrome-border glass rounded-[1.75rem] p-6 sm:p-8">
            <h2 className={headingClass}>Dove siamo</h2>
            <address className="mt-4 not-italic">
              <span className="block text-lg font-semibold text-white">{studio.name}</span>
              <span className="block text-mist">{fullAddress}</span>
            </address>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="press mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
            >
              Indicazioni stradali ↗
            </a>
          </div>
        </div>
      </div>

      {/* Dati aziendali e link */}
      <div className="container-x mt-16 grid gap-10 border-t border-white/10 py-12 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-4">
            <Image src="/brand/logo-br.webp" alt={`Logo ${studio.name}`} width={72} height={56} className="h-14 w-auto" />
            <p className="font-display text-3xl text-white">
              Backrooms <em className="chrome-text">Studio</em>
            </p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-mist">
            Il primo Studio Lounge di Vicenza. Registrazione, produzione musicale, mix e master ad Arcugnano e a distanza.
          </p>
        </div>

        <div>
          <h2 className={headingClass}>Contatti</h2>
          <ul className="mt-5 grid gap-2 text-sm">
            {studio.phone && (
              <li>
                <a className="text-white transition-colors hover:text-mist" href={`tel:${phoneHref()}`}>
                  {studio.phone}
                </a>
              </li>
            )}
            {studio.email && (
              <li>
                <a className="text-white transition-colors hover:text-mist" href={`mailto:${studio.email}`}>
                  {studio.email}
                </a>
              </li>
            )}
            <li className="text-mist">{fullAddress}</li>
          </ul>
        </div>

        <div>
          <h2 className={headingClass}>Servizi</h2>
          <ul className="mt-5 grid gap-2 text-sm">
            {services.map((s) => (
              <li key={s.id}>
                <a className="text-mist transition-colors hover:text-white" href="#servizi">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {socials.length > 0 && (
          <div>
            <h2 className={headingClass}>Social</h2>
            <ul className="mt-5 grid gap-2 text-sm">
              {socials.map((s) => (
                <li key={s.key}>
                  <a className="text-mist transition-colors hover:text-white" href={s.url} target="_blank" rel="noopener noreferrer me">
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-2 py-6 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-mist sm:flex-row">
          <p>
            © {year} {studio.legalName}
            {studio.vatIds.length > 0 && <> · P.IVA {studio.vatIds.join(" · ")}</>}
          </p>
          <p>Studio di registrazione · Arcugnano (VI) · Vicenza · Veneto</p>
        </div>
      </div>
    </footer>
  );
}
