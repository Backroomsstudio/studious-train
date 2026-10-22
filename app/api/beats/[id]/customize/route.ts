import { z } from "zod";
import { CUSTOMIZATION_NOTES_MAX, CUSTOMIZATION_OPTIONS, type CustomizationOption } from "@/lib/beats/customizations";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";
import type { CustomizationResponse } from "@/lib/beats/types";

const OPTION_IDS = CUSTOMIZATION_OPTIONS.map((o) => o.id) as [CustomizationOption, ...CustomizationOption[]];

const bodySchema = z.object({
  options: z.array(z.enum(OPTION_IDS)).min(1, "Scegli almeno una modifica.").max(OPTION_IDS.length),
  express: z.boolean().default(false),
  notes: z.string().trim().min(10, "Descrivi in poche parole cosa vuoi (almeno 10 caratteri).").max(CUSTOMIZATION_NOTES_MAX),
  referenceUrl: z
    .string()
    .trim()
    .url("Il link di riferimento non è valido.")
    .refine((u) => /^https:\/\//.test(u), "Usa un link https.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Richiede la personalizzazione di un beat: i crediti si scalano subito, la consegna arriva in Libreria. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Richiesta non valida.");
    const result: CustomizationResponse = await (await getBackend()).customize(userId, id, parsed.data);
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
