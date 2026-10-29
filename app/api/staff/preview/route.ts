import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { requireStaff, staffPreviewKey } from "@/lib/beats/server/staff";
import { presignObject } from "@/lib/beats/server/storage";

/** Ascolto dell'anteprima di un beat o di un kit in qualunque stato (bozze e uscite programmate comprese). */
export async function GET(request: Request) {
  try {
    await requireStaff();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "product" ? "product" : "beat";
    const key = await staffPreviewKey(kind, url.searchParams.get("id") ?? "");
    if (!key) throw new StoreError("NOT_FOUND", "Anteprima non caricata.");
    const signed = await presignObject(key, { expiresIn: 600, contentType: "audio/mpeg" });
    return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
