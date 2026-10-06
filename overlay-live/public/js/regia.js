// Regia: voti dei giudici, voto della chat TikTok, conferma, coda Nero.fan, classifica, countdown e spareggio;
// in più il layout senza premio delle live giornaliere (banner, barra che scorre, scheda «Ora in ascolto», spot)
// la live session in studio (nome e Instagram dell'artista, comparse dello studio, nessun suono)
// e il battle (scontro tra due rapper: nomi, modalità, timer, voti dei giudici, tabellone, pop-up).
// Ogni azione è un comando al server; la pagina si ridisegna dallo stato che torna indietro.
import { collega, formatta, durata } from "./connessione.js";
import { suona, volume, audioPronto } from "./suoni.js";
import { suoniTraccia, cambiClassifica, suoniClassifica, suoniTimer, suoniSenzaPremio, suoniBattle, suonaIn, RITARDO_CLASSIFICA_MS } from "./eventi-sonori.js";
import { percentuali, rimanenteBattleMs } from "./battle-logica.js";
import { vociBarra, stimaGiroSecondi } from "./barra.js";
import { vociStudio } from "./studio-logica.js";

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
// e nemmeno se l'operatore l'ha cambiato senza ancora salvare (segnato da «modificato», tolto dopo il salvataggio).
function riempi(input, valore) {
  if (input !== document.activeElement && !input.dataset.modificato) input.value = valore ?? "";
}

// Le scelte (select, cursori) mostrano sempre il valore in onda: si salvano appena cambiano.
function mostra(input, valore) {
  input.value = valore;
}

document.addEventListener("input", (e) => {
  if (e.target.matches("form input")) e.target.dataset.modificato = "1";
});
const salvato = (modulo) => {
  for (const input of modulo.querySelectorAll("[data-modificato]")) delete input.dataset.modificato;
};
// Dopo una scelta col mouse il fuoco lascia il select: le frecce non cambiano per sbaglio quello che è in onda.
const scegli = (sel, fn) =>
  $(sel).addEventListener("change", (e) => {
    e.target.blur();
    fn(e.target.value);
  });

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
  if (dopo.layout === "studio") return; // live session in studio: l'artista registra, nessun suono
  if (dopo.layout === "battle") return riproduci(suoniBattle(prima, dopo, eventi));
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
  disegnaStudio(s);
  disegnaBattle(s);
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
  mostra($("#suoni-dove"), s.suoni.dove);
  riempi($("#suoni-volume"), s.suoni.volume); // un cursore: non si sposta mentre lo si trascina
  $("#suoni-nota").textContent =
    s.layout === "studio"
      ? "In onda c'è la live session in studio: nessun effetto sonoro, per non disturbare chi registra."
      : s.suoni.dove === "overlay"
      ? `Suonano dalla sorgente Link di LIVE Studio (${s.layout === "senzaPremio" ? "/senza-premio.html, il layout in onda" : s.layout === "battle" ? "/battle.html, il battle in onda" : "/overlay.html, la gara in onda"}). Se in diretta non si sentono, scegliete «in questa pagina» e in LIVE Studio aggiungete l'audio del PC.`
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
  if ((await invia("premio", { testo: $("#premio").value })).ok) {
    salvato(e.target);
    avviso("Premio aggiornato", "ok");
  }
});
$("#f-invito").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("invito", { testo: $("#invito").value })).ok) {
    salvato(e.target);
    avviso("Frasi aggiornate", "ok");
  }
});
scegli("#suoni-dove", (dove) => invia("suoni", { dove }));
scegli("#suoni-volume", (v) => invia("suoni", { volume: Number(v) }));
for (const bottone of document.querySelectorAll("[data-suono]")) {
  bottone.addEventListener("click", () => {
    if (stato?.layout === "studio") return avviso("In onda c'è la live session in studio: lì non suona niente", "errore");
    if (stato?.suoni.dove === "spenti") return avviso("I suoni sono spenti: scegliete dove farli suonare", "errore");
    invia("provaSuono", { nome: bottone.dataset.suono, dati: JSON.parse(bottone.dataset.dati ?? "null") });
  });
}
$("#f-giudici").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("giudici", Object.fromEntries(new FormData(e.target)))).ok) {
    salvato(e.target);
    avviso("Giudici aggiornati", "ok");
  }
});
$("#f-tiktok").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ((await invia("tiktok", { utente: $("#tiktok").value })).ok) {
    salvato(e.target);
    $("#tiktok").blur();
  }
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
  dm: "DM (aeroplanino)",
  sito: "Sito (globo)",
  microfono: "Studio (microfono)",
  logo: "Logo BR",
};

let velocitaInMano = false; // il cursore della velocità si sta trascinando

function disegnaSenzaPremio(s) {
  const sp = s.senzaPremio;
  mostra($("#layout"), s.layout);
  $("#sp-regia").classList.toggle("attivo", s.layout === "senzaPremio");
  const banner = $("#f-sp-banner");
  for (const campo of ["sopra", "titolo", "pillola", "link"]) riempi(banner[campo], sp[campo]);
  const spot = $("#f-sp-spot");
  for (const campo of ["sopra", "titolo", "sotto"]) riempi(spot[campo], sp.spot[campo]);
  const ogni = $("#sp-richiamo-ogni");
  // un valore messo da Stream Deck o API che non è tra le scelte: si aggiunge, così la regia mostra quello in onda
  if (![...ogni.options].some((o) => Number(o.value) === sp.richiamoOgniMinuti)) {
    ogni.append(el("option", { value: String(sp.richiamoOgniMinuti) }, `ogni ${sp.richiamoOgniMinuti} minuti`));
  }
  mostra(ogni, String(sp.richiamoOgniMinuti));
  mostra($("#sp-suono-traccia"), sp.suonoTraccia);
  for (const input of document.querySelectorAll("#sp-durate input")) riempi(input, sp.durate[input.dataset.tier]);
  if (!velocitaInMano) mostra($("#sp-velocita"), sp.velocita);
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

// Le righe ancora da finire (accese ma senza testo, come una appena aggiunta) non si mandano:
// restano sullo schermo finché l'operatore non scrive il testo.
function leggiVoci() {
  return [...$("#sp-voci").children]
    .map((li) => ({
      id: li.dataset.id || undefined,
      attiva: li.querySelector('[name="attiva"]').checked,
      icona: li.querySelector('[name="icona"]').value,
      etichetta: li.querySelector('[name="etichetta"]').value,
      testo: li.querySelector('[name="testo"]').value,
    }))
    // le voci già in onda si mandano sempre (testo svuotato → errore e si rimette quello vero);
    // una voce nuova si manda quando ha il testo, o se è spenta
    .filter((v) => v.id || v.testo.trim() || (!v.attiva && v.etichetta.trim()));
}

const firmaVoci = (voci) => JSON.stringify(voci.map((v) => [v.attiva, v.icona, v.etichetta.trim(), v.testo.trim()]));

async function salvaVoci(voci = leggiVoci()) {
  if (stato && firmaVoci(voci) === firmaVoci(stato.senzaPremio.voci)) return; // niente di nuovo da salvare
  const esito = await invia("senzaPremio", { voci });
  if (esito.ok) avviso("Barra aggiornata", "ok");
  else if (stato) disegnaVoci(stato, true);
}

const senzaPremio = async (modifiche, messaggio) => {
  const esito = await invia("senzaPremio", modifiche);
  if (esito.ok && messaggio) avviso(messaggio, "ok");
  return esito;
};

scegli("#layout", (nome) => invia("layout", { nome }));
$("#sp-richiamo").addEventListener("click", () => invia("richiamo"));
$("#sp-spot").addEventListener("click", () => invia("spotStudio"));
$("#sp-ripeti").addEventListener("click", () => invia("ripetiScheda"));
for (const bottone of document.querySelectorAll("[data-prova-scheda]")) {
  bottone.addEventListener("click", () => invia("provaScheda", { tier: bottone.dataset.provaScheda }));
}
$("#f-sp-banner").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const esito = await senzaPremio({ sopra: f.sopra.value, titolo: f.titolo.value, pillola: f.pillola.value, link: f.link.value }, "Banner aggiornato");
  if (esito.ok) salvato(f);
});
$("#f-sp-spot").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const esito = await senzaPremio({ spot: { sopra: f.sopra.value, titolo: f.titolo.value, sotto: f.sotto.value } }, "Spot aggiornato");
  if (esito.ok) salvato(f);
});
scegli("#sp-richiamo-ogni", (v) => senzaPremio({ richiamoOgniMinuti: Number(v) }));
scegli("#sp-suono-traccia", (suonoTraccia) => senzaPremio({ suonoTraccia }));
$("#sp-durate").addEventListener("change", async (e) => {
  const input = e.target.closest("input");
  if (!input) return;
  const esito = await senzaPremio({ durate: { [input.dataset.tier]: input.value } }, "Scheda aggiornata");
  // valore rifiutato: il campo torna a quello in onda
  if (!esito.ok && stato) input.value = stato.senzaPremio.durate[input.dataset.tier];
});
$("#sp-velocita").addEventListener("input", (e) => {
  velocitaInMano = true;
  scriviVelocita(Number(e.target.value));
});
$("#sp-velocita").addEventListener("change", (e) => {
  velocitaInMano = false;
  e.target.blur();
  senzaPremio({ velocita: Number(e.target.value) });
});
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
// Uscendo da una riga nuova accesa senza testo: avviso, perché non va in onda.
$("#sp-voci").addEventListener("focusout", (e) => {
  const li = e.target.closest("li");
  if (!li || li.contains(e.relatedTarget)) return;
  const testo = li.querySelector('[name="testo"]').value.trim();
  const incompleta = !li.dataset.id && !testo && li.querySelector('[name="attiva"]').checked && li.querySelector('[name="etichetta"]').value.trim();
  li.classList.toggle("incompleta", Boolean(incompleta));
  if (incompleta) avviso("Voce nuova senza testo: scrivetelo, altrimenti non va in onda", "errore");
});
$("#sp-aggiungi").addEventListener("click", () => {
  const riga = rigaVoce({ attiva: true, icona: "sito" });
  $("#sp-voci").append(riga);
  riga.querySelector('[name="etichetta"]').focus();
});
$("#sp-ripristina").addEventListener("click", () => {
  if (confirm("Ripristinare banner, barra, scheda e spot come all'inizio?")) invia("ripristinaSenzaPremio");
});

// ---------- Live session in studio ----------
let velocitaStudioInMano = false;

function disegnaStudio(s) {
  const st = s.studio;
  $("#st-regia").classList.toggle("attivo", s.layout === "studio");
  const f = $("#f-st-artista");
  riempi(f.artista, st.artista);
  riempi(f.instagram, st.instagram ? `@${st.instagram}` : "");
  riempi(f.etichetta, st.etichetta);
  $("#st-artista-barra").checked = st.artistaNellaBarra;
  const ogni = $("#st-ogni");
  // un valore messo da Stream Deck o API che non è tra le scelte: si aggiunge, così la regia mostra quello in onda
  if (![...ogni.options].some((o) => Number(o.value) === st.comparsaOgniMinuti)) {
    ogni.append(el("option", { value: String(st.comparsaOgniMinuti) }, `ogni ${st.comparsaOgniMinuti} minuti`));
  }
  mostra(ogni, String(st.comparsaOgniMinuti));
  riempi($("#st-durata"), st.durataComparsa);
  if (!velocitaStudioInMano) mostra($("#st-velocita"), st.velocita);
  scriviVelocitaStudio(Number($("#st-velocita").value));
  disegnaComparseRegia(s);
}

function scriviVelocitaStudio(v) {
  if (!stato) return;
  $("#st-velocita-testo").textContent = `${v} px/s · un giro ≈ ${stimaGiroSecondi(vociStudio(stato), v)} s`;
}

// Elenco delle comparse: si ridisegna dallo stato solo quando l'operatore non ci sta scrivendo.
function disegnaComparseRegia(s, forza = false) {
  const lista = $("#st-comparse");
  if (!forza && lista.contains(document.activeElement)) return;
  const firma = JSON.stringify(s.studio.comparse);
  if (!forza && lista.dataset.firma === firma) return;
  lista.dataset.firma = firma;
  lista.replaceChildren(...s.studio.comparse.map(rigaComparsa));
}

function rigaComparsa(c = {}) {
  const scelta = el("select", { name: "icona", "aria-label": "Icona" }, ...Object.entries(NOMI_ICONE).map(([valore, nome]) => el("option", { value: valore }, nome)));
  scelta.value = c.icona ?? "microfono";
  const attiva = el("input", { type: "checkbox", name: "attiva", title: "Nel giro automatico" });
  attiva.checked = c.attiva !== false;
  const campo = (nome, max, segnaposto) => {
    const input = el("input", { name: nome, maxlength: String(max), placeholder: segnaposto });
    input.value = c[nome] ?? "";
    return input;
  };
  return el(
    "li",
    { "data-id": c.id ?? "" },
    attiva,
    scelta,
    campo("titolo", 28, "Titolo (es. Vieni a trovarci in studio)"),
    el("button", { type: "button", class: "piccolo primario", "data-mostra": "", title: "Mostrala adesso", ...(c.id ? {} : { disabled: "" }) }, "▶"),
    el("button", { type: "button", class: "piccolo", "data-sposta": "-1", title: "Sposta su" }, "↑"),
    el("button", { type: "button", class: "piccolo", "data-sposta": "1", title: "Sposta giù" }, "↓"),
    el("button", { type: "button", class: "piccolo", "data-togli": "", title: "Togli" }, "✕"),
    campo("sopra", 40, "Riga sopra (es. Backrooms Studio · Vicenza)"),
    campo("sotto", 60, "Riga sotto (es. backroomsstudio.it)"),
  );
}

// Una comparsa nuova si manda quando ha il titolo (o se è spenta e ha almeno un testo).
function leggiComparse(lista = $("#st-comparse")) {
  return [...lista.children]
    .map((li) => {
      const valore = (nome) => li.querySelector(`[name="${nome}"]`).value;
      return {
        id: li.dataset.id || undefined,
        attiva: li.querySelector('[name="attiva"]').checked,
        icona: valore("icona"),
        titolo: valore("titolo"),
        sopra: valore("sopra"),
        sotto: valore("sotto"),
      };
    })
    .filter((c) => c.id || c.titolo.trim() || (!c.attiva && (c.sopra.trim() || c.sotto.trim())));
}

const firmaComparse = (comparse) => JSON.stringify(comparse.map((c) => [c.attiva, c.icona, c.titolo.trim(), c.sopra.trim(), c.sotto.trim()]));

async function salvaComparse(comparse = leggiComparse()) {
  if (stato && firmaComparse(comparse) === firmaComparse(stato.studio.comparse)) return;
  const esito = await invia("studio", { comparse });
  if (esito.ok) avviso("Comparse aggiornate", "ok");
  else if (stato) disegnaComparseRegia(stato, true);
}

const studio = async (modifiche, messaggio) => {
  const esito = await invia("studio", modifiche);
  if (esito.ok && messaggio) avviso(messaggio, "ok");
  return esito;
};

$("#f-st-artista").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const esito = await studio({ artista: f.artista.value, instagram: f.instagram.value, etichetta: f.etichetta.value }, "Targa in onda");
  if (esito.ok) salvato(f); // al prossimo stato il campo Instagram mostra il nome pulito, con la @
});
$("#st-svuota").addEventListener("click", async () => {
  const f = $("#f-st-artista");
  const esito = await studio({ artista: "", instagram: "" }, "Targa svuotata");
  if (esito.ok) {
    f.artista.value = "";
    f.instagram.value = "";
    salvato(f);
  }
});
$("#st-artista-barra").addEventListener("change", (e) => studio({ artistaNellaBarra: e.target.checked }));
$("#st-comparsa").addEventListener("click", () => invia("comparsa", {}));
scegli("#st-ogni", (v) => studio({ comparsaOgniMinuti: Number(v) }));
$("#st-durata").addEventListener("change", async (e) => {
  const esito = await studio({ durataComparsa: e.target.value }, "Durata aggiornata");
  if (!esito.ok && stato) e.target.value = stato.studio.durataComparsa;
});
$("#st-velocita").addEventListener("input", (e) => {
  velocitaStudioInMano = true;
  scriviVelocitaStudio(Number(e.target.value));
});
$("#st-velocita").addEventListener("change", (e) => {
  velocitaStudioInMano = false;
  e.target.blur();
  studio({ velocita: Number(e.target.value) });
});
// Elenco di pannelli (comparse dello studio, pop-up del battle): si salva all'uscita da un campo; ▶ mostra, ↑ ↓ riordinano, ✕ toglie.
function collegaListaComparse(lista, { mostra: mostraPannello, salva }) {
  lista.addEventListener("change", () => salva());
  lista.addEventListener("click", (e) => {
    const bottone = e.target.closest("button");
    if (!bottone) return;
    const li = bottone.closest("li");
    if (bottone.dataset.mostra !== undefined) return mostraPannello(li.dataset.id);
    const righe = [...lista.children];
    const i = righe.indexOf(li);
    if (bottone.dataset.togli !== undefined) righe.splice(i, 1);
    else {
      const j = i + Number(bottone.dataset.sposta);
      if (j < 0 || j >= righe.length) return;
      [righe[i], righe[j]] = [righe[j], righe[i]];
    }
    lista.replaceChildren(...righe);
    salva();
  });
}
collegaListaComparse($("#st-comparse"), { mostra: (id) => invia("comparsa", { id }), salva: () => salvaComparse() });
$("#st-aggiungi").addEventListener("click", () => {
  const riga = rigaComparsa({ attiva: true, icona: "microfono" });
  $("#st-comparse").append(riga);
  riga.querySelector('[name="titolo"]').focus();
});
$("#st-ripristina").addEventListener("click", () => {
  if (confirm("Ripristinare comparse, velocità e impostazioni della live session come all'inizio? Il nome dell'artista resta.")) invia("ripristinaStudio");
});


// ---------- Battle ----------
const FASI_BATTLE = { attesa: "In attesa", countdown: "3-2-1", battle: "Battle in corso", voto: "Voto dei giudici", risultato: "Risultato" };
const GIUDICI_BATTLE = [["luca", "Luca"], ["freya", "Freya"], ["daniele", "Daniele"]];
const LATI_BATTLE = ["sx", "dx"];
const votoBattle = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

// Campi dei giudici (nome e un voto per ciascun rapper): si costruiscono una volta.
for (const [id, nome] of GIUDICI_BATTLE) {
  const voto = (lato) => el("input", { class: "bt-voto", inputmode: "decimal", autocomplete: "off", placeholder: "?", "data-giudice": id, "data-lato": lato, "aria-label": `Voto di ${nome}, ${lato === "sx" ? "sinistra" : "destra"}` });
  $("#bt-giudici").append(el("input", { class: "bt-nome-giudice", maxlength: "24", "data-nome-giudice": id, "aria-label": `Nome del giudice ${nome}`, value: nome }), voto("sx"), voto("dx"));
}

function disegnaBattle(s) {
  const b = s.battle;
  $("#bt-regia").classList.toggle("attivo", s.layout === "battle");
  const perc = percentuali(b.quota);
  $("#bt-fase").textContent = FASI_BATTLE[b.fase];
  $("#bt-round").textContent = `Round ${b.round}`;
  $("#bt-quota").textContent = `Chat: ${perc.sx}% ${b.sx.nome || "sinistra"} · ${perc.dx}% ${b.dx.nome || "destra"} · ${b.chat.voti} ${b.chat.voti === 1 ? "voto" : "voti"}`;
  aggiornaTempoBattle();

  const attesa = b.fase === "attesa";
  const f = $("#f-bt-scontro");
  riempi(f.sxNome, b.sx.nome);
  riempi(f.sxInstagram, b.sx.instagram ? `@${b.sx.instagram}` : "");
  riempi(f.dxNome, b.dx.nome);
  riempi(f.dxInstagram, b.dx.instagram ? `@${b.dx.instagram}` : "");
  for (const campo of f.elements) campo.disabled = !attesa;
  const inBattle = b.fase === "battle";
  $("#bt-avvia").disabled = !attesa;
  $("#bt-pausa").disabled = !inBattle;
  $("#bt-pausa").textContent = b.timer.fineAlle === null && b.timer.rimanenteMs !== null ? "Riprendi" : "Pausa";
  $("#bt-termina").disabled = !inBattle;
  riempi($("#bt-durata"), b.timer.durataSecondi);
  disegnaModalitaRegia(b);
  disegnaGiudiciRegia(b);
  disegnaTabelloneRegia(s);
  disegnaPopupRegia(s);
}

function aggiornaTempoBattle() {
  if (stato) $("#bt-tempo").textContent = durata(rimanenteBattleMs(stato.battle, conn.ora()));
}
setInterval(aggiornaTempoBattle, 250);

// ----- Modalità: una scelta rapida per ogni voce accesa, il testo (tema o situazione) e l'elenco modificabile -----
function disegnaModalitaRegia(b) {
  const chips = $("#bt-modalita");
  const firma = JSON.stringify([b.modalita.scelta, b.modalita.elenco.map((m) => [m.id, m.nome, m.attiva])]);
  if (chips.dataset.firma !== firma) {
    chips.dataset.firma = firma;
    chips.replaceChildren(
      ...b.modalita.elenco
        .filter((m) => m.attiva)
        .map((m) =>
          el("button", { type: "button", class: m.id === b.modalita.scelta ? "chip scelta" : "chip", "aria-pressed": String(m.id === b.modalita.scelta), onclick: () => invia("battleModalita", { scelta: m.id }) }, m.nome),
        ),
    );
  }
  const scelta = b.modalita.elenco.find((m) => m.id === b.modalita.scelta);
  $("#bt-testo-riga").hidden = !scelta?.conTesto;
  $("#bt-testo").placeholder = scelta ? `${scelta.nome}…` : "";
  riempi($("#bt-testo"), scelta?.testo ?? "");
  disegnaListaModalita(b);
}

function disegnaListaModalita(b, forza = false) {
  const lista = $("#bt-modalita-lista");
  if (!forza && lista.contains(document.activeElement)) return;
  const firma = JSON.stringify(b.modalita.elenco);
  if (!forza && lista.dataset.firma === firma) return;
  lista.dataset.firma = firma;
  lista.replaceChildren(...b.modalita.elenco.map(rigaModalita));
}

function rigaModalita(m = {}) {
  const attiva = el("input", { type: "checkbox", name: "attiva", title: "Selezionabile" });
  attiva.checked = m.attiva !== false;
  const nome = el("input", { name: "nome", maxlength: "24", placeholder: "Nome della modalità" });
  nome.value = m.nome ?? "";
  const conTesto = el("input", { type: "checkbox", name: "conTesto" });
  conTesto.checked = m.conTesto === true;
  return el("li", { "data-id": m.id ?? "", "data-testo": m.testo ?? "" }, attiva, nome, el("label", { class: "interruttore" }, conTesto, " con testo"), el("button", { type: "button", class: "piccolo", "data-togli": "", title: "Togli" }, "✕"));
}

function leggiModalita() {
  return [...$("#bt-modalita-lista").children]
    .map((li) => ({
      id: li.dataset.id || undefined,
      attiva: li.querySelector('[name="attiva"]').checked,
      nome: li.querySelector('[name="nome"]').value,
      conTesto: li.querySelector('[name="conTesto"]').checked,
      testo: li.dataset.testo,
    }))
    .filter((m) => m.id || m.nome.trim());
}

async function salvaModalita() {
  const esito = await invia("battleModalita", { elenco: leggiModalita() });
  if (esito.ok) avviso("Modalità aggiornate", "ok");
  else if (stato) disegnaListaModalita(stato.battle, true);
}

// ----- Giudici: sei voti, Rivela e Proclama -----
function disegnaGiudiciRegia(b) {
  $("#bt-sx-nome-giudici").textContent = b.sx.nome || "Sinistra";
  $("#bt-dx-nome-giudici").textContent = b.dx.nome || "Destra";
  const voto = b.fase === "voto";
  for (const g of b.giudici) {
    riempi($(`[data-nome-giudice="${g.id}"]`), g.nome);
    for (const lato of LATI_BATTLE) {
      const campo = $(`[data-giudice="${g.id}"][data-lato="${lato}"]`);
      campo.disabled = !voto;
      riempi(campo, votoBattle(g.voti[lato]));
    }
  }
  const r = b.fase === "risultato" ? b.risultato : null;
  const pari = Boolean(r?.pari && r.vincitore === null);
  $("#bt-rivela").disabled = !voto;
  for (const lato of LATI_BATTLE) {
    const bottone = $(`#bt-proclama-${lato}`);
    bottone.disabled = !pari;
    bottone.textContent = `Vince ${b[lato].nome || (lato === "sx" ? "sinistra" : "destra")}`;
  }
  $("#bt-prossimo").disabled = !(r && r.vincitore !== null);
  $("#bt-reset").disabled = b.fase === "attesa" || Boolean(r?.registrato);
  $("#bt-esito").textContent = !r ? "" : pari ? "Pari merito: scegliete chi vince." : `Vince ${b[r.vincitore].nome} · ${votoBattle(r.totali.sx)} contro ${votoBattle(r.totali.dx)}`;
}


// ----- Tabellone: torneo (setup e partite) o classifica a punti -----
const righeDiTesto = (testo) => testo.split("\n").map((r) => r.trim()).filter(Boolean);

function disegnaTabelloneRegia(s) {
  const b = s.battle;
  const t = b.tabellone;
  $("#bt-bracket").textContent = s.visibili.bracket ? "Nascondi il tabellone" : "Mostra il tabellone";
  for (const chip of document.querySelectorAll("#bt-modo-tabellone [data-modo]")) {
    const scelto = chip.dataset.modo === t.modo;
    chip.classList.toggle("scelta", scelto);
    chip.setAttribute("aria-pressed", String(scelto));
  }
  $("#bt-torneo-box").hidden = t.modo !== "torneo";
  $("#bt-punti-box").hidden = t.modo !== "punti";

  riempi($("#bt-partecipanti"), t.torneo.partecipanti.map((p) => p.nome).join("\n"));
  $("#bt-torneo-crea").disabled = b.fase !== "attesa";
  $("#bt-torneo-sorteggia").disabled = !t.torneo.partecipanti.length || t.torneo.partite.some((p) => p.vincitore !== null);
  disegnaPartiteRegia(b);

  riempi($("#bt-artisti-punti"), t.punti.artisti.map((a) => a.nome).join("\n"));
  riempi($("#bt-target"), t.punti.target);
  $("#bt-punti-stato").textContent = t.punti.vincitore ? `Ha vinto ${t.punti.vincitore}.` : t.punti.artisti.length ? `Vince chi arriva a ${t.punti.target} punti.` : "";
}

// Elenco delle partite: si ridisegna solo quando cambia qualcosa (così un clic su «Carica» non si perde).
function disegnaPartiteRegia(b) {
  const lista = $("#bt-partite");
  const firma = JSON.stringify([b.tabellone.torneo.partite, b.partitaId, b.fase]);
  if (lista.dataset.firma === firma) return;
  lista.dataset.firma = firma;
  const nome = (r) => r?.nome ?? "—";
  lista.replaceChildren(
    ...b.tabellone.torneo.partite.map((p) => {
      const giocabile = p.sx && p.dx && p.vincitore === null && b.fase === "attesa";
      return el(
        "li",
        { class: p.id === b.partitaId ? "in-campo" : "" },
        el("span", {}, `${p.id.toUpperCase()} · ${nome(p.sx)} contro ${nome(p.dx)}`),
        el("span", { class: "nota" }, p.vincitore ? `Vince ${nome(p[p.vincitore])} (${votoBattle(p.totali.sx)} - ${votoBattle(p.totali.dx)})` : ""),
        el("button", { type: "button", class: "piccolo", ...(giocabile ? {} : { disabled: "" }), onclick: () => invia("torneoCarica", { id: p.id }) }, "Carica"),
      );
    }),
  );
}

// Un elenco scritto a mano non si sovrascrive finché non è stato salvato.
for (const campo of [$("#bt-partecipanti"), $("#bt-artisti-punti")]) campo.addEventListener("input", () => (campo.dataset.modificato = "1"));
const elencoSalvato = (campo) => delete campo.dataset.modificato;

$("#bt-bracket").addEventListener("click", () => stato && invia("tabellone", { visibile: !stato.visibili.bracket }));
for (const chip of document.querySelectorAll("#bt-modo-tabellone [data-modo]")) chip.addEventListener("click", () => invia("tabellone", { modo: chip.dataset.modo }));
$("#bt-torneo-crea").addEventListener("click", async () => {
  const esito = await invia("torneo", { azione: "crea", partecipanti: righeDiTesto($("#bt-partecipanti").value) });
  if (esito.ok) {
    elencoSalvato($("#bt-partecipanti"));
    avviso("Torneo creato", "ok");
  }
});
$("#bt-torneo-sorteggia").addEventListener("click", () => invia("torneo", { azione: "sorteggia" }));
$("#bt-torneo-azzera").addEventListener("click", () => {
  if (confirm("Azzerare il torneo? Si perdono partecipanti e risultati.")) invia("torneo", { azione: "azzera" });
});
$("#bt-punti-salva").addEventListener("click", async () => {
  const esito = await invia("punti", { artisti: righeDiTesto($("#bt-artisti-punti").value) });
  if (esito.ok) {
    elencoSalvato($("#bt-artisti-punti"));
    avviso("Elenco salvato", "ok");
  }
});
$("#bt-target").addEventListener("change", async (e) => {
  const esito = await invia("punti", { target: Number(e.target.value) });
  if (!esito.ok && stato) e.target.value = stato.battle.tabellone.punti.target;
});
$("#bt-punti-azzera").addEventListener("click", () => {
  if (confirm("Azzerare i punti di tutti gli artisti?")) invia("punti", { azzera: true });
});

// ----- Pop-up social -----
function disegnaPopupRegia(s, forza = false) {
  const p = s.battle.popup;
  const lista = $("#bt-popup-lista");
  const firma = JSON.stringify(p.elenco);
  if (forza || (!lista.contains(document.activeElement) && lista.dataset.firma !== firma)) {
    lista.dataset.firma = firma;
    lista.replaceChildren(...p.elenco.map(rigaComparsa));
  }
  const ogni = $("#bt-popup-ogni");
  if (![...ogni.options].some((o) => Number(o.value) === p.ogniMinuti)) ogni.append(el("option", { value: String(p.ogniMinuti) }, `ogni ${p.ogniMinuti} minuti`));
  mostra(ogni, String(p.ogniMinuti));
  riempi($("#bt-popup-durata"), p.durata);
}

async function salvaPopup(elenco = leggiComparse($("#bt-popup-lista"))) {
  if (stato && firmaComparse(elenco) === firmaComparse(stato.battle.popup.elenco)) return;
  const esito = await invia("battlePopup", { elenco });
  if (esito.ok) avviso("Pop-up aggiornati", "ok");
  else if (stato) disegnaPopupRegia(stato, true);
}

// ----- Comandi del battle -----
const battleAvvia = () => invia("battleAvvia");
const battleRivela = () => invia("battleRivela");
const battleProssimo = () => invia("battleProssimo");
const battlePausa = () => stato && invia("battleTimer", { azione: stato.battle.timer.fineAlle !== null ? "pausa" : "riprendi" });
const battleDurata = (secondi) => invia("battleTimer", { durataSecondi: Number(secondi) });

$("#f-bt-scontro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const esito = await invia("battleScontro", { sx: { nome: f.sxNome.value, instagram: f.sxInstagram.value }, dx: { nome: f.dxNome.value, instagram: f.dxInstagram.value } });
  if (esito.ok) {
    salvato(f); // al prossimo stato i campi Instagram mostrano il nome pulito, con la @
    avviso("Scontro pronto", "ok");
  }
});
$("#bt-avvia").addEventListener("click", battleAvvia);
$("#bt-pausa").addEventListener("click", battlePausa);
$("#bt-termina").addEventListener("click", () => invia("battleTermina"));
$("#bt-durata").addEventListener("change", async (e) => {
  const esito = await battleDurata(e.target.value);
  if (!esito.ok && stato) e.target.value = stato.battle.timer.durataSecondi;
});
for (const bottone of document.querySelectorAll("[data-durata]")) bottone.addEventListener("click", () => battleDurata(bottone.dataset.durata));

$("#bt-testo").addEventListener("change", (e) => invia("battleModalita", { testo: e.target.value }));
$("#bt-modalita-lista").addEventListener("change", () => salvaModalita());
$("#bt-modalita-lista").addEventListener("click", (e) => {
  const bottone = e.target.closest("button");
  if (!bottone) return;
  bottone.closest("li").remove();
  salvaModalita();
});
$("#bt-modalita-aggiungi").addEventListener("click", () => {
  const riga = rigaModalita({ attiva: true });
  $("#bt-modalita-lista").append(riga);
  riga.querySelector('[name="nome"]').focus();
});

// Voti dei giudici: si salvano all'uscita dal campo; Invio passa al campo dopo (l'ultimo esce dal campo).
$("#bt-giudici").addEventListener("change", async (e) => {
  const campo = e.target;
  if (campo.dataset.nomeGiudice) return invia("battleGiudici", { [campo.dataset.nomeGiudice]: campo.value });
  if (!campo.dataset.giudice) return;
  const esito = await invia("battleVotoGiudice", { giudice: campo.dataset.giudice, lato: campo.dataset.lato, valore: campo.value });
  if (!esito.ok && stato) disegnaGiudiciRegia(stato.battle);
});
$("#bt-giudici").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.dataset.giudice) return;
  e.preventDefault();
  const campi = [...document.querySelectorAll("#bt-giudici [data-giudice]")];
  (campi[campi.indexOf(e.target) + 1] ?? e.target).focus();
  if (e.target === campi.at(-1)) e.target.blur();
});
$("#bt-rivela").addEventListener("click", battleRivela);
for (const lato of LATI_BATTLE) $(`#bt-proclama-${lato}`).addEventListener("click", () => invia("battleProclama", { lato }));
$("#bt-prossimo").addEventListener("click", battleProssimo);
$("#bt-reset").addEventListener("click", () => {
  if (confirm("Scartare il round in corso? Nomi e numero del round restano.")) invia("battleReset");
});

collegaListaComparse($("#bt-popup-lista"), { mostra: (id) => invia("battlePopup", { id }), salva: () => salvaPopup() });
$("#bt-popup-mostra").addEventListener("click", () => invia("battlePopup", {}));
$("#bt-popup-aggiungi").addEventListener("click", () => {
  const riga = rigaComparsa({ attiva: true, icona: "logo" });
  $("#bt-popup-lista").append(riga);
  riga.querySelector('[name="titolo"]').focus();
});
scegli("#bt-popup-ogni", (v) => invia("battlePopup", { ogniMinuti: Number(v) }));
$("#bt-popup-durata").addEventListener("change", async (e) => {
  const esito = await invia("battlePopup", { durata: Number(e.target.value) });
  if (!esito.ok && stato) e.target.value = stato.battle.popup.durata;
});

// Scorciatoie: funzionano anche col cursore dentro un campo. Con il battle in onda fanno altro (vedi «Scorciatoie»).
addEventListener("keydown", (e) => {
  const inBattle = stato?.layout === "battle";
  const azioni = inBattle ? { F2: battleAvvia, F4: battleRivela, F8: battleProssimo, F9: battlePausa } : { F2: alternaChat, F4: conferma, F8: prossima, F9: alternaPausa };
  const azione = e.key === "Enter" && e.ctrlKey ? (inBattle ? battleRivela : conferma) : azioni[e.key];
  if (!azione || e.repeat) return;
  e.preventDefault();
  azione();
});
