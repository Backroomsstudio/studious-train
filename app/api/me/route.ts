import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse } from "@/lib/beats/server/errors";
import { currentUserId } from "@/lib/beats/server/session";

/** Profilo, saldo crediti, piano e licenze possedute dell'utente collegato. */
export async function GET() {
  try {
    const userId = await currentUserId();
    const viewer = userId ? await (await getBackend()).viewer(userId) : null;
    return Response.json({ viewer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
