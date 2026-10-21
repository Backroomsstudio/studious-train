import "server-only";
import { cache } from "react";
import { getBackend } from "./backend";
import { currentUserId } from "./session";

/** Letture deduplicate per richiesta (layout e pagina condividono lo stesso risultato). */
export const getViewer = cache(async () => {
  const userId = await currentUserId();
  return userId ? (await getBackend()).viewer(userId) : null;
});

export const getFacets = cache(async () => (await getBackend()).facets());
