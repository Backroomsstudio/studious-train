import type { CSSProperties, ReactNode } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "electric" | "graphite" | "chrome" | "deal" | "ok" | "studio" | "holo";

const TONES: Record<Tone, string> = {
  electric: "bg-electric/10 text-electric ring-electric/30 shadow-[0_0_14px_rgba(0,102,255,0.25)]",
  graphite: "bg-graphite text-chrome-50 ring-white/10",
  chrome: "chrome-surface text-graphite-700 ring-transparent",
  deal: "bg-deal text-white ring-white/20 shadow-[0_0_16px_rgba(239,68,68,0.45)]",
  ok: "bg-ok/10 text-ok ring-ok/30",
  studio: "bg-studio/10 text-studio ring-studio/40",
  // Badge olografico del piano VIP (come nel mockup)
  holo: "text-graphite ring-white/70 bg-[linear-gradient(115deg,#fdf2c4_0%,#f6d6ff_30%,#c7e3ff_55%,#d7fff1_80%,#fdf2c4_100%)]",
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.08em] ring-1 ring-inset",
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
      <Zap aria-hidden className="size-3 fill-current" />
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
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-graphite-700">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: color ?? "#0066ff", boxShadow: `0 0 8px ${color ?? "#0066ff"}` }} />
      {name}
      {co && <span className="text-[10px] font-semibold uppercase tracking-wider text-chrome-500">co-prod</span>}
    </span>
  );
}
