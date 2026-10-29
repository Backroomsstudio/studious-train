/**
 * Stems d'ascolto del mixer: le quattro parti in cui è diviso ogni beat con gli stems.
 * Condiviso tra server (validazione della route) e client (etichette e colori del mixer).
 */
export const STEM_NAMES = ["drums", "bass", "keys", "fx"] as const;
export type StemName = (typeof STEM_NAMES)[number];

export const STEM_INFO: Record<StemName, { label: string; color: string }> = {
  drums: { label: "Batteria", color: "#e0306c" },
  bass: { label: "808", color: "#c9c9ce" },
  keys: { label: "Accordi", color: "#e0306c" },
  fx: { label: "FX", color: "#66666d" },
};

export function isStemName(value: unknown): value is StemName {
  return typeof value === "string" && (STEM_NAMES as readonly string[]).includes(value);
}

export const stemUrl = (beatId: string, stem: StemName) => `/api/beats/${encodeURIComponent(beatId)}/stems/${stem}`;
