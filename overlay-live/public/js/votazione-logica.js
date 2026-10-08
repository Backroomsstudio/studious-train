// Votazione della gara: parti pure usate dalla regia (e provate dai test, senza browser).

// La percentuale che pesa ogni voce: interi che sommano sempre 100. Gli arrotondamenti possono lasciare 99 o 101: la
// differenza va alla voce col peso più grande (la prima, se ce ne sono due uguali). Un peso vuoto, scritto male o negativo
// vale 0; senza nessun peso, tutte a 0.
export function percentualiPesi(pesi) {
  const nomi = Object.keys(pesi);
  const valori = nomi.map((nome) => {
    const n = Number(pesi[nome]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const totale = valori.reduce((somma, v) => somma + v, 0);
  if (!totale) return Object.fromEntries(nomi.map((nome) => [nome, 0]));
  const interi = valori.map((v) => Math.round((v * 100) / totale));
  interi[valori.indexOf(Math.max(...valori))] += 100 - interi.reduce((somma, v) => somma + v, 0);
  return Object.fromEntries(nomi.map((nome, i) => [nome, interi[i]]));
}
