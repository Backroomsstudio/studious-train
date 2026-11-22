// Costruisce la demo navigabile in una sola pagina HTML (+ immagini) nella cartella indicata.
// Uso: node scripts/build-demo.mjs <cartella-di-uscita>
import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = process.argv[2] ?? join(root, "demo-out");
await mkdir(join(out, "img"), { recursive: true });
await mkdir(join(out, "brand"), { recursive: true });

const js = (await build({ entryPoints: [join(root, "src/prenota/demo.ts")], bundle: true, minify: true, format: "iife", target: "es2019", write: false })).outputFiles[0].text;
const css = (
  await Promise.all(["public/css/main.css", "public/css/fx.css", "public/css/prenota.css", "src/prenota/demo.css"].map((f) => readFile(join(root, f), "utf8")))
)
  .join("\n")
  .replace(/@font-face\{[^}]*\}/g, "")
  .replace(/url\(\.\.\/img\//g, "url(img/");

const page = await readFile(join(root, "public/prenota/index.html"), "utf8");
const body = page
  .slice(page.indexOf('<header class="hdr'), page.indexOf("</footer>") + "</footer>".length)
  .replace(/href="\/"/g, 'href="https://backroomsstudio.it/" target="_blank" rel="noopener"')
  .replace(/href="\/(privacy|termini)\/"/g, 'href="https://backroomsstudio.it/$1/" target="_blank" rel="noopener"')
  .replace(/src="\/brand\//g, 'src="brand/')
  .replace('<a href="https://backroomsstudio.it/" target="_blank" rel="noopener">Backrooms Studio</a> / <span>Prenota</span>', '<a href="https://backroomsstudio.it/" target="_blank" rel="noopener">Backrooms Studio</a> / <span>Prenota · demo</span>');

const html = `<title>Prenota Backrooms Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500..900&family=Montserrat:wght@400..900&display=swap">
<style>
${css}
</style>
<div class="svc-page">
${body}
</div>
<script>
${js.replace(/<\/script/gi, "<\\/script")}
</script>
`;
await writeFile(join(out, "index.html"), html);
await copyFile(join(root, "public/img/bg-silver.webp"), join(out, "img/bg-silver.webp"));
await copyFile(join(root, "public/brand/logo-silver-120.webp"), join(out, "brand/logo-silver-120.webp"));
console.log(`Demo pronta in ${out} (${Math.round(html.length / 1024)} KB)`);
