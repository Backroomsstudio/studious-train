# Backrooms Studio · Studio di registrazione a Vicenza

Landing page ad alte prestazioni per lo studio: WebGL 3D, smooth scroll, player audio Prima/Dopo,
configuratore di sessione, galleria foto e SEO locale per "studio di registrazione Vicenza".

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
| `lib/studio.ts` | Nome, indirizzo, coordinate, telefono, WhatsApp, email, P.IVA, orari, social, rating Google, indicazioni stradali |
| `lib/content.ts` | Servizi, foto dello studio, attrezzatura, tracce del portfolio, opzioni del configuratore, recensioni, FAQ |
| `public/brand/` | Logo (PNG/WebP con trasparenza) |
| `public/images/` | Foto dello studio |
| `lib/seo.ts` | Title, meta description, keyword |
| `public/audio/` | Spezzoni audio Prima/Dopo del player |

### ⚠️ Da compilare prima della messa online

Tutti i campi marcati `DA VERIFICARE` in `lib/studio.ts` e `lib/content.ts`:

1. **Indirizzo, coordinate GPS, telefono, WhatsApp, email, P.IVA**: devono coincidere al carattere con il profilo
   Google Business (la coerenza NAP è il primo fattore di ranking locale).
2. **Rating Google** (`rating`): deve essere quello reale del profilo. Valori non veritieri sono pubblicità ingannevole
   e violano le linee guida di Google sui dati strutturati.
3. **Recensioni**: quelle presenti sono esempi di layout con etichetta "Esempio". Sostituiscile con recensioni reali
   (con il consenso degli autori) e imposta `REVIEWS_ARE_EXAMPLES = false`.
4. **Attrezzatura**: sostituisci con il gear reale. Il sito non mostra prezzi: i dettagli economici si concordano in privato.
5. **Audio**: i file in `public/audio` sono demo sintetiche generate da `npm run audio:demo`. Sostituiscile con
   spezzoni reali (MP3 320 kbps o AAC, 20–30 s, stesso punto d'attacco per grezzo e master) e aggiorna i percorsi in
   `lib/content.ts`.
6. **Link recensione Google** (`googleReviewUrl`): se compilato, compare il pulsante "Lascia una recensione".
7. **Privacy e cookie policy**: obbligatorie per legge; aggiungere le pagine e linkarle nel footer.

## Architettura

```
app/
  layout.tsx            font, metadata (title, OG, Twitter, geo), provider globali, JSON-LD
  page.tsx              composizione delle sezioni
  sitemap.ts robots.ts manifest.ts
  opengraph-image.tsx twitter-image.tsx   anteprima social (foto reale + logo) generata al build
  icon.png apple-icon.png                 favicon dal logo
components/
  Hero3D.tsx            hero + montaggio differito della scena WebGL
  three/WaveformScene   forma d'onda 3D (shader GLSL) reattiva a mouse, scroll e audio
  LocalProof.tsx        banner rating, indicatori chiave, testo SEO locale
  AudioPlayer.tsx       player A/B sincronizzato (Web Audio API) + visualizer + filtri per genere
  Services.tsx          rack dei servizi (TiltCard in vetro) + Outboard & Microfoni
  Gallery.tsx           foto dello studio con parallax
  Calculator.tsx        configuratore di sessione (ore + servizi) → WhatsApp / Email / Prenotazione
  Reviews.tsx           carosello recensioni (scroll-snap, autoplay accessibile)
  Faq.tsx               FAQ (contenuto long-tail + FAQPage JSON-LD)
  Footer.tsx MapEmbed   CTA finale, mappa dark (facade → Google Maps al click), orari, dati societari
  SeoSchema.tsx         @graph JSON-LD: RecordingStudio/LocalBusiness, WebSite, WebPage, FAQPage
  BookingModal.tsx      modale di prenotazione (<dialog> nativo) → WhatsApp o email precompilati
  SmoothScroll CustomCursor Magnetic Reveal ScrollText TiltCard Navbar
lib/                    dati, SEO, utilità
scripts/generate-demo-audio.mjs   sintetizzatore delle demo audio
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
  focus trap, controlli audio e calcolatore utilizzabili da tastiera.

## Deploy

Consigliato Vercel (zero config): importa il repository, imposta `NEXT_PUBLIC_SITE_URL` e collega il dominio.
Dopo il deploy: verifica il sito in Google Search Console, invia `/sitemap.xml` e controlla i dati strutturati con
il [Rich Results Test](https://search.google.com/test/rich-results).
