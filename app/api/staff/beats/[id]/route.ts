import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireStaff, saveBeat } from "@/lib/beats/server/staff";

/** Modifica di un beat: dati, file, stato e data di uscita. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    const { id } = await params;
    const beat = await saveBeat(await readJson(request), id);
    return Response.json({ beat }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
