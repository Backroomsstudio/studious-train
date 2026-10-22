"use client";

import { RotateCcw, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { activeFilterCount, BPM_RANGE, SORTS, type BeatFilters, type SortOrder } from "@/lib/beats/filters";
import type { Facets } from "@/lib/beats/types";
import { Chip } from "../ui/chip";
import { RangeSlider } from "../ui/range-slider";
import { KeySelector } from "./key-selector";

export type FiltersPatch = Partial<Omit<BeatFilters, "page">>;

const SORT_LABELS: Record<SortOrder, string> = {
  relevance: "Pertinenza",
  new: "Più recenti",
  popular: "Più ascoltati",
  bpm_asc: "BPM ↑",
  bpm_desc: "BPM ↓",
};

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function SearchField({ value, onChange, autoFocus }: { value: string; onChange: (q: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState(value);
  const last = useRef(value);

  // Ricerca debounced (250 ms): una richiesta quando l'utente si ferma, non a ogni tasto.
  useEffect(() => {
    if (text === last.current) return;
    const t = setTimeout(() => {
      last.current = text;
      onChange(text);
    }, 250);
    return () => clearTimeout(t);
  }, [text, onChange]);

  // Allinea il campo quando i filtri vengono azzerati dall'esterno.
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value);
    }
  }, [value]);

  return (
    <label className="glass flex h-12 flex-1 items-center gap-3 rounded-full px-4 focus-within:ring-2 focus-within:ring-electric/50 focus-within:shadow-glow-sm">
      <Search className="size-4 shrink-0 text-chrome-500" aria-hidden />
      <span className="sr-only">Cerca beat</span>
      <input
        type="search"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        placeholder="Beat, produttori, mood, type beat…"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-graphite outline-none placeholder:text-chrome-400 [&::-webkit-search-cancel-button]:hidden"
        enterKeyHint="search"
        autoComplete="off"
      />
      {text && (
        <button type="button" onClick={() => setText("")} aria-label="Svuota ricerca" className="text-chrome-400 hover:text-graphite">
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-chrome-500">{title}</p>
      {children}
    </div>
  );
}

export function FilterBar({
  filters,
  facets,
  onChange,
  onReset,
  total,
  fetching,
  autoFocusSearch,
}: {
  filters: BeatFilters;
  facets: Facets;
  onChange: (patch: FiltersPatch) => void;
  onReset: () => void;
  total: number;
  fetching: boolean;
  autoFocusSearch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = useState([filters.bpmMin, filters.bpmMax]);
  const [typeQuery, setTypeQuery] = useState("");
  useEffect(() => setBpm([filters.bpmMin, filters.bpmMax]), [filters.bpmMin, filters.bpmMax]);

  const active = activeFilterCount(filters);
  const typeTags = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    const list = q ? facets.typeTags.filter((t) => t.name.toLowerCase().includes(q)) : facets.typeTags;
    return [...list].sort((a, b) => Number(filters.types.includes(b.slug)) - Number(filters.types.includes(a.slug)) || b.count - a.count);
  }, [facets.typeTags, typeQuery, filters.types]);

  const residents = facets.producers.filter((p) => p.isResident);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SearchField value={filters.q ?? ""} onChange={(q) => onChange({ q: q.trim() || undefined })} autoFocus={autoFocusSearch} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="beat-filters"
          className={cn(
            "relative inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold transition lg:hidden",
            open || active ? "bg-graphite text-white shadow-glow-sm" : "chrome-surface text-graphite-700",
          )}
        >
          <SlidersHorizontal className="size-4" />
          <span className="sr-only sm:not-sr-only">Filtri</span>
          {active > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-electric text-[11px] font-bold text-white">{active}</span>
          )}
        </button>
      </div>

      {/* Produttori resident: sempre visibili, come le pillole del mockup */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Produttori">
        <Chip active={!filters.producers.length} onClick={() => onChange({ producers: [] })}>
          Tutti
        </Chip>
        {residents.map((p) => (
          <Chip
            key={p.slug}
            active={filters.producers.includes(p.slug)}
            accent={p.accentColor}
            onClick={() => onChange({ producers: toggle(filters.producers, p.slug) })}
          >
            <span className="size-2 rounded-full" style={{ background: p.accentColor ?? "#0066ff" }} aria-hidden />
            {p.name}
            <span className="text-[11px] font-medium opacity-60">{p.count}</span>
          </Chip>
        ))}
        <Chip
          active={filters.collab === "only"}
          onClick={() => onChange({ collab: filters.collab === "only" ? undefined : "only" })}
          title="Beat prodotti in collaborazione tra più produttori"
        >
          <Users className="size-3.5" /> Co-produzioni
        </Chip>
      </div>

      <div
        id="beat-filters"
        className={cn("glass grid gap-5 rounded-3xl p-4 sm:p-5 lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-x-8", open ? "grid" : "hidden")}
      >
        <Section title={`BPM · ${bpm[0]}–${bpm[1]}`}>
          <RangeSlider
            value={bpm}
            min={BPM_RANGE.min}
            max={BPM_RANGE.max}
            onValueChange={setBpm}
            onValueCommit={([bpmMin, bpmMax]) => onChange({ bpmMin, bpmMax })}
            label="Intervallo BPM"
            thumbLabels={["BPM minimo", "BPM massimo"]}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ["Lento", 60, 95],
              ["Medio", 95, 125],
              ["Trap", 130, 160],
              ["Veloce", 160, 200],
            ].map(([label, lo, hi]) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange({ bpmMin: Number(lo), bpmMax: Number(hi) })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                  filters.bpmMin === lo && filters.bpmMax === hi ? "bg-electric text-white" : "bg-white/70 text-chrome-500 hover:text-graphite",
                )}
              >
                {label} {lo}–{hi}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Tonalità e ordinamento">
          <div className="flex flex-wrap items-center gap-2">
            <KeySelector value={filters.key} compatible={filters.compatible} onChange={(patch) => onChange(patch)} />
            <label className="chrome-surface inline-flex h-9 items-center rounded-full pl-4 pr-2 text-[13px] font-semibold text-graphite-700">
              <span className="sr-only">Ordina per</span>
              <select
                value={filters.sort}
                onChange={(e) => onChange({ sort: e.target.value as SortOrder })}
                className="cursor-pointer bg-transparent pr-1 outline-none"
              >
                {SORTS.filter((s) => s !== "relevance" || filters.q).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <Chip
              active={filters.collab === "exclude"}
              onClick={() => onChange({ collab: filters.collab === "exclude" ? undefined : "exclude" })}
            >
              Solo produzioni singole
            </Chip>
          </div>
        </Section>

        <Section title="Type beat" className="lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="chrome-surface flex h-9 items-center gap-2 rounded-full px-3 sm:w-56">
              <Search className="size-3.5 text-chrome-400" aria-hidden />
              <span className="sr-only">Cerca artista di riferimento</span>
              <input
                value={typeQuery}
                onChange={(e) => setTypeQuery(e.target.value)}
                placeholder="Artista di riferimento"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-chrome-400"
              />
            </label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Type beat">
              {typeTags.slice(0, 12).map((t) => (
                <Chip
                  key={t.slug}
                  active={filters.types.includes(t.slug)}
                  onClick={() => onChange({ types: toggle(filters.types, t.slug) })}
                  className="h-8 px-3 text-xs"
                >
                  {t.name} Type
                </Chip>
              ))}
              {!typeTags.length && <span className="text-xs text-chrome-500">Nessun artista trovato.</span>}
            </div>
          </div>
        </Section>
      </div>

      <div className="flex items-center justify-between px-1 text-[13px] text-chrome-500" aria-live="polite">
        <span>
          {fetching ? "Ricerca…" : `${total} beat`}
          {filters.q && !fetching && ` per “${filters.q}”`}
        </span>
        {(active > 0 || filters.q) && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 font-semibold text-electric hover:underline">
            <RotateCcw className="size-3.5" /> Azzera filtri
          </button>
        )}
      </div>
    </div>
  );
}
