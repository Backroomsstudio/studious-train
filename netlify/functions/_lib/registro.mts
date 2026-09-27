// Registro contabile (file Contabilità): si scrivono solo A-G e K, mai H, I, J né i totali.
import type { DateTime } from "luxon";
import { env, numero, type Config } from "./config.mts";
import { iso, nomeRegistro, seriale } from "./date.mts";
import { intervallo, leggi, scrivi, vuota, type Celle } from "./sheets.mts";
import { proporziona, testo } from "./match.mts";

export const PRIMA_RIGA = 5;
export const ULTIMA_RIGA = 164;

export type RigaRegistro = {
  data: DateTime;
  cliente: string;
  servizio: string;
  importo: number; // centesimi
  stato: "PAGATO" | "DA PAGARE";
  incassatoDa: string;
  metodo: string;
  note: string;
};

export type EsitoRegistro = { foglio: string; righe: number[]; giaPresenti?: boolean } | { foglio: string; motivo: string };

const contabilita = () => env("SHEET_CONTABILITA_ID");

export async function leggiListino(): Promise<{ nome: string; prezzo: number | null }[]> {
  const [celle] = await leggi(contabilita(), ["'Listino Servizi'!A5:B20"]);
  return listinoDa(celle);
}

export const listinoDa = (celle: Celle) =>
  celle
    .filter((r) => !vuota(r[0]))
    .map((r) => ({ nome: String(r[0]).trim(), prezzo: typeof r[1] === "number" ? r[1] : null }));

// Righe 5-164 del mese (A-K); null se il foglio del mese non esiste.
export async function leggiMese(foglio: string): Promise<Celle | null> {
  try {
    const [celle] = await leggi(contabilita(), [intervallo(foglio, `A${PRIMA_RIGA}:K${ULTIMA_RIGA}`)]);
    return celle;
  } catch (e) {
    if ((e as { stato?: number }).stato === 400) return null;
    throw e;
  }
}

const libera = (r: unknown[] | undefined) => !r || r.slice(0, 7).every(vuota);

// Scrive le righe nelle prime righe libere del mese, poi rilegge e verifica.
// Se una riga del mese ha già `tag` in K, non scrive niente (così un nuovo tentativo di Stripe non duplica).
export async function scriviRegistro(righe: RigaRegistro[], tag: string, esistenti?: Celle | null): Promise<EsitoRegistro> {
  const foglio = nomeRegistro(righe[0].data);
  let celle = esistenti === undefined ? await leggiMese(foglio) : esistenti;
  if (celle === null) return { foglio, motivo: `il foglio "${foglio}" non esiste` };

  const gia = righeConTag(celle, tag);
  if (gia.length) return { foglio, righe: gia, giaPresenti: true };

  const scritte: number[] = new Array(righe.length);
  let daFare = righe.map((_, i) => i);
  for (let tentativo = 0; tentativo < 3 && daFare.length; tentativo++) {
    const libere: number[] = [];
    for (let n = PRIMA_RIGA; n <= ULTIMA_RIGA && libere.length < daFare.length; n++) {
      if (libera(celle[n - PRIMA_RIGA]) && !scritte.includes(n)) libere.push(n);
    }
    if (libere.length < daFare.length) return { foglio, motivo: "nessuna riga libera tra 5 e 164" };

    await scrivi(
      contabilita(),
      daFare.flatMap((i, k) => {
        const r = righe[i];
        const n = libere[k];
        return [
          {
            range: intervallo(foglio, `A${n}:G${n}`),
            values: [[iso(r.data), testo(r.cliente), r.servizio, r.importo / 100, r.stato, r.incassatoDa, r.metodo]],
          },
          { range: intervallo(foglio, `K${n}`), values: [[testo(r.note)]] },
        ];
      }),
    );

    // Rilettura: in K deve esserci il nostro testo e in A una data vera (numero), non un testo.
    celle = (await leggiMese(foglio)) ?? [];
    const correzioni: { range: string; values: Celle }[] = [];
    const rimaste: number[] = [];
    daFare.forEach((i, k) => {
      const n = libere[k];
      const riga = celle![n - PRIMA_RIGA] ?? [];
      if (String(riga[10] ?? "") !== righe[i].note) return rimaste.push(i);
      scritte[i] = n;
      if (typeof riga[0] !== "number") {
        correzioni.push({ range: intervallo(foglio, `A${n}`), values: [[seriale(righe[i].data)]] });
      }
    });
    if (correzioni.length) await scrivi(contabilita(), correzioni, "RAW");
    daFare = rimaste;
  }
  if (daFare.length) return { foglio, motivo: "righe occupate da altri durante la scrittura (3 tentativi)" };
  return { foglio, righe: scritte };
}

export const righeConTag = (celle: Celle, tag: string) =>
  celle.flatMap((r, i) => (String(r?.[10] ?? "").startsWith(tag) ? [i + PRIMA_RIGA] : []));

// ---- Pacchetti e blocchi comprati su Stripe ----

export type Prodotto = {
  linea: "pacchetto" | "blocco";
  etichetta: string; // "ZAFFIRO" oppure "Blocco 10 sessioni"
  pezzi: number; // pacchetto: pezzi finiti
  servizio: "sessione" | "beat" | "mix_master" | null; // blocco
  quantita: number; // blocco: quante unità
  importo: number; // centesimi pagati
};

export const SERVIZIO_REGISTRO = (cfg: Config) => ({
  sessione: "Sessione Registrazione 1h",
  beat: cfg.SERVIZIO_BEAT_REGISTRO,
  mix_master: "Mix Master",
});

export type RigaCalcolata = { servizio: string; importo: number; descrizione: string };

// Pacchetto → 3 righe proporzionali ai prezzi pieni (70/75/80); blocco → 1 riga.
export function righeDaProdotto(p: Prodotto, cfg: Config): RigaCalcolata[] {
  const nomi = SERVIZIO_REGISTRO(cfg);
  if (p.linea === "blocco") {
    return [{ servizio: nomi[p.servizio!], importo: p.importo, descrizione: p.etichetta }];
  }
  const [s, b, m] = proporziona(
    [numero(cfg, "PREZZO_SESSIONE"), numero(cfg, "PREZZO_BEAT"), numero(cfg, "PREZZO_MIX")],
    p.importo,
  );
  const base = `${p.etichetta} ${p.pezzi} ${p.pezzi === 1 ? "pezzo" : "pezzi"}`;
  return [
    { servizio: nomi.sessione, importo: s, descrizione: `${base} — quota sessioni (${p.pezzi})` },
    { servizio: nomi.beat, importo: b, descrizione: `${base} — quota beat (${p.pezzi})` },
    { servizio: nomi.mix_master, importo: m, descrizione: `${base} — quota mix e master (${p.pezzi})` },
  ];
}
