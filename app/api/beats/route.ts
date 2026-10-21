import type { NextRequest } from "next/server";
import { parseFilters } from "@/lib/beats/filters";
import { getBackend } from "@/lib/beats/server/backend";
import { errorResponse } from "@/lib/beats/server/errors";

/** Ricerca nel catalogo: GET /api/beats?q=…&producers=astral,freya&bpmMin=120&key=9m&compatible=1 */
export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const result = await (await getBackend()).search(filters);
    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
