"use client";

import { ArrowRight, Download, FolderDown, SlidersHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChromeButton } from "@/components/beats/ui/chrome-button";
import { useStudio } from "./studio-store";

/** "La tua demo": export ZIP, condivisione, salvataggio locale, Master A/B e il mix & master vero. */
export function ExportPanel() {
  const router = useRouter();
  const busy = useStudio((s) => s.busy);
  const projectId = useStudio((s) => s.projectId);
  const beat = useStudio((s) => s.beat)!;
  const hasTakes = useStudio((s) => s.tracks.some((t) => t.take));
  const recording = useStudio((s) => s.transport === "rec" || s.transport === "count");
  const { exportZip, share, saveProject, prepareMaster } = useStudio.getState();
  const disabled = !!busy || recording;

  const openMaster = async () => {
    if (await prepareMaster()) router.push("/beats/master?sorgente=demo");
  };

  return (
    <>
      <section aria-labelledby="exp-title" className="glass grid gap-4 rounded-[28px] p-4 sm:p-6">
        <h2 id="exp-title" className="font-display text-2xl font-semibold tracking-tight">
          La tua demo
        </h2>
        <ChromeButton variant="electric" size="lg" className="w-full" onClick={() => void exportZip()} disabled={disabled} data-testid="export-zip">
          <Download className="size-4" />
          {busy === "export" ? <span className="studio-busy">Preparo i file…</span> : "Esporta (WAV in ZIP)"}
        </ChromeButton>
        <div className="grid grid-cols-2 gap-2">
          <ChromeButton variant="chrome" onClick={() => void share()} disabled={disabled}>
            <Share2 className="size-4" />
            {busy === "share" ? "Preparo…" : "Condividi"}
          </ChromeButton>
          <ChromeButton variant="chrome" onClick={() => void saveProject()} disabled={disabled} data-testid="save-project">
            <FolderDown className="size-4" />
            <span className="truncate">{busy === "save" ? "Salvo…" : projectId ? "Aggiorna il progetto" : "Salva nei progetti"}</span>
          </ChromeButton>
        </div>
        <ChromeButton variant="obsidian" onClick={() => void openMaster()} disabled={disabled}>
          <SlidersHorizontal className="size-4" />
          {busy === "master" ? "Preparo il master…" : "Master A/B: senti la demo col master"}
        </ChromeButton>
        <p className="text-xs leading-relaxed text-chrome-500">
          Nello ZIP trovi la demo completa e la sola voce con effetti, pronte da mandare a chi vuoi. È una demo sull&apos;anteprima del beat: per
          pubblicarla serve una licenza.
          {!hasTakes && " Registra o carica una voce per attivare l'export."}
        </p>
      </section>

      <Link
        href={`/beats/registra?servizio=MIX_MASTER&beat=${encodeURIComponent(beat.slug)}#servizi`}
        className="obsidian group flex items-center gap-4 rounded-[28px] p-6 transition"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-electric-cyan">Backrooms Studio</span>
          <span className="mt-2 block font-display text-xl font-semibold leading-tight">Ti piace? Mix &amp; master veri li facciamo noi</span>
          <span className="mt-2 block text-sm text-chrome-400">Mandaci la demo: Astral, Freya e Plugghe la fanno suonare come un pezzo vero.</span>
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-electric/20 text-electric-cyan transition group-hover:translate-x-0.5">
          <ArrowRight className="size-5" />
        </span>
      </Link>
    </>
  );
}
