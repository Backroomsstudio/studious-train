import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireStaff, saveBeat } from "@/lib/beats/server/staff";

/** Nuovo beat dalla Gestione (bozza, pubblicato o programmato). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    const beat = await saveBeat(await readJson(request));
    return Response.json({ beat }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
