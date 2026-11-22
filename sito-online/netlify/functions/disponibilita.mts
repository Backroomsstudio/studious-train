import { busyIntervals } from "../../src/booking/google-calendar.ts";
import { calendarConfigured } from "../../src/booking/server-config.ts";
import { addDays, DEFAULT_RULES, isValidDay, romeDay, romeToUtc } from "../../src/booking/slots.ts";

const MAX_DAYS = 14;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/disponibilita?da=YYYY-MM-DD&giorni=7
 * Restituisce solo gli intervalli occupati (inizio/fine): nessun nome o dettaglio delle sessioni.
 */
export default async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const today = romeDay(new Date());
  const from = params.get("da") ?? today;
  const days = Math.min(Math.max(Number(params.get("giorni")) || 7, 1), MAX_DAYS);
  if (!isValidDay(from)) return json({ error: "Data non valida" }, 400);
  if (from > addDays(today, DEFAULT_RULES.horizonDays)) return json({ busy: [], rules: DEFAULT_RULES, now: new Date().toISOString() });

  if (!calendarConfigured) {
    // Solo in locale, per provare la grafica senza Google: BOOKING_DEMO=1 npm run dev
    if (process.env.BOOKING_DEMO === "1") {
      const demo = Array.from({ length: days }, (_, i) => addDays(from, i)).flatMap((d, i) => [
        { start: romeToUtc(d, 10 + (i % 3)).toISOString(), end: romeToUtc(d, 13 + (i % 3)).toISOString() },
        { start: romeToUtc(d, 18).toISOString(), end: romeToUtc(d, 21).toISOString() },
      ]);
      return json({ busy: demo, rules: DEFAULT_RULES, now: new Date().toISOString() });
    }
    return json({ error: "Calendario non ancora collegato" }, 503);
  }

  try {
    // Margine di un giorno prima: una sessione iniziata la sera prima può occupare le prime ore.
    const busy = await busyIntervals(romeToUtc(addDays(from, -1), 0), romeToUtc(addDays(from, days + 1), 0));
    return json({ busy, rules: DEFAULT_RULES, now: new Date().toISOString() });
  } catch (e) {
    console.error("[disponibilita]", e);
    return json({ error: "Calendario momentaneamente non raggiungibile" }, 502);
  }
};

export const config = { path: "/api/disponibilita" };
