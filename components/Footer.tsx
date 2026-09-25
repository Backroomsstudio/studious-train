import { BookingTrigger } from "@/components/BookingModal";
import { Magnetic } from "@/components/Magnetic";
import { MapEmbed } from "@/components/MapEmbed";
import { KineticText } from "@/components/Reveal";
import { buttonStyles } from "@/lib/cn";
import { services } from "@/lib/content";
import { fullAddress, studio } from "@/lib/studio";

const SOCIAL_LABELS: Record<keyof typeof studio.social, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  spotify: "Spotify",
};

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contatti" aria-labelledby="contatti-title" className="relative overflow-hidden border-t border-white/10 pt-24 sm:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[30rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,176,0,0.16),transparent)]" />

      {/* CTA finale */}
      <div className="container-x text-center">
        <p className="eyebrow">Il prossimo brano è il tuo</p>
        <KineticText
          id="contatti-title"
          text="Entra in studio. *Esci* con un master."
          className="mx-auto mt-6 max-w-5xl text-[clamp(2.8rem,8vw,7.5rem)]"
        />
        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Magnetic>
            <BookingTrigger className={buttonStyles.primary}>Prenota una Sessione →</BookingTrigger>
          </Magnetic>
          <Magnetic>
            <a href={`tel:${studio.phoneHref}`} className={buttonStyles.ghost}>
              Chiama {studio.phone}
            </a>
          </Magnetic>
        </div>
      </div>

      {/* Mappa + info */}
      <div className="container-x mt-24 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <MapEmbed />

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-gold">Come raggiungerci</h2>
            <ul className="mt-5 grid gap-4">
              {studio.directions.map((d) => (
                <li key={d.mode}>
                  <p className="font-semibold text-white">{d.mode}</p>
                  <p className="mt-1 text-sm leading-relaxed text-mist">{d.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-gold">Orari di apertura</h2>
            <dl className="mt-5 grid gap-2 text-sm">
              {studio.openingHours.map((slot) => (
                <div key={slot.label} className="flex justify-between gap-6 border-b border-white/10 pb-2">
                  <dt className="text-mist">{slot.label}</dt>
                  <dd className="font-mono text-white">
                    {slot.opens} – {slot.closes}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-6">
                <dt className="text-mist">Domenica</dt>
                <dd className="text-white">{studio.closedLabel.replace("Domenica ", "")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Dati societari e link */}
      <div className="container-x mt-20 grid gap-10 border-t border-white/10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-3xl text-white">
            {studio.name.split(" ")[0]} <em className="text-gradient-gold">{studio.name.split(" ").slice(1).join(" ")}</em>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-mist">
            Studio di registrazione a Vicenza. Registrazione, mix, mastering, produzione e podcast per artisti di tutto il Veneto.
          </p>
        </div>

        <div>
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-gold">Contatti</h2>
          <ul className="mt-5 grid gap-2 text-sm">
            <li>
              <a className="text-white transition-colors hover:text-gold" href={`tel:${studio.phoneHref}`}>
                {studio.phone}
              </a>
            </li>
            <li>
              <a className="text-white transition-colors hover:text-gold" href={`mailto:${studio.email}`}>
                {studio.email}
              </a>
            </li>
            <li className="text-mist">{fullAddress}</li>
          </ul>
        </div>

        <div>
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-gold">Servizi</h2>
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

        <div>
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-gold">Social</h2>
          <ul className="mt-5 grid gap-2 text-sm">
            {(Object.keys(studio.social) as (keyof typeof studio.social)[]).map((key) => (
              <li key={key}>
                <a className="text-mist transition-colors hover:text-white" href={studio.social[key]} target="_blank" rel="noopener noreferrer me">
                  {SOCIAL_LABELS[key]} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-3 py-6 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-mist sm:flex-row">
          <p>
            © {year} {studio.legalName} · P.IVA {studio.vatId}
          </p>
          <p>Studio di registrazione · Vicenza (VI) · Veneto</p>
        </div>
      </div>
    </footer>
  );
}
