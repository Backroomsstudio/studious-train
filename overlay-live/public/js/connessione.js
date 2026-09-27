// Connessione WebSocket al server locale, con riconnessione automatica.
// Usata sia dall'overlay (solo ascolto) sia dalla regia (invia comandi).
export function collega({ suStato, suConnessione = () => {}, pin = () => "" }) {
  const indirizzo = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  const inAttesa = new Map();
  let ws;
  let tentativi = 0;
  let scarto = 0;
  let prossimoId = 1;

  function apri() {
    ws = new WebSocket(indirizzo);
    ws.addEventListener("open", () => {
      tentativi = 0;
      suConnessione(true);
    });
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.tipo === "stato") {
        scarto = msg.stato.ora - Date.now();
        suStato(msg.stato, msg.eventi ?? []);
      } else if (msg.tipo === "esito") {
        inAttesa.get(msg.id)?.(msg);
        inAttesa.delete(msg.id);
      }
    });
    ws.addEventListener("close", () => {
      suConnessione(false);
      for (const risolvi of inAttesa.values()) risolvi({ ok: false, errore: "Connessione persa" });
      inAttesa.clear();
      setTimeout(apri, Math.min(5000, 300 * 2 ** tentativi++));
    });
  }
  apri();

  return {
    // Ora del server: countdown e timer restano allineati su tutte le sorgenti.
    ora: () => Date.now() + scarto,
    comando(nome, args = {}) {
      return new Promise((risolvi) => {
        if (ws.readyState !== WebSocket.OPEN) return risolvi({ ok: false, errore: "Server non raggiungibile" });
        const id = prossimoId++;
        inAttesa.set(id, risolvi);
        ws.send(JSON.stringify({ tipo: "comando", id, nome, args, pin: pin() }));
      });
    },
  };
}

export const formatta = (valore, decimali = 1) =>
  valore === null || valore === undefined ? "—" : valore.toFixed(decimali).replace(".", ",");

export function durata(ms) {
  const totale = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totale / 3600);
  const m = Math.floor((totale % 3600) / 60);
  const s = totale % 60;
  const dd = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${dd(m)}:${dd(s)}` : `${dd(m)}:${dd(s)}`;
}
