import { cancelHold, eventIdsFrom } from "../../src/booking/book.ts";

/** Il cliente torna indietro da Stripe senza pagare: si liberano subito gli orari e si torna al checkout. */
export default async (req: Request) => {
  const url = new URL(req.url);
  const ids = eventIdsFrom({ eventi: url.searchParams.get("eventi") ?? undefined, evento: url.searchParams.get("evento") ?? undefined });
  if (ids.length) {
    try {
      await cancelHold(ids);
    } catch (e) {
      // Se fallisce, gli orari si liberano comunque alla scadenza della sessione Stripe (webhook "expired").
      console.error("[annulla]", e);
    }
  }
  return Response.redirect(new URL("/prenota/?annullato=1", url.origin).toString(), 303);
};

export const config = { path: "/api/prenota/annulla" };
