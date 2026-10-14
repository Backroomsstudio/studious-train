// Tabellone del battle: torneo a eliminazione (quarti, semifinali, finale) oppure classifica a punti.
// Disegna solo quando cambia qualcosa (lo stato arriva spesso: ogni voto della chat): la firma dei dati dice se serve.
const SVG = "http://www.w3.org/2000/svg";

// Albero in un riquadro di 800×930: ogni partita ha la sua posizione [x, y]; le carte sono 188×112.
const CARTA = { l: 188, a: 112 };
const POS_8 = { q1: [0, 0], q2: [204, 0], q3: [408, 0], q4: [612, 0], s1: [102, 330], s2: [510, 330], f1: [306, 660] };
const POS_4 = { s1: [56, 70], s2: [556, 70], f1: [306, 420] };
const GENITORI = { s1: ["q1", "q2"], s2: ["q3", "q4"], f1: ["s1", "s2"] };
const TITOLI_TURNO = { quarti: "Quarti di finale", semifinali: "Semifinali", finale: "Finale" };

const formatta = (v) => String(v).replace(".", ",");

function nodo(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

function nodoSvg(tag, attributi = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
  return el;
}

function trofeo(classe) {
  const svg = nodoSvg("svg", { class: classe });
  svg.append(nodoSvg("use", { href: "#ic-trofeo" }));
  return svg;
}

function intestazione(titolo, dettaglio) {
  const testa = nodo("header", "bt-tab-testa");
  testa.append(nodo("h2", "cromo", titolo), nodo("span", "etichetta", dettaglio));
  return testa;
}

export function disegnaTabellone(radice, battle) {
  const t = battle.tabellone;
  const firma = JSON.stringify([t, battle.partitaId, battle.sx.nome, battle.dx.nome, battle.round]);
  if (radice.dataset.firma === firma) return;
  radice.dataset.firma = firma;
  radice.classList.toggle("a-punti", t.modo === "punti");
  if (t.modo === "torneo") radice.replaceChildren(intestazione("Torneo", `Round ${battle.round}`), albero(t.torneo, battle.partitaId));
  else radice.replaceChildren(intestazione("Classifica", `Target ${t.punti.target} punti`), classifica(t.punti, battle));
}

// ---------- Torneo ----------

function carta(p, [x, y], inCampo) {
  const el = nodo("div", `bt-carta${inCampo ? " in-campo" : ""}${p.vincitore ? " giocata" : ""}`);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  for (const lato of ["sx", "dx"]) {
    const persona = p[lato];
    const riga = nodo("div", `bt-carta-riga ${lato}${p.vincitore === lato ? " vince" : ""}${persona ? "" : " ignoto"}`);
    riga.append(nodo("span", "bt-carta-nome", persona?.nome ?? "—"), nodo("b", "", p.totali ? formatta(p.totali[lato]) : ""));
    el.append(riga);
  }
  return el;
}

function collegamenti(partite, pos) {
  const svg = nodoSvg("svg", { class: "bt-collegamenti", viewBox: "0 0 800 930", width: "800", height: "930" });
  for (const p of partite) {
    for (const idGenitore of GENITORI[p.id] ?? []) {
      const genitore = partite.find((x) => x.id === idGenitore);
      if (!genitore || !pos[genitore.id] || !pos[p.id]) continue;
      const [gx, gy] = pos[genitore.id];
      const [px, py] = pos[p.id];
      const [x1, y1, x2, y2] = [gx + CARTA.l / 2, gy + CARTA.a, px + CARTA.l / 2, py];
      const ym = (y1 + y2) / 2;
      svg.append(nodoSvg("path", { d: `M${x1} ${y1} V${ym} H${x2} V${y2}`, class: genitore.vincitore ? "fatto" : "" }));
    }
  }
  return svg;
}

function albero(torneo, partitaId) {
  const div = nodo("div", "bt-albero");
  if (!torneo.partite.length) {
    div.append(nodo("p", "bt-vuoto", "Torneo non ancora creato"));
    return div;
  }
  const pos = torneo.partite.some((p) => p.id === "q1") ? POS_8 : POS_4;
  div.append(collegamenti(torneo.partite, pos));
  const visti = new Set();
  for (const p of torneo.partite) {
    if (!visti.has(p.turno)) {
      visti.add(p.turno);
      const titolo = nodo("div", p.turno === "finale" ? "bt-turno lato" : "bt-turno", TITOLI_TURNO[p.turno]);
      // La finale ha il raccordo che arriva da sopra: la sua etichetta sta a destra della carta.
      titolo.style.top = p.turno === "finale" ? `${pos[p.id][1] + 44}px` : `${pos[p.id][1] - 34}px`;
      if (p.turno === "finale") titolo.style.left = `${pos[p.id][0] + CARTA.l + 24}px`;
      div.append(titolo);
    }
    div.append(carta(p, pos[p.id], p.id === partitaId));
  }
  const [fx, fy] = pos.f1;
  const coppa = trofeo(`bt-trofeo${torneo.campione ? " vinto" : ""}`);
  coppa.style.left = `${fx - 100}px`;
  coppa.style.top = `${fy + 18}px`;
  div.append(coppa);
  if (torneo.campione) {
    const banner = nodo("div", "bt-campione");
    banner.style.top = `${fy + CARTA.a + 28}px`;
    banner.append(nodo("span", "etichetta", "Campione"), nodo("b", "", torneo.campione.nome));
    div.append(banner);
  }
  return div;
}

// ---------- Classifica a punti ----------

const MEDAGLIE = ["primo", "secondo", "terzo"];

function riga(a, posizione, punti, inCampo) {
  const el = nodo("div", `bt-riga-punti${MEDAGLIE[posizione] ? ` ${MEDAGLIE[posizione]}` : ""}${punti.vincitore === a.nome ? " vincitore" : ""}${inCampo ? " in-campo" : ""}`);
  const nome = nodo("div", "bt-art-nome", a.nome);
  if (inCampo) nome.append(nodo("i", "bt-tag", "In campo"));
  const barra = nodo("div", "bt-barra-target");
  barra.append(nodo("i"));
  barra.firstChild.style.setProperty("--p", Math.min(1, a.punti / punti.target));
  const turni = nodo("div", "bt-chips-round");
  for (const v of a.round.slice(-5)) turni.append(nodo("span", "", formatta(v)));
  const centro = nodo("div", "bt-art-centro");
  centro.append(nome, barra, turni);
  el.append(nodo("span", "bt-pos", String(posizione + 1)), centro, nodo("b", "bt-totale", formatta(a.punti)));
  return el;
}

function classifica(punti, battle) {
  const div = nodo("div", "bt-punti");
  if (!punti.artisti.length) {
    div.append(nodo("p", "bt-vuoto", "Classifica non ancora creata"));
    return div;
  }
  if (punti.vincitore) div.append(nodo("div", "bt-vince", `Vince ${punti.vincitore}`));
  const inCampo = new Set([battle.sx.nome, battle.dx.nome].filter(Boolean).map((n) => n.toLowerCase()));
  const ordinati = [...punti.artisti].sort((a, b) => b.punti - a.punti || a.nome.localeCompare(b.nome));
  ordinati.forEach((a, i) => div.append(riga(a, i, punti, inCampo.has(a.nome.toLowerCase()))));
  return div;
}
