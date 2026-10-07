// Layout «Drum Challenge Live» (9:16): la camera del batterista a tutto schermo sotto la pagina, la grafica intorno e sopra.
// I Like di TikTok riempiono la colonna dei traguardi (4 moduli: l'ultimo sbloccato, l'attivo, i prossimi); ogni tappa
// raggiunta sblocca un brano, con la sua sequenza (drum-sblocco.js) e il suo suono. In più: contatore dei Like, brano in
// esecuzione, «Dona un [slot]» sempre in vista, cornice ed equalizzatore, fascia social con lo slot dell'artista ospite.
// Disegna lo stato che arriva dal server.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni), ?statico=1 (senza animazioni né
// suoni, per i mockup), ?muto=1 (nessun suono da questa pagina), ?sblocco=1 (con ?statico=1: il banner di sblocco fermo,
// per i mockup).
import { collega } from "./connessione.js";
import { suona, volume } from "./suoni.js";
import { suoniDrum, suonaIn } from "./eventi-sonori.js";
import { avviaPagina, applicaTesti, adattaTesto, nodo, simbolo, logo, rilancia, ts, $, STATICO, parametri } from "./pagina.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia } from "./formati-logica.js";
import { formattaLike, etichettaLike, finestraScaletta, livelloVoce, titoloBrano } from "./drum-logica.js";
import { creaClessidra } from "./drum-clessidra.js";
import { creaSblocco } from "./drum-sblocco.js";

const { palco } = avviaPagina();
const BANNER_FISSO = STATICO && parametri.has("sblocco"); // solo per i mockup
const MUTO = parametri.has("muto") || STATICO;
const PULSAZIONE_MS = 20_000;
const CONTEGGIO_MS = 600;
const USCITA_BANNER_MS = 380;
// Quale interruttore «In onda» della regia accende ogni parte (il brano si nasconde da sé senza titolo).
const WIDGET = { "#dr-cornice": "drumCornice", "#dr-eq": "drumCornice", "#dr-brano": "drumBrano", "#dr-priorita": "drumPriorita", "#dr-contatore": "drumTraguardi", "#dr-colonna": "drumTraguardi", "#dr-sblocco": "drumTraguardi" };

let stato = null;
let primoDisegno = true;
let firme = {}; // cosa è già disegnato per ogni parte: i Like arrivano a raffica, si rifà solo quello che cambia

const fascia = creaFascia({
  radice: $(".fm-fascia"),
  nastro: $("#sp-nastro"),
  larghezza: 1080,
  voci: (s) => vociFascia(s, "drum"),
  velocita: (s) => velocitaFascia(s, "drum"),
  statico: STATICO,
});

collega({
  suStato(s, eventi) {
    const prima = stato;
    stato = s;
    disegna(s, eventi);
    suoni(prima, s, eventi);
    primoDisegno = false;
  },
});

function disegna(s, eventi) {
  const d = s.drum;
  applicaTesti(palco, d.testi);
  for (const [sel, widget] of Object.entries(WIDGET)) $(sel).classList.toggle("fuori", !s.visibili[widget]);
  fascia.radice.classList.toggle("fuori", !s.visibili.drumBarra);
  fascia.aggiorna(s);
  // Lo sblocco parte dall'evento (mai al primo disegno, mai nei mockup, mai a colonna spenta); se in un aggiornamento ne
  // arrivano più d'uno conta l'ultimo. Spegnere la colonna a metà sequenza la interrompe.
  if (!s.visibili.drumTraguardi) sblocco.annulla();
  else if (!primoDisegno && !STATICO) {
    const ultimo = [...eventi].reverse().find((e) => e.nome === "sbloccoDrum");
    if (ultimo) sblocco.avvia(ultimo.dati);
  }
  disegnaContatore(d);
  disegnaColonna(d);
  disegnaBrano(d);
  disegnaPriorita(d);
  disegnaBanner(d);
  // Il richiamo della regia: «Dona un…» pulsa subito (mai al primo disegno).
  if (!primoDisegno && eventi.some((e) => e.nome === "richiamoDrum")) rilancia($("#dr-priorita"), "pulsa");
}

// Gli effetti suonano da qui solo se la regia ha scelto «overlay» e in onda c'è il Drum.
function suoni(prima, s, eventi) {
  if (MUTO || !prima || !suonaIn(s, "drum", "overlay")) return;
  const lista = suoniDrum(prima, s, eventi);
  if (!lista.length) return;
  volume(s.suoni.volume);
  for (const x of lista) suona(x.nome, x.dati, x.ritardo ?? 0);
}

// Disegna una parte solo se i suoi dati sono cambiati.
const cambiata = (parte, ...dati) => {
  const firma = JSON.stringify(dati);
  if (firme[parte] === firma) return false;
  firme[parte] = firma;
  return true;
};

// ---------- Contatore dei Like ----------
const numero = { el: $("#dr-like-numero"), mostrato: null, animazione: 0 };

function disegnaContatore(d) {
  if (!cambiata("contatore", d.contati, d.testi.contatore)) return;
  const el = numero.el;
  const prima = numero.mostrato;
  numero.mostrato = d.contati;
  cancelAnimationFrame(numero.animazione);
  el.textContent = formattaLike(d.contati);
  adattaTesto(el, 64 * ts(d.testi, "contatore"), 30);
  // Cresce: il numero sale in 600 ms (mai al primo disegno, mai nei mockup).
  if (primoDisegno || STATICO || prima === null || d.contati <= prima) return;
  const t0 = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / CONTEGGIO_MS);
    el.textContent = formattaLike(prima + (d.contati - prima) * (1 - (1 - k) ** 3));
    if (k < 1) numero.animazione = requestAnimationFrame(passo);
  };
  numero.animazione = requestAnimationFrame(passo);
}

// ---------- Colonna dei traguardi ----------
function creaModulo(i) {
  const el = nodo("div", "dr-modulo fm-vetro");
  el.style.setProperty("--i", i);
  const fondo = nodo("canvas", "dr-fondo"); // la clessidra (perline o sabbia) si disegna qui
  fondo.width = 288;
  fondo.height = 148;
  const icona = simbolo("ic-lucchetto", "dr-modulo-icona");
  const like = nodo("div", "dr-modulo-like");
  const titolo = nodo("div", "dr-modulo-titolo");
  const manca = nodo("span", "dr-modulo-manca");
  const perc = nodo("span", "dr-modulo-perc");
  const riga = nodo("div", "dr-modulo-riga");
  riga.append(manca, perc);
  el.append(fondo, like, icona, titolo, riga);
  $("#dr-colonna").append(el);
  const clessidra = creaClessidra(fondo, { statico: STATICO });
  return { el, fondo, clessidra, tappa: null, icona, like, titolo, riga, manca, perc };
}
const moduli = [0, 1, 2, 3].map(creaModulo);
let likePrima = null; // i Like dell'ultimo disegno della colonna: se salgono, nel modulo attivo cade un filo di grani

function disegnaColonna(d) {
  if (sblocco.occupata()) return; // la colonna sta scorrendo: la sequenza la rifà da sé alla fine
  const raggiunte = d.attiva ?? d.scaletta.length;
  const inUrto = sblocco.voci();
  const voci = inUrto ?? finestraScaletta(d.scaletta, raggiunte, moduli.length).voci;
  // Durante l'urto la colonna sta ferma (nessun modulo mostra i Like): i Like che salgono non la rifanno.
  if (!cambiata("colonna", voci, inUrto ? null : [d.contati, d.progresso], d.testi.traguardi, d.riempimento)) return;
  const cresce = likePrima !== null && d.contati > likePrima;
  likePrima = d.contati;
  moduli.forEach((m, i) => riempiModulo(m, voci[i], d, cresce));
}

// Rifà la colonna dallo stato di ora, anche se non è cambiato niente (fine dello scorrimento, sequenza interrotta).
function rifaiColonna() {
  delete firme.colonna;
  if (stato) disegnaColonna(stato.drum);
}

function riempiModulo(m, voce, d, cresce = false) {
  m.el.hidden = !voce;
  if (!voce) return;
  const sbloccata = voce.stato === "sbloccata";
  m.el.dataset.indice = voce.indice;
  m.el.dataset.stato = voce.stato;
  // Il riempimento: piena se sbloccata, vuota se chiusa, in proporzione ai Like se attiva. Un posto che passa a un'altra
  // tappa (la finestra scorre) o il primo disegno non partono dal vecchio livello: niente animazione.
  m.clessidra.cambiaStile(d.riempimento);
  m.clessidra.imposta({
    livello: livelloVoce(voce, d),
    attiva: voce.stato === "attiva" && cresce,
    subito: primoDisegno || m.tappa !== voce.indice,
  });
  m.tappa = voce.indice;
  m.like.textContent = etichettaLike(voce.like);
  m.icona.querySelector("use").setAttribute("href", sbloccata ? "#ic-spunta" : "#ic-lucchetto");
  m.titolo.textContent = sbloccata ? titoloBrano(voce.titolo) : "Brano segreto";
  m.riga.hidden = voce.stato !== "attiva";
  if (voce.stato === "attiva") {
    m.manca.textContent = `mancano ${formattaLike(Math.max(0, voce.like - d.contati))}`;
    m.perc.textContent = `${Math.min(99, Math.round(d.progresso * 100))}%`; // 100% è lo sblocco
  }
  const scala = ts(d.testi, "traguardi");
  adattaTesto(m.titolo, 34 * scala, 18);
  if (voce.stato === "attiva") adattaTesto(m.manca, 26 * scala, 14);
}

// ---------- Brano in esecuzione ----------
function disegnaBrano(d) {
  const b = d.brano;
  if (!cambiata("brano", b, d.testi.brano)) return;
  const radice = $("#dr-brano");
  radice.hidden = !b.titolo; // senza titolo il widget non c'è
  if (!b.titolo) return;
  const titolo = $("#dr-brano-titolo");
  const artista = $("#dr-brano-artista");
  titolo.textContent = b.titolo;
  artista.textContent = b.artista;
  // Con l'artista la riga sopra è sua (l'equalizzatore già dice che sta suonando); senza, c'è l'etichetta «In esecuzione».
  artista.hidden = !b.artista;
  $(".dr-brano-etichetta").hidden = Boolean(b.artista);
  adattaTesto(titolo, 40 * ts(d.testi, "brano"), 18);
  if (b.artista) adattaTesto(artista, 24 * ts(d.testi, "brano"), 16);
}

// ---------- Dona un [slot] ----------
function disegnaPriorita(d) {
  const p = d.priorita;
  if (!cambiata("priorita", p, d.testi.priorita)) return;
  const icona = $("#dr-pri-icona");
  icona.replaceChildren(p.icona === "logo" ? logo() : simbolo(`ic-${p.icona}`));
  const sopra = $("#dr-pri-sopra");
  const prefisso = $("#dr-pri-prefisso");
  const slot = $("#dr-pri-slot");
  sopra.textContent = p.sopra;
  sopra.hidden = !p.sopra;
  prefisso.textContent = p.prefisso;
  slot.textContent = p.slot;
  const scala = ts(d.testi, "priorita");
  if (p.sopra) adattaTesto(sopra, 24 * scala, 16);
  adattaTesto(prefisso, 38 * scala, 20);
  adattaTesto(slot, 56 * scala, 24);
}
// Pulsazione periodica: sempre in vista, ogni tanto richiama l'attenzione (e a comando dalla regia).
setInterval(() => {
  if (!STATICO && stato?.visibili.drumPriorita) rilancia($("#dr-priorita"), "pulsa");
}, PULSAZIONE_MS);

// ---------- Banner di sblocco ----------
const bannerEl = $("#dr-sblocco");
let uscitaBanner = 0;

// «Brano sbloccato» e il titolo, grande e verde neon; entra con uno scatto (non nei mockup).
function mostraBanner(tappa) {
  clearTimeout(uscitaBanner);
  const scala = ts(stato.drum.testi, "sblocco");
  const titolo = $("#dr-sblocco-titolo");
  titolo.textContent = titoloBrano(tappa.titolo);
  bannerEl.classList.remove("esce");
  bannerEl.hidden = false; // visibile prima di misurare i testi
  adattaTesto($(".dr-sblocco-etichetta"), 28 * scala, 16);
  adattaTesto(titolo, 72 * scala, 34);
  if (!STATICO) rilancia(bannerEl, "entra");
}

function nascondiBanner({ subito = false } = {}) {
  clearTimeout(uscitaBanner);
  if (bannerEl.hidden) return;
  if (subito || STATICO) {
    bannerEl.hidden = true;
    bannerEl.classList.remove("entra", "esce");
    return;
  }
  bannerEl.classList.remove("entra");
  rilancia(bannerEl, "esce");
  uscitaBanner = setTimeout(() => {
    bannerEl.hidden = true;
    bannerEl.classList.remove("esce");
  }, USCITA_BANNER_MS);
}

// Solo per i mockup (?statico=1&sblocco=1): lo stato finale della sequenza, con il titolo dell'ultima tappa sbloccata.
function disegnaBanner(d) {
  if (!BANNER_FISSO || !cambiata("banner", d.attiva, d.scaletta, d.testi.sblocco)) return;
  const raggiunte = d.attiva ?? d.scaletta.length;
  const tappa = d.scaletta[raggiunte - 1];
  if (tappa) mostraBanner(tappa);
  else bannerEl.hidden = true;
}

// ---------- Sequenza di sblocco ----------
const sblocco = creaSblocco({
  moduli,
  nuovoModulo: () => creaModulo(moduli.length),
  riempi: riempiModulo,
  rifai: rifaiColonna,
  leggi: () => stato.drum,
  colonna: $("#dr-colonna"),
  effetti: $("#dr-effetti"),
  banner: { mostra: mostraBanner, nascondi: nascondiBanner },
});

// Con i font caricati le larghezze cambiano: si riadattano i testi e si rimisura il nastro.
function rimisura() {
  fascia.rimisura();
  firme = {};
  if (stato) disegna(stato, []);
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
