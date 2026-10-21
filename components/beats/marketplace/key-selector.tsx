"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, KeyRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { ALL_KEYS, camelotCode, camelotNumber, compatibleKeys, keyId, keyName, parseKeyId } from "@/lib/beats/music";

/**
 * Selettore di tonalità sulla ruota Camelot: 12 colonne (numeri) × 2 righe (A minori, B maggiori).
 * Con "compatibili" il filtro include relativa e tonalità adiacenti, perfette per il mix armonico.
 */
export function KeySelector({
  value,
  compatible,
  onChange,
}: {
  value: string | undefined;
  compatible: boolean;
  onChange: (patch: { key?: string; compatible?: boolean }) => void;
}) {
  const selected = value ? parseKeyId(value) : null;
  const highlighted = new Set(selected ? (compatible ? compatibleKeys(selected) : [selected]).map(keyId) : []);
  const rows = [ALL_KEYS.filter((k) => k.mode === "MINOR"), ALL_KEYS.filter((k) => k.mode === "MAJOR")];

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition",
          selected ? "bg-graphite text-white shadow-glow-sm" : "chrome-surface text-graphite-700",
        )}
      >
        <KeyRound className="size-3.5" />
        {selected ? `${keyName(selected)} · ${camelotCode(selected)}${compatible ? " ±" : ""}` : "Tonalità"}
        <ChevronDown className="size-3.5 opacity-60" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          collisionPadding={12}
          className="glass z-50 w-[min(92vw,640px)] rounded-3xl bg-white/90 p-4 outline-none"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-chrome-500">Ruota Camelot</p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-graphite-700">
              <input
                type="checkbox"
                checked={compatible}
                disabled={!selected}
                onChange={(e) => onChange({ compatible: e.target.checked })}
                className="size-4 accent-[#0066ff]"
              />
              Includi compatibili
            </label>
          </div>
          <div className="no-scrollbar overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-12 gap-1.5" role="group" aria-label="Tonalità">
              {rows.flat().map((k) => {
                const id = keyId(k);
                const isSelected = value === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChange({ key: isSelected ? undefined : id })}
                    style={{ gridColumn: camelotNumber(k) }}
                    className={cn(
                      "flex flex-col items-center rounded-xl px-1 py-2 text-center transition",
                      isSelected
                        ? "bg-electric text-white shadow-glow"
                        : highlighted.has(id)
                          ? "bg-electric/10 text-electric ring-1 ring-inset ring-electric/40"
                          : "chrome-surface text-graphite-700 hover:text-graphite",
                    )}
                  >
                    <span className="font-mono text-[11px] font-bold">{camelotCode(k)}</span>
                    <span className="text-[11px] font-medium opacity-80">{keyName(k).replace(" maj", "").replace(" min", "m")}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => onChange({ key: undefined, compatible: false })}
              className="mt-3 text-[13px] font-semibold text-electric hover:underline"
            >
              Qualsiasi tonalità
            </button>
          )}
          <Popover.Arrow className="fill-white/90" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
