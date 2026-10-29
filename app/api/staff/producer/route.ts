import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireStaff, saveProducerProfile } from "@/lib/beats/server/staff";

/** Profilo pubblico del producer collegato all'account. */
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await requireStaff();
    const producer = await saveProducerProfile(viewer, await readJson(request));
    return Response.json({ producer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
