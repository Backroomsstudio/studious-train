/**
 * Pagine dei servizi (SEO locale): una pagina per ogni ricerca che il sito a pagina singola non poteva coprire
 * ("mix e master vicenza", "produzione beat vicenza", "registrare una canzone vicenza").
 * Regola del sito: solo informazioni vere. Nessun prezzo pubblico (preventivo su WhatsApp).
 */

export interface LandingSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LandingPageData {
  slug: string;
  /** <title> della pagina */
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  h1: string;
  intro: string;
  /** id del servizio in lib/content.ts, per precompilare il modale di prenotazione */
  bookingService: string;
  whatsappText: string;
  /** Nome del servizio nei dati strutturati */
  serviceName: string;
  serviceType: string;
  /** In studio e/o a distanza: decide l'areaServed nei dati strutturati */
  remote: boolean;
  sections: LandingSection[];
  steps: { title: string; text: string }[];
  stepsTitle: string;
  /** Autori delle recensioni reali (lib/content.ts) da mostrare nella pagina */
  reviewAuthors: string[];
  faqs: { q: string; a: string }[];
}

export const landingPages: LandingPageData[] = [
  {
    slug: "mix-e-master-vicenza",
    seoTitle: "Mix e Master a Vicenza, in studio o online | Backrooms Studio",
    seoDescription:
      "Mix e master a Vicenza per rap, trap, urban e pop: sessione in studio ad Arcugnano, a pochi minuti dal centro, oppure online da tutta Italia. Master pronto per le piattaforme.",
    eyebrow: "Mix & Master · In studio o a distanza",
    h1: "Mix e Master a Vicenza",
    intro:
      "Il mix decide se un brano suona come una demo o come una release. Nella Lounge di Backrooms Studio, a Nogarazza di Arcugnano, al confine con il quartiere Sant'Agostino e a pochi minuti dal centro di Vicenza, mixiamo e masterizziamo brani rap, trap, urban e pop con un workflow 100% in-the-box. Puoi seguire la sessione dal divano insieme alla tua crew, oppure mandarci le tracce da qualsiasi città.",
    bookingService: "mix-master-studio",
    whatsappText: "Ciao Backrooms, vorrei info per mix e master di un brano",
    serviceName: "Mix e master",
    serviceType: "Mixaggio e mastering audio",
    remote: true,
    sections: [
      {
        title: "Mix e master in studio, con te in sala",
        paragraphs: [
          "Nella sessione presenziale ascolti il mix crescere in tempo reale e prendi ogni decisione insieme all'engineer: volume della voce, spazio degli effetti, peso del basso. Niente mail avanti e indietro, niente \"la voce la alzerei un filo\" scritto in chat.",
          "Lo studio è una Lounge da 65 mq in un unico ambiente: puoi portare fino a 6 persone del tuo team, che ascoltano e dicono la loro senza stare in piedi in un angolo. Siamo aperti 24 ore su 24, quindi la sessione si fissa anche di sera o di notte.",
        ],
        bullets: ["Decisioni in tempo reale con l'engineer", "Recall istantaneo: una correzione richiede minuti", "Fino a 6 persone in sala con te"],
      },
      {
        title: "Mix e master online, da qualsiasi città",
        paragraphs: [
          "Non sei di Vicenza? Il mix e master a distanza funziona allo stesso modo: carichi le tracce, ci mandi una reference e ricevi il brano mixato e masterizzato, pronto per Spotify, Apple Music, YouTube e le altre piattaforme. Le revisioni sono rapide perché ogni progetto si riapre esattamente com'era.",
        ],
      },
      {
        title: "Con cosa lavoriamo",
        paragraphs: [
          "Workflow 100% in-the-box su Pro Tools e FL Studio, con scheda Universal Audio Apollo, monitor Focal e plugin di SSL, Universal Audio, FabFilter, Waves e iZotope: lo stesso ecosistema che definisce il suono delle release urban e pop di oggi.",
        ],
      },
      {
        title: "Cosa ci serve per iniziare",
        paragraphs: ["Per un mix pulito e veloce ti chiediamo di preparare:"],
        bullets: [
          "Le tracce separate (stems) in WAV, tutte con lo stesso punto di partenza",
          "La base separata dalle voci, se ce l'hai",
          "Voci senza effetti stampati (o anche la versione con effetti, come riferimento)",
          "Uno o due brani di riferimento del suono che hai in testa",
          "BPM e tonalità del pezzo",
        ],
      },
    ],
    stepsTitle: "Come funziona il mix e master a distanza",
    steps: [
      { title: "Ci scrivi", text: "Su WhatsApp ci mandi il brano (anche un bounce grezzo) e una reference: ti diciamo tempi e preventivo." },
      { title: "Carichi le tracce", text: "Ci invii gli stems in WAV con un link di condivisione." },
      { title: "Ricevi il mix", text: "Ascolti il primo mix e ci mandi le tue note: le revisioni sono rapide grazie al recall immediato." },
      { title: "Master e consegna", text: "Ricevi il master pronto per le piattaforme di streaming." },
    ],
    reviewAuthors: ["Marco Fiorentini", "Francesco Sartori"],
    faqs: [
      {
        q: "Quanto costa il mix e master di un brano?",
        a: "Dipende dal numero di tracce, dal genere e da cosa serve al pezzo. Scrivici su WhatsApp con il brano: ti mandiamo un preventivo su misura, senza impegno.",
      },
      {
        q: "Posso fare mix e master anche se non ho registrato da voi?",
        a: "Sì. Mixiamo e masterizziamo anche brani registrati in altri studi o a casa: basta mandarci le tracce separate in WAV.",
      },
      {
        q: "Il master è pronto per Spotify?",
        a: "Sì. Il master viene consegnato pronto per la distribuzione su Spotify, Apple Music, YouTube e le altre piattaforme digitali.",
      },
      {
        q: "Posso assistere al mix in studio?",
        a: "Sì, con la sessione di mix e master in studio sei in sala con l'engineer e puoi portare fino a 6 persone del tuo team.",
      },
      {
        q: "Dove si trova lo studio?",
        a: "In Via Galileo Galilei 3 a Nogarazza, frazione di Arcugnano al confine con il quartiere Sant'Agostino: dal centro di Vicenza si arriva in pochi minuti.",
      },
    ],
  },
  {
    slug: "produzione-musicale-vicenza",
    seoTitle: "Produzione Musicale e Beat su Misura a Vicenza | Backrooms Studio",
    seoDescription:
      "Produzione musicale a Vicenza: beat su misura, arrangiamento e direzione artistica con i producer del collettivo Backrooms. Rap, trap, urban e pop, in studio o a distanza.",
    eyebrow: "Produzione musicale · Beat su misura",
    h1: "Produzione musicale e beat su misura a Vicenza",
    intro:
      "Un beat scaricato va bene per iniziare, un beat costruito su di te è un'altra storia. Backrooms è un collettivo di tre produttori e sound engineer attivo dal 2021, con oltre 50 brani usciti con i crediti del collettivo. Lavoriamo nella nostra Lounge ad Arcugnano, a pochi minuti da Vicenza, oppure a distanza: beatmaking, arrangiamento e direzione artistica fianco a fianco con l'artista.",
    bookingService: "produzione",
    whatsappText: "Ciao Backrooms, vorrei info per una produzione / un beat su misura",
    serviceName: "Produzione musicale e beat su misura",
    serviceType: "Produzione musicale",
    remote: true,
    sections: [
      {
        title: "Sessione beat 1:1: il beat nasce in sala con te",
        paragraphs: [
          "Parti da un'idea, da un vocale o da un brano di riferimento: il producer costruisce il beat davanti a te, lo modifica mentre provi il flow e lo adatta alla tua voce. Esci con una base che suona come te, non come mille altre.",
          "Se vuoi, nella stessa sessione registri anche la voce: beat, registrazione, mix e master si fanno nella stessa stanza, con le stesse persone.",
        ],
        bullets: ["Beatmaking", "Arrangiamento", "Direzione artistica"],
      },
      {
        title: "Produzione musicale a distanza",
        paragraphs: [
          "Sei fuori Vicenza o non riesci a venire in studio? Mandaci l'idea, un vocale o una reference: sviluppiamo il brano da remoto, ci confrontiamo a ogni step e a fine lavoro ricevi anche i file di progetto.",
        ],
      },
      {
        title: "Rap, trap, urban e pop",
        paragraphs: [
          "Il nostro terreno è la scena urban italiana, ma lavoriamo anche su pop e R&B. Puoi ascoltare i brani usciti con i nostri crediti nella playlist ufficiale del collettivo su Spotify.",
        ],
      },
      {
        title: "Crediti chiari",
        paragraphs: [
          "Le produzioni del collettivo escono con il credito \"Prod. by Backrooms\": sai fin dall'inizio chi firma il beat e come comparirà sulle piattaforme.",
        ],
      },
    ],
    stepsTitle: "Come lavoriamo a una produzione",
    steps: [
      { title: "Ascolto", text: "Partiamo dalle tue reference e da cosa vuoi raccontare: il beat si costruisce sulla tua identità." },
      { title: "Beat e arrangiamento", text: "Il producer costruisce la base e la struttura del brano, in sala con te o a distanza." },
      { title: "Voce", text: "Registri nella Lounge con l'engineer, oppure ci mandi le tue take." },
      { title: "Mix e master", text: "Chiudiamo il brano con mix e master pronti per le piattaforme." },
    ],
    reviewAuthors: ["Giorgio Strazzi", "Francesco Sartori"],
    faqs: [
      {
        q: "Qual è la differenza tra un beat in licenza e un beat su misura?",
        a: "Un beat in licenza è una base già pronta, spesso venduta a più artisti. Il beat su misura nasce per il tuo brano: struttura, suoni e arrangiamento sono costruiti sulla tua voce e sulle tue idee.",
      },
      {
        q: "Devo arrivare con un'idea precisa?",
        a: "No. Basta un vocale, una frase o un brano che ti piace: il resto lo costruiamo insieme in sessione.",
      },
      {
        q: "Posso fare la produzione a distanza?",
        a: "Sì. La produzione musicale a distanza funziona da qualsiasi città, con confronto a ogni step e consegna dei file di progetto.",
      },
      {
        q: "Quanto costa una produzione?",
        a: "Dipende dal progetto: singolo, EP o album, con o senza registrazione e mix. Scrivici su WhatsApp e ti prepariamo un pacchetto su misura.",
      },
    ],
  },
  {
    slug: "registrazione-voce-vicenza",
    seoTitle: "Registrare una Canzone a Vicenza | Registrazione Voce · Backrooms Studio",
    seoDescription:
      "Registrare una canzone a Vicenza: ore di registrazione voce con engineer dedicato, editing e comping delle take. Rap, trap e pop. Studio aperto 24/7 ad Arcugnano.",
    eyebrow: "Registrazione voce · In studio",
    h1: "Registrare una canzone a Vicenza",
    intro:
      "Hai la base e il testo, ti manca lo studio giusto. Nelle ore di registrazione di Backrooms Studio un engineer ti segue take dopo take, dal primo warm-up all'ultima doppia, poi pulisce e compone le take migliori. Lo studio è a Nogarazza di Arcugnano, al confine con Sant'Agostino e a pochi minuti dal centro di Vicenza, ed è aperto 24 ore su 24.",
    bookingService: "registrazione",
    whatsappText: "Ciao Backrooms, vorrei prenotare delle ore di registrazione",
    serviceName: "Registrazione voce in studio",
    serviceType: "Registrazione audio",
    remote: false,
    sections: [
      {
        title: "Vocal engineering assistito",
        paragraphs: [
          "Non registri da solo davanti a un microfono: l'engineer è in sala con te, ti dà indicazioni sull'interpretazione, gestisce le take, le doppie e gli adlib e alla fine fa editing e comping, cioè sceglie e monta i pezzi migliori di ogni take.",
          "Registriamo con microfono a condensatore AKG C414 XLII e scheda Universal Audio Apollo, su Pro Tools.",
        ],
        bullets: ["Vocal engineering assistito", "Editing e comping delle take", "La tua crew in sala con te"],
      },
      {
        title: "Rap, trap e pop: il suono che cerchi",
        paragraphs: [
          "Lavoriamo soprattutto con artisti rap, trap e urban, e anche con progetti pop e R&B. Sappiamo come si registrano le doppie di un ritornello trap e come si tiene viva una strofa rap dall'inizio alla fine.",
        ],
      },
      {
        title: "Una Lounge, non una cabina",
        paragraphs: [
          "65 mq in un unico ambiente, in stile americano: fino a 6 persone del tuo team, TV da 75 pollici, PlayStation 4, area relax e zona bar per le sessioni lunghe. Se vuoi, la sessione va anche in diretta su Twitch, TikTok, Kick, YouTube e Instagram con una telecamera 4K.",
        ],
      },
      {
        title: "Cosa portare in studio",
        paragraphs: ["Per sfruttare al massimo le ore di registrazione:"],
        bullets: [
          "La base in WAV, la qualità migliore che hai",
          "Il testo, anche sul telefono",
          "Uno o due brani di riferimento",
          "Non hai ancora la base? Possiamo produrla insieme in sala",
        ],
      },
    ],
    stepsTitle: "Come si svolge una sessione di registrazione",
    steps: [
      { title: "Prenoti", text: "Ci scrivi su WhatsApp e scegli la fascia oraria: siamo aperti 24/7, anche di sera e di notte." },
      { title: "Warm-up e take", text: "Scaldi la voce e registri strofe, ritornelli, doppie e adlib con l'engineer." },
      { title: "Editing e comping", text: "Scegliamo insieme le take migliori e le montiamo in una traccia pulita." },
      { title: "Mix e master", text: "Chiudi il brano con il mix e master, in studio o a distanza." },
    ],
    reviewAuthors: ["Giorgio Strazzi", "Luca Fabrello"],
    faqs: [
      {
        q: "Quanto costa registrare una canzone a Vicenza?",
        a: "Dipende dalle ore di registrazione e da cosa ti serve dopo (produzione, mix, master). Scrivici su WhatsApp: ti mandiamo un preventivo o un pacchetto su misura.",
      },
      {
        q: "Posso registrare di sera o di notte?",
        a: "Sì. Lo studio è aperto 24 ore su 24, 7 giorni su 7: scegli tu la fascia oraria quando prenoti.",
      },
      {
        q: "Quante persone posso portare?",
        a: "Fino a 6 persone del tuo team o entourage, comodamente nella Lounge.",
      },
      {
        q: "Devo avere già la base?",
        a: "No. Se non hai ancora la base, i producer del collettivo possono costruirla con te in una sessione di produzione.",
      },
      {
        q: "Come arrivo dal centro di Vicenza?",
        a: "Lo studio è in Via Galileo Galilei 3 a Nogarazza, frazione di Arcugnano al confine con il quartiere Sant'Agostino: dal centro di Vicenza sono pochi minuti in auto.",
      },
    ],
  },
];

export function getLandingPage(slug: string): LandingPageData {
  const page = landingPages.find((p) => p.slug === slug);
  if (!page) throw new Error(`Pagina servizio non trovata: ${slug}`);
  return page;
}
