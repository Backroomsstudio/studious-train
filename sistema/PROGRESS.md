# Stato del lavoro — Cassa e Registro automatici

Ultimo aggiornamento: 27/09/2026

| Fase | Cosa | Stato |
|---|---|---|
| 0 | Ricognizione | ✅ fatta |
| 1A | Pagamento Stripe → Registro + CRM + Saldi + Telegram | 🟡 codice scritto, test sui fogli in attesa del setup di Luca |
| 1B | Pagina /cassa | ⏳ |
| 2 | Avvisi giornalieri | ⏳ |
| 3 | Report del lunedì | ⏳ |
| 4 | Prenotazione online | ⛔ solo su conferma di Luca |

## Fase 0 — Esito

- Repo: `github.com/Backroomsstudio/studious-train`, copia locale in `Documenti\backrooms-sito`.
- Framework: **Next.js 16** (App Router). Build: `npm run build`. Pubblicazione: `.next` (Netlify usa il suo adattatore Next.js). Node 22 su Netlify.
- Branch: su GitHub esiste **un solo branch**, `claude/busy-knuth-qedjne`, che è anche quello predefinito. Le 3 pagine SEO (`/registrazione-voce-vicenza`, `/mix-e-master-vicenza`, `/produzione-musicale-vicenza`) rispondono 200 su www.backroomsstudio.it (server Netlify): **il lavoro SEO è già in produzione e non si perde**.
- Il branch di lavoro è `feature/cassa-registro`, creato da `claude/busy-knuth-qedjne`.
- Netlify Functions in TypeScript nella cartella `netlify/functions/`: supportate insieme a Next.js.
- Scheduled Functions: disponibili su tutti i piani, limite di **30 secondi** per esecuzione, orario in UTC. Partono solo sul deploy di produzione (non sui branch deploy).
- Functions normali: vanno progettate per restare sotto i **10 secondi**, che è il limite più basso tra i piani Netlify. Il piano attuale non è visibile dal repo: va controllato da Luca (vedi SETUP §0).
- `/cassa` oggi risponde 404: il percorso è libero.

## Da verificare nella Fase 1A

- **Quota Daniele (colonna J del Registro)**: la formula è `VLOOKUP(C,LISTINO,8,0)` senza moltiplicare per D. Sembra quindi un importo **fisso** e non una percentuale. Se è così, un blocco da 10 beat scritto in una riga sola darebbe a Daniele la quota fissa una volta sola. Lo verifico sulla copia di test, poi lo segnalo a Luca prima di andare avanti.
- Il campo del nome raccolto da `name_collection.individual` nella versione API Stripe dell'account.

## Fase 1A — Cosa c'è

- `netlify/functions/stripe-webhook.mts`: pagamenti (anche asincroni), pagamenti falliti, rimborsi.
- `netlify/functions/health.mts`: controllo del setup.
- `netlify/functions/_lib/`: config, date, google, sheets, registro, crm, sistema, stripe, telegram, match.
- `scripts/`: `setup-sistema`, `seed-stripe-test`, `dev-server`, `invia-eventi`, `test-calcoli`.
- Comandi in `package.json`: `npm run sistema:test | sistema:typecheck | sistema:setup | sistema:seed-stripe | sistema:dev | sistema:eventi`.

## Esito test

| Test | Esito |
|---|---|
| Calcoli: ZINCO 56/60/64, SMERALDO 87,11/93,33/99,56, ZAFFIRO 115,11/123,33/131,56 | ✅ |
| Calcoli: proposta Diego = 4 righe, totale 965,00 | ✅ |
| Calcoli: rimborso proporzionale con somma esatta, telefoni, nomi, ricerca CRM, doppioni | ✅ |
| Controllo tipi TypeScript delle functions | ✅ |
| Build del sito (`npm run build`): stesse 13 pagine di prima | ✅ |
| ZINCO 180 su fogli di test → 3 righe, VENDITE, saldo, Telegram | ⏳ serve il setup |
| ZAFFIRO + Blocco 10 sessioni → 4 righe = 965,00, 2 VENDITE, 2 saldi | ⏳ |
| Stesso evento due volte → nessun doppione | ⏳ |
| Cliente nuovo → contatto con ID progressivo | ⏳ |
| Rimborso totale → righe negative, saldo annullato, totale del mese invariato | ⏳ |
| Formule H, I, J e totali 166-167 intatti | ⏳ |
