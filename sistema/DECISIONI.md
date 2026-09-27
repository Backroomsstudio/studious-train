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
3. **Accesso Google con `node:crypto` + `fetch`**, senza `googleapis` né `google-auth-library` (modificata in Fase 1A). `googleapis` pesa oltre 100 MB. Il token dell'account di servizio si firma in 15 righe con il crypto di Node: zero dipendenze, avvio più veloce.
4. **Le functions escluse dal controllo TypeScript di Next.js** (`tsconfig.json` → `exclude`: `netlify`, `scripts`), con un tsconfig separato per le functions. Il `tsconfig` di Next include `**/*.ts`: un errore in una function bloccherebbe la build del sito pubblico.
5. **Test con data finta degli avvisi**: una scheduled function non ha un URL e non riceve parametri. La logica starà in `_lib`, e la stessa funzione verrà esposta anche da un endpoint HTTP protetto (dettagli in Fase 2).
6. **Pagina `/cassa` = file statico `public/cassa.html`**, servito da Netlify come `/cassa`, più un header `X-Robots-Tag: noindex` in `netlify.toml`. Non tocca il codice Next.js. `robots.txt` non viene modificato, così il percorso non viene reso pubblico.
7. **Template delle variabili in `sistema/env-template.txt`**. Il `.gitignore` ignora ogni file che inizia con `.env`, quindi un file `.env.qualcosa` nella cartella sistema non finirebbe nel repo.

## Fase 1A

8. **File `.mts` (TypeScript ESM) con import espliciti `.mts`**. Netlify li impacchetta con esbuild, e Node 24 li esegue direttamente negli script, senza compilatori in più. Per questo lo script di seed si chiama `seed-stripe-test.mts` e non `.ts`.
9. **Functions "v2" (`export default (req: Request)`)**: il corpo arriva già grezzo, quindi non serve decodificare `isBase64Encoded` (quella è la vecchia API). La firma Stripe è verificata sul corpo esatto in byte.
10. **Test locali senza `netlify dev` né Stripe CLI**: `scripts/dev-server.mts` (server su porta 8888, stessi URL `/.netlify/functions/...`) e `scripts/invia-eventi.mts`, che scarica gli eventi di test da Stripe e li manda firmati al webhook. Si evitano due installazioni pesanti e il login della CLI, e il test "stesso evento due volte" diventa un comando.
11. **Una sola chiamata a Stripe per pagamento**: `checkout.sessions.retrieve` con `expand` di `line_items.data.price.product` e `payment_intent.latest_charge`. Dà gli stessi dati di `listLineItems` più il metodo di pagamento, e aiuta a restare sotto i 10 secondi.
12. **Idempotenza a ogni passo**, oltre a Log_Eventi. Se una scrittura riesce e la successiva fallisce, Stripe riprova. Allora Registro (tag in K), VENDITE (tag in I) e Saldi (colonna stripe_session) vengono saltati se contengono già i dati di quella sessione, e il CRM ritrova il contatto per telefono o email. Tag: `[AUTO-STRIPE <ultimi 10 caratteri della sessione>]`.
13. **Nome del cliente**: `customer_details.individual_name` (versione API 2025-09-30.clover e successive), poi `collected_information.individual_name`, poi `customer_details.name`, `metadata.cliente` e l'email.
14. **Testo WhatsApp dopo l'acquisto = C.5** dell'Appendice C ("Dimmi quali giorni ti vanno meglio questa settimana"), invece di "Ecco i giorni liberi: …". Evita di calcolare gli slot liberi, che è lavoro della Fase 4.
15. **Rimborsi**: le righe negative vanno nel Registro del mese del rimborso, con gli stessi servizi e le stesse quote della riga originale. In VENDITE va una riga negativa per ogni prodotto originale (con un solo prodotto è una riga sola), così i totali per servizio restano giusti. Ogni rimborso è identificato dal suo ID (`rimborso re_…` in Log_Eventi), anche se ne arrivano più di uno parziali.
16. **Prodotti senza metadata** (`linea` mancante): la riga va in Sistema → Da_trascrivere e Luca riceve un avviso. Colonne di Da_trascrivere: timestamp | foglio | data | cliente | servizio | importo | stato | incassato_da | metodo | note | motivo.
17. **Protezione dalle formule**: i testi che iniziano con `= + - @` (nomi, email, note) vengono scritti con un apostrofo davanti, così un nome inserito su Stripe non diventa una formula nel foglio contabile. Anche i telefoni si scrivono come testo.
18. **`/health` è pubblica ma mostra solo ok/errore**, mai valori o segreti. Non manda messaggi: per Telegram usa `getChat`.
19. **Il seed di test scrive i link di test nel Config del foglio Sistema di TEST**, così i pulsanti e i QR dei test puntano alla modalità test.
20. **Etichette**: i pacchetti si chiamano con la parte del nome prima di "·" (per esempio "ZAFFIRO"), i blocchi "Blocco 10 sessioni", "Blocco 5 beat", "Blocco 3 mix e master". Queste etichette si usano in K, in Saldi e nei messaggi.

## Idee per dopo

- Rinominare il branch di produzione in `main` (più chiaro), cambiando anche l'impostazione di Netlify. Non è urgente.
