import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { currentUserId } from "@/lib/beats/server/session";

/** Stato dell'asta (letto in polling dalla pagina dell'asta). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auction = await (await getBackend()).auction(id, await currentUserId());
    if (!auction) throw new StoreError("NOT_FOUND", "Asta non trovata.");
    return Response.json({ auction }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
