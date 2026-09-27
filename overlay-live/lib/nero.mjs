// Nero.fan: la traccia in riproduzione (letta dalla coda pubblica) e il webhook "Stream triggers"
// (Settings → Developer → Stream triggers), che a ogni submission pagata manda un POST firmato.
// Doc webhook: https://www.nero.fan/docs/stream-triggers
import { createHmac, timingSafeEqual } from "node:crypto";

// Header X-Nero-Signature: "sha256=" + HMAC-SHA256(corpo grezzo, segreto)
export function firmaValida(corpo, firma, segreto) {
  if (!segreto || typeof firma !== "string") return false;
  const attesa = Buffer.from(`sha256=${createHmac("sha256", segreto).update(corpo).digest("hex")}`);
  const ricevuta = Buffer.from(firma.trim().toLowerCase());
  return attesa.length === ricevuta.length && timingSafeEqual(attesa, ricevuta);
}

const testo = (v) => String(v ?? "").trim().slice(0, 120);
const tier = (t) => (["standard", "skip", "superskip", "throne"].includes(t) ? t : "standard");

// submission.paid → voce di coda. Gli altri eventi (goal.reached) per ora non servono.
// Da verificare con un evento di prova: qui assumiamo submissionName = titolo, submitterName = artista.
export function versoCoda(evento, ora) {
  if (evento?.event !== "submission.paid" || !evento.data) return null;
  const d = evento.data;
  return {
    id: `nero-${d.sessionId}-${d.timestamp}-${d.submissionName ?? ""}`,
    titolo: testo(d.submissionName),
    artista: testo(d.submitterName),
    tier: tier(d.tier),
    importo: typeof d.amountPaid === "number" ? d.amountPaid : null,
    ricevutoAlle: typeof d.timestamp === "number" ? d.timestamp : ora,
  };
}

// --- Traccia in riproduzione ------------------------------------------------------------
// La pagina pubblica del profilo Nero (e il suo embed) legge due indirizzi senza login:
//   /users/<username>/profile   → liveSession.id della sessione in corso
//   /queue/<sessionId>/slim     → coda, con `current` = submission in riproduzione
// Quando su Nero si passa alla prossima, `current` cambia: l'overlay la segue da solo.
const API_NERO = "https://api.nero.fan";

export function tracciaInOnda(coda) {
  const c = coda?.current;
  if (!c?.streamSubmissionId) return null;
  return { neroId: c.streamSubmissionId, titolo: testo(c.submissionName), artista: testo(c.submitterName), tier: tier(c.tier) };
}

// Controlla la coda ogni `intervallo` ms e chiama suInOnda con la traccia in riproduzione (o null).
// suStato riceve { stato: "spento" | "attesa" | "collegato", messaggio } per la regia.
export function avviaNero(username, suInOnda, suStato = () => {}, { intervallo = 3000, scarica = fetch } = {}) {
  const nome = String(username ?? "").trim().replace(/^@/, "");
  if (!nome) {
    suStato({ stato: "spento", messaggio: "Nessun account Nero.fan in config.json" });
    return () => {};
  }

  let fermato = false;
  let attesa = null;
  let sessione = null;
  let sessioneLettaAlle = 0;
  let errori = 0;

  const json = async (percorso) => {
    const r = await scarica(`${API_NERO}${percorso}`, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  async function giro() {
    if (fermato) return;
    let prossimo = intervallo;
    try {
      // La sessione si rilegge ogni minuto: così una nuova live su Nero viene trovata da sola.
      if (!sessione || Date.now() - sessioneLettaAlle > 60_000) {
        const profilo = await json(`/users/${encodeURIComponent(nome)}/profile`);
        sessione = profilo?.liveSession?.isLive ? profilo.liveSession.id : null;
        sessioneLettaAlle = Date.now();
      }
      if (!sessione) {
        suStato({ stato: "attesa", messaggio: `Nessuna sessione live su Nero per ${nome}: riprovo ogni 30 secondi` });
        prossimo = 30_000;
      } else {
        const traccia = tracciaInOnda(await json(`/queue/${sessione}/slim?_t=${Date.now()}`));
        if (fermato) return;
        errori = 0;
        suStato({ stato: "collegato", messaggio: traccia ? `Su Nero suona «${traccia.titolo}» di ${traccia.artista}` : "Collegato a Nero: nessuna traccia in riproduzione" });
        suInOnda(traccia);
      }
    } catch (e) {
      errori++;
      if (errori >= 3) sessione = null;
      suStato({ stato: "attesa", messaggio: `Nero.fan non risponde (${e.message}): riprovo tra 10 secondi` });
      prossimo = 10_000;
    }
    if (!fermato) attesa = setTimeout(giro, prossimo);
  }

  giro();
  return () => {
    fermato = true;
    clearTimeout(attesa);
  };
}
