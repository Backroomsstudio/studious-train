// Goal Like e Follower: calcolo dell'obiettivo, follower e posizioni nei layout. Funzioni pure sullo stato (nessun server).
import { test } from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_GOAL, goalIniziale, obiettivoAttuale, mancano, registraFollow, impostaGoal, fondiGoal, istantaneaGoal } from "../lib/goal.mjs";
import { drumIniziale } from "../lib/drum.mjs";

const nuovo = () => ({ goal: goalIniziale(), drum: drumIniziale() });

test("goalIniziale: 15.000 like a passi di 1.000, 50 follower a passi di 10, sempre in onda, nessuna posizione scelta", () => {
  assert.deepEqual(goalIniziale(), {
    like: { obiettivo: 15000, passo: 1000 },
    follower: { obiettivo: 50, passo: 10, totale: null },
    modo: "fisso",
    ogniMinuti: 5,
    durataSecondi: 15,
    posizioni: {},
  });
  assert.notEqual(goalIniziale().posizioni, goalIniziale().posizioni, "ogni volta oggetti nuovi");
  assert.deepEqual(LAYOUT_GOAL, ["gara", "senzaPremio", "studio", "battle", "drum", "produzione", "podcast", "podcastO", "reaction", "reactionO"]);
});

test("obiettivoAttuale: sotto il totale resta quello scelto; raggiunto, passa al primo multiplo del passo maggiore del totale", () => {
  assert.equal(obiettivoAttuale(0, 15000, 1000), 15000);
  assert.equal(obiettivoAttuale(14999, 15000, 1000), 15000);
  assert.equal(obiettivoAttuale(15000, 15000, 1000), 16000, "raggiunto: il prossimo");
  assert.equal(obiettivoAttuale(15001, 15000, 1000), 16000);
  assert.equal(obiettivoAttuale(15999, 15000, 1000), 16000);
  assert.equal(obiettivoAttuale(16000, 15000, 1000), 17000);
  // un obiettivo che non è un multiplo del passo: dopo, si va a multipli del passo
  assert.equal(obiettivoAttuale(15500, 15500, 1000), 16000);
  assert.equal(obiettivoAttuale(50, 50, 10), 60);
});

test("il totale salta più obiettivi in un colpo (14.900 → 31.200, passo 1.000) → 32.000", () => {
  assert.equal(obiettivoAttuale(14900, 15000, 1000), 15000);
  assert.equal(obiettivoAttuale(31200, 15000, 1000), 32000);
  assert.equal(obiettivoAttuale(31200, 15000, 1000) - 31200, 800);
  // numeri molto grandi: il primo multiplo maggiore, calcolato con BigInt per confronto
  for (const [totale, passo] of [[10_000_000_000, 7], [9_999_999_999, 1_000_000], [123_456_789_012, 999_983]]) {
    assert.equal(obiettivoAttuale(totale, 15000, passo), Number((BigInt(totale) / BigInt(passo) + 1n) * BigInt(passo)), `${totale} / ${passo}`);
  }
});

test("passo 0: resta l'obiettivo e mancano 0", () => {
  assert.equal(obiettivoAttuale(20000, 15000, 0), 15000);
  assert.equal(mancano(20000, 15000, 0), 0, "obiettivo raggiunto");
  assert.equal(mancano(15000, 15000, 0), 0);
  assert.equal(mancano(100, 15000, 0), 14900, "prima di raggiungerlo si conta come sempre");
});

test("mancano non scende sotto 1 con passo > 0, ed è null con il totale sconosciuto", () => {
  assert.equal(mancano(0, 15000, 1000), 15000);
  assert.equal(mancano(14999, 15000, 1000), 1);
  assert.equal(mancano(15000, 15000, 1000), 1000, "appena raggiunto, il prossimo è a un passo");
  assert.equal(mancano(15999, 15000, 1000), 1);
  assert.equal(mancano(31200, 15000, 1000), 800);
  for (let totale = 0; totale < 40_000; totale += 137) assert.ok(mancano(totale, 15000, 1000) >= 1, String(totale));
  for (const ignoto of [null, undefined, NaN, "x", Infinity, -5]) assert.equal(mancano(ignoto, 50, 10), null, String(ignoto));
});

test("registraFollow: +1 se il totale è noto, un totale più alto vale, uno più basso o non numerico no, uno sconosciuto resta tale", () => {
  const stato = nuovo();
  registraFollow(stato, { totale: null });
  assert.equal(stato.goal.follower.totale, null, "sconosciuto e senza totale: non si può sommare");
  registraFollow(stato, { utente: "anna" });
  assert.equal(stato.goal.follower.totale, null);
  registraFollow(stato, { totale: 120 });
  assert.equal(stato.goal.follower.totale, 120, "il primo totale vale");
  registraFollow(stato, { totale: null });
  assert.equal(stato.goal.follower.totale, 121, "+1");
  registraFollow(stato, { totale: 100 });
  assert.equal(stato.goal.follower.totale, 122, "un totale più basso non fa scendere: +1");
  registraFollow(stato, { totale: 500 });
  assert.equal(stato.goal.follower.totale, 500, "un totale più alto vale");
  for (const strano of ["x", NaN, Infinity, -3, 0, 2.5, "600", {}, []]) {
    const prima = stato.goal.follower.totale;
    registraFollow(stato, { totale: strano });
    assert.equal(stato.goal.follower.totale, prima + 1, `totale ${JSON.stringify(strano)}: non vale come totale, +1`);
  }
  registraFollow(stato, undefined);
  registraFollow(stato, null);
  assert.equal(stato.goal.follower.totale, 500 + 9 + 2, "anche senza dati vale come un follow");
  stato.goal.follower.totale = 10_000_000_000;
  registraFollow(stato, { totale: null });
  registraFollow(stato, { totale: 99_999_999_999_999 });
  assert.equal(stato.goal.follower.totale, 10_000_000_000, "il massimo resta il massimo");
});

test("impostaGoal: limiti ai bordi per obiettivi e passi, errori in italiano", () => {
  const stato = nuovo();
  impostaGoal(stato, { like: { obiettivo: 1, passo: 0 }, follower: { obiettivo: 10_000_000_000, passo: 1_000_000 } });
  assert.deepEqual([stato.goal.like, stato.goal.follower.obiettivo, stato.goal.follower.passo], [{ obiettivo: 1, passo: 0 }, 10_000_000_000, 1_000_000]);
  impostaGoal(stato, { like: { obiettivo: 10_000_000_000, passo: 1_000_000 }, follower: { obiettivo: 1, passo: 0 } });
  assert.deepEqual(stato.goal.like, { obiettivo: 10_000_000_000, passo: 1_000_000 });
  const casi = [
    [{ like: { obiettivo: 0 } }, /Obiettivo dei like: tra 1 e 10000000000/],
    [{ like: { obiettivo: 10_000_000_001 } }, /Obiettivo dei like/],
    [{ like: { passo: -1 } }, /Passo dei like: tra 0 e 1000000/],
    [{ like: { passo: 1_000_001 } }, /Passo dei like/],
    [{ follower: { obiettivo: 0 } }, /Obiettivo dei follower/],
    [{ follower: { passo: 1_000_001 } }, /Passo dei follower/],
    [{ like: { obiettivo: "tanti" } }, /Obiettivo dei like/],
    [{ like: 5 }, /Like: .*obiettivo/i],
    [{ follower: [1] }, /Follower: .*obiettivo/i],
    [{ modo: "boh" }, /Modo del Goal: fisso o comparsa/],
    [{ modo: 3 }, /Modo del Goal/],
    [{ ogniMinuti: 0 }, /Ogni quanti minuti compare: tra 1 e 60/],
    [{ ogniMinuti: 61 }, /Ogni quanti minuti/],
    [{ durataSecondi: 4 }, /Secondi in vista: tra 5 e 120/],
    [{ durataSecondi: 121 }, /Secondi in vista/],
  ];
  const prima = structuredClone(stato.goal);
  for (const [dati, atteso] of casi) {
    assert.throws(() => impostaGoal(stato, dati), atteso, JSON.stringify(dati));
    assert.deepEqual(stato.goal, prima, `niente cambia: ${JSON.stringify(dati)}`);
  }
  for (const rotto of [null, undefined, "x", 7, []]) assert.throws(() => impostaGoal(stato, rotto), /Goal: forma non valida/, JSON.stringify(rotto));
  assert.deepEqual(stato.goal, prima);
  // un valore buono insieme a uno sbagliato: non cambia nemmeno quello buono
  assert.throws(() => impostaGoal(stato, { like: { obiettivo: 20000 }, modo: "boh" }), /Modo del Goal/);
  assert.deepEqual(stato.goal, prima);
});

test("impostaGoal: modo, ogni quanti minuti compare e quanto resta in vista, ai bordi", () => {
  const stato = nuovo();
  impostaGoal(stato, { modo: "comparsa", ogniMinuti: 1, durataSecondi: 5 });
  assert.deepEqual([stato.goal.modo, stato.goal.ogniMinuti, stato.goal.durataSecondi], ["comparsa", 1, 5]);
  impostaGoal(stato, { modo: "fisso", ogniMinuti: 60, durataSecondi: 120 });
  assert.deepEqual([stato.goal.modo, stato.goal.ogniMinuti, stato.goal.durataSecondi], ["fisso", 60, 120]);
  impostaGoal(stato, { ogniMinuti: "7", durataSecondi: 29.6 });
  assert.deepEqual([stato.goal.ogniMinuti, stato.goal.durataSecondi], [7, 30], "un testo di cifre vale, un decimale si arrotonda");
  impostaGoal(stato, {});
  assert.equal(stato.goal.modo, "fisso");
});

test("impostaGoal: i follower di adesso si impostano (0 – 10 miliardi) o si aggiungono (±1.000.000, mai sotto 0)", () => {
  const stato = nuovo();
  assert.throws(() => impostaGoal(stato, { follower: { aggiungi: 10 } }), /Imposta prima i follower di adesso/);
  assert.equal(stato.goal.follower.totale, null);
  impostaGoal(stato, { follower: { imposta: 0 } });
  assert.equal(stato.goal.follower.totale, 0, "zero è un totale noto");
  impostaGoal(stato, { follower: { imposta: 10_000_000_000 } });
  assert.equal(stato.goal.follower.totale, 10_000_000_000);
  impostaGoal(stato, { follower: { imposta: 1240 } });
  impostaGoal(stato, { follower: { aggiungi: 10 } });
  assert.equal(stato.goal.follower.totale, 1250);
  impostaGoal(stato, { follower: { aggiungi: -50 } });
  assert.equal(stato.goal.follower.totale, 1200);
  impostaGoal(stato, { follower: { aggiungi: -1_000_000 } });
  assert.equal(stato.goal.follower.totale, 0, "non scende sotto zero");
  impostaGoal(stato, { follower: { imposta: 100, aggiungi: 5 } });
  assert.equal(stato.goal.follower.totale, 105, "imposta e poi aggiunge");
  const prima = structuredClone(stato.goal);
  for (const [dati, atteso] of [
    [{ follower: { imposta: -1 } }, /Follower di adesso: tra 0 e 10000000000/],
    [{ follower: { imposta: 10_000_000_001 } }, /Follower di adesso/],
    [{ follower: { imposta: "tanti" } }, /Follower di adesso/],
    [{ follower: { aggiungi: 1_000_001 } }, /Follower da aggiungere: tra -1000000 e 1000000/],
    [{ follower: { aggiungi: -1_000_001 } }, /Follower da aggiungere/],
    [{ follower: { aggiungi: "x" } }, /Follower da aggiungere/],
  ]) {
    assert.throws(() => impostaGoal(stato, dati), atteso, JSON.stringify(dati));
    assert.deepEqual(stato.goal, prima);
  }
  // sommando non si supera il massimo
  impostaGoal(stato, { follower: { imposta: 9_999_999_999, aggiungi: 1_000_000 } });
  assert.equal(stato.goal.follower.totale, 10_000_000_000);
});

test("posizione: ogni layout ha la sua; layout sconosciuto → errore; ripristina toglie solo quel layout", () => {
  const stato = nuovo();
  impostaGoal(stato, { posizione: { layout: "gara", x: 120, y: 1210, scala: 110 } });
  impostaGoal(stato, { posizione: { layout: "drum", x: 0, y: 1920, scala: 60 } });
  impostaGoal(stato, { posizione: { layout: "podcastO", x: 1920, y: 0, scala: 200 } });
  assert.deepEqual(stato.goal.posizioni, { gara: { x: 120, y: 1210, scala: 110 }, drum: { x: 0, y: 1920, scala: 60 }, podcastO: { x: 1920, y: 0, scala: 200 } });
  // si cambia solo quello che si manda
  impostaGoal(stato, { posizione: { layout: "gara", x: 130 } });
  assert.deepEqual(stato.goal.posizioni.gara, { x: 130, y: 1210, scala: 110 });
  impostaGoal(stato, { posizione: { layout: "reaction", scala: 150 } });
  assert.deepEqual(stato.goal.posizioni.reaction, { scala: 150 }, "senza un'altra posizione già scelta resta solo ciò che si è mandato (il resto è quello di partenza della pagina)");
  // ripristina toglie solo quel layout
  impostaGoal(stato, { posizione: { layout: "gara", ripristina: true } });
  assert.deepEqual(Object.keys(stato.goal.posizioni).sort(), ["drum", "podcastO", "reaction"]);
  impostaGoal(stato, { posizione: { layout: "gara", ripristina: true } });
  assert.equal("gara" in stato.goal.posizioni, false, "ripristinare quello che non c'è non è un errore");
  const prima = structuredClone(stato.goal);
  for (const [dati, atteso] of [
    [{ posizione: { layout: "tivu", x: 5 } }, /Layout del Goal sconosciuto/],
    [{ posizione: { x: 5 } }, /Layout del Goal sconosciuto/],
    [{ posizione: "gara" }, /Posizione: .*layout/i],
    [{ posizione: { layout: "gara", x: -1 } }, /Posizione X: tra 0 e 1920/],
    [{ posizione: { layout: "gara", x: 1921 } }, /Posizione X/],
    [{ posizione: { layout: "gara", y: 1921 } }, /Posizione Y: tra 0 e 1920/],
    [{ posizione: { layout: "gara", scala: 59 } }, /Scala del Goal: tra 60 e 200/],
    [{ posizione: { layout: "gara", scala: 201 } }, /Scala del Goal/],
    [{ posizione: { layout: "gara", x: 10, scala: 999 } }, /Scala del Goal/],
    [{ posizione: { layout: "__proto__", x: 1 } }, /Layout del Goal sconosciuto/],
  ]) {
    assert.throws(() => impostaGoal(stato, dati), atteso, JSON.stringify(dati));
    assert.deepEqual(stato.goal, prima, `niente cambia: ${JSON.stringify(dati)}`);
  }
});

test("fondiGoal: stato vecchio o rotto → predefiniti campo per campo, quello che è valido resta", () => {
  for (const vuoto of [undefined, null, "x", 7, []]) assert.deepEqual(fondiGoal(vuoto), goalIniziale(), String(vuoto));
  const salvato = {
    like: { obiettivo: 20000, passo: "x" },
    follower: { obiettivo: -3, passo: 20, totale: 77 },
    modo: "boh",
    ogniMinuti: 10,
    durataSecondi: 500,
    posizioni: { gara: { x: 100, y: 5000, scala: 80 }, tivu: { x: 1 }, drum: "x", studio: { x: 5, y: 6, scala: 100 } },
  };
  assert.deepEqual(fondiGoal(salvato), {
    like: { obiettivo: 20000, passo: 1000 },
    follower: { obiettivo: 50, passo: 20, totale: 77 },
    modo: "fisso",
    ogniMinuti: 10,
    durataSecondi: 15,
    posizioni: { gara: { x: 100, scala: 80 }, studio: { x: 5, y: 6, scala: 100 } },
  });
  for (const totale of ["x", -5, 1e12, 2.5, NaN, undefined]) assert.equal(fondiGoal({ follower: { totale } }).follower.totale, totale === 2.5 ? 3 : null, String(totale));
  assert.deepEqual(fondiGoal({ like: { obiettivo: 25000 } }).like, { obiettivo: 25000, passo: 1000 }, "un campo che manca resta di partenza");
  assert.deepEqual(fondiGoal({ modo: "comparsa" }).modo, "comparsa");
  // non modifica quello che riceve
  const copia = structuredClone(salvato);
  fondiGoal(salvato);
  assert.deepEqual(salvato, copia);
});

test("istantaneaGoal usa i like contati dal Drum e il totale dei follower, senza toccare lo stato", () => {
  const stato = nuovo();
  Object.assign(stato.drum.like, { tiktokTotale: 5000, offset: 1000, extra: 200 });
  impostaGoal(stato, { follower: { imposta: 123 }, modo: "comparsa" });
  const foto = istantaneaGoal(stato);
  assert.equal(foto.like.totale, 4200, "(totale di TikTok − partenza) + correzioni");
  assert.deepEqual([foto.like.obiettivo, foto.like.passo, foto.follower.totale, foto.follower.obiettivo, foto.modo], [15000, 1000, 123, 50, "comparsa"]);
  assert.equal("totale" in stato.goal.like, false, "nello stato il totale dei like non c'è");
  foto.like.obiettivo = 1;
  foto.posizioni.gara = { x: 1 };
  assert.equal(stato.goal.like.obiettivo, 15000, "la foto è una copia");
  assert.deepEqual(stato.goal.posizioni, {});
  // Riparti da ora / nuova serata del Drum: ripartono anche i like del Goal
  stato.drum.like.offset = 5000;
  stato.drum.like.extra = 0;
  assert.equal(istantaneaGoal(stato).like.totale, 0);
});
