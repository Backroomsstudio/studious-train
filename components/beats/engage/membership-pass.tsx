"use client";

import { Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { recordAchievement } from "@/lib/beats/achievements";
import { PLANS } from "@/lib/beats/plans";
import { encodeQr, qrPath, type QrCode } from "@/lib/beats/qr";
import type { Viewer } from "@/lib/beats/types";
import { useHydrated } from "@/lib/beats/use-hydrated";
import { useViewer } from "../providers";
import { ChromeButton, ChromeLink } from "../ui/chrome-button";
import { canvasToBlob, createCanvas, downloadBlob, drawQr, fitText, FONT_DISPLAY, roundRect } from "./share-image";

type PassViewer = Pick<Viewer, "name" | "artistName" | "level" | "referralCode" | "plan" | "creditBalance">;

/** Codice tessera leggibile: il codice invito, o un codice ricavato dal nome. */
export function memberCode(viewer: Pick<Viewer, "referralCode" | "artistName" | "name">): string {
  if (viewer.referralCode) return viewer.referralCode;
  const base = (viewer.artistName ?? viewer.name).toUpperCase().normalize("NFD").replace(/[^A-Z0-9]/g, "");
  return (base || "RESIDENT").slice(0, 10);
}

function QrSvg({ code, className }: { code: QrCode; className?: string }) {
  const total = code.size + 8;
  return (
    <svg viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges" className={className} role="img" aria-label="QR Code del tuo invito">
      <rect width={total} height={total} fill="#fff" />
      <path d={qrPath(code)} fill="#0b0d11" />
    </svg>
  );
}

async function renderPassPng(v: PassViewer, code: QrCode, link: string): Promise<Blob> {
  const W = 1000;
  const H = 1400;
  const { canvas, ctx } = createCanvas(W, H);
  const color = v.level.color;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1f2937");
  bg.addColorStop(1, "#05070a");
  roundRect(ctx, 0, 0, W, H, 64);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const glow = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 520);
  glow.addColorStop(0, `${color}88`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9ca3af";
  ctx.font = `800 30px ${FONT_DISPLAY}`;
  ctx.fillText("BACKROOMS BEAT STORE", 72, 120);
  ctx.textAlign = "right";
  ctx.fillText("CREDITI", W - 72, 120);
  ctx.fillStyle = "#00f0ff";
  ctx.font = `900 64px ${FONT_DISPLAY}`;
  ctx.fillText(String(v.creditBalance), W - 72, 190);
  ctx.textAlign = "left";

  ctx.fillStyle = "#c9ced6";
  ctx.font = `800 26px ${FONT_DISPLAY}`;
  ctx.fillText("TESSERA RESIDENT", 72, 300);
  ctx.fillStyle = color;
  fitText(ctx, v.level.name.toUpperCase(), 72, 400, W - 144, (s) => `900 ${s}px ${FONT_DISPLAY}`, 110);

  const fields: Array<[string, string]> = [
    ["ARTISTA", v.artistName ?? v.name],
    ["PIANO", v.plan ? PLANS[v.plan.tier].name : "Nessuno"],
    ["MESI", String(v.level.months)],
  ];
  fields.forEach(([label, value], i) => {
    const x = 72 + i * 300;
    ctx.fillStyle = "#9ca3af";
    ctx.font = `800 24px ${FONT_DISPLAY}`;
    ctx.fillText(label, x, 500);
    ctx.fillStyle = "#f8f9fa";
    fitText(ctx, value, x, 552, i === 0 ? 300 : 260, (s) => `700 ${s}px ${FONT_DISPLAY}`, 40);
  });

  const qrSize = (code.size + 8) * 14;
  const qx = (W - qrSize) / 2;
  roundRect(ctx, qx - 24, 640, qrSize + 48, qrSize + 48, 36);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  drawQr(ctx, code, qx, 664, qrSize);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8f9fa";
  ctx.font = `800 40px ${FONT_DISPLAY}`;
  ctx.fillText(memberCode(v), W / 2, 664 + qrSize + 110);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `500 26px ${FONT_DISPLAY}`;
  fitText(ctx, link.replace(/^https?:\/\//, ""), W / 2, 664 + qrSize + 160, W - 144, (s) => `500 ${s}px ${FONT_DISPLAY}`, 26);
  return canvasToBlob(canvas);
}

/**
 * Tessera Resident: nome d'artista, piano, livello e codice invito con QR (porta al link d'invito).
 * Scaricabile come PNG da tenere nel rullino o nel Wallet. Senza `viewer` usa l'artista collegato.
 */
export function MembershipPass({ viewer: given, className }: { viewer?: PassViewer | null; className?: string }) {
  const { data } = useViewer();
  const viewer = given ?? data ?? null;
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const code = viewer ? memberCode(viewer) : "";
  // L'origine si legge solo nel browser: prima dell'idratazione il QR resta un segnaposto.
  const link = hydrated && viewer ? `${window.location.origin}/beats/accedi?invito=${encodeURIComponent(code)}` : "";
  const qr = useMemo(() => (link ? encodeQr(link, { ecc: "M" }) : null), [link]);

  if (!viewer) {
    return (
      <section className={cn("glass rounded-[28px] p-5 text-sm text-chrome-500", className)} aria-label="Tessera Resident">
        <p className="font-display text-lg font-bold text-graphite">La tua tessera Resident</p>
        <p className="mt-1">Accedi per avere la tessera con il tuo codice invito.</p>
        <ChromeLink href="/beats/accedi" variant="electric" size="sm" className="mt-3">
          Accedi
        </ChromeLink>
      </section>
    );
  }

  const download = async () => {
    if (!qr) return;
    setBusy(true);
    try {
      const blob = await renderPassPng(viewer, qr, link);
      downloadBlob(blob, `tessera-backrooms-${code.toLowerCase()}.png`);
      recordAchievement("share");
    } finally {
      setBusy(false);
    }
  };

  const plan = viewer.plan ? PLANS[viewer.plan.tier].name : "Nessun piano";
  return (
    <section className={cn("space-y-3", className)} aria-labelledby="pass-title">
      <div
        className="obsidian relative overflow-hidden rounded-[28px] p-5 sm:p-6"
        data-testid="membership-pass"
      >
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full blur-3xl" style={{ background: `${viewer.level.color}55` }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-chrome-400">Backrooms Beat Store</p>
            <h2 id="pass-title" className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-chrome-300">
              Tessera Resident
            </h2>
            <p className="truncate font-display text-3xl font-black" style={{ color: viewer.level.color }}>
              {viewer.level.name}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-chrome-400">Crediti</span>
            <span className="font-mono text-2xl font-black text-electric-cyan">{viewer.creditBalance}</span>
          </p>
        </div>
        <dl className="relative mt-4 grid grid-cols-[1.4fr_1fr_auto] gap-3 text-sm">
          {[
            ["Artista", viewer.artistName ?? viewer.name],
            ["Piano", plan],
            ["Mesi", String(viewer.level.months)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-chrome-400">{label}</dt>
              <dd className="truncate font-semibold text-chrome-50">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="relative mt-5 flex items-center gap-4 rounded-2xl bg-white p-3 text-graphite">
          {qr ? <QrSvg code={qr} className="size-32 shrink-0 sm:size-36" /> : <span className="size-32 shrink-0 rounded-lg bg-chrome-100 sm:size-36" aria-hidden />}
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-chrome-500">Codice invito</p>
            <p className="font-mono text-xl font-black tracking-wider">{code}</p>
            <p className="mt-1 text-xs text-chrome-500">Fallo inquadrare: chi si abbona con il tuo invito riceve crediti in regalo, e anche tu.</p>
          </div>
        </div>
      </div>
      <ChromeButton onClick={download} disabled={!qr || busy} className="w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4 text-electric" />} Scarica la tessera (PNG)
      </ChromeButton>
    </section>
  );
}
