import Link from "next/link";
import type { Metadata } from "next";
import { JsonLdScript } from "next-seo";
import { BookingTrigger } from "@/components/BookingModal";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { buttonStyles, cn } from "@/lib/cn";
import { playlistUrl, reviews } from "@/lib/content";
import { landingPages, type LandingPageData } from "@/lib/landing-pages";
import { SITE_URL, studio, whatsappLink } from "@/lib/studio";

/** Metadata della pagina servizio: canonical proprio (il layout punta alla home). */
export function landingMetadata(page: LandingPageData): Metadata {
  const path = `/${page.slug}`;
  return {
    title: page.seoTitle,
    description: page.seoDescription,
    alternates: { canonical: path, languages: { "it-IT": path } },
    openGraph: {
      type: "website",
      locale: "it_IT",
      url: path,
      siteName: studio.name,
      title: page.seoTitle,
      description: page.seoDescription,
    },
    twitter: { card: "summary_large_image", title: page.seoTitle, description: page.seoDescription },
  };
}

function LandingSchema({ page }: { page: LandingPageData }) {
  const url = `${SITE_URL}/${page.slug}`;
  const studioId = `${SITE_URL}/#studio`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: page.serviceName,
        serviceType: page.serviceType,
        description: page.seoDescription,
        url,
        provider: {
          "@type": ["RecordingStudio", "LocalBusiness"],
          "@id": studioId,
          name: studio.name,
          url: SITE_URL,
          ...(studio.phone ? { telephone: studio.phone } : {}),
          address: {
            "@type": "PostalAddress",
            streetAddress: studio.address.street,
            addressLocality: studio.address.city,
            addressRegion: studio.address.province,
            postalCode: studio.address.postalCode,
            addressCountry: studio.address.country,
          },
        },
        areaServed: page.remote
          ? [
              { "@type": "City", name: "Vicenza" },
              { "@type": "Country", name: "Italia" },
            ]
          : [
              { "@type": "City", name: "Vicenza" },
              { "@type": "City", name: "Arcugnano" },
            ],
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.seoTitle,
        description: page.seoDescription,
        inLanguage: "it-IT",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${url}#service` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: studio.name, item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: page.h1, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        isPartOf: { "@id": `${url}#webpage` },
        mainEntity: page.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return <JsonLdScript data={graph} scriptKey={`landing-${page.slug}`} id={`landing-${page.slug}-jsonld`} />;
}

export function LandingPage({ page }: { page: LandingPageData }) {
  const wa = whatsappLink(page.whatsappText);
  const pageReviews = reviews.filter((r) => page.reviewAuthors.includes(r.author));
  const related = landingPages.filter((p) => p.slug !== page.slug);

  return (
    <>
      <LandingSchema page={page} />
      <Navbar />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        {/* Intro */}
        <section aria-labelledby="page-title" className="relative isolate overflow-hidden pb-16 pt-32 sm:pb-24 sm:pt-40">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/3 -z-10 h-[40vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,255,255,0.14),transparent_75%)] blur-2xl"
          />
          <div className="container-x">
            <nav aria-label="Percorso" className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-mist">
              <Link href="/" className="hover:text-white">
                {studio.name}
              </Link>{" "}
              / <span className="text-white">{page.h1}</span>
            </nav>
            <p className="eyebrow mt-8">{page.eyebrow}</p>
            <h1 id="page-title" className="mt-5 max-w-5xl font-display text-[clamp(2.6rem,7vw,6rem)] leading-[0.95] text-white">
              {page.h1}
            </h1>
            <p className="mt-8 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">{page.intro}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonStyles.primary, "w-full sm:w-auto")}>
                  Scrivici su WhatsApp →
                </a>
              )}
              <BookingTrigger service={page.bookingService} className={cn(buttonStyles.ghost, "w-full sm:w-auto")}>
                Prenota la sessione
              </BookingTrigger>
            </div>
          </div>
        </section>

        {/* Contenuti */}
        <section aria-label="Dettagli del servizio" className="relative py-12 sm:py-20">
          <div className="container-x grid gap-6 md:grid-cols-2 md:gap-8">
            {page.sections.map((s) => (
              <article key={s.title} className="chrome-border glass rounded-[1.75rem] p-6 sm:p-8">
                <h2 className="font-display text-[2rem] leading-[1.05] text-white sm:text-[2.4rem]">{s.title}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p.slice(0, 32)} className="mt-4 text-[0.97rem] leading-relaxed text-mist">
                    {p}
                  </p>
                ))}
                {s.bullets && (
                  <ul className="mt-5 grid gap-2.5">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-white/90">
                        <span aria-hidden="true" className="mt-2.5 h-px w-5 shrink-0 bg-gradient-to-r from-white to-white/30" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Come funziona */}
        <section aria-labelledby="steps-title" className="relative py-12 sm:py-20">
          <div className="container-x">
            <h2 id="steps-title" className="max-w-4xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1] text-white">
              {page.stepsTitle}
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {page.steps.map((step, i) => (
                <li key={step.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
                  <span className="font-mono text-[0.7rem] text-mist">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-4 font-display text-2xl text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{step.text}</p>
                </li>
              ))}
            </ol>
            {playlistUrl && (
              <p className="mt-8 text-sm text-mist">
                Vuoi sentire come suonano i nostri lavori?{" "}
                <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline underline-offset-4">
                  Ascolta la playlist ufficiale del collettivo su Spotify ↗
                </a>
              </p>
            )}
          </div>
        </section>

        {/* Recensioni reali */}
        {pageReviews.length > 0 && (
          <section aria-labelledby="reviews-title" className="relative py-12 sm:py-20">
            <div className="container-x">
              <h2 id="reviews-title" className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1] text-white">
                Cosa dicono gli artisti
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {pageReviews.map((r) => (
                  <figure key={r.author} className="chrome-border glass rounded-[1.75rem] p-6 sm:p-8">
                    <p aria-label={`${r.rating} stelle su 5`} className="text-lg tracking-[0.2em] text-white">
                      {"★".repeat(r.rating)}
                    </p>
                    <blockquote className="mt-4 whitespace-pre-line text-base leading-relaxed text-white/90">“{r.text}”</blockquote>
                    <figcaption className="mt-5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-mist">
                      {r.author} · Recensione {r.source}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section aria-labelledby="faq-title" className="relative py-12 sm:py-20">
          <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
            <h2 id="faq-title" className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1] text-white">
              Domande frequenti
            </h2>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {page.faqs.map((f) => (
                <details key={f.q} className="faq-item group py-2">
                  <summary className="flex items-center justify-between gap-6 py-5 text-left">
                    <h3 className="font-display text-2xl leading-snug text-white transition-colors group-hover:text-chrome sm:text-[1.6rem]">{f.q}</h3>
                    <span
                      aria-hidden="true"
                      className="faq-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl text-chrome transition-transform duration-500"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-6 text-base leading-relaxed text-mist">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Altri servizi */}
        <section aria-labelledby="related-title" className="relative py-12 sm:py-20">
          <div className="container-x">
            <h2 id="related-title" className="eyebrow">
              Altri servizi dello studio
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/${p.slug}`}
                    className="press flex h-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/15 p-6 font-display text-2xl text-white transition-colors hover:border-white hover:bg-white/[0.05]"
                  >
                    {p.h1}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/#lounge"
                  className="press flex h-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/15 p-6 font-display text-2xl text-white transition-colors hover:border-white hover:bg-white/[0.05]"
                >
                  Scopri lo Studio Lounge
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
