import { z } from "zod";
import { SERVICE_ORDER, type ServiceKind } from "@/lib/beats/offers";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson, requestOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";
import type { PurchaseResponse } from "@/lib/beats/types";

const bodySchema = z.object({
  kind: z.enum(SERVICE_ORDER as [ServiceKind, ...ServiceKind[]]),
  tierId: z.string().max(40),
  beatId: z.string().max(60).optional(),
  notes: z.string().trim().min(10, "Raccontaci il progetto in poche parole (almeno 10 caratteri).").max(1000),
  scheduledFor: z
    .string()
    .datetime({ offset: true })
    .refine((d) => new Date(d).getTime() > Date.now() - 86_400_000, "Scegli una data futura.")
    .optional(),
  paidWith: z.enum(["CREDITS", "CARD"]),
});

/** Ordine di un servizio dello studio: in crediti è confermato subito, con carta passa da Stripe. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Richiesta non valida.");
    const result: PurchaseResponse = await (await getBackend()).orderService(userId, parsed.data, requestOrigin(request));
    return Response.json(result, { status: result.kind === "done" ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
