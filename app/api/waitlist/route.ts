import { z } from "zod";
import { storeEnv } from "@/lib/beats/server/env";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { getDb } from "@/lib/beats/server/prisma";
import { hashIp } from "@/lib/beats/server/session";
import { createThrottle } from "@/lib/beats/server/throttle";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  artistName: z.string().trim().max(32).optional(),
});
/** 5 iscrizioni ogni 10 minuti per IP: basta contro chi riempie la lista a raffica. */
const throttle = createThrottle(5, 10 * 60_000);

/** Lista d'attesa del lancio: solo email e nome facoltativo, per l'avviso di apertura. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const key = hashIp(request) ?? "anon";
    if (throttle.blocked(key)) throw new StoreError("RATE_LIMITED");
    throttle.hit(key);
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", "Inserisci un'email valida.");
    const { email, artistName } = parsed.data;
    // In demo non c'è un database: l'iscrizione si simula.
    if (!storeEnv.demoMode) {
      await getDb().waitlistEntry.upsert({
        where: { email },
        create: { email, artistName: artistName || null },
        update: artistName ? { artistName } : {},
      });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
