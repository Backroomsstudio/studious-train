"use client";

import { AlertCircle, Check, FileAudio, FileArchive, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { UPLOAD_SLOTS, type UploadSlot } from "@/lib/beats/staff";
import { feedback } from "@/lib/beats/ui-feedback";
import { uploadToSlot } from "./upload";

export interface SlotState {
  /** empty = niente; saved = file già registrato; uploading/done/error = caricamento di questa sessione. */
  status: "empty" | "saved" | "uploading" | "done" | "error";
  key: string;
  name?: string;
  progress: number;
  error?: string;
}

const EMPTY: SlotState = { status: "empty", key: "", progress: 0 };

/** Stato dei caricamenti di un modulo: ogni file parte appena scelto, mentre si compilano i dati. */
export function useUploads(draftId: string, initial: Partial<Record<UploadSlot, string | null>>) {
  const [slots, setSlots] = useState<Partial<Record<UploadSlot, SlotState>>>(() => {
    const state: Partial<Record<UploadSlot, SlotState>> = {};
    for (const [slot, key] of Object.entries(initial) as Array<[UploadSlot, string | null | undefined]>) {
      if (key) state[slot] = { status: "saved", key, progress: 1 };
    }
    return state;
  });

  const patch = useCallback((slot: UploadSlot, next: Partial<SlotState>) => {
    setSlots((s) => ({ ...s, [slot]: { ...(s[slot] ?? EMPTY), ...next } }));
  }, []);

  const start = useCallback(
    async (slot: UploadSlot, file: File): Promise<string | null> => {
      patch(slot, { status: "uploading", name: file.name, progress: 0, error: undefined });
      try {
        const key = await uploadToSlot(file, draftId, slot, (progress) => patch(slot, { progress }));
        patch(slot, { status: "done", key, progress: 1 });
        feedback("pop");
        return key;
      } catch (error) {
        patch(slot, { status: "error", error: error instanceof Error ? error.message : "Caricamento non riuscito." });
        feedback("error");
        return null;
      }
    },
    [draftId, patch],
  );

  const get = (slot: UploadSlot) => slots[slot] ?? EMPTY;
  const keyOf = (slot: UploadSlot) => {
    const s = slots[slot];
    return s && (s.status === "saved" || s.status === "done") ? s.key : "";
  };
  const busy = Object.values(slots).some((s) => s?.status === "uploading");
  return { get, keyOf, start, busy };
}

export function SlotRow({
  slot,
  state,
  onFile,
  hint,
}: {
  slot: UploadSlot;
  state: SlotState;
  onFile: (file: File) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const rule = UPLOAD_SLOTS[slot];
  const Icon = rule.format === "zip" ? FileArchive : FileAudio;
  return (
    <div className="chrome-surface rounded-2xl px-4 py-4">
      <div className="flex items-center gap-4">
        <Icon className="size-5 shrink-0 text-chrome-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-graphite">{rule.label}</p>
          <p className="truncate text-[13px] text-chrome-500">
            {state.status === "empty" && (hint ?? `File .${rule.format}`)}
            {state.status === "saved" && "Caricato"}
            {(state.status === "uploading" || state.status === "done") && state.name}
            {state.status === "error" && <span className="text-deal">{state.error}</span>}
          </p>
        </div>
        <span aria-hidden className="shrink-0">
          {state.status === "uploading" && <Loader2 className="size-4 animate-spin text-chrome-500" />}
          {(state.status === "done" || state.status === "saved") && <Check className="size-4 text-ok" />}
          {state.status === "error" && <AlertCircle className="size-4 text-deal" />}
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={state.status === "uploading"}
          className="h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold text-graphite-700 ring-1 ring-inset ring-chrome-200 transition hover:text-graphite disabled:opacity-45"
        >
          {state.status === "empty" ? "Scegli" : "Sostituisci"}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          accept={rule.format === "mp3" ? ".mp3,audio/mpeg" : rule.format === "wav" ? ".wav,audio/wav" : ".zip,application/zip"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {state.status === "uploading" && (
        <div
          role="progressbar"
          aria-label={`Caricamento ${rule.label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.progress * 100)}
          className="mt-4 h-1 overflow-hidden rounded-full bg-chrome-200"
        >
          <div className="h-full rounded-full bg-electric transition-[width] duration-200" style={{ width: `${state.progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** Area dove trascinare più file insieme: ognuno va al suo posto in base al nome. */
export function DropZone({ onFiles, label, accept }: { onFiles: (files: File[]) => void; label: string; accept: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFiles(Array.from(e.dataTransfer.files));
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-[24px] border border-dashed px-6 py-8 text-center transition",
          over ? "border-electric bg-electric-50" : "border-chrome-300 bg-chrome-50",
        )}
      >
        <Upload className="size-6 text-chrome-500" aria-hidden />
        <span className="text-[15px] font-semibold text-graphite">{label}</span>
        <span className="text-[13px] text-chrome-500">Oppure tocca per sceglierli dal computer o dal telefono</span>
      </button>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={accept}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
