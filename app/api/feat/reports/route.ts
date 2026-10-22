import { featReportSchema } from "@/lib/beats/feat";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { featThrottle } from "@/lib/beats/server/feat-throttle";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

/** Segnala un annuncio o un messaggio: lo staff controlla a mano. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    featThrottle("report", userId);
    const parsed = featReportSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Segnalazione non valida.");
    await (await getBackend()).reportFeat(userId, parsed.data);
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
