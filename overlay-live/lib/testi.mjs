// Dimensione dei testi dei layout nuovi (drum, produzione, reaction, podcast): una percentuale per ogni gruppo di testi,
// 100 = dimensione di base. Solo funzioni pure, usate dal server e dai loro stati iniziali.
import { numeroTra, oggetto } from "./validazione.mjs";

export const FORMATI_TESTI = {
  drum: { contatore: "Contatore Like", traguardi: "Colonna traguardi", brano: "Brano in esecuzione", priorita: "Dona un…", sblocco: "Banner di sblocco" },
  produzione: { sopra: "Riga sopra", titolo: "Titolo", sotto: "Riga sotto" },
  reaction: { sopra: "Riga sopra", titolo: "Titolo", sotto: "Riga sotto" },
  podcast: { targa: "Targa", tematiche: "Pannello Tematiche" },
};

export const TESTO_MIN = 60;
export const TESTO_MAX = 200;

function gruppi(formato) {
  if (typeof formato !== "string" || !Object.hasOwn(FORMATI_TESTI, formato)) throw new Error(`Formato sconosciuto: ${formato}`);
  return FORMATI_TESTI[formato];
}

export const testiBase = (formato) => Object.fromEntries(Object.keys(gruppi(formato)).map((id) => [id, 100]));

// Parte dal 100% di ogni gruppo: quelli presenti in `valori` devono esistere e valere un intero tra 60 e 200.
export function controllaTesti(formato, valori) {
  const etichette = gruppi(formato);
  if (!oggetto(valori)) throw new Error("Testi: forma non valida");
  const nuovi = testiBase(formato);
  for (const [id, valore] of Object.entries(valori)) {
    if (!Object.hasOwn(etichette, id)) throw new Error(`Testo sconosciuto: ${id}`);
    nuovi[id] = numeroTra(valore, TESTO_MIN, TESTO_MAX, `Dimensione di «${etichette[id]}» (%)`);
  }
  return nuovi;
}

// Dalla regia: { id: percento, … } cambia solo quelli dati; { azzera: true } torna al 100%. Un errore non cambia nulla.
export function impostaTesti(stato, formato, modifiche) {
  gruppi(formato);
  const attuali = stato[formato]?.testi;
  if (!oggetto(attuali)) throw new Error(`Formato senza testi: ${formato}`);
  if (!oggetto(modifiche)) throw new Error("Testi: forma non valida");
  stato[formato].testi = modifiche.azzera === true ? testiBase(formato) : controllaTesti(formato, { ...attuali, ...modifiche });
}
