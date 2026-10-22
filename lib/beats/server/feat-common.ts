/**
 * Pezzi di "Cerco feat" in comune tra backend Prisma e demo (niente `server-only`: lo usano anche i test).
 */
import type { z } from "zod";
import { levelFor } from "../offers";
import type { FeatArtist } from "../types";
import { StoreError } from "./errors";

/** Ricontrollo dei dati anche dentro il backend: le route validano già, ma il contratto non si fida. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new StoreError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Richiesta non valida.");
  return parsed.data;
}

export function featArtist(name: string, color: string, months: number): FeatArtist {
  const { level } = levelFor(months);
  return { name, color, level: { id: level.id, name: level.name, color: level.color } };
}

export const FEAT_ERRORS = {
  postNotFound: () => new StoreError("NOT_FOUND", "Annuncio non trovato."),
  threadNotFound: () => new StoreError("NOT_FOUND", "Chat non trovata."),
  notAuthor: () => new StoreError("FORBIDDEN", "Solo chi ha pubblicato l'annuncio può chiuderlo."),
  ownPost: () => new StoreError("BAD_REQUEST", "È il tuo annuncio: le risposte arrivano in “I tuoi messaggi”."),
  closed: () => new StoreError("BAD_REQUEST", "Questo annuncio è chiuso: non accetta nuove risposte."),
  badGenre: () => new StoreError("BAD_REQUEST", "Genere non valido."),
  badBeat: () => new StoreError("BAD_REQUEST", "Beat non trovato nel catalogo."),
};
