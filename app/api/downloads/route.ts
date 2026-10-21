import type { NextRequest } from "next/server";
import { getBackend } from "@/lib/beats/server/backend";
import { demoBeatById } from "@/lib/beats/server/demo-backend";
import { renderDemoPreview } from "@/lib/beats/server/demo-audio";
import { verifyDownloadGrant } from "@/lib/beats/server/download-grant";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { audioResponse } from "@/lib/beats/server/http";
import { currentUserId, hashIp } from "@/lib/beats/server/session";
import { presignObject } from "@/lib/beats/server/storage";

/**
 * Download protetto in tre controlli:
 * 1. permesso HMAC valido e non scaduto (emesso dallo sblocco o dalla libreria);
 * 2. sessione dello stesso utente a cui è stato emesso;
 * 3. licenza ancora attiva e che include il file richiesto (ricontrollata sul DB).
 * Solo allora si firma un URL R2 valido 60 secondi e si reindirizza: un semplice <a href> funziona
 * anche su Safari iOS e il file non passa mai dal nostro server.
 */
export async function GET(request: NextRequest) {
  try {
    const grant = verifyDownloadGrant(request.nextUrl.searchParams.get("grant") ?? "");
    if (!grant) throw new StoreError("INVALID_GRANT");
    const userId = await currentUserId();
    if (!userId) throw new StoreError("UNAUTHENTICATED");
    if (userId !== grant.userId) throw new StoreError("INVALID_GRANT");

    const target = await (await getBackend()).resolveDownload(userId, grant.licenseId, grant.asset, {
      ipHash: hashIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    if (target.kind === "demo") {
      return audioResponse(request, renderDemoPreview(demoBeatById(target.beatId)!), {
        contentType: "audio/wav",
        filename: target.filename,
        cache: "private, no-store",
      });
    }
    const url = await presignObject(target.objectKey, {
      expiresIn: 60,
      downloadName: target.filename,
      contentType: target.contentType,
    });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
