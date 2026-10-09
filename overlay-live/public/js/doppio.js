// Layout «Studio Production» (9:16, webcam sopra e DAW sotto) e «Reaction Release» (webcam e schermo condiviso: in
// verticale uno sopra l'altro, in orizzontale affiancati con ?formato=orizzontale). Muti. Una pagina per due layout:
// quale lo dice <body data-formato="produzione|reaction">. Disegna la targa del titolo (tre righe, accento e icona del preset,
// cambio di testo in tempo reale con un breve flip) e la fascia social; lo sfondo, le finestre e il divisore dell'orizzontale
// sono solo HTML e CSS (doppio.css).
// Parametri URL: ?anteprima=1 (sfondo nero e finti schermi), ?guide=1 (zone dei telefoni, solo verticale),
// ?statico=1 (senza animazioni, per i mockup), ?formato=orizzontale (solo la reaction: 1920×1080).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, $, STATICO } from "./pagina.js";
import { creaTarga } from "./targa.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia, stileTitolo } from "./formati-logica.js";

const FORMATO = document.body.dataset.formato; // "produzione" | "reaction"
const BARRA = { produzione: "prBarra", reaction: "reBarra" }[FORMATO];
const WIDGET_TITOLO = { produzione: "prTitolo", reaction: "reTitolo" }[FORMATO];
const { palco, orizzontale } = avviaPagina({ orizzontaleAmmesso: FORMATO === "reaction" });

let primoDisegno = true;

const fascia = creaFascia({
  radice: $(".fm-fascia"),
  nastro: $("#sp-nastro"),
  larghezza: orizzontale ? 1920 : 1080,
  voci: (s) => vociFascia(s, FORMATO),
  velocita: (s) => velocitaFascia(s, FORMATO),
  statico: STATICO,
});

collega({
  suStato(s) {
    fascia.radice.classList.toggle("fuori", !s.visibili[BARRA]);
    fascia.aggiorna(s);
    applicaTesti(palco, s[FORMATO].testi);
    disegnaTitolo(s);
    primoDisegno = false;
  },
});

// ---------- Titolo ----------
const targa = $("#fm-titolo");
const icona = $("#fm-titolo-icona");
// Le tre righe: l'elemento, il gruppo di testo (dimensione scelta in regia), il corpo massimo e il minimo con cui si adattano.
const titolo = creaTarga({
  statico: STATICO,
  righe: {
    // I massimi sono i corpi di base di formati.css e doppio.css (--c-sopra, --c-testo, --c-sotto): 28 / 88 / 32 in verticale, 26 / 58 / 28 in orizzontale.
    sopra: { el: $("#fm-titolo-sopra"), gruppo: "sopra", massimo: orizzontale ? 26 : 28, minimo: 14 },
    testo: { el: $("#fm-titolo-testo"), gruppo: "titolo", massimo: orizzontale ? 58 : 88, minimo: orizzontale ? 32 : 40 },
    sotto: { el: $("#fm-titolo-sotto"), gruppo: "sotto", massimo: orizzontale ? 28 : 32, minimo: 16, nascondiSeVuota: true },
  },
});

function disegnaTitolo(s) {
  const dati = s[FORMATO].titolo;
  const stile = stileTitolo(FORMATO, dati);
  targa.dataset.accento = stile.accento;
  icona.toggleAttribute("hidden", !stile.icona); // un'icona SVG non ha la proprietà «hidden»
  if (stile.icona) icona.querySelector("use").setAttribute("href", `#ic-${stile.icona}`);
  targa.classList.toggle("fuori", !s.visibili[WIDGET_TITOLO]);
  titolo.aggiorna(dati, s[FORMATO].testi, primoDisegno);
}

// Con i font caricati le larghezze cambiano: si riadattano le righe e si rimisura il nastro.
function rimisura() {
  fascia.rimisura();
  titolo.rimisura();
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
