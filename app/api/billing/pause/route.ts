import { z } from "zod";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

const bodySchema = z.object({ resume: z.boolean().default(false) });

/** Pausa di un mese al posto della disdetta (o ripresa anticipata). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST");
    return Response.json(await (await getBackend()).pause(userId, parsed.data.resume), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
