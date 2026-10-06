// Quali effetti sonori far partire, confrontando lo stato di prima con quello nuovo.
// Funzioni pure (niente audio, niente DOM): le usano overlay e regia, e i test.

// Dopo la conferma il totale conta per 1,5 s e "timbra": la classifica si muove subito dopo.
export const RITARDO_CLASSIFICA_MS = 1700;
export const SOGLIA_URGENTE_MS = 30 * 60_000;

const CATEGORIE = ["beat", "voce", "mix"];
const chiaveVincitore = (s) => (s.vincitore?.visibile ? `${s.vincitore.id}@${s.vincitore.proclamatoAlle}` : null);
const votiNascosti = (s) => s.nascondiVoti && !s.corrente.confermato;

// Suoni del tabellone, del voto chat, della conferma, del premio e della schermata finale.
export function suoniTraccia(prima, dopo, eventi = []) {
  if (!prima) return [];
  const suoni = [];
  for (const e of eventi) if (e.nome === "suono") suoni.push({ nome: e.dati.nome });

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
