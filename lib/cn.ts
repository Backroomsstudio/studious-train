export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const buttonStyles = {
  /** CTA principale: superficie in cromo liquido, testo nero. Altezza ≥ 48px per il touch. */
  primary:
    "press group relative inline-flex min-h-12 items-center justify-center gap-3 overflow-hidden text-center sm:whitespace-nowrap rounded-full chrome-surface px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-obsidian transition-[box-shadow,transform] duration-500 ease-[var(--ease-expo)] hover:shadow-[0_0_60px_-8px_rgba(255,255,255,0.7)]",
  /** CTA secondaria: vetro scuro con bordo cromato. */
  ghost:
    "press group relative inline-flex min-h-12 items-center justify-center gap-3 text-center sm:whitespace-nowrap rounded-full border border-white/25 bg-white/[0.04] px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md transition-colors duration-500 hover:border-white hover:bg-white/[0.08]",
  small:
    "press inline-flex min-h-11 items-center justify-center gap-2 rounded-full chrome-surface px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-obsidian transition-shadow duration-500 hover:shadow-[0_0_40px_-6px_rgba(255,255,255,0.8)]",
} as const;
