# Backrooms Studio · Studio Lounge di registrazione a Vicenza (Arcugnano)

Landing page ad alte prestazioni per lo studio: WebGL 3D, smooth scroll, design mobile-first "Liquid Chrome",
Studio Lounge, pacchetti Tailor-Made, live streaming e SEO locale per "studio di registrazione Vicenza".

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · three.js + @react-three/fiber + @react-three/drei ·
GSAP + ScrollTrigger · Framer Motion · Lenis · next-seo (JSON-LD)

## Avvio

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # build di produzione
npm run typecheck
```

Copia `.env.example` in `.env.local` e imposta `NEXT_PUBLIC_SITE_URL` con il dominio definitivo
(serve per canonical, sitemap, OpenGraph e JSON-LD).

## Dove si modificano i contenuti

| File | Contenuto |
| --- | --- |
| `lib/studio.ts` | Nome, indirizzo, contatti (WhatsApp, telefono, email), P.IVA, social, coordinate |
| `lib/content.ts` | Copy di Hero, Lounge, In-The-Box, servizi, live streaming, **playlist**, **recensioni**, FAQ |
| `lib/seo.ts` | Title, meta description, keyword |
| `public/brand/` | Logo (PNG/WebP con trasparenza) |
| `public/images/` | Foto dello studio |

### Regola: solo dati reali

Il sito non mostra nulla di inventato. I campi vuoti vengono nascosti automaticamente (anche nei dati strutturati per Google):

1. **Contatti** (`lib/studio.ts`): `whatsapp`, `phone`, `email`. Finché sono vuoti, i pulsanti di invio della prenotazione non compaiono.
2. **P.IVA** (`vatId`): obbligatoria per legge sul sito di un'attività; compare nel footer quando inserita.
3. **Social** (`social`): link a Instagram, TikTok, YouTube, Twitch, Kick.
4. **Playlist** (`playlistUrl` in `lib/content.ts`): link di condivisione Spotify, Apple Music o SoundCloud. Vuoto = sezione "Ascolta" nascosta.
5. **Recensioni** (`reviews`): le 5 recensioni reali, testo esatto. Vuoto = sezione nascosta.
6. **Coordinate** (`geo`, facoltativo): migliorano la precisione della mappa.
7. **Privacy e cookie policy**: obbligatorie per legge; aggiungere le pagine e linkarle nel footer.

## Architettura

```
app/
  layout.tsx            font, metadata (title, OG, Twitter, geo), provider globali, JSON-LD
  page.tsx              ordine delle sezioni
  globals.css           design system "Liquid Chrome" (token, gradienti cromati, micro-interazioni)
  sitemap.ts robots.ts manifest.ts opengraph-image.tsx twitter-image.tsx icon.png apple-icon.png
components/
  Navbar.tsx            barra superiore + barra di navigazione inferiore su mobile
  Hero3D.tsx            H1 "Il primo Studio Lounge…", fatti chiave, forma d'onda 3D cromata (WebGL)
  Lounge.tsx            Studio Lounge Experience: 65 mq vs ~30 mq, crew, TV, PS4, streaming, relax, bar
  Gallery.tsx           foto reali (monocromatiche → colore quando entrano in vista)
  Services.tsx          6 servizi modulari (card in vetro con tilt 3D)
  InTheBox.tsx          workflow 100% ITB: SSL, Universal Audio, FabFilter, Waves, iZotope
  TailorMade.tsx        configuratore pacchetti su misura → WhatsApp / Email / Prenotazione
  LiveStreaming.tsx     telecamera 4K, simulcast Twitch/TikTok/Kick/YouTube/Instagram, promozione
  Playlist.tsx          embed ufficiale Spotify / Apple Music / SoundCloud (se configurato)
  Reviews.tsx           testimonianze reali (se presenti)
  Faq.tsx Footer.tsx MapEmbed.tsx BookingModal.tsx SeoSchema.tsx
  SmoothScroll CustomCursor Magnetic Reveal ScrollText TiltCard three/WaveformScene
lib/                    dati, contenuti, SEO, utilità
```

### Scelte tecniche

- **Performance:** three.js viene scaricato solo alla prima interazione (mouse, tocco, scroll); il testo della
  hero è renderizzato lato server ed è visibile dal primo frame. La scena si ferma quando la hero esce dallo
  schermo e usa meno geometria su mobile.
- **Metadata:** in App Router i tag `<head>` sono gestiti dalla Metadata API nativa di Next.js (il componente
  `NextSeo` funziona solo con il Pages Router); `next-seo` è usato per il JSON-LD (`JsonLdScript`).
- **Lenis:** il pacchetto `@studio-freight/lenis` è deprecato e rinominato in `lenis`: si usa quest'ultimo.
- **Mappa:** facade SVG stilizzata; Google Maps (con filtro dark) viene caricato solo al click, quindi nessun cookie
  di terze parti al caricamento.
- **Accessibilità:** `prefers-reduced-motion` rispettato ovunque, cursore custom solo con mouse, modale nativo con
  focus trap, configuratore e barra di navigazione utilizzabili da tastiera e touch.

## Deploy

Consigliato Vercel (zero config): importa il repository, imposta `NEXT_PUBLIC_SITE_URL` e collega il dominio.
Dopo il deploy: verifica il sito in Google Search Console, invia `/sitemap.xml` e controlla i dati strutturati con
il [Rich Results Test](https://search.google.com/test/rich-results).

## Backrooms Beat Store (`/beats`)

Marketplace in abbonamento sul modello Splice: l'artista paga un piano mensile, riceve crediti e li spende per
sbloccare beat, WAV, stems e licenze dei produttori resident. Vive nello stesso progetto ma in un gruppo di route
separato (`app/(store)`), con un suo root layout e tema chiaro "Apple Chrome + Electric Blue".

**Stack aggiunto:** PostgreSQL + Prisma 7 · Auth.js v5 · Stripe Billing · Cloudflare R2 · Zustand · TanStack Query v5 ·
Radix UI · zod

```bash
npm run dev                      # senza DATABASE_URL → modalità demo su http://localhost:3000/beats
npm run db:migrate && npm run db:seed   # con DATABASE_URL: schema + catalogo dimostrativo
TEST_DATABASE_URL=… npm run test:beats  # regole, firme, filtri e mastro crediti su Postgres reale
```

| Dove | Cosa |
| --- | --- |
| `lib/beats/plans.ts` | Piani (prezzo, crediti/mese, tetto di rollover, licenze incluse, vantaggi) |
| `lib/beats/licenses.ts` | Licenze: costo in crediti, file inclusi, termini |
| `prisma/schema.prisma` | Schema: utenti, abbonamenti, mastro crediti, beat, produttori, generi, type beat, licenze, download, progetti |
| `lib/beats/server/ledger.ts` | Sblocco atomico e accrediti idempotenti (lock di riga, UPDATE condizionato, vincoli unici) |
| `lib/beats/server/billing.ts` | Checkout, portale clienti e webhook Stripe |
| `app/api/` | `beats` (ricerca), `beats/[id]/preview`, `beats/[id]/unlock`, `downloads`, `me`, `billing/*`, `webhooks/stripe` |
| `components/beats/` | Design system (`ui/`), player persistente (`player/`), catalogo e filtri (`marketplace/`), home, modale di sblocco |

**Flusso dei crediti:** `invoice.payment_succeeded` → l'eccedenza oltre il tetto di rollover scade → accredito del mese.
Upgrade a metà periodo: si accredita solo la differenza. `customer.subscription.deleted` → i crediti residui scadono.
Sblocco: `POST /api/beats/:id/unlock` addebita, crea la licenza e la riga del mastro in un'unica transazione e restituisce
link di download firmati (HMAC, 15 minuti); `/api/downloads` ricontrolla sessione e licenza e reindirizza a un URL R2
valido 60 secondi.

**File su R2:** `beats/<slug>/preview.mp3` (anteprima a basso bitrate con tag vocale), `master.mp3`, `master.wav`, `stems.zip`.
Il bucket resta privato.

**Prima del lancio:** sostituire il catalogo dimostrativo con i beat reali, verificare prezzi/crediti/vantaggi in
`plans.ts`, configurare su Stripe i 3 prezzi e il webhook, scrivere il contratto di licenza.
