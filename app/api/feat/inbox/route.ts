import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse } from "@/lib/beats/server/errors";
import { currentUserId } from "@/lib/beats/server/session";
import type { FeatInbox } from "@/lib/beats/types";

/** "I tuoi messaggi" con i non letti. Senza accesso risponde vuoto (il badge in nav resta spento). */
export async function GET() {
  try {
    const userId = await currentUserId();
    const inbox: FeatInbox = userId ? await (await getBackend()).featInbox(userId) : { threads: [], unread: 0 };
    return Response.json(inbox, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
