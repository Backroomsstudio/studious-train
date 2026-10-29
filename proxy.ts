import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { gateExempt, isStaffRole, parseLaunchAt, storeOpen } from "@/lib/beats/launch";

/**
 * Cancello del lancio: fino a `STORE_LAUNCH_AT` il negozio è dello staff. Il pubblico vede la pagina
 * "presto online" (stesso URL, contenuto riscritto) e le API del catalogo rispondono 403.
 * Dopo la data il proxy lascia passare tutto senza leggere nulla.
 */
export async function proxy(request: NextRequest) {
  if (storeOpen(parseLaunchAt(process.env.STORE_LAUNCH_AT))) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (gateExempt(pathname)) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const token = secret ? await getToken({ req: request, secret, secureCookie: request.nextUrl.protocol === "https:" }) : null;
  if (isStaffRole(token?.role)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return Response.json(
      { error: { code: "NOT_LAUNCHED", message: "Il negozio non è ancora aperto." } },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.rewrite(new URL("/beats/presto", request.url));
}

export const config = {
  matcher: ["/beats/:path*", "/api/:path*"],
};
