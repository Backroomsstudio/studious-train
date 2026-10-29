/**
 * Beat visibili al pubblico: pubblicati e già usciti. Un'uscita programmata (releasedAt nel futuro)
 * resta nascosta da catalogo, ascolto e sblocco fino alla data, poi compare da sola.
 */
export const liveBeatWhere = (now = new Date()) => ({ status: "PUBLISHED" as const, releasedAt: { lte: now } });
