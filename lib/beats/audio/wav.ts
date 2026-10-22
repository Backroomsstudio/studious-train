/**
 * Codifica WAV PCM a 16 bit, senza dipendenze dal browser: accetta canali Float32 già renderizzati
 * (es. `AudioBuffer.getChannelData`), così è testabile anche in Node.
 */
export interface PcmAudio {
  sampleRate: number;
  channels: Float32Array[];
}

export function encodeWav({ sampleRate, channels }: PcmAudio): Uint8Array {
  const channelCount = channels.length;
  const length = channels[0]?.length ?? 0;
  const bytes = new Uint8Array(44 + length * channelCount * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + length * channelCount * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * channelCount * 2, true);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channelCount; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, Math.round(s < 0 ? s * 32768 : s * 32767), true);
      offset += 2;
    }
  }
  return bytes;
}

/** Riporta i picchi sotto `ceiling` (il compressore del browser non è un limiter perfetto). */
export function limitPeaks(channels: Float32Array[], ceiling = 0.95): number {
  let peak = 0;
  for (const data of channels) for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > ceiling) {
    const k = ceiling / peak;
    for (const data of channels) for (let i = 0; i < data.length; i++) data[i] *= k;
  }
  return peak;
}
