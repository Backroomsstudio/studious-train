// Layout «Battle»: scontro tra due rapper, voto della chat per lato, tre giudici, tabellone a torneo o a punti.
// Solo funzioni sullo stato (stato.battle), senza I/O: il server le chiama, salva su disco e le diffonde.
import { randomUUID } from "node:crypto";
import { oggetto, testo, numeroTra, arrotonda, normalizzaVoto, pulisciInstagram, controllaComparse } from "./validazione.mjs";

export const LATI = ["sx", "dx"];
export const FASI = ["attesa", "countdown", "battle", "voto", "risultato"];
export const GIUDICI_BATTLE = ["luca", "freya", "daniele"];
export const MODI_TABELLONE = ["torneo", "punti"];
// Il 3-2-1 prima del via dura 3 secondi.
export const CONTO_MS = 3000;

export const MAX_NOME = 24;
export const MAX_MODALITA = 10;
export const MAX_POPUP = 8;
const DURATA_MIN = 10;
const DURATA_MAX = 600;
const TARGET_MAX = 1000;

const rapperVuoto = () => ({ nome: "", instagram: "" });
const timerVuoto = (durataSecondi) => ({ durataSecondi, fineAlle: null, rimanenteMs: null, scaduto: false });

export function battleIniziale() {
  const voce = (id, nome, conTesto = false, attiva = true) => ({ id, nome, conTesto, testo: "", attiva });
  return {
    fase: "attesa",
    round: 1,
    partitaId: null,
    sx: rapperVuoto(),
    dx: rapperVuoto(),
    modalita: {
      scelta: "stileLibero",
      elenco: [
        voce("stileLibero", "Stile libero"),
        voce("treQuarti", "Tre quarti"),
        voce("tematica", "Tematica", true),
        voce("anni90", "Anni '90"),
        voce("beatAScelta", "Beat a scelta"),
        voce("situazione", "Situazione", true),
        voce("custom", "", false, false), // slot per le modalità future: si compila dalla regia
      ],
    },
    timer: timerVuoto(90),
    conto: { finoAlle: null },
    chat: { aperta: false, voti: {} },
    giudici: [
      { id: "luca", nome: "Luca", voti: { sx: null, dx: null } },
      { id: "freya", nome: "Freya", voti: { sx: null, dx: null } },
      { id: "daniele", nome: "Daniele", voti: { sx: null, dx: null } },
    ],
    risultato: null,
    tabellone: {
      modo: "torneo",
      torneo: { partecipanti: [], partite: [], campione: null },
      punti: { artisti: [], target: 30, vincitore: null },
    },
    popup: {
      elenco: [
        { id: "backrooms", attiva: true, icona: "logo", sopra: "Backrooms Studio · Vicenza", titolo: "Prenota la tua sessione", sotto: "backroomsstudio.it · @backrooms.studios" },
        // L'handle di Rime Vicentine lo scrive la regia: finché manca, si mostra solo il nome.
        { id: "rime", attiva: true, icona: "instagram", sopra: "Seguici su Instagram", titolo: "Rime Vicentine", sotto: "" },
      ],
      ogniMinuti: 4,
      durata: 10,
    },
  };
}

// ---------- Controlli condivisi da fondiBattle e dalle impostazioni ----------

export function controllaRapper(valore) {
  if (!oggetto(valore)) throw new Error("Rapper: servono nome e Instagram");
  return { nome: testo(valore.nome ?? "", MAX_NOME, "Nome del rapper"), instagram: pulisciInstagram(valore.instagram ?? "") };
}

export function controllaModalita(elenco) {
  if (!Array.isArray(elenco)) throw new Error("Modalità: serve l'elenco");
  if (elenco.length > MAX_MODALITA) throw new Error(`Modalità: al massimo ${MAX_MODALITA}`);
  return elenco.map((m, i) => {
    const n = `Modalità ${i + 1}`;
    if (!oggetto(m)) throw new Error(`${n}: servono nome e testo`);
    const voce = {
      id: typeof m.id === "string" && m.id ? m.id.slice(0, 40) : randomUUID(),
      nome: testo(m.nome ?? "", MAX_NOME, `${n} (nome)`),
      conTesto: m.conTesto === true,
      testo: testo(m.testo ?? "", 40, `${n} (testo)`),
      attiva: m.attiva !== false,
    };
    if (voce.attiva && !voce.nome) throw new Error(`${n}: manca il nome`);
    return voce;
  });
}

const ora = (x) => typeof x === "number" && Number.isFinite(x);
const oraONulla = (x) => x === null || ora(x);

function controllaTimer(t) {
  if (!oggetto(t)) throw new Error("Timer: forma non valida");
  // I campi che mancano prendono il valore di partenza; quelli presenti ma sbagliati invalidano tutto il timer.
  const { fineAlle = null, rimanenteMs = null, scaduto = false } = t;
  if (!oraONulla(fineAlle) || !oraONulla(rimanenteMs) || typeof scaduto !== "boolean") throw new Error("Timer: valori non validi");
  return { durataSecondi: numeroTra(t.durataSecondi, DURATA_MIN, DURATA_MAX, "Durata del round (secondi)"), fineAlle, rimanenteMs, scaduto };
}

function controllaChat(c) {
  if (!oggetto(c) || typeof c.aperta !== "boolean" || !oggetto(c.voti)) throw new Error("Chat: forma non valida");
  const voti = {};
  for (const [chiave, lato] of Object.entries(c.voti)) if (LATI.includes(lato)) voti[chiave] = lato;
  return { aperta: c.aperta, voti };
}

function controllaGiudici(lista) {
  if (!Array.isArray(lista) || lista.length !== GIUDICI_BATTLE.length) throw new Error("Giudici: ne servono tre");
  return lista.map((g, i) => {
    if (!oggetto(g) || g.id !== GIUDICI_BATTLE[i] || !oggetto(g.voti)) throw new Error("Giudici: forma non valida");
    return { id: g.id, nome: testo(g.nome, MAX_NOME, "Nome del giudice", { obbligatorio: true }), voti: { sx: normalizzaVoto(g.voti.sx), dx: normalizzaVoto(g.voti.dx) } };
  });
}

function controllaCoppia(c) {
  if (!oggetto(c) || !ora(c.sx) || !ora(c.dx)) throw new Error("Risultato: coppia di valori non valida");
  return { sx: c.sx, dx: c.dx };
}

function controllaRisultato(r) {
  if (r === null) return null;
  if (!oggetto(r) || !ora(r.rivelatoAlle) || typeof r.pari !== "boolean" || typeof r.registrato !== "boolean" || !oggetto(r.parziali)) throw new Error("Risultato: forma non valida");
  if (r.vincitore !== null && !LATI.includes(r.vincitore)) throw new Error("Risultato: vincitore non valido");
  const parziali = {};
  for (const chiave of [...GIUDICI_BATTLE, "chat"]) parziali[chiave] = controllaCoppia(r.parziali[chiave]);
  return { rivelatoAlle: r.rivelatoAlle, totali: controllaCoppia(r.totali), parziali, vincitore: r.vincitore, pari: r.pari, registrato: r.registrato };
}

const personaONulla = (p) => (p === null ? null : controllaRapper(p));

function controllaPartita(p) {
  if (!oggetto(p) || typeof p.id !== "string" || !["quarti", "semifinali", "finale"].includes(p.turno)) throw new Error("Partita: forma non valida");
  if (p.vincitore !== null && !LATI.includes(p.vincitore)) throw new Error("Partita: vincitore non valido");
  return { id: p.id, turno: p.turno, sx: personaONulla(p.sx), dx: personaONulla(p.dx), vincitore: p.vincitore, totali: p.totali === null ? null : controllaCoppia(p.totali) };
}

function controllaTabellone(t) {
  if (!oggetto(t) || !MODI_TABELLONE.includes(t.modo) || !oggetto(t.torneo) || !oggetto(t.punti)) throw new Error("Tabellone: forma non valida");
  const { torneo, punti } = t;
  if (!Array.isArray(torneo.partecipanti) || !Array.isArray(torneo.partite) || !Array.isArray(punti.artisti)) throw new Error("Tabellone: elenchi non validi");
  if (torneo.campione !== null && !oggetto(torneo.campione)) throw new Error("Tabellone: campione non valido");
  if (punti.vincitore !== null && typeof punti.vincitore !== "string") throw new Error("Tabellone: vincitore dei punti non valido");
  return {
    modo: t.modo,
    torneo: { partecipanti: torneo.partecipanti.map(controllaRapper), partite: torneo.partite.map(controllaPartita), campione: torneo.campione === null ? null : controllaRapper(torneo.campione) },
    punti: {
      artisti: punti.artisti.map((a) => {
        if (!oggetto(a) || !ora(a.punti) || !Array.isArray(a.round) || !a.round.every(ora)) throw new Error("Punti: artista non valido");
        return { nome: testo(a.nome, MAX_NOME, "Nome dell'artista", { obbligatorio: true }), punti: a.punti, round: a.round };
      }),
      target: numeroTra(punti.target, 1, TARGET_MAX, "Target della classifica"),
      vincitore: punti.vincitore,
    },
  };
}

function controllaPopup(p) {
  if (!oggetto(p)) throw new Error("Pop-up: forma non valida");
  return {
    elenco: controllaComparse(p.elenco, MAX_POPUP, { elenco: "Pop-up", voce: "Pop-up" }),
    ogniMinuti: numeroTra(p.ogniMinuti, 0, 30, "Pop-up automatici (minuti)"),
    durata: numeroTra(p.durata, 4, 20, "Durata del pop-up (secondi)"),
  };
}

function controllaModalitaScelta(m) {
  if (!oggetto(m)) throw new Error("Modalità: forma non valida");
  const elenco = controllaModalita(m.elenco);
  if (!elenco.some((v) => v.id === m.scelta && v.attiva)) throw new Error("Modalità: la scelta non è nell'elenco");
  return { scelta: m.scelta, elenco };
}

// Un controllo per chiave di primo livello: restituisce il valore pulito o lancia.
const CONTROLLI = {
  fase: (v) => {
    if (!FASI.includes(v)) throw new Error("Fase non valida");
    return v;
  },
  round: (v) => {
    if (!Number.isInteger(v) || v < 1) throw new Error("Round non valido");
    return v;
  },
  partitaId: (v) => {
    if (v !== null && (typeof v !== "string" || v.length > 40)) throw new Error("Partita non valida");
    return v;
  },
  sx: controllaRapper,
  dx: controllaRapper,
  modalita: controllaModalitaScelta,
  timer: controllaTimer,
  conto: (v) => {
    if (!oggetto(v) || !oraONulla(v.finoAlle)) throw new Error("Conto non valido");
    return { finoAlle: v.finoAlle };
  },
  chat: controllaChat,
  giudici: controllaGiudici,
  risultato: controllaRisultato,
  tabellone: controllaTabellone,
  popup: controllaPopup,
};

// Stato salvato da una versione senza battle, o con valori rotti: partenza completa, i valori buoni restano.
export function fondiBattle(salvato) {
  const base = battleIniziale();
  if (!oggetto(salvato)) return base;
  for (const [chiave, controlla] of Object.entries(CONTROLLI)) {
    if (salvato[chiave] === undefined) continue;
    try {
      base[chiave] = controlla(salvato[chiave]);
    } catch {
      // valore non valido: resta il predefinito
    }
  }
  return base;
}

// ---------- Chat ----------

const RE_LATO = /^!?(1|sx|2|dx)$/i;

// Commenti che votano: «1» o «sx» per il rapper di sinistra, «2» o «dx» per quello di destra (con «!» facoltativo).
export function leggiVotoBattle(commento) {
  const m = String(commento ?? "").trim().match(RE_LATO);
  if (!m) return null;
  return /^(1|sx)$/i.test(m[1]) ? "sx" : "dx";
}

// Un voto per utente: se riscrive, vale l'ultimo. Fuori dalla finestra di voto (chat chiusa) non conta.
export function votoChatBattle(stato, { piattaforma, utente }, lato, _ora) {
  const chat = stato.battle.chat;
  if (!chat.aperta || !utente || !LATI.includes(lato)) return false;
  chat.voti[`${piattaforma}:${String(utente).toLowerCase()}`] = lato;
  return true;
}

function conteggi(chat) {
  let sx = 0;
  let dx = 0;
  for (const lato of Object.values(chat.voti)) lato === "sx" ? sx++ : dx++;
  return { sx, dx, voti: sx + dx };
}

// Quota di ciascun lato sul totale dei voti; senza voti 50/50.
export function quota(chat) {
  const { sx, dx, voti } = conteggi(chat);
  return voti === 0 ? { sx: 0.5, dx: 0.5, voti: 0 } : { sx: sx / voti, dx: dx / voti, voti };
}

// ---------- Punteggio ----------

// Totale di ciascun lato = media di Luca, Freya, Daniele e chat (10 × quota), 25% ciascuno.
export function calcolaRisultato(battle) {
  const parziali = {};
  for (const g of battle.giudici) {
    if (g.voti.sx === null || g.voti.dx === null) throw new Error(`Mancano i voti di ${g.nome}`);
    parziali[g.id] = { sx: g.voti.sx, dx: g.voti.dx };
  }
  const q = quota(battle.chat);
  parziali.chat = { sx: arrotonda(10 * q.sx, 2), dx: arrotonda(10 * q.dx, 2) };
  const grezzo = (lato) => GIUDICI_BATTLE.concat("chat").reduce((somma, chiave) => somma + parziali[chiave][lato], 0) / 4;
  const totali = { sx: arrotonda(grezzo("sx"), 2), dx: arrotonda(grezzo("dx"), 2) };
  const pari = Math.abs(grezzo("sx") - grezzo("dx")) < 0.005;
  return { parziali, totali, pari, vincitore: pari ? null : totali.sx > totali.dx ? "sx" : "dx" };
}

// Quello che ricevono pagine e regia: senza la mappa dei voti della chat (migliaia di righe a ogni aggiornamento).
export function istantaneaBattle(battle) {
  const { chat, ...resto } = battle;
  const c = conteggi(chat);
  return { ...resto, chat: { aperta: chat.aperta, sx: c.sx, dx: c.dx, voti: c.voti }, quota: quota(chat) };
}

// ---------- Impostazioni dalla regia ----------
// Si controlla tutto su una copia: un errore non lascia metà modifica (come impostaStudio).

// Nomi e Instagram dei due rapper. Si cambiano tra un round e l'altro: a round avviato servono un Reset.
export function impostaScontro(stato, { sx, dx } = {}) {
  const b = stato.battle;
  if (b.fase !== "attesa") throw new Error("Cambia i nomi prima di avviare il round (usa Reset)");
  const nuovi = { sx: { ...b.sx }, dx: { ...b.dx } };
  for (const [lato, modifica] of [["sx", sx], ["dx", dx]]) {
    if (modifica === undefined) continue;
    if (!oggetto(modifica)) throw new Error("Rapper: servono nome e Instagram");
    if (modifica.nome !== undefined) nuovi[lato].nome = testo(modifica.nome, MAX_NOME, "Nome del rapper");
    if (modifica.instagram !== undefined) nuovi[lato].instagram = pulisciInstagram(modifica.instagram);
  }
  b.sx = nuovi.sx;
  b.dx = nuovi.dx;
}

// Modalità di gioco: l'elenco (massimo 10, si possono aggiungere voci), quella in onda e il suo testo (tema o situazione).
export function impostaModalita(stato, { scelta, testo: nuovoTesto, elenco } = {}) {
  const m = JSON.parse(JSON.stringify(stato.battle.modalita));
  if (elenco !== undefined) m.elenco = controllaModalita(elenco);
  if (scelta !== undefined) {
    if (!m.elenco.some((v) => v.id === scelta && v.attiva)) throw new Error("Modalità non trovata o spenta");
    m.scelta = scelta;
  }
  const inOnda = m.elenco.find((v) => v.id === m.scelta && v.attiva);
  if (!inOnda) throw new Error("La modalità in onda deve restare nell'elenco e accesa: scegline un'altra");
  if (nuovoTesto !== undefined) {
    if (!inOnda.conTesto) throw new Error("Questa modalità non ha testo");
    inOnda.testo = testo(nuovoTesto, 40, "Testo della modalità");
  }
  stato.battle.modalita = m;
}

// Durata del prossimo round: il round in corso non cambia.
export function impostaTimer(stato, { durataSecondi } = {}) {
  stato.battle.timer.durataSecondi = numeroTra(durataSecondi, DURATA_MIN, DURATA_MAX, "Durata del round (secondi)");
}

export function impostaGiudici(stato, nomi = {}) {
  const nuovi = {};
  for (const id of GIUDICI_BATTLE) if (nomi[id] !== undefined) nuovi[id] = testo(nomi[id], MAX_NOME, "Nome del giudice", { obbligatorio: true });
  for (const g of stato.battle.giudici) if (nuovi[g.id] !== undefined) g.nome = nuovi[g.id];
}

// Pop-up sociali: stessi pannelli delle comparse dello studio (icona, riga sopra, titolo, riga sotto).
export function impostaPopup(stato, { elenco, ogniMinuti, durata } = {}) {
  const p = JSON.parse(JSON.stringify(stato.battle.popup));
  if (elenco !== undefined) p.elenco = controllaComparse(elenco, MAX_POPUP, { elenco: "Pop-up", voce: "Pop-up" });
  if (ogniMinuti !== undefined) p.ogniMinuti = numeroTra(ogniMinuti, 0, 30, "Pop-up automatici (minuti)");
  if (durata !== undefined) p.durata = numeroTra(durata, 4, 20, "Durata del pop-up (secondi)");
  stato.battle.popup = p;
}

// Nuova serata: round, chat, voti, risultato e tabellone ripartono da zero; nomi dei giudici, modalità,
// durata del timer e pop-up restano quelli scelti.
export function battleNuovaSerata(battle) {
  const base = battleIniziale();
  return {
    ...base,
    giudici: base.giudici.map((g, i) => ({ ...g, nome: battle.giudici[i].nome })),
    modalita: battle.modalita,
    timer: timerVuoto(battle.timer.durataSecondi),
    popup: battle.popup,
  };
}

// ---------- Fasi del round ----------
// attesa → countdown (3-2-1) → battle → voto → risultato. Gli eventi `gong` li emette il server (e li suonano le pagine).

const gong = (quando) => ({ nome: "gong", dati: { quando } });

// Avvia il 3-2-1. Il tabellone si spegne da solo: durante il round tutto lo schermo è dei rapper.
export function avvia(stato, ora) {
  const b = stato.battle;
  if (b.fase !== "attesa") throw new Error("Il round è già avviato");
  if (!b.sx.nome || !b.dx.nome) throw new Error("Mancano i nomi dei rapper");
  if (b.sx.nome.toLowerCase() === b.dx.nome.toLowerCase()) throw new Error("I due rapper devono avere nomi diversi");
  b.fase = "countdown";
  b.conto.finoAlle = ora + CONTO_MS;
  stato.visibili.bracket = false;
}

function chiudiRound(stato) {
  const b = stato.battle;
  b.fase = "voto";
  b.chat.aperta = false;
  b.timer = { durataSecondi: b.timer.durataSecondi, fineAlle: null, rimanenteMs: null, scaduto: true };
  return [gong("fine")];
}

// Controllo a tempo del server (ogni 250 ms): fine del 3-2-1 e fine del timer. Dopo un riavvio lungo il timer riparte
// da ora (non scade subito) e un round già scaduto chiude con un solo gong.
export function passaSeTocca(stato, ora) {
  const b = stato.battle;
  if (b.fase === "countdown" && b.conto.finoAlle !== null && ora >= b.conto.finoAlle) {
    b.fase = "battle";
    b.conto.finoAlle = null;
    b.timer = { durataSecondi: b.timer.durataSecondi, fineAlle: ora + b.timer.durataSecondi * 1000, rimanenteMs: null, scaduto: false };
    b.chat.aperta = true;
    return [gong("inizio")];
  }
  if (b.fase === "battle" && b.timer.fineAlle !== null && ora >= b.timer.fineAlle) return chiudiRound(stato);
  return [];
}

// Fine anticipata del round (anche con il timer in pausa).
export function termina(stato, _ora) {
  if (stato.battle.fase !== "battle") throw new Error("Il round non è in corso");
  return chiudiRound(stato);
}

export function timerAzione(stato, azione, ora) {
  const b = stato.battle;
  if (b.fase !== "battle") throw new Error("Il timer si ferma solo durante il battle");
  const t = b.timer;
  if (azione === "pausa") {
    if (t.fineAlle !== null) b.timer = { ...t, fineAlle: null, rimanenteMs: Math.max(0, t.fineAlle - ora) };
  } else if (azione === "riprendi") {
    if (t.rimanenteMs !== null) b.timer = { ...t, fineAlle: ora + t.rimanenteMs, rimanenteMs: null };
  } else {
    throw new Error("Azione del timer non valida: pausa o riprendi");
  }
}

// Voto di un giudice a uno dei due rapper; si scrive a fine round, prima di rivelare.
export function votoGiudice(stato, { giudice, lato, valore }) {
  const b = stato.battle;
  if (b.fase !== "voto") throw new Error("I voti dei giudici si scrivono a fine round");
  const g = b.giudici.find((x) => x.id === giudice);
  if (!g) throw new Error("Giudice sconosciuto: luca, freya o daniele");
  if (!LATI.includes(lato)) throw new Error("Lato non valido: sx o dx");
  g.voti[lato] = normalizzaVoto(valore);
}

// Segna il round come registrato (una volta sola). Torneo e classifica a punti si aggiornano da qui.
export function registraRound(stato) {
  const r = stato.battle.risultato;
  if (!r || r.registrato) return;
  r.registrato = true;
}

// Calcola i totali e mostra il risultato. Con un pari merito il round resta aperto finché la regia non proclama.
export function rivela(stato, ora) {
  const b = stato.battle;
  if (b.fase !== "voto") throw new Error("Si rivela a fine round, dopo i voti dei giudici");
  const r = calcolaRisultato(b);
  b.fase = "risultato";
  b.risultato = { rivelatoAlle: ora, totali: r.totali, parziali: r.parziali, vincitore: r.vincitore, pari: r.pari, registrato: false };
  if (!r.pari) registraRound(stato);
  return { vincitore: r.vincitore, pari: r.pari };
}

export function proclamaBattle(stato, lato) {
  const r = stato.battle.risultato;
  if (stato.battle.fase !== "risultato" || !r?.pari || r.vincitore !== null) throw new Error("Il round non è in pari merito");
  if (!LATI.includes(lato)) throw new Error("Scegli il vincitore: sx o dx");
  r.vincitore = lato;
  registraRound(stato);
}

// Torna ad «attesa» scartando chat, voti, timer e risultato (nomi, round e partita restano a chi li chiama).
function azzeraRound(b) {
  b.fase = "attesa";
  b.chat = { aperta: false, voti: {} };
  for (const g of b.giudici) g.voti = { sx: null, dx: null };
  b.risultato = null;
  b.conto.finoAlle = null;
  b.timer = timerVuoto(b.timer.durataSecondi);
}

// Scontro successivo: nomi svuotati, così uno scontro vecchio non va in onda per errore.
export function prossimo(stato) {
  const b = stato.battle;
  if (b.fase !== "risultato") throw new Error("Il round non è finito");
  if (b.risultato.vincitore === null) throw new Error("Proclama prima il vincitore");
  azzeraRound(b);
  b.round += 1;
  b.sx = rapperVuoto();
  b.dx = rapperVuoto();
  b.partitaId = null;
}

// Scarta il round in corso e rimette i due rapper in attesa; un round già registrato non si annulla.
export function reset(stato) {
  const b = stato.battle;
  if (b.fase === "risultato" && b.risultato?.registrato) throw new Error("Il round è già registrato: usa Prossimo scontro");
  azzeraRound(b);
}
