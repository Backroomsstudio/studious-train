import { getBackend } from "@/lib/beats/server/backend";
import { storeEnv } from "@/lib/beats/server/env";
import { errorResponse } from "@/lib/beats/server/errors";

/**
 * Dati pubblici per l'overlay della diretta TikTok (app overlay-live): asta in corso con le ultime
 * offerte e coda dei pezzi da ascoltare. Solo nomi d'artista, niente dati personali.
 */
function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = storeEnv.overlayOrigins;
  if (allowed.includes("*")) return { "Access-Control-Allow-Origin": "*" };
  return origin && allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

export async function GET(request: Request) {
  try {
    const overlay = await (await getBackend()).liveOverlay();
    return Response.json(overlay, { headers: { ...cors(request), "Cache-Control": "public, max-age=2" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: { ...cors(request), "Access-Control-Allow-Methods": "GET" } });
}
