// CRM (file CRM): si scrive solo nelle colonne di input di CRM e VENDITE.
import type { DateTime } from "luxon";
import { env } from "./config.mts";
import { ita, iso } from "./date.mts";
import { scrivi, vuota, type Celle } from "./sheets.mts";
import { normEmail, normNome, normTel, testo } from "./match.mts";

export const RANGE_CRM = "CRM!A5:Y2004";
export const RANGE_SERVIZI_VENDITE = "IMPOSTAZIONI!P6:P30";
export const RANGE_VENDITE = "VENDITE!A5:K1004";

const crm = () => env("SHEET_CRM_ID");

// Indici di colonna (A = 0).
const A = 0, B = 1, C = 2, U = 20, V = 21, X = 23, Y = 24;

export type Contatto = {
  riga: number;
  id: string;
  nome: string;
  fase: string;
  nomeCompleto: string;
  instagram: string;
  telefono: string;
  email: string;
};

export function contattiDa(celle: Celle): Contatto[] {
  return celle.flatMap((r, i) =>
    vuota(r?.[A])
      ? []
      : [{
          riga: i + 5,
          id: String(r[A]).trim(),
          nome: String(r[B] ?? "").trim(),
          fase: String(r[C] ?? ""),
          nomeCompleto: String(r[U] ?? "").trim(),
          instagram: String(r[V] ?? "").trim(),
          telefono: String(r[X] ?? ""),
          email: String(r[Y] ?? ""),
        }],
  );
}

export type DatiCliente = { crmId?: string | null; telefono?: string | null; email?: string | null; nome: string };
export type Cliente = { id: string; nome: string; telefono: string; nuovo: boolean; doppioni: string[] };

// Ordine: crm_id → telefono → email → nome esatto (B o U). Nome ambiguo → contatto nuovo + avviso.
export function cerca(contatti: Contatto[], d: DatiCliente): { trovato?: Contatto; doppioni: string[] } {
  if (d.crmId) {
    const c = contatti.find((c) => c.id.toUpperCase() === d.crmId!.trim().toUpperCase());
    if (c) return { trovato: c, doppioni: [] };
  }
  const tel = normTel(d.telefono);
  if (tel.length >= 11) {
    const c = contatti.find((c) => normTel(c.telefono) === tel);
    if (c) return { trovato: c, doppioni: [] };
  }
  const mail = normEmail(d.email);
  if (mail) {
    const c = contatti.find((c) => normEmail(c.email) === mail);
    if (c) return { trovato: c, doppioni: [] };
  }
  const n = normNome(d.nome);
  const perNome = n ? contatti.filter((c) => normNome(c.nome) === n || normNome(c.nomeCompleto) === n) : [];
  if (perNome.length === 1) return { trovato: perNome[0], doppioni: [] };
  return { doppioni: perNome.map((c) => c.id) };
}

export async function trovaOCreaCliente(celle: Celle, d: DatiCliente, data: DateTime, origine: string): Promise<Cliente> {
  const contatti = contattiDa(celle);
  const { trovato, doppioni } = cerca(contatti, d);

  if (trovato) {
    const dati = [{ range: `CRM!S${trovato.riga}`, values: [[iso(data)]] }];
    const fase = parseInt(trovato.fase, 10);
    if (fase >= 1 && fase <= 6) dati.push({ range: `CRM!C${trovato.riga}`, values: [["7 · Cliente"]] });
    await scrivi(crm(), dati);
    return { id: trovato.id, nome: trovato.nome || d.nome, telefono: trovato.telefono || d.telefono || "", nuovo: false, doppioni };
  }

  // Nuovo contatto: prima riga con A vuota dalla 5, ID = massimo + 1.
  let riga = celle.findIndex((r) => vuota(r?.[A])) + 5;
  if (riga < 5) riga = celle.length + 5;
  if (riga > 2004) throw new Error("CRM pieno: nessuna riga libera fino alla 2004");
  const max = Math.max(0, ...contatti.map((c) => Number(/^C(\d+)$/i.exec(c.id)?.[1] ?? 0)));
  const id = `C${String(max + 1).padStart(4, "0")}`;
  const oggi = iso(data);
  await scrivi(crm(), [
    { range: `CRM!A${riga}:C${riga}`, values: [[id, testo(d.nome), "7 · Cliente"]] },
    { range: `CRM!F${riga}:G${riga}`, values: [["Fissare prossima sessione", oggi]] },
    { range: `CRM!S${riga}`, values: [[oggi]] },
    { range: `CRM!U${riga}`, values: [[testo(d.nome)]] },
    { range: `CRM!X${riga}:Y${riga}`, values: [[d.telefono ? `'${d.telefono}` : "", testo(d.email ?? "")]] },
    { range: `CRM!AA${riga}`, values: [["Non nota"]] },
    { range: `CRM!AH${riga}`, values: [[`Creato automaticamente da ${origine} il ${ita(data)}`]] },
  ]);
  return { id, nome: d.nome, telefono: d.telefono ?? "", nuovo: true, doppioni };
}

// ---- VENDITE ----

export type RigaVendita = {
  data: DateTime;
  crmId: string;
  servizio: string;
  importo: number; // centesimi
  stato: "PAGATO" | "DA PAGARE";
  nota: string;
  origine: string;
};

export const venditeConTag = (celle: Celle, tag: string) =>
  celle.flatMap((r, i) => (String(r?.[8] ?? "").startsWith(tag) ? [i + 5] : []));

// Scrive solo A, B, D, E, F, G, I, K (C, H, J sono formule). Salta se il tag è già presente.
export async function scriviVendite(celle: Celle, righe: RigaVendita[], tag: string): Promise<number[]> {
  const gia = venditeConTag(celle, tag);
  if (gia.length) return gia;
  const libere: number[] = [];
  for (let n = 5; n <= 1004 && libere.length < righe.length; n++) if (vuota(celle[n - 5]?.[0])) libere.push(n);
  if (libere.length < righe.length) throw new Error("VENDITE pieno: nessuna riga libera fino alla 1004");
  await scrivi(
    crm(),
    righe.flatMap((r, k) => {
      const n = libere[k];
      return [
        { range: `VENDITE!A${n}:B${n}`, values: [[iso(r.data), r.crmId]] },
        { range: `VENDITE!D${n}:G${n}`, values: [[r.servizio, r.importo / 100, r.stato, "Ordinario"]] },
        { range: `VENDITE!I${n}`, values: [[testo(r.nota)]] },
        { range: `VENDITE!K${n}`, values: [[r.origine]] },
      ];
    }),
  );
  return libere;
}

export const SERVIZIO_VENDITE_BLOCCO = {
  sessione: "Blocco sessioni",
  beat: "Blocco beat",
  mix_master: "Blocco mix + master",
} as const;

// Nome del servizio in VENDITE, preso dalla lista IMPOSTAZIONI!P6:P30 (se manca: "Altro").
export function servizioVendite(
  p: { linea: string; etichetta: string; servizio: keyof typeof SERVIZIO_VENDITE_BLOCCO | null },
  lista: string[],
): string {
  const voluto =
    p.linea === "pacchetto"
      ? `Pacchetto ${p.etichetta.charAt(0).toUpperCase()}${p.etichetta.slice(1).toLowerCase()}`
      : SERVIZIO_VENDITE_BLOCCO[p.servizio!];
  return lista.includes(voluto) ? voluto : "Altro";
}
