"use client";

import { Mic, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BeatCover } from "@/components/beats/ui/beat-cover";
import { chromeButtonClass } from "@/components/beats/ui/chrome-button";
import { formatRelativeDay, formatTime } from "@/lib/beats/format";
import { localAll, localDelete } from "@/lib/beats/audio/local-store";
import type { StoredProject } from "@/lib/beats/audio/studio-project";

/** Stesso nome dell'evento emesso dallo studio dopo un salvataggio (vedi studio-store.ts). */
const DEMOS_CHANGED = "backrooms:demos-changed";

type DemoRow = Pick<StoredProject, "id" | "name" | "beat" | "updatedAt" | "durationSec">;

/**
 * "Le tue demo": i progetti registrati nello studio in app e salvati su questo dispositivo
 * (IndexedDB). Apri riporta in /beats/registra, Elimina li toglie dal dispositivo.
 */
export function MyDemos({
  onOpen,
  hideWhenEmpty = false,
  title = "Le tue demo",
}: {
  /** Nello studio si apre sul posto; altrove si va a /beats/registra?progetto=… */
  onOpen?: (id: string) => void;
  hideWhenEmpty?: boolean;
  title?: string;
}) {
  const [rows, setRows] = useState<DemoRow[] | null>(null);

  const refresh = useCallback(async () => {
    const all = await localAll<StoredProject>("projects");
    setRows(
      all
        .filter((p) => p && typeof p.id === "string" && p.beat)
        .map(({ id, name, beat, updatedAt, durationSec }) => ({ id, name, beat, updatedAt, durationSec }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(DEMOS_CHANGED, onChange);
    return () => window.removeEventListener(DEMOS_CHANGED, onChange);
  }, [refresh]);

  const remove = async (row: DemoRow) => {
    if (!window.confirm(`Eliminare "${row.name}" da questo dispositivo?`)) return;
    await localDelete("projects", row.id);
    await refresh();
  };

  if (rows === null) return null;
  if (!rows.length && hideWhenEmpty) return null;

  return (
    <section aria-labelledby="my-demos-title" className="grid gap-2" data-testid="my-demos">
      <div className="flex items-end justify-between gap-4">
        <h2 id="my-demos-title" className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <span className="text-xs text-chrome-500">Salvate su questo dispositivo</span>
      </div>
      {rows.length ? (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="glass flex min-w-0 items-center gap-4 rounded-[20px] p-2">
              <BeatCover beat={row.beat} size="sm" />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-display text-[15px]">{row.name}</b>
                <span className="block truncate text-xs text-chrome-500">
                  {formatTime(row.durationSec)} · {formatRelativeDay(row.updatedAt)}
                </span>
              </span>
              {onOpen ? (
                <button type="button" className={chromeButtonClass("chrome", "sm")} onClick={() => onOpen(row.id)}>
                  Apri
                </button>
              ) : (
                <Link className={chromeButtonClass("chrome", "sm")} href={`/beats/registra?progetto=${encodeURIComponent(row.id)}`}>
                  Apri
                </Link>
              )}
              <button
                type="button"
                aria-label={`Elimina ${row.name}`}
                onClick={() => void remove(row)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-chrome-500 transition hover:bg-white/70 hover:text-deal"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="glass flex flex-wrap items-center gap-4 rounded-[20px] p-4 text-sm text-chrome-500">
          <Mic className="size-4 text-electric" aria-hidden />
          <span className="min-w-0 flex-1">Nessuna demo salvata qui. Registra la voce su un beat e salvala nei progetti.</span>
          <Link className={chromeButtonClass("electric", "sm")} href="/beats/registra">
            Registra
          </Link>
        </div>
      )}
    </section>
  );
}
