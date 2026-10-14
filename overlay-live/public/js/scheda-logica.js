// La scheda «Ora in ascolto» e lo spot dello studio nel layout senza premio, come macchina a stati pura (niente DOM, niente timer):
// la pagina manda gli eventi, la funzione dà il nuovo stato e le azioni da eseguire, e i timer li fa la pagina (azione «programma»).
//
// stato:  { traccia, mostrataId, aperta: null | "ascolto" | "spot" | "uscita", dopoUscita: null | "spot" | "rientro", nascosta, token }
// eventi: traccia { traccia: { id, tier, titolo, artista, instagram } } · spot · scadenza { token } · nascondi · mostra · uscita-finita { token }
// azioni: entra-ascolto { traccia, cambia } · aggiorna-ascolto { traccia } · entra-spot · esce · programma { quando, evento, token }
// Un evento «scadenza» o «uscita-finita» con un token che non è l'ultimo programmato viene ignorato (timer vecchi).
// Con `schedaFissa` la traccia resta finché suona; senza, scade dopo i secondi del suo tipo (`durate`, standard per chi non ha tipo).

export const creaSchedaVuota = () => ({ traccia: null, mostrataId: null, aperta: null, dopoUscita: null, nascosta: false, token: 0 });

export function prossimaScheda(prima, evento, ora, { schedaFissa = true, durate = {}, durataSpotMs = 10_000, uscitaMs = 500 } = {}) {
  const stato = { ...prima };
  const azioni = [];
  const programma = (ms, nome) => {
    stato.token = prima.token + 1 + azioni.filter((a) => a.tipo === "programma").length;
    azioni.push({ tipo: "programma", quando: ora + ms, evento: nome, token: stato.token });
  };
  const secondiDi = (t) => durate[t?.tier] ?? durate.standard ?? 8;
  const entraAscolto = (cambia) => {
    azioni.push({ tipo: "entra-ascolto", traccia: stato.traccia, cambia });
    stato.aperta = "ascolto";
    stato.mostrataId = stato.traccia.id;
    if (!schedaFissa) programma(secondiDi(stato.traccia) * 1000, "scadenza");
  };
  const entraSpot = () => {
    azioni.push({ tipo: "entra-spot" });
    stato.aperta = "spot";
    programma(durataSpotMs, "scadenza");
  };
  const scende = (dopo) => {
    azioni.push({ tipo: "esce" });
    stato.aperta = "uscita";
    stato.dopoUscita = dopo;
    programma(uscitaMs, "uscita-finita");
  };
  const esce = () => {
    azioni.push({ tipo: "esce" });
    stato.aperta = null;
    stato.dopoUscita = null;
    stato.token = prima.token + 1; // niente timer in giro per una scheda che non c'è più
  };
  const ricevuto = () => evento.token === prima.token;

  switch (evento.tipo) {
    case "traccia": {
      const t = evento.traccia;
      if (!t || !String(t.titolo ?? "").trim()) {
        stato.traccia = null;
        if (stato.aperta === "ascolto") esce();
        break;
      }
      const stessa = prima.traccia?.id === t.id;
      stato.traccia = { id: t.id, tier: t.tier ?? null, titolo: t.titolo, artista: t.artista ?? "", instagram: t.instagram ?? "" };
      if (stessa) {
        if (stato.aperta === "ascolto") azioni.push({ tipo: "aggiorna-ascolto", traccia: stato.traccia });
      } else if (!stato.nascosta && (stato.aperta === null || stato.aperta === "ascolto")) {
        entraAscolto(stato.aperta === "ascolto");
      }
      break;
    }
    case "spot":
      if (stato.nascosta || stato.aperta === "spot" || stato.aperta === "uscita") break;
      if (stato.aperta === "ascolto") scende("spot");
      else entraSpot();
      break;
    case "scadenza":
      if (!ricevuto()) break;
      if (stato.aperta === "ascolto") esce();
      else if (stato.aperta === "spot") scende("rientro");
      break;
    case "uscita-finita": {
      if (!ricevuto() || stato.aperta !== "uscita") break;
      const dopo = stato.dopoUscita;
      stato.aperta = null;
      stato.dopoUscita = null;
      if (dopo === "spot") entraSpot();
      else if (stato.traccia && !stato.nascosta && (schedaFissa || stato.traccia.id !== stato.mostrataId)) entraAscolto(false);
      break;
    }
    case "nascondi":
      stato.nascosta = true;
      if (stato.aperta !== null) esce();
      stato.token = prima.token + 1;
      break;
    case "mostra":
      stato.nascosta = false;
      if (stato.aperta === null && stato.traccia) entraAscolto(false);
      break;
    default:
      break;
  }
  return { stato, azioni };
}
