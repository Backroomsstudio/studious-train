// Layout «Drum Challenge Live» (9:16): la camera del batterista a tutto schermo sotto la pagina, la grafica intorno e sopra.
// I Like di TikTok riempiono la colonna dei traguardi (4 moduli: l'ultimo sbloccato, l'attivo, i prossimi); ogni tappa
// raggiunta sblocca un brano. In più: contatore dei Like, brano in esecuzione, «Dona un [slot]» sempre in vista,
// cornice ed equalizzatore, fascia social con lo slot dell'artista ospite. Disegna lo stato che arriva dal server.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni), ?statico=1 (senza animazioni,
// per i mockup), ?sblocco=1 (con ?statico=1: il banner di sblocco fermo, per i mockup).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, adattaTesto, nodo, simbolo, logo, rilancia, ts, $, STATICO, parametri } from "./pagina.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia } from "./formati-logica.js";
import { formattaLike, etichettaLike, finestraScaletta, titoloBrano } from "./drum-logica.js";
import { creaClessidra } from "./drum-clessidra.js";

const { palco } = avviaPagina();
const BANNER_FISSO = STATICO && parametri.has("sblocco"); // solo per i mockup
const PULSAZIONE_MS = 20_000;
const CONTEGGIO_MS = 600;
// Quale interruttore «In onda» della regia accende ogni parte (il brano si nasconde da sé senza titolo).
const WIDGET = { "#dr-cornice": "drumCornice", "#dr-eq": "drumCornice", "#dr-brano": "drumBrano", "#dr-priorita": "drumPriorita", "#dr-contatore": "drumTraguardi", "#dr-colonna": "drumTraguardi" };

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
    stato = s;
    disegna(s, eventi);
    primoDisegno = false;
  },
});

function disegna(s, eventi) {
  const d = s.drum;
  applicaTesti(palco, d.testi);
  for (const [sel, widget] of Object.entries(WIDGET)) $(sel).classList.toggle("fuori", !s.visibili[widget]);
  fascia.radice.classList.toggle("fuori", !s.visibili.drumBarra);
  fascia.aggiorna(s);
  disegnaContatore(d);
  disegnaColonna(d);
  disegnaBrano(d);
  disegnaPriorita(d);
  disegnaBanner(d);
  // Il richiamo della regia: «Dona un…» pulsa subito (mai al primo disegno).
  if (!primoDisegno && eventi.some((e) => e.nome === "richiamoDrum")) rilancia($("#dr-priorita"), "pulsa");
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
  const raggiunte = d.attiva ?? d.scaletta.length;
  const { voci } = finestraScaletta(d.scaletta, raggiunte, moduli.length);
  if (!cambiata("colonna", voci, d.contati, d.progresso, d.testi.traguardi, d.riempimento)) return;
  const cresce = likePrima !== null && d.contati > likePrima;
  likePrima = d.contati;
  moduli.forEach((m, i) => riempiModulo(m, voci[i], d, cresce));
}

function riempiModulo(m, voce, d, cresce) {
  m.el.hidden = !voce;
  if (!voce) return;
  const sbloccata = voce.stato === "sbloccata";
  m.el.dataset.indice = voce.indice;
  m.el.dataset.stato = voce.stato;
  // Il riempimento: piena se sbloccata, vuota se chiusa, in proporzione ai Like se attiva. Un posto che passa a un'altra
  // tappa (la finestra scorre) o il primo disegno non partono dal vecchio livello: niente animazione.
  m.clessidra.cambiaStile(d.riempimento);
  m.clessidra.imposta({
    livello: sbloccata ? 1 : voce.stato === "attiva" ? d.progresso : 0,
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
// La sequenza vera (urto, banner, colonna che scorre) arriva con il suo compito; qui solo lo stato fermo dei mockup.
function disegnaBanner(d) {
  if (!BANNER_FISSO || !cambiata("banner", d.attiva, d.scaletta, d.testi.sblocco)) return;
  const raggiunte = d.attiva ?? d.scaletta.length;
  const tappa = d.scaletta[raggiunte - 1];
  $("#dr-sblocco").hidden = !tappa;
  if (!tappa) return;
  const titolo = $("#dr-sblocco-titolo");
  titolo.textContent = titoloBrano(tappa.titolo);
  adattaTesto($(".dr-sblocco-etichetta"), 28 * ts(d.testi, "sblocco"), 16);
  adattaTesto(titolo, 72 * ts(d.testi, "sblocco"), 26);
}

// Con i font caricati le larghezze cambiano: si riadattano i testi e si rimisura il nastro.
function rimisura() {
  fascia.rimisura();
  firme = {};
  if (stato) disegna(stato, []);
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
