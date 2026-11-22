import type { NextRequest } from "next/server";
import { cancelHold } from "@/lib/booking/book";

/** Il cliente torna indietro da Stripe senza pagare: si libera subito lo slot e si torna al checkout. */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("evento") ?? "";
  if (/^[a-v0-9]{5,1024}$/.test(eventId)) {
    try {
      await cancelHold(eventId);
    } catch (e) {
      // Se fallisce, lo slot si libera comunque alla scadenza della sessione Stripe (webhook "expired").
      console.error("[annulla]", e);
    }
  }
  return Response.redirect(new URL("/prenota?annullato=1", request.nextUrl.origin), 303);
}
