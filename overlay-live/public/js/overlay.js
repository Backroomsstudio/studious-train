// Overlay: tabellone della traccia in ascolto, classifica, countdown, vincitore e spareggio.
// Disegna lo stato che arriva dal server; qui non si inserisce nessun dato.
// Parametri URL: ?formato=orizzontale (predefinito verticale 1080×1920), ?w=tabellone,classifica,timer,vincitore
// (widget da includere), ?anteprima=1 (sfondo scuro per guardarlo in un browser), ?statico=1 (senza animazioni, per i mockup).
import { collega, formatta, durata } from "./connessione.js";

const parametri = new URLSearchParams(location.search);
const ORIZZONTALE = parametri.get("formato") === "orizzontale";
const [LARGHEZZA, ALTEZZA] = ORIZZONTALE ? [1920, 1080] : [1080, 1920];
const WIDGET = (parametri.get("w") ?? "tabellone,classifica,timer,vincitore").split(",");
const TIER = { skip: "Skip", superskip: "Super Skip", throne: "Throne" };
const MOSTRA_CLASSIFICA_DOPO_CONFERMA_MS = 15_000;

const $ = (sel) => document.querySelector(sel);
const palco = $(".palco");

document.body.classList.toggle("orizzontale", ORIZZONTALE);
document.body.classList.toggle("verticale", !ORIZZONTALE);
document.body.classList.toggle("anteprima", parametri.has("anteprima"));
document.body.classList.toggle("statico", parametri.has("statico"));
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
    stato = s;
    disegnaTabellone(s);
    disegnaClassifica(s, eventi);
    disegnaVincitore(s);
    disegnaSpareggio(s);
    palco.classList.toggle("schermo-pieno", Boolean(s.vincitore?.visibile || s.spareggio));
    primoDisegno = false;
  },
});

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

// Riduce il corpo del testo finché non entra nella larghezza disponibile.
function adattaTesto(el, massimo, minimo) {
  let corpo = massimo;
  el.style.fontSize = `${corpo}px`;
  while (el.scrollWidth > el.clientWidth && corpo > minimo) {
    corpo -= 2;
    el.style.fontSize = `${corpo}px`;
  }
}

// ---------- Tabellone ----------
const tab = {
  radice: $(".tabellone"),
  titolo: $("#t-titolo"),
  artista: $("#t-artista"),
  tier: $("#t-tier"),
  chatVoti: $("#chat-voti"),
  chatTimer: $("#chat-timer"),
  totale: $("#totale"),
  totaleStato: $("#totale-stato"),
  totalePosizione: $("#totale-posizione"),
  categorie: Object.fromEntries(
    [...document.querySelectorAll(".cat")].map((cat) => [
      cat.dataset.cat,
      { el: cat, barra: cat.querySelector(".barra"), valore: cat.querySelector(".cat-valore"), giudice: cat.querySelector(".cat-giudice") },
    ]),
  ),
};
let tracciaMostrata = null;
let eraConfermato = false;

function disegnaTabellone(s) {
  const t = s.corrente;
  const p = t.punteggi;
  const nascosti = s.nascondiVoti && !t.confermato;
  tab.radice.classList.toggle("fuori", !s.visibili.tabellone);

  if (t.id !== tracciaMostrata) {
    tracciaMostrata = t.id;
    eraConfermato = t.confermato;
    if (!primoDisegno) rilancia(tab.radice, "nuova");
  }
  const titolo = t.titolo || "In attesa della traccia";
  if (tab.titolo.textContent !== titolo) {
    tab.titolo.textContent = titolo;
    adattaTesto(tab.titolo, 48, 28);
  }
  tab.artista.textContent = t.artista;
  tab.tier.hidden = !TIER[t.tier];
  tab.tier.textContent = TIER[t.tier] ?? "";
  tab.tier.className = `tier ${t.tier ?? ""}`;

  for (const cat of ["beat", "voce", "mix"]) {
    const c = tab.categorie[cat];
    c.giudice.textContent = s.giudici[cat] ?? "";
    c.barra.style.setProperty("--v", nascosti ? 0 : p[cat] ?? 0);
    c.el.classList.toggle("in-attesa", nascosti || p[cat] === null);
    c.el.classList.toggle("votato", nascosti && p[cat] !== null);
    if (nascosti) nascondiNumero(c.valore);
    else numero(c.valore, p[cat], 1);
  }

  const chat = tab.categorie.chat;
  chat.barra.style.setProperty("--v", p.chat ?? 0);
  chat.el.classList.toggle("in-attesa", p.chat === null);
  numero(chat.valore, p.chat, 1);
  tab.chatVoti.textContent = `${p.chatVoti} ${p.chatVoti === 1 ? "voto" : "voti"}`;
  tab.radice.classList.toggle("chat-aperta", t.chat.aperta);

  // Totale: alla conferma parte da zero e "timbra" il risultato.
  const appenaConfermato = t.confermato && !eraConfermato && !primoDisegno;
  if (nascosti) nascondiNumero(tab.totale);
  else {
    if (appenaConfermato) valoriMostrati.set(tab.totale, 0);
    numero(tab.totale, p.totale, 2, appenaConfermato ? 1600 : 650);
  }
  if (appenaConfermato) setTimeout(() => rilancia($(".totale-valore"), "timbro"), 1500);
  eraConfermato = t.confermato;
  tab.radice.classList.toggle("confermato", t.confermato);
  tab.totaleStato.textContent = t.confermato ? "confermato" : nascosti ? "in votazione" : "provvisorio";
  tab.totalePosizione.textContent = !t.posizione
    ? ""
    : t.posizione <= s.topN
      ? `${t.posizione}° posto in classifica`
      : `${t.posizione}° posto · fuori dalla top ${s.topN}`;
}

// ---------- Classifica ----------
const pannelloClassifica = $(".classifica");
const lista = $("#cl-lista");
const avvisoClassifica = $("#cl-avviso");
const righeClassifica = new Map(); // id risultato → elementi della riga
let timerAvviso = null;
let classificaInVistaFino = 0; // se la regia la tiene nascosta, dopo una conferma compare per qualche secondo

function creaSlot(n) {
  if (lista.querySelectorAll(".cl-slot").length === n) return;
  lista.querySelectorAll(".cl-slot").forEach((slot) => slot.remove());
  for (let i = n - 1; i >= 0; i--) {
    const slot = document.createElement("div");
    slot.className = "cl-slot";
    slot.style.setProperty("--i", i);
    slot.innerHTML = `<span class="cl-num cromo">${i + 1}</span><span class="vuoto">posto libero</span>`;
    lista.prepend(slot);
  }
}

function creaRiga(i) {
  const el = document.createElement("div");
  el.className = "cl-riga";
  el.style.setProperty("--i", i); // prima di entrare nel DOM: niente scivolata dall'alto
  el.innerHTML = `<div class="cl-corpo"><div class="cl-testi"><div class="cl-traccia"></div><div class="cl-artista"></div></div><div class="cl-punti cromo"></div><span class="cl-nuovo">NEW</span></div>`;
  lista.append(el);
  return {
    el,
    corpo: el.firstChild,
    traccia: el.querySelector(".cl-traccia"),
    artista: el.querySelector(".cl-artista"),
    punti: el.querySelector(".cl-punti"),
  };
}

function disegnaClassifica(s, eventi) {
  $("#cl-n").textContent = s.topN;
  lista.style.setProperty("--n", s.topN);
  creaSlot(s.topN);

  const conferme = eventi.filter((e) => e.nome === "classifica").map((e) => e.dati);
  if (conferme.length && !s.visibili.classifica) classificaInVistaFino = performance.now() + MOSTRA_CLASSIFICA_DOPO_CONFERMA_MS;
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
    riga.el.classList.toggle("primo", i === 0);
    riga.traccia.textContent = r.titolo;
    riga.artista.textContent = r.artista;
    const punti = formatta(r.totale, 2);
    if (riga.punti.textContent && riga.punti.textContent !== punti) rilancia(riga.corpo, "aggiornata");
    riga.punti.textContent = punti;

    if (conferme.some((c) => c.entrata && c.risultato.id === r.id)) {
      riga.el.classList.add("nuova");
      setTimeout(() => riga.el.classList.remove("nuova"), 8000);
    }
  });

  for (const [id, riga] of righeClassifica) {
    if (presenti.has(id)) continue;
    righeClassifica.delete(id);
    riga.el.style.setProperty("--i", s.topN); // scivola sotto l'ultimo posto
    riga.corpo.classList.remove("entra");
    riga.corpo.classList.add("esce");
    setTimeout(() => riga.el.remove(), 1000);
  }

  const entrata = conferme.find((c) => c.entrata);
  if (entrata) mostraAvviso(`Nuova entrata · ${entrata.posizione}° posto`);
}

function mostraAvviso(testo) {
  avvisoClassifica.textContent = testo;
  avvisoClassifica.classList.add("visibile");
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => avvisoClassifica.classList.remove("visibile"), 5000);
}

// ---------- A ogni frame: countdown, tempo del voto chat, comparsa temporanea della classifica ----------
const timer = { radice: $(".timer"), cifre: $("#timer-cifre"), premio: $("#timer-premio") };

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
      timer.radice.classList.toggle("ultimo-minuto", c.fineAlle !== null && ms <= 60_000);
    }
    if (timer.premio.textContent !== stato.premio) timer.premio.textContent = stato.premio;

    const chat = stato.corrente.chat;
    const testoChat = chat.aperta && chat.chiudeAlle ? durata(chat.chiudeAlle - conn.ora()) : chat.aperta ? "aperto" : "";
    if (tab.chatTimer.textContent !== testoChat) tab.chatTimer.textContent = testoChat;

    pannelloClassifica.classList.toggle("fuori", !stato.visibili.classifica && adesso > classificaInVistaFino);
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
  requestAnimationFrame(() => adattaTesto($("#vin-titolo"), 112, 56));
  fermaScintille = scintille(vin.tela);
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
      voce.className = "spa-voce bordo-cromo pezzo";
      voce.style.setProperty("--d", `${0.8 + i * 0.25}s`);
      voce.innerHTML = `<div><div class="t"></div><div class="a"></div></div><div class="p cromo"></div>`;
      voce.querySelector(".t").textContent = r.titolo;
      voce.querySelector(".a").textContent = r.artista;
      voce.querySelector(".p").textContent = formatta(r.totale, 2);
      return voce;
    }),
  );
  rilancia(spa.radice, "attivo");
}

// Stelle a quattro punte (come le punte del logo): un'esplosione iniziale, poi un brillio continuo.
function scintille(tela) {
  const ctx = tela.getContext("2d");
  const particelle = [];
  let attivo = true;
  let ultimo = performance.now();
  const [cx, cy] = [LARGHEZZA / 2, ALTEZZA * 0.42];

  const nuova = (esplosione) => {
    const angolo = Math.random() * Math.PI * 2;
    const forza = esplosione ? 4 + Math.random() * 12 : 0.3 + Math.random() * 0.8;
    particelle.push({
      x: esplosione ? cx : Math.random() * LARGHEZZA,
      y: esplosione ? cy : ALTEZZA + 20,
      vx: Math.cos(angolo) * forza,
      vy: esplosione ? Math.sin(angolo) * forza : -(1 + Math.random() * 2),
      r: 3 + Math.random() * (esplosione ? 14 : 8),
      gravita: esplosione ? 0.04 : 0,
      attrito: esplosione ? 0.985 : 1,
      vita: 1,
      calo: esplosione ? 0.006 + Math.random() * 0.01 : 0.002 + Math.random() * 0.003,
      fase: Math.random() * Math.PI * 2,
    });
  };
  for (let i = 0; i < 160; i++) nuova(true);

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
    if (particelle.length < 140 && Math.random() < 0.5 * dt) nuova(false);
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
      ctx.fillStyle = `rgba(235, 240, 255, ${p.vita * brillio})`;
      stella(p.x, p.y, p.r * (0.6 + 0.4 * brillio));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => {
    attivo = false;
  };
}

document.fonts?.ready.then(() => adattaTesto(tab.titolo, 48, 28));
