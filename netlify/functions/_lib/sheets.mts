// Letture e scritture su Google Sheets (API REST v4).
import { google } from "./google.mts";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export type Celle = unknown[][];

export const intervallo = (foglio: string, celle: string) => `'${foglio.replace(/'/g, "''")}'!${celle}`;

// Più intervalli in una sola chiamata. Le date arrivano come numero seriale.
export async function leggi(
  id: string,
  ranges: string[],
  resa: "UNFORMATTED_VALUE" | "FORMATTED_VALUE" = "UNFORMATTED_VALUE",
): Promise<Celle[]> {
  const p = new URLSearchParams({ valueRenderOption: resa, dateTimeRenderOption: "SERIAL_NUMBER" });
  for (const r of ranges) p.append("ranges", r);
  const j = await google<{ valueRanges: { values?: Celle }[] }>(`${BASE}/${id}/values:batchGet?${p}`);
  return j.valueRanges.map((v) => v.values ?? []);
}

// Scrive solo le celle indicate (values.batchUpdate): mai append sui fogli ufficiali.
export async function scrivi(
  id: string,
  dati: { range: string; values: Celle }[],
  input: "USER_ENTERED" | "RAW" = "USER_ENTERED",
) {
  if (!dati.length) return;
  await google(`${BASE}/${id}/values:batchUpdate`, "POST", { valueInputOption: input, data: dati });
}

// Solo per il foglio Sistema, che è nostro.
export async function accoda(id: string, range: string, righe: Celle) {
  if (!righe.length) return;
  await google(
    `${BASE}/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    "POST",
    { values: righe },
  );
}

export async function nomiFogli(id: string): Promise<string[]> {
  const j = await google<{ sheets: { properties: { title: string } }[] }>(
    `${BASE}/${id}?fields=sheets.properties.title`,
  );
  return j.sheets.map((s) => s.properties.title);
}

export async function modificaStruttura(id: string, requests: object[]) {
  await google(`${BASE}/${id}:batchUpdate`, "POST", { requests });
}

export const vuota = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
