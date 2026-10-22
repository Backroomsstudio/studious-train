"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BeatCover } from "@/components/beats/ui/beat-cover";
import { Dialog } from "@/components/beats/ui/dialog";
import { GlowBadge } from "@/components/beats/ui/glow-badge";
import { cn } from "@/lib/cn";
import { fuzzyScore } from "@/lib/beats/fuzzy";
import { keyName } from "@/lib/beats/music";
import type { BeatSummary } from "@/lib/beats/types";

/** Foglio "Cambia beat": ricerca nel catalogo, i beat che possiedi in cima. */
export function BeatPicker({
  open,
  onOpenChange,
  beats,
  ownedIds,
  currentId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beats: BeatSummary[];
  ownedIds: string[];
  currentId: string | undefined;
  onPick: (beat: BeatSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);

  const list = useMemo(() => {
    const q = query.trim();
    const base = [...beats].sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)));
    if (!q) return base;
    return base
      .map((b) => ({
        b,
        score: fuzzyScore(q, [b.title, ...b.producers.map((p) => p.name), ...b.genres.map((g) => g.name), ...b.typeTags.map((t) => t.name), ...b.moods, `${b.bpm}`].join(" ")),
      }))
      .filter((x) => x.score > 0.25)
      .sort((x, y) => y.score - x.score)
      .map((x) => x.b);
  }, [beats, owned, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Su che beat registri?" description="Autotune e preset seguono tonalità e genere del beat che scegli.">
      <label className="chrome-surface flex h-11 items-center gap-2 rounded-full px-4">
        <Search className="size-4 text-chrome-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titolo, produttore, genere, BPM…"
          aria-label="Cerca un beat"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-chrome-400"
        />
      </label>
      <ul className="mt-4 grid max-h-[55dvh] gap-1.5 overflow-y-auto pr-1">
        {list.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onPick(b)}
              aria-current={b.id === currentId}
              className={cn(
                "flex w-full min-w-0 items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/80",
                b.id === currentId && "bg-electric-50 ring-1 ring-electric/30",
              )}
            >
              <BeatCover beat={b} size="sm" />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-display text-[15px] text-graphite">{b.title}</b>
                <span className="block truncate text-xs text-chrome-500">
                  {b.producers.map((p) => p.name).join(" & ")} · {b.bpm} BPM · {keyName(b.key)}
                </span>
              </span>
              {owned.has(b.id) && <GlowBadge tone="ok">Tuo</GlowBadge>}
            </button>
          </li>
        ))}
        {!list.length && <li className="py-8 text-center text-sm text-chrome-500">Nessun beat trovato per “{query}”.</li>}
      </ul>
    </Dialog>
  );
}
