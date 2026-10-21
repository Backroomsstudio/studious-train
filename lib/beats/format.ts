export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

/** "oggi", "ieri", "3 giorni fa", "2 settimane fa". */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const day = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  const diff = day(new Date(iso)) - day(now);
  if (diff > -7) return rtf.format(diff, "day");
  if (diff > -31) return rtf.format(Math.round(diff / 7), "week");
  return rtf.format(Math.round(diff / 30), "month");
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(new Date(iso));
}

export function pluralCredits(n: number): string {
  return `${n} ${n === 1 ? "credito" : "crediti"}`;
}
