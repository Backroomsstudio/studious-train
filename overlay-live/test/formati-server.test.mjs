// Prove con un server vero per Drum, Studio Production, Back Rooms Podcast e Reaction Release.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { avviaServer } from "./aiuti-server.mjs";

const dormi = (ms) => new Promise((ok) => setTimeout(ok, ms));

let srv;
let ws;

before(async () => {
  srv = await avviaServer();
  ws = await srv.apriWs();
});

after(async () => {
  ws?.chiudi();
  await srv?.ferma();
});

// Esegue `fn` e ridà gli eventi arrivati alla pagina nel frattempo (i messaggi di stato partono ogni 50 ms: prima si
// lascia partire quelli dei comandi precedenti, così non finiscono nel conto).
async function eventiDi(fn) {
  await dormi(100);
  const prima = ws.eventi.length;
  await fn();
  await dormi(150);
  return ws.eventi.slice(prima);
}
const sblocchi = (eventi) => eventi.filter((e) => e.nome === "sbloccoDrum").map((e) => e.dati);

test("e2e: stato di partenza dei quattro layout", async () => {
  const s = await srv.statoCorrente();
  assert.equal(s.drum.contati, 0);
  assert.equal(s.drum.attiva, 0);
  assert.equal(s.drum.progresso, 0);
  assert.equal(s.drum.scaletta.length, 37);
  assert.equal(s.produzione.titolo.testo, "Cooking Beats");
  assert.equal(s.reaction.titolo.testo, "REACTION RELEASE DELLA SETTIMANA");
  assert.equal(s.podcast.tematiche.elenco.length, 0);
  assert.equal(s.visibili.poLinea, false);
  assert.equal(s.visibili.drumBarra, true);
  const primo = ws.messaggi.find((m) => m.tipo === "stato");
  assert.equal(primo.stato.drum.scaletta.length, 37, "anche a chi si collega dopo");
});

test("e2e: i Like sbloccano le tappe", async () => {
  assert.equal((await srv.api("layout", { nome: "drum" })).ok, true);
  let eventi = await eventiDi(() => srv.api("likeEvento", { totale: 800 }));
  assert.equal((await srv.statoCorrente()).drum.contati, 800);
  assert.deepEqual(sblocchi(eventi), [], "sotto la prima tappa nessun sblocco");

  eventi = await eventiDi(() => srv.api("likeEvento", { totale: 1200 }));
  assert.deepEqual(sblocchi(eventi), [{ indice: 0, like: 1000, titolo: "" }]);

  assert.equal((await srv.api("drumScaletta", { testo: "1000 | Uno\n2000 | Due" })).ok, true);
  const scaletta = (await srv.statoCorrente()).drum.scaletta;
  assert.deepEqual(scaletta, [{ like: 1000, titolo: "Uno" }, { like: 2000, titolo: "Due" }]);

  eventi = await eventiDi(() => srv.api("drumLike", { imposta: 2500 }));
  assert.deepEqual(sblocchi(eventi), [{ indice: 1, like: 2000, titolo: "Due" }]);
  assert.equal((await srv.statoCorrente()).drum.contati, 2500);

  eventi = await eventiDi(() => srv.api("drumLike", { daOra: true }));
  const dopo = (await srv.statoCorrente()).drum;
  assert.deepEqual([dopo.contati, dopo.annunciati], [0, 0]);
  assert.deepEqual(sblocchi(eventi), [], "ripartire da zero non sblocca nulla");

  assert.equal((await srv.api("drumScaletta", { predefinita: true })).ok, true);
  const ripristinata = (await srv.statoCorrente()).drum.scaletta;
  assert.equal(ripristinata.length, 37);
  assert.deepEqual([ripristinata[0].titolo, ripristinata[1].titolo], ["Uno", "Due"], "la scaletta di partenza tiene i titoli");
});

test("e2e: la simulazione dei Like controlla i dati", async () => {
  const prima = (await srv.statoCorrente()).drum.like;
  for (const rotto of [{}, { totale: "tanti" }, { totale: -5 }, { conteggio: 0 }, { conteggio: "x" }, { totale: 1e15 }]) {
    const r = await srv.api("likeEvento", rotto);
    assert.equal(r.stato, 400, JSON.stringify(rotto));
  }
  assert.deepEqual((await srv.statoCorrente()).drum.like, prima, "una simulazione sbagliata non cambia nulla");
  assert.equal((await srv.api("likeEvento", { totale: 1250.7 })).ok, true);
  assert.equal((await srv.statoCorrente()).drum.like.tiktokTotale, 1251, "i totali sono interi");
  assert.equal((await srv.api("likeEvento", { conteggio: 49 })).ok, true);
  assert.equal((await srv.statoCorrente()).drum.like.tiktokTotale, 1300, "senza totale si somma il conteggio");
});

test("e2e: errori chiari", async () => {
  const scalettaPrima = (await srv.statoCorrente()).drum.scaletta;
  const storta = await srv.api("drumScaletta", { testo: "1000\n500" });
  assert.equal(storta.stato, 400);
  assert.match(storta.errore, /Riga 2/);
  assert.deepEqual((await srv.statoCorrente()).drum.scaletta, scalettaPrima, "la scaletta non cambia");

  const senzaNulla = await srv.api("drumLike", {});
  assert.equal(senzaNulla.stato, 400);
  assert.match(senzaNulla.errore, /imposta, aggiungi o daOra/);
  assert.equal((await srv.api("drumBrano", { daIndice: 30 })).stato, 400);
  assert.equal((await srv.api("podcastTematica", { avanti: true })).stato, 400, "senza tematiche");
  const formato = await srv.api("formatoTesti", { formato: "boh" });
  assert.equal(formato.stato, 400);
  assert.match(formato.errore, /Formato sconosciuto/);
  assert.equal((await srv.api("produzione", { preset: "boh" })).stato, 400);
  assert.equal((await srv.api("drumBrano", [])).stato, 400, "un corpo che non è un oggetto");
  assert.equal((await srv.api("formatoTesti", { formato: ["drum"], valori: { contatore: 120 } })).stato, 400);
  assert.equal((await srv.api("drumRiempimento", { stile: "fango" })).stato, 400);
  assert.equal((await srv.api("drumDemo", { fase: "boh" })).stato, 400);
});

test("e2e: brano, ospite, priorità e richiamo", async () => {
  assert.equal((await srv.api("drumBrano", { titolo: "Pezzo", artista: "Chi" })).ok, true);
  assert.equal((await srv.api("drumOspite", { handle: "@lince.music", icona: "tiktok" })).ok, true);
  assert.equal((await srv.api("drumPriorita", { slot: "Corolla" })).ok, true);
  const s = (await srv.statoCorrente()).drum;
  assert.deepEqual(s.brano, { titolo: "Pezzo", artista: "Chi" });
  assert.deepEqual([s.ospite.handle, s.ospite.icona], ["@lince.music", "tiktok"]);
  assert.equal(s.priorita.slot, "Corolla");

  let eventi = await eventiDi(() => srv.api("drumPriorita", { richiamo: true }));
  assert.deepEqual(eventi.filter((e) => e.nome === "richiamoDrum"), [{ nome: "richiamoDrum", dati: {} }]);

  assert.equal((await srv.api("widget", { nome: "drumPriorita", visibile: false })).ok, true);
  const spento = await srv.api("drumPriorita", { richiamo: true });
  assert.equal(spento.stato, 400);
  assert.match(spento.errore, /spento/);
  const meta = await srv.api("drumPriorita", { slot: "Altro", richiamo: true });
  assert.equal(meta.stato, 400);
  assert.equal((await srv.statoCorrente()).drum.priorita.slot, "Corolla", "con il richiamo rifiutato il testo non cambia a metà");
  assert.equal((await srv.api("drumPriorita", { slot: "Cuore" })).ok, true, "i testi si cambiano anche a widget spento");
  assert.equal((await srv.api("widget", { nome: "drumPriorita", visibile: true })).ok, true);

  eventi = await eventiDi(() => srv.api("drumPriorita", { richiamo: true }));
  assert.equal(eventi.filter((e) => e.nome === "richiamoDrum").length, 1);
  assert.equal((await srv.api("drumPriorita", { richiamo: "sì" })).stato, 400);
  assert.equal((await srv.api("drumEq", { sensibilita: 150, stile: "onda" })).ok, true);
  assert.equal((await srv.api("drumRiempimento", { stile: "sabbia" })).ok, true);
  const dopo = (await srv.statoCorrente()).drum;
  assert.deepEqual([dopo.eq.sensibilita, dopo.eq.stile, dopo.riempimento], [150, "onda", "sabbia"]);
  assert.equal((await srv.api("drumEq", { sensibilita: 10 })).stato, 400);
});

test("e2e: produzione, reaction e podcast", async () => {
  assert.equal((await srv.api("produzione", { preset: "mix" })).ok, true);
  assert.equal((await srv.statoCorrente()).produzione.titolo.testo, "Mix & Master");
  assert.equal((await srv.api("produzione", { titolo: { testo: "Mix live" } })).ok, true);
  const produzione = (await srv.statoCorrente()).produzione;
  assert.deepEqual(produzione.titolo, { preset: "mix", sopra: "Backrooms Studio · Live", testo: "Mix live", sotto: "Mix e master in diretta" });

  assert.equal((await srv.api("reaction", { titolo: { sotto: "Ep. 12" } })).ok, true);
  assert.equal((await srv.statoCorrente()).reaction.titolo.sotto, "Ep. 12");

  const podcast = await srv.api("podcast", {
    titolo: { testo: "Puntata 3" },
    ospiti: [{ nome: "Lince", handle: "@lince.music" }],
    tematiche: { elenco: ["Uno", "Due", "Tre"] },
  });
  assert.equal(podcast.ok, true);
  let s = (await srv.statoCorrente()).podcast;
  assert.equal(s.titolo.testo, "Puntata 3");
  assert.deepEqual(s.ospiti, [{ nome: "Lince", handle: "@lince.music", icona: "instagram" }]);
  assert.deepEqual([s.tematiche.elenco, s.tematiche.attiva], [["Uno", "Due", "Tre"], 0]);

  assert.equal((await srv.api("podcastTematica", { avanti: true })).ok, true);
  s = (await srv.statoCorrente()).podcast;
  assert.equal(s.tematiche.attiva, 1);
  assert.equal((await srv.api("widget", { nome: "poLinea", visibile: true })).ok, true);
  assert.equal((await srv.statoCorrente()).visibili.poLinea, true);
});

test("e2e: dimensione dei testi e velocità", async () => {
  assert.equal((await srv.api("formatoTesti", { formato: "drum", valori: { contatore: 140 } })).ok, true);
  assert.equal((await srv.statoCorrente()).drum.testi.contatore, 140);
  assert.equal((await srv.api("formatoTesti", { formato: "drum", valori: { contatore: 10 } })).stato, 400);
  assert.equal((await srv.statoCorrente()).drum.testi.contatore, 140, "un errore non cambia nulla");
  assert.equal((await srv.api("formatoTesti", { formato: "drum", azzera: true })).ok, true);
  assert.equal((await srv.statoCorrente()).drum.testi.contatore, 100);
  for (const [formato, valori] of [["produzione", { titolo: 150 }], ["reaction", { sotto: 80 }], ["podcast", { targa: 120 }]]) {
    assert.equal((await srv.api("formatoTesti", { formato, valori })).ok, true, formato);
    assert.equal((await srv.statoCorrente())[formato].testi[Object.keys(valori)[0]], Object.values(valori)[0], formato);
  }

  assert.equal((await srv.api("formatoVelocita", { formato: "podcast", velocita: 120 })).ok, true);
  assert.equal((await srv.statoCorrente()).podcast.velocita, 120);
  for (const formato of ["drum", "produzione", "reaction"]) {
    assert.equal((await srv.api("formatoVelocita", { formato, velocita: 100 })).ok, true, formato);
    assert.equal((await srv.statoCorrente())[formato].velocita, 100, formato);
  }
  assert.equal((await srv.api("formatoVelocita", { formato: "drum", velocita: 10 })).stato, 400);
  assert.equal((await srv.api("formatoVelocita", { formato: "drum" })).stato, 400);
  const sconosciuto = await srv.api("formatoVelocita", { formato: "boh", velocita: 100 });
  assert.equal(sconosciuto.stato, 400);
  assert.match(sconosciuto.errore, /Formato sconosciuto/);
  assert.equal((await srv.api("formatoVelocita", { formato: ["drum"], velocita: 100 })).stato, 400);
});

test("e2e: nuova serata e demo conservano le impostazioni", async () => {
  assert.equal((await srv.api("drumScaletta", { testo: "1000 | Uno\n2000 | Due\n3000 | Tre" })).ok, true);
  assert.equal((await srv.api("drumLike", { imposta: 5000 })).ok, true);
  assert.equal((await srv.api("podcast", { tematiche: { elenco: ["A", "B", "C"] } })).ok, true);
  assert.equal((await srv.api("podcastTematica", { indice: 2 })).ok, true);
  assert.equal((await srv.api("reaction", { titolo: { testo: "Titolo reaction" } })).ok, true);
  assert.equal((await srv.api("formatoTesti", { formato: "drum", valori: { brano: 130 } })).ok, true);
  assert.equal((await srv.statoCorrente()).podcast.tematiche.attiva, 2);

  assert.equal((await srv.api("nuovaSerata")).ok, true);
  let s = await srv.statoCorrente();
  assert.equal(s.drum.contati, 0);
  assert.equal(s.drum.annunciati, 0);
  assert.deepEqual(s.drum.scaletta.map((t) => t.titolo), ["Uno", "Due", "Tre"], "titoli e tappe della scaletta restano");
  assert.equal(s.podcast.tematiche.attiva, 0);
  assert.deepEqual(s.podcast.tematiche.elenco, ["A", "B", "C"]);
  assert.equal(s.reaction.titolo.testo, "Titolo reaction");
  assert.equal(s.produzione.titolo.testo, "Mix live");
  assert.equal(s.drum.testi.brano, 130, "anche la dimensione dei testi resta");
  assert.equal(s.drum.riempimento, "sabbia", "riempimento, equalizzatore e ospite restano");
  assert.equal(s.drum.ospite.handle, "@lince.music");

  const eventi = await eventiDi(() => srv.api("drumLike", { imposta: 1500 }));
  assert.deepEqual(sblocchi(eventi), [{ indice: 0, like: 1000, titolo: "Uno" }], "nella serata nuova si riparte da zero");
  assert.equal((await srv.api("demo")).ok, true);
  s = await srv.statoCorrente();
  assert.equal(s.drum.contati, 1500, "i dati di prova non toccano il Drum");
  assert.equal(s.podcast.tematiche.elenco.length, 3);
  assert.equal(s.reaction.titolo.testo, "Titolo reaction");
  assert.equal(s.produzione.titolo.testo, "Mix live");
});

test("e2e: i dati di prova del Drum", async () => {
  assert.equal((await srv.api("drumScaletta", { predefinita: true })).ok, true);
  for (const [fase, contati, attiva] of [["vuoto", 0, 0], ["meta", 11400, 7], ["sblocco", 12000, 8]]) {
    const eventi = await eventiDi(() => srv.api("drumDemo", { fase }));
    const d = (await srv.statoCorrente()).drum;
    assert.deepEqual([d.contati, d.attiva], [contati, attiva], fase);
    assert.equal(d.annunciati, attiva, fase);
    assert.deepEqual(sblocchi(eventi), [], `${fase}: nessuno sblocco parte da solo`);
  }
  await srv.api("drumDemo", { fase: "finale" });
  const finale = (await srv.statoCorrente()).drum;
  assert.deepEqual([finale.attiva, finale.progresso, finale.annunciati], [null, 1, 37]);
});

test("e2e: stato salvato di una versione precedente", async () => {
  const vecchio = {
    layout: "studio",
    premio: "Beat",
    drum: { like: { tiktokTotale: 7000, offset: 0, extra: 0 }, annunciati: 99, scaletta: "rotta" },
    podcast: { tematiche: { elenco: ["A", "B"], attiva: 7 } },
  };
  const secondo = await avviaServer({ stato: vecchio });
  try {
    const s = await secondo.statoCorrente();
    assert.equal(s.layout, "studio");
    assert.equal(s.premio, "Beat");
    assert.equal(s.drum.scaletta.length, 37);
    assert.equal(s.drum.like.tiktokTotale, 7000);
    assert.equal(s.drum.annunciati, 5);
    assert.deepEqual(s.podcast.tematiche.elenco, ["A", "B"]);
    assert.equal(s.podcast.tematiche.attiva, 1);
    assert.equal(s.produzione.titolo.testo, "Cooking Beats");
    assert.equal(s.reaction.titolo.testo, "REACTION RELEASE DELLA SETTIMANA");
  } finally {
    await secondo.ferma();
  }

  // uno stato che non c'entra nulla non fa cadere il server
  const rotto = await avviaServer({ stato: { drum: 5, produzione: [], reaction: "x", podcast: null, visibili: { drumBarra: false } } });
  try {
    const s = await rotto.statoCorrente();
    assert.equal(s.drum.scaletta.length, 37);
    assert.equal(s.produzione.titolo.testo, "Cooking Beats");
    assert.equal(s.podcast.tematiche.elenco.length, 0);
    assert.equal(s.visibili.drumBarra, false, "le impostazioni buone restano");
  } finally {
    await rotto.ferma();
  }
});

test("e2e: dopo un riavvio la scaletta non si ripete", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "drum-riavvio-"));
  try {
    const primo = await avviaServer({ cartella });
    try {
      await primo.api("drumScaletta", { testo: "1000 | Uno\n2000 | Due\n3000 | Tre\n5000 | Cinque" });
      await primo.api("likeEvento", { totale: 3200 });
      await primo.api("drumBrano", { daIndice: 2 });
      assert.equal((await primo.statoCorrente()).drum.annunciati, 3);
      await dormi(900); // il salvataggio su disco parte dopo 500 ms
    } finally {
      await primo.ferma();
    }

    const secondo = await avviaServer({ cartella });
    const pagina = await secondo.apriWs();
    try {
      const s = (await secondo.statoCorrente()).drum;
      assert.deepEqual([s.like.tiktokTotale, s.annunciati, s.contati, s.attiva], [3200, 3, 3200, 3]);
      assert.deepEqual(s.brano, { titolo: "Tre", artista: "" });
      await dormi(150);
      assert.deepEqual(pagina.eventi, [], "al collegamento nessun evento");

      await secondo.api("likeEvento", { totale: 3300 });
      await dormi(150);
      assert.deepEqual(pagina.eventi, [], "stessa tappa: nessuno sblocco");
      await secondo.api("likeEvento", { totale: 5100 });
      await dormi(150);
      assert.deepEqual(pagina.eventi.filter((e) => e.nome === "sbloccoDrum").map((e) => e.dati), [{ indice: 3, like: 5000, titolo: "Cinque" }]);
    } finally {
      pagina.chiudi();
      await secondo.ferma();
    }
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

// Un'attesa che non deve durare per sempre: un test che aspetta una chiusura che non arriva deve fallire, non appendersi.
const entro = (promessa, ms, cosa) => Promise.race([promessa, dormi(ms).then(() => Promise.reject(new Error(`Dopo ${ms} ms: ${cosa}`)))]);

const LIVELLI = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 5, 0];
const audioDi = (client) => client.messaggi.filter((m) => m.tipo === "audio");

test("e2e: audio ritrasmesso solo con il Drum in onda", { timeout: 20000 }, async () => {
  const a = await srv.apriWs();
  const b = await srv.apriWs();
  try {
    assert.equal((await srv.api("layout", { nome: "drum" })).ok, true);
    a.invia({ tipo: "audio", b: LIVELLI, c: 70 });
    await dormi(300);
    assert.deepEqual(audioDi(b), [{ tipo: "audio", b: LIVELLI, c: 70 }], "agli altri arrivano solo i livelli");
    assert.deepEqual(audioDi(a), [], "chi li manda non li riceve");

    assert.equal((await srv.api("layout", { nome: "gara" })).ok, true);
    a.invia({ tipo: "audio", b: LIVELLI, c: 70 });
    await dormi(300);
    assert.equal(audioDi(b).length, 1, "con un altro layout in onda non arriva nulla");

    await srv.api("layout", { nome: "drum" });
    a.invia({ tipo: "audio", b: LIVELLI.map((x) => x + 0.4), c: 120, pin: "inutile", x: "extra" });
    await dormi(300);
    assert.deepEqual(audioDi(b).at(-1), { tipo: "audio", b: LIVELLI, c: 100 }, "i valori si limitano e il resto non passa");
  } finally {
    a.chiudi();
    b.chiudi();
  }
});

test("e2e: audio malformato o a raffica", { timeout: 20000 }, async () => {
  await srv.api("layout", { nome: "drum" });
  const a = await srv.apriWs();
  const b = await srv.apriWs();
  const aperti = [a, b];
  try {
    const dieci = LIVELLI.slice(0, 11);
    for (const rotto of [
      { tipo: "audio", b: dieci, c: 10 },
      { tipo: "audio", b: [...LIVELLI, 7], c: 10 },
      { tipo: "audio", b: [...dieci, null], c: 10 }, // un NaN in JSON diventa null
      { tipo: "audio", b: [...dieci, "7"], c: 10 },
      { tipo: "audio", b: LIVELLI, c: "forte" },
      { tipo: "audio", b: "123456789012", c: 10 },
      { tipo: "audio", c: 10 },
      { tipo: "audio", b: null },
      { tipo: "audio" },
    ]) {
      a.invia(rotto);
      await dormi(40);
    }
    a.ws.send("{non è json");
    await dormi(40);
    a.ws.send("[1, 2, 3]");
    await dormi(40);
    a.ws.send("null");
    await dormi(40);
    assert.deepEqual(audioDi(b), [], "nessun messaggio sbagliato viene ritrasmesso");

    // un messaggio enorme: il server chiude quel socket e resta in piedi
    const chiuso = new Promise((ok) => a.ws.once("close", ok));
    a.ws.send(JSON.stringify({ tipo: "audio", b: LIVELLI, c: 1, riempimento: "x".repeat(1024 * 1024) }));
    await entro(chiuso, 3000, "il server doveva chiudere il socket del messaggio enorme");
    assert.equal((await srv.statoCorrente()).layout, "drum", "il server risponde ancora");
    const c = await srv.apriWs();
    aperti.push(c);
    c.invia({ tipo: "audio", b: LIVELLI, c: 33 });
    await dormi(300);
    assert.deepEqual(audioDi(b), [{ tipo: "audio", b: LIVELLI, c: 33 }], "un nuovo client funziona subito, e il messaggio enorme non è passato");
    assert.equal((await srv.api("layout", { nome: "drum" })).ok, true, "anche i comandi");

    // una raffica di 40 messaggi senza pausa: ne passano pochi
    const d = await srv.apriWs();
    aperti.push(d);
    await dormi(60);
    const prima = audioDi(b).length;
    for (let i = 0; i < 40; i++) d.invia({ tipo: "audio", b: LIVELLI, c: i });
    await dormi(400);
    const passati = audioDi(b).length - prima;
    assert.ok(passati >= 1 && passati <= 4, `della raffica sono passati ${passati} messaggi`);
  } finally {
    for (const client of aperti) client.chiudi();
  }
});

test("e2e: audio con PIN", { timeout: 20000 }, async () => {
  const protetto = await avviaServer({ config: { pinRegia: "1234" } });
  const a = await protetto.apriWs();
  const b = await protetto.apriWs();
  try {
    const senza = await protetto.api("layout", { nome: "drum" });
    assert.equal(senza.stato, 400);
    assert.match(senza.errore, /PIN/);
    assert.equal((await protetto.api("layout", { nome: "drum" }, { pin: "1234" })).ok, true);

    a.invia({ tipo: "audio", b: LIVELLI, c: 70 });
    await dormi(60);
    a.invia({ tipo: "audio", b: LIVELLI, c: 70, pin: "0000" });
    await dormi(60);
    a.invia({ tipo: "audio", b: LIVELLI, c: 70, pin: 1234 });
    await dormi(300);
    assert.deepEqual(audioDi(b), [], "senza PIN, con un PIN sbagliato o di un altro tipo non arriva nulla");

    a.invia({ tipo: "audio", b: LIVELLI, c: 70, pin: "1234" });
    await dormi(300);
    assert.deepEqual(audioDi(b), [{ tipo: "audio", b: LIVELLI, c: 70 }], "con il PIN giusto sì, e il PIN non viaggia");
  } finally {
    a.chiudi();
    b.chiudi();
    await protetto.ferma();
  }
});

test("e2e: le quattro pagine si aprono con o senza .html", async () => {
  for (const percorso of ["/drum", "/drum.html", "/produzione", "/produzione.html", "/podcast", "/podcast.html", "/reaction", "/reaction.html"]) {
    const r = await fetch(`${srv.base}${percorso}`);
    assert.equal(r.status, 200, percorso);
    assert.match(r.headers.get("content-type"), /text\/html/, percorso);
    assert.match(await r.text(), /data-parte="fascia"/, percorso);
  }
  for (const [file, tipo] of [["/css/formati.css", /text\/css/], ["/js/pagina.js", /text\/javascript/], ["/js/fascia.js", /text\/javascript/], ["/js/simboli.js", /text\/javascript/], ["/js/formati-logica.js", /text\/javascript/]]) {
    const r = await fetch(`${srv.base}${file}`);
    assert.equal(r.status, 200, file);
    assert.match(r.headers.get("content-type"), tipo, file);
  }
});
