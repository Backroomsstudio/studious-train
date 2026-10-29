import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { presignObject } from "@/lib/beats/server/storage";

/** Demo d'ascolto di un kit: URL firmato per 10 minuti (il bucket resta privato). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = await (await getBackend()).productPreview(id);
    if (target?.kind !== "r2") throw new StoreError("NOT_FOUND", "Demo non disponibile.");
    const url = await presignObject(target.objectKey, { expiresIn: 600, contentType: target.contentType });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
