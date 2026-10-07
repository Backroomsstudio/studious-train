// Avvio comune delle quattro pagine nuove (drum, produzione, podcast, reaction) e utilità di disegno.
// Parametri URL: ?anteprima=1 (sfondo nero e finti schermi), ?guide=1 (zone dei telefoni, solo verticale),
// ?statico=1 (senza animazioni, per i mockup), ?formato=orizzontale (solo podcast e reaction: 1920×1080).
import { iniettaSimboli } from "./simboli.js";
import { scalaTesto } from "./formati-logica.js";

export const parametri = new URLSearchParams(location.search);
export const STATICO = parametri.has("statico");
export const ORIZZONTALE = parametri.get("formato") === "orizzontale";
const SVG = "http://www.w3.org/2000/svg";

export const $ = (sel, radice = document) => radice.querySelector(sel);

export function nodo(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

export function simbolo(id, classe) {
  const svg = document.createElementNS(SVG, "svg");
  if (classe) svg.setAttribute("class", classe);
  const use = document.createElementNS(SVG, "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

export function logo() {
  return Object.assign(document.createElement("img"), { src: "/assets/logo-br.png", alt: "" });
}

export function rilancia(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth; // forza il riavvio dell'animazione CSS
  el.classList.add(classe);
}

// Riduce il corpo del testo finché non entra nel riquadro (larghezza e altezza).
export function adattaTesto(el, massimo, minimo) {
  let corpo = massimo;
  el.style.fontSize = `${corpo}px`;
  // l'altezza ha una tolleranza: le lettere sporgono di un paio di pixel dalla riga anche quando il testo entra
  while ((el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + corpo * 0.3) && corpo > minimo) {
    corpo -= 2;
    el.style.fontSize = `${corpo}px`;
  }
}

// Un indirizzo (es. backroomsstudio.it) o un account (@backrooms.studios) nella frase resta evidenziato in oro.
const LINK = /(@[a-z0-9_.]+|[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i;
export function scriviConLink(el, testo) {
  el.replaceChildren(
    ...String(testo)
      .split(LINK)
      .map((pezzo, i) => (i % 2 ? nodo("b", "link", pezzo) : pezzo)),
  );
}

// Moneta 3D col logo BR: due facce e un bordo cromato fatto di dischi sovrapposti, così girando ha spessore.
export function costruisciMoneta(el) {
  const corpo = nodo("div", "fm-moneta-corpo");
  for (let z = -3; z <= 3; z++) {
    const bordo = nodo("i", "fm-moneta-bordo");
    bordo.style.transform = `translateZ(${z}px)`;
    corpo.append(bordo);
  }
  for (const lato of ["fronte", "retro"]) {
    const faccia = nodo("div", `fm-moneta-faccia ${lato}`);
    faccia.append(logo());
    corpo.append(faccia);
  }
  el.append(corpo);
}

// Dimensione dei testi scelta in regia: --ts-<gruppo> = percentuale / 100 sul palco (il CSS moltiplica i corpi di base).
export function applicaTesti(palco, testi) {
  for (const [id, valore] of Object.entries(testi ?? {})) palco.style.setProperty(`--ts-${id}`, String(valore / 100));
}
// Lo stesso moltiplicatore, per i testi che la pagina adatta da sé (adattaTesto).
export const ts = scalaTesto;

// Avvio: simboli, classi del body, scala del palco (1080×1920 o 1920×1080), monete [data-moneta]. Drum e produzione
// ignorano ?formato=orizzontale: solo chi lo ammette ha il palco orizzontale.
export function avviaPagina({ orizzontaleAmmesso = false } = {}) {
  const orizzontale = ORIZZONTALE && orizzontaleAmmesso;
  iniettaSimboli();
  document.body.classList.add(orizzontale ? "orizzontale" : "verticale");
  document.body.classList.toggle("anteprima", parametri.has("anteprima"));
  document.body.classList.toggle("statico", STATICO);
  document.body.classList.toggle("guide-attive", parametri.has("guide"));
  const palco = $(".palco");
  const larghezza = orizzontale ? 1920 : 1080;
  const altezza = orizzontale ? 1080 : 1920;
  // La sorgente può avere qualsiasi dimensione: il palco si adatta mantenendo le proporzioni.
  const adattaPalco = () => palco.style.setProperty("--scala", Math.min(innerWidth / larghezza, innerHeight / altezza));
  addEventListener("resize", adattaPalco);
  adattaPalco();
  for (const el of document.querySelectorAll("[data-moneta]")) costruisciMoneta(el);
  // Entrata al caricamento. LIVE Studio può ricaricare la sorgente: rifà solo questa entrata.
  if (!STATICO) {
    palco.classList.add("entrata");
    setTimeout(() => palco.classList.remove("entrata"), 2400);
  }
  return { palco, orizzontale };
}
