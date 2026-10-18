// «Modalità sicura TikTok»: le scelte della regia. Il filtro vero (che toglie link, indirizzi e altre piattaforme dallo schermo) sta
// in public/js/sicurezza.js e lavora sulle pagine; qui ci sono solo i tre interruttori, validati su una copia come ogni altro modulo.
import { corpo, oggetto, siNo } from "./validazione.mjs";

// attiva: toglie dallo schermo indirizzi, account e altre piattaforme (al loro posto «link in bio»);
// calmo: le animazioni che si ripetono all'infinito (scintillio, REC, monete) si fermano dopo il primo giro;
// nascondiPagamenti: Skip, Super Skip e Throne non si vedono come tali (nessuna scheda dorata «a pagamento»).
const CAMPI = { attiva: "Modalità sicura", calmo: "Movimento ridotto", nascondiPagamenti: "Nascondi i pagamenti" };

export const sicurezzaIniziale = () => ({ attiva: true, calmo: false, nascondiPagamenti: false });

export function impostaSicurezza(stato, dati) {
  const modifiche = corpo(dati, "Sicurezza");
  const nuova = { ...stato.sicurezza };
  for (const [campo, nome] of Object.entries(CAMPI)) {
    if (modifiche[campo] !== undefined) nuova[campo] = siNo(modifiche[campo], nome);
  }
  stato.sicurezza = nuova;
}

// Da uno stato salvato: i campi buoni restano, gli altri tornano ai predefiniti. Mai eccezioni.
export function fondiSicurezza(salvato) {
  const base = sicurezzaIniziale();
  if (!oggetto(salvato)) return base;
  for (const campo of Object.keys(CAMPI)) if (typeof salvato[campo] === "boolean") base[campo] = salvato[campo];
  return base;
}
