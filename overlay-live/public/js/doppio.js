// Layout «Studio Production» (9:16, webcam sopra e DAW sotto) e «Reaction Release» (webcam e schermo condiviso: in
// verticale uno sopra l'altro, in orizzontale affiancati con ?formato=orizzontale). Muti. Una pagina per due layout:
// quale lo dice <body data-formato="produzione|reaction">. Disegna la targa del titolo (tre righe, accento e icona del preset,
// cambio di testo in tempo reale con un breve flip) e la fascia social; lo sfondo, le finestre e il divisore dell'orizzontale
// sono solo HTML e CSS (doppio.css).
// Parametri URL: ?anteprima=1 (sfondo nero e finti schermi), ?guide=1 (zone dei telefoni, solo verticale),
// ?statico=1 (senza animazioni, per i mockup), ?formato=orizzontale (solo la reaction: 1920×1080).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, adattaTesto, rilancia, ts, $, STATICO } from "./pagina.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia, stileTitolo } from "./formati-logica.js";

const FORMATO = document.body.dataset.formato; // "produzione" | "reaction"
const BARRA = { produzione: "prBarra", reaction: "reBarra" }[FORMATO];
const WIDGET_TITOLO = { produzione: "prTitolo", reaction: "reTitolo" }[FORMATO];
const { palco, orizzontale } = avviaPagina({ orizzontaleAmmesso: FORMATO === "reaction" });
const FLIP_MS = 380;

let stato = null;
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
    stato = s;
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
const RIGHE = {
  sopra: { el: $("#fm-titolo-sopra"), gruppo: "sopra", massimo: orizzontale ? 20 : 22, minimo: 12 },
  testo: { el: $("#fm-titolo-testo"), gruppo: "titolo", massimo: 88, minimo: 40 }, // 88 se la scatola lo permette (84 px in verticale, 70 in orizzontale)
  sotto: { el: $("#fm-titolo-sotto"), gruppo: "sotto", massimo: orizzontale ? 22 : 24, minimo: 14 },
};
let voluto = { sopra: "", testo: "", sotto: "" }; // quello che lo stato vuole
const scritto = {}; // quello che c'è scritto ora in ogni riga (cambia a metà del flip)
const timerFlip = {};
let firmaTesti = ""; // le dimensioni dei testi dell'ultimo disegno: se cambiano si riadattano le righe

// Scrive una riga (sempre il valore voluto di adesso: in due cambi di fila vince l'ultimo) e la adatta al suo riquadro.
function scrivi(riga) {
  const { el } = RIGHE[riga];
  scritto[riga] = voluto[riga];
  el.textContent = voluto[riga];
  if (riga === "sotto") el.hidden = !voluto[riga]; // senza testo la riga non c'è
  adatta(riga);
}

// Una riga cresce con la dimensione scelta in regia (60–200%) ma mai più alta della sua scatola: la riga ha un'altezza fissa e
// un testo più grande sporgerebbe sopra e sotto.
function adatta(riga) {
  const { el, gruppo, massimo, minimo } = RIGHE[riga];
  if (!el.hidden && stato) adattaTesto(el, Math.min(massimo * ts(stato[FORMATO].testi, gruppo), el.clientHeight), minimo);
}

function disegnaTitolo(s) {
  const titolo = s[FORMATO].titolo;
  const stile = stileTitolo(FORMATO, titolo);
  targa.dataset.accento = stile.accento;
  icona.toggleAttribute("hidden", !stile.icona); // un'icona SVG non ha la proprietà «hidden»
  if (stile.icona) icona.querySelector("use").setAttribute("href", `#ic-${stile.icona}`);
  targa.classList.toggle("fuori", !s.visibili[WIDGET_TITOLO]);
  voluto = { sopra: titolo.sopra ?? "", testo: titolo.testo ?? "", sotto: titolo.sotto ?? "" };
  const dimensioniCambiate = JSON.stringify(s[FORMATO].testi) !== firmaTesti;
  firmaTesti = JSON.stringify(s[FORMATO].testi);
  for (const riga of Object.keys(RIGHE)) {
    if (scritto[riga] === undefined || primoDisegno || STATICO) scrivi(riga);
    else if (scritto[riga] !== voluto[riga]) {
      // le parole cambiano a metà del flip; un altro cambio mentre gira rimette in moto il timer e vince l'ultimo
      rilancia(RIGHE[riga].el, "flip");
      clearTimeout(timerFlip[riga]);
      timerFlip[riga] = setTimeout(() => scrivi(riga), FLIP_MS / 2);
    } else if (dimensioniCambiate) adatta(riga); // stesso testo: cambia solo la dimensione scelta in regia
  }
}

// Con i font caricati le larghezze cambiano: si riadattano le righe e si rimisura il nastro.
function rimisura() {
  fascia.rimisura();
  for (const riga of Object.keys(RIGHE)) adatta(riga);
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
