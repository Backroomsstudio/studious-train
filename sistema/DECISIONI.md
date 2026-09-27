# Decisioni tecniche

Ogni scelta non scritta nelle specifiche, con il motivo.

## Risposte di Luca (§4, 27/09/2026)

| Domanda | Risposta | Dove finisce |
|---|---|---|
| Conto Stripe | Luca | `STRIPE_INCASSATO_DA=Luca` |
| Fondatori (sessione 1 h a 60 €) | AD1, Ojedi, Icaro | Sistema → Config → `FONDATORI` |
| Beat su misura nel Registro | Sessione Beat in Presenza (1h30) | Sistema → Config → `SERVIZIO_BEAT_REGISTRO` |
| Avvisi Telegram | solo Luca (chat privata) | `TELEGRAM_CHAT_ID` = chat di Luca |
| PIN cassa | scelto da Luca, 6 cifre | solo in Netlify e nel `.env` locale, mai in chat o nel repo |

## Fase 0

1. **Git e Node.js installati con winget** (Git 2.55, Node 24 LTS). Sul PC mancavano. Netlify continua a usare Node 22 come da `netlify.toml`, e il codice resta compatibile con entrambi.
2. **Branch di produzione = `claude/busy-knuth-qedjne`**, perché è l'unico branch del repo e quello predefinito su GitHub. Andare in produzione vorrà dire unire `feature/cassa-registro` in quel branch. I commit restano solo in locale finché non serve pubblicarli.
3. **Libreria Google: `google-auth-library` + `fetch`**, non `googleapis`. `googleapis` pesa oltre 100 MB e rallenta il bundle delle functions; ci servono solo Sheets e Calendar, che si chiamano bene via REST.
4. **Le functions escluse dal controllo TypeScript di Next.js** (`tsconfig.json` → `exclude`: `netlify`, `scripts`), con un tsconfig separato per le functions. Il `tsconfig` di Next include `**/*.ts`: un errore in una function bloccherebbe la build del sito pubblico.
5. **Test con data finta degli avvisi**: una scheduled function non ha un URL e non riceve parametri. La logica starà in `_lib`, e la stessa funzione verrà esposta anche da un endpoint HTTP protetto (dettagli in Fase 2).
6. **Pagina `/cassa` = file statico `public/cassa.html`**, servito da Netlify come `/cassa`, più un header `X-Robots-Tag: noindex` in `netlify.toml`. Non tocca il codice Next.js. `robots.txt` non viene modificato, così il percorso non viene reso pubblico.
7. **Template delle variabili in `sistema/env-template.txt`**. Il `.gitignore` ignora ogni file che inizia con `.env`, quindi un file `.env.qualcosa` nella cartella sistema non finirebbe nel repo.

## Idee per dopo

- Rinominare il branch di produzione in `main` (più chiaro), cambiando anche l'impostazione di Netlify. Non è urgente.
