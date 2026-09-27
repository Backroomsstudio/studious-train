import { DateTime } from "luxon";
import { TZ } from "./config.mts";

export const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

// Data di oggi a Roma; `finta` (yyyy-mm-dd) serve ai test.
export function oggi(finta?: string | null): DateTime {
  return finta ? DateTime.fromISO(finta, { zone: TZ }) : DateTime.now().setZone(TZ);
}

export const daSecondi = (s: number) => DateTime.fromSeconds(s, { zone: TZ });

export const nomeRegistro = (d: DateTime) => `Registro ${MESI[d.month - 1]}${d.toFormat("yy")}`;

export const iso = (d: DateTime) => d.toFormat("yyyy-MM-dd");
export const ita = (d: DateTime) => d.toFormat("dd/MM/yyyy");
export const adesso = () => DateTime.now().setZone(TZ).toFormat("yyyy-MM-dd HH:mm:ss");

const ZERO_SHEETS = DateTime.fromISO("1899-12-30", { zone: TZ });

export const seriale = (d: DateTime) => Math.round(d.startOf("day").diff(ZERO_SHEETS, "days").days);

// Legge una data da una cella: numero seriale di Sheets, "gg/mm/aaaa" o ISO.
export function leggiData(v: unknown): DateTime | null {
  if (typeof v === "number" && v > 0) return ZERO_SHEETS.plus({ days: Math.floor(v) });
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = DateTime.fromObject({ year: anno, month: Number(m[2]), day: Number(m[1]) }, { zone: TZ });
    return d.isValid ? d : null;
  }
  const d = DateTime.fromISO(s.slice(0, 10), { zone: TZ });
  return d.isValid ? d : null;
}
