import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "electric" | "graphite" | "chrome" | "deal" | "ok" | "studio" | "holo";

const TONES: Record<Tone, string> = {
  electric: "bg-electric/10 text-electric ring-electric/30",
  graphite: "bg-graphite text-chrome-50 ring-white/10",
  chrome: "chrome-surface text-graphite-700 ring-transparent",
  deal: "bg-deal text-white ring-white/20",
  ok: "bg-ok/10 text-ok ring-ok/30",
  studio: "bg-studio/10 text-studio ring-studio/40",
  // Badge olografico del piano VIP (come nel mockup)
  holo: "chrome-pink text-white ring-white/10",
};

export function GlowBadge({
  tone = "electric",
  className,
  children,
  style,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-2 text-[11px] font-semibold leading-none ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Costo in crediti, con prezzo barrato quando il beat è in offerta. */
export function CreditCost({ cost, original, className }: { cost: number; original?: number; className?: string }) {
  return (
    <GlowBadge tone="electric" className={className}>
      {original !== undefined && original !== cost && (
        <s className="font-semibold opacity-50" aria-label={`invece di ${original}`}>
          {original}
        </s>
      )}
      <span>{cost}</span>
      <span className="sr-only">crediti</span>
    </GlowBadge>
  );
}

/** Etichetta del produttore con il suo colore d'accento. */
export function ProducerTag({ name, color, co }: { name: string; color: string | null; co?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-normal text-graphite-700">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: color ?? "#8e8e95" }} />
      {name}
      {co && <span className="text-[10px] font-semibold text-chrome-500">co-prod</span>}
    </span>
  );
}
