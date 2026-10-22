import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { requireUserId } from "@/lib/beats/server/session";
import { presignObject } from "@/lib/beats/server/storage";

/** Download di un prodotto acquistato: controllo dell'acquisto, poi URL R2 firmato per 60 secondi. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const target = await (await getBackend()).productDownload(userId, id);
    if (target.kind === "text") {
      return new Response(target.body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${target.filename.replace(/"/g, "")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (target.kind !== "r2") throw new StoreError("NOT_FOUND", "File non disponibile.");
    const url = await presignObject(target.objectKey, { expiresIn: 60, downloadName: target.filename, contentType: target.contentType });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
