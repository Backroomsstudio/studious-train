// Live session in studio: voci della barra e giro delle comparse. Funzioni pure (niente DOM): le usano la pagina, la regia e i test.
import { vociSocial, breve } from "./barra.js";

// Le comparse salgono dalla barra in 0,9 s e scendono in 0,55 s.
export const SALITA_COMPARSA_MS = 900;
export const USCITA_COMPARSA_MS = 550;
// La targa gira su se stessa quando cambia l'artista: il nome nuovo compare a metà giro.
export const GIRO_TARGA_MS = 1100;

// Gli stessi social della barra senza premio, con «In studio ora: nome · @instagram» subito dopo il primo.
export function vociStudio(s) {
  const st = s.studio;
  const social = vociSocial(s.senzaPremio);
  const artista =
    st.artistaNellaBarra && st.artista.trim()
      ? {
          tipo: "artista",
          chiave: `artista|${st.artista}|${st.instagram}`,
          icone: ["microfono"],
          etichetta: "In studio ora",
          testo: breve(st.artista, 32),
          instagram: st.instagram ? `@${st.instagram}` : "",
        }
      : null;
  const [primo, ...resto] = social;
  return [primo, artista, ...resto].filter(Boolean);
}

// Comparse chieste dalla regia in questo aggiornamento: l'id scelto, oppure null per «la prossima del giro».
export function richiesteComparsa(prima, dopo, eventi = []) {
  if (!prima || dopo.visibili?.comparse === false) return [];
  return eventi.filter((e) => e.nome === "comparsa").map((e) => e.dati?.id ?? null);
}

// Quale comparsa mostrare. Con un id quella (anche se spenta: la regia l'ha chiesta apposta);
// senza, la prossima accesa dopo l'ultima mostrata, a giro. Se l'ultima è stata spenta o tolta,
// si continua dalla prima accesa che la seguiva.
export function prossimaComparsa(comparse = [], ultimaId = null, id = null) {
  if (id) return comparse.find((c) => c.id === id) ?? null;
  const attive = comparse.filter((c) => c.attiva);
  if (!attive.length) return null;
  const i = attive.findIndex((c) => c.id === ultimaId);
  if (i >= 0 || !ultimaId) return attive[(i + 1) % attive.length];
  const pos = comparse.findIndex((c) => c.id === ultimaId);
  return (pos >= 0 && comparse.slice(pos + 1).find((c) => c.attiva)) || attive[0];
}
