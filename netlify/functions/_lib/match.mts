// Confronti su nomi, telefoni ed email.

// Solo cifre, con prefisso 39 se manca (numeri italiani fino a 10 cifre).
export function normTel(t: unknown): string {
  let d = String(t ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d && d.length <= 10) d = "39" + d;
  return d;
}

export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();

export function normNome(n: unknown): string {
  return String(n ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Contenimento in entrambe le direzioni, senza maiuscole (minimo 3 lettere per evitare falsi positivi).
export function simile(a: unknown, b: unknown): boolean {
  const x = normNome(a);
  const y = normNome(b);
  if (x.length < 3 || y.length < 3) return x !== "" && x === y;
  return x.includes(y) || y.includes(x);
}

// Evita che un testo venga preso come formula da Google Sheets (USER_ENTERED).
export const testo = (s: unknown) => {
  const v = String(s ?? "");
  return /^[=+\-@]/.test(v) ? "'" + v : v;
};

export const centesimi = (v: unknown) => Math.round(Number(String(v ?? "0").replace(",", ".")) * 100);

export const euro = (cent: number) =>
  (cent / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Divide `totale` (centesimi) in parti proporzionali a `pesi`; l'ultima prende il resto, così la somma torna esatta.
export function proporziona(pesi: number[], totale: number): number[] {
  const somma = pesi.reduce((a, b) => a + b, 0);
  const parti = pesi.map((p) => (somma ? Math.round((totale * p) / somma) : 0));
  parti[parti.length - 1] += totale - parti.reduce((a, b) => a + b, 0);
  return parti;
}
