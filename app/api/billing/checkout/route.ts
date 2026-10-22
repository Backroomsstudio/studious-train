import { z } from "zod";
import { PLAN_ORDER, type PlanTier } from "@/lib/beats/plans";
import { createCheckoutSession } from "@/lib/beats/server/billing";
import { storeEnv } from "@/lib/beats/server/env";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson, requestOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

const bodySchema = z.object({
  tier: z.enum(PLAN_ORDER as [PlanTier, ...PlanTier[]]),
  interval: z.enum(["MONTH", "YEAR"]).default("MONTH"),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (storeEnv.demoMode) throw new StoreError("NOT_CONFIGURED", "Modalità demo: i pagamenti sono disattivati.");
    const userId = await requireUserId();
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Piano non valido.");
    const url = await createCheckoutSession(userId, parsed.data.tier, requestOrigin(request), parsed.data.interval);
    return Response.json({ url });
  } catch (error) {
    return errorResponse(error);
  }
}
