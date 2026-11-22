import type { NextRequest } from "next/server";
import { busyIntervals } from "@/lib/booking/google-calendar";
import { calendarConfigured } from "@/lib/booking/server-config";
import { addDays, DEFAULT_RULES, isValidDay, romeDay, romeToUtc } from "@/lib/booking/slots";

const MAX_DAYS = 14;

/**
 * GET /api/disponibilita?da=YYYY-MM-DD&giorni=7
 * Restituisce solo gli intervalli occupati (inizio/fine): nessun nome o dettaglio delle sessioni.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const today = romeDay(new Date());
  const from = params.get("da") ?? today;
  const days = Math.min(Math.max(Number(params.get("giorni")) || 7, 1), MAX_DAYS);
  if (!isValidDay(from)) return Response.json({ error: "Data non valida" }, { status: 400 });
  if (from > addDays(today, DEFAULT_RULES.horizonDays)) return Response.json({ busy: [], rules: DEFAULT_RULES, now: new Date().toISOString() });

  if (!calendarConfigured) {
    // Solo in locale, per provare la grafica senza Google: BOOKING_DEMO=1 npm run dev
    if (process.env.NODE_ENV === "development" && process.env.BOOKING_DEMO === "1") {
      const demo = Array.from({ length: days }, (_, i) => addDays(from, i)).flatMap((d, i) => [
        { start: romeToUtc(d, 10 + (i % 3)).toISOString(), end: romeToUtc(d, 13 + (i % 3)).toISOString() },
        { start: romeToUtc(d, 18).toISOString(), end: romeToUtc(d, 21).toISOString() },
      ]);
      return Response.json({ busy: demo, rules: DEFAULT_RULES, now: new Date().toISOString() });
    }
    return Response.json({ error: "Calendario non ancora collegato" }, { status: 503 });
  }

  try {
    // Margine di un giorno prima: una sessione iniziata la sera prima può occupare le prime ore.
    const busy = await busyIntervals(romeToUtc(addDays(from, -1), 0), romeToUtc(addDays(from, days + 1), 0));
    return Response.json(
      { busy, rules: DEFAULT_RULES, now: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[disponibilita]", e);
    return Response.json({ error: "Calendario momentaneamente non raggiungibile" }, { status: 502 });
  }
}
