// Server locale per i test: /.netlify/functions/<nome> chiama la function, /cassa serve la pagina.
// Uso: npm run sistema:dev  → http://localhost:8888
import http from "node:http";
import { readFile } from "node:fs/promises";

const PORTA = 8888;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORTA}`);
    try {
      const m = url.pathname.match(/^\/\.netlify\/functions\/([\w-]+)$/);
      if (m) {
        const mod = await import(`../netlify/functions/${m[1]}.mts`);
        const pezzi: Buffer[] = [];
        for await (const c of req) pezzi.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        const risposta: Response = await mod.default(
          new Request(url, {
            method: req.method,
            headers,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(pezzi),
          }),
          {},
        );
        res.writeHead(risposta.status, Object.fromEntries(risposta.headers));
        res.end(Buffer.from(await risposta.arrayBuffer()));
        console.log(`${req.method} ${url.pathname} → ${risposta.status}`);
        return;
      }
      if (url.pathname === "/cassa") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(await readFile(new URL("../public/cassa.html", import.meta.url)));
        return;
      }
      res.writeHead(404).end("non trovato");
    } catch (e) {
      console.error(e);
      res.writeHead(500).end(String((e as Error).message));
    }
  })
  .listen(PORTA, () => console.log(`Server di test su http://localhost:${PORTA}`));
