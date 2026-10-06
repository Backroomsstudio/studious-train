// Layout «Battle»: scontro tra due rapper. Barre della vita dal voto della chat, camera al centro con la cornice,
// spacco a fulmine e VS, modalità e timer sopra, box degli artisti, giudici e barra del voto chat sotto,
// 3-2-1 a tutto schermo, pop-up social. Disegna lo stato che arriva dal server; qui non si inserisce nessun dato.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni e di TikTok),
// ?statico=1 (senza animazioni né suoni, per i mockup), ?muto=1 (nessun suono da questa pagina),
// ?conto=N (3-2-1 fermo sul numero N), ?popup=1 (primo pop-up fermo, per i mockup),
// ?w=barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone,conto (parti da includere).
import { collega, durata } from "./connessione.js";
import { suona, volume } from "./suoni.js";
import { suoniBattle, suonaIn } from "./eventi-sonori.js";
import { prossimaComparsa } from "./studio-logica.js";
import { disegnaTabellone } from "./battle-tabellone.js";
import {
  percentuali,
  rimanenteBattleMs,
  timerUrgente,
  numeroConto,
  RIVELAZIONE,
  sequenzaRivelazione,
  popupConsentito,
  richiestePopup,
  popupAutomaticoDovuto,
} from "./battle-logica.js";

const LARGHEZZA = 1080;
const ALTEZZA = 1920;
const parametri = new URLSearchParams(location.search);
const STATICO = parametri.has("statico");
const MUTO = parametri.has("muto") || STATICO;
const CONTO_FISSO = Number(parametri.get("conto")) || 0; // solo per i mockup
const POPUP_FISSO = parametri.has("popup"); // solo per i mockup
const TUTTE_LE_PARTI = "barre,modalita,timer,camera,artisti,giudici,chat,popup,tabellone,conto";
const PARTI = (parametri.get("w") ?? TUTTE_LE_PARTI).split(",");
// Quale interruttore «In onda» della regia accende ogni parte (camera e box degli artisti sono sempre in onda).
const WIDGET = { barre: "barreVita", modalita: "modalita", timer: "timerBattle", giudici: "giudiciBattle", chat: "giudiciBattle", popup: "popupBattle", tabellone: "bracket" };
const SVG = "http://www.w3.org/2000/svg";
const LATI = ["sx", "dx"];

const $ = (sel) => document.querySelector(sel);
const palco = $(".palco");
const camera = $(".bt-camera");

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

function simbolo(id) {
  const svg = document.createElementNS(SVG, "svg");
  const use = document.createElementNS(SVG, "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

function rilancia(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth; // forza il riavvio dell'animazione CSS
  el.classList.add(classe);
}

// Scrive solo se il testo cambia (la pagina aggiorna spesso: niente ridisegni inutili).
function scrivi(el, testo) {
  if (el.textContent !== testo) el.textContent = testo;
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

// 8 → «8», 7.5 → «7,5»: il voto senza decimali inutili. Durante il conteggio si mostrano sempre i decimali.
const voto = (v) => String(v).replace(".", ",");
const conta = (v, decimali) => v.toFixed(decimali).replace(".", ",");
const uscitaLenta = (t) => 1 - (1 - t) ** 3;

// Un indirizzo (es. backroomsstudio.it) o un account (@backrooms.studios) nella frase resta evidenziato in oro.
const LINK = /(@[a-z0-9_.]+|[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i;
function scriviConLink(el, testo) {
  el.replaceChildren(...String(testo).split(LINK).map((pezzo, i) => (i % 2 ? nodo("b", "", pezzo) : pezzo)));
}

// ---------- Stato ----------
let stato = null;
let primoDisegno = true;

const conn = collega({
  suStato(s, eventi) {
    const prima = stato;
    stato = s;
    suoni(prima, s, eventi);
    disegna(s);
    effetti(prima, s, eventi);
    popupDaEventi(prima, s, eventi);
    if (primoDisegno && POPUP_FISSO) mostraPopup(null, { fisso: true, scelto: s.battle.popup.elenco[0] });
    primoDisegno = false;
  },
});

// Gli effetti suonano qui solo se la regia ha scelto «overlay» e in onda c'è il battle.
function suoni(prima, s, eventi) {
  if (MUTO || !prima || !suonaIn(s, "battle", "overlay")) return;
  const lista = suoniBattle(prima, s, eventi);
  if (!lista.length) return;
  volume(s.suoni.volume);
  for (const x of lista) suona(x.nome, x.dati, x.ritardo ?? 0);
}

function disegna(s) {
  const b = s.battle;
  for (const el of document.querySelectorAll("[data-parte]")) {
    const widget = WIDGET[el.dataset.parte];
    el.hidden = !PARTI.includes(el.dataset.parte) || (widget !== undefined && s.visibili[widget] === false);
  }
  disegnaBarre(b);
  disegnaModalita(b);
  disegnaArtisti(b);
  disegnaCamera(b);
  disegnaChat(b);
  const tabellone = $("#bt-tabellone");
  if (!tabellone.hidden) disegnaTabellone(tabellone, b);
  tick();
}

// ---------- Barre della vita ----------
function disegnaBarre(b) {
  const nomi = { sx: b.sx.nome || "—", dx: b.dx.nome || "—" };
  const perc = percentuali(b.quota);
  for (const lato of LATI) {
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

// ---------- Box degli artisti ----------
function disegnaArtisti(b) {
  for (const lato of LATI) {
    const r = b[lato];
    const nome = $(`#bt-art-nome-${lato}`);
    nome.textContent = r.nome || "—";
    adattaTesto(nome, 42, 24);
    const ig = $(`#bt-art-ig-${lato}`);
    ig.hidden = !r.instagram;
    ig.querySelector("span").textContent = r.instagram ? `@${r.instagram}` : "";
  }
}

// ---------- Camera: spacco a fulmine, VS e STOP ----------
// Divisorio e VS ci sono dal via in poi. Sono fermi nello stato finale: l'animazione parte solo con il gong (effetti()).
function disegnaCamera(b) {
  const dentro = ["battle", "voto", "risultato"].includes(b.fase);
  $("#bt-spacco").hidden = !dentro;
  $("#bt-vs").hidden = !dentro;
  if (!dentro) camera.classList.remove("anima", "stop-anima");
}

// Animazioni che nascono da un evento (gong): il fulmine al via, STOP alla fine. Mai al primo disegno.
function effetti(prima, s, eventi) {
  if (STATICO || !prima) return;
  for (const e of eventi) {
    if (e.nome !== "gong") continue;
    if (e.dati?.quando === "inizio") {
      camera.classList.remove("stop-anima");
      rilancia(camera, "anima");
    } else {
      camera.classList.remove("anima");
      rilancia(camera, "stop-anima");
    }
  }
}

// ---------- Barra del voto chat ----------
function disegnaChat(b) {
  const chat = $(".bt-chat");
  const conta = $("#bt-chat-conta");
  conta.hidden = b.chat.voti === 0 && b.fase === "attesa";
  conta.textContent = `${b.chat.voti} ${b.chat.voti === 1 ? "voto" : "voti"}`;
  if (b.fase === "risultato") return; // in risultato la barra la scrive la rivelazione
  chat.classList.remove("pari");
  const testo = $("#bt-chat-testo");
  const chiuso = !b.chat.aperta && b.fase === "voto";
  const nome = (r) => r.nome || "…";
  if (chiuso) testo.replaceChildren("Voto chiuso");
  else testo.replaceChildren("Vota in chat: 1 = ", nodo("b", "", nome(b.sx)), " · 2 = ", nodo("b", "", nome(b.dx)));
}

// ---------- Tick: timer, 3-2-1, rivelazione, pop-up automatici ----------
function tick() {
  if (!stato) return;
  aggiornaTimer();
  aggiornaConto();
  aggiornaRivelazione();
  popupAutomatico();
}
if (!STATICO) setInterval(tick, 50);

function aggiornaTimer() {
  const b = stato.battle;
  const ms = rimanenteBattleMs(b, conn.ora());
  scrivi($("#bt-timer-etichetta"), `Round ${b.round}`);
  scrivi($("#bt-timer-cifre"), durata(ms));
  $("#bt-timer").classList.toggle("urgente", b.fase === "battle" && b.timer.fineAlle !== null && timerUrgente(ms));
}

// ---------- 3-2-1 a tutto schermo ----------
const conto = { strato: $("#bt-conto"), numero: $("#bt-conto-numero"), ultimo: null };

function aggiornaConto() {
  const b = stato.battle;
  const inConto = b.fase === "countdown" || CONTO_FISSO > 0;
  const visibile = inConto && PARTI.includes("conto");
  conto.strato.hidden = !visibile;
  if (!visibile) {
    conto.ultimo = null;
    return;
  }
  const n = CONTO_FISSO || numeroConto(b.conto.finoAlle, conn.ora());
  if (n === conto.ultimo) return;
  conto.ultimo = n;
  conto.numero.textContent = n > 0 ? String(n) : "VIA!";
  conto.numero.classList.toggle("via", n === 0);
  if (!STATICO) rilancia(conto.numero, "pop");
}

// ---------- Rivelazione dei voti a fine round ----------
// Luca → Freya → Daniele → Chat → Totale, ognuno con il suo conteggio animato (tempi in battle-logica.js).
// Quando i passi sono finiti (o con ?statico=1) si vedono subito i valori finali.
function aggiornaRivelazione() {
  const b = stato.battle;
  const r = b.fase === "risultato" ? b.risultato : null;
  for (const lato of LATI) $(`.bt-artista.${lato}`).classList.remove("vincitore", "perdente");
  if (!r) {
    disegnaGiudiciInattivi(b);
    return;
  }
  const trascorso = STATICO ? Infinity : conn.ora() - r.rivelatoAlle;
  const passi = sequenzaRivelazione(r);
  const durataPasso = (p) => (p.chiave === "totale" ? RIVELAZIONE.conteggioTotaleMs : RIVELAZIONE.conteggioMs);
  // valore da mostrare per un lato: null prima del passo, a metà conteggio il valore parziale, poi quello finale
  const valore = (p, lato, decimali) => {
    if (trascorso < p.dopoMs) return null;
    const t = Math.min(1, (trascorso - p.dopoMs) / durataPasso(p));
    return t >= 1 ? voto(p[lato]) : conta(p[lato] * uscitaLenta(t), decimali);
  };
  for (const p of passi.slice(0, 3)) {
    const box = $(`[data-giudice="${p.chiave}"]`);
    scrivi(box.querySelector(".bt-giudice-nome"), b.giudici.find((g) => g.id === p.chiave)?.nome ?? "");
    for (const lato of LATI) {
      const cella = box.querySelector(`b.${lato}`);
      const v = valore(p, lato, 1);
      scrivi(cella, v ?? "?");
      cella.classList.toggle("vuoto", v === null);
    }
  }
  scriviBarraRisultato(r, passi, trascorso, valore);
}

// Prima della rivelazione i giudici mostrano «?» (con il nome di ciascuno).
function disegnaGiudiciInattivi(b) {
  for (const g of b.giudici) {
    const box = $(`[data-giudice="${g.id}"]`);
    scrivi(box.querySelector(".bt-giudice-nome"), g.nome);
    for (const lato of LATI) {
      const cella = box.querySelector(`b.${lato}`);
      scrivi(cella, "?");
      cella.classList.add("vuoto");
    }
  }
}

// La barra sotto i giudici diventa la barra del risultato: «CHAT 7,5 · 2,5», poi «TOTALE 7,88 · 5,13».
function scriviBarraRisultato(r, passi, trascorso, valore) {
  const chat = $(".bt-chat");
  const testo = $("#bt-chat-testo");
  const [pChat, pTotale] = [passi[3], passi[4]];
  const finito = trascorso >= pTotale.dopoMs + RIVELAZIONE.conteggioTotaleMs;
  let etichetta = null;
  let p = null;
  if (trascorso >= pTotale.dopoMs) [etichetta, p] = ["Totale", pTotale];
  else if (trascorso >= pChat.dopoMs) [etichetta, p] = ["Chat", pChat];
  if (!p) {
    scrivi(testo, "Voto chiuso");
    return;
  }
  const decimali = p === pTotale ? 2 : 1;
  const sx = valore(p, "sx", decimali);
  const dx = valore(p, "dx", decimali);
  const attuale = testo.querySelector(".bt-ris");
  if (!attuale) {
    testo.replaceChildren(nodo("div", "bt-ris", ""));
    testo.firstChild.append(nodo("b", "", sx), nodo("span", "", etichetta), nodo("b", "", dx));
  } else {
    const [a, e, c] = attuale.children;
    scrivi(a, sx);
    scrivi(e, etichetta);
    scrivi(c, dx);
  }
  const pari = finito && r.pari && r.vincitore === null;
  chat.classList.toggle("pari", pari);
  if (pari) testo.querySelector(".bt-ris span").textContent = "Pari merito";
  if (finito && r.vincitore) {
    for (const lato of LATI) $(`.bt-artista.${lato}`).classList.add(lato === r.vincitore ? "vincitore" : "perdente");
  }
}

// ---------- Pop-up social ----------
const popup = { el: $("#bt-popup"), aperto: false, timer: null, ultimaId: null };
let ultimoPopupAlle = performance.now();

function riempiPopup(c) {
  const icona = $("#bt-popup-icona");
  if (c.icona === "logo") icona.replaceChildren(Object.assign(document.createElement("img"), { src: "/assets/logo-br.png", alt: "" }));
  else icona.replaceChildren(simbolo(`ic-${c.icona === "instagram+tiktok" ? "instagram" : c.icona}`));
  $("#bt-popup-sopra").textContent = c.sopra;
  $("#bt-popup-sopra").hidden = !c.sopra;
  $("#bt-popup-titolo").textContent = c.titolo;
  scriviConLink($("#bt-popup-sotto"), c.sotto);
  $("#bt-popup-sotto").hidden = !c.sotto;
  adattaTesto($("#bt-popup-titolo"), 36, 24);
  adattaTesto($("#bt-popup-sotto"), 26, 16);
}

function mostraPopup(id, { fisso = false, scelto = null } = {}) {
  const b = stato.battle;
  if (!popupConsentito(b, stato.visibili) && !fisso) return;
  const c = scelto ?? prossimaComparsa(b.popup.elenco, popup.ultimaId, id);
  if (!c) return;
  clearTimeout(popup.timer);
  riempiPopup(c);
  popup.ultimaId = c.id;
  popup.aperto = true;
  ultimoPopupAlle = performance.now();
  popup.el.classList.add("su");
  if (!fisso) popup.timer = setTimeout(chiudiPopup, b.popup.durata * 1000);
}

function chiudiPopup() {
  clearTimeout(popup.timer);
  popup.el.classList.remove("su");
  popup.aperto = false;
}

function popupDaEventi(prima, s, eventi) {
  for (const id of richiestePopup(prima, s, eventi)) mostraPopup(id);
}

// Giro automatico ogni N minuti; durante countdown, voto e risultato il pop-up si ritira.
function popupAutomatico() {
  if (STATICO || POPUP_FISSO) return;
  const b = stato.battle;
  const consentito = popupConsentito(b, stato.visibili);
  if (!consentito && popup.aperto) chiudiPopup();
  if (popupAutomaticoDovuto({ ogniMinuti: b.popup.ogniMinuti, ultimaAlle: ultimoPopupAlle, ora: performance.now(), aperto: popup.aperto, consentito })) mostraPopup(null);
}

// Con i font caricati le larghezze cambiano: si riadattano i testi.
function rimisura() {
  if (stato) disegna(stato);
}
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
