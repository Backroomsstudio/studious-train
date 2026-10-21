import { Download, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingButton } from "@/components/beats/library/billing-button";
import { BeatCover } from "@/components/beats/ui/beat-cover";
import { ChromeLink } from "@/components/beats/ui/chrome-button";
import { GlowBadge } from "@/components/beats/ui/glow-badge";
import { cn } from "@/lib/cn";
import { formatDay, formatRelativeDay } from "@/lib/beats/format";
import { LICENSES } from "@/lib/beats/licenses";
import { PLANS } from "@/lib/beats/plans";
import { SIGN_IN_PATH } from "@/lib/beats/server/auth";
import { getBackend } from "@/lib/beats/server/backend";
import { issueDownloadGrant } from "@/lib/beats/server/download-grant";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Libreria" };

const LEDGER_LABELS: Record<string, string> = {
  SUBSCRIPTION_GRANT: "Accredito",
  ROLLOVER_EXPIRY: "Scadenza rollover",
  SUBSCRIPTION_END_EXPIRY: "Fine abbonamento",
  UNLOCK: "Sblocco",
  REFUND: "Rimborso",
  ADJUSTMENT: "Correzione",
  BONUS: "Bonus",
};

export default async function LibraryPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(SIGN_IN_PATH);
  const backend = await getBackend();
  const [library, ledger] = await Promise.all([backend.library(viewer.id), backend.ledger(viewer.id, 15)]);
  const plan = viewer.plan ? PLANS[viewer.plan.tier] : null;

  return (
    <div className="space-y-6">
      <h1 className="chrome-text font-display text-4xl font-black tracking-tight">Libreria</h1>

      <section className="obsidian grid gap-5 rounded-[28px] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6" aria-label="Piano e crediti">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-chrome-400">Il tuo piano</p>
          <p className="mt-1 font-display text-2xl font-bold">{plan?.name ?? "Nessun abbonamento"}</p>
          {viewer.plan && (
            <p className="mt-1 text-sm text-chrome-300">
              {viewer.plan.cancelAtPeriodEnd ? "Termina" : "Si rinnova"} il {formatDay(viewer.plan.renewsAt)}
              {plan && ` · +${plan.monthlyCredits} crediti`}
            </p>
          )}
          <p className="mt-4 inline-flex items-center gap-2 font-mono text-3xl font-black text-electric-cyan drop-shadow-[0_0_12px_rgba(0,240,255,0.5)]">
            <Zap className="size-6 fill-current" /> {viewer.creditBalance}
            <span className="font-sans text-sm font-medium text-chrome-400">crediti</span>
          </p>
        </div>
        <div className="sm:w-56">
          {viewer.plan ? (
            <BillingButton variant="chrome">Gestisci abbonamento</BillingButton>
          ) : (
            <ChromeLink href="/beats/piani" variant="electric" size="lg" className="w-full">
              Scegli un piano
            </ChromeLink>
          )}
        </div>
      </section>

      <section aria-labelledby="licenze-title" className="space-y-3">
        <h2 id="licenze-title" className="font-display text-xl font-bold">
          Le tue licenze <span className="text-chrome-400">· {library.length}</span>
        </h2>
        {library.length ? (
          <ul className="space-y-2">
            {library.map(({ beat, license }) => (
              <li key={license.id} className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
                <Link href={`/beats/${beat.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <BeatCover beat={beat} />
                  <span className="min-w-0">
                    <span className="block truncate font-display font-semibold">{beat.title}</span>
                    <span className="block truncate text-[13px] text-chrome-500">
                      {LICENSES[license.type].name} · {formatRelativeDay(license.createdAt)} · {license.creditsSpent} crediti
                    </span>
                  </span>
                </Link>
                <div className="flex flex-wrap gap-2">
                  {LICENSES[license.type].assets.map((asset) => (
                    <a
                      key={asset}
                      download
                      href={`/api/downloads?grant=${issueDownloadGrant({ userId: viewer.id, licenseId: license.id, asset })}`}
                      className="chrome-surface inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition hover:shadow-glow-sm"
                    >
                      <Download className="size-3.5 text-electric" /> {asset}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="glass rounded-2xl p-5 text-sm text-chrome-500">
            Non hai ancora sbloccato beat. <Link href="/beats/cerca" className="font-semibold text-electric">Esplora il catalogo</Link>.
          </p>
        )}
      </section>

      <section aria-labelledby="movimenti-title" className="glass rounded-[28px] p-5">
        <h2 id="movimenti-title" className="font-display text-xl font-bold">Movimenti crediti</h2>
        <ul className="mt-3 divide-y divide-chrome-200">
          {ledger.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.description ?? LEDGER_LABELS[t.type]}</span>
                <span className="text-xs text-chrome-500">
                  {LEDGER_LABELS[t.type] ?? t.type} · {formatRelativeDay(t.createdAt)}
                </span>
              </span>
              <span className="text-right">
                <GlowBadge tone={t.amount > 0 ? "ok" : "chrome"} className={cn("font-mono", t.amount < 0 && "text-graphite")}>
                  {t.amount > 0 ? `+${t.amount}` : t.amount}
                </GlowBadge>
                <span className="mt-1 block text-[11px] text-chrome-500">saldo {t.balanceAfter}</span>
              </span>
            </li>
          ))}
          {!ledger.length && <li className="py-3 text-sm text-chrome-500">Nessun movimento.</li>}
        </ul>
      </section>
    </div>
  );
}
