import { recapForSession } from "../../src/booking/book.ts";
import { stripeConfigured } from "../../src/booking/server-config.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/riepilogo?session_id=cs_… — riepilogo dell'ordine per il pop-up dopo il pagamento su Stripe.
 * Solo chi ha l'id della sessione (lungo e casuale) lo vede; niente email né telefono del cliente.
 */
export default async (req: Request) => {
  const id = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return json({ error: "Sessione non valida" }, 400);
  if (!stripeConfigured) return json({ error: "Pagamenti non attivi" }, 503);
  try {
    const recap = await recapForSession(id);
    if (!recap) return json({ error: "Ordine non trovato" }, 404);
    return json({ riepilogo: recap });
  } catch (e) {
    console.error("[riepilogo]", e);
    return json({ error: "Riepilogo non disponibile" }, 502);
  }
};

export const config = { path: "/api/riepilogo" };
