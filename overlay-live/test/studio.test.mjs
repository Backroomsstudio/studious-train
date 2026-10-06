import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../lib/stato.mjs";
import { vociStudio, richiesteComparsa, prossimaComparsa } from "../public/js/studio-logica.js";
import { suonaIn } from "../public/js/eventi-sonori.js";

const config = { giudici: { beat: "A", voce: "B", mix: "C" }, pesi: { beat: 1, voce: 1, mix: 1, chat: 1 }, topN: 3, premio: "Mix" };
const foto = (stato, ora = 0) => structuredClone(S.istantanea(stato, config, ora));

function statoStudio() {
  const stato = S.statoIniziale(config);
  S.impostaLayout(stato, "studio");
  return stato;
}

test("partenza: targa vuota, due comparse dello studio, parti in onda", () => {
  const stato = S.statoIniziale(config);
  assert.deepEqual(stato.studio, S.studioIniziale());
  const st = stato.studio;
  assert.equal(st.etichetta, "Live session in studio");
  assert.deepEqual([st.artista, st.instagram], ["", ""]);
  assert.deepEqual(st.comparse.map((c) => c.titolo), ["Vieni a trovarci in studio", "Scrivici in DM"]);
  assert.ok(st.comparse[1].sotto.includes("prenotare"));
  for (const parte of ["targa", "barraStudio", "comparse"]) assert.equal(stato.visibili[parte], true);
  assert.equal(S.istantanea(stato, config, 0).studio, stato.studio);
});

test("layout studio: si sceglie dalla regia ed è il terzo della tendina", () => {
  const stato = S.statoIniziale(config);
  S.impostaLayout(stato, "studio");
  assert.equal(stato.layout, "studio");
  assert.deepEqual(S.LAYOUT, ["gara", "senzaPremio", "studio"]);
});

test("Instagram: @nome, nome o link del profilo diventano il nome pulito", () => {
  for (const [scritto, atteso] of [
    ["@lince.music", "lince.music"],
    ["  lince_music ", "lince_music"],
    ["https://www.instagram.com/lince.music/?hl=it", "lince.music"],
    ["instagram.com/lince", "lince"],
    ["", ""],
  ]) {
    assert.equal(S.pulisciInstagram(scritto), atteso, scritto);
  }
  assert.throws(() => S.pulisciInstagram("nome con spazi"), /solo lettere/);
  assert.throws(() => S.pulisciInstagram("x".repeat(31)), /30 caratteri/);
  assert.throws(() => S.pulisciInstagram(42), /serve un testo/);
});

test("targa dalla regia: nome e Instagram, controllati prima di applicarli", () => {
  const stato = statoStudio();
  S.impostaStudio(stato, { artista: "  Lince ", instagram: "@lince.music" });
  assert.deepEqual([stato.studio.artista, stato.studio.instagram], ["Lince", "lince.music"]);
  const prima = structuredClone(stato.studio);
  assert.throws(() => S.impostaStudio(stato, { artista: "Kappa 23", instagram: "non valido!" }));
  assert.deepEqual(stato.studio, prima, "una parte sbagliata: non cambia niente");
  assert.throws(() => S.impostaStudio(stato, { artista: "x".repeat(33) }), /32 caratteri/);
  S.impostaStudio(stato, { artista: "", instagram: "" });
  assert.equal(stato.studio.artista, "");
});

test("comparse: icona nota, titolo per quelle accese, al massimo 8", () => {
  const stato = statoStudio();
  const comparse = [...stato.studio.comparse, { attiva: true, icona: "whatsapp", titolo: "Prenota la tua sessione", sotto: "backroomsstudio.it" }];
  S.impostaStudio(stato, { comparse });
  assert.equal(stato.studio.comparse.length, 3);
  assert.ok(stato.studio.comparse[2].id, "una comparsa nuova riceve un id");
  assert.equal(stato.studio.comparse[2].sopra, "");
  assert.throws(() => S.impostaStudio(stato, { comparse: [{ icona: "fax", titolo: "x" }] }), /icona sconosciuta/);
  assert.throws(() => S.impostaStudio(stato, { comparse: [{ icona: "dm", titolo: "" }] }), /manca il titolo/);
  S.impostaStudio(stato, { comparse: [{ icona: "dm", titolo: "", sopra: "bozza", attiva: false }] });
  const nove = Array.from({ length: 9 }, (_, i) => ({ icona: "sito", titolo: `c ${i}` }));
  assert.throws(() => S.impostaStudio(stato, { comparse: nove }), /al massimo 8/);
  assert.throws(() => S.impostaStudio(stato, { comparse: "x" }), /serve l'elenco/);
  for (const sbagliata of [{ comparsaOgniMinuti: 31 }, { durataComparsa: 3 }, { velocita: 200 }, { artistaNellaBarra: "no" }, { etichetta: 5 }]) {
    assert.throws(() => S.impostaStudio(stato, sbagliata), Error, JSON.stringify(sbagliata));
  }
});

test("stato salvato prima della live session o con valori rotti", () => {
  assert.deepEqual(S.fondiStudio(undefined), S.studioIniziale());
  const fuso = S.fondiStudio({ artista: "Lince", instagram: "brutto nome", velocita: 120, comparse: "x", durataComparsa: 99 });
  assert.equal(fuso.artista, "Lince");
  assert.equal(fuso.instagram, "");
  assert.equal(fuso.velocita, 120);
  assert.deepEqual(fuso.comparse, S.studioIniziale().comparse);
  assert.equal(fuso.durataComparsa, S.studioIniziale().durataComparsa);
});

test("barra: i social di senza premio con l'artista in studio dopo il primo", () => {
  const stato = statoStudio();
  let voci = vociStudio(foto(stato));
  assert.ok(voci.every((v) => v.tipo === "social"));
  assert.equal(voci.length, stato.senzaPremio.voci.length);
  S.impostaStudio(stato, { artista: "Lince", instagram: "lince.music" });
  voci = vociStudio(foto(stato));
  assert.equal(voci[1].tipo, "artista");
  assert.deepEqual([voci[1].testo, voci[1].instagram], ["Lince", "@lince.music"]);
  S.impostaStudio(stato, { artistaNellaBarra: false });
  assert.ok(vociStudio(foto(stato)).every((v) => v.tipo === "social"));
});

test("comparse chieste dalla regia; niente al primo disegno o con le comparse spente", () => {
  const stato = statoStudio();
  const s = foto(stato);
  const eventi = [{ nome: "comparsa", dati: { id: "dm" } }, { nome: "comparsa", dati: {} }];
  assert.deepEqual(richiesteComparsa(null, s, eventi), []);
  assert.deepEqual(richiesteComparsa(s, s, eventi), ["dm", null]);
  stato.visibili.comparse = false;
  assert.deepEqual(richiesteComparsa(s, foto(stato), eventi), []);
});

test("giro delle comparse: a turno, salta le spente, una scelta si mostra anche se spenta", () => {
  const comparse = [
    { id: "a", attiva: true },
    { id: "b", attiva: false },
    { id: "c", attiva: true },
  ];
  assert.equal(prossimaComparsa(comparse).id, "a");
  assert.equal(prossimaComparsa(comparse, "a").id, "c");
  assert.equal(prossimaComparsa(comparse, "c").id, "a");
  assert.equal(prossimaComparsa(comparse, "b").id, "c", "l'ultima è stata spenta: si continua da quella dopo");
  assert.equal(prossimaComparsa(comparse, "tolta").id, "a");
  assert.equal(prossimaComparsa(comparse, "a", "b").id, "b");
  assert.equal(prossimaComparsa(comparse, null, "zz"), null);
  assert.equal(prossimaComparsa([{ id: "x", attiva: false }]), null);
});

test("live session in studio: nessuna pagina suona e la traccia di Nero non aspetta voti", () => {
  const stato = statoStudio();
  const s = foto(stato);
  for (const layout of ["gara", "senzaPremio"]) {
    for (const dove of ["overlay", "regia"]) assert.equal(suonaIn({ ...s, suoni: { dove } }, layout, dove), false);
  }
  S.impostaVoto(stato, { categoria: "beat", valore: 8 });
  S.tracciaDaNero(stato, { neroId: "n1", titolo: "Asfalto", artista: "Dama" }, { ora: 0, attesaMs: 10_000 });
  assert.equal(stato.corrente.titolo, "Asfalto");
});
