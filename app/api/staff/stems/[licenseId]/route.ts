import { z } from "zod";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { markStemsSent, requireStaff } from "@/lib/beats/server/staff";

const bodySchema = z.object({ sent: z.boolean() });

/** Segna gli stems di una licenza come mandati in chat (o di nuovo da mandare). */
export async function PATCH(request: Request, { params }: { params: Promise<{ licenseId: string }> }) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST");
    const stemRequest = await markStemsSent((await params).licenseId, parsed.data.sent);
    return Response.json({ request: stemRequest }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
