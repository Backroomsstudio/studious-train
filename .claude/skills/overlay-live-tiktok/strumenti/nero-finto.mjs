// Nero.fan finto, con le stesse risposte (ridotte) di api.nero.fan, per provare la traccia automatica senza internet.
// node nero-finto.mjs [porta=4999] [username=backrooms]
// Poi: NERO_API=http://127.0.0.1:4999 node server.mjs
// Cambiare la traccia in onda: curl "http://127.0.0.1:4999/cambia?titolo=Asfalto&artista=Dama&tier=throne"
// Spegnere la sessione live: curl "http://127.0.0.1:4999/spegni"
import http from "node:http";

const porta = Number(process.argv[2] ?? 4999);
const username = process.argv[3] ?? "backrooms";
let corrente = null;
let live = true;
let n = 0;
http
  .createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const json = (d) => (res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(d)));
    if (u.pathname === `/users/${username}/profile`) return json({ username, liveSession: live ? { id: "sessione-1", isLive: true } : null });
    if (u.pathname === "/queue/sessione-1/slim") return json({ queue: [], current: corrente, meta: { queueCount: 0 } });
    if (u.pathname === "/cambia") {
      live = true;
      corrente = {
        streamSubmissionId: `sub-${++n}`,
        submissionName: u.searchParams.get("titolo") ?? `Traccia ${n}`,
        submitterName: u.searchParams.get("artista") ?? "Artista",
        tier: u.searchParams.get("tier") ?? "standard",
        status: "current",
      };
      return json(corrente);
    }
    if (u.pathname === "/spegni") return (live = false), json({ live });
    res.writeHead(404).end();
  })
  .listen(porta, "127.0.0.1", () => console.log(`Nero finto su http://127.0.0.1:${porta} (utente ${username})`));
