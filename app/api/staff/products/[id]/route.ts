import { errorResponse } from "@/lib/beats/server/errors";
import { assertSameOrigin, readJson } from "@/lib/beats/server/http";
import { requireStaff, saveProduct } from "@/lib/beats/server/staff";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requireStaff();
    const { id } = await params;
    const product = await saveProduct(await readJson(request), id);
    return Response.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
