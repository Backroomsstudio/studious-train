import { createPortalSession } from "@/lib/beats/server/billing";
import { storeEnv } from "@/lib/beats/server/env";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, requestOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

/** Portale clienti Stripe: cambio piano, metodo di pagamento, fatture, disdetta. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (storeEnv.demoMode) throw new StoreError("NOT_CONFIGURED", "Modalità demo: i pagamenti sono disattivati.");
    const userId = await requireUserId();
    return Response.json({ url: await createPortalSession(userId, requestOrigin(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
