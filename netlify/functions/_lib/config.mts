// Variabili d'ambiente e valori predefiniti del tab Config (foglio Sistema).

export const TZ = "Europe/Rome";

export const VARIABILI = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_INCASSATO_DA",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "SHEET_CONTABILITA_ID",
  "SHEET_CRM_ID",
  "SHEET_SISTEMA_ID",
  "CALENDAR_ID",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "CASSA_PIN",
  "SITE_URL",
] as const;

export function env(nome: (typeof VARIABILI)[number]): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Variabile d'ambiente mancante: ${nome}`);
  return v;
}

// [chiave, valore, descrizione]. Luca li cambia dal tab Config senza toccare il codice.
export const CONFIG_DEFAULT: [string, string, string][] = [
  ["PREZZO_SESSIONE", "70", "Prezzo pieno sessione 1 h: serve a dividere i pacchetti"],
  ["PREZZO_BEAT", "75", "Prezzo pieno beat: serve a dividere i pacchetti"],
  ["PREZZO_MIX", "80", "Prezzo pieno mix e master: serve a dividere i pacchetti"],
  ["PREZZO_SESSIONE_FONDATORI", "60", "Prezzo sessione 1 h per i Fondatori"],
  ["FONDATORI", "AD1, Ojedi, Icaro", "Nomi separati da virgola, come nel CRM"],
  ["SERVIZIO_BEAT_REGISTRO", "Sessione Beat in Presenza (1h30)", "Nome del Listino usato per i beat di pacchetti e blocchi"],
  ["HOOK_TETTO", "4", "Hook massime a settimana"],
  ["CREDITO_GIORNI", "7", "Dopo quanti giorni un DA PAGARE diventa un avviso"],
  ["FERMO_GIORNI", "21", "Dopo quanti giorni senza movimenti un pacchetto è fermo"],
  ["INCLUDE_LAVORO", "sessione, rec, beat, mix, master, revisione", "Parole che rendono un evento del calendario 'di lavoro'"],
  ["EXCLUDE_LAVORO", "hook, riunione, call, formazione, foto, scout, pulizie, comprare, fibra, elettricista, water, bagno, divano, pannelli, landing, togliere, sistemare", "Parole che escludono un evento"],
  ["OBIETTIVO_SETTIMANA", "2300", "Obiettivo di incasso settimanale (€)"],
  ["OBIETTIVO_MESE", "10000", "Obiettivo di incasso mensile (€)"],
  ["LINK_ZINCO", "https://buy.stripe.com/3cI00ieJK37b5PD8dA0Jq00", "Link di pagamento ZINCO"],
  ["PREZZO_ZINCO", "180", "Prezzo ZINCO (€)"],
  ["PEZZI_ZINCO", "1", "Pezzi finiti in ZINCO"],
  ["LINK_SMERALDO", "https://buy.stripe.com/3cI14mcBC7nr5PDbpM0Jq01", "Link di pagamento SMERALDO"],
  ["PREZZO_SMERALDO", "280", "Prezzo SMERALDO (€)"],
  ["PEZZI_SMERALDO", "2", "Pezzi finiti in SMERALDO"],
  ["LINK_ZAFFIRO", "https://buy.stripe.com/3cI6oGcBCbDH3Hv3Xk0Jq02", "Link di pagamento ZAFFIRO"],
  ["PREZZO_ZAFFIRO", "370", "Prezzo ZAFFIRO (€)"],
  ["PEZZI_ZAFFIRO", "3", "Pezzi finiti in ZAFFIRO"],
  ["LINK_DIAMANTE", "", "Link DIAMANTE (quando esisterà)"],
  ["PREZZO_DIAMANTE", "", "Prezzo DIAMANTE (€)"],
  ["PEZZI_DIAMANTE", "6", "Pezzi finiti in DIAMANTE"],
  ["ORARI_APERTURA", "", "Orari di apertura, solo per la Fase 4"],
];

export type Config = Record<string, string>;

export function configDa(celle: unknown[][]): Config {
  const cfg: Config = Object.fromEntries(CONFIG_DEFAULT.map(([k, v]) => [k, v]));
  for (const [k, v] of celle) {
    if (k && v !== undefined && v !== null && String(v) !== "") cfg[String(k).trim()] = String(v);
  }
  return cfg;
}

export const numero = (cfg: Config, k: string) => Number(String(cfg[k] ?? "").replace(",", "."));
export const lista = (cfg: Config, k: string) =>
  String(cfg[k] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
