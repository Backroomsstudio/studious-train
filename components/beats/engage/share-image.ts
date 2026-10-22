/**
 * Immagini da condividere (storia di Wrapped, tessera): disegno su canvas → PNG,
 * poi Web Share con file (telefono) oppure download diretto (desktop).
 */
import type { QrCode } from "@/lib/beats/qr";

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Impossibile creare l'immagine."))), "image/png"),
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Condivide il PNG se il browser lo permette; altrimenti lo scarica. Restituisce come è andata. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "canceled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return "canceled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");
  return { canvas, ctx };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Testo che si restringe fino a stare in `maxWidth`. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: (size: number) => string, size: number): void {
  let s = size;
  ctx.font = font(s);
  while (s > 12 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(s);
  }
  ctx.fillText(text, x, y);
}

/** QR su fondo bianco con margine di 4 moduli (obbligatorio per la lettura). */
export function drawQr(ctx: CanvasRenderingContext2D, code: QrCode, x: number, y: number, size: number): void {
  const total = code.size + 8;
  const cell = size / total;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#0b0d11";
  code.modules.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) ctx.fillRect(Math.floor(x + (c + 4) * cell), Math.floor(y + (r + 4) * cell), Math.ceil(cell), Math.ceil(cell));
    }),
  );
}

export const FONT_DISPLAY = '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, system-ui, sans-serif';
