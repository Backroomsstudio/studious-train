import { timingSafeEqual } from "node:crypto";
import { runScheduledJobs } from "@/lib/beats/server/billing";
import { storeEnv } from "@/lib/beats/server/env";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";

/**
 * Lavori pianificati (da chiamare ogni ora, es. Vercel Cron o cron-job.org):
 * crediti mensili dei piani annuali e chiusura delle aste. Protetto da `CRON_SECRET`.
 */
export async function GET(request: Request) {
  try {
    const secret = storeEnv.cronSecret;
    if (!secret || storeEnv.demoMode) throw new StoreError("NOT_CONFIGURED", "Cron non configurato.");
    const given = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new StoreError("UNAUTHENTICATED");
    return Response.json(await runScheduledJobs(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
