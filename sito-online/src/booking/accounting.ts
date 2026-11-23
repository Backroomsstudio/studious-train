import { accessToken } from "./google-calendar.ts";
import { getService } from "./catalog.ts";
import { lineText, offerName, remoteLines, whenText, type Order } from "./order.ts";
import { accountingConfigured, serverConfig } from "./server-config.ts";
import { TIME_ZONE } from "./slots.ts";

/**
 * Contabilità automatica: a ogni prenotazione dal sito aggiunge una riga al foglio
 * "Registro <Mese><Anno>" del mese in corso (es. "Registro Nov26") nel documento di contabilità.
 *
 * Colonne del registro (riga 4 = intestazioni, dati dalla riga 5, in fondo le righe TOTALE):
 * A Data · B Cliente · C Servizio · D Importo · E Stato (PAGATO / DA PAGARE) · F Incassato da ·
 * G Metodo · H–J quote (formule: non si toccano) · K Note.
 */

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const FIRST_DATA_ROW = 5;

export interface AccountingEntry {
  /** Foglio del mese in cui arriva la prenotazione */
  sheet: string;
  /** A–G: data (numero di serie di Fogli Google), cliente, servizio, importo, stato, incassato da, metodo */
  values: [number, string, string, number, "PAGATO" | "DA PAGARE", string, string];
  /** K: note */
  note: string;
  /** Riferimento univoco (nelle note) per non scrivere due volte la stessa prenotazione */
  ref: string;
}

function romeParts(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

/** "Registro Nov26" per una data di novembre 2026 (ora di Roma). */
export function sheetTitleFor(date: Date): string {
  const { year, month } = romeParts(date);
  return `Registro ${MONTHS[month - 1]}${String(year).slice(-2)}`;
}

/** Data come numero di serie di Fogli Google (giorni dal 30/12/1899): la colonna A è già formattata come data. */
export function sheetDateSerial(date: Date): number {
  const { year, month, day } = romeParts(date);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { timeZone: TIME_ZONE, weekday: "short", day: "2-digit", month: "2-digit" });

/** Riga da scrivere per una prenotazione dal sito. */
export function accountingEntry(order: Order, opts: { paid: boolean; at: Date; ref: string; amountCents?: number; service?: string }): AccountingEntry {
  const offer = offerName(order);
  const service = opts.service ?? (offer ? `Pacchetto ${offer}` : order.lines.map(lineText).join(" + "));
  const sessions = order.appointments.map((a) => `${getService(a.serviceId)!.short}: ${whenText(a)}`);
  const remote = remoteLines(order).map(lineText);
  const first = order.appointments[0];
  const note = [
    "Dal sito",
    sessions.length ? `Sessione: ${sessions.join(" · ")}` : null,
    remote.length ? `A distanza: ${remote.join(", ")}` : null,
    opts.paid
      ? "Pagato online (Stripe)"
      : first
        ? `Paga in contanti il ${shortDay(first.start)} alla sessione`
        : "Paga in contanti",
    order.phone ? `Tel ${order.phone}` : null,
    `rif. ${opts.ref}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    sheet: sheetTitleFor(opts.at),
    values: [
      sheetDateSerial(opts.at),
      order.name,
      service,
      (opts.amountCents ?? order.totalCents) / 100,
      opts.paid ? "PAGATO" : "DA PAGARE",
      // Gli incassi online arrivano sul conto Stripe di Luca.
      opts.paid ? "Luca" : "",
      opts.paid ? "Carta" : "Contante",
    ],
    note,
    ref: opts.ref,
  };
}

/**
 * Dove scrivere nel foglio: la prima riga libera (A–E vuote) prima delle righe TOTALE.
 * rows = valori da A5 in giù. Restituisce il numero di riga (1 = prima riga del foglio),
 * se la riga va inserita prima dei totali, oppure "duplicato" se il riferimento c'è già.
 */
export function findTargetRow(rows: string[][], ref: string): { row: number; insert: boolean } | "duplicato" {
  let totals = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if ((r[10] ?? "").includes(`rif. ${ref}`)) return "duplicato";
    if (totals < 0 && /^TOTALE/i.test((r[0] ?? "").trim())) totals = i;
  }
  const end = totals < 0 ? rows.length : totals;
  for (let i = 0; i < end; i++) {
    const r = rows[i] ?? [];
    if ([0, 1, 2, 3, 4].every((c) => !(r[c] ?? "").trim())) {
      // Lascia almeno una riga vuota prima dei totali, come nel foglio.
      if (totals >= 0 && i === totals - 1) break;
      return { row: FIRST_DATA_ROW + i, insert: false };
    }
  }
  if (totals < 0) return { row: FIRST_DATA_ROW + rows.length, insert: false };
  // Registro pieno: si inserisce una riga prima della riga vuota che separa i totali (o prima dei totali).
  const blankBefore = totals > 0 && [0, 1, 2, 3, 4].every((c) => !(rows[totals - 1]?.[c] ?? "").trim());
  return { row: FIRST_DATA_ROW + (blankBefore ? totals - 1 : totals), insert: true };
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

async function sheetsCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${SHEETS}/${encodeURIComponent(serverConfig.accountingSheetId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) throw new Error("il robot non ha accesso al foglio: condividilo con backrooms-robot come Editor");
    if (res.status === 400 && /Unable to parse range/i.test(text)) throw new Error("manca il foglio del mese");
    throw new Error(`Fogli Google ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

const quoted = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

/** Aggiunge la riga nel registro del mese. Non lancia mai errori: restituisce cosa è successo. */
export async function recordInAccounting(entry: AccountingEntry): Promise<{ ok: true; row: number } | { ok: false; reason: string }> {
  if (!accountingConfigured) return { ok: false, reason: "contabilità non configurata (CONTABILITA_SHEET_ID)" };
  try {
    const range = `${quoted(entry.sheet)}!A${FIRST_DATA_ROW}:K${FIRST_DATA_ROW + 400}`;
    let rows: string[][];
    try {
      rows = (await sheetsCall<{ values?: string[][] }>(`/values/${encodeURIComponent(range)}`)).values ?? [];
    } catch (e) {
      if (String(e).includes("manca il foglio")) throw new Error(`manca il foglio "${entry.sheet}" nel documento di contabilità`);
      throw e;
    }
    const target = findTargetRow(rows, entry.ref);
    if (target === "duplicato") return { ok: true, row: -1 };

    if (target.insert) {
      // Registro pieno: nuova riga subito sopra i totali, con formati, menu a tendina e formule delle quote della riga sopra.
      const meta = await sheetsCall<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`?fields=sheets.properties(sheetId,title)`);
      const sheetId = meta.sheets.find((s) => s.properties.title === entry.sheet)?.properties.sheetId;
      if (sheetId === undefined) throw new Error(`manca il foglio "${entry.sheet}"`);
      const at = target.row - 1; // indice 0-based della nuova riga
      const src = (c0: number, c1: number) => ({ sheetId, startRowIndex: at - 1, endRowIndex: at, startColumnIndex: c0, endColumnIndex: c1 });
      const dst = (c0: number, c1: number) => ({ sheetId, startRowIndex: at, endRowIndex: at + 1, startColumnIndex: c0, endColumnIndex: c1 });
      await sheetsCall(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [
            { insertDimension: { range: { sheetId, dimension: "ROWS", startIndex: at, endIndex: at + 1 }, inheritFromBefore: true } },
            { copyPaste: { source: src(0, 11), destination: dst(0, 11), pasteType: "PASTE_DATA_VALIDATION" } },
            { copyPaste: { source: src(7, 10), destination: dst(7, 10), pasteType: "PASTE_FORMULA" } },
          ],
        }),
      });
    }

    const r = target.row;
    await sheetsCall(`/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: [
          { range: `${quoted(entry.sheet)}!A${r}:G${r}`, values: [entry.values] },
          { range: `${quoted(entry.sheet)}!K${r}`, values: [[entry.note]] },
        ],
      }),
    });
    return { ok: true, row: r };
  } catch (e) {
    console.error("[contabilità]", e);
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Per /api/stato: il robot vede il documento e il foglio del mese? */
export async function accountingStatus(now = new Date()): Promise<string> {
  if (!accountingConfigured) return "manca: CONTABILITA_SHEET_ID (le prenotazioni funzionano, ma non vanno in contabilità)";
  try {
    const meta = await sheetsCall<{ sheets: { properties: { title: string } }[] }>(`?fields=sheets.properties.title`);
    const title = sheetTitleFor(now);
    return meta.sheets.some((s) => s.properties.title === title)
      ? `ok: scrive nel foglio "${title}"`
      : `errore: nel documento manca il foglio "${title}" (crealo copiando un mese precedente)`;
  } catch (e) {
    return `errore: ${e instanceof Error ? e.message : String(e)}`;
  }
}
