// Goal Like e Follower: «Mancano X like al nuovo obiettivo» e «Mancano Y follower al nuovo obiettivo». Funzioni pure sullo stato
// (nessun I/O): `stato.goal` tiene gli obiettivi, il totale dei follower noto, il modo (sempre in onda o a comparsa) e la
// posizione scelta per ogni layout; i like li conta già il Drum (`contati`), qualunque layout sia in onda.
import { corpo, numeroTra, oggetto } from "./validazione.mjs";
import { contati } from "./drum.mjs";

// Un layout per ogni pagina overlay; per Podcast e Reaction anche la versione orizzontale (16:9).
export const LAYOUT_GOAL = ["gara", "senzaPremio", "studio", "battle", "drum", "produzione", "podcast", "podcastO", "reaction", "reactionO"];
export const MAX_NUMERO = 10_000_000_000; // obiettivi e follower
const MAX_PASSO = 1_000_000;
const LATO_TELA = 1920; // x e y della posizione, in pixel della tela

export const goalIniziale = () => ({
  like: { obiettivo: 15000, passo: 1000 },
  follower: { obiettivo: 50, passo: 10, totale: null }, // totale: l'ultimo valore noto (null = ancora sconosciuto)
  modo: "fisso", // "fisso" (sempre in onda) o "comparsa" (compare ogni `ogniMinuti` e resta `durataSecondi`)
  ogniMinuti: 5,
  durataSecondi: 15,
  posizioni: {}, // layout → { x, y, scala } (quello che manca è la posizione di partenza della pagina)
});

// L'obiettivo da mostrare: quello scelto finché il totale non lo raggiunge; poi, con un passo, il primo multiplo del passo maggiore
// del totale (anche se il totale ha saltato più obiettivi in un colpo); con passo 0 resta quello scelto.
export function obiettivoAttuale(totale, obiettivo, passo) {
  const t = Number.isFinite(totale) && totale > 0 ? totale : 0;
  if (t < obiettivo || !(passo > 0)) return obiettivo;
  return t - (t % passo) + passo;
}

// Quanti ne mancano: mai sotto 1 con un passo (il prossimo obiettivo è sempre più avanti); con passo 0 sono 0 a obiettivo raggiunto.
// null se il totale non si conosce.
export function mancano(totale, obiettivo, passo) {
  if (typeof totale !== "number" || !Number.isFinite(totale) || totale < 0) return null;
  const distanza = obiettivoAttuale(totale, obiettivo, passo) - totale;
  return passo > 0 ? Math.max(1, distanza) : Math.max(0, distanza);
}

// Un follow dalla live: un totale (followCount) più alto di quello noto vale; altrimenti, se il totale è noto, si somma 1; se il
// totale non si conosce e il follow non lo porta, resta sconosciuto. Mai verso il basso, mai oltre il massimo. Dà il totale.
export function registraFollow(stato, dati) {
  const f = stato.goal.follower;
  const letto = dati?.totale;
  if (Number.isSafeInteger(letto) && letto > 0 && letto <= MAX_NUMERO && (f.totale === null || letto > f.totale)) f.totale = letto;
  else if (f.totale !== null) f.totale = Math.min(MAX_NUMERO, f.totale + 1);
  return f.totale;
}

// Modifiche dalla regia (o dall'API, comando `goal`), controllate su una copia: un errore non lascia metà modifica.
//   { like?: { obiettivo, passo }, follower?: { obiettivo, passo, imposta, aggiungi }, modo?, ogniMinuti?, durataSecondi?,
//     posizione?: { layout, x?, y?, scala?, ripristina? } }
export function impostaGoal(stato, dati) {
  corpo(dati, "Goal");
  const g = structuredClone(stato.goal);
  if (dati.like !== undefined) {
    if (!oggetto(dati.like)) throw new Error("Like: servono obiettivo e passo");
    if (dati.like.obiettivo !== undefined) g.like.obiettivo = numeroTra(dati.like.obiettivo, 1, MAX_NUMERO, "Obiettivo dei like");
    if (dati.like.passo !== undefined) g.like.passo = numeroTra(dati.like.passo, 0, MAX_PASSO, "Passo dei like");
  }
  if (dati.follower !== undefined) {
    const f = dati.follower;
    if (!oggetto(f)) throw new Error("Follower: servono obiettivo, passo, imposta o aggiungi");
    if (f.obiettivo !== undefined) g.follower.obiettivo = numeroTra(f.obiettivo, 1, MAX_NUMERO, "Obiettivo dei follower");
    if (f.passo !== undefined) g.follower.passo = numeroTra(f.passo, 0, MAX_PASSO, "Passo dei follower");
    if (f.imposta !== undefined) g.follower.totale = numeroTra(f.imposta, 0, MAX_NUMERO, "Follower di adesso");
    if (f.aggiungi !== undefined) {
      const aggiunta = numeroTra(f.aggiungi, -MAX_PASSO, MAX_PASSO, "Follower da aggiungere");
      if (g.follower.totale === null) throw new Error("Imposta prima i follower di adesso");
      g.follower.totale = Math.min(MAX_NUMERO, Math.max(0, g.follower.totale + aggiunta));
    }
  }
  if (dati.modo !== undefined) {
    if (!["fisso", "comparsa"].includes(dati.modo)) throw new Error("Modo del Goal: fisso o comparsa");
    g.modo = dati.modo;
  }
  if (dati.ogniMinuti !== undefined) g.ogniMinuti = numeroTra(dati.ogniMinuti, 1, 60, "Ogni quanti minuti compare");
  if (dati.durataSecondi !== undefined) g.durataSecondi = numeroTra(dati.durataSecondi, 5, 120, "Secondi in vista");
  if (dati.posizione !== undefined) {
    const p = dati.posizione;
    if (!oggetto(p)) throw new Error("Posizione: serve un oggetto con il layout e i valori da cambiare");
    if (!LAYOUT_GOAL.includes(p.layout)) throw new Error(`Layout del Goal sconosciuto: ${String(p.layout).slice(0, 20)} (${LAYOUT_GOAL.join(", ")})`);
    const nuova = {};
    if (p.x !== undefined) nuova.x = numeroTra(p.x, 0, LATO_TELA, "Posizione X");
    if (p.y !== undefined) nuova.y = numeroTra(p.y, 0, LATO_TELA, "Posizione Y");
    if (p.scala !== undefined) nuova.scala = numeroTra(p.scala, 60, 200, "Scala del Goal");
    if (p.ripristina === true) delete g.posizioni[p.layout];
    else if (Object.keys(nuova).length) g.posizioni[p.layout] = { ...g.posizioni[p.layout], ...nuova };
  }
  stato.goal = g;
}

// Stato salvato prima del Goal (o con valori rotti): impostazioni complete, un campo alla volta: quello rotto torna di partenza e
// non butta via gli altri. Dà un oggetto nuovo.
export function fondiGoal(salvato) {
  const prova = { goal: goalIniziale() };
  if (!oggetto(salvato)) return prova.goal;
  const tenta = (modifica) => {
    try {
      impostaGoal(prova, modifica);
    } catch {
      // valore non valido: resta quello di partenza
    }
  };
  for (const gruppo of ["like", "follower"]) {
    if (!oggetto(salvato[gruppo])) continue;
    for (const campo of ["obiettivo", "passo"]) if (salvato[gruppo][campo] !== undefined) tenta({ [gruppo]: { [campo]: salvato[gruppo][campo] } });
  }
  if (oggetto(salvato.follower) && salvato.follower.totale !== undefined && salvato.follower.totale !== null) tenta({ follower: { imposta: salvato.follower.totale } });
  for (const campo of ["modo", "ogniMinuti", "durataSecondi"]) if (salvato[campo] !== undefined) tenta({ [campo]: salvato[campo] });
  if (oggetto(salvato.posizioni)) {
    for (const layout of LAYOUT_GOAL) {
      const p = salvato.posizioni[layout];
      if (!oggetto(p)) continue;
      for (const campo of ["x", "y", "scala"]) if (p[campo] !== undefined) tenta({ posizione: { layout, [campo]: p[campo] } });
    }
  }
  return prova.goal;
}

// Quello che ricevono pagine e regia: il Goal con in più i like contati dal Drum (totale di TikTok meno la partenza, più le
// correzioni a mano). Una copia: lo stato non cambia.
export function istantaneaGoal(stato) {
  const goal = structuredClone(stato.goal);
  goal.like.totale = contati(stato.drum);
  return goal;
}
