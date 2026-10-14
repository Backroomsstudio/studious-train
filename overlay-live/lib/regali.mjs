// Regali di TikTok: il confronto con il regalo scelto in regia, l'elenco dei «regali visti» e la coda delle richieste (Reaction
// Release e Drum Challenge usano lo stesso modulo, ognuno con il suo regalo). Funzioni pure sullo stato di un formato, che tiene
// `richieste = { regalo, coda }`: `regalo` è il nome (o l'ID, se fatto di sole cifre) del regalo che fa partire una richiesta e
// `coda` le richieste, dalla più vecchia. I regali arrivano da regaloTikTok (lib/chat.mjs): { utente, nome, id, quantita }.
import { randomUUID } from "node:crypto";
import { oggetto, testo } from "./validazione.mjs";

export const MAX_RICHIESTE = 30;
export const MAX_VISTI = 12;
export const MAX_REGALO = 40; // il nome o l'ID scelto in regia
const MAX_UTENTE = 40;
const MAX_NOME = 60;
const MAX_TITOLO = 60;
const MAX_ARTISTA = 40;
const STATI = ["attesa", "inOnda", "fatta"];

const testoDi = (x) => (typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "");

// Il regalo ricevuto è quello scelto? Una mappatura vuota non corrisponde a niente; fatta di sole cifre è un ID e si confronta con
// l'ID del regalo; altrimenti si confronta il nome, senza maiuscole.
export function regaloCorrisponde(regalo, mappatura) {
  const voluto = testoDi(mappatura);
  if (!voluto || !oggetto(regalo)) return false;
  if (/^\d+$/.test(voluto)) return typeof regalo.id === "number" && regalo.id === Number(voluto);
  return typeof regalo.nome === "string" && regalo.nome.trim().toLowerCase() === voluto.toLowerCase();
}

// «Regali visti»: gli ultimi 12 regali diversi (per nome e ID) arrivati in live, il più recente in cima, con l'ultimo utente: la
// regia li legge per scegliere il regalo senza indovinare come si chiama. Dà un elenco nuovo: quello ricevuto non si tocca.
export function registraVisto(visti, regalo, ora) {
  const elenco = Array.isArray(visti) ? visti : [];
  if (!oggetto(regalo) || (!regalo.nome && !regalo.id)) return [...elenco];
  const chiave = (v) => `${v?.id ?? ""}|${String(v?.nome ?? "").toLowerCase()}`;
  const nuovo = { nome: regalo.nome ?? "", id: regalo.id ?? null, utente: regalo.utente ?? "", alle: ora };
  return [nuovo, ...elenco.filter((v) => chiave(v) !== chiave(nuovo))].slice(0, MAX_VISTI);
}

// Elenco dei «regali visti» letto da uno stato salvato: solo voci con un nome o un ID, al massimo 12. Dà un elenco nuovo.
export function controllaVisti(salvato) {
  if (!Array.isArray(salvato)) return [];
  const visti = [];
  for (const v of salvato) {
    if (!oggetto(v)) continue;
    const nome = typeof v.nome === "string" ? v.nome.trim().slice(0, MAX_NOME) : "";
    const id = Number.isSafeInteger(v.id) && v.id > 0 ? v.id : null;
    if (!nome && id === null) continue;
    visti.push({ nome, id, utente: typeof v.utente === "string" ? v.utente.trim().slice(0, MAX_UTENTE) : "", alle: Number.isFinite(v.alle) ? v.alle : 0 });
  }
  return visti.slice(0, MAX_VISTI);
}

export const richiesteIniziali = () => ({ regalo: "", coda: [] });

// Il regalo che fa partire le richieste: un nome o un ID (fino a 40 caratteri), oppure vuoto (nessuna richiesta).
export function impostaMappatura(richieste, valore) {
  richieste.regalo = testo(valore, MAX_REGALO, "Regalo che fa partire le richieste");
}

// Un regalo che corrisponde aggiunge una richiesta in coda (ogni regalo è una richiesta, anche dello stesso donatore, con la sua
// quantità). Oltre 30 escono le più vecchie, ma non quella in onda. Dà la richiesta, oppure null se il regalo non corrisponde.
export function aggiungiRichiesta(richieste, regalo, ora) {
  if (!regaloCorrisponde(regalo, richieste.regalo)) return null;
  const richiesta = {
    id: randomUUID(),
    utente: testoDi(regalo.utente).slice(0, MAX_UTENTE),
    nome: testoDi(regalo.nome).slice(0, MAX_NOME),
    quantita: Number.isInteger(regalo.quantita) && regalo.quantita >= 1 ? regalo.quantita : 1,
    alle: ora,
    stato: "attesa",
    brano: null,
  };
  richieste.coda.push(richiesta);
  while (richieste.coda.length > MAX_RICHIESTE) {
    const piuVecchia = richieste.coda.findIndex((r) => r.stato !== "inOnda");
    richieste.coda.splice(piuVecchia, 1);
  }
  return richiesta;
}

// Azioni della regia su una richiesta: "inOnda" (una sola alla volta: quella di prima torna in attesa; serve il brano scelto,
// almeno con il titolo), "fatta" (resta in elenco come fatta) e "scarta" (la toglie). Tutto si controlla prima: un errore non
// cambia niente. Dà la richiesta toccata.
export function segnaRichiesta(richieste, { id, azione, brano } = {}) {
  const richiesta = richieste.coda.find((r) => r.id === id);
  if (!richiesta) throw new Error("Richiesta non più in coda");
  if (!["inOnda", "fatta", "scarta"].includes(azione)) throw new Error("Azione sulla richiesta non valida: inOnda, fatta o scarta");
  if (azione === "scarta") {
    richieste.coda = richieste.coda.filter((r) => r !== richiesta);
  } else if (azione === "fatta") {
    richiesta.stato = "fatta";
  } else {
    if (!oggetto(brano)) throw new Error("Brano: scrivi almeno il titolo");
    const scelto = { titolo: testo(brano.titolo ?? "", MAX_TITOLO, "Titolo del brano", { obbligatorio: true }), artista: testo(brano.artista ?? "", MAX_ARTISTA, "Artista del brano") };
    for (const altra of richieste.coda) if (altra.stato === "inOnda") altra.stato = "attesa";
    Object.assign(richiesta, { stato: "inOnda", brano: scelto });
  }
  return richiesta;
}

// Una richiesta letta da uno stato salvato: ogni campo rotto torna di partenza; senza un id valido la voce non c'è.
function controllaRichiesta(r) {
  if (!oggetto(r) || typeof r.id !== "string" || !r.id.trim()) return null;
  const brano = oggetto(r.brano) && typeof r.brano.titolo === "string" && r.brano.titolo.trim() && r.brano.titolo.trim().length <= MAX_TITOLO
    ? { titolo: r.brano.titolo.trim(), artista: typeof r.brano.artista === "string" && r.brano.artista.trim().length <= MAX_ARTISTA ? r.brano.artista.trim() : "" }
    : null;
  const stato = STATI.includes(r.stato) ? r.stato : "attesa";
  return {
    id: r.id.trim().slice(0, 80),
    utente: typeof r.utente === "string" ? r.utente.trim().slice(0, MAX_UTENTE) : "",
    nome: typeof r.nome === "string" ? r.nome.trim().slice(0, MAX_NOME) : "",
    quantita: Number.isFinite(r.quantita) && r.quantita >= 1 ? Math.floor(r.quantita) : 1,
    alle: Number.isFinite(r.alle) ? r.alle : 0,
    stato: stato === "inOnda" && !brano ? "attesa" : stato, // in onda ha senso solo con un brano
    brano,
  };
}

// Stato salvato prima delle richieste (o con valori rotti): richieste complete e senza eccezioni; quello che è valido resta.
// Al massimo 30 richieste (le più recenti) e una sola in onda (l'ultima). Dà un oggetto nuovo.
export function controllaRichieste(salvato) {
  const richieste = richiesteIniziali();
  if (!oggetto(salvato)) return richieste;
  // come impostaMappatura: solo un testo, fino a 40 caratteri
  const regalo = typeof salvato.regalo === "string" ? salvato.regalo.trim() : "";
  if (regalo.length <= MAX_REGALO) richieste.regalo = regalo;
  if (!Array.isArray(salvato.coda)) return richieste;
  const visti = new Set();
  for (const r of salvato.coda) {
    const voce = controllaRichiesta(r);
    if (!voce || visti.has(voce.id)) continue;
    visti.add(voce.id);
    richieste.coda.push(voce);
  }
  richieste.coda.splice(0, Math.max(0, richieste.coda.length - MAX_RICHIESTE));
  const inOnda = richieste.coda.map((r) => r.stato).lastIndexOf("inOnda");
  richieste.coda.forEach((r, i) => {
    if (r.stato === "inOnda" && i !== inOnda) r.stato = "attesa";
  });
  return richieste;
}
