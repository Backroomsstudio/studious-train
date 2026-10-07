// Layout «Drum Challenge Live» (9:16): la camera del batterista a tutto schermo sotto la pagina, la grafica intorno.
// Per ora la pagina disegna la fascia social (con lo slot dell'artista ospite): Like, colonna dei traguardi, brano in
// esecuzione, «Dona un…» ed equalizzatore arrivano con i compiti successivi.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni), ?statico=1 (senza animazioni,
// per i mockup).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, $, STATICO } from "./pagina.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia } from "./formati-logica.js";

const { palco } = avviaPagina();

const fascia = creaFascia({
  radice: $(".fm-fascia"),
  nastro: $("#sp-nastro"),
  larghezza: 1080,
  voci: (s) => vociFascia(s, "drum"),
  velocita: (s) => velocitaFascia(s, "drum"),
  statico: STATICO,
});

collega({
  suStato(s) {
    fascia.radice.classList.toggle("fuori", !s.visibili.drumBarra);
    fascia.aggiorna(s);
    applicaTesti(palco, s.drum.testi);
  },
});

// Con i font caricati le larghezze cambiano: si rimisura il nastro.
const rimisura = () => fascia.rimisura();
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
