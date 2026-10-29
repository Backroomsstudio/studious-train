"use client";

import { Users } from "lucide-react";
import type { BeatFilters } from "@/lib/beats/filters";
import type { Facets } from "@/lib/beats/types";
import { Chip } from "../ui/chip";
import type { FiltersPatch } from "./filter-bar";
import { GenreTabs } from "./genre-nav";
import type { ProducerPair } from "@/lib/beats/pairs";

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-chrome-500">{title}</p>
      {children}
    </div>
  );
}

/**
 * Filtri pronti che compaiono toccando la barra di ricerca: per produttore, per collab,
 * per collab tra due produttori precisi e per genere. Si combinano con le parole cercate.
 */
export function SearchPresets({
  filters,
  facets,
  pairs,
  onChange,
}: {
  filters: BeatFilters;
  facets: Facets;
  pairs: ProducerPair[];
  onChange: (patch: FiltersPatch) => void;
}) {
  const residents = facets.producers.filter((p) => p.isResident);
  const pairOn = (pair: ProducerPair) =>
    filters.together && filters.producers.length === 2 && pair.slugs.every((s) => filters.producers.includes(s));

  return (
    <div className="glass space-y-6 rounded-3xl p-4 sm:p-6" aria-label="Filtri pronti">
      <Group title="Per producer">
        <div className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 pb-2 sm:flex-wrap" role="group" aria-label="Produttori">
          {residents.map((p) => (
            <Chip
              key={p.slug}
              active={!filters.together && filters.producers.includes(p.slug)}
              accent={p.accentColor}
              onClick={() => onChange({ producers: filters.together ? [p.slug] : toggle(filters.producers, p.slug), together: false })}
            >
              <span className="size-2 rounded-full" style={{ background: p.accentColor ?? "#8e8e95" }} aria-hidden />
              {p.name}
              <span className="text-[11px] font-normal opacity-60">{p.count}</span>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Collab">
        <div className="flex flex-wrap gap-2">
          <Chip
            active={filters.collab === "only" && !filters.together}
            onClick={() => onChange({ collab: filters.collab === "only" ? undefined : "only", together: false, producers: filters.together ? [] : filters.producers })}
          >
            <Users className="size-3.5" aria-hidden /> Tutte le collab
          </Chip>
          <Chip active={filters.collab === "exclude"} onClick={() => onChange({ collab: filters.collab === "exclude" ? undefined : "exclude", together: false })}>
            Solo produzioni singole
          </Chip>
        </div>
      </Group>

      {pairs.length > 0 && (
        <Group title="Collab tra producer">
          <div className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 pb-2 sm:flex-wrap" role="group" aria-label="Coppie di produttori">
            {pairs.map((pair) => {
              const on = pairOn(pair);
              return (
                <Chip
                  key={pair.slugs.join("-")}
                  active={on}
                  onClick={() => onChange(on ? { producers: [], together: false } : { producers: [...pair.slugs], together: true, collab: undefined })}
                >
                  <span className="flex -space-x-2" aria-hidden>
                    {pair.colors.map((c, i) => (
                      <span key={i} className="size-2.5 rounded-full ring-2 ring-white" style={{ background: c }} />
                    ))}
                  </span>
                  {pair.names[0]} × {pair.names[1]}
                  <span className="text-[11px] font-normal opacity-60">{pair.count}</span>
                </Chip>
              );
            })}
          </div>
        </Group>
      )}

      <Group title="Per genere">
        <GenreTabs facets={facets} selected={filters.genres} onSelect={(genres) => onChange({ genres })} />
      </Group>
    </div>
  );
}
