import { DoorOpen, Download, Gift, Package, CalendarDays } from "lucide-react";
import { BadgesGrid } from "@/components/beats/engage/badges-grid";
import { MembershipPass } from "@/components/beats/engage/membership-pass";
import { MyDemos } from "@/components/beats/recorder/my-demos";
import { RedeemGift, TopupPacks } from "@/components/beats/commerce/plans-shop";
import { SettingsCard } from "@/components/beats/settings/settings-sheet";
import { PauseButton, ReferralCard } from "@/components/beats/commerce/account-actions";
import { LevelCard } from "@/components/beats/commerce/level-card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingButton } from "@/components/beats/library/billing-button";
import { BeatCover } from "@/components/beats/ui/beat-cover";
import { ChromeLink } from "@/components/beats/ui/chrome-button";
import { GlowBadge } from "@/components/beats/ui/glow-badge";
import { RevealList } from "@/components/beats/ui/reveal";
import { cn } from "@/lib/cn";
import { formatDay, formatRelativeDay } from "@/lib/beats/format";
import { CUSTOMIZATION_OPTIONS, CUSTOMIZATION_STATUS } from "@/lib/beats/customizations";
import { LICENSES } from "@/lib/beats/licenses";
import { findTier, PRODUCT_KINDS, SERVICE_STATUS, SERVICES } from "@/lib/beats/offers";
import { formatEuro, PLANS } from "@/lib/beats/plans";
import { SIGN_IN_PATH, signOut } from "@/lib/beats/server/auth";
import { storeEnv } from "@/lib/beats/server/env";
import { getBackend } from "@/lib/beats/server/backend";
import { issueDownloadGrant } from "@/lib/beats/server/download-grant";
import { getViewer } from "@/lib/beats/server/queries";

export const metadata = { title: "Profilo" };

/** Le parti del Profilo, raggiungibili dalle pillole in alto. */
const SECTIONS = [
  ["piano", "Piano e crediti"],
  ["badge", "Badge"],
  ["demo", "Le tue demo"],
  ["licenze", "I tuoi beat"],
  ["movimenti", "Movimenti"],
  ["impostazioni", "Impostazioni"],
] as const;

const LEDGER_LABELS: Record<string, string> = {
  SUBSCRIPTION_GRANT: "Accredito",
  ROLLOVER_EXPIRY: "Scadenza rollover",
  SUBSCRIPTION_END_EXPIRY: "Fine abbonamento",
  UNLOCK: "Sblocco",
  CUSTOMIZATION: "Personalizzazione",
  REFUND: "Rimborso",
  ADJUSTMENT: "Correzione",
  BONUS: "Bonus",
  TOPUP: "Ricarica",
  GIFT_REDEEM: "Gift card",
  REFERRAL: "Invito",
  SERVICE: "Servizio studio",
  PRODUCT: "Kit e preset",
};

const NOTICES: Record<string, string> = {
  ricarica: "Pagamento ricevuto: i crediti della ricarica arrivano nel portafoglio entro pochi secondi.",
  regalo: "Gift card pagata: trovi il codice qui sotto, pronto da regalare.",
  ordine: "Ordine confermato: ti scriviamo entro 24 ore per organizzare il lavoro.",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(SIGN_IN_PATH);
  const backend = await getBackend();
  const [library, ledger, customizations, orders, products, giftCards] = await Promise.all([
    backend.library(viewer.id),
    backend.ledger(viewer.id, 15),
    backend.customizations(viewer.id),
    backend.orders(viewer.id),
    backend.products(viewer.id),
    backend.giftCards(viewer.id),
  ]);
  const ownedProducts = products.filter((p) => p.owned);
  const notice = Object.keys(NOTICES).find((k) => params[k]);
  const plan = viewer.plan ? PLANS[viewer.plan.tier] : null;

  return (
    <RevealList className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="chrome-pink grid size-16 shrink-0 place-items-center rounded-[24px] font-display text-3xl font-semibold sm:size-20"
                        aria-hidden
          >
            {(viewer.artistName ?? viewer.name).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-electric">Il tuo profilo</p>
            <h1 className="chrome-text truncate font-display text-[clamp(2.4rem,9vw,4.5rem)] font-semibold leading-none tracking-tight">
              {viewer.artistName ?? viewer.name}
            </h1>
            <p className="mt-2 text-sm text-chrome-500">
              {plan?.name ?? "Nessun piano"} · Resident {viewer.level.name} · {new Set(library.map((e) => e.beat.id)).size} beat sbloccati
            </p>
          </div>
        </div>
        {!storeEnv.demoMode && (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/beats/accedi" });
            }}
          >
            <button type="submit" className="chrome-surface h-10 shrink-0 rounded-full px-4 text-sm font-semibold text-graphite-700">
              Esci
            </button>
          </form>
        )}
      </div>

      <nav aria-label="Sezioni del profilo" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="chrome-surface shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-graphite-700 transition hover:text-graphite">
            {label}
          </a>
        ))}
      </nav>

      {notice && (
        <p role="status" className="rounded-2xl bg-ok/10 px-4 py-4 text-sm font-semibold text-ok">
          {NOTICES[notice]}
        </p>
      )}

      <section id="piano" className="obsidian grid scroll-mt-24 gap-6 rounded-[28px] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6" aria-label="Piano e crediti">
        <div>
          <p className="text-[11px] font-semibold text-chrome-400">Il tuo piano</p>
          <p className="mt-2 font-display text-2xl font-semibold">{plan?.name ?? "Nessun abbonamento"}</p>
          {viewer.plan && (
            <p className="mt-2 text-sm text-chrome-300">
              {viewer.plan.pausedUntil
                ? `In pausa fino al ${formatDay(viewer.plan.pausedUntil)}`
                : `${viewer.plan.cancelAtPeriodEnd ? "Termina" : "Si rinnova"} il ${formatDay(viewer.plan.renewsAt)}`}
              {plan && !viewer.plan.pausedUntil && ` · +${plan.monthlyCredits} crediti`}
              {viewer.plan.interval === "YEAR" && " · annuale"}
            </p>
          )}
          <p className="mt-4 inline-flex items-center gap-2 text-3xl font-semibold text-electric-cyan"> {viewer.creditBalance}
            <span className="font-sans text-sm font-normal text-chrome-400">crediti</span>
          </p>
          <p className="mt-2 text-xs text-chrome-400">
            {viewer.credits.subscription} del piano (rollover) · {viewer.credits.wallet} nel portafoglio (non scadono)
          </p>
        </div>
        <div className="space-y-2 sm:w-56">
          {viewer.plan ? (
            <>
              <BillingButton variant="chrome">Gestisci abbonamento</BillingButton>
              <ChromeLink href="/beats/piani" variant="obsidian" className="w-full">
                Cambia piano
              </ChromeLink>
              <PauseButton pausedUntil={viewer.plan.pausedUntil} />
            </>
          ) : (
            <ChromeLink href="/beats/piani" variant="electric" size="lg" className="w-full">
              Scegli un piano
            </ChromeLink>
          )}
        </div>
      </section>

      <TopupPacks viewer={viewer} />
      <RedeemGift />

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <LevelCard level={viewer.level} />
        {viewer.referralCode && <ReferralCard code={viewer.referralCode} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <MembershipPass />
        <div className="grid gap-4">
          <Link href="/beats/wrapped" className="obsidian group flex items-center gap-4 rounded-[24px] p-4 transition">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-electric/20 text-electric-cyan">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-display font-semibold">Il tuo anno su Backrooms</span>
              <span className="text-sm text-chrome-400">Ore di ascolto, produttore e genere preferiti, da condividere</span>
            </span>
          </Link>
          <Link href="/beats/stanza" className="glass group flex items-center gap-4 rounded-[24px] p-4 transition">
            <span className="chrome-surface grid size-12 shrink-0 place-items-center rounded-2xl text-electric">
              <DoorOpen className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-display font-semibold">La tua stanza</span>
              <span className="text-sm text-chrome-500">Il tuo profilo d&apos;artista, con il tema che scegli tu</span>
            </span>
          </Link>
        </div>
      </div>

      <div id="badge" className="scroll-mt-24">
        <BadgesGrid unlocked={new Set(library.map((e) => e.beat.id)).size} />
      </div>

      <div id="demo" className="scroll-mt-24">
        <MyDemos />
      </div>

      {orders.length > 0 && (
        <section aria-labelledby="ordini-title" className="space-y-4">
          <h2 id="ordini-title" className="font-display text-xl font-semibold">
            Ordini allo studio <span className="text-chrome-400">· {orders.length}</span>
          </h2>
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="glass flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-semibold">
                    {SERVICES[o.kind].name} · {findTier(o.kind, o.tierId)?.name ?? o.tierId}
                  </span>
                  <span className="block truncate text-[13px] text-chrome-500">
                    {o.beat ? `${o.beat.title} · ` : ""}
                    {o.scheduledFor ? `${formatDay(o.scheduledFor)} · ` : ""}
                    {o.paidWith === "CREDITS" ? `${o.creditsSpent} crediti` : formatEuro(o.amountCents)}
                    {o.discountPct ? ` (-${o.discountPct}% Resident)` : ""}
                  </span>
                </span>
                <GlowBadge tone={o.status === "DELIVERED" ? "ok" : o.status === "CANCELED" || o.status === "REFUNDED" ? "chrome" : "studio"}>
                  {SERVICE_STATUS[o.status]}
                </GlowBadge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(ownedProducts.length > 0 || giftCards.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          {ownedProducts.length > 0 && (
            <section aria-labelledby="kit-title" className="glass rounded-[28px] p-6">
              <h2 id="kit-title" className="flex items-center gap-2 font-display text-xl font-semibold">
                <Package className="size-5 text-electric" /> Kit e preset
              </h2>
              <ul className="mt-4 space-y-2">
                {ownedProducts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.title}</span>
                      <span className="text-xs text-chrome-500">{PRODUCT_KINDS[p.kind]}</span>
                    </span>
                    <a
                      href={`/api/products/${encodeURIComponent(p.id)}/download`}
                      download
                      className="chrome-surface inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold"
                    >
                      <Download className="size-3.5 text-electric" /> ZIP
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {giftCards.length > 0 && (
            <section aria-labelledby="gift-title" className="glass rounded-[28px] p-6">
              <h2 id="gift-title" className="flex items-center gap-2 font-display text-xl font-semibold">
                <Gift className="size-5 text-studio" /> Gift card comprate
              </h2>
              <ul className="mt-4 space-y-2">
                {giftCards.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <code className="block text-sm font-semibold">{g.code}</code>
                      <span className="text-xs text-chrome-500">
                        {g.credits} crediti{g.recipientName ? ` · per ${g.recipientName}` : ""}
                      </span>
                    </span>
                    <GlowBadge tone={g.redeemed ? "chrome" : "ok"}>{g.redeemed ? "Usata" : "Da usare"}</GlowBadge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {customizations.length > 0 && (
        <section aria-labelledby="custom-title" className="space-y-4">
          <h2 id="custom-title" className="font-display text-xl font-semibold">
            Le tue personalizzazioni <span className="text-chrome-400">· {customizations.length}</span>
          </h2>
          <ul className="space-y-2">
            {customizations.map((c) => (
              <li key={c.id} className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
                <Link href={`/beats/${c.beat.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <BeatCover beat={c.beat} />
                  <span className="min-w-0">
                    <span className="block truncate font-display font-semibold">{c.beat.title} · su misura</span>
                    <span className="block truncate text-[13px] text-chrome-500">
                      {c.options.map((o) => CUSTOMIZATION_OPTIONS.find((d) => d.id === o)?.name ?? o).join(", ")}
                      {c.express ? " · express" : ""}
                    </span>
                  </span>
                </Link>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-xs text-chrome-500">
                    {c.status === "DELIVERED" ? "Consegnata" : `Consegna entro il ${formatDay(c.dueAt)}`}
                  </span>
                  <GlowBadge tone={c.status === "DELIVERED" ? "ok" : c.status === "REFUNDED" ? "chrome" : "studio"}>
                    {CUSTOMIZATION_STATUS[c.status]}
                  </GlowBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="licenze" aria-labelledby="licenze-title" className="scroll-mt-24 space-y-4">
        <h2 id="licenze-title" className="font-display text-xl font-semibold">
          Le tue licenze <span className="text-chrome-400">· {library.length}</span>
        </h2>
        {library.length ? (
          <ul className="space-y-2">
            {library.map(({ beat, license }) => (
              <li key={license.id} className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
                <Link href={`/beats/${beat.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
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
                      className="chrome-surface inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold transition"
                    >
                      <Download className="size-3.5 text-electric" /> {asset}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="glass rounded-2xl p-6 text-sm text-chrome-500">
            Non hai ancora sbloccato beat. <Link href="/beats/cerca" className="font-semibold text-electric">Esplora il catalogo</Link>.
          </p>
        )}
      </section>

      <section id="movimenti" aria-labelledby="movimenti-title" className="glass scroll-mt-24 rounded-[28px] p-6">
        <h2 id="movimenti-title" className="font-display text-xl font-semibold">Movimenti crediti</h2>
        <ul className="mt-4 divide-y divide-chrome-200">
          {ledger.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.description ?? LEDGER_LABELS[t.type]}</span>
                <span className="text-xs text-chrome-500">
                  {LEDGER_LABELS[t.type] ?? t.type} · {formatRelativeDay(t.createdAt)}
                </span>
              </span>
              <span className="text-right">
                <GlowBadge tone={t.amount > 0 ? "ok" : "chrome"} className={cn("", t.amount < 0 && "text-graphite")}>
                  {t.amount > 0 ? `+${t.amount}` : t.amount}
                </GlowBadge>
                <span className="mt-2 block text-[11px] text-chrome-500">saldo {t.balanceAfter}</span>
              </span>
            </li>
          ))}
          {!ledger.length && <li className="py-4 text-sm text-chrome-500">Nessun movimento.</li>}
        </ul>
      </section>

      <section id="impostazioni" aria-labelledby="impostazioni-title" className="scroll-mt-24 space-y-4">
        <h2 id="impostazioni-title" className="font-display text-xl font-semibold">
          Impostazioni
        </h2>
        <SettingsCard />
      </section>
    </RevealList>
  );
}
