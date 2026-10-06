// Voci della barra che scorre nel layout senza premio. Funzioni pure (niente DOM): le usano la pagina, la regia e i test.

export const ETICHETTE_TIER = { skip: "Skip", superskip: "Super Skip", throne: "Throne" };
// «Oggi abbiamo ascoltato N tracce» compare da questo numero in su (con 1 o 2 non convince nessuno).
export const MIN_ASCOLTATE = 3;

export function breve(testo, max) {
  const t = String(testo ?? "").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Le voci in ordine di passaggio: i social della regia, con la traccia in ascolto subito dopo la prima voce
// (di solito nero.fan/backrooms: «mandala anche tu») e le tracce ascoltate oggi prima dell'ultima.
// Ogni voce ha una «chiave»: se cambia, la pagina rifà il pezzo (solo quando non è in vista).
export function vociBarra(s) {
  const sp = s.senzaPremio;
  const social = sp.voci
    .filter((v) => v.attiva && v.testo)
    .map((v) => ({
      tipo: "social",
      chiave: `social|${v.id}|${v.icona}|${v.etichetta}|${v.testo}`,
      icone: v.icona.split("+"),
      etichetta: v.etichetta,
      testo: v.testo,
      oro: v.icona === "nero",
    }));
  const t = s.corrente;
  const ascolto =
    sp.inAscoltoNellaBarra && t.titolo.trim()
      ? {
          tipo: "ascolto",
          chiave: `ascolto|${t.id}|${t.titolo}|${t.artista}|${t.tier}`,
          titolo: breve(t.titolo, 40),
          artista: breve(t.artista, 30),
          tier: ETICHETTE_TIER[t.tier] ? t.tier : null,
        }
      : null;
  const ascoltate =
    sp.ascoltateNellaBarra && s.ascoltate >= MIN_ASCOLTATE
      ? { tipo: "ascoltate", chiave: `ascoltate|${s.ascoltate}`, icone: ["cuffie"], etichetta: "Oggi abbiamo ascoltato", testo: `${s.ascoltate} tracce` }
      : null;
  const [primo, ...resto] = social;
  const ultimo = resto.length ? resto.pop() : null;
  return [primo, ascolto, ...resto, ascoltate, ultimo].filter(Boolean);
}

// Stima della durata di un giro completo della barra (per la regia): larghezze medie di Barlow Condensed.
export function stimaGiroSecondi(voci, velocita) {
  const larghezza = voci.reduce((somma, v) => {
    const icone = v.tipo === "ascolto" ? 34 : 56 + (v.icone.length - 1) * 42;
    const testi = v.tipo === "ascolto" ? `${v.titolo}${v.artista}`.length * 23 + 220 : (v.etichetta ?? "").length * 16 + v.testo.length * 21;
    return somma + icone + 42 + testi + 96;
  }, 0);
  return velocita > 0 ? Math.round(larghezza / velocita) : 0;
}
