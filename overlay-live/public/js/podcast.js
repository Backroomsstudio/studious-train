// Layout «Back Rooms Podcast» (9:16 e, con ?formato=orizzontale, 16:9): la camera del divano a tutto schermo sotto la
// pagina. Muto. Per ora la pagina disegna la fascia social (con gli ospiti): targa, linea di divisione e pannello
// Tematiche arrivano con i compiti successivi.
// Parametri URL: ?anteprima=1 (sfondo nero e finta camera), ?guide=1 (zone dei telefoni, solo verticale),
// ?statico=1 (senza animazioni, per i mockup), ?formato=orizzontale (1920×1080).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, $, STATICO } from "./pagina.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia } from "./formati-logica.js";

const { palco, orizzontale } = avviaPagina({ orizzontaleAmmesso: true });

const fascia = creaFascia({
  radice: $(".fm-fascia"),
  nastro: $("#sp-nastro"),
  larghezza: orizzontale ? 1920 : 1080,
  voci: (s) => vociFascia(s, "podcast"),
  velocita: (s) => velocitaFascia(s, "podcast"),
  statico: STATICO,
});

collega({
  suStato(s) {
    fascia.radice.classList.toggle("fuori", !s.visibili.poBarra);
    fascia.aggiorna(s);
    applicaTesti(palco, s.podcast.testi);
  },
});

// Con i font caricati le larghezze cambiano: si rimisura il nastro.
const rimisura = () => fascia.rimisura();
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
