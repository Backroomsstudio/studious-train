"use client";

import { X } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const INPUT = "chrome-surface w-full rounded-2xl px-4 text-[16px] text-graphite outline-none placeholder:text-chrome-400 focus:ring-2 focus:ring-electric/40";

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-chrome-200 pt-6 first:border-t-0 first:pt-0">
      <div>
        <legend className="font-display text-base font-semibold text-graphite">{title}</legend>
        {hint && <p className="mt-2 text-sm text-chrome-500">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}

export function TextField({ label, className, ...props }: ComponentProps<"input"> & { label: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm text-chrome-500">
        {label}
      </label>
      <input id={id} className={cn(INPUT, "h-12")} {...props} />
    </div>
  );
}

export function TextArea({ label, className, ...props }: ComponentProps<"textarea"> & { label: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm text-chrome-500">
        {label}
      </label>
      <textarea id={id} rows={3} className={cn(INPUT, "resize-y py-4 leading-relaxed")} {...props} />
    </div>
  );
}

export function SelectField({ label, className, children, ...props }: ComponentProps<"select"> & { label: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm text-chrome-500">
        {label}
      </label>
      <select id={id} className={cn(INPUT, "h-12 appearance-none")} {...props}>
        {children}
      </select>
    </div>
  );
}

/** Etichette libere (type beat, mood): Invio o virgola per aggiungere. */
export function TagInput({
  label,
  values,
  onChange,
  max,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const next = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const merged = [...values];
    for (const v of next) if (!merged.some((m) => m.toLowerCase() === v.toLowerCase()) && merged.length < max) merged.push(v);
    onChange(merged);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-chrome-500">
        {label} <span className="text-chrome-400">· {values.length} di {max}</span>
      </label>
      <div className="chrome-surface flex min-h-12 flex-wrap items-center gap-2 rounded-2xl px-2 py-2 focus-within:ring-2 focus-within:ring-electric/40">
        {values.map((v) => (
          <span key={v} className="inline-flex h-8 items-center gap-2 rounded-full bg-chrome-100 pl-4 pr-2 text-[13px] text-graphite">
            {v}
            <button
              type="button"
              aria-label={`Togli ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="grid size-6 place-items-center rounded-full text-chrome-500 hover:text-graphite"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {values.length < max && (
          <input
            id={id}
            value={draft}
            placeholder={values.length ? "" : placeholder}
            onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) add(draft);
              } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
            }}
            onBlur={() => draft.trim() && add(draft)}
            className="h-8 min-w-24 flex-1 bg-transparent px-2 text-[16px] outline-none placeholder:text-chrome-400"
          />
        )}
      </div>
    </div>
  );
}

/** Palette del sito: nessun colore fuori dal sistema. */
export const SWATCHES = ["#121214", "#2e2e33", "#66666d", "#8e8e95", "#c9c9ce", "#e95b8c", "#e0306c"] as const;

export function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-chrome-500">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.toLowerCase() === c}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              "size-10 rounded-full ring-offset-2 transition active:scale-95",
              value.toLowerCase() === c ? "ring-2 ring-graphite" : "ring-1 ring-chrome-200",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, text, checked, onChange }: { label: string; text?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="chrome-surface flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left"
    >
      <span className="grid min-w-0 flex-1 gap-0">
        <span className="text-[15px] font-semibold text-graphite">{label}</span>
        {text && <span className="text-[13px] leading-snug text-chrome-500">{text}</span>}
      </span>
      <span aria-hidden className="settings-toggle" data-on={checked || undefined} />
    </button>
  );
}

/** Scelta tra poche opzioni (stato, modo, tipo di kit). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-chrome-500">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition active:scale-[0.97]",
              value === o.value ? "bg-graphite text-white" : "chrome-surface text-graphite-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** ISO ↔ valore di `<input type="datetime-local">` nel fuso del browser. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
