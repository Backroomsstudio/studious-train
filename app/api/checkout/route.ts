import { z } from "zod";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson, requestOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";
import type { PurchaseResponse } from "@/lib/beats/types";

const bodySchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("TOPUP"), packId: z.string().max(40) }),
  z.object({
    purpose: z.literal("GIFT"),
    cardId: z.string().max(40),
    recipientName: z.string().trim().max(60).optional(),
    message: z.string().trim().max(400).optional(),
  }),
  z.object({ purpose: z.literal("AUCTION"), auctionId: z.string().max(60) }),
]);

/** Ricariche, gift card ed esclusive vinte all'asta: il prezzo lo decide sempre il server. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Acquisto non valido.");
    const result: PurchaseResponse = await (await getBackend()).checkout(userId, parsed.data, requestOrigin(request));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
