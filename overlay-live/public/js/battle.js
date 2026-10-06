// Layout «Battle»: scontro tra due rapper. Barre della vita dal voto della chat, camera al centro con la cornice,
// modalità e timer sopra, box degli artisti, giudici e barra del voto chat sotto.
// Disegna lo stato che arriva dal server; qui non si inserisce nessun dato.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni e di TikTok),
// ?statico=1 (senza animazioni né suoni, per i mockup), ?w=barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone
// (parti da includere).
import { collega, durata } from "./connessione.js";
import { percentuali, rimanenteBattleMs, timerUrgente } from "./battle-logica.js";

const LARGHEZZA = 1080;
const ALTEZZA = 1920;
const parametri = new URLSearchParams(location.search);
const STATICO = parametri.has("statico");
const TUTTE_LE_PARTI = "barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone";
const PARTI = (parametri.get("w") ?? TUTTE_LE_PARTI).split(",");
// Quale interruttore «In onda» della regia accende ogni parte (camera e box degli artisti sono sempre in onda).
const WIDGET = { barre: "barreVita", modalita: "modalita", timer: "timerBattle", giudici: "giudiciBattle", chat: "giudiciBattle", popup: "popupBattle", tabellone: "bracket" };

const $ = (sel) => document.querySelector(sel);
const palco = $(".palco");

document.body.classList.toggle("anteprima", parametri.has("anteprima"));
document.body.classList.toggle("statico", STATICO);
document.body.classList.toggle("guide-attive", parametri.has("guide"));

// La sorgente può avere qualsiasi dimensione: il palco si adatta mantenendo le proporzioni.
function adattaPalco() {
  palco.style.setProperty("--scala", Math.min(innerWidth / LARGHEZZA, innerHeight / ALTEZZA));
}
addEventListener("resize", adattaPalco);
adattaPalco();

// ---------- Utilità ----------
function nodo(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
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

// 8 → «8», 7.5 → «7,5»: il voto senza decimali inutili.
const voto = (v) => String(v).replace(".", ",");

// ---------- Stato ----------
let stato = null;

const conn = collega({
  suStato(s) {
    stato = s;
    disegna(s);
  },
});

function disegna(s) {
  const b = s.battle;
  for (const el of document.querySelectorAll("[data-parte]")) {
    const widget = WIDGET[el.dataset.parte];
    el.hidden = !PARTI.includes(el.dataset.parte) || (widget !== undefined && s.visibili[widget] === false);
  }
  disegnaBarre(b);
  disegnaModalita(b);
  disegnaArtisti(b);
  disegnaGiudici(b);
  disegnaChat(b);
  aggiornaTimer();
}

// ---------- Barre della vita ----------
function disegnaBarre(b) {
  const nomi = { sx: b.sx.nome || "—", dx: b.dx.nome || "—" };
  const perc = percentuali(b.quota);
  for (const lato of ["sx", "dx"]) {
    const nome = $(`#bt-nome-${lato}`);
    nome.textContent = nomi[lato];
    adattaTesto(nome, 36, 20);
    $(`#bt-perc-${lato}`).textContent = `${perc[lato]}%`;
    const barra = $(`.bt-barra.${lato}`);
    barra.style.setProperty("--q", b.quota[lato]);
    barra.classList.toggle("in-testa", b.quota.voti > 0 && b.quota[lato] > b.quota[lato === "sx" ? "dx" : "sx"]);
  }
}

// ---------- Modalità ----------
function disegnaModalita(b) {
  const m = b.modalita.elenco.find((v) => v.id === b.modalita.scelta);
  const nome = $("#bt-modo-nome");
  const testo = $("#bt-modo-testo");
  nome.textContent = m?.nome ?? "";
  adattaTesto(nome, 48, 28);
  const conTesto = Boolean(m?.conTesto && m.testo);
  testo.hidden = !conTesto;
  testo.textContent = conTesto ? `«${m.testo}»` : "";
  if (conTesto) adattaTesto(testo, 38, 22);
}

// ---------- Timer ----------
function aggiornaTimer() {
  if (!stato) return;
  const b = stato.battle;
  const ms = rimanenteBattleMs(b, conn.ora());
  $("#bt-timer-etichetta").textContent = `Round ${b.round}`;
  $("#bt-timer-cifre").textContent = durata(ms);
  $("#bt-timer").classList.toggle("urgente", b.fase === "battle" && b.timer.fineAlle !== null && timerUrgente(ms));
}
if (!STATICO) setInterval(aggiornaTimer, 200);

// ---------- Box degli artisti ----------
function disegnaArtisti(b) {
  for (const lato of ["sx", "dx"]) {
    const r = b[lato];
    const nome = $(`#bt-art-nome-${lato}`);
    nome.textContent = r.nome || "—";
    adattaTesto(nome, 42, 24);
    const ig = $(`#bt-art-ig-${lato}`);
    ig.hidden = !r.instagram;
    ig.querySelector("span").textContent = r.instagram ? `@${r.instagram}` : "";
  }
}

// ---------- Giudici ----------
function disegnaGiudici(b) {
  const rivelato = b.fase === "risultato" && b.risultato;
  for (const g of b.giudici) {
    const box = $(`[data-giudice="${g.id}"]`);
    box.querySelector(".bt-giudice-nome").textContent = g.nome;
    for (const lato of ["sx", "dx"]) {
      const cella = box.querySelector(`b.${lato}`);
      cella.textContent = rivelato ? voto(b.risultato.parziali[g.id][lato]) : "?";
      cella.classList.toggle("vuoto", !rivelato);
    }
  }
}

// ---------- Barra del voto chat ----------
function disegnaChat(b) {
  const testo = $("#bt-chat-testo");
  const chiuso = !b.chat.aperta && (b.fase === "voto" || b.fase === "risultato");
  const nome = (r) => r.nome || "…";
  if (chiuso) testo.replaceChildren("Voto chiuso");
  else testo.replaceChildren("Vota in chat: 1 = ", nodo("b", "", nome(b.sx)), " · 2 = ", nodo("b", "", nome(b.dx)));
  const conta = $("#bt-chat-conta");
  conta.hidden = b.chat.voti === 0 && b.fase === "attesa";
  conta.textContent = `${b.chat.voti} ${b.chat.voti === 1 ? "voto" : "voti"}`;
}

// Con i font caricati le larghezze cambiano: si riadattano i testi.
function rimisura() {
  if (stato) disegna(stato);
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
