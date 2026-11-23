// @ts-ignore: modulo JavaScript senza tipi
import { renderParts } from "../../src/recensioni/core.mjs";

/**
 * GET /api/recensioni — le recensioni Google già impaginate, lette da data/recensioni.json su GitHub.
 * Così un commit "[skip netlify]" con le recensioni nuove arriva sul sito senza consumare un deploy.
 * La CDN di Netlify tiene la risposta 30 minuti: la funzione gira al massimo un paio di volte l'ora.
 */
const RAW =
  "https://raw.githubusercontent.com/Backroomsstudio/studious-train/refs/heads/claude/busy-knuth-qedjne/sito-online/data/recensioni.json";

export default async () => {
  try {
    const res = await fetch(RAW, { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.recensioni) || data.recensioni.length === 0) throw new Error("dati vuoti");
    return Response.json(renderParts(data), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, durable, max-age=1800, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.error("[recensioni]", e);
    return Response.json({ error: "Recensioni momentaneamente non disponibili" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};

export const config = { path: "/api/recensioni" };
