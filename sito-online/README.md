# Prenotazioni e pagamenti online (backroomsstudio.it/prenota/)

## Dove sta

Il sito online di backroomsstudio.it è il **sito statico** nella cartella `sito-online/`:

| Percorso | Cosa contiene |
| --- | --- |
| `sito-online/public/` | Le pagine del sito (home, /preventivo/, /listino/, pagine servizio) e il checkout `/prenota/` |
| `sito-online/src/booking/` | Listino, sconti, Pass, slot, calendario, Stripe, email. È l'**unica fonte dei prezzi**, usata anche dalla versione Next.js |
| `sito-online/src/prenota/main.ts` | La pagina del checkout lato browser (diventa `public/js/prenota.js` con `npm run build`) |
| `sito-online/netlify/functions/` | Le funzioni del server: `/api/disponibilita`, `/api/prenota`, `/api/prenota/annulla`, `/api/stripe/webhook` |
| `sito-online/netlify.toml` | La configurazione di Netlify |

Sul sito, questi pulsanti "Prenota" portano al checkout:
- Sessione di registrazione, Beat su misura, Mix & Master e Affitto sala;
- "Attiva" dei tre Pass, con il Pass già scelto.

- "Prima sessione a 20 €", con la sessione di prova già scelta.

Questi aprono ancora la richiesta su WhatsApp: Singolo/EP/Album, Corsi, Live e Visita.

## Come funziona

1. Il cliente apre **/prenota/** e sceglie a cascata. Prima uno dei tre bottoni **Sessione**, **Beat** o **Mix & Master**. Dentro si apre il secondo livello:
   - Sessione: registrazione con engineer, sessione di prova o sala senza fonico;
   - Beat e Mix & Master: in presenza o a distanza.

   Poi si aprono, uno dopo l'altro, quantità, calendario, dati, pagamento e, in fondo, riepilogo e pagamento.
2. Per i servizi **in studio** vede il calendario dei prossimi 60 giorni, con gli orari liberi e quelli occupati. Il calendario legge in tempo reale il Google Calendar dello studio, ma mostra solo "occupato": nessun nome né dettaglio esce dal sito.
3. Sceglie come pagare:
   - **Online** (carta, PayPal, Apple Pay, Google Pay): va sulla pagina sicura di Stripe. Intanto lo slot compare nel calendario in **grigio** ("⏳ IN ATTESA DI PAGAMENTO") e resta bloccato al massimo 30 minuti.
     - Se paga, l'evento diventa **verde** ("✅ PAGATO") e partono le email, al cliente e a voi.
     - Se annulla o non paga entro 30 minuti, lo slot si libera da solo.
   - **Contanti in studio** (solo per i servizi in studio): l'evento viene creato subito in **rosso** ("💵 DA SALDARE"), con la cifra da incassare nella descrizione e **una notifica 30 minuti prima** della sessione.
   - **Backrooms Pass**: quando il cliente clicca per pagare, prima di andare su Stripe gli viene proposto il Pass mensile con un ulteriore −10% su ogni mese (Start 225 €, Pro 270 €, Label 405 € invece di 250, 300 e 450). Vengono proposti solo i Pass che includono l'acquisto in corso, che diventa la prima sessione del Pass. Il Pass si paga solo online, con rinnovo automatico. A ogni rinnovo vi arriva un'email per fissare le sessioni del mese. Se il cliente rifiuta, paga normalmente il singolo acquisto.
4. I servizi **a distanza** (beat su commissione, mix & master) non occupano il calendario: si pagano online e vi arriva l'email con i dati del cliente.

## Listino

Si modifica tutto in `sito-online/src/booking/catalog.ts`:

| Servizio | Prezzo | In calendario | Massimo |
| --- | --- | --- | --- |
| Prima Sessione di Prova | 20 € (invece di 50 €), **si paga solo in studio**, una volta per cliente (stessa email o telefono) | 1 h | 1 |
| Sessione di Registrazione | 50 € l'ora | 1 h per ora | 6 ore |
| Sessione di Beat in Studio | 60 € a sessione | 1 h 30 per sessione | 4 sessioni (6 h) |
| Beat a Distanza su Commissione | 60 € a beat | — | 6 |
| Mix & Master in Studio | 70 € a brano | 2 h per brano (non mostrato al cliente) | 3 brani (6 h) |
| Mix & Master a Distanza | 70 € a brano | — | 6 |
| Noleggio Studio | 35 € l'ora, **mai scontato** | 1 h per ora | 6 ore |

- **Sconti per quantità**: stessa scala del calcolatore del sito (1–2 a listino, da 3 −10%, da 5 −20%, da 10 −30%), arrotondati all'euro. Si cambiano in `DISCOUNTS`, che vale per tutti i servizi, o in `DISCOUNTS_BY_SERVICE`, che vale per un servizio solo.
- **Catalogo BeatStars**: link al negozio in `BEATSTARS_URL` (https://beatstars.com/backroomss), beat già pronti con licenza base a 30 €.
- **Pass**: contenuti e prezzi in `passes`, ulteriore sconto dal checkout in `PASS_CHECKOUT_EXTRA_DISCOUNT` (oggi 10%).
- **Caparra**: il checkout non chiede caparre: si paga tutto online oppure tutto in contanti in studio.
- **Cancellazioni**: per pagare online una sessione in studio il cliente spunta le condizioni. Può spostare o annullare avvisando almeno 24 ore prima; se avvisa meno di 24 ore prima, o non si presenta, il pagamento online non è rimborsabile. Il testo è in `CANCELLATION_POLICY` (`catalog.ts`). La pagina completa è `/prenota/condizioni/`. L'accettazione viene scritta nell'evento del calendario e ricordata nell'email e nella pagina di Stripe.
- **Preavviso minimo** (24 ore), **giorni prenotabili** (60) e **fascia oraria prenotabile online** (`openHour`/`closeHour`, oggi dalle 14:00 alle 02:00 della notte dopo: l'ultima sessione finisce alle 02:00 e le ore dopo mezzanotte compaiono in fondo al giorno in cui la fascia apre): li trovi in `DEFAULT_RULES`, nel file `sito-online/src/booking/slots.ts`.
- **Cosa rende occupato uno slot**: ogni evento del calendario dello studio, tranne quelli segnati come **"Disponibile"** in Google Calendar (utile per promemoria come "FATTURE" o compleanni).

## Attivazione (una volta sola)

### 0. Netlify: pubblicare il sito da GitHub
Il checkout ha bisogno delle funzioni Netlify, quindi il sito va pubblicato **da GitHub**. Trascinando la cartella su Netlify le funzioni non partono.
1. Vai su **Netlify → il sito backroomsstudio.it → Site configuration → Build & deploy → Continuous deployment** e collega il repository `Backroomsstudio/studious-train`, con il branch scelto.
2. Imposta **Base directory = `sito-online`**. Comando di build, cartella da pubblicare e funzioni li legge da `sito-online/netlify.toml` (`npm run build`, `public`, `netlify/functions`).
3. Prima di pubblicare controlla che `sito-online/public/` sia identico al sito online. È stato allineato il 22/11/2026 scaricando backroomsstudio.it: se nel frattempo avete pubblicato modifiche da un'altra parte, vanno riportate qui.

Le variabili qui sotto vanno inserite in **Netlify → Site configuration → Environment variables**. Dopo averle inserite serve un nuovo deploy. Trovi l'elenco completo in `.env.example`.

### 1. Stripe (carta, PayPal, abbonamenti)
1. Crea l'account su stripe.com intestato a **Luca Cappellari (P.IVA 04596940249)**: è lui che incassa ed emette le ricevute. Il nome compare anche nel checkout e nelle email (`payee` in `sito-online/src/booking/studio.ts`).
2. Vai su **Impostazioni → Metodi di pagamento** e attiva Carte, **PayPal**, Apple Pay e Google Pay.
3. Vai su **Sviluppatori → Chiavi API** e copia la chiave segreta in `STRIPE_SECRET_KEY`.
4. Vai su **Sviluppatori → Webhook** e aggiungi l'endpoint `https://backroomsstudio.it/api/stripe/webhook` con questi eventi:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `invoice.paid`

   Poi copia il "Segreto di firma" in `STRIPE_WEBHOOK_SECRET`.
5. Per le prove usa prima le chiavi `sk_test_…` con la carta di test `4242 4242 4242 4242`.

### 2. Google Calendar
1. Su console.cloud.google.com crea un progetto e attiva **Google Calendar API**.
2. Vai su **IAM → Account di servizio**, creane uno e scarica una chiave JSON.
3. Copia i valori della chiave nelle variabili:
   - `client_email` va in `GOOGLE_CLIENT_EMAIL`;
   - `private_key` va in `GOOGLE_PRIVATE_KEY`, così com'è, con i `\n`.
4. In Google Calendar apri **Impostazioni del calendario** di backrooms.studios.vi@gmail.com e vai su **Condividi con persone specifiche**. Aggiungi l'email dell'account di servizio con il permesso **"Apportare modifiche agli eventi"**.
5. Se volete che anche i calendari personali blocchino gli slot (ad esempio Freya, Akei e Plugghe), condividete anche quelli con l'account di servizio, con il permesso "Vedere solo disponibilità". Poi elencateli in `GOOGLE_BUSY_CALENDAR_IDS`, separati da virgola e compreso quello dello studio.

### 3. Email di notifica
1. Sull'account Google dello studio attiva la verifica in due passaggi.
2. Vai su **Sicurezza → Password per le app** e creane una.
3. Inserisci `SMTP_USER=backrooms.studios.vi@gmail.com` e `SMTP_PASS=<password per le app>`.
4. Se le notifiche devono arrivare a più persone, elenca gli indirizzi in `NOTIFY_EMAILS`.

Senza email il sistema funziona lo stesso: le prenotazioni restano comunque nel calendario.

## Controllo dopo la messa online
Apri **https://backroomsstudio.it/api/stato**: dice se calendario, Stripe, webhook ed email sono collegati (`"pronto": true` quando i primi tre sono ok). Non mostra chiavi né dati dei clienti.

## Prova in locale
```bash
cd sito-online
npm install
BOOKING_DEMO=1 npm run dev   # http://localhost:8888 con calendario finto, senza Google
npm test                     # prezzi, sconti, Pass, slot, cambio d'ora, eventi
```
