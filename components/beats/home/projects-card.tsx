import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { formatDay } from "@/lib/beats/format";
import type { ProjectSummary } from "@/lib/beats/types";
import { GlassPanel } from "../ui/glass-panel";
import { GlowBadge } from "../ui/glow-badge";

const STATUS = {
  DRAFT: { label: "Bozza", tone: "chrome" },
  IN_STUDIO: { label: "In studio", tone: "studio" },
  DELIVERED: { label: "Consegnato", tone: "ok" },
} as const;

/** Progetti e bozze: il ponte tra beat store e servizi dello studio (mix, master, registrazione). */
export function ProjectsCard({ projects }: { projects: ProjectSummary[] }) {
  return (
    <GlassPanel className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-tight">Progetti e bozze</h2>
        <Link href="/#servizi" className="inline-flex items-center gap-1 text-[13px] font-semibold text-electric hover:underline">
          Prenota lo studio <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      {projects.length ? (
        <ul className="mt-3 divide-y divide-chrome-200/80">
          {projects.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{p.title}</p>
                <p className="text-[13px] text-chrome-500">
                  {p.summary}
                  {p.dueAt && ` · consegna il ${formatDay(p.dueAt)}`}
                </p>
              </div>
              <GlowBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</GlowBadge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-chrome-500">
          Hai trovato il beat giusto? Registra la voce, poi mix & master con i nostri produttori: i progetti compaiono qui.
        </p>
      )}
    </GlassPanel>
  );
}
