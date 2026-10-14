// L'Instagram della traccia in ascolto con un server vero: correggiTraccia lo imposta senza toccare i voti.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avviaServer } from "./aiuti-server.mjs";

test("e2e: correggiTraccia imposta l'Instagram (@ e link puliti) senza azzerare i voti; un valore non valido non cambia niente", async () => {
  const srv = await avviaServer();
  try {
    await srv.api("traccia", { titolo: "Satellite", artista: "Mira" });
    await srv.api("voto", { categoria: "beat", valore: 8 });
    assert.equal((await srv.api("correggiTraccia", { instagram: "https://instagram.com/mira.music/?hl=it" })).ok, true);
    let s = await srv.statoCorrente();
    assert.equal(s.corrente.instagram, "mira.music");
    assert.equal(s.corrente.punteggi.beat, 8, "i voti restano");
    assert.equal((await srv.api("correggiTraccia", { titolo: "Satellite 2", instagram: "due parole" })).ok, false);
    s = await srv.statoCorrente();
    assert.deepEqual([s.corrente.titolo, s.corrente.instagram], ["Satellite", "mira.music"], "un errore non cambia niente");
    await srv.api("correggiTraccia", { instagram: "" });
    assert.equal((await srv.statoCorrente()).corrente.instagram, "");
    await srv.api("traccia", { titolo: "Altra", artista: "X" });
    assert.equal((await srv.statoCorrente()).corrente.instagram, "", "una traccia nuova parte senza Instagram");
  } finally {
    await srv.ferma();
  }
});
