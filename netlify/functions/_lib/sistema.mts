// Foglio Backrooms_Sistema: dati propri del sistema (config, saldi, movimenti, log).
import { env } from "./config.mts";
import { adesso, iso } from "./date.mts";
import { accoda, type Celle } from "./sheets.mts";
import { testo } from "./match.mts";
import type { RigaRegistro } from "./registro.mts";

export const TABS: Record<string, string[]> = {
  Config: ["chiave", "valore", "descrizione"],
  Saldi: [
    "id_saldo", "data_acquisto", "crm_id", "cliente", "telefono", "prodotto", "prezzo",
    "sessioni_tot", "sessioni_usate", "beat_tot", "beat_usati", "mix_tot", "mix_usati",
    "stato", "data_chiusura", "data_ultimo_movimento", "stripe_session", "note",
  ],
  Movimenti: [
    "timestamp", "tipo", "crm_id", "cliente", "dettaglio", "importo", "metodo", "incassato_da",
    "foglio_registro", "riga_registro", "id_saldo", "esito_hook", "operatore",
  ],
  Log_Eventi: ["timestamp", "stripe_event_id", "checkout_session_id", "tipo", "esito", "righe_scritte"],
  Log_Avvisi: ["timestamp", "chiave_univoca", "tipo", "cliente", "testo_breve"],
  KPI: [
    "settimana", "incassato", "obiettivo", "differenza", "incassato_mese", "proiezione_mese",
    "crediti_aperti", "pacchetti_n", "pacchetti_eur", "hook_fatte", "hook_chiuse",
    "sessioni_non_registrate", "scontrino_medio", "sconti_n", "sconti_eur", "cassa_da_non_spendere",
  ],
  Da_trascrivere: [
    "timestamp", "foglio", "data", "cliente", "servizio", "importo", "stato", "incassato_da", "metodo", "note", "motivo",
  ],
};

// Colonne di Saldi (A = 0).
export const S = {
  id: 0, data: 1, crmId: 2, cliente: 3, telefono: 4, prodotto: 5, prezzo: 6,
  sTot: 7, sUsate: 8, bTot: 9, bUsati: 10, mTot: 11, mUsati: 12,
  stato: 13, chiusura: 14, ultimoMov: 15, session: 16, note: 17,
} as const;

export const sistema = () => env("SHEET_SISTEMA_ID");

export async function logEvento(eventoId: string, sessionId: string, tipo: string, esito: string, righe: string) {
  await accoda(sistema(), "Log_Eventi!A:F", [[adesso(), eventoId, sessionId, tipo, esito, testo(righe)]]);
}

export async function daTrascrivere(righe: RigaRegistro[], foglio: string, motivo: string) {
  await accoda(
    sistema(),
    "Da_trascrivere!A:K",
    righe.map((r) => [
      adesso(), foglio, iso(r.data), testo(r.cliente), r.servizio, r.importo / 100, r.stato,
      r.incassatoDa, r.metodo, testo(r.note), motivo,
    ]),
  );
}

export const saldiDellaSessione = (celle: Celle, sessionId: string) =>
  celle.flatMap((r, i) => (r?.[S.session] === sessionId ? [i + 2] : []));
