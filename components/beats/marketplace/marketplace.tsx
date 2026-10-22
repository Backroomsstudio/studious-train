"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { activeFilterCount, DEFAULT_FILTERS, filtersToParams, type BeatFilters } from "@/lib/beats/filters";
import type { Facets, SearchResult } from "@/lib/beats/types";
import { api } from "../providers";
import { FilterBar, type FiltersPatch } from "./filter-bar";
import { GenreShelves, GenreTabs } from "./genre-nav";
import { TrackList } from "./track-row";

/**
 * Catalogo con filtri istantanei. I filtri vivono nell'URL (condivisibili, tasto indietro),
 * i risultati nella cache di TanStack Query: tornare a una ricerca già fatta è immediato e
 * durante il caricamento resta visibile la lista precedente (niente salti di layout).
 */
export function Marketplace({
  initialFilters,
  initialResult,
  facets,
  autoFocusSearch,
  syncUrl = true,
  defaultLayout = "genre",
  className,
}: {
  initialFilters: BeatFilters;
  initialResult: SearchResult;
  facets: Facets;
  autoFocusSearch?: boolean;
  syncUrl?: boolean;
  /** "genre": catalogo diviso in scaffali per genere quando non ci sono filtri attivi. */
  defaultLayout?: "genre" | "list";
  className?: string;
}) {
  const [layout, setLayout] = useState<"genre" | "list">(defaultLayout);
  const [filters, setFilters] = useState(initialFilters);
  const params = filtersToParams(filters).toString();
  const initialParams = useRef(filtersToParams(initialFilters).toString());
  const topRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["beats", params],
    queryFn: ({ signal }) => api<SearchResult>(`/api/beats?${params}`, { signal }),
    initialData: params === initialParams.current ? initialResult : undefined,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!syncUrl) return;
    const url = `${window.location.pathname}${params ? `?${params}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [params, syncUrl]);

  const onChange = useCallback((patch: FiltersPatch) => setFilters((f) => ({ ...f, ...patch, page: 1 })), []);
  const onReset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const goTo = (page: number) => {
    setFilters((f) => ({ ...f, page }));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const result = query.data ?? { items: [], total: 0, page: 1, pageCount: 1 };
  const unfiltered = !filters.q && activeFilterCount(filters) === 0;
  const byGenre = unfiltered && layout === "genre";

  return (
    <section className={className} aria-label="Catalogo beat">
      <div ref={topRef} className="scroll-mt-24" />
      <FilterBar
        filters={filters}
        facets={facets}
        onChange={onChange}
        onReset={onReset}
        total={result.total}
        fetching={query.isFetching && query.isPlaceholderData}
        autoFocusSearch={autoFocusSearch}
      />

      <div className="mt-4">
        <GenreTabs facets={facets} selected={filters.genres} onSelect={(genres) => onChange({ genres })} />
      </div>

      {unfiltered && (
        <div className="mt-4 flex justify-end">
          <div className="inline-flex rounded-xl bg-chrome-200/70 p-1" role="group" aria-label="Vista del catalogo">
            {(["genre", "list"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={layout === l}
                onClick={() => setLayout(l)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-semibold transition",
                  layout === l ? "bg-white text-graphite shadow-[0_1px_3px_rgba(0,0,0,0.15)]" : "text-chrome-500",
                )}
              >
                {l === "genre" ? "Per genere" : "Tutti"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={cn("mt-3 transition-opacity duration-200", query.isPlaceholderData && "opacity-60")}>
        {byGenre ? (
          <GenreShelves facets={facets} onSelect={(genres) => onChange({ genres })} />
        ) : query.isError ? (
          <p className="glass rounded-3xl p-6 text-center text-sm text-deal">{(query.error as Error).message}</p>
        ) : result.items.length ? (
          <TrackList beats={result.items} />
        ) : (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center">
            <SearchX className="size-8 text-chrome-400" aria-hidden />
            <p className="font-display text-lg font-semibold">Nessun beat con questi filtri</p>
            <p className="max-w-sm text-sm text-chrome-500">Allarga l’intervallo di BPM, attiva le tonalità compatibili o togli un genere.</p>
            <button type="button" onClick={onReset} className="text-sm font-semibold text-electric hover:underline">
              Azzera filtri
            </button>
          </div>
        )}
      </div>

      {!byGenre && result.pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagine">
          <button
            type="button"
            disabled={result.page <= 1}
            onClick={() => goTo(result.page - 1)}
            className="chrome-surface grid size-10 place-items-center rounded-full disabled:opacity-40"
            aria-label="Pagina precedente"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm tabular-nums text-chrome-500">
            {result.page} / {result.pageCount}
          </span>
          <button
            type="button"
            disabled={result.page >= result.pageCount}
            onClick={() => goTo(result.page + 1)}
            className="chrome-surface grid size-10 place-items-center rounded-full disabled:opacity-40"
            aria-label="Pagina successiva"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </section>
  );
}
