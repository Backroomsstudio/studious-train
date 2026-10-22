/**
 * Stems d'ascolto del mixer: le quattro parti in cui è diviso ogni beat con gli stems.
 * Condiviso tra server (validazione della route) e client (etichette e colori del mixer).
 */
export const STEM_NAMES = ["drums", "bass", "keys", "fx"] as const;
export type StemName = (typeof STEM_NAMES)[number];

export const STEM_INFO: Record<StemName, { label: string; color: string }> = {
  drums: { label: "Batteria", color: "#ff453a" },
  bass: { label: "808", color: "#ff9f0a" },
  keys: { label: "Accordi", color: "#00e5ff" },
  fx: { label: "FX", color: "#bf5af2" },
};

export function isStemName(value: unknown): value is StemName {
  return typeof value === "string" && (STEM_NAMES as readonly string[]).includes(value);
}

export const stemUrl = (beatId: string, stem: StemName) => `/api/beats/${encodeURIComponent(beatId)}/stems/${stem}`;
