import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** Pillola di filtro a selezione (aria-pressed), attiva = blu elettrico con alone. */
export function Chip({
  active,
  accent,
  className,
  style,
  ...props
}: ComponentProps<"button"> & { active?: boolean; accent?: string | null }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      style={{ ...(accent && active ? ({ "--chip-accent": accent } as CSSProperties) : {}), ...style }}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-all duration-200 active:scale-[0.97]",
        active
          ? "bg-graphite text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_18px_var(--chip-accent,rgba(0,102,255,0.45))]"
          : "chrome-surface text-graphite-700 hover:text-graphite",
        className,
      )}
      {...props}
    />
  );
}
