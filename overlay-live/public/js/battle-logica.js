// Battle: parti pure della pagina (barre, timer, conto, rivelazione, pop-up). Niente DOM: le usano la pagina, i suoni e i test.

// Le barre mostrano la quota in % di ciascun lato: due interi che sommano sempre 100.
export function percentuali(quota) {
  const sx = Math.round(100 * quota.sx);
  return { sx, dx: 100 - sx };
}

// Negli ultimi 30 secondi il timer diventa rosso e lampeggia.
export const SOGLIA_URGENTE_MS = 30_000;
export const timerUrgente = (ms) => ms > 0 && ms <= SOGLIA_URGENTE_MS;

// Tempo rimasto: in corso, in pausa, prima del via (la durata intera) o scaduto (zero).
export function rimanenteBattleMs(battle, ora) {
  const t = battle.timer;
  if (t.scaduto) return 0;
  if (t.fineAlle !== null) return Math.max(0, t.fineAlle - ora);
  if (t.rimanenteMs !== null) return t.rimanenteMs;
  return t.durataSecondi * 1000;
}

// Il numero grande del 3-2-1 (0 = «VIA!», o nessun conto in corso).
export function numeroConto(finoAlle, ora) {
  if (finoAlle === null) return 0;
  return Math.max(0, Math.min(3, Math.ceil((finoAlle - ora) / 1000)));
}

// Rivelazione dei voti a fine round: un passo ogni 0,9 s (i tre giudici, la chat, il totale), conteggio animato di 0,7 s;
// il totale conta per 1,5 s, quanto la salita dell'effetto sonoro «calcolo».
export const RIVELAZIONE = { passoMs: 900, conteggioMs: 700, conteggioTotaleMs: 1500 };
export const FINE_RIVELAZIONE_MS = 4 * RIVELAZIONE.passoMs + RIVELAZIONE.conteggioTotaleMs;

export function sequenzaRivelazione(risultato) {
  const chiavi = ["luca", "freya", "daniele", "chat"];
  const passi = chiavi.map((chiave, i) => ({ chiave, ...risultato.parziali[chiave], dopoMs: i * RIVELAZIONE.passoMs }));
  passi.push({ chiave: "totale", ...risultato.totali, dopoMs: chiavi.length * RIVELAZIONE.passoMs });
  return passi;
}

// I pop-up social non coprono il round: solo in attesa e durante il battle, e se il widget è acceso.
export const popupConsentito = (battle, visibili) => ["attesa", "battle"].includes(battle.fase) && visibili?.popupBattle !== false;

// Pop-up chiesti dalla regia in questo aggiornamento: l'id scelto, oppure null per «la prossima del giro».
export function richiestePopup(prima, dopo, eventi = []) {
  if (!prima || !popupConsentito(dopo.battle, dopo.visibili)) return [];
  return eventi.filter((e) => e.nome === "popupBattle").map((e) => e.dati?.id ?? null);
}

// Giro automatico ogni N minuti (0 = solo a mano).
export function popupAutomaticoDovuto({ ogniMinuti, ultimaAlle, ora, aperto, consentito }) {
  return ogniMinuti > 0 && consentito && !aperto && ora - ultimaAlle >= ogniMinuti * 60_000;
}
