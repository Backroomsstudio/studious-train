// Logica della serata: voto dei giudici (uno per categoria), voto della chat, totale, classifica,
// countdown e spareggio. Solo funzioni sullo stato, senza I/O: il server le chiama e salva su disco.
import { randomUUID } from "node:crypto";

export const CATEGORIE = ["beat", "voce", "mix"];
export const WIDGET = ["premio", "tabellone", "classifica", "timer"];
export const DOVE_SUONI = ["overlay", "regia", "spenti"];
// Sotto il premio, a rotazione: spiega a chi entra in live come partecipare. Righe separate da "|".
export const INVITO_PREDEFINITO = "La traccia più votata vince | Manda la tua traccia: link in bio";
const ORDINE_TIER = { throne: 0, superskip: 1, skip: 2, standard: 3 };

export function statoIniziale(config) {
  return {
    corrente: tracciaVuota(),
    risultati: [],
    coda: [],
    countdown: countdownVuoto(),
    vincitore: null,
    spareggio: null,
    premio: config.premio,
    invito: config.invito ?? INVITO_PREDEFINITO,
    suoni: suoniIniziali(config),
    giudici: { ...config.giudici },
    nascondiVoti: false,
    visibili: Object.fromEntries(WIDGET.map((w) => [w, true])),
    tiktokUtente: config.tiktok ?? "",
    // Traccia in riproduzione su Nero: l'ultima vista e quella in attesa se la traccia attuale ha voti da confermare.
    neroAutomatico: config.nero?.automatico ?? true,
    neroUltimo: null,
    neroInArrivo: null,
  };
}

export const suoniIniziali = (config) => ({ dove: config.suoni?.dove ?? "overlay", volume: config.suoni?.volume ?? 0.8 });

export function impostaSuoni(stato, { dove, volume }) {
  if (dove !== undefined) {
    if (!DOVE_SUONI.includes(dove)) throw new Error("Scegli dove suonano: overlay, regia o spenti");
    stato.suoni.dove = dove;
  }
  if (volume !== undefined) {
    const v = Number(volume);
    if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error("Volume tra 0 e 1");
    stato.suoni.volume = Math.round(v * 100) / 100;
  }
}

export const haVoti = (traccia) => CATEGORIE.some((c) => traccia.voti[c] !== null) || Object.keys(traccia.chat.voti).length > 0;

// Nuova traccia in riproduzione su Nero. Se quella sul tabellone ha voti non confermati non la tocca:
// la nuova aspetta in neroInArrivo e passa sul tabellone con «Prossima».
export function tracciaDaNero(stato, traccia) {
  if (!traccia || traccia.neroId === stato.neroUltimo) return false;
  stato.neroUltimo = traccia.neroId;
  if (!stato.neroAutomatico) return true;
  const { titolo, artista, tier } = traccia;
  stato.coda = stato.coda.filter((v) => !(v.titolo === titolo && v.artista === artista));
  if (stato.corrente.titolo === titolo && stato.corrente.artista === artista) return true;
  if (haVoti(stato.corrente) && !stato.corrente.confermato) {
    stato.neroInArrivo = { titolo, artista, tier };
  } else {
    stato.corrente = tracciaVuota({ titolo, artista, tier });
    stato.neroInArrivo = null;
  }
  return true;
}

// «Prossima»: se da Nero è arrivata una traccia mentre si votava, passa a quella.
export function prossima(stato) {
  stato.corrente = tracciaVuota(stato.neroInArrivo ?? {});
  stato.neroInArrivo = null;
}

export function tracciaVuota(dati = {}) {
  return {
    id: randomUUID(),
    titolo: dati.titolo ?? "",
    artista: dati.artista ?? "",
    tier: dati.tier ?? null,
    voti: Object.fromEntries(CATEGORIE.map((c) => [c, null])),
    chat: { aperta: false, chiudeAlle: null, voti: {}, ultimi: [] },
    confermato: false,
  };
}

const countdownVuoto = () => ({ fineAlle: null, rimanenteMs: null, scaduto: false });
const countdownChiuso = () => ({ fineAlle: null, rimanenteMs: null, scaduto: true });

export const arrotonda = (x, cifre) => (x === null ? null : Math.round(x * 10 ** cifre) / 10 ** cifre);

export function media(valori) {
  const numeri = valori.filter((v) => typeof v === "number");
  return numeri.length ? numeri.reduce((a, b) => a + b, 0) / numeri.length : null;
}

// Voto di ogni categoria e totale pesato (0–10). Le categorie ancora senza voto non pesano.
export function punteggi(traccia, pesi) {
  const votiChat = Object.values(traccia.chat.voti);
  const parti = { ...traccia.voti, chat: media(votiChat) };
  let somma = 0;
  let pesoTotale = 0;
  for (const [nome, valore] of Object.entries(parti)) {
    if (valore === null || !(pesi[nome] > 0)) continue;
    somma += valore * pesi[nome];
    pesoTotale += pesi[nome];
  }
  return { ...parti, chatVoti: votiChat.length, totale: pesoTotale ? somma / pesoTotale : null };
}

// Ordine di classifica: totale, poi chi è stato confermato prima.
// I pari merito in testa non si risolvono qui: alla fine decidono i giudici (spareggio).
export function confronta(a, b) {
  return b.totale - a.totale || a.confermatoAlle - b.confermatoAlle;
}

export const classifica = (risultati, n) => [...risultati].sort(confronta).slice(0, n);

export function primiPariMerito(risultati) {
  const ordinati = [...risultati].sort(confronta);
  return ordinati.filter((r) => r.totale === ordinati[0]?.totale);
}

export const ordinaCoda = (coda) =>
  [...coda].sort((a, b) => (ORDINE_TIER[a.tier] ?? 9) - (ORDINE_TIER[b.tier] ?? 9) || a.ricevutoAlle - b.ricevutoAlle);

export function normalizzaVoto(valore) {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(String(valore).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error("Il voto deve essere tra 0 e 10");
  return Math.round(n * 10) / 10;
}

export function impostaVoto(stato, { categoria, valore }) {
  if (!CATEGORIE.includes(categoria)) throw new Error("Categoria non valida");
  stato.corrente.voti[categoria] = normalizzaVoto(valore);
  stato.corrente.confermato = false;
}

export function apriVotoChat(stato, secondi, ora) {
  const chat = stato.corrente.chat;
  chat.aperta = true;
  chat.chiudeAlle = secondi > 0 ? ora + secondi * 1000 : null;
  stato.corrente.confermato = false;
}

export function chiudiVotoChat(stato) {
  stato.corrente.chat.aperta = false;
  stato.corrente.chat.chiudeAlle = null;
}

export function chiudiChatSeScaduta(stato, ora) {
  const chat = stato.corrente.chat;
  if (!chat.aperta || chat.chiudeAlle === null || ora < chat.chiudeAlle) return false;
  chiudiVotoChat(stato);
  return true;
}

// Un voto per utente: se riscrive, vale l'ultimo. Fuori dalla finestra di voto non conta.
export function votoChat(stato, { piattaforma, utente }, valore, ora) {
  const chat = stato.corrente.chat;
  if (!chat.aperta || !utente || valore === null) return false;
  if (chat.chiudeAlle !== null && ora >= chat.chiudeAlle) return false;
  const chiave = `${piattaforma}:${String(utente).toLowerCase()}`;
  chat.voti[chiave] = valore;
  chat.ultimi = [{ chiave, utente, piattaforma, valore }, ...chat.ultimi.filter((u) => u.chiave !== chiave)].slice(0, 8);
  return true;
}

// Fissa il punteggio della traccia in ascolto e dice come cambia la classifica.
// Riconfermare la stessa traccia (dopo una correzione) aggiorna il risultato senza duplicarlo.
export function conferma(stato, config, ora) {
  const traccia = stato.corrente;
  const p = punteggi(traccia, config.pesi);
  if (p.totale === null) throw new Error("Nessun voto inserito per questa traccia");
  chiudiVotoChat(stato);

  const primaTop = classifica(stato.risultati, config.topN).map((r) => r.id);
  const precedente = stato.risultati.find((r) => r.id === traccia.id);
  const risultato = {
    id: traccia.id,
    titolo: traccia.titolo || "Senza titolo",
    artista: traccia.artista || "Artista sconosciuto",
    tier: traccia.tier,
    beat: traccia.voti.beat,
    voce: traccia.voti.voce,
    mix: traccia.voti.mix,
    chat: arrotonda(p.chat, 2),
    chatVoti: p.chatVoti,
    totale: arrotonda(p.totale, 2),
    confermatoAlle: precedente?.confermatoAlle ?? ora,
  };
  stato.risultati = [...stato.risultati.filter((r) => r.id !== traccia.id), risultato];
  traccia.confermato = true;

  const ordinati = [...stato.risultati].sort(confronta);
  const posizione = ordinati.findIndex((r) => r.id === traccia.id) + 1;
  const dopoTop = ordinati.slice(0, config.topN).map((r) => r.id);
  return {
    risultato,
    posizione,
    inTop: posizione <= config.topN,
    entrata: posizione <= config.topN && !primaTop.includes(traccia.id),
    uscito: primaTop.find((id) => !dopoTop.includes(id)) ?? null,
  };
}

export function countdown(stato, { azione, minuti = 0 }, ora) {
  const c = stato.countdown;
  const ms = Number(minuti) * 60_000;
  switch (azione) {
    case "avvia":
      if (!(ms > 0)) throw new Error("Durata del countdown non valida");
      stato.countdown = { fineAlle: ora + ms, rimanenteMs: null, scaduto: false };
      stato.vincitore = null;
      stato.spareggio = null;
      break;
    case "pausa":
      if (c.fineAlle !== null) stato.countdown = { ...c, fineAlle: null, rimanenteMs: Math.max(0, c.fineAlle - ora) };
      break;
    case "riprendi":
      if (c.rimanenteMs !== null) stato.countdown = { ...c, fineAlle: ora + c.rimanenteMs, rimanenteMs: null };
      break;
    case "aggiungi":
      if (c.fineAlle !== null) c.fineAlle = Math.max(ora, c.fineAlle + ms);
      else if (c.rimanenteMs !== null) c.rimanenteMs = Math.max(0, c.rimanenteMs + ms);
      break;
    case "azzera":
      stato.countdown = countdownVuoto();
      break;
    default:
      throw new Error("Azione countdown non valida");
  }
}

// Allo scadere chiude la gara. Restituisce l'esito di proclama, oppure undefined se non è ancora scaduto.
export function scadenzaCountdown(stato, ora) {
  const c = stato.countdown;
  if (c.fineAlle === null || ora < c.fineAlle) return undefined;
  return proclama(stato, ora);
}

// Chiude la gara. Con un solo primo lo proclama; con più primi a pari merito apre lo spareggio
// (scelgono i giudici dalla regia, passando l'id). Restituisce null se la classifica è vuota.
export function proclama(stato, ora, id = null) {
  const candidati = id ? stato.risultati.filter((r) => r.id === id) : primiPariMerito(stato.risultati);
  if (id && !candidati.length) throw new Error("Traccia non trovata in classifica");
  stato.countdown = countdownChiuso();
  if (!candidati.length) return null;
  if (candidati.length > 1) {
    stato.spareggio = { candidati, dal: ora };
    stato.vincitore = null;
    return { spareggio: stato.spareggio };
  }
  stato.spareggio = null;
  stato.vincitore = { ...candidati[0], premio: stato.premio, proclamatoAlle: ora, visibile: true };
  return { vincitore: stato.vincitore };
}

// Quello che ricevono overlay e regia a ogni aggiornamento.
export function istantanea(stato, config, ora) {
  const t = stato.corrente;
  const ordinati = [...stato.risultati].sort(confronta);
  const posizione = ordinati.findIndex((r) => r.id === t.id) + 1;
  return {
    ora,
    giudici: stato.giudici,
    topN: config.topN,
    premio: stato.premio,
    invito: stato.invito,
    suoni: stato.suoni,
    durataCountdownMinuti: config.durataCountdownMinuti,
    nascondiVoti: stato.nascondiVoti,
    visibili: stato.visibili,
    corrente: {
      id: t.id,
      titolo: t.titolo,
      artista: t.artista,
      tier: t.tier,
      confermato: t.confermato,
      punteggi: punteggi(t, config.pesi),
      posizione: t.confermato && posizione > 0 ? posizione : null,
      chat: { aperta: t.chat.aperta, chiudeAlle: t.chat.chiudeAlle, ultimi: t.chat.ultimi },
    },
    classifica: ordinati.slice(0, config.topN),
    risultati: ordinati,
    coda: ordinaCoda(stato.coda),
    countdown: stato.countdown,
    vincitore: stato.vincitore,
    spareggio: stato.spareggio,
  };
}
