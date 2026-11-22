import type { NextRequest } from "next/server";
import { BookingError, createBooking, parseOrder } from "@/lib/booking/book";
import { getService } from "@/lib/booking/catalog";
import { calendarConfigured, stripeConfigured } from "@/lib/booking/server-config";

/** POST /api/prenota — crea la prenotazione e restituisce dove mandare il cliente (Stripe o conferma). */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  try {
    const order = parseOrder(body);
    const service = getService(order.serviceId)!;
    if (service.where === "studio" && !calendarConfigured) throw new BookingError("Le prenotazioni online non sono ancora attive", 503);
    if (order.payment === "online" && !stripeConfigured) throw new BookingError("I pagamenti online non sono ancora attivi", 503);

    const { redirectUrl } = await createBooking(order, request.nextUrl.origin);
    return Response.json({ redirectUrl });
  } catch (e) {
    if (e instanceof BookingError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[prenota]", e);
    return Response.json({ error: "Qualcosa è andato storto: riprova o scrivici su WhatsApp." }, { status: 500 });
  }
}
