"use client";

import { ChromeButton } from "@/components/beats/ui/chrome-button";
import { Chip } from "@/components/beats/ui/chip";
import { cn } from "@/lib/cn";
import { genreColor } from "@/lib/beats/genres";
import { BK, chainSummary, PRESET_GENRES, presetGenreOf, ROLE_NAME, ROLES, signatureColor } from "@/lib/beats/audio/vocal-presets";
import { useStudio } from "./studio-store";

/** Firma del produttore: pallino col suo colore + "by Astral". */
export function Signature({ by, className }: { by: string; className?: string }) {
  const bg = signatureColor(by);
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-semibold text-graphite-700", className)}>
      <i aria-hidden className="size-2 rounded-full" style={{ background: bg }} />
      by {by}
    </span>
  );
}

/** Preset Backrooms: le nostre catene voce per genere, una per Main, Doppie e Sporche. */
export function PresetBar() {
  const beat = useStudio((s) => s.beat)!;
  const bkg = useStudio((s) => s.bkg);
  const tracks = useStudio((s) => s.tracks);
  const { setPresetGenre, applyPreset, applyAll } = useStudio.getState();
  const beatGenre = presetGenreOf(beat.genres);
  const g = bkg ?? beatGenre;

  return (
    <section aria-labelledby="bk-title" className="glass grid gap-4 rounded-[28px] p-4 sm:p-6">
      <div>
        <p className="text-[11px] font-semibold text-electric">Preset Backrooms</p>
        <h2 id="bk-title" className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Le nostre catene voce
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-chrome-500">
          Le stesse che usiamo in studio. Per ogni genere una catena per la main, una per le doppie e una per le sporche, firmate da Astral,
          Freya e Plugghe.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Genere dei preset">
        {PRESET_GENRES.map((x) => (
          <Chip key={x.slug} active={g === x.slug} accent={genreColor(x.slug)} onClick={() => setPresetGenre(x.slug)} className="h-8 px-4">
            <i aria-hidden className="size-2 rounded-full" style={{ background: genreColor(x.slug) }} />
            {x.name}
            {x.slug === beatGenre && <span className="font-normal opacity-70">· il tuo beat</span>}
          </Chip>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {ROLES.map((role, i) => {
          const c = BK[g][role];
          const used = tracks.some((t) => t.chain?.genre === g && t.chain.role === role);
          return (
            <button
              key={role}
              type="button"
              aria-pressed={used}
              onClick={() => applyPreset(i, g, role)}
              className={cn(
                "glass grid content-start gap-2 rounded-[20px] p-4 text-left transition duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5",
                used && "outline-2 outline-solid outline-electric",
              )}
            >
              <span className="text-[10.5px] font-semibold text-electric">{ROLE_NAME[role]}</span>
              <b className="font-display text-[17px] leading-tight">{c.name}</b>
              <Signature by={c.by} />
              <small className="text-[12.5px] leading-snug text-chrome-500">{c.desc}</small>
              <span className="mt-2 flex flex-wrap gap-2">
                {chainSummary(c).map((s) => (
                  <span key={s} className="rounded-full bg-chrome-100 px-2 py-0 text-[10.5px] font-semibold text-graphite-700">
                    {s}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <ChromeButton variant="electric" size="md" className="w-full" onClick={() => applyAll(g)}>
        Applica a Main, Doppie e Sporche
      </ChromeButton>
    </section>
  );
}
