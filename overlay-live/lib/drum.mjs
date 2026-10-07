// Regole del Drum Challenge Live: Like di TikTok, scaletta degli sblocchi, progresso e annunci.
// Solo funzioni pure: i modificatori lavorano su `stato.drum`, le funzioni di lettura prendono il `drum`.
import { ICONE, numeroTra, oggetto, siNo, testo, velocitaFascia } from "./validazione.mjs";
import { controllaTesti, testiBase } from "./testi.mjs";

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

// ---------- Impostazioni dalla regia ----------
// Si controlla tutto su una copia e si assegna alla fine: un errore non lascia metà modifica (come impostaStudio).

export const ICONE_REGALO = ["rosa", "corona", "cuore", "regalo", "stella", "diamante", "logo"];
const STILI_EQ = ["barre", "onda"];
const RIEMPIMENTI = ["perline", "sabbia"];

const campi = (dati, nome) => {
  if (!oggetto(dati)) throw new Error(`${nome}: forma non valida`);
  return dati;
};

// Brano in esecuzione: scritto a mano oppure preso da una tappa già sbloccata (l'artista allora resta vuoto).
export function impostaBrano(stato, dati) {
  const { titolo, artista, daIndice, svuota } = campi(dati, "Brano");
  const drum = stato.drum;
  const brano = { ...drum.brano };
  if (svuota !== undefined && siNo(svuota, "Brano (svuota)")) {
    brano.titolo = "";
    brano.artista = "";
  }
  if (daIndice !== undefined) {
    if (!Number.isInteger(daIndice)) throw new Error("Brano: indice non valido");
    if (daIndice < 0 || daIndice >= tappeRaggiunte(drum)) throw new Error("Quel brano non è ancora sbloccato");
    if (!drum.scaletta[daIndice].titolo) throw new Error("Quel brano non ha un titolo: scrivilo nella scaletta");
    brano.titolo = drum.scaletta[daIndice].titolo;
    brano.artista = "";
  }
  if (titolo !== undefined) brano.titolo = testo(titolo, TITOLO_MAX, "Titolo del brano");
  if (artista !== undefined) brano.artista = testo(artista, 40, "Artista del brano");
  drum.brano = brano;
}

// Lo slot dell'artista ospite sulla fascia social (nome e contatto, con l'icona della piattaforma).
export function impostaOspite(stato, dati) {
  const { etichetta, handle, icona } = campi(dati, "Ospite");
  const ospite = { ...stato.drum.ospite };
  if (etichetta !== undefined) ospite.etichetta = testo(etichetta, 24, "Etichetta dell'ospite");
  if (handle !== undefined) ospite.handle = testo(handle, 40, "Contatto dell'ospite");
  if (icona !== undefined) {
    if (!ICONE.includes(icona)) throw new Error("Icona sconosciuta");
    ospite.icona = icona;
  }
  stato.drum.ospite = ospite;
}

// Il widget «Dona un…»: prefisso e riga sopra possono mancare, il regalo (slot) no.
export function impostaPriorita(stato, dati) {
  const { prefisso, slot, sopra, icona } = campi(dati, "Dona un…");
  const priorita = { ...stato.drum.priorita };
  if (prefisso !== undefined) priorita.prefisso = testo(prefisso, 16, "Prefisso di «Dona un…»");
  if (slot !== undefined) priorita.slot = testo(slot, 20, "Regalo di «Dona un…»", { obbligatorio: true });
  if (sopra !== undefined) priorita.sopra = testo(sopra, 40, "Riga sopra di «Dona un…»");
  if (icona !== undefined) {
    if (!ICONE_REGALO.includes(icona)) throw new Error("Icona sconosciuta");
    priorita.icona = icona;
  }
  stato.drum.priorita = priorita;
}

// Equalizzatore: quanto reagisce (50–300 %), barre o onda, e il «respiro» quando non arriva audio.
export function impostaEq(stato, dati) {
  const { sensibilita, stile, senzaSegnale } = campi(dati, "Equalizzatore");
  const eq = { ...stato.drum.eq };
  if (sensibilita !== undefined) eq.sensibilita = numeroTra(sensibilita, 50, 300, "Sensibilità dell'equalizzatore (%)");
  if (stile !== undefined) {
    if (!STILI_EQ.includes(stile)) throw new Error("Stile non valido: barre o onda");
    eq.stile = stile;
  }
  if (senzaSegnale !== undefined) eq.senzaSegnale = siNo(senzaSegnale, "Respiro senza segnale");
  stato.drum.eq = eq;
}

export function impostaRiempimento(stato, stile) {
  if (!RIEMPIMENTI.includes(stile)) throw new Error("Riempimento non valido: perline o sabbia");
  stato.drum.riempimento = stile;
}

export function impostaVelocita(stato, n) {
  stato.drum.velocita = velocitaFascia(n);
}

// ---------- Stato salvato, nuova serata, istantanea e prova ----------

// Like salvati: il totale è null o un intero, `offset` non è negativo, `extra` è un intero. Altrimenti vale la partenza.
function fondiLike(l) {
  if (!oggetto(l)) return null;
  const { tiktokTotale, offset, extra } = l;
  const totaleBuono = tiktokTotale === null || (Number.isSafeInteger(tiktokTotale) && tiktokTotale >= 0);
  if (!totaleBuono || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(extra)) return null;
  return { tiktokTotale, offset, extra };
}

// Un gruppo di campi si controlla con lo stesso modificatore della regia, su una copia della partenza: se qualcosa non
// va, il gruppo resta quello di partenza.
function fondiGruppo(drum, chiave, imposta, salvato) {
  try {
    const prova = { drum: { ...drum, [chiave]: { ...drum[chiave] } } };
    imposta(prova, salvato);
    drum[chiave] = prova.drum[chiave];
  } catch {
    // valore non valido: resta il predefinito
  }
}

// Stato salvato da una versione senza Drum, o con valori rotti: partenza completa, i valori buoni restano gruppo per
// gruppo. Gli annunci non superano le tappe raggiunte (nessuno sblocco ripetuto dopo un riavvio). Mai eccezioni.
export function fondiDrum(salvato) {
  const drum = drumIniziale();
  if (!oggetto(salvato)) return drum;
  drum.like = fondiLike(salvato.like) ?? drum.like;
  try {
    drum.scaletta = controllaScaletta(salvato.scaletta);
  } catch {
    // scaletta non valida: resta quella di partenza
  }
  if (oggetto(salvato.brano)) fondiGruppo(drum, "brano", impostaBrano, { titolo: salvato.brano.titolo, artista: salvato.brano.artista });
  fondiGruppo(drum, "ospite", impostaOspite, salvato.ospite);
  fondiGruppo(drum, "priorita", impostaPriorita, salvato.priorita);
  fondiGruppo(drum, "eq", impostaEq, salvato.eq);
  if (RIEMPIMENTI.includes(salvato.riempimento)) drum.riempimento = salvato.riempimento;
  try {
    drum.velocita = velocitaFascia(salvato.velocita);
  } catch {
    // velocità non valida: resta quella di partenza
  }
  try {
    drum.testi = controllaTesti("drum", salvato.testi);
  } catch {
    // dimensioni non valide: tutte al 100%
  }
  const raggiunte = tappeRaggiunte(drum);
  const annunciati = salvato.annunciati;
  drum.annunciati = Number.isInteger(annunciati) && annunciati >= 0 && annunciati <= raggiunte ? annunciati : raggiunte;
  return drum;
}

// Nuova serata: i Like ripartono da zero (il totale della live di prima diventa l'offset), annunci e brano si azzerano;
// scaletta con i titoli, ospite, «Dona un…», equalizzatore, riempimento, velocità e dimensione dei testi restano.
export function drumNuovaSerata(drum) {
  return {
    ...structuredClone(drum),
    like: { tiktokTotale: drum.like.tiktokTotale, offset: drum.like.tiktokTotale ?? 0, extra: 0 },
    annunciati: 0,
    brano: { titolo: "", artista: "" },
  };
}

// Quello che ricevono pagine e regia: il Drum con in più i Like contati, la tappa attiva e il suo progresso.
export function istantaneaDrum(drum) {
  return { ...structuredClone(drum), contati: contati(drum), attiva: indiceAttiva(drum), progresso: progresso(drum) };
}

const TITOLI_DEMO = [
  "Back in Black",
  "Seven Nation Army",
  "Smells Like Teen Spirit",
  "Billie Jean",
  "Sweet Child O' Mine",
  "Enter Sandman",
  "Another One Bites the Dust",
  "Livin' on a Prayer",
  "Thunderstruck",
  "Hysteria",
  "Paradise City",
  "Master of Puppets",
];
const LIKE_DEMO = { vuoto: 0, meta: 11400, sblocco: 12000, finale: 500000 };

// Dati di prova per mockup e prove a mano: titoli per le prime 12 tappe, l'ospite e i Like della fase scelta.
// Gli annunci seguono le tappe raggiunte: nessuno sblocco parte da solo.
export function drumDemo(stato, fase) {
  if (!Object.hasOwn(LIKE_DEMO, fase)) throw new Error("Fase non valida: vuoto, meta, sblocco o finale");
  const drum = stato.drum;
  TITOLI_DEMO.forEach((titolo, i) => {
    if (drum.scaletta[i]) drum.scaletta[i].titolo = titolo;
  });
  drum.ospite = { ...drum.ospite, handle: "@lince.music", icona: "instagram" };
  drum.like = { tiktokTotale: LIKE_DEMO[fase], offset: 0, extra: 0 };
  drum.annunciati = tappeRaggiunte(drum);
  drum.brano = { titolo: fase === "vuoto" ? "" : "Seven Nation Army", artista: "" };
}
