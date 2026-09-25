export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const buttonStyles = {
  primary:
    "group relative inline-flex items-center justify-center gap-3 overflow-hidden text-center sm:whitespace-nowrap rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-obsidian shadow-[0_0_40px_-8px_rgba(255,176,0,0.7)] transition-[box-shadow,transform] duration-500 ease-[var(--ease-expo)] hover:shadow-[0_0_60px_-4px_rgba(255,176,0,0.9)]",
  ghost:
    "group relative inline-flex items-center justify-center gap-3 text-center sm:whitespace-nowrap rounded-full border border-white/20 bg-white/[0.03] px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md transition-colors duration-500 hover:border-signal hover:text-signal-bright",
  small:
    "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-obsidian transition-shadow duration-500 hover:shadow-[0_0_40px_-6px_rgba(255,176,0,0.9)]",
} as const;
