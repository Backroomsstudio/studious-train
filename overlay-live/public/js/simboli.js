// Gradienti e icone SVG delle quattro pagine nuove (drum, produzione, podcast, reaction): le stesse delle altre pagine
// più quelle dei regali, del lucchetto e dei titoli. Le pagine le usano con <use href="#id">; le icone sono disegnate in
// linea (24×24, tratto, currentColor) come quelle già esistenti.
const GRADIENTI = [
  [
    "g-cromo",
    `<linearGradient id="g-cromo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.44" stop-color="#a8a8a8"/><stop offset="0.52" stop-color="#3f3f3f"/><stop offset="0.68" stop-color="#eceff2"/><stop offset="1" stop-color="#949494"/></linearGradient>`,
  ],
  [
    "g-oro",
    `<linearGradient id="g-oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.35" stop-color="#ffd54a"/><stop offset="0.6" stop-color="#e09a12"/><stop offset="0.8" stop-color="#ffd659"/><stop offset="1" stop-color="#b87808"/></linearGradient>`,
  ],
];

const SIMBOLI = [
  ["punta", `<symbol id="punta" viewBox="0 0 100 100"><path d="M50 0C53 35 65 47 100 50 65 53 53 65 50 100 47 65 35 53 0 50 35 47 47 35 50 0Z"/></symbol>`],
  // come nelle altre pagine
  ["ic-nero", `<symbol id="ic-nero" viewBox="0 0 24 24"><path d="M9 17.5V5.5l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></symbol>`],
  ["ic-instagram", `<symbol id="ic-instagram" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></symbol>`],
  ["ic-tiktok", `<symbol id="ic-tiktok" viewBox="0 0 24 24"><path d="M14 3.5v11a4 4 0 1 1-4-4"/><path d="M14 3.5c.6 2.6 2.5 4.4 5 4.8"/></symbol>`],
  ["ic-twitch", `<symbol id="ic-twitch" viewBox="0 0 24 24"><path d="M4.5 3.5h15v10.5l-4.5 4.5h-4l-3 3v-3h-3.5z"/><path d="M11 8v4.5M15.5 8v4.5"/></symbol>`],
  ["ic-kick", `<symbol id="ic-kick" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M4 3h5v5h2V6h2V3h7v6h-2v2h-2v2h2v2h2v6h-7v-3h-2v-2H9v5H4z"/></symbol>`],
  ["ic-youtube", `<symbol id="ic-youtube" viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.2l5 2.8-5 2.8z" fill="currentColor" stroke="none"/></symbol>`],
  ["ic-spotify", `<symbol id="ic-spotify" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M7 9.6c3.4-1 7-.7 10 1M7.6 12.8c2.9-.8 5.6-.5 8 .9M8.3 15.8c2.2-.6 4.2-.4 5.9.6"/></symbol>`],
  ["ic-whatsapp", `<symbol id="ic-whatsapp" viewBox="0 0 24 24"><path d="M4 20.5l1.4-4.1A8.5 8.5 0 1 1 8.6 19.3z"/><path d="M9.2 8.6c.2 2.9 2.6 5.6 5.9 6.2l1.3-1.4-1.9-1-.9.8a5 5 0 0 1-2.4-2.4l.8-.9-1-1.9z" fill="currentColor" stroke="none"/></symbol>`],
  ["ic-dm", `<symbol id="ic-dm" viewBox="0 0 24 24"><path d="M21 3.5 3 10.6l7.2 2.7 2.7 7.2z"/><path d="M21 3.5 10.2 13.3"/></symbol>`],
  ["ic-sito", `<symbol id="ic-sito" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/></symbol>`],
  ["ic-microfono", `<symbol id="ic-microfono" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></symbol>`],
  ["ic-cuffie", `<symbol id="ic-cuffie" viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></symbol>`],
  // nuove: regali di «Dona un…», traguardi, titoli
  ["ic-cuore", `<symbol id="ic-cuore" viewBox="0 0 24 24"><path d="M12 20.5S3.6 15.6 2.8 9.6C2.3 5.9 5.9 3.7 8.9 5.4c1.3.7 2.3 1.8 3.1 3 .8-1.2 1.8-2.3 3.1-3 3-1.7 6.6.5 6.1 4.2-.8 6-9.2 10.9-9.2 10.9z"/></symbol>`],
  ["ic-rosa", `<symbol id="ic-rosa" viewBox="0 0 24 24"><path d="M12 12.5V21"/><path d="M12 18c0-2.2 1.6-3.6 4-3.6 0 2.1-1.5 3.6-4 3.6zM12 16.5c0-1.9-1.4-3.1-3.6-3.1 0 1.8 1.3 3.1 3.6 3.1z"/><path d="M7.5 7.8C7.5 5.4 9.5 3.5 12 3.5s4.5 1.9 4.5 4.3c0 2.5-1.9 4.7-4.5 4.7s-4.5-2.2-4.5-4.7z"/><path d="M9.6 7.4c.7 1.2 1.5 1.7 2.4 1.7s1.7-.5 2.4-1.7"/></symbol>`],
  ["ic-corona", `<symbol id="ic-corona" viewBox="0 0 24 24"><path d="M4.5 18.5h15M4 17.5 3 8.5l5 3.6L12 5l4 7.1 5-3.6-1 9z"/></symbol>`],
  ["ic-regalo", `<symbol id="ic-regalo" viewBox="0 0 24 24"><rect x="3.5" y="9.5" width="17" height="11" rx="1.5"/><path d="M12 9.5v11M3.5 13.5h17"/><path d="M12 9.5C9.6 9.5 7.5 8.6 7.5 6.9c0-1.4 1.2-2.2 2.4-1.8C11.2 5.5 12 7.4 12 9.5zM12 9.5c2.4 0 4.5-.9 4.5-2.6 0-1.4-1.2-2.2-2.4-1.8C12.8 5.5 12 7.4 12 9.5z"/></symbol>`],
  ["ic-stella", `<symbol id="ic-stella" viewBox="0 0 24 24"><path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></symbol>`],
  ["ic-diamante", `<symbol id="ic-diamante" viewBox="0 0 24 24"><path d="M6.5 4h11l4 5.5L12 20.5 2.5 9.5z"/><path d="M2.5 9.5h19M9.2 4 7.5 9.5l4.5 11 4.5-11L14.8 4"/></symbol>`],
  ["ic-lucchetto", `<symbol id="ic-lucchetto" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/></symbol>`],
  ["ic-spunta", `<symbol id="ic-spunta" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11"/></symbol>`],
  ["ic-play", `<symbol id="ic-play" viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></symbol>`],
  ["ic-cappello", `<symbol id="ic-cappello" viewBox="0 0 24 24"><path d="M7.5 15v5h9v-5"/><path d="M7.5 15A4.2 4.2 0 0 1 6.2 7 4.6 4.6 0 0 1 12 4.6 4.6 4.6 0 0 1 17.8 7a4.2 4.2 0 0 1-1.3 8"/><path d="M7.5 17.5h9"/></symbol>`],
  ["ic-manopole", `<symbol id="ic-manopole" viewBox="0 0 24 24"><path d="M6 3.5v17M12 3.5v17M18 3.5v17"/><rect x="3.8" y="13" width="4.4" height="3.6" rx="1" fill="currentColor"/><rect x="9.8" y="7" width="4.4" height="3.6" rx="1" fill="currentColor"/><rect x="15.8" y="10.5" width="4.4" height="3.6" rx="1" fill="currentColor"/></symbol>`],
];

export const ID_SIMBOLI = [...GRADIENTI, ...SIMBOLI].map(([id]) => id);

// Il markup dell'<svg> nascosto con tutti i <defs>.
export const svgSimboli = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...GRADIENTI, ...SIMBOLI].map(([, markup]) => markup).join("")}</defs></svg>`;

// Lo mette in testa al body (una volta sola).
export function iniettaSimboli() {
  if (document.getElementById("g-cromo")) return;
  document.body.insertAdjacentHTML("afterbegin", svgSimboli());
}
