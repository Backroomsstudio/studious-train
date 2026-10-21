import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "chrome" | "electric" | "obsidian" | "ghost";
type Size = "sm" | "md" | "lg" | "icon" | "icon-lg";

const VARIANTS: Record<Variant, string> = {
  chrome: "chrome-surface sheen text-graphite hover:shadow-chrome-lg",
  electric:
    "sheen bg-[linear-gradient(180deg,#3b82f6_0%,#0066ff_55%,#0052cc_100%)] text-white shadow-glow-sm ring-1 ring-inset ring-white/25 hover:shadow-glow",
  obsidian: "obsidian sheen text-chrome-50 hover:shadow-glow-sm",
  ghost: "text-graphite-700 hover:bg-white/70 hover:text-graphite",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-full",
  md: "h-11 px-5 text-sm gap-2 rounded-full",
  lg: "h-14 px-7 text-[15px] gap-2.5 rounded-full tracking-[0.06em] uppercase",
  icon: "size-10 rounded-full",
  "icon-lg": "size-14 rounded-full",
};

const base =
  "inline-flex shrink-0 select-none items-center justify-center font-semibold transition-[box-shadow,transform,background-color,color] duration-200 ease-[var(--ease-apple)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

export function chromeButtonClass(variant: Variant = "chrome", size: Size = "md", className?: string) {
  return cn(base, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; children?: ReactNode };

export function ChromeButton({ variant = "chrome", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={chromeButtonClass(variant, size, className)} {...props} />;
}

type LinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ChromeLink({ variant = "chrome", size = "md", className, ...props }: LinkProps) {
  return <Link className={chromeButtonClass(variant, size, className)} {...props} />;
}
