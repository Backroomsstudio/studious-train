// Layout «Studio Production» (9:16, webcam sopra e DAW sotto) e «Reaction Release» (webcam e schermo condiviso: in
// verticale uno sopra l'altro, in orizzontale affiancati con ?formato=orizzontale). Muti. Una pagina per due layout:
// quale lo dice <body data-formato="produzione|reaction">.
// Per ora la pagina disegna la fascia social: titolo, finestre e divisore arrivano con i compiti successivi.
// Parametri URL: ?anteprima=1 (sfondo nero e finti schermi), ?guide=1 (zone dei telefoni, solo verticale),
// ?statico=1 (senza animazioni, per i mockup), ?formato=orizzontale (solo la reaction: 1920×1080).
import { collega } from "./connessione.js";
import { avviaPagina, applicaTesti, $, STATICO } from "./pagina.js";
import { creaFascia } from "./fascia.js";
import { vociFascia, velocitaFascia } from "./formati-logica.js";

const FORMATO = document.body.dataset.formato; // "produzione" | "reaction"
const BARRA = { produzione: "prBarra", reaction: "reBarra" }[FORMATO];
const { palco, orizzontale } = avviaPagina({ orizzontaleAmmesso: FORMATO === "reaction" });

const fascia = creaFascia({
  radice: $(".fm-fascia"),
  nastro: $("#sp-nastro"),
  larghezza: orizzontale ? 1920 : 1080,
  voci: (s) => vociFascia(s, FORMATO),
  velocita: (s) => velocitaFascia(s, FORMATO),
  statico: STATICO,
});

collega({
  suStato(s) {
    fascia.radice.classList.toggle("fuori", !s.visibili[BARRA]);
    fascia.aggiorna(s);
    applicaTesti(palco, s[FORMATO].testi);
  },
});

// Con i font caricati le larghezze cambiano: si rimisura il nastro.
const rimisura = () => fascia.rimisura();
document.fonts?.ready.then(rimisura);
document.fonts?.addEventListener?.("loadingdone", rimisura);
