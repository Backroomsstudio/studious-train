import { cancelHold } from "../../src/booking/book.ts";

/** Il cliente torna indietro da Stripe senza pagare: si libera subito lo slot e si torna al checkout. */
export default async (req: Request) => {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("evento") ?? "";
  if (/^[a-v0-9]{5,1024}$/.test(eventId)) {
    try {
      await cancelHold(eventId);
    } catch (e) {
      // Se fallisce, lo slot si libera comunque alla scadenza della sessione Stripe (webhook "expired").
      console.error("[annulla]", e);
    }
  }
  return Response.redirect(new URL("/prenota/?annullato=1", url.origin).toString(), 303);
};

export const config = { path: "/api/prenota/annulla" };
