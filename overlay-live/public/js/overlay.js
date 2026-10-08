// Overlay: premio in palio, tabellone della traccia in ascolto, classifica, countdown, notifiche, vincitore e spareggio.
// Disegna lo stato che arriva dal server e suona gli effetti; qui non si inserisce nessun dato.
// Parametri URL: ?formato=orizzontale (predefinito verticale 1080×1920), ?w=premio,tabellone,classifica,timer,vincitore
// (widget da includere; con albero il tabellone ad albero), ?anteprima=1 (sfondo scuro per guardarlo in un browser), ?guide=1 (zone coperte dall'app TikTok),
// ?muto=1 (nessun suono da questa pagina), ?statico=1 (senza animazioni né suoni, per i mockup).
import { collega, formatta, durata } from "./connessione.js";
import { suona, volume } from "./suoni.js";
import { suoniTraccia, cambiClassifica, suoniClassifica, suoniTimer, suonaIn, RITARDO_CLASSIFICA_MS, SOGLIA_URGENTE_MS } from "./eventi-sonori.js";
import { adattaTesto } from "./pagina.js";
import { disegnaAlbero } from "./albero.js";

const parametri = new URLSearchParams(location.search);
const ORIZZONTALE = parametri.get("formato") === "orizzontale";
const [LARGHEZZA, ALTEZZA] = ORIZZONTALE ? [1920, 1080] : [1080, 1920];
const WIDGET = (parametri.get("w") ?? "premio,tabellone,classifica,timer,vincitore,albero").split(",");
const MUTO = parametri.has("muto") || parametri.has("statico");
const TIER = { skip: "Skip", superskip: "Super Skip", throne: "Throne" };
const MOSTRA_CLASSIFICA_DOPO_CONFERMA_MS = 15_000;
const DURATA_NOTIFICA_MS = 6000;
const CAMBIO_INVITO_MS = 6000;

const $ = (sel) => document.querySelector(sel);
const palco = $(".palco");

document.body.classList.toggle("orizzontale", ORIZZONTALE);
document.body.classList.toggle("verticale", !ORIZZONTALE);
document.body.classList.toggle("anteprima", parametri.has("anteprima"));
document.body.classList.toggle("statico", parametri.has("statico"));
document.body.classList.toggle("guide-attive", parametri.has("guide"));
for (const el of document.querySelectorAll("[data-widget]")) el.hidden = !WIDGET.includes(el.dataset.widget);

// La sorgente può avere qualsiasi dimensione: il palco si adatta mantenendo le proporzioni.
function adattaPalco() {
  palco.style.setProperty("--scala", Math.min(innerWidth / LARGHEZZA, innerHeight / ALTEZZA));
}
addEventListener("resize", adattaPalco);
adattaPalco();

let stato = null;
let primoDisegno = true;
const conn = collega({
  suStato(s, eventi) {
    const prima = stato;
    stato = s;
    riproduci(suoniTraccia(prima, s, eventi));
    disegnaPremio(s);
    disegnaTabellone(s);
    aggiornaClassifica(s, eventi);
    disegnaTabelloneAdAlbero(s);
    disegnaVincitore(s);
    disegnaSpareggio(s);
    palco.classList.toggle("schermo-pieno", Boolean(s.vincitore?.visibile || s.spareggio));
    primoDisegno = false;
  },
});

// Gli effetti suonano qui solo se la regia ha scelto "overlay" (altrimenti suonano nella regia, o sono spenti)
// e se in onda c'è la gara: con il layout senza premio suona l'altra pagina.
function riproduci(suoni) {
  if (MUTO || !suoni.length || !suonaIn(stato, "gara", "overlay")) return;
  volume(stato.suoni.volume);
  for (const s of suoni) suona(s.nome, s.dati, s.ritardo ?? 0);
}

// ---------- Utilità di animazione ----------
function rilancia(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth; // forza il riavvio dell'animazione CSS
  el.classList.add(classe);
}

const valoriMostrati = new WeakMap();
const animazioni = new WeakMap();

// Aggiorna un numero con un breve conteggio animato e un lampo di luce.
function numero(el, valore, decimali, durataMs = 650) {
  const vecchio = valoriMostrati.has(el) ? valoriMostrati.get(el) : null;
  if (vecchio === valore) return;
  valoriMostrati.set(el, valore);
  cancelAnimationFrame(animazioni.get(el));
  if (valore === null || primoDisegno) return void (el.textContent = formatta(valore, decimali));
  rilancia(el.closest(".cat-valore, .totale-valore") ?? el, "lampo");
  const da = vecchio ?? 0;
  const inizio = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - inizio) / durataMs);
    el.textContent = formatta(da + (valore - da) * (1 - (1 - k) ** 3), decimali);
    if (k < 1) animazioni.set(el, requestAnimationFrame(passo));
  };
  animazioni.set(el, requestAnimationFrame(passo));
}

function nascondiNumero(el) {
  cancelAnimationFrame(animazioni.get(el));
  valoriMostrati.set(el, 0); // alla rivelazione conta da zero
  el.textContent = "?";
}

// Voti dei giudici: "8" e "8,5" (niente ",0" che ruba spazio).
const decimaliVoto = (v) => (v === null || Number.isInteger(v) ? 0 : 1);

// Riduce il corpo del testo finché non entra nella larghezza disponibile (premio, frasi sotto il premio e vincitore).
// Per i testi del tabellone e della classifica, in larghezza e in altezza (anche l'inchiostro delle lettere), c'è adattaTesto di pagina.js.
function adattaLarghezza(el, massimo, minimo) {
  let corpo = massimo;
  el.style.fontSize = `${corpo}px`;
  while (el.scrollWidth > el.clientWidth && corpo > minimo) {
    corpo -= 2;
    el.style.fontSize = `${corpo}px`;
  }
}

// ---------- Premio in palio ----------
const premio = { radice: $(".premio"), testo: $("#premio-testo"), invito: $("#premio-invito") };
let righeInvito = [];
let indiceInvito = 0;
// Un indirizzo nella frase (es. nero.fan/backrooms) resta minuscolo ed evidenziato.
const LINK = /([a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i;

function scriviInvito(testo) {
  premio.invito.replaceChildren(
    ...String(testo)
      .split(LINK)
      .map((pezzo, i) => (i % 2 ? Object.assign(document.createElement("b"), { className: "link", textContent: pezzo }) : pezzo)),
  );
  adattaLarghezza(premio.invito, 27, 19);
}

function disegnaPremio(s) {
  premio.radice.classList.toggle("fuori", !s.visibili.premio);
  const testo = s.premio || "Premio in arrivo";
  if (premio.testo.textContent !== testo) {
    premio.testo.textContent = testo;
    adattaLarghezza(premio.testo, 76, 40);
    if (!primoDisegno) rilancia(premio.testo, "lampo");
  }
  const righe = String(s.invito ?? "")
    .split("|")
    .map((r) => r.trim())
    .filter(Boolean);
  if (righe.join("|") !== righeInvito.join("|")) {
    righeInvito = righe;
    indiceInvito = 0;
    scriviInvito(righe[0] ?? "");
  }
}

// Le frasi sotto il premio si alternano: cosa si vince, come si partecipa.
setInterval(() => {
  if (righeInvito.length < 2) return;
  premio.invito.classList.add("cambia");
  setTimeout(() => {
    indiceInvito = (indiceInvito + 1) % righeInvito.length;
    scriviInvito(righeInvito[indiceInvito]);
    premio.invito.classList.remove("cambia");
  }, 450);
}, CAMBIO_INVITO_MS);

// ---------- Tabellone ----------
const tab = {
  radice: $(".tabellone"),
  titolo: $("#t-titolo"),
  artista: $("#t-artista"),
  tier: $("#t-tier"),
  chatVoti: $("#chat-voti"),
  chatCta: $("#chat-cta"),
  chatTimer: $("#chat-timer"),
  totale: $("#totale"),
  totaleValore: $(".totale-valore"),
  totaleStato: $("#totale-stato"),
  categorie: Object.fromEntries(
    [...document.querySelectorAll(".cat")].map((cat) => [
      cat.dataset.cat,
      { el: cat, nome: cat.querySelector(".cat-nome"), barra: cat.querySelector(".barra"), valore: cat.querySelector(".cat-valore"), giudice: cat.querySelector(".cat-giudice") },
    ]),
  ),
  limitiCta: [...document.querySelectorAll(".cta-testo b")], // «Vota in chat da <b>4</b> a <b>10</b>»
};
let tracciaMostrata = null;
let eraConfermato = false;
let timerTimbro = null;

// Il corpo più grande che entra nella riga (massimo) e il più piccolo accettabile (minimo), in px, per ogni testo che la pagina
// adatta (si scende di 2 px alla volta: massimo e minimo dello stesso tipo, pari o dispari). Un testo che non entra nemmeno al minimo finisce con i puntini. strumenti/mockup-layout.mjs --controlli controlla
// gli stessi numeri (test/geometria.test.mjs li confronta).
const CORPI = {
  titolo: [52, 24], // titolo della traccia in ascolto
  artista: [32, 18], // artista in ascolto
  categoria: [24, 14], // nome della voce (Beat, Voce, Mix, Chat)
  giudice: [22, 12], // nome del giudice (per la chat: «37 voti»)
  rigaTraccia: [30, 18], // titolo di una riga della classifica
  rigaArtista: [21, 13], // artista di una riga della classifica
  etichettaTimer: [22, 12], // «Il vincitore si decide tra»
};
const adatta = (nodo, chiave) => adattaTesto(nodo, ...CORPI[chiave]);
// Scrive un testo e, se è cambiato, lo riadatta al riquadro.
function scrivi(nodo, testo, chiave) {
  if (nodo.textContent === testo) return;
  nodo.textContent = testo;
  adatta(nodo, chiave);
}

function disegnaTabellone(s) {
  const t = s.corrente;
  const p = t.punteggi;
  // Nomi delle quattro voci e intervallo dei voti dalla votazione (regia: Serata → Voti della gara).
  for (const [nome, c] of Object.entries(tab.categorie)) scrivi(c.nome, s.votazione.etichette[nome], "categoria");
  tab.limitiCta[0].textContent = s.votazione.min;
  tab.limitiCta[1].textContent = s.votazione.max;
  const nascosti = s.nascondiVoti && !t.confermato;
  tab.radice.classList.toggle("fuori", !s.visibili.tabellone);
  tab.chatCta.classList.toggle("fuori", !s.visibili.tabellone);

  if (t.id !== tracciaMostrata) {
    tracciaMostrata = t.id;
    eraConfermato = t.confermato;
    if (!primoDisegno) rilancia(tab.radice, "nuova");
  }
  scrivi(tab.titolo, t.titolo || "In attesa della traccia", "titolo");
  scrivi(tab.artista, t.artista, "artista");
  tab.tier.hidden = !TIER[t.tier];
  tab.tier.textContent = TIER[t.tier] ?? "";
  tab.tier.className = `tier ${t.tier ?? ""}`;

  for (const cat of ["beat", "voce", "mix"]) {
    const c = tab.categorie[cat];
    const votato = nascosti && p[cat] !== null;
    c.barra.style.setProperty("--v", nascosti ? 0 : p[cat] ?? 0);
    c.el.classList.toggle("in-attesa", nascosti || p[cat] === null);
    c.el.classList.toggle("votato", votato);
    // il nome del giudice e la spunta «✓» stanno sulla stessa riga: se cambia uno dei due si riadatta
    const nomeGiudice = s.giudici[cat] ?? "";
    if (c.firma !== `${nomeGiudice}|${votato}`) {
      c.firma = `${nomeGiudice}|${votato}`;
      c.giudice.textContent = nomeGiudice;
      adatta(c.giudice, "giudice");
    }
    if (nascosti) nascondiNumero(c.valore);
    else numero(c.valore, p[cat], decimaliVoto(p[cat]));
  }

  const chat = tab.categorie.chat;
  chat.barra.style.setProperty("--v", p.chat ?? 0);
  chat.el.classList.toggle("in-attesa", p.chat === null);
  numero(chat.valore, p.chat, 1);
  tab.radice.classList.toggle("chat-aperta", t.chat.aperta);
  tab.chatCta.classList.toggle("aperta", t.chat.aperta);
  // il numero dei voti e il pallino rosso (acceso a chat aperta) stanno sulla stessa riga: se cambia uno dei due si riadatta
  const votiChat = `${p.chatVoti} ${p.chatVoti === 1 ? "voto" : "voti"}`;
  if (chat.firma !== `${votiChat}|${t.chat.aperta}`) {
    chat.firma = `${votiChat}|${t.chat.aperta}`;
    tab.chatVoti.textContent = votiChat;
    adatta(chat.giudice, "giudice");
  }

  // Totale: alla conferma parte da zero, "vibra" mentre conta e poi timbra il risultato.
  const appenaConfermato = t.confermato && !eraConfermato && !primoDisegno;
  if (nascosti) nascondiNumero(tab.totale);
  else {
    if (appenaConfermato) valoriMostrati.set(tab.totale, 0);
    numero(tab.totale, p.totale, 2, appenaConfermato ? 1500 : 650);
  }
  if (appenaConfermato) {
    tab.totaleValore.classList.add("calcolo");
    clearTimeout(timerTimbro);
    timerTimbro = setTimeout(() => {
      tab.totaleValore.classList.remove("calcolo");
      rilancia(tab.totaleValore, "timbro");
    }, 1500);
  }
  eraConfermato = t.confermato;
  tab.radice.classList.toggle("confermato", t.confermato);
  tab.totaleStato.textContent = !t.confermato
    ? nascosti
      ? "In votazione"
      : "Totale"
    : !t.posizione
      ? "Confermato"
      : t.posizione <= s.topN
        ? `${t.posizione}° in classifica`
        : `${t.posizione}° · fuori top ${s.topN}`;
}

// ---------- Classifica ----------
const pannelloClassifica = $(".classifica");
const lista = $("#cl-lista");
const righeClassifica = new Map(); // id risultato → elementi della riga
let classificaDisegnata = []; // l'ultima mostrata, per capire chi sale, chi entra e chi esce
let classificaInVistaFino = 0; // se la regia la tiene nascosta, dopo una conferma compare per qualche secondo
let rinvioClassifica = null;
let confermeRinviate = [];

function creaSlot(n) {
  if (lista.querySelectorAll(".cl-slot").length === n) return;
  lista.querySelectorAll(".cl-slot").forEach((slot) => slot.remove());
  for (let i = n - 1; i >= 0; i--) {
    const slot = document.createElement("div");
    slot.className = "cl-slot";
    slot.style.setProperty("--i", i);
    slot.innerHTML = `<span class="cl-num">${i + 1}</span><span class="vuoto">posto libero</span>`;
    lista.prepend(slot);
  }
}

function creaRiga(i) {
  const el = document.createElement("div");
  el.className = "cl-riga";
  el.style.setProperty("--i", i); // prima di entrare nel DOM: niente scivolata dall'alto
  el.innerHTML = `<div class="cl-corpo"><div class="cl-testi"><div class="cl-traccia"><svg class="cl-corona"><use href="#corona"/></svg><span class="cl-traccia-testo"></span></div><div class="cl-artista"></div></div><div class="cl-punti"></div><span class="cl-badge"></span></div>`;
  lista.append(el);
  return {
    el,
    corpo: el.firstChild,
    traccia: el.querySelector(".cl-traccia-testo"),
    artista: el.querySelector(".cl-artista"),
    punti: el.querySelector(".cl-punti"),
    badge: el.querySelector(".cl-badge"),
    timerBadge: null,
    firma: "",
  };
}

function mettiBadge(riga, testo, su = false) {
  riga.badge.textContent = testo;
  riga.badge.classList.toggle("su", su);
  riga.el.classList.add("con-badge");
  clearTimeout(riga.timerBadge);
  riga.timerBadge = setTimeout(() => riga.el.classList.remove("con-badge", "sale", "incoronato"), 7000);
}

// Dopo una conferma la classifica aspetta che il totale abbia finito di contare e timbrare.
function aggiornaClassifica(s, eventi) {
  const conferme = eventi.filter((e) => e.nome === "classifica").map((e) => e.dati);
  if (rinvioClassifica || (conferme.length && !primoDisegno)) {
    confermeRinviate.push(...conferme);
    rinvioClassifica ??= setTimeout(() => {
      rinvioClassifica = null;
      const rinviate = confermeRinviate;
      confermeRinviate = [];
      disegnaClassifica(stato, rinviate);
    }, RITARDO_CLASSIFICA_MS);
    return;
  }
  disegnaClassifica(s, conferme);
}

function disegnaClassifica(s, conferme) {
  $("#cl-n").textContent = s.topN;
  lista.style.setProperty("--n", s.topN);
  creaSlot(s.topN);

  const cambi = cambiClassifica(classificaDisegnata, s.classifica);
  const effetti = conferme.length > 0 && !primoDisegno;
  classificaDisegnata = s.classifica;
  if (effetti) {
    if (!s.visibili.classifica) classificaInVistaFino = performance.now() + MOSTRA_CLASSIFICA_DOPO_CONFERMA_MS;
    riproduci(suoniClassifica(cambi));
    notificaCambi(cambi, s);
  }

  const presenti = new Set();
  s.classifica.forEach((r, i) => {
    presenti.add(r.id);
    let riga = righeClassifica.get(r.id);
    if (!riga) {
      riga = creaRiga(i);
      righeClassifica.set(r.id, riga);
      if (!primoDisegno) riga.corpo.classList.add("entra");
    }
    riga.el.style.setProperty("--i", i);
    for (const n of [1, 2, 3]) riga.el.classList.toggle(`pos-${n}`, i === n - 1);
    // I punti e la corona del primo posto tolgono larghezza ai testi: si scrivono per primi, e se cambiano il numero di cifre o
    // il posto (prima o no) i testi si riadattano.
    const punti = formatta(r.totale, 2);
    if (riga.punti.textContent && riga.punti.textContent !== punti) rilancia(riga.corpo, "aggiornata");
    riga.punti.textContent = punti;
    const firma = `${r.titolo}|${r.artista}|${i === 0}|${punti.length}`;
    if (riga.firma !== firma) {
      riga.firma = firma;
      riga.traccia.textContent = r.titolo;
      riga.artista.textContent = r.artista;
      adatta(riga.traccia, "rigaTraccia");
      adatta(riga.artista, "rigaArtista");
    }

    if (!effetti) return;
    const salita = cambi.salite.find((x) => x.id === r.id);
    if (cambi.entrate.some((x) => x.id === r.id)) mettiBadge(riga, "NEW");
    else if (salita) {
      rilancia(riga.el, "sale");
      mettiBadge(riga, `▲${salita.posti}`, true);
    }
    if (cambi.nuovoPrimo === r.id) rilancia(riga.el, "incoronato");
  });

  for (const [id, riga] of righeClassifica) {
    if (presenti.has(id)) continue;
    righeClassifica.delete(id);
    riga.el.style.setProperty("--i", s.topN); // scivola sotto l'ultimo posto
    riga.corpo.classList.remove("entra");
    riga.corpo.classList.add("esce");
    setTimeout(() => riga.el.remove(), 1000);
  }
}

// ---------- Tabellone ad albero ----------
// Si disegna quando si accende (con i turni che entrano uno dopo l'altro) e si ridisegna da solo, senza animazioni, quando la
// classifica cambia; da spento tiene l'ultimo disegno.
const albero = { radice: $("#albero"), firma: null, acceso: false };

function disegnaTabelloneAdAlbero(s) {
  const acceso = Boolean(s.visibili.albero);
  const firma = JSON.stringify(s.albero.disegno);
  if (acceso && (!albero.acceso || firma !== albero.firma)) {
    disegnaAlbero(albero.radice, s.albero.disegno, { animato: !albero.acceso && !parametri.has("statico") });
    albero.firma = firma;
  }
  albero.acceso = acceso;
  albero.radice.classList.toggle("fuori", !acceso);
}

// ---------- Notifiche ----------
const notifica = { el: $("#notifica"), titolo: $("#notifica-titolo"), sotto: $("#notifica-sotto"), timer: null };

function notificaCambi(cambi, s) {
  const titoloDi = (id) => s.classifica.find((r) => r.id === id)?.titolo ?? "";
  if (cambi.nuovoPrimo) return mostraNotifica("oro", "Nuovo primo posto!", titoloDi(cambi.nuovoPrimo));
  const entrata = cambi.entrate[0];
  if (entrata) return mostraNotifica("", `Nuova entrata · ${entrata.posizione}° posto`, titoloDi(entrata.id));
  const salita = [...cambi.salite].sort((a, b) => b.posti - a.posti)[0];
  if (salita) mostraNotifica("sale", `▲ Sale al ${salita.posizione}° posto`, titoloDi(salita.id));
}

function mostraNotifica(tipo, titolo, sotto) {
  notifica.el.className = `notifica ${tipo}`;
  notifica.titolo.textContent = titolo;
  notifica.sotto.textContent = sotto;
  void notifica.el.offsetWidth;
  notifica.el.classList.add("visibile");
  clearTimeout(notifica.timer);
  notifica.timer = setTimeout(() => notifica.el.classList.remove("visibile"), DURATA_NOTIFICA_MS);
}

// ---------- A ogni frame: countdown, tempo del voto chat, comparsa temporanea della classifica ----------
const timer = { radice: $(".timer"), cifre: $("#timer-cifre"), etichetta: $(".timer-etichetta") };
adatta(timer.etichetta, "etichettaTimer");
let msPrecedente = null;

function cicloTempo(adesso) {
  if (stato) {
    const c = stato.countdown;
    const ms = c.fineAlle !== null ? c.fineAlle - conn.ora() : c.rimanenteMs;
    const schermoPieno = stato.vincitore?.visibile || stato.spareggio;
    timer.radice.classList.toggle("spento", ms === null || Boolean(schermoPieno));
    timer.radice.classList.toggle("fuori", !stato.visibili.timer);
    if (ms !== null) {
      const testo = durata(ms);
      if (timer.cifre.textContent !== testo) timer.cifre.textContent = testo;
      timer.radice.classList.toggle("in-pausa", c.rimanenteMs !== null);
      timer.radice.classList.toggle("urgente", ms <= SOGLIA_URGENTE_MS);
      timer.radice.classList.toggle("finale", c.fineAlle !== null && ms <= 60_000);
    }
    if (c.fineAlle !== null) {
      riproduci(suoniTimer(msPrecedente, ms));
      msPrecedente = ms;
    } else msPrecedente = null;

    const chat = stato.corrente.chat;
    const testoChat = chat.aperta && chat.chiudeAlle ? durata(chat.chiudeAlle - conn.ora()) : "";
    if (tab.chatTimer.textContent !== testoChat) tab.chatTimer.textContent = testoChat;

    const classificaFuori = !stato.visibili.classifica && adesso > classificaInVistaFino;
    pannelloClassifica.classList.toggle("fuori", classificaFuori);
    notifica.el.classList.toggle("fuori", classificaFuori);
  }
  requestAnimationFrame(cicloTempo);
}
requestAnimationFrame(cicloTempo);

// ---------- Vincitore ----------
const vin = { radice: $("#vincitore"), tela: $("#vin-scintille") };
vin.tela.width = LARGHEZZA;
vin.tela.height = ALTEZZA;
let vincitoreMostrato = null;
let fermaScintille = null;

function disegnaVincitore(s) {
  const v = s.vincitore?.visibile ? s.vincitore : null;
  const chiave = v ? `${v.id}@${v.proclamatoAlle}` : null;
  if (chiave === vincitoreMostrato) return;
  vincitoreMostrato = chiave;
  fermaScintille?.();
  fermaScintille = null;
  if (!v) return vin.radice.classList.remove("attivo");

  $("#vin-titolo").textContent = v.titolo;
  $("#vin-artista").textContent = v.artista;
  $("#vin-punti").textContent = formatta(v.totale, 2);
  $("#vin-premio").textContent = v.premio;
  rilancia(vin.radice, "attivo");
  requestAnimationFrame(() => adattaLarghezza($("#vin-titolo"), 104, 52));
  // Le scintille esplodono sul colpo del rullo di tamburi.
  const avvio = setTimeout(() => (fermaScintille = scintille(vin.tela)), parametri.has("statico") ? 0 : 2000);
  fermaScintille = () => clearTimeout(avvio);
}

// ---------- Spareggio ----------
const spa = { radice: $("#spareggio"), lista: $("#spa-lista") };
let spareggioMostrato = null;

function disegnaSpareggio(s) {
  const chiave = s.spareggio ? String(s.spareggio.dal) : null;
  if (chiave === spareggioMostrato) return;
  spareggioMostrato = chiave;
  if (!s.spareggio) return spa.radice.classList.remove("attivo");

  spa.lista.replaceChildren(
    ...s.spareggio.candidati.map((r, i) => {
      const voce = document.createElement("div");
      voce.className = "spa-voce pezzo";
      voce.style.setProperty("--d", `${0.8 + i * 0.25}s`);
      voce.innerHTML = `<div><div class="t"></div><div class="a"></div></div><div class="p"></div>`;
      voce.querySelector(".t").textContent = r.titolo;
      voce.querySelector(".a").textContent = r.artista;
      voce.querySelector(".p").textContent = formatta(r.totale, 2);
      return voce;
    }),
  );
  rilancia(spa.radice, "attivo");
}

// Stelle a quattro punte (come le punte del logo), dorate e bianche: un'esplosione iniziale, poi un brillio continuo.
function scintille(tela) {
  const ctx = tela.getContext("2d");
  const particelle = [];
  let attivo = true;
  let ultimo = performance.now();
  const [cx, cy] = [LARGHEZZA / 2, ALTEZZA * 0.45];
  const COLORI = ["255, 236, 170", "255, 210, 90", "255, 255, 255", "189, 189, 189"];

  const nuova = (esplosione) => {
    const angolo = Math.random() * Math.PI * 2;
    const forza = esplosione ? 4 + Math.random() * 13 : 0.3 + Math.random() * 0.8;
    particelle.push({
      x: esplosione ? cx : Math.random() * LARGHEZZA,
      y: esplosione ? cy : ALTEZZA + 20,
      vx: Math.cos(angolo) * forza,
      vy: esplosione ? Math.sin(angolo) * forza : -(1 + Math.random() * 2),
      r: 3 + Math.random() * (esplosione ? 15 : 8),
      gravita: esplosione ? 0.04 : 0,
      attrito: esplosione ? 0.985 : 1,
      vita: 1,
      calo: esplosione ? 0.006 + Math.random() * 0.01 : 0.002 + Math.random() * 0.003,
      fase: Math.random() * Math.PI * 2,
      colore: COLORI[Math.floor(Math.random() * COLORI.length)],
    });
  };
  for (let i = 0; i < 180; i++) nuova(true);

  const stella = (x, y, r) => {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  };

  const frame = (t) => {
    if (!attivo) return ctx.clearRect(0, 0, tela.width, tela.height);
    const dt = Math.min(3, (t - ultimo) / 16.7);
    ultimo = t;
    if (particelle.length < 150 && Math.random() < 0.5 * dt) nuova(false);
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.globalCompositeOperation = "lighter";
    for (let i = particelle.length - 1; i >= 0; i--) {
      const p = particelle[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.attrito;
      p.vy = p.vy * p.attrito + p.gravita * dt;
      p.vita -= p.calo * dt;
      if (p.vita <= 0 || p.y < -40) {
        particelle.splice(i, 1);
        continue;
      }
      const brillio = 0.55 + 0.45 * Math.sin(t / 140 + p.fase);
      ctx.fillStyle = `rgba(${p.colore}, ${p.vita * brillio})`;
      stella(p.x, p.y, p.r * (0.6 + 0.4 * brillio));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => {
    attivo = false;
  };
}

// Con i font caricati le larghezze cambiano: si riadattano i testi lunghi. A ogni caricamento, non solo al primo
// «ready»: con i font nella cache di OBS o LIVE Studio i pesi usati dai testi arrivano dopo lo stato.
function rimisura() {
  if (albero.acceso && stato) {
    disegnaAlbero(albero.radice, stato.albero.disegno);
    albero.firma = JSON.stringify(stato.albero.disegno);
  }
  adatta(tab.titolo, "titolo");
  adatta(tab.artista, "artista");
  for (const c of Object.values(tab.categorie)) {
    adatta(c.nome, "categoria");
    adatta(c.giudice, "giudice");
  }
  adatta(timer.etichetta, "etichettaTimer");
  if (premio.testo.textContent) adattaLarghezza(premio.testo, 76, 40);
  adattaLarghezza(premio.invito, 27, 19);
  for (const riga of righeClassifica.values()) {
    adatta(riga.traccia, "rigaTraccia");
    adatta(riga.artista, "rigaArtista");
  }
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
