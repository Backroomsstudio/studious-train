# Setup — istruzioni click per click per Luca

Fai i passi in ordine. Quando un passo ti dà un **codice segreto** (chiave, token, PIN), non incollarlo mai in chat: va solo nel file `.env` sul PC e nelle variabili di Netlify (§6).

---

## §0 — Controlli veloci su Netlify

1. Vai su app.netlify.com, apri il sito di backroomsstudio.it.
2. **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts**: il "Production branch" deve essere `claude/busy-knuth-qedjne`. Se ce n'è un altro, dimmelo.
3. In alto a sinistra apri il team, poi **Billing**: dimmi come si chiama il piano (per esempio "Free" o "Starter").

## §1 — Copie di test dei fogli (mai testare sui fogli veri)

1. Apri "Contabilità Backrooms Finale" → **File → Crea una copia** → nome `TEST - Contabilità` → OK.
2. Apri "Backrooms_CRM" → **File → Crea una copia** → nome `TEST - CRM` → OK.
3. Vai su sheets.google.com → **Foglio vuoto** → rinominalo `Backrooms_Sistema`. Lascialo vuoto: le schede le crea il sistema.
4. Per ognuno dei 3 file copia l'**ID**, cioè la parte dell'indirizzo tra `/d/` e `/edit`. Gli ID non sono segreti: puoi mandarmeli in chat.

## §2 — Account di servizio Google (il "robot" che scrive nei fogli)

1. Vai su console.cloud.google.com, con l'account backrooms.studios.vi@gmail.com.
2. In alto: **Seleziona progetto → Nuovo progetto** → nome `backrooms-sistema` → **Crea**. Poi selezionalo.
3. Menu ☰ → **API e servizi → Libreria** → cerca **Google Sheets API** → **Abilita**. Torna alla Libreria → **Google Calendar API** → **Abilita**.
4. Menu ☰ → **IAM e amministrazione → Account di servizio → + Crea account di servizio** → nome `backrooms-bot` → **Crea e continua** → **Fine** (i ruoli non servono).
5. Copia l'**email** dell'account (tipo `backrooms-bot@backrooms-sistema.iam.gserviceaccount.com`): ti serve al §3. Puoi mandarmela.
6. Clicca sull'account → scheda **Chiavi → Aggiungi chiave → Crea nuova chiave → JSON → Crea**. Si scarica un file `.json`. **È segreto**: non mandarlo a nessuno.
7. Trasformalo nel formato per le variabili. Apri PowerShell e incolla questa riga, cambiando il percorso del file:
   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\plugghe\Downloads\NOME-FILE.json")) | Set-Clipboard
   ```
   Adesso il testo è negli appunti: è il valore di `GOOGLE_SERVICE_ACCOUNT_JSON` (§6).

## §3 — Condividere fogli e calendario con l'account di servizio

1. Nei 3 file del §1 (e più avanti anche nei 2 file veri): **Condividi** → incolla l'email del §2.5 → ruolo **Editor** → togli la spunta "Invia notifica" → **Condividi**.
2. Google Calendar sul computer → ⚙️ **Impostazioni** → a sinistra, sotto "Impostazioni dei miei calendari", clicca il calendario `backrooms.studios.vi@gmail.com` → **Condividi con persone e gruppi specifici → + Aggiungi persone** → email del §2.5 → permesso **Visualizzare tutti i dettagli degli eventi** → **Invia**.

## §4 — Bot Telegram (avvisi solo a Luca)

1. In Telegram cerca **@BotFather** → **Avvia** → scrivi `/newbot`.
2. Nome: `Backrooms Cassa`. Username: per esempio `backrooms_cassa_bot` (deve finire con `bot`).
3. BotFather ti manda un **token** (tipo `123456:ABC…`). **È segreto**: è il valore di `TELEGRAM_BOT_TOKEN`.
4. Apri il tuo bot e scrivigli "ciao".
5. Dal browser apri `https://api.telegram.org/botIL_TUO_TOKEN/getUpdates`, mettendo il token al posto di `IL_TUO_TOKEN`. Cerca `"chat":{"id":` : il numero che segue è `TELEGRAM_CHAT_ID`.

## §5 — Stripe in modalità test

1. dashboard.stripe.com → in alto attiva **Modalità test** (o "Sandbox").
2. **Sviluppatori → Chiavi API**: la "Chiave segreta" di test (`sk_test_…`) è `STRIPE_SECRET_KEY` per i test. **È segreta.**
3. Il resto (Stripe CLI, webhook di test) lo preparo io in Fase 1A e ti guido quando serve.

## §6 — Il file `.env` sul PC (solo per i test)

1. Nella cartella `Documenti\backrooms-sito` crea un file chiamato esattamente `.env`.
2. Copia dentro il contenuto di `sistema/env-template.txt` e riempi i valori. Git lo ignora, quindi non finisce mai su GitHub.
3. Le stesse variabili, con i valori veri (chiavi live, fogli veri), le metteremo su Netlify alla messa in produzione: **Site configuration → Environment variables → Add a variable**. Le istruzioni complete arrivano in quella fase.

## §7 — Smettere di ricevere le email di errore di Vercel

Il progetto Vercel "studious-train" non è il sito vero (il sito è su Netlify) e fallisce a ogni commit. Puoi scollegarlo senza rischi:

1. vercel.com → apri il progetto **studious-train**.
2. **Settings → Git → Disconnect** per scollegarlo dal repo.
   Oppure **Settings → General → in fondo "Delete Project"** per eliminarlo del tutto.
