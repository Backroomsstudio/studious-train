// Regia: voti dei giudici, voto della chat TikTok, conferma, coda Nero.fan, classifica, countdown e spareggio;
// in più il layout senza premio delle live giornaliere (banner, barra che scorre, scheda «Ora in ascolto», spot).
// Ogni azione è un comando al server; la pagina si ridisegna dallo stato che torna indietro.
import { collega, formatta, durata } from "./connessione.js";
import { suona, volume, audioPronto } from "./suoni.js";
import { suoniTraccia, cambiClassifica, suoniClassifica, suoniTimer, suoniSenzaPremio, suonaIn, RITARDO_CLASSIFICA_MS } from "./eventi-sonori.js";
import { vociBarra, stimaGiroSecondi } from "./barra.js";

const $ = (sel) => document.querySelector(sel);
const CATEGORIE = ["beat", "voce", "mix"];
const TIER = { standard: "Standard", skip: "Skip", superskip: "Super Skip", throne: "Throne" };

let stato = null;
let primoDisegno = true;

const conn = collega({
  suStato(s, eventi) {
    const prima = stato;
    stato = s;
    suoniRegia(prima, s, eventi);
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

// ---------- Suoni ----------
// Se la regia sceglie "in questa pagina", gli effetti suonano qui (da catturare come audio del PC in LIVE Studio),
// con le regole del layout in onda: gara con premio o senza premio.
const suonaQui = () => suonaIn(stato, stato?.layout ?? "gara", "regia");
const inGara = () => (stato?.layout ?? "gara") === "gara";
let ultimaTracciaAlle = -Infinity;

function riproduci(suoni, ritardoBase = 0) {
  if (!suonaQui() || !suoni.length) return;
  volume(stato.suoni.volume);
  for (const x of suoni) suona(x.nome, x.dati, ritardoBase + (x.ritardo ?? 0));
}

function suoniRegia(prima, dopo, eventi) {
  if (!inGara()) {
    const ora = performance.now();
    const suoni = suoniSenzaPremio(prima, dopo, eventi, { ora, ultimaTracciaAlle });
    if (suoni.some((x) => x.traccia)) ultimaTracciaAlle = ora;
    return riproduci(suoni);
  }
  riproduci(suoniTraccia(prima, dopo, eventi));
  if (prima && eventi.some((e) => e.nome === "classifica")) {
    riproduci(suoniClassifica(cambiClassifica(prima.classifica, dopo.classifica)), RITARDO_CLASSIFICA_MS);
  }
}

// ---------- Disegno ----------
function disegna(s) {
  disegnaTraccia(s);
  disegnaCoda(s);
  disegnaVoti(s);
  disegnaChat(s);
  disegnaSpareggio(s);
  disegnaClassifica(s);
  disegnaSerata(s);
  disegnaSenzaPremio(s);
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
  const attesa = n.attesaDopoConfermaSecondi;
  $("#arrivo-come").textContent = s.corrente.confermato
    ? attesa ? `Va sul tabellone da sola ${attesa} secondi dopo la conferma (F8 per subito).` : "Passa con F8."
    : attesa ? `Conferma i voti con F4: ${attesa} secondi dopo va sul tabellone da sola.` : "Conferma i voti con F4, poi passa con F8.";
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
  riempi($("#invito"), s.invito);
  riempi($("#suoni-dove"), s.suoni.dove);
  riempi($("#suoni-volume"), s.suoni.volume);
  $("#suoni-nota").textContent =
    s.suoni.dove === "overlay"
      ? `Suonano dalla sorgente Link di LIVE Studio (${s.layout === "senzaPremio" ? "/senza-premio.html, il layout in onda" : "/overlay.html, la gara in onda"}). Se in diretta non si sentono, scegliete «in questa pagina» e in LIVE Studio aggiungete l'audio del PC.`
      : s.suoni.dove === "regia"
        ? audioPronto()
          ? "Suonano da questa pagina: tenetela aperta e catturate l'audio del PC in LIVE Studio."
          : "Suonano da questa pagina: fate un clic qui per attivare l'audio del browser."
        : "Effetti sonori spenti.";
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
let msPrecedente = null;
setInterval(() => {
  if (!stato) return;
  const c = stato.countdown;
  const ms = c.fineAlle !== null ? c.fineAlle - conn.ora() : c.rimanenteMs;
  if (c.fineAlle !== null) {
    if (inGara()) riproduci(suoniTimer(msPrecedente, ms));
    msPrecedente = ms;
  } else msPrecedente = null;
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
$("#f-invito").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("invito", { testo: $("#invito").value })).ok) avviso("Frasi aggiornate", "ok");
});
$("#suoni-dove").addEventListener("change", (e) => invia("suoni", { dove: e.target.value }));
$("#suoni-volume").addEventListener("change", (e) => invia("suoni", { volume: Number(e.target.value) }));
for (const bottone of document.querySelectorAll("[data-suono]")) {
  bottone.addEventListener("click", () => {
    if (stato?.suoni.dove === "spenti") return avviso("I suoni sono spenti: scegliete dove farli suonare", "errore");
    invia("provaSuono", { nome: bottone.dataset.suono, dati: JSON.parse(bottone.dataset.dati ?? "null") });
  });
}
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

// ---------- Layout senza premio ----------
const NOMI_ICONE = {
  nero: "Nero.fan (nota)",
  instagram: "Instagram",
  tiktok: "TikTok",
  "instagram+tiktok": "Instagram+TikTok",
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
  spotify: "Spotify",
  whatsapp: "WhatsApp",
  sito: "Sito (globo)",
  microfono: "Studio (microfono)",
  logo: "Logo BR",
};

function disegnaSenzaPremio(s) {
  const sp = s.senzaPremio;
  riempi($("#layout"), s.layout);
  $("#sp-regia").classList.toggle("attivo", s.layout === "senzaPremio");
  const banner = $("#f-sp-banner");
  for (const campo of ["sopra", "titolo", "pillola", "link"]) riempi(banner[campo], sp[campo]);
  const spot = $("#f-sp-spot");
  for (const campo of ["sopra", "titolo", "sotto"]) riempi(spot[campo], sp.spot[campo]);
  riempi($("#sp-richiamo-ogni"), String(sp.richiamoOgniMinuti));
  riempi($("#sp-suono-traccia"), sp.suonoTraccia);
  for (const input of document.querySelectorAll("#sp-durate input")) riempi(input, sp.durate[input.dataset.tier]);
  riempi($("#sp-velocita"), sp.velocita);
  scriviVelocita(Number($("#sp-velocita").value));
  $("#sp-in-ascolto").checked = sp.inAscoltoNellaBarra;
  $("#sp-ascoltate").checked = sp.ascoltateNellaBarra;
  $("#sp-loghi").checked = sp.loghiBarra;
  $("#sp-filo").checked = sp.filoCamera;
  disegnaVoci(s);
}

function scriviVelocita(v) {
  if (!stato) return;
  const giro = stimaGiroSecondi(vociBarra(stato), v);
  $("#sp-velocita-testo").textContent = `${v} px/s · un giro ≈ ${giro} s`;
  $("#sp-velocita-nota").textContent =
    v > 120 ? "Sopra 120 il testo in movimento si legge peggio nella diretta." : giro > 75 ? "Giro lungo: spegnete una voce o alzate la velocità." : "";
}

// Elenco delle voci della barra: si ridisegna dallo stato solo quando l'operatore non ci sta scrivendo.
function disegnaVoci(s, forza = false) {
  const lista = $("#sp-voci");
  if (!forza && lista.contains(document.activeElement)) return;
  const firma = JSON.stringify(s.senzaPremio.voci);
  if (!forza && lista.dataset.firma === firma) return;
  lista.dataset.firma = firma;
  lista.replaceChildren(...s.senzaPremio.voci.map(rigaVoce));
}

function rigaVoce(v = {}) {
  const scelta = el("select", { name: "icona", "aria-label": "Icona" }, ...Object.entries(NOMI_ICONE).map(([valore, nome]) => el("option", { value: valore }, nome)));
  scelta.value = v.icona ?? "sito";
  const attiva = el("input", { type: "checkbox", name: "attiva", title: "In onda" });
  attiva.checked = v.attiva !== false;
  const etichetta = el("input", { name: "etichetta", maxlength: "28", placeholder: "Etichetta (es. Seguici)" });
  etichetta.value = v.etichetta ?? "";
  const testo = el("input", { name: "testo", maxlength: "40", placeholder: "Testo (es. @backrooms.studios)" });
  testo.value = v.testo ?? "";
  return el(
    "li",
    { "data-id": v.id ?? "" },
    attiva,
    scelta,
    etichetta,
    testo,
    el("button", { type: "button", class: "piccolo", "data-sposta": "-1", title: "Sposta su" }, "↑"),
    el("button", { type: "button", class: "piccolo", "data-sposta": "1", title: "Sposta giù" }, "↓"),
    el("button", { type: "button", class: "piccolo", "data-togli": "", title: "Togli" }, "✕"),
  );
}

// Le righe ancora vuote (appena aggiunte) non si mandano.
function leggiVoci() {
  return [...$("#sp-voci").children]
    .map((li) => ({
      id: li.dataset.id || undefined,
      attiva: li.querySelector('[name="attiva"]').checked,
      icona: li.querySelector('[name="icona"]').value,
      etichetta: li.querySelector('[name="etichetta"]').value,
      testo: li.querySelector('[name="testo"]').value,
    }))
    .filter((v) => v.etichetta.trim() || v.testo.trim());
}

async function salvaVoci(voci = leggiVoci()) {
  const esito = await invia("senzaPremio", { voci });
  if (esito.ok) avviso("Barra aggiornata", "ok");
  else if (stato) disegnaVoci(stato, true);
}

const senzaPremio = async (modifiche, messaggio) => {
  const esito = await invia("senzaPremio", modifiche);
  if (esito.ok && messaggio) avviso(messaggio, "ok");
  return esito;
};

$("#layout").addEventListener("change", (e) => invia("layout", { nome: e.target.value }));
$("#sp-richiamo").addEventListener("click", () => invia("richiamo"));
$("#sp-spot").addEventListener("click", () => invia("spotStudio"));
$("#sp-ripeti").addEventListener("click", () => invia("ripetiScheda"));
for (const bottone of document.querySelectorAll("[data-prova-scheda]")) {
  bottone.addEventListener("click", () => invia("provaScheda", { tier: bottone.dataset.provaScheda }));
}
$("#f-sp-banner").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  senzaPremio({ sopra: f.sopra.value, titolo: f.titolo.value, pillola: f.pillola.value, link: f.link.value }, "Banner aggiornato");
});
$("#f-sp-spot").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  senzaPremio({ spot: { sopra: f.sopra.value, titolo: f.titolo.value, sotto: f.sotto.value } }, "Spot aggiornato");
});
$("#sp-richiamo-ogni").addEventListener("change", (e) => senzaPremio({ richiamoOgniMinuti: Number(e.target.value) }));
$("#sp-suono-traccia").addEventListener("change", (e) => senzaPremio({ suonoTraccia: e.target.value }));
$("#sp-durate").addEventListener("change", (e) => {
  const input = e.target.closest("input");
  if (input) senzaPremio({ durate: { [input.dataset.tier]: Number(input.value) } }, "Scheda aggiornata");
});
$("#sp-velocita").addEventListener("input", (e) => scriviVelocita(Number(e.target.value)));
$("#sp-velocita").addEventListener("change", (e) => senzaPremio({ velocita: Number(e.target.value) }));
for (const [id, chiave] of [["#sp-in-ascolto", "inAscoltoNellaBarra"], ["#sp-ascoltate", "ascoltateNellaBarra"], ["#sp-loghi", "loghiBarra"], ["#sp-filo", "filoCamera"]]) {
  $(id).addEventListener("change", (e) => senzaPremio({ [chiave]: e.target.checked }));
}
$("#sp-voci").addEventListener("change", () => salvaVoci());
$("#sp-voci").addEventListener("click", (e) => {
  const bottone = e.target.closest("button");
  if (!bottone) return;
  const righe = [...$("#sp-voci").children];
  const i = righe.indexOf(bottone.closest("li"));
  if (bottone.dataset.togli !== undefined) righe.splice(i, 1);
  else {
    const j = i + Number(bottone.dataset.sposta);
    if (j < 0 || j >= righe.length) return;
    [righe[i], righe[j]] = [righe[j], righe[i]];
  }
  $("#sp-voci").replaceChildren(...righe);
  salvaVoci();
});
$("#sp-aggiungi").addEventListener("click", () => {
  const riga = rigaVoce({ attiva: true, icona: "sito" });
  $("#sp-voci").append(riga);
  riga.querySelector('[name="etichetta"]').focus();
});
$("#sp-ripristina").addEventListener("click", () => {
  if (confirm("Ripristinare banner, barra, scheda e spot come all'inizio?")) invia("ripristinaSenzaPremio");
});

// Scorciatoie: funzionano anche col cursore dentro un campo.
addEventListener("keydown", (e) => {
  const azioni = { F2: alternaChat, F4: conferma, F8: prossima, F9: alternaPausa };
  const azione = e.key === "Enter" && e.ctrlKey ? conferma : azioni[e.key];
  if (!azione || e.repeat) return;
  e.preventDefault();
  azione();
});
