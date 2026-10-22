import { Award } from "lucide-react";
import type { LevelInfo } from "@/lib/beats/types";

/** Livello Resident: mesi da abbonato, vantaggi attivi e quanto manca al prossimo. */
export function LevelCard({ level, compact = false }: { level: LevelInfo; compact?: boolean }) {
  const next = level.next;
  const progress = next ? Math.min(100, Math.round((level.months / (level.months + next.monthsToNext)) * 100)) : 100;
  return (
    <section aria-label="Livello Resident" className="obsidian relative overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full blur-3xl" style={{ background: `${level.color}55` }} />
      <div className="relative flex items-center gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-2xl ring-1 ring-white/20"
          style={{ background: `linear-gradient(145deg, ${level.color}, #1f2937)`, boxShadow: `0 0 24px ${level.color}66` }}
        >
          <Award className="size-7 text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-chrome-400">Livello Resident</p>
          <p className="font-display text-2xl font-black" style={{ color: level.color }}>
            {level.name}
          </p>
          <p className="text-sm text-chrome-300">
            {level.months} {level.months === 1 ? "mese" : "mesi"} con noi
            {next ? ` · ${next.monthsToNext} ${next.monthsToNext === 1 ? "mese" : "mesi"} a ${next.name}` : " · livello massimo"}
          </p>
        </div>
      </div>
      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: level.color, boxShadow: `0 0 10px ${level.color}` }} />
      </div>
      {!compact && (
        <ul className="relative mt-4 flex flex-wrap gap-2">
          {level.perks.map((perk) => (
            <li key={perk} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-chrome-100">
              {perk}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
