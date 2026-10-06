// Layout «Battle»: scontro tra due rapper, voto della chat per lato, tre giudici, tabellone a torneo o a punti.
// Solo funzioni sullo stato (stato.battle), senza I/O: il server le chiama, salva su disco e le diffonde.
import { randomUUID } from "node:crypto";
import { oggetto, testo, numeroTra, siNo, arrotonda, normalizzaVoto, pulisciInstagram, controllaComparse } from "./validazione.mjs";

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

// Un commento della chat TikTok: vale come voto solo se è «1», «2», «sx» o «dx».
export function votoDaCommento(stato, { piattaforma, utente, testo: commento }, ora) {
  const lato = leggiVotoBattle(commento);
  return lato !== null && votoChatBattle(stato, { piattaforma, utente }, lato, ora);
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
  const media = (lato) => GIUDICI_BATTLE.concat("chat").reduce((somma, chiave) => somma + parziali[chiave][lato], 0) / 4;
  const totali = { sx: arrotonda(media("sx"), 2), dx: arrotonda(media("dx"), 2) };
  // Si decide su quello che si vede: due totali uguali sullo schermo sono un pari merito, e con totali diversi vince sempre il più alto.
  const pari = totali.sx === totali.dx;
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
  // Se sul palco non ci sono più i due rapper della partita caricata (sostituto, errore di battitura), la partita non è
  // più quella: il risultato non va a un torneo che non c'entra. Scambiare i lati va bene: contano i nomi.
  const caricata = b.partitaId && b.tabellone.torneo.partite.find((x) => x.id === b.partitaId);
  if (caricata && !stessiRapper(caricata, b)) b.partitaId = null;
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

// Registra il round una volta sola nel tabellone attivo (torneo o classifica a punti).
export function registraRound(stato) {
  const b = stato.battle;
  if (!b.risultato || b.risultato.registrato) return;
  b.risultato.registrato = true;
  if (b.tabellone.modo === "torneo") registraInTorneo(b);
  else registraInPunti(b);
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
  // Con il torneo attivo il prossimo scontro giocabile (entrambi i rapper noti, non ancora giocato) si carica da solo.
  if (b.tabellone.modo === "torneo") {
    const prossima = b.tabellone.torneo.partite.find((p) => p.sx && p.dx && p.vincitore === null);
    if (prossima) caricaPartita(stato, prossima.id);
  }
}

// Scarta il round in corso e rimette i due rapper in attesa; un round già registrato non si annulla.
export function reset(stato) {
  const b = stato.battle;
  if (b.fase === "risultato" && b.risultato?.registrato) throw new Error("Il round è già registrato: usa Prossimo scontro");
  azzeraRound(b);
}

// ---------- Tabellone: torneo e classifica a punti ----------

const MAX_ARTISTI_PUNTI = 10;
// Dove va il vincitore di una partita: [partita successiva, lato].
const AVANZA = { q1: ["s1", "sx"], q2: ["s1", "dx"], q3: ["s2", "sx"], q4: ["s2", "dx"], s1: ["f1", "sx"], s2: ["f1", "dx"] };

export function impostaTabellone(stato, { modo, visibile } = {}) {
  if (modo !== undefined && !MODI_TABELLONE.includes(modo)) throw new Error("Tabellone: torneo o punti");
  const mostra = visibile !== undefined ? siNo(visibile, "Tabellone visibile") : undefined;
  if (modo !== undefined) stato.battle.tabellone.modo = modo;
  if (mostra !== undefined) stato.visibili.bracket = mostra;
}

// Nomi unici senza distinguere le maiuscole: la classifica e il torneo riconoscono i rapper dal nome.
function nomiUnici(nomi) {
  const visti = new Set();
  for (const nome of nomi) {
    const chiave = nome.toLowerCase();
    if (visti.has(chiave)) throw new Error("Nomi duplicati");
    visti.add(chiave);
  }
}

const copia = (persona) => (persona === null ? null : { ...persona });

function costruisciPartite(p) {
  const partita = (id, turno, sx = null, dx = null) => ({ id, turno, sx: copia(sx), dx: copia(dx), vincitore: null, totali: null });
  const finali = [partita("s1", "semifinali"), partita("s2", "semifinali"), partita("f1", "finale")];
  if (p.length === 4) return [partita("s1", "semifinali", p[0], p[1]), partita("s2", "semifinali", p[2], p[3]), finali[2]];
  return [
    partita("q1", "quarti", p[0], p[1]),
    partita("q2", "quarti", p[2], p[3]),
    partita("q3", "quarti", p[4], p[5]),
    partita("q4", "quarti", p[6], p[7]),
    ...finali,
  ];
}

// 4 o 8 partecipanti, accoppiati 1-2, 3-4, 5-6, 7-8. Si crea tra un round e l'altro.
export function creaTorneo(stato, partecipanti) {
  const b = stato.battle;
  if (b.fase !== "attesa") throw new Error("Il torneo si crea tra un round e l'altro");
  if (!Array.isArray(partecipanti) || ![4, 8].includes(partecipanti.length)) throw new Error("Servono 4 o 8 partecipanti");
  const persone = partecipanti.map((p, i) => {
    const persona = controllaRapper(typeof p === "string" ? { nome: p } : p);
    if (!persona.nome) throw new Error(`Partecipante ${i + 1}: manca il nome`);
    return persona;
  });
  nomiUnici(persone.map((p) => p.nome));
  b.tabellone.torneo = { partecipanti: persone, partite: costruisciPartite(persone), campione: null };
  b.partitaId = null;
}

export function sorteggiaTorneo(stato, caso = Math.random) {
  const torneo = stato.battle.tabellone.torneo;
  if (!torneo.partecipanti.length) throw new Error("Crea prima il torneo");
  if (torneo.partite.some((p) => p.vincitore !== null)) throw new Error("Il torneo è già iniziato: azzeralo per sorteggiare di nuovo");
  if (stato.battle.fase !== "attesa") throw new Error("Si sorteggia tra un round e l'altro");
  const mescolati = [...torneo.partecipanti];
  for (let i = mescolati.length - 1; i > 0; i--) {
    const j = Math.floor(caso() * (i + 1));
    [mescolati[i], mescolati[j]] = [mescolati[j], mescolati[i]];
  }
  stato.battle.tabellone.torneo = { partecipanti: mescolati, partite: costruisciPartite(mescolati), campione: null };
  stato.battle.partitaId = null; // le partite sono altre: quella caricata non esiste più
}

export function azzeraTorneo(stato) {
  stato.battle.tabellone.torneo = { partecipanti: [], partite: [], campione: null };
  if (stato.battle.fase === "attesa") stato.battle.partitaId = null;
}

// Mette in campo una partita del torneo: i due rapper vanno nei lati sinistro e destro.
export function caricaPartita(stato, id) {
  const b = stato.battle;
  if (b.fase !== "attesa") throw new Error("Carica la partita prima di avviare il round");
  const p = b.tabellone.torneo.partite.find((x) => x.id === id);
  if (!p) throw new Error("Partita non trovata");
  if (!p.sx || !p.dx) throw new Error("La partita non è ancora definita");
  if (p.vincitore !== null) throw new Error("La partita è già stata giocata");
  impostaScontro(stato, { sx: p.sx, dx: p.dx });
  b.partitaId = id;
}

// Scrive l'esito di una partita e porta il vincitore alla successiva (dopo la finale, il campione).
function esitoPartita(torneo, id, lato, totali) {
  const p = torneo.partite.find((x) => x.id === id);
  if (!p) return;
  p.vincitore = lato;
  p.totali = { ...totali };
  const vincitore = copia(p[lato]);
  if (p.id === "f1") torneo.campione = vincitore;
  const destinazione = AVANZA[p.id];
  if (destinazione) torneo.partite.find((x) => x.id === destinazione[0])[destinazione[1]] = vincitore;
}

const minuscolo = (persona) => persona?.nome.toLowerCase() ?? null;

// I due nomi sul palco sono quelli della partita (in qualunque ordine, senza distinguere le maiuscole).
function stessiRapper(partita, b) {
  const nomi = [minuscolo(partita.sx), minuscolo(partita.dx)].sort();
  return nomi.join("|") === [b.sx.nome.toLowerCase(), b.dx.nome.toLowerCase()].sort().join("|");
}

// Il risultato segue i rapper, non i lati del palco: chi vince avanza anche se nella partita sta dall'altra parte.
function registraInTorneo(b) {
  const p = b.partitaId && b.tabellone.torneo.partite.find((x) => x.id === b.partitaId);
  if (!p) return;
  const r = b.risultato;
  const vinceSulPalco = r.vincitore;
  const altroSulPalco = vinceSulPalco === "sx" ? "dx" : "sx";
  const latoVincitore = LATI.find((l) => minuscolo(p[l]) === b[vinceSulPalco].nome.toLowerCase());
  if (!latoVincitore) return; // il vincitore non gioca questa partita
  const latoAltro = latoVincitore === "sx" ? "dx" : "sx";
  esitoPartita(b.tabellone.torneo, p.id, latoVincitore, { [latoVincitore]: r.totali[vinceSulPalco], [latoAltro]: r.totali[altroSulPalco] });
}

// Classifica a punti: elenco di artisti (massimo 10) e target. Gli artisti si possono dare con punti di partenza.
export function impostaPunti(stato, { artisti, target, azzera } = {}) {
  const p = JSON.parse(JSON.stringify(stato.battle.tabellone.punti));
  if (artisti !== undefined) {
    if (!Array.isArray(artisti)) throw new Error("Classifica: serve l'elenco degli artisti");
    if (artisti.length > MAX_ARTISTI_PUNTI) throw new Error(`Classifica: al massimo ${MAX_ARTISTI_PUNTI} artisti`);
    const attuali = p.artisti;
    p.artisti = artisti.map((a, i) => {
      const dati = typeof a === "string" ? { nome: a } : a;
      if (!oggetto(dati)) throw new Error(`Artista ${i + 1}: serve il nome`);
      const nome = testo(dati.nome, MAX_NOME, `Artista ${i + 1}`, { obbligatorio: true });
      // Chi c'è già e non ha punti dati a mano tiene punti e round: rimettere l'elenco non azzera la serata.
      const presente = dati.punti === undefined ? attuali.find((x) => x.nome.toLowerCase() === nome.toLowerCase()) : null;
      if (presente) return { nome, punti: presente.punti, round: presente.round };
      const punti = dati.punti === undefined ? 0 : Number(dati.punti);
      if (!Number.isFinite(punti) || punti < 0) throw new Error(`Artista ${i + 1}: punti non validi`);
      return { nome, punti: arrotonda(punti, 2), round: [] };
    });
    nomiUnici(p.artisti.map((a) => a.nome));
  }
  if (target !== undefined) p.target = numeroTra(target, 1, TARGET_MAX, "Target della classifica");
  if (azzera === true) {
    p.artisti = p.artisti.map((a) => ({ ...a, punti: 0, round: [] }));
    p.vincitore = null;
  }
  stato.battle.tabellone.punti = p;
}

// Somma il totale del round a entrambi i rapper presenti in classifica (gli altri si ignorano).
// Vince il primo che raggiunge il target; se in due nello stesso round, il totale del round più alto,
// poi i punti complessivi, poi il lato che ha vinto il round.
function registraInPunti(b) {
  const punti = b.tabellone.punti;
  const r = b.risultato;
  const raggiunti = [];
  for (const lato of LATI) {
    const artista = punti.artisti.find((a) => a.nome.toLowerCase() === b[lato].nome.toLowerCase());
    if (!artista) continue;
    artista.round.push(r.totali[lato]);
    artista.punti = arrotonda(artista.punti + r.totali[lato], 2);
    if (artista.punti >= punti.target) raggiunti.push({ lato, artista });
  }
  if (punti.vincitore !== null || !raggiunti.length) return;
  raggiunti.sort((x, y) => r.totali[y.lato] - r.totali[x.lato] || y.artista.punti - x.artista.punti || (x.lato === r.vincitore ? -1 : 1));
  punti.vincitore = raggiunti[0].artista.nome;
}

// ---------- Dati di prova (mockup, pulsanti Prova della regia) ----------

export const FASI_DEMO = ["attesa", "countdown", "battle", "voto", "risultato", "pari", "torneo", "punti"];

const ROUND_DEMO = [
  ["Lince", [7.25, 7.5, 7.75]],
  ["Kappa", [6.5, 6.75, 7]],
  ["Nove", [5.75, 5.5, 6.25]],
  ["Mira", [4.5, 4.75, 4.75]],
  ["Dama", [3.5, 4, 4]],
];

// Riempie lo stato con dati realistici nella fase chiesta, tenendo la configurazione già scelta
// (nomi dei giudici, modalità, durata, pop-up). Con `secondi` si sceglie il tempo rimasto nel battle.
export function battleDemo(stato, fase, ora, { secondi = 47 } = {}) {
  if (!FASI_DEMO.includes(fase)) throw new Error(`Fase di prova sconosciuta: ${FASI_DEMO.join(", ")}`);
  stato.battle = battleNuovaSerata(stato.battle);
  stato.visibili.bracket = false;
  const b = stato.battle;
  b.sx = { nome: "Lince", instagram: "lince.music" };
  b.dx = { nome: "Nove", instagram: "nove.mc" };
  if (b.modalita.elenco.some((m) => m.id === "tematica" && m.attiva)) impostaModalita(stato, { scelta: "tematica", testo: "Vicenza di notte" });
  const chat = (sx, dx) => {
    b.chat.voti = {};
    for (let i = 0; i < sx; i++) b.chat.voti[`demo:s${i}`] = "sx";
    for (let i = 0; i < dx; i++) b.chat.voti[`demo:d${i}`] = "dx";
  };
  const voti = (sx, dx) => b.giudici.forEach((g, i) => (g.voti = { sx: sx[i], dx: dx[i] }));
  const scaduto = () => (b.timer = { durataSecondi: b.timer.durataSecondi, fineAlle: null, rimanenteMs: null, scaduto: true });

  if (fase === "countdown") {
    b.fase = "countdown";
    b.conto.finoAlle = ora + 60_000;
  } else if (fase === "battle") {
    b.fase = "battle";
    b.timer = { durataSecondi: b.timer.durataSecondi, fineAlle: ora + secondi * 1000, rimanenteMs: null, scaduto: false };
    b.chat.aperta = true;
    chat(22, 15);
  } else if (fase === "voto") {
    b.fase = "voto";
    scaduto();
    chat(22, 15);
  } else if (fase === "risultato" || fase === "pari") {
    b.fase = "risultato";
    scaduto();
    if (fase === "risultato") {
      chat(22, 15);
      voti([8, 8, 8], [6, 6, 6]);
    } else {
      chat(20, 20);
      voti([8, 7, 9], [7, 8, 9]);
    }
    const r = calcolaRisultato(b);
    b.risultato = { rivelatoAlle: ora - 60_000, totali: r.totali, parziali: r.parziali, vincitore: r.vincitore, pari: r.pari, registrato: fase === "risultato" };
  } else if (fase === "torneo") {
    creaTorneo(stato, [{ nome: "Lince", instagram: "lince.music" }, "Nove", "Kappa", "Mira", "Dama", "Rizzo", "Sole", "Vale"]);
    const torneo = b.tabellone.torneo;
    esitoPartita(torneo, "q1", "sx", { sx: 7.5, dx: 6.25 });
    esitoPartita(torneo, "q2", "dx", { sx: 5.5, dx: 7 });
    esitoPartita(torneo, "q3", "sx", { sx: 7.75, dx: 6 });
    esitoPartita(torneo, "q4", "dx", { sx: 6.5, dx: 7.25 });
    b.tabellone.modo = "torneo";
    caricaPartita(stato, "s1");
  } else if (fase === "punti") {
    b.tabellone.modo = "punti";
    b.tabellone.punti = {
      artisti: ROUND_DEMO.map(([nome, round]) => ({ nome, punti: arrotonda(round.reduce((a, x) => a + x, 0), 2), round })),
      target: 30,
      vincitore: null,
    };
  }
  if (fase === "torneo" || fase === "punti") stato.visibili.bracket = true;
}
