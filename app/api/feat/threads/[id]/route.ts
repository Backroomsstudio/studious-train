import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse } from "@/lib/beats/server/errors";
import { requireUserId } from "@/lib/beats/server/session";

/** Messaggi della chat (letti in polling dalla finestra aperta): solo per i due partecipanti. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const thread = await (await getBackend()).featThread(userId, id);
    return Response.json({ thread }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
