"use client";

import type { UploadSlot } from "@/lib/beats/staff";
import { api } from "../providers";

/**
 * Caricamento diretto sul bucket: il server firma l'URL, il browser fa il PUT con l'avanzamento.
 * Restituisce la chiave dell'oggetto, da salvare insieme al beat o al kit.
 */
export async function uploadToSlot(
  file: File,
  draftId: string,
  slot: UploadSlot,
  onProgress: (ratio: number) => void,
): Promise<string> {
  const { key, url, contentType } = await api<{ key: string; url: string; contentType: string }>("/api/staff/uploads", {
    method: "POST",
    body: JSON.stringify({ draftId, slot, filename: file.name, size: file.size }),
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Caricamento non riuscito (errore ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Caricamento interrotto: controlla la connessione e riprova."));
    xhr.send(file);
  });
  onProgress(1);
  return key;
}

/** Durata e forma d'onda (picchi 0..1) dall'anteprima, calcolate nel browser prima del salvataggio. */
export async function analyzeAudio(file: File, buckets = 160): Promise<{ durationSec: number; peaks: number[] }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const size = Math.max(1, Math.floor(buffer.length / buckets));
    const raw: number[] = [];
    for (let b = 0; b < buckets; b++) {
      let peak = 0;
      const start = b * size;
      const end = Math.min(buffer.length, start + size);
      for (const data of channels) for (let i = start; i < end; i += 4) peak = Math.max(peak, Math.abs(data[i]));
      raw.push(peak);
    }
    const max = Math.max(...raw, 1e-6);
    return { durationSec: Math.round(buffer.duration), peaks: raw.map((p) => Math.round((p / max) * 1000) / 1000) };
  } finally {
    void ctx.close();
  }
}

export const newDraftId = () => crypto.randomUUID();
