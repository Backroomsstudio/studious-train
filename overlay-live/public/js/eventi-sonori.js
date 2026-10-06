// Quali effetti sonori far partire, confrontando lo stato di prima con quello nuovo.
// Funzioni pure (niente audio, niente DOM): le usano overlay e regia, e i test.
import { rimanenteBattleMs, sequenzaRivelazione, rivelazioneNuova, vittoriaDa, RULLO_VITTORIA_MS, SOGLIA_URGENTE_MS as SOGLIA_BATTLE_MS } from "./battle-logica.js";

// Dopo la conferma il totale conta per 1,5 s e "timbra": la classifica si muove subito dopo.
export const RITARDO_CLASSIFICA_MS = 1700;
export const SOGLIA_URGENTE_MS = 30 * 60_000;

const CATEGORIE = ["beat", "voce", "mix"];
// Pulsante «Prova» della regia: l'effetto scelto, con i suoi dati (es. il tier per «inAscolto»).
const prova = (e) => (e.dati.dati && Object.keys(e.dati.dati).length ? { nome: e.dati.nome, dati: e.dati.dati } : { nome: e.dati.nome });
const chiaveVincitore = (s) => (s.vincitore?.visibile ? `${s.vincitore.id}@${s.vincitore.proclamatoAlle}` : null);
const votiNascosti = (s) => s.nascondiVoti && !s.corrente.confermato;

// Suoni del tabellone, del voto chat, della conferma, del premio e della schermata finale.
export function suoniTraccia(prima, dopo, eventi = []) {
  if (!prima) return [];
  const suoni = [];
  for (const e of eventi) if (e.nome === "suono") suoni.push(prova(e));

  const vincitore = chiaveVincitore(dopo);
  if (vincitore && vincitore !== chiaveVincitore(prima)) return [...suoni, { nome: "vincitore" }];
  if (dopo.spareggio && dopo.spareggio.dal !== prima.spareggio?.dal) return [...suoni, { nome: "spareggio" }];
  if (dopo.premio !== prima.premio && dopo.premio) suoni.push({ nome: "premio" });

  const a = prima.corrente;
  const b = dopo.corrente;
  if (a.id !== b.id) return [...suoni, { nome: "nuovaTraccia" }];

  const conferma = eventi.some((e) => e.nome === "classifica");
  if (conferma) return [...suoni, { nome: "calcolo" }];

  for (const cat of CATEGORIE) {
    const [v1, v2] = [a.punteggi[cat], b.punteggi[cat]];
    if (v1 === v2 || v2 === null) continue;
    if (votiNascosti(dopo)) {
      if (v1 === null) suoni.push({ nome: "bloccato" });
    } else suoni.push({ nome: "voto", dati: { valore: v2 } });
  }
  if (b.chat.aperta && !a.chat.aperta) suoni.push({ nome: "chatApre" });
  else if (!b.chat.aperta && a.chat.aperta) suoni.push({ nome: "chatChiude" });
  const nuoviVoti = b.punteggi.chatVoti - a.punteggi.chatVoti;
  // Al massimo 4 "pop" per aggiornamento, sfalsati: una raffica di voti resta un ticchettio leggero.
  for (let i = 0; i < Math.min(4, nuoviVoti); i++) suoni.push({ nome: "chatVoto", ritardo: i * 70 });
  return suoni;
}

// Cosa è cambiato in classifica: nuove entrate, chi è salito (e di quanto), chi è uscito, nuovo primo.
export function cambiClassifica(prima = [], dopo = []) {
  const posPrima = new Map(prima.map((r, i) => [r.id, i]));
  const posDopo = new Map(dopo.map((r, i) => [r.id, i]));
  const entrate = [];
  const salite = [];
  dopo.forEach((r, i) => {
    if (!posPrima.has(r.id)) entrate.push({ id: r.id, posizione: i + 1 });
    else if (posPrima.get(r.id) > i) salite.push({ id: r.id, posizione: i + 1, posti: posPrima.get(r.id) - i });
  });
  return {
    entrate,
    salite,
    uscite: prima.filter((r) => !posDopo.has(r.id)).map((r) => r.id),
    nuovoPrimo: dopo[0] && dopo[0].id !== prima[0]?.id ? dopo[0].id : null,
  };
}

// Un solo effetto principale (il più importante), più l'uscita di chi lascia la top.
export function suoniClassifica(cambi) {
  const suoni = [];
  if (cambi.nuovoPrimo) suoni.push({ nome: "primo" });
  else if (cambi.entrate.length) suoni.push({ nome: "entrata" });
  else if (cambi.salite.length) suoni.push({ nome: "sale", dati: { posti: Math.max(...cambi.salite.map((s) => s.posti)) } });
  if (cambi.uscite.length) suoni.push({ nome: "esce", ritardo: 600 });
  return suoni;
}

// Countdown: sirena quando mancano 30 minuti e 1 minuto, un tic al secondo negli ultimi 10.
export function suoniTimer(msPrima, msDopo) {
  if (msPrima === null || msDopo === null || msDopo <= 0 || msDopo >= msPrima) return [];
  if (msPrima > SOGLIA_URGENTE_MS && msDopo <= SOGLIA_URGENTE_MS) return [{ nome: "allarme" }];
  if (msPrima > 60_000 && msDopo <= 60_000) return [{ nome: "allarme" }];
  const [s1, s2] = [Math.ceil(msPrima / 1000), Math.ceil(msDopo / 1000)];
  if (s2 <= 10 && s2 !== s1) return [{ nome: "tic", dati: { ultimi: s2 <= 3 } }];
  return [];
}

// ---------- Layout senza premio (live giornaliere di ascolto) ----------
// La scheda «Ora in ascolto» sale dalla barra in 0,6 s: la campana di «inAscolto» arriva quando atterra.
export const SALITA_SCHEDA_MS = 600;
export const USCITA_SCHEDA_MS = 500;
export const DURATA_SPOT_MS = 10_000;
export const RICHIAMO_MS = 2400;
// Se la regia salta più tracce di fila, al massimo un suono ogni 8 secondi.
export const PAUSA_MIN_TRACCIA_MS = 8000;

// Suona solo la pagina del layout in onda, e solo dove la regia ha scelto (overlay, regia).
export const suonaIn = (s, layout, dove) => (s?.layout ?? "gara") === layout && s?.suoni?.dove === dove;

// Cosa deve comparire nella scheda: la traccia nuova (non al primo disegno), le prove e lo spot dello studio.
export function richiesteScheda(prima, dopo, eventi = []) {
  if (!prima || dopo.visibili?.scheda === false) return [];
  const richieste = [];
  const t = dopo.corrente;
  if (t.id !== prima.corrente.id && t.titolo.trim()) {
    richieste.push({ tipo: "ascolto", traccia: { titolo: t.titolo, artista: t.artista, tier: t.tier }, conSuono: true, daCorrente: true });
  }
  for (const e of eventi) {
    if (e.nome === "scheda" && e.dati?.traccia) richieste.push({ tipo: "ascolto", traccia: e.dati.traccia, conSuono: Boolean(e.dati.conSuono) });
    if (e.nome === "studio") richieste.push({ tipo: "studio" });
  }
  return richieste;
}

// Pochi suoni, perché la musica degli artisti non va coperta: la traccia nuova, il richiamo premuto a mano, le prove.
// «parte» dice quale parte della pagina deve suonarlo, se le sorgenti sono divise con ?w= (una sola suona).
// La pausa minima vale solo per le tracce vere, non per le prove; il richiamo non suona se ce n'è uno in corso.
export function suoniSenzaPremio(prima, dopo, eventi = [], { ora = 0, ultimaTracciaAlle = -Infinity, richiamoInCorso = false } = {}) {
  if (!prima) return [];
  const suoni = [];
  for (const e of eventi) if (e.nome === "suono") suoni.push({ ...prova(e), parte: "scheda" });
  const richiamo = eventi.some((e) => e.nome === "richiamo" && e.dati?.manuale);
  if (richiamo && !richiamoInCorso && dopo.visibili?.banner !== false) suoni.push({ nome: "premio", parte: "banner" });
  const scelta = dopo.senzaPremio?.suonoTraccia ?? "delicato";
  const traccia = richiesteScheda(prima, dopo, eventi).find((r) => r.tipo === "ascolto" && r.conSuono);
  const inPausa = traccia?.daCorrente && ora - ultimaTracciaAlle < PAUSA_MIN_TRACCIA_MS;
  if (traccia && scelta !== "nessuno" && !inPausa) {
    const suono = { nome: scelta === "pieno" ? "nuovaTraccia" : "inAscolto", dati: { tier: traccia.traccia.tier ?? null }, parte: "scheda" };
    suoni.push(traccia.daCorrente ? { ...suono, traccia: true } : suono);
  }
  return suoni;
}

// ---------- Battle ----------

// Timer del battle (90 s di solito): sirena quando mancano 30 secondi, un tic al secondo negli ultimi 10.
// A zero non suona niente: ci pensa il gong.
export function suoniTimerBattle(msPrima, msDopo) {
  if (msPrima === null || msDopo === null || msDopo <= 0 || msDopo >= msPrima) return [];
  if (msPrima > SOGLIA_BATTLE_MS && msDopo <= SOGLIA_BATTLE_MS) return [{ nome: "allarme" }];
  const [s1, s2] = [Math.ceil(msPrima / 1000), Math.ceil(msDopo / 1000)];
  if (s2 <= 10 && s2 !== s1) return [{ nome: "tic", dati: { ultimi: s2 <= 3 } }];
  return [];
}

// Tempo rimasto solo mentre il timer corre (null in pausa, prima del via e a fine round): in quei momenti non c'è
// niente da confrontare. Lo usa il ciclo della pagina e della regia, ogni 50/250 ms, per far suonare sirena e tic:
// non dipende dagli aggiornamenti dello stato, che con la chat ferma non arrivano per tutto il round.
export const msTimerBattle = (s, ora) => (s.battle.fase === "battle" && s.battle.timer.fineAlle !== null ? rimanenteBattleMs(s.battle, ora) : null);

// Suoni del battle: i tre bip del 3-2-1, gong (con lo spacco al via), rivelazione dei voti e fanfara del vincitore
// (sirena e tic del timer suonano dal ciclo della pagina: vedi msTimerBattle).
// Il 3-2-1 e la rivelazione sono programmati con un ritardo per ogni suono, così restano allineati alla grafica.
export function suoniBattle(prima, dopo, eventi = []) {
  if (!prima) return [];
  const a = prima.battle;
  const b = dopo.battle;
  const suoni = [];
  for (const e of eventi) if (e.nome === "suono") suoni.push(prova(e)); // pulsanti Prova della regia
  if (a.fase !== "countdown" && b.fase === "countdown") {
    for (const n of [3, 2, 1]) suoni.push({ nome: "conto", dati: { n }, ritardo: (3 - n) * 1000 });
  }
  for (const e of eventi) {
    if (e.nome !== "gong") continue;
    suoni.push({ nome: "gong" });
    if (e.dati?.quando === "inizio") suoni.push({ nome: "spacco" });
  }
  if (rivelazioneNuova(prima, dopo)) {
    for (const passo of sequenzaRivelazione(b.risultato)) {
      if (passo.chiave === "totale") suoni.push({ nome: "calcolo", ritardo: passo.dopoMs });
      else if (passo.chiave !== "chat") suoni.push({ nome: "voto", dati: { valore: Math.max(passo.sx, passo.dx) }, ritardo: passo.dopoMs });
    }
  }
  // La fanfara (rullo e colpo) accompagna la schermata del vincitore: stessi tempi, decisi in vittoriaDa.
  const vittoria = vittoriaDa(prima, dopo, eventi);
  if (vittoria) suoni.push({ nome: "vincitore", dati: { rullo: RULLO_VITTORIA_MS / 1000 }, ritardo: vittoria.ritardoMs });
  return suoni;
}
