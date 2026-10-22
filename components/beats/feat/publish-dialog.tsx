"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { FEAT, FEAT_ROLES, type FeatRole } from "@/lib/beats/feat";
import { genreColor } from "@/lib/beats/genres";
import type { TagRef } from "@/lib/beats/types";
import { Chip } from "../ui/chip";
import { ChromeButton } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { useCreateFeatPost } from "./use-feat";

export interface FeatBeatOption {
  id: string;
  title: string;
  owned: boolean;
}

const field =
  "chrome-surface w-full rounded-2xl px-4 text-[15px] text-graphite outline-none transition focus:ring-2 focus:ring-electric/40";

/** "Pubblica un annuncio": cosa cerchi, genere, beat (dai tuoi o dal catalogo), città e testo. */
export function PublishDialog({
  open,
  onOpenChange,
  genres,
  beats,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  genres: TagRef[];
  beats: FeatBeatOption[];
  onPublished: () => void;
}) {
  const create = useCreateFeatPost();
  const [role, setRole] = useState<FeatRole>("feat");
  const [genre, setGenre] = useState(genres[0]?.slug ?? "");
  const [beatId, setBeatId] = useState("");
  const [city, setCity] = useState("Vicenza");
  const [text, setText] = useState("");
  const length = text.trim().length;
  const owned = beats.filter((b) => b.owned);
  const catalog = beats.filter((b) => !b.owned);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { role, genre, beatId, city, text },
      {
        onSuccess() {
          setText("");
          setBeatId("");
          onPublished();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Pubblica un annuncio" description="Lo vedono tutti gli artisti del Beat Store per 30 giorni.">
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-graphite-700">Cosa cerchi</legend>
          <div className="flex flex-wrap gap-2">
            {FEAT_ROLES.map((r) => (
              <Chip key={r.id} active={role === r.id} onClick={() => setRole(r.id)}>
                {r.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-graphite-700">Genere</legend>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Chip key={g.slug} active={genre === g.slug} accent={genreColor(g.slug)} onClick={() => setGenre(g.slug)}>
                <span aria-hidden className="size-2 rounded-full" style={{ background: genreColor(g.slug) }} />
                {g.name}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-graphite-700">Su quale beat</span>
            <select value={beatId} onChange={(e) => setBeatId(e.target.value)} className={cn(field, "h-12 appearance-none")}>
              <option value="">Nessuno in particolare</option>
              {owned.length > 0 && (
                <optgroup label="I tuoi beat">
                  {owned.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Dal catalogo">
                {catalog.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-graphite-700">Città</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={FEAT.cityMax} className={cn(field, "h-12")} placeholder="Vicenza" />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 flex items-baseline justify-between text-[13px] font-semibold text-graphite-700">
            Il tuo annuncio
            <span className={cn("font-mono text-xs tabular-nums", length > FEAT.textMax ? "text-deal" : "text-chrome-500")} aria-live="polite">
              {length}/{FEAT.textMax}
            </span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={FEAT.textMax}
            rows={4}
            required
            className={cn(field, "min-h-28 resize-y py-3 leading-relaxed")}
            placeholder="Che pezzo è, che voce cerchi, come dividete il pezzo…"
          />
        </label>

        {create.error && (
          <p role="alert" className="text-sm text-deal">
            {create.error.message}
          </p>
        )}
        <ChromeButton type="submit" variant="electric" size="lg" className="w-full" disabled={create.isPending || length < FEAT.textMin}>
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Pubblica"}
        </ChromeButton>
        {length > 0 && length < FEAT.textMin && <p className="text-center text-xs text-chrome-500">Ancora qualche parola: almeno {FEAT.textMin} caratteri.</p>}
      </form>
    </Dialog>
  );
}
