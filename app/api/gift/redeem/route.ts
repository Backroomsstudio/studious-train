import { z } from "zod";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { hashIp, requireUserId } from "@/lib/beats/server/session";
import { createThrottle } from "@/lib/beats/server/throttle";

const bodySchema = z.object({ code: z.string().trim().min(6).max(32) });
/** 10 tentativi ogni 15 minuti per utente e IP: i codici non si indovinano a raffica. */
const throttle = createThrottle(10, 15 * 60_000);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    const key = `${userId}:${hashIp(request) ?? ""}`;
    if (throttle.blocked(key)) throw new StoreError("BAD_REQUEST", "Troppi tentativi: riprova tra qualche minuto.");
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Inserisci il codice della gift card.");
    try {
      const result = await (await getBackend()).redeemGift(userId, parsed.data.code);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      throttle.hit(key);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
