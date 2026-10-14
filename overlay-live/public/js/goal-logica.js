// Goal Like e Follower: le parti pure (niente DOM) che usano la pagina e i test. Il calcolo dei «mancano» è lo stesso di lib/goal.mjs
// (le pagine non importano da lib/): test/goal-logica.test.mjs li confronta.

export const LARGHEZZA_GOAL = 400;
export const ALTEZZA_GOAL = 120;

// Un layout per pagina; per Podcast e Reaction anche l'orizzontale (la chiave finisce con «O»).
export const POSIZIONI_GOAL = {
  gara: { x: 564, y: 712, scala: 100 },
  senzaPremio: { x: 116, y: 650, scala: 100 },
  studio: { x: 116, y: 290, scala: 100 },
  battle: { x: 116, y: 672, scala: 100 },
  drum: { x: 116, y: 892, scala: 100 },
  produzione: { x: 116, y: 1076, scala: 100 },
  reaction: { x: 116, y: 1076, scala: 100 },
  podcast: { x: 116, y: 960, scala: 100 },
  podcastO: { x: 1400, y: 36, scala: 100 },
  reactionO: { x: 1584, y: 40, scala: 75 },
};

export const chiaveGoal = (layout, orizzontale) => (orizzontale && (layout === "podcast" || layout === "reaction") ? `${layout}O` : layout);

const migliaia = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function obiettivoAttuale(totale, obiettivo, passo) {
  const t = Number.isFinite(totale) && totale > 0 ? totale : 0;
  if (t < obiettivo || !(passo > 0)) return obiettivo;
  return t - (t % passo) + passo;
}

function mancano(totale, obiettivo, passo) {
  if (typeof totale !== "number" || !Number.isFinite(totale) || totale < 0) return null;
  const distanza = obiettivoAttuale(totale, obiettivo, passo) - totale;
  return passo > 0 ? Math.max(1, distanza) : Math.max(0, distanza);
}

// Le parti di una riga: «Mancano» + «1.250» + «like» + «al nuovo obiettivo» (null con il totale sconosciuto).
function parti(gruppo, unita) {
  const n = mancano(gruppo?.totale, gruppo?.obiettivo, gruppo?.passo);
  if (n === null) return null;
  // Con passo 0 e l'obiettivo raggiunto non c'è un «prossimo»: la riga lo dice invece di «Mancano 0».
  if (n === 0) return { prefisso: "", numero: "", unita: "Obiettivo", suffisso: "raggiunto!", raggiunto: true };
  return { prefisso: n === 1 ? "Manca" : "Mancano", numero: migliaia(n), unita, suffisso: "al nuovo obiettivo" };
}
export const partiGoal = (goal) => ({ like: parti(goal?.like, "like"), follower: parti(goal?.follower, "follower") });

const frase = (p) => (p ? (p.raggiunto ? "Obiettivo raggiunto!" : `${p.prefisso} ${p.numero} ${p.unita} ${p.suffisso}`) : null);
export function testiGoal(goal) {
  const p = partiGoal(goal);
  return { like: frase(p.like), follower: frase(p.follower) };
}

// Dove sta il widget: la posizione salvata dalla regia (campo per campo) sopra quella di partenza, con la tela come limite.
// Dà { x, y, scala } con la scala come moltiplicatore (1 = 100%).
export function posizioneGoal(goal, chiave) {
  const base = POSIZIONI_GOAL[chiave] ?? POSIZIONI_GOAL.gara;
  const salvata = goal?.posizioni?.[chiave] ?? {};
  const scegli = (campo) => (Number.isFinite(salvata[campo]) ? salvata[campo] : base[campo]);
  const scala = Math.min(200, Math.max(60, scegli("scala"))) / 100;
  const [W, H] = chiave.endsWith("O") ? [1920, 1080] : [1080, 1920];
  const x = Math.min(Math.max(0, scegli("x")), W - LARGHEZZA_GOAL * scala);
  const y = Math.min(Math.max(0, scegli("y")), H - ALTEZZA_GOAL * scala);
  return { x, y, scala };
}

// Con il modo «comparsa» il Goal si vede `durataSecondi` dall'inizio dell'ultima comparsa (o da «Mostra ora» della regia); la
// pagina fa partire una comparsa nuova ogni `ogniMinuti` (daFarComparire). Con «fisso» si vede finché è acceso.
export function goalVisibile({ modo, durataSecondi }, acceso, ora, ultimaComparsaAlle, mostraOraAlle) {
  if (!acceso) return false;
  if (modo !== "comparsa") return true;
  const inizio = Math.max(ultimaComparsaAlle ?? -Infinity, mostraOraAlle ?? -Infinity);
  return ora - inizio < durataSecondi * 1000;
}

export function daFarComparire({ modo, ogniMinuti }, ora, ultimaComparsaAlle) {
  if (modo !== "comparsa") return false;
  return ultimaComparsaAlle === null || ora - ultimaComparsaAlle >= ogniMinuti * 60_000;
}
