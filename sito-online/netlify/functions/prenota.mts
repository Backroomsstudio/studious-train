import { BookingError, createBooking, parseOrder } from "../../src/booking/book.ts";
import { calendarConfigured, stripeConfigured } from "../../src/booking/server-config.ts";

/** POST /api/prenota — crea la prenotazione e restituisce dove mandare il cliente (Stripe o conferma). */
export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Metodo non consentito", { status: 405 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  try {
    const order = parseOrder(body);
    if (order.appointments.length && !calendarConfigured) throw new BookingError("Le prenotazioni online non sono ancora attive", 503);
    if (order.payment === "online" && !stripeConfigured) throw new BookingError("I pagamenti online non sono ancora attivi", 503);

    const { redirectUrl } = await createBooking(order, new URL(req.url).origin);
    return Response.json({ redirectUrl });
  } catch (e) {
    if (e instanceof BookingError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[prenota]", e);
    return Response.json({ error: "Qualcosa è andato storto: riprova o scrivici su WhatsApp." }, { status: 500 });
  }
};

export const config = { path: "/api/prenota" };
