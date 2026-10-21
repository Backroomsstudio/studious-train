import { z } from "zod";
import { LICENSE_ORDER, LICENSES, type LicenseType } from "@/lib/beats/licenses";
import { getBackend } from "@/lib/beats/server/backend";
import { issueDownloadGrant } from "@/lib/beats/server/download-grant";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";
import type { UnlockResponse } from "@/lib/beats/types";

const bodySchema = z.object({ license: z.enum(LICENSE_ORDER as [LicenseType, ...LicenseType[]]) });

/**
 * Sblocca una licenza con i crediti. Addebito, licenza e riga del mastro avvengono in un'unica
 * transazione; la risposta contiene i link di download firmati per i file inclusi.
 * Ripetere la richiesta per una licenza già posseduta non addebita nulla.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Licenza non valida.");

    const result = await (await getBackend()).unlock(userId, id, parsed.data.license);
    const body: UnlockResponse = {
      ...result,
      downloads: LICENSES[result.license.type].assets.map((asset) => ({
        asset,
        url: `/api/downloads?grant=${issueDownloadGrant({ userId, licenseId: result.license.id, asset })}`,
      })),
    };
    return Response.json(body, { status: result.alreadyOwned ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
