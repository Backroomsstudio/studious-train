import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

/** Chiude l'annuncio (solo l'autore): sparisce dalla bacheca, le chat già aperte restano. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const { id } = await params;
    const post = await (await getBackend()).closeFeatPost(userId, id);
    return Response.json({ post }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
