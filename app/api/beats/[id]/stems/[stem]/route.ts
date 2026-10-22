import { getBackend } from "@/lib/beats/server/backend";
import { demoBeatById } from "@/lib/beats/server/demo-backend";
import { renderDemoStem } from "@/lib/beats/server/demo-audio";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { audioResponse } from "@/lib/beats/server/http";
import { presignObject } from "@/lib/beats/server/storage";
import { isStemName } from "@/lib/beats/stems";

/**
 * Anteprima di uno stem (batteria, 808, accordi, FX) per il mixer della pagina del beat:
 * come l'anteprima completa è libera e a basso bitrate (gli stems veri arrivano solo con la licenza).
 * In produzione reindirizza a un URL R2 firmato per 10 minuti.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; stem: string }> }) {
  try {
    const { id, stem } = await params;
    if (!isStemName(stem)) throw new StoreError("BAD_REQUEST", "Stem non valido.");
    const target = await (await getBackend()).stemPreview(id, stem);
    if (!target) throw new StoreError("NOT_FOUND", "Stems non disponibili per questo beat.");

    if (target.kind === "demo") {
      const beat = demoBeatById(target.beatId)!;
      return audioResponse(request, renderDemoStem(beat, stem), {
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
