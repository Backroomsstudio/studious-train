/**
 * Web Worker dello studio: autotune e de-esser fuori dal thread della pagina,
 * così l'interfaccia resta fluida mentre una take di 30 secondi viene "accordata".
 */
import { processVoice, type ProcessInput } from "@/lib/beats/audio/process";

interface WorkerScope {
  onmessage: ((event: MessageEvent<ProcessInput & { id: number }>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, ...input } = event.data;
  try {
    const out = processVoice(input);
    const transfer = [out.tuned?.buffer, out.proc?.buffer].filter((b): b is ArrayBuffer => b instanceof ArrayBuffer);
    scope.postMessage({ id, ok: true, out }, transfer);
  } catch (error) {
    scope.postMessage({ id, ok: false, error: String(error) }, []);
  }
};
