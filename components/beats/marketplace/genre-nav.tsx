"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEFAULT_FILTERS, filtersToParams } from "@/lib/beats/filters";
import { genreColor } from "@/lib/beats/genres";
import type { Facets, SearchResult } from "@/lib/beats/types";
import { api } from "../providers";
import { TrackList } from "./track-row";

const parentsOf = (facets: Facets) => facets.genres.filter((g) => !g.parent);
const countFor = (facets: Facets, slug: string) =>
  facets.genres.filter((g) => g.slug === slug || g.parent === slug).reduce((n, g) => n + g.count, 0);

/**
 * Schede dei generi principali: colore, numero di beat e sottogeneri. Selezionarne una filtra
 * il catalogo; sotto compaiono i sottogeneri (Trap → Plugg, Rage).
 */
export function GenreTabs({
  facets,
  selected,
  onSelect,
}: {
  facets: Facets;
  selected: string[];
  onSelect: (genres: string[]) => void;
}) {
  const parents = parentsOf(facets);
  const active = parents.find((p) => selected.includes(p.slug) || facets.genres.some((g) => g.parent === p.slug && selected.includes(g.slug)));
  const subs = active ? facets.genres.filter((g) => g.parent === active.slug) : [];

  return (
    <div className="space-y-2">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:px-0" role="tablist" aria-label="Generi">
        {parents.map((g) => {
          const on = active?.slug === g.slug;
          const color = genreColor(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(on ? [] : [g.slug])}
              style={{ "--g": color } as React.CSSProperties}
              className={cn(
                "relative flex h-20 w-36 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-4 text-left transition active:scale-[0.97] lg:w-auto",
                "chrome-pink",
                on ? "ring-2 ring-electric ring-offset-2 ring-offset-chrome-50" : "opacity-90 hover:opacity-100",
              )}
            >
              <span className="font-display text-lg font-semibold tracking-tight">{g.name}</span>
              <span className="text-xs font-semibold text-white/70">{countFor(facets, g.slug)} beat</span>
            </button>
          );
        })}
      </div>
      {subs.length > 0 && active && (
        <div className="flex flex-wrap items-center gap-2 pl-2" role="group" aria-label={`Sottogeneri di ${active.name}`}>
          <button
            type="button"
            onClick={() => onSelect([active.slug])}
            className={cn(
              "h-8 rounded-full px-4 text-xs font-semibold transition",
              selected.includes(active.slug) ? "bg-graphite text-white" : "chrome-surface text-graphite-700",
            )}
          >
            Tutto {active.name}
          </button>
          {subs.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => onSelect([s.slug])}
              className={cn(
                "h-8 rounded-full px-4 text-xs font-semibold transition",
                selected.includes(s.slug) ? "bg-graphite text-white" : "chrome-surface text-graphite-700",
              )}
            >
              {s.name} <span className="opacity-50">{s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Catalogo diviso per genere: uno scaffale per genere con i 4 beat più recenti e "Vedi tutti". */
export function GenreShelves({ facets, onSelect }: { facets: Facets; onSelect: (genres: string[]) => void }) {
  const parents = parentsOf(facets).filter((g) => countFor(facets, g.slug) > 0);
  const queries = useQueries({
    queries: parents.map((g) => {
      const params = filtersToParams({ ...DEFAULT_FILTERS, genres: [g.slug] }).toString();
      return { queryKey: ["beats", params], queryFn: () => api<SearchResult>(`/api/beats?${params}`) };
    }),
  });

  return (
    <div className="space-y-8">
      {parents.map((g, i) => {
        const result = queries[i]?.data;
        const color = genreColor(g.slug);
        const subs = facets.genres.filter((s) => s.parent === g.slug).map((s) => s.name);
        return (
          <section key={g.slug} aria-labelledby={`shelf-${g.slug}`} className="space-y-2">
            <div className="flex items-end justify-between gap-4 border-b border-chrome-300/60 pb-2">
              <div className="flex items-center gap-4">
                <span className="h-9 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
                <div>
                  <h3 id={`shelf-${g.slug}`} className="font-display text-xl font-semibold tracking-tight">
                    {g.name} <span className="text-chrome-400">· {result?.total ?? countFor(facets, g.slug)}</span>
                  </h3>
                  {subs.length > 0 && <p className="text-xs text-chrome-500">anche {subs.join(", ")}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelect([g.slug])}
                className="inline-flex shrink-0 items-center gap-2 text-[13px] font-semibold text-electric hover:underline"
              >
                Vedi tutti <ArrowRight className="size-3.5" />
              </button>
            </div>
            {result ? (
              <TrackList beats={result.items.slice(0, 4)} />
            ) : (
              <div className="h-24 animate-pulse rounded-2xl bg-chrome-200/60" aria-label="Caricamento" />
            )}
          </section>
        );
      })}
    </div>
  );
}
