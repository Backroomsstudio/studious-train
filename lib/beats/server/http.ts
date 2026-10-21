import "server-only";
import { StoreError } from "./errors";

/** Le mutazioni accettano solo richieste dalla stessa origine (difesa CSRF oltre ai cookie SameSite). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // richieste non-browser (es. test): i cookie di sessione restano necessari
  if (new URL(origin).host !== new URL(request.url).host) throw new StoreError("BAD_REQUEST", "Origine non valida.");
}

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new StoreError("BAD_REQUEST", "JSON non valido.");
  }
}

/** Risposta audio con supporto Range: senza, i browser non permettono il seek nell'anteprima. */
export function audioResponse(
  request: Request,
  body: Buffer,
  options: { contentType: string; filename?: string; cache: string },
): Response {
  const headers = new Headers({
    "Content-Type": options.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": options.cache,
  });
  if (options.filename) headers.set("Content-Disposition", `attachment; filename="${options.filename.replace(/"/g, "")}"`);

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = body.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(body.subarray(start, end + 1)), { status: 206, headers });
  }
  headers.set("Content-Length", String(body.length));
  return new Response(new Uint8Array(body), { status: 200, headers });
}
