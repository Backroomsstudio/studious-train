// Voti dalla chat della live TikTok: riconosce commenti come "8", "7.5", "7,5", "9/10", "!voto 8".
// La chat si legge in sola lettura con tiktok-live-connector (nessun login, nessuna chiave):
// basta il nome utente dell'account che va in diretta.
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";

const RE_VOTO = /^(?:!v(?:oto)?\s*)?(10|\d)(?:[.,](\d))?(?:\s*\/\s*10)?$/i;

export function leggiVoto(testo) {
  const m = String(testo ?? "").trim().match(RE_VOTO);
  if (!m) return null;
  const valore = Number(`${m[1]}.${m[2] ?? 0}`);
  return valore <= 10 ? valore : null;
}

// Schema attuale di TikTok: testo in `content`, @username in `user.displayId`.
// `comment` e `user.uniqueId` sono i nomi dello schema precedente, ancora citati nella documentazione.
export function commentoTikTok(dati) {
  const u = dati?.user ?? {};
  const utente = u.displayId || u.uniqueId || u.id;
  return utente ? { piattaforma: "tiktok", utente, testo: dati.content ?? dati.comment ?? "" } : null;
}

// Evento «like» di TikTok: `totalLikeCount` è il totale dei Like della live, `likeCount` quelli di questo messaggio.
// Interi, senza coercione di testi; null se non c'è né un totale valido né un conteggio positivo.
export function likeTikTok(dati) {
  const intero = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.floor(x) : null);
  const totale = intero(dati?.totalLikeCount);
  const conteggio = intero(dati?.likeCount);
  const risultato = { totale: totale !== null && totale >= 0 ? totale : null, conteggio: conteggio !== null && conteggio > 0 ? conteggio : 0 };
  return risultato.totale === null && risultato.conteggio === 0 ? null : risultato;
}

// Resta in attesa della live e si ricollega da solo se cade.
// suStato riceve { stato: "spento" | "attesa" | "collegato", messaggio } per la regia.
// Facoltativi: suLike({ totale, conteggio }) a ogni evento «like» e suNuovaConnessione() a ogni tentativo di collegamento
// (prima di connect): chi conta i Like riparte da una lettura nuova.
export function avviaTikTok(nomeUtente, suCommento, suStato = () => {}, log = console.log, { suLike, suNuovaConnessione } = {}) {
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
    const c = new TikTokLiveConnection(nome, { processInitialData: false });
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
