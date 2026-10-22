"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { FEAT_REPORT_REASONS } from "@/lib/beats/feat";
import { Chip } from "../ui/chip";
import { ChromeButton } from "../ui/chrome-button";
import { Dialog } from "../ui/dialog";
import { useReportFeat } from "./use-feat";

export type ReportTarget = { postId?: string; messageId?: string; label: string };

/** Segnalazione di un annuncio o di un messaggio: un motivo e via, lo staff controlla a mano. */
export function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const report = useReportFeat();
  const [reason, setReason] = useState<string>(FEAT_REPORT_REASONS[0]);

  const close = (open: boolean) => {
    if (open) return;
    onClose();
    report.reset();
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={close} title="Segnala" description={target?.label}>
      {report.isSuccess ? (
        <div className="space-y-4">
          <p className="rounded-2xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">Grazie: lo controlliamo noi entro 24 ore.</p>
          <ChromeButton className="w-full" onClick={() => close(false)}>
            Chiudi
          </ChromeButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Motivo">
            {FEAT_REPORT_REASONS.map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          {report.error && (
            <p role="alert" className="text-sm text-deal">
              {report.error.message}
            </p>
          )}
          <ChromeButton
            variant="electric"
            className="w-full"
            disabled={report.isPending || !target}
            onClick={() => target && report.mutate({ postId: target.postId, messageId: target.messageId, reason })}
          >
            {report.isPending ? <Loader2 className="size-4 animate-spin" /> : "Invia segnalazione"}
          </ChromeButton>
        </div>
      )}
    </Dialog>
  );
}
