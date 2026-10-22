import { featMessageSchema } from "@/lib/beats/feat";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { featThrottle } from "@/lib/beats/server/feat-throttle";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireUserId } from "@/lib/beats/server/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    featThrottle("message", userId);
    const { id } = await params;
    const parsed = featMessageSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Messaggio non valido.");
    const message = await (await getBackend()).sendFeatMessage(userId, id, parsed.data.body);
    return Response.json({ message }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
