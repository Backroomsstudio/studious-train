// Layout «Back Rooms Podcast» (9:16 e, con ?formato=orizzontale, 16:9): la camera del divano a tutto schermo sotto la pagina,
// con una targa («Back Rooms Podcast» e la riga dell'episodio), la linea di divisione, il pannello Tematiche (la tematica
// attiva ha il bordo oro) e la fascia social con gli ospiti. Muto. La linea e il pannello si accendono e si spengono a
// comando con la loro animazione; la targa e le voci cambiano in tempo reale; al primo disegno e con ?statico=1 niente si anima.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni, solo verticale),
// ?statico=1 (senza animazioni, per i mockup), ?formato=orizzontale (1920×1080).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, adattaTesto, nodo, simbolo, ts, $, STATICO } from "./pagina.js";
import { creaTarga } from "./targa.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia, statiTematiche } from "./formati-logica.js";

const { palco, orizzontale } = avviaPagina({ orizzontaleAmmesso: true });
const USCITA_MS = 750; // la linea si ritira in 700 ms e il pannello esce in 600: poi sono nascosti
let primoDisegno = true;
let ultimo = null; // l'ultimo stato disegnato (per rimisurare a font caricati)

const fascia = creaFascia({
  radice: $(".fm-fascia"),
  nastro: $("#sp-nastro"),
  larghezza: orizzontale ? 1920 : 1080,
  voci: (s) => vociFascia(s, "podcast"),
  velocita: (s) => velocitaFascia(s, "podcast"),
  statico: STATICO,
});

collega({
  suStato(s) {
    ultimo = s;
    fascia.radice.classList.toggle("fuori", !s.visibili.poBarra);
    fascia.aggiorna(s);
    applicaTesti(palco, s.podcast.testi);
    disegnaTarga(s);
    linea(s.visibili.poLinea, primoDisegno || STATICO);
    disegnaTematiche(s);
    primoDisegno = false;
  },
});

// Accende o spegne un pezzo con la sua animazione: spento resta «fuori» (la transizione del CSS lo porta via) e solo dopo
// l'uscita diventa nascosto; acceso torna visibile e perde «fuori». `subito` (primo disegno, ?statico=1): senza transizione.
function creaInterruttore(el) {
  let acceso = null;
  let uscita = 0;
  return (voluto, subito = false) => {
    if (voluto === acceso) return;
    acceso = voluto;
    clearTimeout(uscita);
    el.classList.toggle("subito", subito);
    if (voluto) {
      el.hidden = false;
      void el.offsetWidth; // si parte da «fuori»: la transizione corre tra i due stati
      el.classList.remove("fuori");
    } else {
      el.classList.add("fuori");
      if (subito) el.hidden = true;
      else uscita = setTimeout(() => (el.hidden = true), USCITA_MS);
    }
    if (subito) {
      void el.offsetWidth;
      el.classList.remove("subito");
    }
  };
}

// ---------- Targa ----------
const targa = $("#po-targa");
// Le due righe: l'elemento, il gruppo di testo (dimensione scelta in regia), il corpo massimo e il minimo con cui si adattano.
// Il titolo può scendere fino a 20 px perché nella targa orizzontale (512 px, due monete) un testo di 32 caratteri deve entrare.
// I massimi sono i corpi di base di podcast.css (--c-testo 48, --c-sotto 32): la scatola di ogni riga è alta quanto serve alle lettere.
const titolo = creaTarga({
  statico: STATICO,
  righe: {
    testo: { el: $("#po-targa-testo"), gruppo: "targa", massimo: 48, minimo: 20 },
    sotto: { el: $("#po-targa-sotto"), gruppo: "targa", massimo: 32, minimo: 14, nascondiSeVuota: true },
  },
});

function disegnaTarga(s) {
  targa.classList.toggle("fuori", !s.visibili.poTitolo);
  titolo.aggiorna(s.podcast.titolo, s.podcast.testi, primoDisegno);
}

// ---------- Linea di divisione ----------
const linea = creaInterruttore($("#po-linea"));

// ---------- Pannello Tematiche ----------
const pannello = $("#po-tematiche");
const intestazione = $("#po-tematiche-titolo");
const elenco = $("#po-elenco");
const cursore = $("#po-cursore");
const interruttorePannello = creaInterruttore(pannello);
const righe = []; // { el, icona, testo }: una per tematica, nell'ordine dell'elenco
let inVista = false; // il pannello è acceso (anche se sta ancora entrando)
let firma = ""; // quello che c'è disegnato: si rifà solo se cambia

function creaRiga() {
  const icona = simbolo("ic-spunta");
  const segno = nodo("span", "po-tema-segno");
  segno.append(icona);
  const testo = nodo("span", "po-tema-testo");
  const el = nodo("div", "po-tema");
  el.append(segno, testo);
  elenco.append(el);
  return { el, icona, testo };
}

// Una riga o l'intestazione: mai più alta della sua scatola, adattata alla larghezza.
const adattaRiga = (el, massimo, minimo) => adattaTesto(el, Math.min(massimo, el.clientHeight), minimo);

function riempiPannello(s) {
  const t = s.podcast.tematiche;
  const scala = ts(s.podcast.testi, "tematiche");
  const nuova = JSON.stringify([t.titolo, t.elenco, t.attiva, scala]);
  if (nuova === firma) return;
  firma = nuova;
  intestazione.textContent = t.titolo;
  adattaRiga(intestazione, 34 * scala, 18);
  while (righe.length < t.elenco.length) righe.push(creaRiga());
  while (righe.length > t.elenco.length) righe.pop().el.remove();
  const stati = statiTematiche(t.elenco.length, t.attiva);
  t.elenco.forEach((voce, i) => {
    const riga = righe[i];
    riga.el.dataset.stato = stati[i];
    riga.icona.toggleAttribute("hidden", stati[i] === "prossima"); // la prossima ha un cerchietto, disegnato dal CSS
    riga.icona.querySelector("use").setAttribute("href", stati[i] === "fatta" ? "#ic-spunta" : "#ic-play");
    riga.testo.textContent = voce;
    adattaRiga(riga.testo, 34 * scala, 22);
  });
  cursore.hidden = t.elenco.length === 0;
  cursore.style.setProperty("--attiva", String(t.attiva));
}

function disegnaTematiche(s) {
  const acceso = s.visibili.poTematiche;
  pannello.dataset.lato = s.podcast.tematiche.lato;
  if (acceso) {
    // Appena acceso il pannello si misura presente ma ancora «fuori», e si riempie senza che il bordo scorra da dove stava.
    const appena = !inVista;
    if (appena) {
      pannello.hidden = false;
      pannello.classList.add("ferma");
    }
    riempiPannello(s);
    if (appena) {
      void pannello.offsetWidth;
      pannello.classList.remove("ferma");
    }
  }
  inVista = acceso;
  interruttorePannello(acceso, primoDisegno || STATICO);
}

// Con i font caricati le larghezze cambiano: si riadattano le righe e si rimisura il nastro.
function rimisura() {
  fascia.rimisura();
  titolo.rimisura();
  firma = "";
  if (ultimo && inVista) riempiPannello(ultimo);
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
