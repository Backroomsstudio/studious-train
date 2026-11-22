// Anteprima locale del sito come su Netlify: file statici da public/ e /api/* sulle funzioni.
// Uso: BOOKING_DEMO=1 npm run dev   (calendario finto, senza Google)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pub = join(root, "public");
const port = Number(process.env.PORT ?? 8888);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

const routes = {};
for (const name of ["disponibilita", "prenota", "prenota-annulla", "stripe-webhook"]) {
  const mod = await import(pathToFileURL(join(root, "netlify/functions", `${name}.mts`)).href);
  routes[mod.config.path] = mod.default;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const fn = routes[url.pathname];
  if (fn) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await fn(new Request(url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let file = normalize(join(pub, decodeURIComponent(url.pathname)));
  if (!file.startsWith(pub)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(await readFile(join(pub, "404.html")).catch(() => "404"));
  }
}).listen(port, () => console.log(`Anteprima su http://localhost:${port}`));
