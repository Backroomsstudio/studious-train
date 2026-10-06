// Regia: voti dei giudici, voto della chat TikTok, conferma, coda Nero.fan, classifica, countdown e spareggio.
// Ogni azione è un comando al server; la pagina si ridisegna dallo stato che torna indietro.
import { collega, formatta, durata } from "./connessione.js";

const $ = (sel) => document.querySelector(sel);
const CATEGORIE = ["beat", "voce", "mix"];
const TIER = { standard: "Standard", skip: "Skip", superskip: "Super Skip", throne: "Throne" };

let stato = null;
let primoDisegno = true;

const conn = collega({
  suStato(s) {
    stato = s;
    disegna(s);
    primoDisegno = false;
  },
  suConnessione(ok) {
    $("#conn").textContent = ok ? "connesso" : "offline";
    $("#conn").classList.toggle("ok", ok);
  },
  pin: () => leggiPin(),
});

function leggiPin() {
  try {
    return localStorage.getItem("regia-pin") ?? "";
  } catch {
    return "";
  }
}

async function invia(nome, args) {
  let esito = await conn.comando(nome, args);
  if (!esito.ok && /PIN/.test(esito.errore ?? "")) {
    const pin = prompt("PIN della regia");
    if (pin !== null) {
      try {
        localStorage.setItem("regia-pin", pin);
      } catch {}
      esito = await conn.comando(nome, args);
    }
  }
  if (!esito.ok) avviso(esito.errore, "errore");
  return esito;
}

function avviso(testo, tipo = "") {
  const el = document.createElement("div");
  el.className = `avviso ${tipo}`;
  el.textContent = testo;
  $("#avvisi").append(el);
  setTimeout(() => el.remove(), 4500);
}

// Crea un elemento; i testi passano sempre da text node (nessun HTML da dati esterni).
function el(tag, props = {}, ...figli) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") nodo.className = v;
    else if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v);
  }
  nodo.append(...figli.filter((f) => f !== null && f !== undefined && f !== false));
  return nodo;
}

// Aggiorna un campo solo se non ci sta scrivendo l'operatore.
function riempi(input, valore) {
  if (input !== document.activeElement) input.value = valore ?? "";
}

const haVoti = (t) => CATEGORIE.some((c) => t.punteggi[c] !== null) || t.punteggi.chatVoti > 0;

// ---------- Disegno ----------
function disegna(s) {
  disegnaTraccia(s);
  disegnaCoda(s);
  disegnaVoti(s);
  disegnaChat(s);
  disegnaSpareggio(s);
  disegnaClassifica(s);
  disegnaSerata(s);
}

function disegnaTraccia(s) {
  const t = s.corrente;
  $("#c-titolo").textContent = t.titolo || "Nessuna traccia impostata";
  $("#c-artista").textContent = t.artista;
  $("#c-tier").hidden = !t.tier;
  $("#c-tier").textContent = TIER[t.tier] ?? "";
  $("#c-tier").className = `tier-badge ${t.tier ?? ""}`;

  const n = s.nero;
  $("#nero-auto").checked = n.automatico;
  $("#nero-messaggio").textContent = n.automatico ? n.messaggio : "Traccia automatica spenta: scrivi titolo e artista qui sotto.";
  $("#nero-arrivo").hidden = !n.inArrivo;
  $("#arrivo-titolo").textContent = n.inArrivo ? `«${n.inArrivo.titolo}»` : "";
  $("#arrivo-artista").textContent = n.inArrivo?.artista ?? "";
  const badge = $("#nero-stato");
  badge.textContent = { collegato: "Nero in ascolto", attesa: "Nero in attesa", spento: "Nero non collegato" }[n.stato];
  badge.className = `conn ${n.stato === "collegato" ? "ok" : n.stato === "attesa" ? "attesa" : ""}`;
  badge.title = n.messaggio;
}

function disegnaCoda(s) {
  $("#coda-conta").textContent = s.coda.length ? `(${s.coda.length})` : "";
  $("#coda-vuota").hidden = s.coda.length > 0;
  $("#coda").replaceChildren(
    ...s.coda.map((v) =>
      el(
        "li",
        {},
        el("span", { class: `tier-badge ${v.tier}` }, TIER[v.tier] ?? v.tier),
        el("div", { class: "nomi" }, el("div", { class: "t" }, v.titolo || "Senza titolo"), el("div", { class: "a" }, v.artista || "—", v.importo ? ` · pagato ${formatta(v.importo, 2)}` : "")),
        el(
          "div",
          { class: "bottoni" },
          el("button", { class: "primario piccolo", onclick: () => mettiInAscolto(v) }, "▶ In ascolto"),
          el("button", { class: "piccolo", title: "Togli dalla coda", onclick: () => invia("togliCoda", { id: v.id }) }, "✕"),
        ),
      ),
    ),
  );
  const embed = $("#nero-embed");
  const indirizzo = s.neroUtente ? `https://www.nero.fan/embed/${encodeURIComponent(s.neroUtente)}?mode=queue&theme=dark` : "";
  $("#nero").hidden = !indirizzo;
  if (indirizzo && embed.dataset.src !== indirizzo) {
    embed.dataset.src = indirizzo;
    embed.src = indirizzo;
  }
}

async function mettiInAscolto(voce) {
  const t = stato.corrente;
  if (haVoti(t) && !t.confermato && !confirm(`"${t.titolo || "La traccia attuale"}" ha voti non confermati. Passare comunque a "${voce.titolo}"?`)) return;
  invia("daCoda", { id: voce.id });
}

function disegnaVoti(s) {
  for (const cat of CATEGORIE) {
    $(`.voto[data-cat="${cat}"] .voto-giudice`).textContent = s.giudici[cat] ?? "";
    const input = $(`#voti input[data-cat="${cat}"]`);
    if (input !== document.activeElement && !attese.has(input)) {
      input.value = s.corrente.punteggi[cat] ?? "";
      input.classList.remove("errato");
    }
  }
  $("#nascondi").checked = s.nascondiVoti;

  const p = s.corrente.punteggi;
  $("#totale").textContent = formatta(p.totale, 2);
  $("#totale-stato").textContent = s.corrente.confermato
    ? `Confermato · ${s.corrente.posizione}° in classifica`
    : p.totale === null
      ? "Inserisci i voti"
      : "Da confermare";
}

function disegnaChat(s) {
  const chat = s.corrente.chat;
  const p = s.corrente.punteggi;
  $("#chat-media").textContent = formatta(p.chat);
  $("#chat-voti").textContent = `${p.chatVoti} ${p.chatVoti === 1 ? "voto" : "voti"}`;
  $("#chat-apri").firstChild.textContent = chat.aperta ? "Chiudi voto chat " : "Apri voto chat ";
  $("#chat-ultimi").replaceChildren(...chat.ultimi.map((u) => el("li", {}, `${u.utente} `, el("b", {}, formatta(u.valore, u.valore % 1 ? 1 : 0)))));
}

function disegnaSpareggio(s) {
  $("#spareggio").hidden = !s.spareggio;
  if (!s.spareggio) return;
  $("#spa-candidati").replaceChildren(
    ...s.spareggio.candidati.map((r) =>
      el(
        "li",
        {},
        el("span", { class: "punti cromo" }, formatta(r.totale, 2)),
        el("div", { class: "nomi" }, el("div", { class: "t" }, r.titolo), el("div", { class: "a" }, r.artista)),
        el("button", { class: "primario piccolo", onclick: () => scegliVincitore(r) }, "Proclama"),
      ),
    ),
  );
}

function scegliVincitore(r) {
  if (confirm(`Proclamare vincitore "${r.titolo}" di ${r.artista}?`)) invia("proclama", { id: r.id });
}

function disegnaClassifica(s) {
  $("#cl-conta").textContent = s.risultati.length ? `(${s.risultati.length} tracce · top ${s.topN} in overlay)` : "";
  $("#classifica").replaceChildren(
    ...s.risultati.map((r, i) =>
      el(
        "li",
        { class: `${i < s.topN ? "in-top" : ""} ${r.id === s.corrente.id ? "attuale" : ""}` },
        el("span", { class: "pos" }, String(i + 1)),
        el(
          "div",
          { class: "nomi" },
          el("div", { class: "t" }, r.titolo),
          el("div", { class: "a" }, `${r.artista} · B ${formatta(r.beat)} · V ${formatta(r.voce)} · M ${formatta(r.mix)} · C ${formatta(r.chat)} (${r.chatVoti})`),
        ),
        el(
          "div",
          { class: "bottoni" },
          el("span", { class: "punti cromo" }, formatta(r.totale, 2)),
          el("button", { class: "piccolo", title: "Togli dalla classifica", onclick: () => togliRisultato(r) }, "✕"),
        ),
      ),
    ),
  );
}

function togliRisultato(r) {
  if (confirm(`Togliere "${r.titolo}" di ${r.artista} dalla classifica?`)) invia("togliRisultato", { id: r.id });
}

function disegnaSerata(s) {
  riempi($("#premio"), s.premio);
  for (const cat of CATEGORIE) riempi($(`#f-giudici [name="${cat}"]`), s.giudici[cat]);
  riempi($("#tiktok"), s.tiktok.utente ? `@${s.tiktok.utente}` : "");
  if (primoDisegno) $("#minuti").value = s.durataCountdownMinuti;
  for (const box of document.querySelectorAll("[data-widget]")) box.checked = s.visibili[box.dataset.widget];

  const badge = $("#tiktok-stato");
  badge.textContent = { collegato: "TikTok in ascolto", attesa: "TikTok in attesa", spento: "TikTok non collegato" }[s.tiktok.stato];
  badge.className = `conn ${s.tiktok.stato === "collegato" ? "ok" : s.tiktok.stato === "attesa" ? "attesa" : ""}`;
  badge.title = s.tiktok.messaggio;
  $("#tiktok-messaggio").textContent = s.tiktok.messaggio;
}

// Countdown e tempo della chat: aggiornati 4 volte al secondo.
setInterval(() => {
  if (!stato) return;
  const c = stato.countdown;
  const ms = c.fineAlle !== null ? c.fineAlle - conn.ora() : c.rimanenteMs;
  $("#timer").textContent = ms !== null ? `${durata(ms)}${c.rimanenteMs !== null ? " ⏸" : ""}` : c.scaduto ? "scaduto" : "--:--";
  $("#t-pausa").firstChild.textContent = c.rimanenteMs !== null ? "Riprendi " : "Pausa ";

  const chat = stato.corrente.chat;
  const tempo = $("#chat-tempo");
  tempo.textContent = !chat.aperta ? "chiuso" : chat.chiudeAlle ? `aperto · ${durata(chat.chiudeAlle - conn.ora())}` : "aperto";
  tempo.classList.toggle("aperto", chat.aperta);
}, 250);

// ---------- Azioni ----------
// I voti partono 150 ms dopo l'ultima cifra; prima di confermare si mandano quelli ancora in attesa.
const attese = new Map();

function inviaVoto(input) {
  attese.delete(input);
  const testo = input.value.trim();
  const valore = testo === "" ? null : Number(testo);
  const valido = valore === null || (valore >= 0 && valore <= 10);
  input.classList.toggle("errato", !valido);
  return valido ? invia("voto", { categoria: input.dataset.cat, valore }) : null;
}

async function svuotaVoti() {
  for (const [input, timer] of attese) {
    clearTimeout(timer);
    await inviaVoto(input);
  }
}

$("#voti").addEventListener("input", (e) => {
  const input = e.target.closest("input");
  if (!input) return;
  clearTimeout(attese.get(input));
  attese.set(input, setTimeout(() => inviaVoto(input), 150));
});

$("#voti").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.ctrlKey) return;
  const tutti = [...document.querySelectorAll("#voti input")];
  const prossimo = tutti[tutti.indexOf(e.target) + 1];
  e.preventDefault();
  prossimo?.focus();
  prossimo?.select();
});

$("#nascondi").addEventListener("change", (e) => invia("nascondiVoti", { attivo: e.target.checked }));

for (const box of document.querySelectorAll("[data-widget]")) {
  box.addEventListener("change", () => invia("widget", { nome: box.dataset.widget, visibile: box.checked }));
}

$("#f-traccia").addEventListener("submit", async (e) => {
  e.preventDefault();
  const azione = e.submitter?.value ?? "ascolta";
  // "Correggi" cambia solo i campi compilati.
  const dati = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => azione !== "correggi" || v.trim()));
  const t = stato?.corrente;
  if (azione === "ascolta" && t && haVoti(t) && !t.confermato && !confirm("La traccia attuale ha voti non confermati. Sostituirla?")) return;
  const comando = { ascolta: "traccia", coda: "inCoda", correggi: "correggiTraccia" }[azione];
  const esito = await invia(comando, dati);
  if (esito.ok) e.target.reset();
});

// Clic sulla traccia in ascolto: copia i nomi nel modulo per correggerli.
$(".corrente").addEventListener("click", () => {
  const f = $("#f-traccia");
  f.titolo.value = stato?.corrente.titolo ?? "";
  f.artista.value = stato?.corrente.artista ?? "";
  f.titolo.focus();
});

function alternaChat() {
  if (stato?.corrente.chat.aperta) invia("chiudiChat");
  else invia("apriChat", { secondi: Number($("#chat-secondi").value) });
}
$("#chat-apri").addEventListener("click", alternaChat);
$("#chat-azzera").addEventListener("click", () => invia("azzeraChat"));
$("#chat-simula").addEventListener("click", () => invia("simulaChat", { quanti: 10 }));

async function conferma() {
  await svuotaVoti();
  const esito = await invia("conferma");
  if (!esito.ok) return;
  const d = esito.dati;
  avviso(
    d.inTop ? `Confermato: ${d.posizione}° in classifica${d.entrata ? " — nuova entrata!" : ""}` : `Confermato: ${d.posizione}° posto, fuori dalla top`,
    "ok",
  );
}
$("#conferma").addEventListener("click", conferma);

function prossima() {
  const t = stato?.corrente;
  if (t && haVoti(t) && !t.confermato && !confirm("Voti non confermati: passare comunque alla prossima traccia?")) return;
  invia("prossima");
}
$("#prossima").addEventListener("click", prossima);
$("#arrivo-passa").addEventListener("click", prossima);
$("#nero-auto").addEventListener("change", (e) => invia("neroAutomatico", { attivo: e.target.checked }));

function alternaPausa() {
  const c = stato?.countdown;
  if (c?.fineAlle !== null) invia("countdown", { azione: "pausa" });
  else if (c?.rimanenteMs !== null) invia("countdown", { azione: "riprendi" });
}
$("#t-avvia").addEventListener("click", () => {
  const c = stato?.countdown;
  if ((c?.fineAlle !== null || c?.rimanenteMs !== null) && !confirm("Il countdown è già in corso. Ripartire da capo?")) return;
  invia("countdown", { azione: "avvia", minuti: Number($("#minuti").value) });
});
$("#t-pausa").addEventListener("click", alternaPausa);
$("#t-piu").addEventListener("click", () => invia("countdown", { azione: "aggiungi", minuti: 5 }));
$("#t-meno").addEventListener("click", () => invia("countdown", { azione: "aggiungi", minuti: -5 }));
$("#t-azzera").addEventListener("click", () => invia("countdown", { azione: "azzera" }));
$("#proclama").addEventListener("click", async () => {
  if (!confirm("Chiudere la gara adesso e proclamare il primo in classifica?")) return;
  const esito = await invia("proclama", {});
  if (esito.ok && esito.dati?.spareggio) avviso("Pari merito in testa: scegliete il vincitore nel riquadro Spareggio", "ok");
});
$("#chiudi-vincitore").addEventListener("click", () => invia("nascondiVincitore"));

$("#f-premio").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("premio", { testo: $("#premio").value })).ok) avviso("Premio aggiornato", "ok");
});
$("#f-giudici").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("giudici", Object.fromEntries(new FormData(e.target)))).ok) avviso("Giudici aggiornati", "ok");
});
$("#f-tiktok").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("tiktok", { utente: $("#tiktok").value })).ok) $("#tiktok").blur();
});
$("#demo").addEventListener("click", () => {
  if (confirm("I dati demo sostituiscono la serata attuale. Continuare?")) invia("demo");
});
$("#nuova-serata").addEventListener("click", () => {
  if (confirm("Nuova serata: classifica, coda e countdown vengono azzerati. Continuare?")) invia("nuovaSerata");
});

$("#aiuto").addEventListener("click", () => $("#d-aiuto").showModal());

// Scorciatoie: funzionano anche col cursore dentro un campo.
addEventListener("keydown", (e) => {
  const azioni = { F2: alternaChat, F4: conferma, F8: prossima, F9: alternaPausa };
  const azione = e.key === "Enter" && e.ctrlKey ? conferma : azioni[e.key];
  if (!azione || e.repeat) return;
  e.preventDefault();
  azione();
});
