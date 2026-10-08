// Voti dalla chat della live TikTok: riconosce commenti come "8", "7.5", "7,5", "9/10", "!voto 8".
// La chat si legge in sola lettura con tiktok-live-connector (nessun login, nessuna chiave):
// basta il nome utente dell'account che va in diretta.
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";

const RE_VOTO = /^(?:!v(?:oto)?\s*)?(10|\d)(?:[.,](\d))?(?:\s*\/\s*10)?$/i;

// L'intervallo è un'opzione: il Battle legge da 0 a 10, la gara da 4 a 10 (un commento «3» non è un voto).
export function leggiVoto(testo, { min = 0, max = 10 } = {}) {
  const m = String(testo ?? "").trim().match(RE_VOTO);
  if (!m) return null;
  const valore = Number(`${m[1]}.${m[2] ?? 0}`);
  return valore >= min && valore <= max ? valore : null;
}

// Schema attuale di TikTok: testo in `content`, @username in `user.displayId`.
// `comment` e `user.uniqueId` sono i nomi dello schema precedente, ancora citati nella documentazione.
export function commentoTikTok(dati) {
  const u = dati?.user ?? {};
  const utente = u.displayId || u.uniqueId || u.id;
  return utente ? { piattaforma: "tiktok", utente, testo: dati.content ?? dati.comment ?? "" } : null;
}

// Evento «like» di TikTok. Lo schema attuale della libreria (tiktok-live-proto v3) ha `total` (testo di sole cifre, int64: il
// totale dei Like della live) e `count` (numero: i Like di questo messaggio); senza il campo, `total` arriva come "0".
// `totalLikeCount` e `likeCount` sono i nomi dello schema precedente, ancora citati nella documentazione della libreria: restano
// come ripiego, ma solo come numeri. Interi, senza altre coercioni; null se non c'è né un totale valido né un conteggio positivo.
const intero = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.floor(x) : null);
const interoDaCifre = (x) => (typeof x === "string" && /^\d{1,15}$/.test(x) ? Number(x) : null);

export function likeTikTok(dati) {
  const totale = interoDaCifre(dati?.total) ?? intero(dati?.total) ?? intero(dati?.totalLikeCount);
  const conteggio = intero(dati?.count) ?? intero(dati?.likeCount);
  const risultato = { totale: totale !== null && totale > 0 ? totale : null, conteggio: conteggio !== null && conteggio > 0 ? conteggio : 0 };
  return risultato.totale === null && risultato.conteggio === 0 ? null : risultato;
}

// Evento «gift» di TikTok. Lo schema attuale della libreria (tiktok-live-proto v3) ha gift.name, gift.type, giftId (testo di sole
// cifre), repeatCount, repeatEnd (0 o 1) e user.displayId; i nomi dello schema precedente (giftDetails.giftName, giftType,
// user.uniqueId) restano come ripiego. Un regalo «a serie» (type 1) arriva a ogni ripetizione e conta una volta sola, alla fine
// della serie (repeatEnd), con la quantità; gli altri contano subito, almeno uno. null se manca l'utente, se non c'è né il nome
// né l'ID del regalo, o se è una ripetizione intermedia di una serie.
const REGALO_A_SERIE = 1;
const testoPulito = (x) => (typeof x === "string" ? x.trim() : "");
const utenteDi = (u) => testoPulito(u?.displayId) || testoPulito(u?.uniqueId);

export function regaloTikTok(dati) {
  const utente = utenteDi(dati?.user);
  const nome = (testoPulito(dati?.gift?.name) || testoPulito(dati?.giftDetails?.giftName)).slice(0, 60);
  const idLetto = interoDaCifre(dati?.giftId) ?? intero(dati?.giftId);
  const id = idLetto !== null && idLetto > 0 ? idLetto : null;
  if (!utente || (!nome && id === null)) return null;
  const tipo = dati?.gift?.type ?? dati?.giftType;
  const serieFinita = dati?.repeatEnd === 1 || dati?.repeatEnd === true;
  if (tipo === REGALO_A_SERIE && !serieFinita) return null;
  return { utente, nome, id, quantita: Math.max(1, intero(dati?.repeatCount) ?? 0) };
}

// Evento «follow» (un messaggio «social» con «follow» nel testo, che la libreria emette come evento a parte): l'utente e, se c'è,
// il totale dei follower (`followCount`, testo di sole cifre, da 1 a 15; senza il campo arriva come «0» e non vale come totale).
// null se non c'è né l'utente né un totale. Senza utente ma con il totale, l'utente è un testo vuoto.
export function followTikTok(dati) {
  const utente = utenteDi(dati?.user);
  const letto = interoDaCifre(dati?.followCount);
  const totale = letto !== null && letto > 0 ? letto : null;
  return utente || totale !== null ? { utente, totale } : null;
}

// Resta in attesa della live e si ricollega da solo se cade.
// suStato riceve { stato: "spento" | "attesa" | "collegato", messaggio } per la regia.
// Facoltativi: suLike({ totale, conteggio }) a ogni evento «like», suRegalo({ utente, nome, id, quantita }) a ogni regalo e
// suFollow({ utente, totale }) a ogni follow (chi li riceve può lanciare un errore: si scrive nel log e il resto continua),
// suNuovaConnessione() a ogni tentativo di collegamento (prima di connect: chi conta i Like riparte da una lettura nuova) e
// creaConnessione(nome) per provare senza rete (di solito la connessione vera della libreria).
export function avviaTikTok(nomeUtente, suCommento, suStato = () => {}, log = console.log, { suLike, suNuovaConnessione, suRegalo, suFollow, creaConnessione } = {}) {
  const nome = String(nomeUtente ?? "").trim().replace(/^@/, "");
  if (!nome) {
    suStato({ stato: "spento", messaggio: "Nessun account TikTok impostato" });
    return () => {};
  }

  let connessione = null;
  let attesa = null;
  let fermato = false;

  // Chiude una connessione vecchia senza più ascoltarne gli eventi. L'ascoltatore di "error" resta:
  // un errore emesso senza ascoltatori farebbe cadere tutto il server.
  const chiudi = (c) => {
    if (!c) return;
    c.removeAllListeners();
    c.on(ControlEvent.ERROR, () => {});
    Promise.resolve()
      .then(() => c.disconnect())
      .catch(() => {});
  };

  const riprova = (secondi, messaggio) => {
    if (fermato) return;
    chiudi(connessione);
    connessione = null;
    suStato({ stato: "attesa", messaggio });
    clearTimeout(attesa);
    attesa = setTimeout(prova, secondi * 1000);
  };

  async function prova() {
    if (fermato) return;
    const c = creaConnessione ? creaConnessione(nome) : new TikTokLiveConnection(nome, { processInitialData: false });
    connessione = c;
    try {
      suNuovaConnessione?.();
    } catch (e) {
      log(`TikTok: ${e.message}`);
    }
    c.on(ControlEvent.ERROR, (e) => log(`TikTok: ${e?.info ?? ""} ${e?.exception?.message ?? e?.message ?? ""}`.trim()));
    c.on(WebcastEvent.CHAT, (dati) => {
      const commento = commentoTikTok(dati);
      if (commento) suCommento(commento);
    });
    c.on(WebcastEvent.LIKE, (dati) => {
      const like = likeTikTok(dati);
      if (!like) return;
      try {
        suLike?.(like);
      } catch (e) {
        log(`TikTok: Like non registrati (${e.message})`);
      }
    });
    c.on(WebcastEvent.GIFT, (dati) => {
      const regalo = regaloTikTok(dati);
      if (!regalo) return;
      try {
        suRegalo?.(regalo);
      } catch (e) {
        log(`TikTok: regalo non registrato (${e.message})`);
      }
    });
    c.on(WebcastEvent.FOLLOW, (dati) => {
      const follow = followTikTok(dati);
      if (!follow) return;
      try {
        suFollow?.(follow);
      } catch (e) {
        log(`TikTok: follow non registrato (${e.message})`);
      }
    });
    c.on(WebcastEvent.STREAM_END, () => connessione === c && riprova(30, `La live di @${nome} è finita`));
    c.on(ControlEvent.DISCONNECTED, () => connessione === c && riprova(10, "Connessione persa, mi ricollego…"));
    try {
      const { roomId } = await c.connect();
      if (connessione !== c) return;
      suStato({ stato: "collegato", messaggio: `Collegato alla live di @${nome}` });
      log(`TikTok: collegato alla live di @${nome} (room ${roomId})`);
    } catch (e) {
      if (connessione !== c) return;
      const messaggio = e?.message ?? String(e);
      if (e?.constructor?.name === "UserOfflineError" || /offline|not live/i.test(messaggio)) {
        riprova(60, `@${nome} non è in diretta: riprovo ogni minuto`);
      } else if (/Room ID/i.test(messaggio)) {
        // Così risponde TikTok per un @ inesistente (o un account che non è mai andato in diretta).
        riprova(60, `Nessuna live trovata per @${nome}: controlla il nome dell'account. Riprovo ogni minuto`);
      } else {
        riprova(30, `Errore TikTok (${messaggio}): riprovo tra 30 s`);
      }
    }
  }

  prova();
  return () => {
    fermato = true;
    clearTimeout(attesa);
    chiudi(connessione);
    connessione = null;
  };
}
