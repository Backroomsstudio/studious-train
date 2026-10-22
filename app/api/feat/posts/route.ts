import { featPostSchema, parseFeatFilters } from "@/lib/beats/feat";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse, StoreError } from "@/lib/beats/server/errors";
import { featThrottle } from "@/lib/beats/server/feat-throttle";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { currentUserId, requireUserId } from "@/lib/beats/server/session";

/** Bacheca "Cerco feat": la leggono tutti, anche senza accesso. Filtri: `?role=strofa&genre=trap`. */
export async function GET(request: Request) {
  try {
    const filters = parseFeatFilters(new URL(request.url).searchParams);
    const posts = await (await getBackend()).featPosts(await currentUserId(), filters);
    return Response.json({ posts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Pubblica un annuncio (serve l'accesso). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const userId = await requireUserId();
    featThrottle("post", userId);
    const parsed = featPostSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Annuncio non valido.");
    const post = await (await getBackend()).createFeatPost(userId, parsed.data);
    return Response.json({ post }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
