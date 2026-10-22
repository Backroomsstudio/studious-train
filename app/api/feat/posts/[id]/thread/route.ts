import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

/** "Rispondi": apre (o ritrova) la chat privata con l'autore dell'annuncio. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const { id } = await params;
    const thread = await (await getBackend()).openFeatThread(userId, id);
    return Response.json({ thread }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
