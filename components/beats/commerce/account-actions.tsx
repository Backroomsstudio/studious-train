"use client";

import { Copy, Loader2, PauseCircle, PlayCircle, Share2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { REFERRAL } from "@/lib/beats/offers";
import { api } from "../providers";
import { ChromeButton } from "../ui/chrome-button";

/** Link d'invito personale: 5 crediti a te e 5 a chi si abbona. */
export function ReferralCard({ code }: { code: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);
  const link = `${origin}/beats/accedi?invito=${code}`;

  const share = async () => {
    const text = `Entra nel Backrooms Beat Store con il mio invito: ${REFERRAL.invitedCredits} crediti in regalo al primo abbonamento.`;
    if (canShare) {
      await navigator.share({ title: "Backrooms Beat Store", text, url: link }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section aria-labelledby="inviti" className="glass rounded-[28px] p-6 sm:p-6">
      <h2 id="inviti" className="flex items-center gap-2 font-display text-xl font-semibold">
        <Users className="size-5 text-electric" /> Invita un artista
      </h2>
      <p className="mt-2 text-sm text-chrome-500">
        Quando si abbona, ricevete {REFERRAL.inviterCredits} crediti a testa nel portafoglio (non scadono).
      </p>
      <div className="mt-4 flex gap-2">
        <code className="chrome-surface flex h-12 min-w-0 flex-1 items-center truncate rounded-2xl px-4 text-sm" suppressHydrationWarning>
          {origin ? link.replace(/^https?:\/\//, "") : code}
        </code>
        <ChromeButton variant="obsidian" className="h-12" onClick={share} aria-label="Condividi il link d'invito">
          {copied ? "Copiato" : canShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}
        </ChromeButton>
      </div>
    </section>
  );
}

/** Pausa di un mese al posto della disdetta: niente addebiti, i crediti restano. */
export function PauseButton({ pausedUntil }: { pausedUntil: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    if (!pausedUntil && !window.confirm("Mettere in pausa l'abbonamento per un mese? Non paghi e i crediti che hai restano tuoi.")) return;
    setPending(true);
    setError(null);
    try {
      await api("/api/billing/pause", { method: "POST", body: JSON.stringify({ resume: Boolean(pausedUntil) }) });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <div>
      <ChromeButton variant="ghost" className="w-full text-chrome-200 hover:bg-white/10 hover:text-white" onClick={toggle} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : pausedUntil ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
        {pausedUntil ? "Riprendi ora" : "Metti in pausa 1 mese"}
      </ChromeButton>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-deal">
          {error}
        </p>
      )}
    </div>
  );
}
