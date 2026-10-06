// Layout «Live session in studio»: split screen da tre (fonico in alto, artista al centro, DAW in basso).
// Tra fonico e artista la targa 3D con nome e Instagram dell'artista (scritti dalla regia a ogni sessione);
// tra artista e DAW la barra dei nostri social che scorre, da cui salgono le comparse dello studio.
// NESSUN SUONO: l'artista sta registrando. Questa pagina non carica nemmeno gli effetti sonori.
// Parametri URL: ?anteprima=1 (sfondo nero e finti schermi), ?guide=1 (zone dei telefoni e dei tre schermi),
// ?statico=1 (senza animazioni, per i mockup), ?comparsa=1 (prima comparsa ferma, per i mockup; 2 la seconda…),
// ?w=targa,barra,comparse (parti da includere).
import { collega } from "./connessione.js";
import { vociStudio, richiesteComparsa, prossimaComparsa, USCITA_COMPARSA_MS, SALITA_COMPARSA_MS, GIRO_TARGA_MS } from "./studio-logica.js";
import { creaNastro } from "./nastro.js";

const LARGHEZZA = 1080;
const ALTEZZA = 1920;
const parametri = new URLSearchParams(location.search);
const STATICO = parametri.has("statico");
const PARTI = (parametri.get("w") ?? "targa,barra,comparse").split(",");
const COMPARSA_FISSA = Number(parametri.get("comparsa")) || 0; // solo per i mockup
const SVG = "http://www.w3.org/2000/svg";

const $ = (sel) => document.querySelector(sel);
const palco = $(".palco");

document.body.classList.toggle("anteprima", parametri.has("anteprima"));
document.body.classList.toggle("statico", STATICO);
document.body.classList.toggle("guide-attive", parametri.has("guide"));
for (const el of document.querySelectorAll("[data-parte]")) el.hidden = !PARTI.includes(el.dataset.parte);

// La sorgente può avere qualsiasi dimensione: il palco si adatta mantenendo le proporzioni.
function adattaPalco() {
  palco.style.setProperty("--scala", Math.min(innerWidth / LARGHEZZA, innerHeight / ALTEZZA));
}
addEventListener("resize", adattaPalco);
adattaPalco();

// Entrata al caricamento. LIVE Studio può ricaricare la sorgente: rifà solo questa entrata.
if (!STATICO) {
  palco.classList.add("entrata");
  setTimeout(() => palco.classList.remove("entrata"), 2400);
}

// ---------- Utilità ----------
function rilancia(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth; // forza il riavvio dell'animazione CSS
  el.classList.add(classe);
}

// Riduce il corpo del testo finché non entra nella larghezza disponibile.
function adattaTesto(el, massimo, minimo) {
  let corpo = massimo;
  el.style.fontSize = `${corpo}px`;
  while (el.scrollWidth > el.clientWidth && corpo > minimo) {
    corpo -= 2;
    el.style.fontSize = `${corpo}px`;
  }
}

function nodo(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

function simbolo(id, classe) {
  const svg = document.createElementNS(SVG, "svg");
  if (classe) svg.setAttribute("class", classe);
  const use = document.createElementNS(SVG, "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

function logo() {
  return Object.assign(document.createElement("img"), { src: "/assets/logo-br.png", alt: "" });
}

// Un indirizzo (es. backroomsstudio.it) o un account (@backrooms.studios) nella frase resta evidenziato in oro.
const LINK = /(@[a-z0-9_.]+|[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i;
function scriviConLink(el, testo) {
  el.replaceChildren(
    ...String(testo)
      .split(LINK)
      .map((pezzo, i) => (i % 2 ? nodo("b", "link", pezzo) : pezzo)),
  );
}

// Moneta 3D col logo BR: due facce e un bordo cromato fatto di dischi sovrapposti, così girando ha spessore.
function costruisciMoneta(el) {
  const corpo = nodo("div", "st-moneta-corpo");
  for (let z = -3; z <= 3; z++) {
    const bordo = nodo("i", "st-moneta-bordo");
    bordo.style.transform = `translateZ(${z}px)`;
    corpo.append(bordo);
  }
  for (const lato of ["fronte", "retro"]) {
    const faccia = nodo("div", `st-moneta-faccia ${lato}`);
    faccia.append(logo());
    corpo.append(faccia);
  }
  el.append(corpo);
}
for (const el of document.querySelectorAll("[data-moneta]")) costruisciMoneta(el);

// ---------- Stato ----------
let stato = null;
let primoDisegno = true;

collega({
  suStato(s, eventi) {
    const prima = stato;
    stato = s;
    disegnaTarga(s);
    disegnaBarra(s);
    disegnaComparse(prima, s, eventi);
    if (primoDisegno && COMPARSA_FISSA) comparsaPerMockup(s);
    primoDisegno = false;
  },
});

// ---------- Targa dell'artista ----------
const targa = {
  radice: $("#st-targa"),
  artista: $("#st-artista"),
  igTesto: $("#st-ig-testo"),
  etichettaRiga: $("#st-etichetta-riga"),
  etichetta: $("#st-etichetta"),
};
let firmaTarga = null;
let timerTarga = null;

function disegnaTarga(s) {
  const st = s.studio;
  targa.radice.classList.toggle("fuori", !s.visibili.targa);
  const firma = JSON.stringify([st.artista, st.instagram, st.etichetta]);
  if (firma === firmaTarga) return;
  const primaVolta = firmaTarga === null;
  firmaTarga = firma;
  clearTimeout(timerTarga);
  if (primaVolta || STATICO || !s.visibili.targa) return scriviTarga(st);
  // Artista nuovo: la targa fa un giro su se stessa e a metà giro mostra il nome nuovo.
  rilancia(targa.radice, "gira");
  timerTarga = setTimeout(() => {
    scriviTarga(stato.studio);
    timerTarga = setTimeout(() => targa.radice.classList.remove("gira"), GIRO_TARGA_MS / 2);
  }, GIRO_TARGA_MS / 2);
}

function scriviTarga(st) {
  const vuota = !st.artista;
  targa.radice.classList.toggle("vuota", vuota);
  targa.radice.classList.toggle("senza-ig", vuota || !st.instagram);
  targa.etichetta.textContent = st.etichetta;
  targa.etichettaRiga.hidden = vuota || !st.etichetta;
  // Senza artista la targa resta in onda con la riga sopra («Live session in studio»), in gotico.
  targa.artista.textContent = vuota ? st.etichetta || "Backrooms Studio" : st.artista;
  targa.igTesto.textContent = st.instagram ? `@${st.instagram}` : "";
  adattaTarga();
}

function adattaTarga() {
  const vuota = targa.radice.classList.contains("vuota");
  if (targa.artista.textContent) adattaTesto(targa.artista, vuota ? 72 : 80, 40);
  if (targa.igTesto.textContent) adattaTesto(targa.igTesto, 38, 24);
}

// ---------- Barra dei social ----------
const CON_BARRA = PARTI.includes("barra");
const barra = { radice: $(".st-barra"), filoOro: $("#sp-filo-oro") };

function icona(nome) {
  const cerchio = nodo("span", `sp-icona ${nome}`);
  if (nome === "logo") cerchio.append(logo());
  else cerchio.append(simbolo(`ic-${nome}`));
  return cerchio;
}

function creaPezzo(voce) {
  const pezzo = nodo("div", "sp-pezzo");
  const v = nodo("div", `sp-voce ${voce.tipo}`);
  v.dataset.colore = voce.icone[0];
  const icone = nodo("span", "sp-icone");
  for (const nome of voce.icone) icone.append(icona(nome));
  v.append(icone);
  if (voce.etichetta) v.append(nodo("span", "sp-etichetta", voce.etichetta));
  if (voce.tipo === "artista") {
    v.append(nodo("span", "sp-testo maiuscolo", voce.testo));
    if (voce.instagram) v.append(icona("instagram"), nodo("span", "sp-testo st-ig-barra", voce.instagram));
  } else {
    v.append(nodo("span", `sp-testo${voce.oro ? " oro" : ""}`, voce.testo));
  }
  pezzo.append(v, simbolo("punta", "sp-sep"));
  return pezzo;
}

const nastro = CON_BARRA
  ? creaNastro({ nastro: $("#sp-nastro"), creaPezzo, inizio: () => 236, velocita: () => stato?.studio.velocita ?? 0, statico: STATICO })
  : null;

function disegnaBarra(s) {
  if (!nastro) return; // sorgente divisa senza barra: il nastro non gira
  barra.radice.classList.toggle("fuori", !s.visibili.barraStudio);
  nastro.aggiorna(vociStudio(s));
}

// ---------- Comparse dello studio ----------
const comparsa = {
  el: $("#st-comparsa"),
  icona: $("#st-comparsa-icona use"),
  sopra: $("#st-comparsa-sopra"),
  titolo: $("#st-comparsa-titolo"),
  sotto: $("#st-comparsa-sotto"),
  aperta: false,
  chiude: false,
  timer: null,
  ultimaId: null, // l'ultima mostrata: la prossima del giro è quella dopo
  mostrata: null, // testi in onda, per aggiornarli se la regia li corregge
};
let ultimaComparsaAlle = performance.now();

function disegnaComparse(prima, s, eventi) {
  if (!s.visibili.comparse) chiudiComparsa();
  for (const id of richiesteComparsa(prima, s, eventi)) mostraComparsa(id);
  // La regia corregge la comparsa in onda: i testi cambiano senza farla riscendere.
  if (comparsa.aperta && !comparsa.chiude) {
    const c = s.studio.comparse.find((x) => x.id === comparsa.ultimaId);
    if (!c) chiudiComparsa();
    else if (JSON.stringify(c) !== comparsa.mostrata) riempiComparsa(c);
  }
}

function riempiComparsa(c) {
  comparsa.mostrata = JSON.stringify(c);
  comparsa.icona.setAttribute("href", `#ic-${c.icona === "instagram+tiktok" ? "instagram" : c.icona}`);
  comparsa.el.dataset.colore = c.icona;
  comparsa.sopra.textContent = c.sopra;
  comparsa.sopra.hidden = !c.sopra;
  comparsa.titolo.textContent = c.titolo;
  scriviConLink(comparsa.sotto, c.sotto);
  comparsa.sotto.hidden = !c.sotto;
  adattaComparsa();
}

function adattaComparsa() {
  if (comparsa.titolo.textContent) adattaTesto(comparsa.titolo, 58, 34); // gotico
  if (comparsa.sotto.textContent) adattaTesto(comparsa.sotto, 30, 22);
  if (comparsa.sopra.textContent) adattaTesto(comparsa.sopra, 24, 18);
}

function mostraComparsa(id, { fissa = false, scelta = null } = {}) {
  if (!stato.visibili.comparse) return;
  const c = scelta ?? prossimaComparsa(stato.studio.comparse, comparsa.ultimaId, id);
  if (!c) return;
  const giaSu = comparsa.aperta && !comparsa.chiude;
  clearTimeout(comparsa.timer);
  riempiComparsa(c);
  comparsa.ultimaId = c.id;
  comparsa.aperta = true;
  comparsa.chiude = false;
  ultimaComparsaAlle = performance.now();
  if (giaSu) rilancia(comparsa.el, "cambia");
  else {
    comparsa.el.classList.remove("cambia");
    comparsa.el.classList.add("su");
    rilancia(comparsa.el, "arriva");
    if (!STATICO && CON_BARRA) setTimeout(() => rilancia(barra.filoOro, "lampo-oro"), SALITA_COMPARSA_MS * 0.5);
  }
  if (!fissa) comparsa.timer = setTimeout(() => chiudiComparsa(), stato.studio.durataComparsa * 1000);
}

function chiudiComparsa() {
  if (!comparsa.aperta || comparsa.chiude) return;
  clearTimeout(comparsa.timer);
  comparsa.el.classList.remove("su", "arriva", "cambia");
  comparsa.chiude = true;
  comparsa.timer = setTimeout(() => {
    comparsa.aperta = false;
    comparsa.chiude = false;
  }, USCITA_COMPARSA_MS + 100);
}

// Comparse automatiche ogni N minuti, a giro (mute come tutto il layout). Una chiesta a mano fa ripartire il conteggio.
setInterval(() => {
  const minuti = stato?.studio.comparsaOgniMinuti ?? 0;
  if (minuti <= 0 || STATICO || comparsa.aperta || !stato.visibili.comparse) return;
  if (performance.now() - ultimaComparsaAlle >= minuti * 60_000) mostraComparsa(null);
}, 1000);

// ?comparsa=1 (o 2, 3…): comparsa ferma, per i mockup.
function comparsaPerMockup(s) {
  const c = s.studio.comparse[COMPARSA_FISSA - 1] ?? s.studio.comparse[0];
  if (c) mostraComparsa(null, { fissa: true, scelta: c });
}

// Con i font caricati le larghezze cambiano: si riadattano i testi e si rimisura il nastro.
// Si rimisura a ogni caricamento (con i font già nella cache di LIVE Studio «ready» arriva prima dello stato).
function rimisura() {
  adattaTarga();
  if (comparsa.aperta) adattaComparsa();
  nastro?.rimisura();
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
