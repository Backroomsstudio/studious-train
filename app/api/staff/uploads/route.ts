import { contentTypeFor, formatOf, uploadKey, uploadRequestSchema, UPLOAD_SLOTS, type UploadSlot } from "@/lib/beats/staff";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireStaff } from "@/lib/beats/server/staff";
import { presignUpload } from "@/lib/beats/server/storage";

/** URL firmato per caricare un file dal browser direttamente sul bucket (30 minuti). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    const parsed = uploadRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Caricamento non valido.");
    const { draftId, filename, size } = parsed.data;
    const slot = parsed.data.slot as UploadSlot;
    const rule = UPLOAD_SLOTS[slot];
    if (formatOf(filename) !== rule.format) throw new StoreError("BAD_REQUEST", `${rule.label}: serve un file .${rule.format}.`);
    if (size > rule.maxBytes) throw new StoreError("BAD_REQUEST", `${rule.label}: il file supera ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`);
    const key = uploadKey(draftId, slot);
    const contentType = contentTypeFor(slot);
    const url = await presignUpload(key, contentType);
    return Response.json({ key, url, contentType }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
