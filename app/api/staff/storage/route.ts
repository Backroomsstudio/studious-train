import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, requestOrigin } from "@/lib/beats/server/http";
import { requireStaff } from "@/lib/beats/server/staff";
import { allowBrowserUploads } from "@/lib/beats/server/storage";
import { storeEnv } from "@/lib/beats/server/env";

/**
 * Prepara il bucket per i caricamenti dal browser (regola CORS per l'origine del sito).
 * Su R2 serve una volta; altri S3 (es. Supabase Storage) gestiscono il CORS da soli.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    if (!storeEnv.r2.config) throw new StoreError("NOT_CONFIGURED", "Archivio file non configurato: mancano le chiavi R2.");
    const origins = [...new Set([requestOrigin(request), storeEnv.siteUrl])];
    try {
      await allowBrowserUploads(origins);
      return Response.json({ ok: true, message: "Archivio pronto per i caricamenti." });
    } catch {
      return Response.json({ ok: true, message: "Questo archivio gestisce il CORS da solo: nessuna modifica necessaria." });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
