// Genera le pagine servizio statiche di sito-online/ (SEO locale).
// Uso: node strumenti-sito/genera-pagine-servizio.mjs
// Testi ripresi dalle pagine del vecchio sito Next.js (lib/landing-pages.ts), aggiornati a 70 mq.
// Regola del sito: solo informazioni vere, nessun prezzo pubblico.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'sito-online');
const SITE = 'https://backroomsstudio.it';
const V = '20261027';
const WA = '393248911607';

const REVIEWS = {
  'Marco Fiorentini': 'Miglior studio di Vicenza che ho provato, ragazzi super disponibili e che credono realmente al tuo progetto, Freya fonico devastante!',
  'Francesco Sartori': 'Ragazzi veramente forti e preparati nel loro lavoro, abbiamo lavorato ad un paio di produzioni e sono venute come me le immaginavo, studio consigliatissimo',
  'Giorgio Strazzi': 'Bellissima esperienza, abbiamo fatto una sessione di registrazione e una sessione di beat e Freya e Daniele sono veramente forti, sono uscito con una traccia di cui sono attualmente soddisfatto, ci tornerÃ² assolutamente, qua a Vicenza a mio avviso Ã¨ il migliore',
  'Luca Fabrello': 'Producer competente e disponibile in un ambiente professionale, lâ€™ideale per fare una sessione al meglio. Ci tornerÃ² sicuramente. Grande Freya, grande Daniele e grande Plugghe!',
};

const PAGES = [
  {
    slug: 'mix-e-master-vicenza',
    title: 'Mix e Master a Vicenza, in studio o online | Backrooms Studio',
    description: 'Mix e master a Vicenza per rap, trap, urban e pop: sessione in studio ad Arcugnano, a pochi minuti dal centro, oppure online da tutta Italia. Master pronto per le piattaforme.',
    eyebrow: 'Mix & Master Â· In studio o a distanza',
    h1: 'Mix e Master a Vicenza',
    intro: 'Il mix decide se un brano suona come una demo o come una release. Nella Lounge di Backrooms Studio, a Nogarazza di Arcugnano, al confine con il quartiere Sant\'Agostino e a pochi minuti dal centro di Vicenza, mixiamo e masterizziamo brani rap, trap, urban e pop con un workflow 100% in-the-box. Puoi seguire la sessione dal divano insieme alla tua crew, oppure mandarci le tracce da qualsiasi cittÃ .',
    wa: 'Ciao Backrooms Studio! Vorrei info per mix e master di un brano.',
    serviceName: 'Mix e master', serviceType: 'Mixaggio e mastering audio', remote: true,
    sections: [
      { title: 'Mix e master in studio, con te in sala', paragraphs: ['Nella sessione presenziale ascolti il mix crescere in tempo reale e prendi ogni decisione insieme all\'engineer: volume della voce, spazio degli effetti, peso del basso. Niente mail avanti e indietro, niente "la voce la alzerei un filo" scritto in chat.', 'Lo studio Ã¨ una Lounge da 70 mq in un unico ambiente: puoi portare fino a 6 persone del tuo team, che ascoltano e dicono la loro senza stare in piedi in un angolo. Siamo aperti 24 ore su 24, quindi la sessione si fissa anche di sera o di notte.'], bullets: ['Decisioni in tempo reale con l\'engineer', 'Recall istantaneo: una correzione richiede minuti', 'Fino a 6 persone in sala con te'] },
      { title: 'Mix e master online, da qualsiasi cittÃ ', paragraphs: ['Non sei di Vicenza? Il mix e master a distanza funziona allo stesso modo: carichi le tracce, ci mandi una reference e ricevi il brano mixato e masterizzato, pronto per Spotify, Apple Music, YouTube e le altre piattaforme. Le revisioni sono rapide perchÃ© ogni progetto si riapre esattamente com\'era.'] },
      { title: 'Con cosa lavoriamo', paragraphs: ['Workflow 100% in-the-box su Pro Tools e FL Studio, con scheda Universal Audio Apollo, monitor Focal e plugin di SSL, Universal Audio, FabFilter, Waves e iZotope: lo stesso ecosistema che definisce il suono delle release urban e pop di oggi.'] },
      { title: 'Cosa ci serve per iniziare', paragraphs: ['Per un mix pulito e veloce ti chiediamo di preparare:'], bullets: ['Le tracce separate (stems) in WAV, tutte con lo stesso punto di partenza', 'La base separata dalle voci, se ce l\'hai', 'Voci senza effetti stampati (o anche la versione con effetti, come riferimento)', 'Uno o due brani di riferimento del suono che hai in testa', 'BPM e tonalitÃ  del pezzo'] },
    ],
    stepsTitle: 'Come funziona il mix e master a distanza',
    steps: [['Ci scrivi', 'Su WhatsApp ci mandi il brano (anche un bounce grezzo) e una reference: ti diciamo tempi e preventivo.'], ['Carichi le tracce', 'Ci invii gli stems in WAV con un link di condivisione.'], ['Ricevi il mix', 'Ascolti il primo mix e ci mandi le tue note: le revisioni sono rapide grazie al recall immediato.'], ['Master e consegna', 'Ricevi il master pronto per le piattaforme di streaming.']],
    reviews: ['Marco Fiorentini', 'Francesco Sartori'],
    faqs: [['Quanto costa il mix e master di un brano?', 'Dipende dal numero di tracce, dal genere e da cosa serve al pezzo. Scrivici su WhatsApp con il brano: ti mandiamo un preventivo su misura, senza impegno.'], ['Posso fare mix e master anche se non ho registrato da voi?', 'SÃ¬. Mixiamo e masterizziamo anche brani registrati in altri studi o a casa: basta mandarci le tracce separate in WAV.'], ['Il master Ã¨ pronto per Spotify?', 'SÃ¬. Il master viene consegnato pronto per la distribuzione su Spotify, Apple Music, YouTube e le altre piattaforme digitali.'], ['Posso assistere al mix in studio?', 'SÃ¬, con la sessione di mix e master in studio sei in sala con l\'engineer e puoi portare fino a 6 persone del tuo team.'], ['Dove si trova lo studio?', 'In Via Galileo Galilei 3 a Nogarazza, frazione di Arcugnano al confine con il quartiere Sant\'Agostino: dal centro di Vicenza si arriva in pochi minuti.']],
  },
  {
    slug: 'produzione-musicale-vicenza',
    title: 'Produzione Musicale e Beat su Misura a Vicenza | Backrooms Studio',
    description: 'Produzione musicale a Vicenza: beat su misura, arrangiamento e direzione artistica con i producer del collettivo Backrooms. Rap, trap, urban e pop, in studio o a distanza.',
    eyebrow: 'Produzione musicale Â· Beat su misura',
    h1: 'Produzione musicale e beat su misura a Vicenza',
    intro: 'Un beat scaricato va bene per iniziare, un beat costruito su di te Ã¨ un\'altra storia. Backrooms Ã¨ un collettivo di tre produttori e sound engineer attivo dal 2021, con oltre 50 brani usciti con i crediti del collettivo. Lavoriamo nella nostra Lounge ad Arcugnano, a pochi minuti da Vicenza, oppure a distanza: beatmaking, arrangiamento e direzione artistica fianco a fianco con l\'artista.',
    wa: 'Ciao Backrooms Studio! Vorrei info per una produzione / un beat su misura.',
    serviceName: 'Produzione musicale e beat su misura', serviceType: 'Produzione musicale', remote: true,
    sections: [
      { title: 'Sessione beat 1:1: il beat nasce in sala con te', paragraphs: ['Parti da un\'idea, da un vocale o da un brano di riferimento: il producer costruisce il beat davanti a te, lo modifica mentre provi il flow e lo adatta alla tua voce. Esci con una base che suona come te, non come mille altre.', 'Se vuoi, nella stessa sessione registri anche la voce: beat, registrazione, mix e master si fanno nella stessa stanza, con le stesse persone.'], bullets: ['Beatmaking', 'Arrangiamento', 'Direzione artistica'] },
      { title: 'Produzione musicale a distanza', paragraphs: ['Sei fuori Vicenza o non riesci a venire in studio? Mandaci l\'idea, un vocale o una reference: sviluppiamo il brano da remoto, ci confrontiamo a ogni step e a fine lavoro ricevi anche i file di progetto.'] },
      { title: 'Rap, trap, urban e pop', paragraphs: ['Il nostro terreno Ã¨ la scena urban italiana, ma lavoriamo anche su pop e R&B. Puoi ascoltare i brani usciti con i nostri crediti nella playlist ufficiale del collettivo su Spotify.'] },
      { title: 'Crediti chiari', paragraphs: ['Le produzioni del collettivo escono con il credito "Prod. by Backrooms": sai fin dall\'inizio chi firma il beat e come comparirÃ  sulle piattaforme.'] },
    ],
    stepsTitle: 'Come lavoriamo a una produzione',
    steps: [['Ascolto', 'Partiamo dalle tue reference e da cosa vuoi raccontare: il beat si costruisce sulla tua identitÃ .'], ['Beat e arrangiamento', 'Il producer costruisce la base e la struttura del brano, in sala con te o a distanza.'], ['Voce', 'Registri nella Lounge con l\'engineer, oppure ci mandi le tue take.'], ['Mix e master', 'Chiudiamo il brano con mix e master pronti per le piattaforme.']],
    reviews: ['Giorgio Strazzi', 'Francesco Sartori'],
    faqs: [['Qual Ã¨ la differenza tra un beat in licenza e un beat su misura?', 'Un beat in licenza Ã¨ una base giÃ  pronta, spesso venduta a piÃ¹ artisti. Il beat su misura nasce per il tuo brano: struttura, suoni e arrangiamento sono costruiti sulla tua voce e sulle tue idee.'], ['Devo arrivare con un\'idea precisa?', 'No. Basta un vocale, una frase o un brano che ti piace: il resto lo costruiamo insieme in sessione.'], ['Posso fare la produzione a distanza?', 'SÃ¬. La produzione musicale a distanza funziona da qualsiasi cittÃ , con confronto a ogni step e consegna dei file di progetto.'], ['Quanto costa una produzione?', 'Dipende dal progetto: singolo, EP o album, con o senza registrazione e mix. Scrivici su WhatsApp e ti prepariamo un pacchetto su misura.']],
  },
  {
    slug: 'registrazione-voce-vicenza',
    title: 'Registrare una Canzone a Vicenza | Registrazione Voce Â· Backrooms Studio',
    description: 'Registrare una canzone a Vicenza: ore di registrazione voce con engineer dedicato, editing e comping delle take. Rap, trap e pop. Studio aperto 24/7 ad Arcugnano.',
    eyebrow: 'Registrazione voce Â· In studio',
    h1: 'Registrare una canzone a Vicenza',
    intro: 'Hai la base e il testo, ti manca lo studio giusto. Nelle ore di registrazione di Backrooms Studio un engineer ti segue take dopo take, dal primo warm-up all\'ultima doppia, poi pulisce e compone le take migliori. Lo studio Ã¨ a Nogarazza di Arcugnano, al confine con Sant\'Agostino e a pochi minuti dal centro di Vicenza, ed Ã¨ aperto 24 ore su 24.',
    wa: 'Ciao Backrooms Studio! Vorrei prenotare delle ore di registrazione.',
    serviceName: 'Registrazione voce in studio', serviceType: 'Registrazione audio', remote: false,
    sections: [
      { title: 'Vocal engineering assistito', paragraphs: ['Non registri da solo davanti a un microfono: l\'engineer Ã¨ in sala con te, ti dÃ  indicazioni sull\'interpretazione, gestisce le take, le doppie e gli adlib e alla fine fa editing e comping, cioÃ¨ sceglie e monta i pezzi migliori di ogni take.', 'Registriamo con microfono a condensatore AKG C414 XLII e scheda Universal Audio Apollo, su Pro Tools.'], bullets: ['Vocal engineering assistito', 'Editing e comping delle take', 'La tua crew in sala con te'] },
      { title: 'Rap, trap e pop: il suono che cerchi', paragraphs: ['Lavoriamo soprattutto con artisti rap, trap e urban, e anche con progetti pop e R&B. Sappiamo come si registrano le doppie di un ritornello trap e come si tiene viva una strofa rap dall\'inizio alla fine.'] },
      { title: 'Una Lounge, non una cabina', paragraphs: ['70 mq in un unico ambiente, in stile americano: fino a 6 persone del tuo team, TV da 75 pollici, PlayStation, area relax e zona bar per le sessioni lunghe. Se vuoi, la sessione va anche in diretta su Twitch, TikTok, Kick, YouTube e Instagram con una telecamera 4K.'] },
      { title: 'Cosa portare in studio', paragraphs: ['Per sfruttare al massimo le ore di registrazione:'], bullets: ['La base in WAV, la qualitÃ  migliore che hai', 'Il testo, anche sul telefono', 'Uno o due brani di riferimento', 'Non hai ancora la base? Possiamo produrla insieme in sala'] },
    ],
    stepsTitle: 'Come si svolge una sessione di registrazione',
    steps: [['Prenoti', 'Ci scrivi su WhatsApp e scegli la fascia oraria: siamo aperti 24/7, anche di sera e di notte.'], ['Warm-up e take', 'Scaldi la voce e registri strofe, ritornelli, doppie e adlib con l\'engineer.'], ['Editing e comping', 'Scegliamo insieme le take migliori e le montiamo in una traccia pulita.'], ['Mix e master', 'Chiudi il brano con il mix e master, in studio o a distanza.']],
    reviews: ['Giorgio Strazzi', 'Luca Fabrello'],
    faqs: [['Quanto costa registrare una canzone a Vicenza?', 'Dipende dalle ore di registrazione e da cosa ti serve dopo (produzione, mix, master). Scrivici su WhatsApp: ti mandiamo un preventivo o un pacchetto su misura. La prima sessione Ã¨ gratis.'], ['Posso registrare di sera o di notte?', 'SÃ¬. Lo studio Ã¨ aperto 24 ore su 24, 7 giorni su 7: scegli tu la fascia oraria quando prenoti.'], ['Quante persone posso portare?', 'Fino a 6 persone del tuo team o entourage, comodamente nella Lounge.'], ['Devo avere giÃ  la base?', 'No. Se non hai ancora la base, i producer del collettivo possono costruirla con te in una sessione di produzione.'], ['Come arrivo dal centro di Vicenza?', 'Lo studio Ã¨ in Via Galileo Galilei 3 a Nogarazza, frazione di Arcugnano al confine con il quartiere Sant\'Agostino: dal centro di Vicenza sono pochi minuti in auto.']],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const waLink = (t) => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function schema(p) {
  const url = `${SITE}/${p.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service', '@id': `${url}#service`, name: p.serviceName, serviceType: p.serviceType, description: p.description, url,
        provider: { '@id': `${SITE}/#studio`, '@type': ['RecordingStudio', 'LocalBusiness'], name: 'Backrooms Studio', url: SITE, telephone: '+39 324 891 1607', address: { '@type': 'PostalAddress', streetAddress: 'Via Galileo Galilei, 3', addressLocality: 'Arcugnano', addressRegion: 'VI', postalCode: '36057', addressCountry: 'IT' } },
        areaServed: p.remote ? [{ '@type': 'City', name: 'Vicenza' }, { '@type': 'Country', name: 'Italia' }] : [{ '@type': 'City', name: 'Vicenza' }, { '@type': 'City', name: 'Arcugnano' }],
      },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Backrooms Studio', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: p.h1, item: url }] },
      { '@type': 'FAQPage', mainEntity: p.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
}

function page(p) {
  const url = `${SITE}/${p.slug}/`;
  const related = PAGES.filter((o) => o.slug !== p.slug);
  const check = '<svg class="check" aria-hidden="true"><use href="#i-check"/></svg>';
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#050507"><meta name="color-scheme" content="dark">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png?v=${V}"><link rel="apple-touch-icon" href="/apple-icon.png?v=${V}"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="website"><meta property="og:locale" content="it_IT"><meta property="og:site_name" content="Backrooms Studio">
<meta property="og:url" content="${url}"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}">
<meta property="og:image" content="${SITE}/og-image-silver.png"><meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/cinzel.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/montserrat.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/main.css?v=${V}"><link rel="stylesheet" href="/css/fx.css?v=${V}">
<script>document.documentElement.classList.add('js')</script>
<script type="application/ld+json">${json(schema(p))}</script>
</head>
<body class="svc-page">
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-check" viewBox="0 0 24 24"><path d="m4.5 12.5 5 5 10-11"/></symbol></svg>
<header class="hdr solid"><a class="brand" href="/" aria-label="Backrooms Studio, torna alla home"><img src="/brand/logo-silver-120.webp" width="44" height="34" alt=""><span>Backrooms <small class="t2">Studio</small></span></a><div class="acts"><a class="btn sm" href="/#prenota">Prenota</a></div></header>
<main id="contenuto">
<section class="intro" aria-labelledby="page-title"><div class="wrap">
  <nav class="crumbs" aria-label="Percorso"><a href="/">Backrooms Studio</a> / <span>${esc(p.h1)}</span></nav>
  <div class="eyebrow">${esc(p.eyebrow)}</div>
  <h1 id="page-title" class="gold-text t3d">${esc(p.h1)}</h1>
  <p class="lead">${esc(p.intro)}</p>
  <div class="cta"><a class="btn" href="${waLink(p.wa)}" target="_blank" rel="noopener" data-track="whatsapp_${p.slug}">Scrivici su WhatsApp â†’</a><a class="btn-ghost" href="/#prenota">Prenota la prima sessione gratis</a></div>
</div></section>

<section class="sec" aria-label="Dettagli del servizio"><div class="wrap"><div class="svc-grid">
${p.sections.map((s, i) => `  <article class="slab${i % 2 ? ' chrome' : ''} rv"><div class="face"><h2>${esc(s.title)}</h2>${s.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}${s.bullets ? `<ul>${s.bullets.map((b) => `<li>${check}<span>${esc(b)}</span></li>`).join('')}</ul>` : ''}</div></article>`).join('\n')}
</div></div></section>

<section class="sec" aria-labelledby="steps-title"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">Passo dopo passo</div><h2 class="t gold-text t3d" id="steps-title">${esc(p.stepsTitle)}</h2></div></div>
  <div class="path" id="path"><ol class="path-steps">
${p.steps.map(([t, d], i) => `    <li><i class="dot" aria-hidden="true"></i><span class="n">${String(i + 1).padStart(2, '0')}</span><h3 style="margin-top:12px">${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n')}
  </ol></div>
</div></section>

<section class="sec" aria-labelledby="rev-title"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">Recensioni 5â˜… su Google</div><h2 class="t gold-text t3d" id="rev-title">Cosa dicono gli artisti</h2></div></div>
  <div class="svc-grid">
${p.reviews.map((a) => `    <figure class="slab rv"><div class="face"><div style="color:#ffd76a;letter-spacing:.2em" aria-label="5 stelle su 5">â˜…â˜…â˜…â˜…â˜…</div><blockquote><p style="color:#fff">â€œ${esc(REVIEWS[a])}â€</p></blockquote><figcaption style="margin-top:16px;font:700 12px/1 var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--muted)">${esc(a)} Â· su Google</figcaption></div></figure>`).join('\n')}
  </div>
</div></section>

<section class="sec" id="faq" aria-labelledby="faq-title"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">Domande frequenti</div><h2 class="t gold-text t3d" id="faq-title">Prima di prenotare</h2></div></div>
  <div class="faq rv">
${p.faqs.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
  </div>
  <div class="path-cta rv"><a class="btn" href="${waLink(p.wa)}" target="_blank" rel="noopener" data-track="whatsapp_${p.slug}">Chiedi un preventivo su WhatsApp â†’</a><p>La prima sessione Ã¨ gratis. Rispondiamo anche di sera.</p></div>
</div></section>

<section class="sec" aria-labelledby="rel-title" style="padding-top:0"><div class="wrap">
  <h2 class="eyebrow" id="rel-title" style="margin-bottom:18px">Altri servizi dello studio</h2>
  <div class="rel">${related.map((o) => `<a href="/${o.slug}/">${esc(o.h1)}<span aria-hidden="true">â†’</span></a>`).join('')}<a href="/#lounge">Scopri lo Studio Lounge<span aria-hidden="true">â†’</span></a></div>
</div></section>
</main>
<footer class="foot"><div class="wrap"><div class="legal"><div>Â© 2026 Backrooms Studio Â· Via Galileo Galilei, 3, 36057 Arcugnano (VI)<br>Luca Cappellari Â· P.IVA 04596940249<br>Freya Michelazzo Â· P.IVA 04627790241</div><div class="l2"><a href="/">Home</a><a href="tel:+393248911607" data-track="telefono">+39 324 891 1607</a><a href="/privacy/">Privacy e cookie</a><a href="/termini/">Termini</a></div></div></div></footer>
<script>
// comparsa delle sezioni e Google Analytics (solo se l'utente l'ha giÃ  accettato sulla home)
(function(){var io='IntersectionObserver'in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.08}):null;[].forEach.call(document.querySelectorAll('.rv'),function(el){io?io.observe(el):el.classList.add('in')});
var ok=null;try{ok=localStorage.getItem('bs_consent')}catch(e){}if(ok!=='yes')return;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-VTL6MDD9VZ';document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','G-VTL6MDD9VZ',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});
document.addEventListener('click',function(e){var a=e.target.closest('[data-track]');if(a)gtag('event','click_'+a.getAttribute('data-track'))})})();
</script>
<script src="/js/fx.js?v=${V}" defer></script>
</body>
</html>
`;
}

for (const p of PAGES) {
  const file = join(OUT, p.slug, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(p));
  console.log('scritta', file);
}
