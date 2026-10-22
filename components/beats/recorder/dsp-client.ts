"use client";

import { processVoice, type ProcessInput, type ProcessOutput } from "@/lib/beats/audio/process";

/**
 * Coda verso il Web Worker DSP. Se il worker non parte (browser vecchi, CSP), si ripiega sul
 * thread principale dopo un setTimeout, così lo scheletro "Accordo…" fa in tempo a comparire.
 */
type Pending = { input: ProcessInput; resolve: (out: ProcessOutput) => void; reject: (error: unknown) => void };

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, Pending>();

function fallback(job: Pending) {
  setTimeout(() => {
    try {
      job.resolve(processVoice(job.input));
    } catch (error) {
      job.reject(error);
    }
  }, 40);
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./dsp.worker.ts", import.meta.url), { type: "module", name: "backrooms-dsp" });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; out?: ProcessOutput; error?: string }>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.ok && event.data.out) job.resolve(event.data.out);
      else fallback(job);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      const jobs = [...pending.values()];
      pending.clear();
      jobs.forEach(fallback);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Autotune + de-esser in background. La take originale viene copiata, non trasferita. */
export function processInBackground(input: ProcessInput): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const job: Pending = { input, resolve, reject };
    const w = getWorker();
    if (!w) return fallback(job);
    const id = ++seq;
    pending.set(id, job);
    w.postMessage({ id, ...input });
  });
}
