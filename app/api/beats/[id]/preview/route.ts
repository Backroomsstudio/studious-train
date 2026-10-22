import { getBackend } from "@/lib/beats/server/backend";
import { demoBeatById } from "@/lib/beats/server/demo-backend";
import { renderDemoPreview } from "@/lib/beats/server/demo-audio";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { audioResponse } from "@/lib/beats/server/http";
import { presignObject } from "@/lib/beats/server/storage";

/**
 * Anteprima d'ascolto: l'unico file disponibile senza licenza, a basso bitrate e con watermark.
 * In produzione reindirizza a un URL R2 firmato per 10 minuti (il bucket resta privato).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = await (await getBackend()).preview(id);
    if (!target) throw new StoreError("NOT_FOUND", "Beat non trovato.");

    if (target.kind === "demo") {
      const beat = demoBeatById(target.beatId)!;
      return audioResponse(request, renderDemoPreview(beat), {
        contentType: "audio/wav",
        cache: "public, max-age=86400, immutable",
      });
    }
    if (target.kind === "text") throw new StoreError("NOT_FOUND", "File non disponibile.");
    const url = await presignObject(target.objectKey, { expiresIn: 600, contentType: target.contentType });
    return Response.redirect(url, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
