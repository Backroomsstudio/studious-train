// «Modalità sicura TikTok», lato pagina. TikTok limita le live che mandano gli spettatori fuori dall'app: indirizzi web, account di
// altre piattaforme (Instagram, Twitch, Kick, WhatsApp…), QR code e contatti sullo schermo. Le pagine degli overlay passano lo stato
// da qui prima di disegnarlo: gli indirizzi diventano «link in bio», gli account spariscono, le voci delle altre piattaforme escono
// dalla barra. La regia riceve lo stato com'è (ci si scrivono i veri indirizzi) e le anteprime mostrano quello che va in onda.
// Funzioni pure: lo stato in ingresso non si modifica, dà una copia.

export const LINK_BIO = "link in bio";
const BLOCCATE = ["instagram", "twitch", "kick", "youtube", "spotify", "whatsapp", "facebook", "telegram", "discord", "twitter", "x", "snapchat"];
const TLD = "it|com|fan|net|org|io|me|tv|gg|co|app|link|bio|ly|be|to|eu|info|shop|store|live|fm|xyz|ws";
const INDIRIZZO = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLD})\\b(?:\\/[^\\s]*)?`, "gi");
const ACCOUNT = /@[\w.]{2,}/g;
// Nomi di altre piattaforme nelle frasi («Seguici su Instagram»); «kick» e «x» mancano apposta: sono anche parole della musica.
const NOMI_PIATTAFORME = /(?:\s+(?:su|sul|sulla|di|dal|da|con))?\s+\b(?:instagram|twitch|youtube|whatsapp|facebook|telegram|discord|snapchat)\b/gi;
// Tracce, artisti, vincitori e dati della live non si riscrivono (un artista può chiamarsi come vuole): solo i loro Instagram e i pagamenti.
const DATI_DELLA_LIVE = new Set(["corrente", "risultati", "classifica", "coda", "ascoltate", "vincitore", "spareggio", "nero", "tiktok"]);

// Un testo senza indirizzi né account: «nero.fan/backrooms» → «link in bio», «@nome» sparisce e con lui il separatore che restava solo.
export function pulisciTesto(valore) {
  if (typeof valore !== "string") return valore;
  let t = valore
    .replace(new RegExp(`\\s+(?:su|sul|sulla|sull'|a|in|da)\\s+(${INDIRIZZO.source})`, "gi"), `: ${LINK_BIO}`)
    .replace(INDIRIZZO, LINK_BIO)
    .replace(ACCOUNT, "")
    .replace(NOMI_PIATTAFORME, "");
  t = t.replace(/\s{2,}/g, " ").replace(/(?:\s*[·|•,;:-]\s*)+$/u, "").replace(/^(?:\s*[·|•,;:-]\s*)+/u, "").replace(/\s+(?:su|sul|a|in|da)\s*$/i, "").trim();
  return t;
}

const icone = (icona) => String(icona).split("+").filter(Boolean);
const bloccata = (nome) => BLOCCATE.includes(nome);

// Una voce con icona: le piattaforme bloccate escono dall'icona. `null` se non resta niente (la voce va tolta).
function iconaSicura(icona, scarto) {
  const restano = icone(icona).filter((nome) => !bloccata(nome));
  return restano.length ? restano.join("+") : scarto;
}

function pulisci(valore, opzioni, chiave = "", inVoci = false) {
  if (Array.isArray(valore)) {
    // Gli elementi che parlano solo di un'altra piattaforma (la barra social, i pop-up «Seguici su Instagram») non vanno in onda;
    // gli ospiti restano, con un'icona neutra.
    return valore.map((x) => pulisci(x, opzioni, chiave, chiave !== "ospiti")).filter((x) => x !== undefined);
  }
  if (valore && typeof valore === "object") {
    // Una voce della barra con le sole piattaforme bloccate non va in onda.
    if (inVoci && typeof valore.icona === "string" && iconaSicura(valore.icona, null) === null) return undefined;
    const fuori = {};
    for (const [k, v] of Object.entries(valore)) {
      if (k === "instagram") fuori[k] = typeof v === "string" ? "" : v;
      else if (k === "tier" && opzioni.nascondiPagamenti) fuori[k] = v === null || v === undefined ? v : "standard";
      else if (k === "icona" && typeof v === "string") fuori[k] = iconaSicura(v, "microfono");
      else fuori[k] = pulisci(v, { ...opzioni, leggero: opzioni.leggero || (opzioni.radice && DATI_DELLA_LIVE.has(k)), radice: false }, k, false);
    }
    // Un account tolto lascia la voce senza testo: resta la dicitura «su TikTok» se l'icona è TikTok.
    if (typeof valore.testo === "string" && valore.testo && !fuori.testo) fuori.testo = icone(fuori.icona ?? "").includes("tiktok") ? "su TikTok" : "";
    return fuori;
  }
  return opzioni.leggero ? valore : pulisciTesto(valore);
}

// Lo stato come va mostrato dalle pagine. Spenta (o con uno stato senza la sezione) dà lo stato com'è.
export function applicaSicurezza(stato) {
  const s = stato?.sicurezza;
  if (!s || s.attiva === false) return stato;
  return pulisci(stato, { nascondiPagamenti: s.nascondiPagamenti === true, radice: true });
}
