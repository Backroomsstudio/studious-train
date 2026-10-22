import { z } from "zod";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson, requestOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";
import type { PurchaseResponse } from "@/lib/beats/types";

const bodySchema = z.object({ paidWith: z.enum(["CREDITS", "CARD"]) });

/** Drum kit, sample pack e preset: in crediti (dal saldo) o con carta. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Metodo di pagamento non valido.");
    const result: PurchaseResponse = await (await getBackend()).buyProduct(userId, id, parsed.data.paidWith, requestOrigin(request));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
