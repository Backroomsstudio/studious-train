// Layout senza premio (live giornaliere di ascolto): banner «Mandaci la tua musica», barra dei social che scorre,
// scheda «Ora in ascolto» quando su Nero parte una traccia, spot dello studio. Disegna lo stato del server e suona gli effetti.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone coperte dall'app TikTok), ?muto=1 (nessun suono),
// ?statico=1 (senza animazioni né suoni, per i mockup), ?scheda=ascolto|studio (scheda già aperta, per i mockup),
// ?w=banner,barra,scheda (parti da includere).
import { collega } from "./connessione.js";
import { suona, volume } from "./suoni.js";
import { suoniSenzaPremio, richiesteScheda, suonaIn, SALITA_SCHEDA_MS, USCITA_SCHEDA_MS, DURATA_SPOT_MS, RICHIAMO_MS } from "./eventi-sonori.js";
import { vociBarra, ETICHETTE_TIER } from "./barra.js";

const LARGHEZZA = 1080;
const ALTEZZA = 1920;
const parametri = new URLSearchParams(location.search);
const STATICO = parametri.has("statico");
const MUTO = parametri.has("muto") || STATICO;
const PARTI = (parametri.get("w") ?? "banner,barra,scheda").split(",");
const CON_BARRA = PARTI.includes("barra");
const SCHEDA_FISSA = parametri.get("scheda"); // solo per i mockup
const SVG = "http://www.w3.org/2000/svg";

const $ = (sel) => document.querySelector(sel);
const palco = $(".palco");

document.body.classList.toggle("anteprima", parametri.has("anteprima"));
document.body.classList.toggle("statico", STATICO);
document.body.classList.toggle("guide-attive", parametri.has("guide"));
for (const el of document.querySelectorAll("[data-widget]")) el.hidden = !PARTI.includes(el.dataset.widget);

// La sorgente può avere qualsiasi dimensione: il palco si adatta mantenendo le proporzioni.
function adattaPalco() {
  palco.style.setProperty("--scala", Math.min(innerWidth / LARGHEZZA, innerHeight / ALTEZZA));
}
addEventListener("resize", adattaPalco);
adattaPalco();

// Entrata al caricamento, senza suono. LIVE Studio può ricaricare la sorgente: rifà solo questa entrata.
if (!STATICO) {
  palco.classList.add("entrata");
  setTimeout(() => palco.classList.remove("entrata"), 2200);
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

// Un indirizzo nella frase (es. backroomsstudio.it) resta minuscolo ed evidenziato in oro.
const LINK = /([a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i;
function scriviConLink(el, testo) {
  el.replaceChildren(
    ...String(testo)
      .split(LINK)
      .map((pezzo, i) => (i % 2 ? nodo("b", "link", pezzo) : pezzo)),
  );
}

// ---------- Stato e suoni ----------
let stato = null;
let primoDisegno = true;
let ultimaTracciaAlle = -Infinity;

collega({
  suStato(s, eventi) {
    const prima = stato;
    stato = s;
    const ora = performance.now();
    const suoni = suoniSenzaPremio(prima, s, eventi, { ora, ultimaTracciaAlle, richiamoInCorso });
    if (suoni.some((x) => x.traccia)) ultimaTracciaAlle = ora;
    riproduci(suoni);

    disegnaBanner(s);
    disegnaBarra(s);
    if (!s.visibili.scheda) chiudiScheda(true);
    for (const r of richiesteScheda(prima, s, eventi)) mostraScheda(r, r.daCorrente ? s.corrente.id : null);
    correggiSchedaAperta(s);
    if (eventi.some((e) => e.nome === "richiamo")) richiamo();
    if (primoDisegno && SCHEDA_FISSA) schedaPerMockup(s);
    primoDisegno = false;
  },
});

// Gli effetti suonano qui solo se in onda c'è questo layout e la regia ha scelto "overlay".
// Con le sorgenti divise (?w=) ogni suono parte solo dalla pagina che mostra la sua parte: niente suoni doppi.
function riproduci(suoni) {
  if (MUTO || !suoni.length || !suonaIn(stato, "senzaPremio", "overlay")) return;
  volume(stato.suoni.volume);
  for (const s of suoni) if (!s.parte || PARTI.includes(s.parte)) suona(s.nome, s.dati, s.ritardo ?? 0);
}

// ---------- Banner ----------
const banner = {
  radice: $(".sp-banner"),
  sopraRiga: $("#sp-sopra-riga"),
  sopra: $("#sp-sopra"),
  titolo: $("#sp-titolo"),
  pillola: $("#sp-pillola"),
  link: $("#sp-link"),
  divisore: $("#sp-divisore-centro"),
  schizzi: $("#sp-schizzi"),
};

function disegnaBanner(s) {
  const sp = s.senzaPremio;
  banner.radice.classList.toggle("fuori", !s.visibili.banner);
  banner.sopraRiga.hidden = !sp.sopra;
  if (banner.sopra.textContent !== sp.sopra) {
    banner.sopra.textContent = sp.sopra;
    adattaTesto(banner.sopra, 38, 28);
  }
  if (banner.titolo.textContent !== sp.titolo) {
    banner.titolo.textContent = sp.titolo;
    adattaTesto(banner.titolo, 112, 52);
  }
  banner.pillola.textContent = sp.pillola;
  banner.pillola.hidden = !sp.pillola;
  if (banner.link.textContent !== sp.link) {
    banner.link.textContent = sp.link;
    adattaTesto(banner.link, 62, 28);
  }
}

function adattaBanner() {
  if (banner.sopra.textContent) adattaTesto(banner.sopra, 38, 28);
  if (banner.titolo.textContent) adattaTesto(banner.titolo, 112, 52);
  if (banner.link.textContent) adattaTesto(banner.link, 62, 28);
}

// Il link «chiama»: bordo d'oro, link che pulsa, loghi che girano come monete, punte d'oro dai lati.
let richiamoInCorso = false;
let ultimoRichiamo = performance.now();

function richiamo() {
  ultimoRichiamo = performance.now();
  if (richiamoInCorso || STATICO || !stato?.visibili.banner) return;
  richiamoInCorso = true;
  rilancia(banner.radice, "richiamo");
  rilancia(banner.divisore, "lampo");
  const punte = [];
  for (let i = 0; i < 6; i++) {
    const lato = i < 3 ? -1 : 1;
    const p = simbolo("punta");
    p.style.setProperty("--x0", `${lato * 250}px`);
    p.style.setProperty("--dx", `${lato * (60 + ((i * 37) % 80))}px`);
    p.style.setProperty("--dy", `${((i % 3) - 1) * 40}px`);
    p.style.setProperty("--r", `${18 + ((i * 3) % 9)}px`);
    p.style.setProperty("--ritardo", `${0.2 + (i % 3) * 0.08}s`);
    punte.push(p);
  }
  banner.schizzi.replaceChildren(...punte);
  setTimeout(() => {
    banner.radice.classList.remove("richiamo");
    banner.schizzi.replaceChildren();
    richiamoInCorso = false;
  }, RICHIAMO_MS);
}

// Richiamo automatico ogni N minuti (muto). Uno a mano fa ripartire il conteggio.
setInterval(() => {
  const minuti = stato?.senzaPremio.richiamoOgniMinuti ?? 0;
  if (minuti > 0 && performance.now() - ultimoRichiamo >= minuti * 60_000) richiamo();
}, 1000);

// ---------- Barra che scorre (nastro) ----------
// I pezzi usciti a sinistra si tolgono, quelli nuovi si aggiungono a destra: il contenuto cambia solo fuori dalla vista.
const barra = { radice: $(".sp-barra"), nastro: $("#sp-nastro"), filoCamera: $(".sp-filo-camera"), filoOro: $("#sp-filo-oro") };
const BORDO_VISIBILE = 980; // oltre questa x il pezzo non si vede ancora sui telefoni
const RIEMPI_FINO = 1500;
let x = 0;
let pezzi = []; // { el, largo, chiave, tipo }
let scaletta = [];
let firmaScaletta = null;
let prossimo = 0;

const inizioNastro = () => (stato?.senzaPremio.loghiBarra ? 236 : 168);

function icona(nome) {
  const cerchio = nodo("span", `sp-icona ${nome}`);
  if (nome === "logo") cerchio.append(Object.assign(document.createElement("img"), { src: "/assets/logo-br.png", alt: "" }));
  else cerchio.append(simbolo(`ic-${nome}`));
  return cerchio;
}

function onda() {
  const o = nodo("i", "onda");
  for (let i = 0; i < 4; i++) o.append(document.createElement("b"));
  return o;
}

function creaPezzo(voce) {
  const pezzo = nodo("div", "sp-pezzo");
  const v = nodo("div", `sp-voce ${voce.tipo}`);
  if (voce.tipo === "ascolto") {
    v.append(onda(), nodo("span", "sp-etichetta", "Ora in ascolto"), nodo("span", "sp-testo maiuscolo", voce.titolo));
    if (voce.artista) v.append(nodo("span", "sp-trattino", "—"), nodo("span", "sp-artista", voce.artista));
    if (voce.tier) v.append(nodo("span", `tier ${voce.tier}`, ETICHETTE_TIER[voce.tier]));
  } else {
    v.dataset.colore = voce.icone[0];
    const icone = nodo("span", "sp-icone");
    for (const nome of voce.icone) icone.append(icona(nome));
    v.append(icone);
    if (voce.etichetta) v.append(nodo("span", "sp-etichetta", voce.etichetta));
    v.append(nodo("span", `sp-testo${voce.oro ? " oro" : ""}`, voce.testo));
  }
  pezzo.append(v, simbolo("punta", "sp-sep"));
  return pezzo;
}

function prossimaVoce() {
  if (!scaletta.length) return null;
  const voce = scaletta[prossimo % scaletta.length];
  prossimo = (prossimo + 1) % scaletta.length;
  return voce;
}

function riempi() {
  let totale = pezzi.reduce((somma, p) => somma + p.largo, 0);
  for (let i = 0; i < 40 && x + totale < RIEMPI_FINO; i++) {
    const voce = prossimaVoce();
    if (!voce) return;
    const el = creaPezzo(voce);
    barra.nastro.append(el);
    const p = { el, largo: el.offsetWidth, chiave: voce.chiave, tipo: voce.tipo };
    pezzi.push(p);
    totale += p.largo;
    if (!p.largo) return; // barra non disegnata (nascosta con ?w=): niente giri a vuoto
  }
}

function posiziona() {
  barra.nastro.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
}

function ripartiDaCapo() {
  for (const p of pezzi) p.el.remove();
  pezzi = [];
  prossimo = 0;
  x = inizioNastro();
  riempi();
  posiziona();
}

function disegnaBarra(s) {
  if (!CON_BARRA) return; // sorgente divisa senza barra: il nastro non gira
  const sp = s.senzaPremio;
  barra.radice.classList.toggle("fuori", !s.visibili.barra);
  barra.radice.classList.toggle("senza-loghi", !sp.loghiBarra);
  barra.filoCamera.classList.toggle("fuori", !(sp.filoCamera && s.visibili.barra));

  const nuova = vociBarra(s);
  const firma = nuova.map((v) => v.chiave).join("\n");
  if (firma === firmaScaletta) return;
  const primaVolta = firmaScaletta === null;
  firmaScaletta = firma;
  scaletta = nuova;
  if (primaVolta || STATICO) return ripartiDaCapo();

  // I pezzi non ancora in vista si rifanno con il contenuto nuovo; quelli che qualcuno sta leggendo finiscono il passaggio.
  let sinistra = x;
  let tenuti = 0;
  for (const p of pezzi) {
    if (sinistra >= BORDO_VISIBILE) break;
    sinistra += p.largo;
    tenuti++;
  }
  for (const p of pezzi.splice(tenuti)) p.el.remove();
  if (!pezzi.length) x = BORDO_VISIBILE; // barra rimasta vuota (voci tutte spente): le voci nuove entrano da destra
  const ultimo = pezzi[pezzi.length - 1];
  let i = ultimo ? scaletta.findIndex((v) => v.chiave === ultimo.chiave) : -1;
  if (i < 0 && ultimo) i = scaletta.findIndex((v) => v.tipo === ultimo.tipo && v.tipo !== "social");
  prossimo = i >= 0 ? i + 1 : 0;
  riempi();
}

let ultimoFotogramma = performance.now();
function passo(t) {
  const dt = Math.min(0.1, Math.max(0, (t - ultimoFotogramma) / 1000)); // sorgente rimasta nascosta: nessun salto
  ultimoFotogramma = t;
  if (stato && pezzi.length) {
    x -= stato.senzaPremio.velocita * dt;
    while (pezzi.length && x + pezzi[0].largo < 0) {
      const p = pezzi.shift();
      x += p.largo;
      p.el.remove();
    }
    riempi();
    posiziona();
  }
  requestAnimationFrame(passo);
}
if (!STATICO && CON_BARRA) requestAnimationFrame(passo);

// ---------- Scheda «Ora in ascolto» e spot dello studio ----------
const scheda = {
  el: $("#sp-scheda"),
  sopra: $("#sp-scheda-sopra"),
  titolo: $("#sp-scheda-titolo"),
  artista: $("#sp-scheda-artista"),
  tier: $("#sp-scheda-tier"),
  scintille: $("#sp-scintille"),
  aperta: null, // "ascolto" | "studio" | null
  idCorrente: null, // la scheda mostra la traccia in ascolto (si aggiorna se la regia corregge i nomi)
  chiude: false,
  timer: null,
  inAttesa: null, // spot arrivato mentre c'era una traccia
};

function riempiScheda(r) {
  const studio = r.tipo === "studio";
  scheda.el.classList.toggle("studio", studio);
  for (const t of Object.keys(ETICHETTE_TIER)) scheda.el.classList.toggle(`tier-${t}`, !studio && r.traccia.tier === t);
  if (studio) {
    const spot = stato.senzaPremio.spot;
    scheda.sopra.textContent = spot.sopra;
    scheda.titolo.textContent = spot.titolo;
    scriviConLink(scheda.artista, spot.sotto);
    scheda.tier.hidden = true;
  } else {
    const t = r.traccia;
    scheda.sopra.textContent = "Ora in ascolto";
    scheda.titolo.textContent = t.titolo;
    scheda.artista.textContent = t.artista ?? "";
    scheda.tier.hidden = !ETICHETTE_TIER[t.tier];
    scheda.tier.textContent = ETICHETTE_TIER[t.tier] ?? "";
    scheda.tier.className = `tier ${t.tier ?? ""}`;
  }
  adattaScheda(r.tipo);
}

// Corpi della scheda: il gotico non scende sotto 34 px (poi i puntini), il resto in Barlow sì.
function adattaScheda(tipo) {
  if (tipo === "studio") {
    adattaTesto(scheda.titolo, 54, 34); // gotico
    adattaTesto(scheda.artista, 30, 24);
  } else {
    adattaTesto(scheda.titolo, 54, 32);
    adattaTesto(scheda.artista, 36, 34); // gotico
  }
}

const durataScheda = (r) =>
  r.tipo === "studio" ? DURATA_SPOT_MS : (stato.senzaPremio.durate[r.traccia.tier] ?? stato.senzaPremio.durate.standard) * 1000;

function mostraScheda(r, idCorrente = null, { fissa = false } = {}) {
  if (!stato.visibili.scheda) return;
  // Uno spot non interrompe una traccia: aspetta che la scheda scenda.
  if (r.tipo === "studio" && scheda.aperta === "ascolto" && !scheda.chiude) {
    scheda.inAttesa = r;
    return;
  }
  if (r.tipo === "studio") scheda.inAttesa = null; // lo spot sale adesso: niente secondo spot in coda
  const giaSu = scheda.aperta !== null && !scheda.chiude;
  clearTimeout(scheda.timer);
  riempiScheda(r);
  scheda.aperta = r.tipo;
  scheda.idCorrente = idCorrente;
  scheda.chiude = false;
  if (giaSu) {
    // «arriva» e «cambia» usano la stessa animazione: tolta la prima, la seconda riparte davvero
    scheda.el.classList.remove("arriva");
    rilancia(scheda.el, "cambia");
  }
  else {
    scheda.el.classList.remove("cambia");
    scheda.el.classList.add("su");
    rilancia(scheda.el, "arriva");
    if (!STATICO) setTimeout(() => rilancia(barra.filoOro, "lampo-oro"), SALITA_SCHEDA_MS);
  }
  if (r.tipo === "ascolto" && r.traccia.tier === "throne" && !STATICO) puntePerIlTrono();
  if (!fissa) scheda.timer = setTimeout(() => chiudiScheda(), durataScheda(r));
}

function chiudiScheda(subito = false) {
  if (!scheda.aperta) return;
  if (subito) scheda.inAttesa = null;
  if (scheda.chiude) return; // sta già scendendo
  clearTimeout(scheda.timer);
  scheda.el.classList.remove("su");
  scheda.chiude = true;
  scheda.timer = setTimeout(() => {
    scheda.aperta = null;
    scheda.idCorrente = null;
    scheda.chiude = false;
    const dopo = scheda.inAttesa;
    scheda.inAttesa = null;
    if (dopo) mostraScheda(dopo);
  }, USCITA_SCHEDA_MS + 100);
}

// La regia corregge il nome della traccia in ascolto (stesso id): la scheda aperta si aggiorna senza rientrare.
function correggiSchedaAperta(s) {
  if (scheda.aperta !== "ascolto" || scheda.idCorrente !== s.corrente.id) return;
  const t = s.corrente;
  if (scheda.titolo.textContent === t.titolo && scheda.artista.textContent === t.artista) return;
  if (!t.titolo) return chiudiScheda();
  riempiScheda({ tipo: "ascolto", traccia: { titolo: t.titolo, artista: t.artista, tier: t.tier } });
}

// Throne: otto punte d'oro salgono dalla barra mentre la scheda arriva.
function puntePerIlTrono() {
  const punte = [];
  for (let i = 0; i < 8; i++) {
    const p = simbolo("punta");
    p.style.left = `${90 + i * 110 + ((i * 29) % 40)}px`;
    p.style.setProperty("--r", `${18 + ((i * 7) % 14)}px`);
    p.style.setProperty("--ritardo", `${0.3 + (i % 4) * 0.12}s`);
    punte.push(p);
  }
  scheda.scintille.replaceChildren(...punte);
  setTimeout(() => scheda.scintille.replaceChildren(), 2200);
}

// ?scheda=ascolto (traccia in ascolto, o una di prova) oppure ?scheda=studio: scheda ferma, per i mockup.
function schedaPerMockup(s) {
  if (SCHEDA_FISSA === "studio") return mostraScheda({ tipo: "studio" }, null, { fissa: true });
  const t = s.corrente.titolo ? s.corrente : { titolo: "Notti a Vicenza", artista: "Lince", tier: SCHEDA_FISSA === "ascolto" ? "throne" : SCHEDA_FISSA };
  mostraScheda({ tipo: "ascolto", traccia: { titolo: t.titolo, artista: t.artista, tier: t.tier } }, s.corrente.titolo ? s.corrente.id : null, { fissa: true });
}

// Con i font caricati le larghezze cambiano: si riadattano i testi e si rimisura il nastro.
// Non basta «ready»: con i font già nella cache di OBS o LIVE Studio arriva prima dello stato,
// e i pesi usati dai testi (Barlow 900, Grenze Gotisch) si caricano dopo. Si rimisura a ogni caricamento.
function rimisura() {
  adattaBanner();
  if (scheda.aperta) adattaScheda(scheda.aperta);
  for (const p of pezzi) p.largo = p.el.offsetWidth;
  if (STATICO && stato && CON_BARRA) ripartiDaCapo();
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
