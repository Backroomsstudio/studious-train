// Chiede a Luca le chiavi una alla volta e le scrive nel file .env. Poi controlla che tutto funzioni.
// Si avvia con doppio clic su sistema\IMPOSTA-CHIAVI.cmd. Premendo solo Invio si lascia il valore già salvato.
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

const FILE = new URL("../.env", import.meta.url);
let testoEnv = await readFile(FILE, "utf8");
const rl = createInterface({ input: process.stdin, output: process.stdout });

const valore = (k: string) => testoEnv.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
function imposta(k: string, v: string) {
  const re = new RegExp(`^${k}=.*$`, "m");
  testoEnv = re.test(testoEnv) ? testoEnv.replace(re, () => `${k}=${v}`) : `${testoEnv}\n${k}=${v}\n`;
  process.env[k] = v;
}
async function chiedi(k: string, domanda: string, valida: (v: string) => string | null): Promise<string> {
  for (;;) {
    const gia = valore(k);
    const v = (await rl.question(`\n${domanda}${gia ? "\n(Premi solo Invio per lasciare quella già salvata)" : ""}\n> `)).trim().replace(/^"|"$/g, "");
    if (!v && gia) return gia;
    const errore = valida(v);
    if (!errore) return v;
    console.log(`  ✗ ${errore} Riprova.`);
  }
}

console.log("=== Chiavi del sistema Backrooms ===");

imposta("STRIPE_SECRET_KEY", await chiedi(
  "STRIPE_SECRET_KEY",
  "1) STRIPE. Apri https://dashboard.stripe.com/test/apikeys , clicca 'Rivela chiave di test' vicino a 'Chiave segreta',\n   copiala e incollala qui (tasto destro del mouse = incolla), poi premi Invio.",
  (v) => (/^(sk|rk)_test_/.test(v) ? null : "Deve iniziare con sk_test_ (chiave di TEST)."),
));

const percorsoJson = await chiedi(
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "2) GOOGLE. Trascina con il mouse dentro questa finestra il file .json scaricato da Google, poi premi Invio.",
  (v) => (v.toLowerCase().endsWith(".json") || v.length > 200 ? null : "Trascina il file .json."),
);
if (percorsoJson.toLowerCase().endsWith(".json")) {
  const json = await readFile(percorsoJson, "utf8");
  const email = JSON.parse(json).client_email;
  imposta("GOOGLE_SERVICE_ACCOUNT_JSON", Buffer.from(json).toString("base64"));
  console.log(`  ✓ Chiave Google salvata. L'email del robot è:\n    ${email}\n  (i fogli e il calendario vanno condivisi con questa email)`);
} else {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = percorsoJson;
}

const token = await chiedi(
  "TELEGRAM_BOT_TOKEN",
  "3) TELEGRAM. Copia il codice lungo che ti ha dato BotFather (tipo 1234567890:AAH...) e incollalo qui, poi premi Invio.",
  (v) => (/^\d+:[\w-]{30,}$/.test(v) ? null : "Il codice ha la forma numeri:lettere."),
);
imposta("TELEGRAM_BOT_TOKEN", token);
if (!valore("TELEGRAM_CHAT_ID")) {
  await rl.question("\n4) Adesso su Telegram apri il TUO bot e scrivigli 'ciao'. Poi torna qui e premi Invio.\n> ");
  const j = (await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json()) as {
    result?: { message?: { chat: { id: number; type: string } } }[];
  };
  const chat = j.result?.map((u) => u.message?.chat).filter((c) => c?.type === "private").pop();
  if (chat) {
    imposta("TELEGRAM_CHAT_ID", String(chat.id));
    console.log("  ✓ Chat trovata: gli avvisi arriveranno a te.");
  } else {
    console.log("  ✗ Non vedo il tuo 'ciao'. Chiudi, scrivi 'ciao' al bot e riapri questa finestra.");
  }
} else {
  process.env.TELEGRAM_CHAT_ID = valore("TELEGRAM_CHAT_ID");
}

imposta("CASSA_PIN", await chiedi(
  "CASSA_PIN",
  "5) PIN DELLA CASSA. Scrivi il PIN di 6 cifre che hai scelto e premi Invio.",
  (v) => (/^\d{6}$/.test(v) ? null : "Servono esattamente 6 cifre."),
));
rl.close();

await writeFile(FILE, testoEnv);
console.log("\n✓ Tutto salvato nel file .env.\n\nControllo i collegamenti...");

for (const riga of testoEnv.split(/\r?\n/)) {
  const m = riga.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
try {
  await import("./setup-sistema.mts"); // prepara i tab del foglio Sistema (se sono già pronti non cambia niente)
} catch (e) {
  console.log(`  ✗ Non riesco ancora a preparare il foglio Sistema: ${(e as Error).message.slice(0, 160)}`);
}
const { default: health } = await import("../netlify/functions/health.mts");
const { esiti } = (await (await health()).json()) as { esiti: Record<string, string> };
for (const [k, v] of Object.entries(esiti)) console.log(`  ${v.startsWith("ok") ? "✓" : "✗"} ${k}: ${v}`);
console.log("\nFinito. Puoi chiudere questa finestra e scrivere 'fatto' a Claude.");
