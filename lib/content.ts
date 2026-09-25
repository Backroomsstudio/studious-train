/**
 * Contenuti editoriali della landing. Regola: tutto ciò che è scritto qui deve essere vero.
 * Playlist e recensioni restano vuote finché non vengono inseriti i dati reali: in quel caso
 * le rispettive sezioni non vengono mostrate.
 */

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export const heroFacts = [
  { value: "65", unit: "mq", label: "Studio Lounge" },
  { value: "6", unit: "ospiti", label: "Il tuo team in sala" },
  { value: "24/7", unit: "", label: "Sempre aperto" },
  { value: "5+", unit: "anni", label: "Di esperienza" },
];

/* ------------------------------------------------------------------ */
/* Studio Lounge Experience                                            */
/* ------------------------------------------------------------------ */

export type LoungeIcon = "space" | "crew" | "tv" | "console" | "stream" | "sofa" | "bar";

export const loungeFeatures: { icon: LoungeIcon; title: string; text: string }[] = [
  {
    icon: "space",
    title: "65 mq, un solo ambiente",
    text: "Come negli studi americani: registrazione, ascolto e relax nella stessa grande sala, senza porte e corridoi a dividere il team.",
  },
  {
    icon: "crew",
    title: "Porta la tua crew",
    text: "Fino a 6 persone del tuo team o entourage vivono la sessione con te, comode, senza stare in piedi in un angolo.",
  },
  {
    icon: "tv",
    title: "TV 75 pollici",
    text: "Schermo da 75\" con illuminazione ambiente a LED personalizzabile: scegli tu il colore della serata.",
  },
  {
    icon: "console",
    title: "PlayStation 4",
    text: "Console con doppio joystick per le pause tra un take e l'altro.",
  },
  {
    icon: "stream",
    title: "Tutto lo streaming",
    text: "Accesso completo alle piattaforme: Netflix, Prime Video e le altre, sullo schermo grande.",
  },
  {
    icon: "sofa",
    title: "Area relax",
    text: "Doppio divano, tappeto e tavolino: lo spazio dove il team aspetta, ascolta e dice la sua.",
  },
  {
    icon: "bar",
    title: "Zona bar & snack",
    text: "Friggitrice ad aria, macchina del caffè e frigo dedicato: le sessioni lunghe si affrontano meglio.",
  },
];

/* ------------------------------------------------------------------ */
/* Foto dello studio (alt text descrittivi: contano per Google Immagini) */
/* ------------------------------------------------------------------ */

export const studioPhotos = [
  {
    src: "/images/sala-registrazione-panoramica.webp",
    alt: "Panoramica dello Studio Lounge Backrooms Studio ad Arcugnano, Vicenza: sala unica da 65 mq con area relax",
    caption: "La Lounge",
    width: 1800,
    height: 1348,
  },
  {
    src: "/images/studio-registrazione-vicenza-sala.webp",
    alt: "Sala di registrazione e area divani dello studio di registrazione a Vicenza",
    caption: "La sala",
    width: 1800,
    height: 1348,
  },
  {
    src: "/images/regia-mix-mastering-vicenza.webp",
    alt: "Postazione di mix e master in-the-box nello studio di Arcugnano",
    caption: "Mix & Master",
    width: 1800,
    height: 1348,
  },
  {
    src: "/images/postazione-produzione-musicale.webp",
    alt: "Postazione di produzione musicale e registrazione voce a Vicenza",
    caption: "Produzione",
    width: 1800,
    height: 1348,
  },
];

/* ------------------------------------------------------------------ */
/* In-The-Box                                                          */
/* ------------------------------------------------------------------ */

export const itbBrands = ["SSL", "Universal Audio", "FabFilter", "Waves", "iZotope"];

export const itbBenefits = [
  {
    title: "Recall istantaneo",
    text: "Ogni sessione si riapre esattamente com'era: una revisione del mix richiede minuti, non un pomeriggio a ricablare.",
  },
  {
    title: "Flessibilità assoluta",
    text: "Plugin, DSP e software di livello mondiale sempre disponibili, su ogni traccia, senza limiti di canali.",
  },
  {
    title: "Sonorità moderne",
    text: "Lo stesso ecosistema di strumenti che definisce il suono delle release urban e pop di oggi.",
  },
  {
    title: "Velocità d'esecuzione",
    text: "Dall'idea al bounce senza tempi morti: più tempo per la musica, meno per la tecnica.",
  },
];

/* ------------------------------------------------------------------ */
/* Servizi                                                             */
/* ------------------------------------------------------------------ */

export interface Service {
  id: string;
  mode: "In studio" | "A distanza" | "Su misura";
  title: string;
  description: string;
  bullets: string[];
}

export const services: Service[] = [
  {
    id: "registrazione",
    mode: "In studio",
    title: "Ore di Registrazione",
    description: "Registra nella Lounge con vocal engineering assistito: un engineer ti segue take dopo take, dal primo warm-up all'ultima doppia.",
    bullets: ["Vocal engineering assistito", "Editing e comping delle take", "La tua crew in sala con te"],
  },
  {
    id: "produzione",
    mode: "In studio",
    title: "Ore di Produzione Musicale",
    description: "Beatmaking, arrangiamento e direzione artistica fianco a fianco con i producer del collettivo, costruiti sulla tua identità.",
    bullets: ["Beatmaking", "Arrangiamento", "Direzione artistica"],
  },
  {
    id: "produzione-remoto",
    mode: "A distanza",
    title: "Produzione Musicale a Distanza",
    description: "Mandaci la tua idea, un vocale o una reference: sviluppiamo il brano da remoto e lo rifiniamo insieme a ogni step.",
    bullets: ["Da qualsiasi città", "Confronto a ogni step", "Consegna dei file di progetto"],
  },
  {
    id: "mix-master-studio",
    mode: "In studio",
    title: "Mix & Master in Studio",
    description: "Sessione presenziale: ascolti il mix crescere in tempo reale e prendi ogni decisione con l'engineer, direttamente dal divano.",
    bullets: ["Sessione presenziale", "Decisioni in tempo reale", "Recall istantaneo in-the-box"],
  },
  {
    id: "mix-master-remoto",
    mode: "A distanza",
    title: "Mix & Master a Distanza",
    description: "Carichi le tracce, ricevi mix e master pronti per le piattaforme con online delivery. Le revisioni sono rapide grazie al recall immediato.",
    bullets: ["Online delivery", "Master pronto per le piattaforme", "Revisioni rapide"],
  },
  {
    id: "tailor-made",
    mode: "Su misura",
    title: "Pacchetti Tailor-Made",
    description: "Combina un monte ore flessibile di registrazione, produzione, mix e master costruito sul tuo progetto: singolo, EP o album.",
    bullets: ["Monte ore flessibile", "Registrazione + produzione + mix/master", "Pensato per singoli, EP e album"],
  },
];

/* ------------------------------------------------------------------ */
/* Configuratore Tailor-Made                                           */
/* ------------------------------------------------------------------ */

export const packageOptions = {
  hours: [
    { id: "rec", label: "Ore di registrazione", hint: "Con vocal engineering assistito" },
    { id: "prod", label: "Ore di produzione in studio", hint: "Beatmaking, arrangiamento, direzione artistica" },
  ],
  tracks: [
    { id: "prod-remote", label: "Produzioni a distanza", unit: "brano" },
    { id: "mix-studio", label: "Mix & Master in studio", unit: "brano" },
    { id: "mix-remote", label: "Mix & Master a distanza", unit: "brano" },
  ],
} as const;

export type HourOptionId = (typeof packageOptions.hours)[number]["id"];
export type TrackOptionId = (typeof packageOptions.tracks)[number]["id"];

/* ------------------------------------------------------------------ */
/* Live streaming                                                      */
/* ------------------------------------------------------------------ */

export const streamPlatforms = ["Twitch", "TikTok", "Kick", "YouTube", "Instagram"];

export const streamFeatures = [
  {
    title: "Telecamera 4K",
    text: "Una telecamera ultra-HD attiva durante le sessioni mostra il dietro le quinte del tuo processo creativo.",
  },
  {
    title: "Simulcast multipiattaforma",
    text: "La diretta va in onda contemporaneamente su Twitch, TikTok, Kick, YouTube e Instagram.",
  },
  {
    title: "Promozione diretta",
    text: "In diretta ricevi sponsorship dallo studio, il tuo brano viene ascoltato insieme alla community in chat e promosso in modo organico, in tempo reale.",
  },
];

/* ------------------------------------------------------------------ */
/* Playlist ufficiale                                                   */
/* ------------------------------------------------------------------ */

/**
 * DA COMPILARE: link della playlist ufficiale con le tracce reali del collettivo.
 * Incolla il link normale di condivisione (es. https://open.spotify.com/playlist/XXXX,
 * https://music.apple.com/it/playlist/..., https://soundcloud.com/utente/sets/...).
 * Vuoto = la sezione non viene mostrata.
 */
export const playlistUrl = "https://open.spotify.com/playlist/4Hc9yJ8rSnKS8J9gKa57nw";

/* ------------------------------------------------------------------ */
/* Recensioni                                                          */
/* ------------------------------------------------------------------ */

export interface Review {
  author: string;
  role?: string;
  text: string;
}

/**
 * DA COMPILARE: le 5 recensioni reali, testo esatto, con il consenso degli autori.
 * Vuoto = la sezione non viene mostrata. Nessuna recensione inventata.
 */
export const reviews: Review[] = [];

/* ------------------------------------------------------------------ */
/* FAQ (solo informazioni reali)                                       */
/* ------------------------------------------------------------------ */

export const faqs = [
  {
    q: "Dove si trova lo studio di registrazione?",
    a: "In Via Galileo Galilei 3 ad Arcugnano, in provincia di Vicenza. Trovi le indicazioni stradali in fondo alla pagina.",
  },
  {
    q: "Quante persone posso portare in sessione?",
    a: "Fino a 6 persone del tuo team o entourage. La Lounge è un unico ambiente da 65 mq con area relax, TV da 75 pollici, PlayStation 4 e zona bar.",
  },
  {
    q: "Quali sono gli orari dello studio?",
    a: "Lo studio è aperto 24 ore su 24, 7 giorni su 7: scegli tu la fascia oraria della tua sessione al momento della prenotazione.",
  },
  {
    q: "Fate mix e master anche a distanza?",
    a: "Sì. Mix & Master e produzione musicale sono disponibili anche a distanza, con consegna online: non serve essere di Vicenza.",
  },
  {
    q: "Con che tecnologia lavorate?",
    a: "Il nostro workflow è 100% in-the-box: plugin, DSP e software di SSL, Universal Audio, FabFilter, Waves e iZotope, per recall istantaneo, flessibilità e velocità.",
  },
  {
    q: "Cos'è il live streaming delle sessioni?",
    a: "Durante le sessioni una telecamera 4K trasmette il dietro le quinte in simulcast su Twitch, TikTok, Kick, YouTube e Instagram: in diretta gli artisti ricevono sponsorship e il brano viene ascoltato insieme alla community.",
  },
  {
    q: "Posso combinare più servizi?",
    a: "Sì, con i pacchetti Tailor-Made: componi un monte ore flessibile di registrazione, produzione, mix e master su misura per il tuo progetto.",
  },
];
