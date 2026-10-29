import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireStaff, saveProduct } from "@/lib/beats/server/staff";

/** Nuovo loop kit, sample kit, drum kit o preset. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    const product = await saveProduct(await readJson(request));
    return Response.json({ product }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
