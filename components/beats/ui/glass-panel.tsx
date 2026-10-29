import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Material = "glass" | "chrome" | "obsidian";

const MATERIALS: Record<Material, string> = {
  glass: "glass",
  chrome: "chrome-surface",
  obsidian: "obsidian",
};

/** Contenitore base: vetro satinato, metallo spazzolato o ossidiana. */
export function GlassPanel({
  as: Component = "div",
  material = "glass",
  glow = false,
  className,
  ...props
}: ComponentProps<"div"> & {
  as?: "div" | "section" | "article" | "aside";
  material?: Material;
  /** Alone blu elettrico (stato attivo / in riproduzione). */
  glow?: boolean;
}) {
  return (
    <Component
      className={cn(
        "rounded-3xl transition-shadow duration-300",
        MATERIALS[material],
        glow && "ring-1 ring-electric/40",
        className,
      )}
      {...props}
    />
  );
}
