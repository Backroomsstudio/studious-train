# Messa online del checkout di backroomsstudio.it/prenota/: istruzioni per l'assistente

## Contesto

Backrooms Studio è uno studio di registrazione ad Arcugnano (Vicenza). Il sito **https://backroomsstudio.it** è pubblicato su **Netlify** dal repository GitHub **Backroomsstudio/studious-train** (branch `claude/busy-knuth-qedjne`, cartella base `sito-online`).

Il sito ha un checkout, **/prenota/**, che funziona così:
- legge il Google Calendar dello studio (**backrooms.studios.vi@gmail.com**) e mostra gli orari liberi;
- scrive le prenotazioni nel calendario: grigio = in attesa di pagamento, verde = pagato, rosso "DA SALDARE" = paga in contanti;
- incassa con **Stripe**: carta, PayPal, Apple Pay, Google Pay e l'abbonamento mensile "Backrooms Pass". I pagamenti arrivano a **Luca Cappellari, P.IVA 04596940249**.

### Stato al 23/11/2026
| Cosa | Stato |
| --- | --- |
| Google Calendar | ✅ funziona: il sito legge il calendario |
| Pull request #4 (checkout a cascata, 24 ore, condizioni di cancellazione) | ❌ **da unire** |
| Stripe | ❌ **chiave sbagliata**: in `STRIPE_SECRET_KEY` c'è il segreto del webhook (`whsec_…`) invece della chiave segreta (`sk_test_…`). Chi paga online riceve un errore |
| Email di notifica | ❌ non configurate (mancano `SMTP_USER` e `SMTP_PASS`) |

La pagina **https://backroomsstudio.it/api/stato** dice in ogni momento cosa funziona e cosa manca. Non mostra chiavi complete.

## Regole da rispettare sempre

1. **Mai scrivere chiavi o password** in chat, su GitHub, nei commenti o nei messaggi. Vanno solo nei campi di Netlify (Environment variables).
2. **Usare prima le chiavi di TEST di Stripe** (`sk_test_…`). Le chiavi LIVE (`sk_live_…`) si mettono solo al passo 8, dopo che tutte le prove sono andate bene.
3. **Non cancellare né modificare** eventi del Google Calendar dello studio, tranne:
   - gli eventi di prova creati al passo 7, che hanno nome "TEST";
   - il cambio "Occupato → Disponibile" del passo 6.
4. Dati personali o fiscali di Luca (documento, IBAN, codice fiscale, indirizzo) **vanno chiesti a Luca**: non si inventano e non si copiano da altri documenti senza conferma.
5. Se un passo non va come descritto, **fermarsi e riportare** cosa si vede (testo esatto del messaggio), invece di provare soluzioni a caso.

---

## Passo 1: unire la pull request #4 su GitHub

1. Apri https://github.com/Backroomsstudio/studious-train/pull/4 (accedi con l'account GitHub dello studio).
2. Controlla che in fondo non ci siano conflitti ("This branch has no conflicts with the base branch").
3. Premi **Merge pull request**, poi **Confirm merge**.
4. Netlify pubblica da solo in 1–3 minuti. Verifica: apri https://backroomsstudio.it/prenota/ (ricarica forzata con Ctrl+Shift+R o Cmd+Shift+R). Devono comparire **tre bottoni grandi: Sessione, Beat, Mix & Master**. Se dopo 5 minuti non ci sono, vai su Netlify → *Deploys* e riporta lo stato dell'ultimo deploy.

## Passo 2: Stripe, chiavi di TEST e webhook

Account Stripe di Luca Cappellari: https://dashboard.stripe.com. Se l'account non esiste ancora, crealo a nome di Luca; i dati fiscali e bancari si chiedono a lui. Per le prove in modalità test l'attivazione completa non serve.

1. In alto a destra attiva la **modalità di test** (interruttore "Test mode" / "Ambiente di test").
2. **Chiave segreta di test:** *Sviluppatori → Chiavi API*. Copia la **Chiave segreta** (inizia con `sk_test_`). **Non** la chiave pubblicabile `pk_test_`.
3. **Webhook di test:** *Sviluppatori → Webhook → Aggiungi endpoint*.
   - URL dell'endpoint: `https://backroomsstudio.it/api/stripe/webhook`
   - Eventi da selezionare (esattamente questi 5):
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
     - `invoice.paid`
   - Salva. Poi apri l'endpoint e copia il **Segreto di firma** (inizia con `whsec_`).
   - Se un endpoint con questo URL esiste già in modalità test, usa quello: controlla solo che abbia i 5 eventi e copia il suo segreto.
4. **Metodi di pagamento:** *Impostazioni → Pagamenti → Metodi di pagamento*. Attiva **Carte, PayPal, Apple Pay, Google Pay** (fallo sia in test sia in live). PayPal può chiedere di collegare un conto PayPal Business: se lo chiede, riporta a Luca cosa serve.
5. **Nome sulla ricevuta:** *Impostazioni → Dati aziendali / Public details*. Il nome pubblico deve essere "Backrooms Studio" e l'email di assistenza backrooms.studios.vi@gmail.com.

## Passo 3: Netlify, correggere le variabili Stripe

1. Apri https://app.netlify.com → il sito di **backroomsstudio.it** → *Site configuration → Environment variables*.
2. Modifica **`STRIPE_SECRET_KEY`** e incolla la chiave `sk_test_…` del passo 2.2, al posto del valore `whsec_…` che c'è ora.
3. Modifica **`STRIPE_WEBHOOK_SECRET`** e incolla il segreto `whsec_…` del passo 2.3.
4. Non toccare `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` e `GOOGLE_CALENDAR_ID`: funzionano già.
5. Vai su *Deploys → Trigger deploy → Deploy site* e aspetta che diventi "Published".

## Passo 4: email di notifica (Gmail)

Servono perché lo studio riceva un'email a ogni prenotazione e il cliente riceva la conferma.

1. Accedi all'account Google **backrooms.studios.vi@gmail.com** → https://myaccount.google.com/security.
2. Se non è attiva, attiva la **Verifica in due passaggi**. Può servire il telefono dello studio: chiedi a chi lo ha.
3. Apri https://myaccount.google.com/apppasswords e crea una password per le app chiamata "Sito Backrooms". Copia la password di 16 lettere.
4. Su Netlify → *Environment variables* aggiungi:
   - `SMTP_USER` = `backrooms.studios.vi@gmail.com`
   - `SMTP_PASS` = la password di 16 lettere, senza spazi
   - (facoltativo) `NOTIFY_EMAILS` = indirizzi che devono ricevere le notifiche, separati da virgola. Se manca, arrivano a backrooms.studios.vi@gmail.com.
5. *Deploys → Trigger deploy → Deploy site*.

## Passo 5: controllo automatico

Apri **https://backroomsstudio.it/api/stato**. Il risultato atteso:

```
"pronto": true
"calendario": "ok: letti 1 calendari, N impegni nei prossimi 7 giorni"
"stripe": "ok: modalità TEST (nessun incasso vero)"
"webhook": "ok: segreto impostato"
"email": "ok: notifiche a 1 indirizzi"
```

Se una voce dice "errore" o "manca", la frase spiega cosa sistemare. Correggi su Netlify, rifai il deploy e ricontrolla. Se dopo una correzione l'errore resta uguale, riporta la frase esatta.

## Passo 6: Google Calendar, impegni che non occupano la sala

Il sito considera **occupato** ogni evento del calendario dello studio, tranne quelli impostati come **"Disponibile"**. Gli impegni che non tengono occupata la sala vanno impostati su "Disponibile", altrimenti bloccano orari prenotabili.

1. Apri https://calendar.google.com con l'account backrooms.studios.vi@gmail.com.
2. Per gli eventi **ricorrenti o futuri** che non sono sessioni in sala, apri l'evento → modifica → cambia **"Occupato"** in **"Disponibile"** → salva. Per i ricorrenti scegli "Tutti gli eventi".
   - Esempi visti nel calendario: **START GIORNATA**, **FATTURE**, **Call Commercialista**, **Compleanno …**, **MANDARE E ULTIMARE CONTENUTI TIKTOK**, **eliminare canva pro daniele**.
3. **Non toccare** le sessioni con i clienti ("… - Sessione Hook", "Sessione Rec", "SESSIONE - …") né gli eventi in cui la sala è davvero usata (per esempio "EP BACKROOMS", "Freya fa musica…", "RIUNIONE GENERALE"). Nel dubbio, lascia "Occupato" e segnalalo nel resoconto finale.

## Passo 7: prove complete (modalità TEST, nessun incasso vero)

Usa sempre nome **"TEST"** ed email **backrooms.studios.vi@gmail.com**, così le email di prova arrivano allo studio. Scegli date **ad almeno 3 giorni da oggi**, in un orario libero.

**Prova A: contanti**
1. https://backroomsstudio.it/prenota/ → **Sessione** → **Sala senza fonico** → 1 ora → un giorno e un orario liberi → dati → **In studio** → spunta la privacy → **Conferma prenotazione**.
2. Atteso:
   - la pagina "Prenotazione registrata";
   - nel Google Calendar un evento **rosso** "💵 DA SALDARE · Noleggio Studio · TEST" con la notifica 30 minuti prima;
   - 2 email (notifica allo studio e conferma al cliente).

**Prova B: pagamento online**
1. **Sessione** → **Registrazione con engineer** → 2 ore → orario libero → dati → **Online** → spunta **le condizioni di cancellazione** e la privacy → **Vai al pagamento**.
2. Compare la proposta del **Pass**: premi **"No grazie, continua"**.
3. Sulla pagina di Stripe paga con la carta di test **4242 4242 4242 4242**, scadenza qualsiasi nel futuro (es. 12/30), CVC 123, CAP 36057.
4. Atteso:
   - la pagina "Pagamento ricevuto";
   - nel calendario l'evento **verde** "✅ PAGATO · Sessione di Registrazione · TEST", con nella descrizione la riga sulle condizioni di cancellazione;
   - 2 email;
   - in Stripe (modalità test) *Pagamenti*: 100 € riusciti.

**Prova C: pagamento annullato**
1. Ripeti la prova B fino alla pagina di Stripe, poi premi la **freccia indietro / "←"** in alto a sinistra di Stripe.
2. Atteso:
   - torni su /prenota/ con il messaggio "Pagamento annullato";
   - nel calendario **non** resta nessun evento grigio per quell'orario (aspetta 1 minuto e ricarica).

**Prova D: Pass mensile**
1. Ripeti la prova B, ma nella proposta del Pass scegli **Attiva Pass Start**. Paga con 4242.
2. Atteso:
   - evento verde con "(Pass Start)" nel titolo;
   - in Stripe (test) *Clienti / Abbonamenti*: un abbonamento mensile da 225 €.
3. Poi **annulla l'abbonamento di test** in Stripe: *Abbonamenti → … → Annulla abbonamento → immediatamente*.

**Prova E: le regole**
1. Prova a prenotare per **domani**: gli orari a meno di 24 ore devono essere **non disponibili**.
2. Scegli Online senza spuntare le condizioni di cancellazione e premi "Vai al pagamento": il browser deve **chiedere di spuntare la casella**.
3. **Sessione** → **Sessione di prova**: il pagamento "Online" deve essere **disattivato** (si paga solo in studio).

**Pulizia dopo le prove**
- Cancella dal Google Calendar **solo** gli eventi "TEST" creati nelle prove.
- In Stripe test non serve fare niente: non sono soldi veri.

## Passo 8: passare ai pagamenti veri (LIVE)

Fallo solo se **tutte** le prove del passo 7 sono andate bene **e Luca ha confermato**.

1. In Stripe disattiva la modalità di test. Completa l'**attivazione dell'account**: dati di Luca, P.IVA 04596940249, IBAN per gli accrediti. Tutti questi dati si chiedono a Luca.
2. *Sviluppatori → Chiavi API* (live): copia la chiave segreta **`sk_live_…`**.
3. *Sviluppatori → Webhook* (live): aggiungi di nuovo l'endpoint `https://backroomsstudio.it/api/stripe/webhook` con gli **stessi 5 eventi** del passo 2.3, poi copia il **nuovo** segreto `whsec_…`. Quello live è diverso da quello di test.
4. Netlify: `STRIPE_SECRET_KEY` = `sk_live_…`, `STRIPE_WEBHOOK_SECRET` = il nuovo `whsec_…` live. Poi *Trigger deploy*.
5. https://backroomsstudio.it/api/stato deve dire **"stripe": "ok: modalità LIVE (incassi veri)"** e `"pronto": true`.
6. (Consigliato) Prova vera: **Sala senza fonico, 1 ora, online**, pagata con una carta vera dello studio. Controlla l'evento verde, poi **rimborsa** da Stripe (*Pagamenti → il pagamento → Rimborsa*) e cancella l'evento.

## Passo 9: controlli finali sul sito

- Home https://backroomsstudio.it: i pulsanti **Prenota** di sessione, beat, mix & master e sala senza fonico portano a /prenota/ con la scelta già aperta.
- I pulsanti **Attiva** dei Pass Start, Pro e Label aprono /prenota/ con il messaggio "Stai attivando il Pass …".
- "Prima sessione a 20 €" apre /prenota/ con la **Sessione di prova** già scelta.
- https://backroomsstudio.it/prenota/condizioni/ si apre e mostra le condizioni di cancellazione.
- Il catalogo BeatStars (dentro **Beat**) apre https://beatstars.com/backroomss.

## Cosa riportare alla fine

Un breve resoconto con:
1. l'esito di ogni passo (fatto / non fatto / problema, con il testo esatto degli errori);
2. il risultato di https://backroomsstudio.it/api/stato copiato **così com'è** (non contiene chiavi complete);
3. quali eventi del calendario sono stati impostati come "Disponibile" e quali sono stati lasciati "Occupato" per dubbio;
4. se Stripe è in modalità TEST o LIVE;
5. cosa serve ancora da Luca o dagli altri soci.
