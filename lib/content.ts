/**
 * Contenuti editoriali della landing: servizi, attrezzatura, portfolio audio, listino,
 * recensioni e FAQ. Modificare qui i testi senza toccare i componenti.
 */

export interface Service {
  id: string;
  unit: string;
  title: string;
  kicker: string;
  description: string;
  bullets: string[];
  fromPrice: number;
  priceUnit: string;
  keywords: string;
}

export const services: Service[] = [
  {
    id: "registrazione",
    unit: "U-01",
    title: "Registrazione Voce & Strumenti",
    kicker: "Tracking",
    description:
      "Sala di ripresa trattata acusticamente e cabina vocale isolata: catturiamo voci, chitarre, batterie e ensemble con microfoni a condensatore e a nastro di riferimento.",
    bullets: ["Tecnico del suono dedicato", "Editing e comping inclusi", "Session file consegnati in WAV 24/48"],
    fromPrice: 45,
    priceUnit: "/ora",
    keywords: "registrazione voce Vicenza, registrare una canzone",
  },
  {
    id: "mix-master",
    unit: "U-02",
    title: "Mix & Mastering Analogico",
    kicker: "Mixing",
    description:
      "Mix ibrido con sommatoria e outboard analogico, mastering calibrato per Spotify, Apple Music, YouTube e vinile. Revisioni incluse fino al risultato che hai in testa.",
    bullets: ["Catena analogica di pregio", "Master per streaming e club", "2 revisioni incluse"],
    fromPrice: 150,
    priceUnit: "/brano",
    keywords: "mix e mastering Vicenza, mastering analogico",
  },
  {
    id: "produzione",
    unit: "U-03",
    title: "Produzione Musicale & Beatmaking",
    kicker: "Production",
    description:
      "Dal provino al brano finito: arrangiamento, beat originali trap, hip-hop, pop e urban costruiti su misura sulla tua identità artistica, con strumenti reali e synth.",
    bullets: ["Beat esclusivi con licenza piena", "Arrangiamento e sound design", "Direzione artistica in sessione"],
    fromPrice: 350,
    priceUnit: "/brano",
    keywords: "produzione musicale Vicenza, beat trap Vicenza",
  },
  {
    id: "podcast",
    unit: "U-04",
    title: "Sound Design & Podcasting",
    kicker: "Post-Production",
    description:
      "Registrazione podcast fino a 4 voci, voiceover per spot e video aziendali, sound design e jingle per brand. Consegna pronta per ogni piattaforma.",
    bullets: ["Setup video-podcast", "Editing, pulizia e loudness broadcast", "Jingle e sigle originali"],
    fromPrice: 90,
    priceUnit: "/episodio",
    keywords: "studio podcast Vicenza, speakeraggio Vicenza",
  },
];

export interface GearGroup {
  category: string;
  items: { name: string; note: string }[];
}

/** DA VERIFICARE: sostituire con l'elenco reale dell'attrezzatura dello studio. */
export const gear: GearGroup[] = [
  {
    category: "Microfoni",
    items: [
      { name: "Neumann U87 Ai", note: "Condensatore largo diaframma" },
      { name: "AKG C414 XLII", note: "Multi-pattern, overhead e acustici" },
      { name: "Royer R-121", note: "Ribbon per chitarre e fiati" },
      { name: "Shure SM7B", note: "Dinamico per rap e podcast" },
      { name: "Sennheiser MD421-II", note: "Tom, ampli, voce aggressiva" },
    ],
  },
  {
    category: "Preamplificatori",
    items: [
      { name: "Neve 1073 (stile)", note: "Colore britannico vintage" },
      { name: "API 512c", note: "Punch e transienti" },
      { name: "Universal Audio 610", note: "Valvolare, calore anni '60" },
    ],
  },
  {
    category: "Outboard",
    items: [
      { name: "UREI 1176LN (stile)", note: "Compressore FET" },
      { name: "Teletronix LA-2A (stile)", note: "Opto-compressore per voce" },
      { name: "SSL G-Bus Compressor", note: "Colla sul mix bus" },
      { name: "Pultec EQP-1A (stile)", note: "Equalizzatore passivo a valvole" },
    ],
  },
  {
    category: "Monitor & Conversione",
    items: [
      { name: "Genelec 8341", note: "Monitoraggio coassiale di precisione" },
      { name: "Yamaha NS-10M", note: "Riferimento mid-range" },
      { name: "RME / Apogee AD-DA", note: "Conversione 24-bit / 96 kHz" },
      { name: "Pro Tools · Logic · Ableton", note: "Tutte le DAW principali" },
    ],
  },
];

export const genres = [
  { id: "all", label: "Tutti" },
  { id: "trap", label: "Trap / Hip-Hop" },
  { id: "pop", label: "Pop" },
  { id: "rock", label: "Rock" },
  { id: "acoustic", label: "Classical / Acoustic" },
  { id: "voice", label: "Voiceover / Podcast" },
] as const;

export type GenreId = Exclude<(typeof genres)[number]["id"], "all">;

export interface Track {
  id: string;
  genre: GenreId;
  title: string;
  artist: string;
  bpm: string;
  notes: string;
  raw: string;
  master: string;
}

/**
 * I file in /public/audio sono demo sintetiche generate con `npm run audio:demo`
 * per mostrare il funzionamento del player A/B. Sostituirle con spezzoni reali
 * (consigliato: MP3 320 kbps o AAC, 20–30 secondi, stesso punto di attacco per grezzo e master).
 */
export const tracks: Track[] = [
  {
    id: "trap-notte",
    genre: "trap",
    title: "Notte su Corso Palladio",
    artist: "Demo · Trap",
    bpm: "140 BPM",
    notes: "808 saturati, hi-hat a rullo, voce in primo piano",
    raw: "/audio/trap-raw.wav",
    master: "/audio/trap-master.wav",
  },
  {
    id: "pop-berici",
    genre: "pop",
    title: "Colli Berici",
    artist: "Demo · Pop",
    bpm: "120 BPM",
    notes: "Accordi larghi, cassa in quattro, master per streaming",
    raw: "/audio/pop-raw.wav",
    master: "/audio/pop-master.wav",
  },
  {
    id: "rock-basilica",
    genre: "rock",
    title: "Basilica Amp",
    artist: "Demo · Rock",
    bpm: "110 BPM",
    notes: "Chitarre in overdrive, batteria viva, bus compressor",
    raw: "/audio/rock-raw.wav",
    master: "/audio/rock-master.wav",
  },
  {
    id: "acoustic-olimpico",
    genre: "acoustic",
    title: "Teatro Olimpico",
    artist: "Demo · Acoustic",
    bpm: "Rubato",
    notes: "Corde pizzicate, riverbero naturale, dinamica preservata",
    raw: "/audio/acoustic-raw.wav",
    master: "/audio/acoustic-master.wav",
  },
  {
    id: "voice-spot",
    genre: "voice",
    title: "Spot Radio 30\"",
    artist: "Demo · Voiceover",
    bpm: "Voce",
    notes: "De-noise, de-ess, loudness broadcast −16 LUFS",
    raw: "/audio/voice-raw.wav",
    master: "/audio/voice-master.wav",
  },
];

/* ------------------------------------------------------------------ */
/* Listino del calcolatore preventivo (DA VERIFICARE con i prezzi reali) */
/* ------------------------------------------------------------------ */

export const pricing = {
  hourlyRate: 45,
  hourDiscounts: [
    { minHours: 20, rate: 0.15, label: "Pacchetto 20h+" },
    { minHours: 8, rate: 0.1, label: "Giornata intera 8h+" },
  ],
  addOns: [
    { id: "editing", label: "Editing & tuning voce", price: 40, unit: "brano" },
    { id: "mix", label: "Mix professionale", price: 150, unit: "brano" },
    { id: "master-digital", label: "Mastering digitale", price: 40, unit: "brano" },
    { id: "master-analog", label: "Mastering analogico ibrido", price: 70, unit: "brano" },
    { id: "beat", label: "Beat / produzione originale", price: 350, unit: "brano" },
    { id: "podcast", label: "Podcast: editing + mix", price: 90, unit: "episodio" },
  ],
  vatNote: "Preventivo indicativo, IVA e oneri esclusi ove applicabili. Il prezzo finale viene confermato dopo l'ascolto del progetto.",
} as const;

export type AddOnId = (typeof pricing.addOns)[number]["id"];

/* ------------------------------------------------------------------ */
/* Recensioni                                                          */
/* ------------------------------------------------------------------ */

/**
 * ⚠️ Le recensioni qui sotto sono ESEMPI di layout. Prima della messa online vanno sostituite
 * con recensioni reali copiate (con consenso) dal profilo Google Business: pubblicare
 * recensioni inventate è una pratica commerciale scorretta (Codice del Consumo, Direttiva Omnibus).
 * Quando saranno reali, impostare REVIEWS_ARE_EXAMPLES = false per rimuovere l'etichetta "Esempio".
 */
export const REVIEWS_ARE_EXAMPLES = true;

export interface Review {
  author: string;
  role: string;
  city: string;
  rating: number;
  text: string;
  service: string;
}

export const reviews: Review[] = [
  {
    author: "Marco R.",
    role: "Rapper",
    city: "Vicenza",
    rating: 5,
    text: "Ho registrato il mio primo EP qui: la voce finalmente suona come nei brani che ascolto su Spotify. Ambiente professionale ma rilassato, ti mettono subito a tuo agio.",
    service: "Registrazione + Mix",
  },
  {
    author: "Giulia B.",
    role: "Cantautrice",
    city: "Bassano del Grappa",
    rating: 5,
    text: "Mastering analogico incredibile: il pianoforte respira e la voce è calda senza perdere dettaglio. Tempi di consegna rispettati al giorno.",
    service: "Mastering analogico",
  },
  {
    author: "The Palladians",
    role: "Band rock",
    city: "Schio",
    rating: 5,
    text: "Batteria ripresa in presa diretta con un suono enorme. Hanno capito subito il sound che cercavamo e ci hanno guidato in ogni scelta.",
    service: "Registrazione band",
  },
  {
    author: "Luca T.",
    role: "Producer",
    city: "Thiene",
    rating: 5,
    text: "Ho portato le mie stem per il mix: il salto di qualità è stato enorme. Il confronto prima/dopo parla da solo. Torno per il prossimo singolo.",
    service: "Mix & Master",
  },
  {
    author: "Sara M.",
    role: "Podcaster",
    city: "Padova",
    rating: 5,
    text: "Registriamo qui il nostro podcast ogni settimana. Audio pulitissimo, setup video pronto e zero stress: noi parliamo, loro pensano a tutto il resto.",
    service: "Podcast",
  },
  {
    author: "Andrea V.",
    role: "Artista pop",
    city: "Arzignano",
    rating: 5,
    text: "Dalla demo al singolo finito in tre sessioni. Beat originale, arrangiamento e master: il brano è entrato in una playlist editoriale.",
    service: "Produzione",
  },
];

/* ------------------------------------------------------------------ */
/* Local proof                                                         */
/* ------------------------------------------------------------------ */

export const proofPoints = [
  {
    title: "Acoustics by Master Designer",
    text: "Sala progettata con trattamento acustico su misura: tempi di riverbero controllati e risposta in bassa frequenza lineare.",
  },
  {
    title: "Preamplificatori Analogici Vintage",
    text: "Catena di ripresa con preamp a trasformatore e valvolari: il calore del suono classico, con la precisione del digitale.",
  },
  {
    title: "Mastering 100% Analog & Digital",
    text: "Mastering ibrido: outboard analogico per carattere, conversione ad alta risoluzione per loudness pronta per lo streaming.",
  },
];

/* ------------------------------------------------------------------ */
/* FAQ (contenuto testuale per long-tail SEO + FAQPage JSON-LD)        */
/* ------------------------------------------------------------------ */

export const faqs = [
  {
    q: "Quanto costa registrare una canzone in uno studio di registrazione a Vicenza?",
    a: "Una sessione di registrazione parte da 45 € l'ora con tecnico incluso. Per un singolo completo (registrazione, mix e mastering) la maggior parte degli artisti investe tra 250 € e 450 €. Usa il calcolatore qui sopra per un preventivo immediato.",
  },
  {
    q: "Quanto dura una sessione di registrazione?",
    a: "Per una voce su base servono in media 2–4 ore; per una band in presa diretta consigliamo una giornata intera. Dalle 8 ore in su applichiamo automaticamente lo sconto giornata.",
  },
  {
    q: "Fate mix e mastering online per chi non è di Vicenza?",
    a: "Sì. Lavoriamo con artisti da tutto il Veneto e il resto d'Italia: ci invii le tracce, ricevi mix e master con revisioni incluse, senza doverti spostare.",
  },
  {
    q: "Cosa devo portare alla prima sessione?",
    a: "La base (WAV o stem separate), il testo e i brani di riferimento che ti piacciono. Microfoni, cuffie, preamplificatori e software sono già in studio.",
  },
  {
    q: "Registrate anche podcast e voiceover per aziende?",
    a: "Sì: registriamo podcast fino a 4 voci con setup video, speakeraggio per spot radio e video aziendali, jingle e sound design per brand di Vicenza e provincia.",
  },
  {
    q: "Come prenoto una sessione?",
    a: "Clicca su \"Prenota una Sessione\", scegli servizio e data preferita e invia la richiesta su WhatsApp o via email: ti rispondiamo entro poche ore con la conferma.",
  },
];
