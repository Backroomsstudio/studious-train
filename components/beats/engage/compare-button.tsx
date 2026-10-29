import { compareHref } from "@/lib/beats/compare";
import { ChromeLink } from "../ui/chrome-button";

/** "A/B Confronta": apre il confronto istantaneo con questo beat come A (B scelto in automatico). */
export function CompareButton({
  slug,
  with: other,
  size = "md",
  className,
  label = "Confronta",
}: {
  slug: string;
  with?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  return (
    <ChromeLink href={compareHref(slug, other)} size={size} className={className} aria-label={`${label}: ascolta in A/B con un altro beat`}>
      <span aria-hidden className="font-display text-[0.95em] font-semibold text-electric">
        A/B
      </span>
      {label}
    </ChromeLink>
  );
}
