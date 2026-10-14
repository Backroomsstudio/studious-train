// Tabellone ad albero della gara: disegna in un riquadro (DOM e SVG, con le posizioni calcolate dalla sua misura) l'albero di
// lib/albero.mjs. Rami in orizzontale, un turno per colonna da sinistra a destra, il vincitore di ogni partita in oro e il
// trofeo dopo la finale. È solo un disegno della classifica. Nessun dato entra come HTML: i testi passano da textContent.
import { formatta } from "./connessione.js";
import { adattaTesto, nodo, simbolo } from "./pagina.js";

const SVG = "http://www.w3.org/2000/svg";
const MARGINE = 20; // dal bordo del riquadro
const ALTO_TESTA = 64; // titolo e numero dei partecipanti
const ALTO_NOMI = 28; // nomi dei turni sopra le colonne
const ALTO_PIEDE = 38; // «+N fuori dal tabellone»
const SPAZIO_RAMI = 26; // tra una colonna e l'altra, dove passano i rami
const LARGO_TROFEO = 132; // l'ultima colonna: trofeo e campione
const ALTO_LATO_MAX = 62; // un lato è una riga con titolo, artista e punti: con pochi partecipanti non si allunga oltre
const ALTO_LATO_MIN = 34;

const svg = (tag, attributi = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, v);
  return e;
};
const posiziona = (e, x, y, w, h) => Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });

// Un lato di una partita: titolo, artista e punti; vuoto (posto senza nessuno) se `lato` è null. `vince` lo evidenzia in oro.
function creaLato(lato, vince, corpi) {
  const el = nodo("div", `alb-lato${lato ? "" : " vuoto"}${vince ? " vince" : ""}`);
  if (!lato) {
    el.append(nodo("span", "alb-vuoto-segno", "—"));
    return el;
  }
  const testi = nodo("div", "alb-testi");
  const titolo = nodo("div", "alb-titolo", lato.titolo);
  const artista = nodo("div", "alb-artista", lato.artista);
  Object.assign(titolo.style, { fontSize: `${corpi.titolo}px`, height: `${corpi.altoTitolo}px` });
  Object.assign(artista.style, { fontSize: `${corpi.artista}px`, height: `${corpi.altoArtista}px` });
  testi.append(titolo, artista);
  const punti = nodo("div", "alb-punti", formatta(lato.totale, 2));
  punti.style.fontSize = `${corpi.punti}px`;
  el.append(testi, punti);
  return el;
}

// Disegna `disegno` (il risultato di costruisciAlbero, o null) nel riquadro `radice`. Con `animato` i turni entrano uno dopo
// l'altro (0,5 s ciascuno); senza, compare tutto subito (ridisegno quando la classifica cambia, o ?statico=1).
export function disegnaAlbero(radice, disegno, { animato = false } = {}) {
  radice.replaceChildren();
  radice.classList.toggle("alb-anima", animato);
  const partecipanti = disegno ? disegno.turni[0].partite.reduce((n, p) => n + (p.a ? 1 : 0) + (p.b ? 1 : 0), 0) : 0;

  const testa = nodo("header", "alb-testa");
  testa.append(nodo("h2", "cl-titolo cromo luccica", "Tabellone"));
  if (disegno) {
    const conto = nodo("span", "cl-top");
    conto.append(nodo("b", "", String(partecipanti)), " in gara");
    testa.append(conto);
  }
  radice.append(testa);
  if (!disegno) {
    radice.append(nodo("p", "alb-vuoto-nota", "Servono almeno 2 tracce confermate"));
    return;
  }

  const largo = radice.clientWidth;
  const alto = radice.clientHeight;
  if (!largo || !alto) return; // nascosto con ?w=: niente da misurare
  const corpoY = ALTO_TESTA + ALTO_NOMI;
  const corpoLargo = largo - 2 * MARGINE;
  const corpoAlto = alto - corpoY - ALTO_PIEDE;
  const turni = disegno.turni;
  const R = turni.length;
  const colonna = (corpoLargo - LARGO_TROFEO - R * SPAZIO_RAMI) / R; // larghezza di una colonna di partite
  const fetta = corpoAlto / turni[0].partite.length; // lo spazio di una partita del primo turno
  const altoLato = Math.max(ALTO_LATO_MIN, Math.min(ALTO_LATO_MAX, fetta / 2 - 3));
  const altoPartita = altoLato * 2;
  const corpi = {
    titolo: Math.round(altoLato * 0.34),
    artista: Math.round(altoLato * 0.25),
    punti: Math.round(altoLato * 0.4),
  };
  corpi.altoTitolo = Math.round(corpi.titolo * 1.3);
  corpi.altoArtista = Math.round(corpi.artista * 1.3);

  // Centro verticale di ogni partita: nel primo turno una sopra l'altra, poi a metà tra le due che la alimentano.
  const centri = [turni[0].partite.map((_, k) => fetta * (k + 0.5))];
  for (let r = 1; r < R; r++) centri.push(turni[r].partite.map((_, k) => (centri[r - 1][2 * k] + centri[r - 1][2 * k + 1]) / 2));
  const xTurno = (r) => MARGINE + r * (colonna + SPAZIO_RAMI);

  const corpo = nodo("div", "alb-corpo");
  Object.assign(corpo.style, { left: "0", top: `${corpoY}px`, width: "100%", height: `${corpoAlto}px` });
  const rami = svg("svg", { class: "alb-rami", width: String(largo), height: String(corpoAlto), viewBox: `0 0 ${largo} ${corpoAlto}` });
  corpo.append(rami);

  turni.forEach((turno, r) => {
    const nome = nodo("div", "alb-nome-turno", turno.nome);
    nome.style.setProperty("--turno", r);
    posiziona(nome, xTurno(r), ALTO_TESTA, colonna, ALTO_NOMI);
    radice.append(nome);
    turno.partite.forEach((partita, k) => {
      const el = nodo("div", "alb-partita");
      el.style.setProperty("--turno", r);
      posiziona(el, xTurno(r), centri[r][k] - altoLato, colonna, altoPartita);
      el.append(creaLato(partita.a, partita.vince === "a", corpi), creaLato(partita.b, partita.vince === "b", corpi));
      corpo.append(el);
      // il ramo verso il turno dopo: esce a metà della partita, scende o sale fino alla riga giusta della partita successiva
      if (r < R - 1) {
        const x0 = xTurno(r) + colonna;
        const yDestinazione = centri[r + 1][k >> 1] + (k % 2 ? altoLato / 2 : -altoLato / 2);
        const ramo = svg("path", { class: "alb-ramo", d: `M${x0} ${centri[r][k]}H${x0 + SPAZIO_RAMI / 2}V${yDestinazione}H${x0 + SPAZIO_RAMI}` });
        ramo.style.setProperty("--turno", r + 1);
        rami.append(ramo);
      }
    });
  });

  // Dopo la finale: il trofeo e, sotto, chi ha vinto.
  const finale = turni[R - 1].partite[0];
  const campione = finale.vince ? finale[finale.vince] : null;
  const xTrofeo = xTurno(R - 1) + colonna;
  const yFinale = centri[R - 1][0];
  rami.append(svg("path", { class: "alb-ramo", d: `M${xTrofeo} ${yFinale}H${xTrofeo + SPAZIO_RAMI}`, style: `--turno: ${R}` }));
  const trofeo = nodo("div", "alb-campione");
  trofeo.style.setProperty("--turno", R);
  posiziona(trofeo, xTrofeo + SPAZIO_RAMI, yFinale - 70, LARGO_TROFEO, 140);
  trofeo.append(simbolo("trofeo", "alb-trofeo"));
  if (campione) {
    const titolo = nodo("div", "alb-campione-titolo", campione.titolo);
    trofeo.append(titolo, nodo("div", "alb-campione-punti", formatta(campione.totale, 2)));
  }
  corpo.append(trofeo);
  radice.append(corpo);

  if (disegno.esclusi > 0) radice.append(nodo("div", "alb-piede", `+${disegno.esclusi} fuori dal tabellone`));

  // Con gli elementi nel documento si misurano i testi: il corpo più grande che entra, tra quello di partenza e 11 px.
  for (const titolo of radice.querySelectorAll(".alb-titolo")) adattaTesto(titolo, corpi.titolo, 11);
  for (const artista of radice.querySelectorAll(".alb-artista")) adattaTesto(artista, corpi.artista, 10);
  for (const nome of radice.querySelectorAll(".alb-nome-turno")) adattaTesto(nome, 14, 9);
  for (const titolo of radice.querySelectorAll(".alb-campione-titolo")) adattaTesto(titolo, 20, 11);
}
