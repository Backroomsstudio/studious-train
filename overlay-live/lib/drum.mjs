// Regole del Drum Challenge Live: Like di TikTok, scaletta degli sblocchi, progresso e annunci.
// Solo funzioni pure: i modificatori lavorano su `stato.drum`, le funzioni di lettura prendono il `drum`.
import { numeroTra, oggetto, siNo } from "./validazione.mjs";
import { testiBase } from "./testi.mjs";

// Le prime 16 tappe le ha scelte la regia, le altre 21 (fino a 500k) sono la scaletta di partenza, modificabile.
export const PASSI_FISSI = [1000, 2000, 3000, 5000, 7000, 9000, 10000, 12000, 15000, 17000, 20000, 22000, 25000, 27000, 29000, 30000];
export const PASSI_ALTI = [32000, 35000, 37000, 40000, 45000, 50000, 60000, 70000, 80000, 90000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 350000, 400000, 450000, 500000];
export const MAX_TAPPE = 80;
const LIKE_MAX = 1_000_000;
const TITOLO_MAX = 60;

export const scalettaPredefinita = () => [...PASSI_FISSI, ...PASSI_ALTI].map((like) => ({ like, titolo: "" }));

// Una tappa: `dove` è «Riga N: » (testo della regia) o «Scaletta: » (elenco già fatto, senza numero di riga).
function controllaTappa(like, titolo, precedente, dove) {
  if (!Number.isInteger(like) || like < 1 || like > LIKE_MAX) throw new Error(`${dove}i like vanno da 1 a 1.000.000`);
  if (like <= precedente) throw new Error(`${dove}i like devono crescere (${like} dopo ${precedente})`);
  if (titolo.length > TITOLO_MAX) throw new Error(`${dove}titolo troppo lungo (massimo ${TITOLO_MAX} caratteri)`);
  return { like, titolo };
}

// Elenco di { like, titolo } (stato salvato): ridà una copia pulita o lancia.
export function controllaScaletta(tappe) {
  if (!Array.isArray(tappe)) throw new Error("Scaletta: serve l'elenco delle tappe");
  if (!tappe.length) throw new Error("Scaletta: serve almeno una tappa");
  if (tappe.length > MAX_TAPPE) throw new Error(`Scaletta: al massimo ${MAX_TAPPE} tappe`);
  let precedente = 0;
  return Array.from(tappe, (t) => {
    if (!oggetto(t) || typeof t.titolo !== "string") throw new Error("Scaletta: ogni tappa ha like e titolo");
    const tappa = controllaTappa(t.like, t.titolo.trim(), precedente, "Scaletta: ");
    precedente = tappa.like;
    return tappa;
  });
}

// «1000», «1.000» (punti da migliaia) o «5k»: solo interi. Qualsiasi altra forma ridà null.
function leggiLike(grezzo) {
  const chilo = /^(\d+)[kK]$/.exec(grezzo);
  if (chilo) return Number(chilo[1]) * 1000;
  if (/^\d+$/.test(grezzo) || /^\d{1,3}(\.\d{3})+$/.test(grezzo)) return Number(grezzo.replaceAll(".", ""));
  return null;
}

// Il campo della regia: una tappa per riga, «like | titolo» (si divide alla prima barra, il titolo può contenerne altre).
export function leggiScaletta(testoGrezzo) {
  if (typeof testoGrezzo !== "string") throw new Error("Scaletta: serve un testo");
  const tappe = [];
  testoGrezzo.split(/\r\n|\r|\n/).forEach((riga, i) => {
    if (!riga.trim()) return;
    const dove = `Riga ${i + 1}: `;
    const barra = riga.indexOf("|");
    const numero = (barra === -1 ? riga : riga.slice(0, barra)).trim();
    const titolo = barra === -1 ? "" : riga.slice(barra + 1).trim();
    const like = leggiLike(numero);
    if (like === null) {
      const mostrato = numero.length > 24 ? `${numero.slice(0, 24)}…` : numero;
      throw new Error(`${dove}«${mostrato}» non è un numero di like (es. 15000, 15.000 o 15k)`);
    }
    if (tappe.length === MAX_TAPPE) throw new Error(`Scaletta: al massimo ${MAX_TAPPE} tappe`);
    tappe.push(controllaTappa(like, titolo, tappe.at(-1)?.like ?? 0, dove));
  });
  if (!tappe.length) throw new Error("Scaletta: serve almeno una tappa");
  return tappe;
}

export const drumIniziale = () => ({
  like: { tiktokTotale: null, offset: 0, extra: 0 },
  annunciati: 0,
  scaletta: scalettaPredefinita(),
  brano: { titolo: "", artista: "" },
  ospite: { etichetta: "Artista ospite", handle: "", icona: "instagram" },
  priorita: { prefisso: "Dona un", slot: "Rosa", sopra: "Salta la coda · scegli tu il brano", icona: "rosa" },
  eq: { sensibilita: 100, stile: "barre", senzaSegnale: true },
  riempimento: "perline",
  velocita: 80,
  testi: testiBase("drum"),
});

// I Like che contano per la scaletta: il totale di TikTok meno quello di partenza, più le correzioni a mano.
export const contati = (drum) => Math.max(0, (drum.like.tiktokTotale ?? 0) - drum.like.offset + drum.like.extra);

export function tappeRaggiunte(drum) {
  const c = contati(drum);
  return drum.scaletta.filter((t) => t.like <= c).length;
}

export function indiceAttiva(drum) {
  const raggiunte = tappeRaggiunte(drum);
  return raggiunte < drum.scaletta.length ? raggiunte : null;
}

// Quanto manca all'attiva, da 0 a 1 (parte dai like della tappa prima, 0 per la prima); 1 se sono tutte raggiunte.
export function progresso(drum) {
  const i = indiceAttiva(drum);
  if (i === null) return 1;
  const base = i === 0 ? 0 : drum.scaletta[i - 1].like;
  return Math.min(1, Math.max(0, (contati(drum) - base) / (drum.scaletta[i].like - base)));
}

const interoNonNegativo = (x) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && Number.isSafeInteger(Math.floor(x)) ? Math.floor(x) : null);

// Un evento `like` di TikTok: il totale della live non scende mai; senza totale si somma il conteggio a quello già noto.
export function registraLike(stato, dati) {
  if (!oggetto(dati)) return;
  const like = stato.drum.like;
  const totale = interoNonNegativo(dati.totale);
  if (totale !== null) {
    if (like.tiktokTotale === null) {
      if (totale < like.offset) like.offset = 0; // prima lettura sotto l'offset: è una live nuova
      like.tiktokTotale = totale;
    } else like.tiktokTotale = Math.max(like.tiktokTotale, totale);
    return;
  }
  const conteggio = interoNonNegativo(dati.conteggio);
  if (conteggio && like.tiktokTotale !== null) like.tiktokTotale += conteggio;
}

// A ogni (ri)collegamento a TikTok il totale noto si azzera: si rilegge dal primo evento.
export function nuovaConnessioneLike(stato) {
  stato.drum.like.tiktokTotale = null;
}

// Correzioni dalla regia, nell'ordine daOra → imposta → aggiungi. `aggiungi` parte dal valore mostrato (mai sotto zero),
// così una correzione al ribasso oltre lo zero non lascia un debito nascosto. Un errore non cambia nulla.
export function impostaLike(stato, dati) {
  if (!oggetto(dati)) throw new Error("Like: forma non valida");
  const daOra = dati.daOra === undefined ? false : siNo(dati.daOra, "Like (da ora)");
  const imposta = dati.imposta === undefined ? null : numeroTra(dati.imposta, 0, 10_000_000, "Like (imposta)");
  const aggiungi = dati.aggiungi === undefined ? null : numeroTra(dati.aggiungi, -1_000_000, 1_000_000, "Like (aggiungi)");
  if (!daOra && imposta === null && aggiungi === null) throw new Error("Like: serve imposta, aggiungi o daOra");
  const drum = stato.drum;
  const rendiContati = (n) => {
    drum.like.extra = n - (drum.like.tiktokTotale ?? 0) + drum.like.offset;
  };
  if (daOra) {
    drum.like.offset = drum.like.tiktokTotale ?? 0;
    drum.like.extra = 0;
    drum.annunciati = 0;
  }
  if (imposta !== null) rendiContati(imposta);
  if (aggiungi !== null) rendiContati(Math.max(0, contati(drum) + aggiungi));
}

// Dalla regia: il testo del campo oppure `predefinita: true` (scaletta di partenza, tenendo i titoli delle tappe con lo
// stesso numero di like). Le tappe già raggiunte restano annunciate: nessun sblocco per un cambio di scaletta.
export function impostaScaletta(stato, modifiche) {
  if (!oggetto(modifiche)) throw new Error("Scaletta: forma non valida");
  const { testo: grezzo, predefinita } = modifiche;
  const ripristina = predefinita === true;
  if ((grezzo !== undefined) === ripristina) throw new Error("Scaletta: serve il testo o predefinita (uno solo)");
  const drum = stato.drum;
  let scaletta;
  if (ripristina) {
    const titoli = new Map(drum.scaletta.map((t) => [t.like, t.titolo]));
    scaletta = scalettaPredefinita().map((t) => ({ like: t.like, titolo: titoli.get(t.like) ?? "" }));
  } else scaletta = leggiScaletta(grezzo);
  drum.scaletta = scaletta;
  drum.annunciati = tappeRaggiunte(drum);
}

// Da chiamare dopo ogni cambio dei Like: un solo evento per la tappa più alta appena raggiunta (anche se i Like hanno
// saltato più tappe); se le tappe raggiunte scendono (correzione al ribasso) ci si riallinea senza eventi.
export function controllaSblocchi(stato) {
  const drum = stato.drum;
  const raggiunte = tappeRaggiunte(drum);
  const prima = drum.annunciati;
  if (raggiunte === prima) return [];
  drum.annunciati = raggiunte;
  if (raggiunte < prima) return [];
  const indice = raggiunte - 1;
  const { like, titolo } = drum.scaletta[indice];
  return [{ nome: "sbloccoDrum", dati: { indice, like, titolo } }];
}
