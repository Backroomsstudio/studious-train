# Prenotazioni e pagamenti online (`/prenota`)

## Come funziona

1. Il cliente apre **/prenota** (da qualsiasi pulsante "Prenota" del sito) e sceglie servizio e quantità. Il prezzo si aggiorna subito.
2. Per i servizi **in studio** vede il calendario dei prossimi 60 giorni, con gli orari liberi e quelli occupati. Il calendario legge in tempo reale il Google Calendar dello studio, ma mostra solo "occupato": nessun nome né dettaglio esce dal sito.
3. Sceglie come pagare:
   - **Online** (carta, PayPal, Apple Pay, Google Pay): va sulla pagina sicura di Stripe. Intanto lo slot compare nel calendario in **grigio** ("⏳ IN ATTESA DI PAGAMENTO") e resta bloccato al massimo 30 minuti.
     - Se paga, l'evento diventa **verde** ("✅ PAGATO") e partono le email, al cliente e a voi.
     - Se annulla o non paga entro 30 minuti, lo slot si libera da solo.
   - **Contanti in studio** (solo per i servizi in studio): l'evento viene creato subito in **rosso** ("💵 DA SALDARE"), con la cifra da incassare nella descrizione e **una notifica 30 minuti prima** della sessione.
   - **Rinnova ogni mese** (spunta, solo online): Stripe addebita lo stesso pacchetto ogni mese. A ogni rinnovo vi arriva un'email per fissare la sessione del mese con il cliente.
4. I servizi **a distanza** (beat su commissione, mix & master) non occupano il calendario: si pagano online e vi arriva l'email con i dati del cliente.

## Listino

Si modifica tutto in `lib/booking/catalog.ts`:

| Servizio | Prezzo | In calendario | Massimo |
| --- | --- | --- | --- |
| Sessione di Registrazione | 50 € l'ora | 1 h per ora | 6 ore |
| Sessione di Beat in Studio | 60 € a sessione | 1 h 30 per sessione | 4 sessioni (6 h) |
| Beat a Distanza su Commissione | 60 € a beat | — | 6 |
| Mix & Master in Studio | 70 € a brano | 2 h per brano (non mostrato al cliente) | 3 brani (6 h) |
| Mix & Master a Distanza | 70 € a brano | — | 6 |

- **Sconti per quantità**: si mettono in `DISCOUNTS`, che vale per tutti i servizi, o in `DISCOUNTS_BY_SERVICE`, che vale per un servizio solo. Il formato è `{ quantità minima: percentuale }`, ad esempio `{ 2: 5, 3: 10 }`. Finché sono vuoti si paga il prezzo pieno.
- **Catalogo BeatStars**: incolla il link del negozio in `BEATSTARS_URL`. Da vuoto, il riquadro resta nascosto.
- **Preavviso minimo** (3 ore) e **giorni prenotabili** (60): li trovi in `DEFAULT_RULES`, nel file `lib/booking/slots.ts`.

## Attivazione (una volta sola)

Le variabili vanno inserite in **Netlify → Site configuration → Environment variables**. Dopo averle inserite serve un nuovo deploy. Trovi l'elenco completo in `.env.example`.

### 1. Stripe (carta, PayPal, abbonamenti)
1. Crea l'account su stripe.com. L'intestatario è chi emette la fattura (una delle P.IVA).
2. Vai su **Impostazioni → Metodi di pagamento** e attiva Carte, **PayPal**, Apple Pay e Google Pay.
3. Vai su **Sviluppatori → Chiavi API** e copia la chiave segreta in `STRIPE_SECRET_KEY`.
4. Vai su **Sviluppatori → Webhook** e aggiungi l'endpoint `https://www.backroomsstudio.it/api/stripe/webhook` con questi eventi:
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

## Prova in locale
```bash
BOOKING_DEMO=1 npm run dev   # calendario finto, per vedere la grafica senza Google
npm test                     # prezzi, sconti, slot, cambio d'ora, eventi
```
