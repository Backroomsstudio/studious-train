export const meta = {
  name: 'nuovo-overlay-live',
  description: 'Crea un nuovo overlay live TikTok per Backrooms Studio partendo da overlay-live: progetta, costruisce, verifica e corregge',
  whenToUse: 'Quando lo studio chiede un altro overlay per le live (simile a overlay-live). args: { nome, cartella, descrizione, screenshot?, cornice? }',
  phases: [
    { title: 'Capisci', detail: 'modello da riusare e posizioni dallo screenshot' },
    { title: 'Progetta', detail: '3 angoli (leggibilità, intrattenimento, conversione) e sintesi' },
    { title: 'Costruisci', detail: 'un agente scrive il nuovo overlay nella sua cartella' },
    { title: 'Verifica', detail: 'posizioni e leggibilità, logica e test, suoni, consegna' },
    { title: 'Correggi', detail: 'correzioni e nuova verifica, al massimo 2 giri' },
  ],
}

// args: {
//   nome: 'Battle freestyle',                    // nome del formato, per titoli e documenti
//   cartella: 'overlay-freestyle',               // cartella nuova nella radice del repo
//   descrizione: 'due rapper per round, la chat vota 1 o 2, ...',  // cosa deve fare, con le parole dello studio e le regole decise
//   porta: 4757,                                 // facoltativo: porta del server dal registro (SKILL.md, regola 11); webhook = porta + 1
//   screenshot: '/percorso/anteprima.jpg',       // facoltativo: anteprima di LIVE Studio con la disposizione voluta
//   cornice: { x: 1, y: 5, larghezza: 720, altezza: 1585 },  // facoltativo: cornice del telefono nello screenshot (valori d'esempio)
// }
const A = args ?? {}
if (!A.cartella || !A.descrizione) throw new Error('Servono almeno args.cartella e args.descrizione')
const RADICE = '/home/user/studious-train'
const SKILL = `${RADICE}/.claude/skills/overlay-live-tiktok`
const MODELLO = `${RADICE}/overlay-live`
const NUOVO = `${RADICE}/${A.cartella}`
const NOME = A.nome ?? A.cartella
const PORTA = Number(A.porta) || null
const FERMA = "ferma solo i server che hai avviato tu, per porta: kill $(lsof -ti tcp:<porta> -sTCP:LISTEN) (mai pkill: fermerebbe anche i server degli altri agenti)"

const BASE = `
Lavori per Backrooms Studio (studio di registrazione, 3 giovani liberi professionisti; tutto in italiano).
Nuovo overlay: "${NOME}" nella cartella ${NUOVO}. Richiesta dello studio:
"""${A.descrizione}"""
${PORTA ? `Porte del nuovo overlay (in config.esempio.json): porta ${PORTA}, nero.portaWebhook ${PORTA + 1}.` : 'Porte del nuovo overlay: la prima coppia libera del registro in SKILL.md, regola 11 (4747/4748 sono di overlay-live).'}
${A.screenshot ? `Screenshot dell'anteprima di TikTok LIVE Studio con la disposizione voluta: ${A.screenshot}${A.cornice ? ` (cornice del telefono nello screenshot: ${JSON.stringify(A.cornice)})` : ''}.` : 'Nessuno screenshot: usa le posizioni del modello, dentro la zona visibile sui telefoni.'}
Prima di tutto leggi la skill ${SKILL}/SKILL.md e i riferimenti che ti servono: contiene il metodo, le regole e gli strumenti (${SKILL}/strumenti/). Il modello da cui partire è ${MODELLO}.
Non fare commit né push: li fa la sessione principale dopo la verifica.`

const ELENCO = { type: 'array', items: { type: 'string' } }
const PROBLEMI = {
  type: 'object',
  properties: {
    problemi: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gravita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
          problema: { type: 'string' },
          prova: { type: 'string' },
          correzione: { type: 'string' },
        },
        required: ['gravita', 'problema', 'prova', 'correzione'],
      },
    },
  },
  required: ['problemi'],
}

// ---------- Capisci ----------
phase('Capisci')
const [riuso, posizioni] = await parallel([
  () => agent(`${BASE}
Compito: piano di RIUSO del modello per il nuovo formato. Leggi il codice di ${MODELLO} (server.mjs, lib/, public/, test/, config.esempio.json) e la skill.
Dimmi: cosa si copia tale e quale, cosa si adatta (con le modifiche precise alla logica di voto/punteggio/classifica/stato; per un formato diverso dalla recensione segui riferimenti/architettura-e-riuso.md §4bis), cosa si toglie (se il formato non usa Nero: riferimenti/integrazioni.md §0), cosa si aggiunge; quali test vanno riscritti; porte (vedi sopra). Non modificare file.`,
    { label: 'capisci:riuso', phase: 'Capisci', schema: {
      type: 'object',
      properties: { copia: ELENCO, adatta: ELENCO, togli: ELENCO, aggiungi: ELENCO, test: ELENCO, porte: { type: 'string' }, rischi: ELENCO },
      required: ['copia', 'adatta', 'togli', 'aggiungi', 'test', 'porte', 'rischi'],
    } }),
  () => agent(`${BASE}
Compito: POSIZIONI dei riquadri sulla tela 1080×1920. ${A.screenshot ? `Apri lo screenshot (Read) e misuralo con il metodo della skill (riferimenti/posizioni-e-leggibilita.md): cornice del telefono, verifica ritaglio e non stiramento, formula, zone coperte dall'app TikTok. Puoi usare python3 con PIL per misurare la luminosità lungo righe e colonne.` : 'Parti dal blocco di variabili in cima a overlay.css del modello e adatta ai riquadri del nuovo formato.'}
Restituisci per ogni riquadro x, y, larghezza, altezza in pixel della tela, tutto dentro x 116…964 e y 282…1756, più le note utili (cosa resta scoperto, rischio commenti in basso a sinistra). Non modificare file.`,
    { label: 'capisci:posizioni', phase: 'Capisci', schema: {
      type: 'object',
      properties: {
        zona_visibile: { type: 'string' },
        riquadri: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, larghezza: { type: 'number' }, altezza: { type: 'number' }, contenuto: { type: 'string' } }, required: ['nome', 'x', 'y', 'larghezza', 'altezza', 'contenuto'] } },
        note: ELENCO,
      },
      required: ['zona_visibile', 'riquadri', 'note'],
    } }),
])
if (!riuso || !posizioni) throw new Error('Fase Capisci incompleta: rilancia con resumeFromRunId dopo aver controllato il journal')
const CAPITO = `PIANO DI RIUSO:\n${JSON.stringify(riuso, null, 1)}\nPOSIZIONI:\n${JSON.stringify(posizioni, null, 1)}`

// ---------- Progetta ----------
phase('Progetta')
const ANGOLI = [
  { key: 'leggibilita', lente: 'LEGGIBILITÀ E CHIAREZZA: chi entra in live da telefono deve capire in 3 secondi cosa succede, chi sta vincendo, come partecipare. Corpi dei caratteri, contrasti, gerarchia, cosa togliere.' },
  { key: 'intrattenimento', lente: "INTRATTENIMENTO: animazioni e effetti sonori per ogni momento (quali eventi, quale effetto, sincronia), tensione (timer, ultimi minuti, colpi di scena), momenti da clip per i social." },
  { key: 'conversione', lente: 'CONVERSIONE: lo studio vive di questo (obiettivo 10.000 €/mese). Come l\'overlay porta submission su nero.fan/backrooms e clienti allo studio: premio, frasi a rotazione, call to action, tier pagati (Skip, Super Skip, Throne) messi in risalto, senza diventare spam.' },
]
const proposte = await parallel(ANGOLI.map(a => () => agent(`${BASE}
${CAPITO}
Compito: proponi il PROGETTO del nuovo overlay dalla lente ${a.lente}
Concreto: riquadri e contenuti, stati e comandi della regia, eventi e suoni, testi esatti in italiano, cosa testare. Non modificare file.`,
  { label: `progetta:${a.key}`, phase: 'Progetta' })))
const spec = await agent(`${BASE}
${CAPITO}
Tre proposte indipendenti (leggibilità, intrattenimento, conversione):
${proposte.map((p, i) => `--- ${ANGOLI[i].key} ---\n${p ?? '(mancante)'}`).join('\n')}
Compito: scrivi la SPECIFICA FINALE unendo il meglio, risolvendo i conflitti a favore della leggibilità e di ciò che lo studio ha chiesto. Deve bastare a chi costruisce: elenco file da creare/modificare in ${NUOVO}, stato e comandi, logica di voto e punteggio, riquadri con coordinate, testi, eventi → suoni, test da scrivere, documenti (README, GUIDA.html, mockup) e cosa resta da provare dal vivo. Non modificare file.`,
  { label: 'progetta:sintesi', phase: 'Progetta' })
if (!spec) throw new Error('Specifica mancante')

// ---------- Costruisci ----------
phase('Costruisci')
const costruito = await agent(`${BASE}
SPECIFICA DA REALIZZARE:
${spec}
Compito: costruisci il nuovo overlay in ${NUOVO} partendo da una copia di ${MODELLO} (senza node_modules, dati/, config.json), seguendo la specifica e le regole della skill. Poi:
- npm install --omit=dev e npm test dentro ${NUOVO}: tutti i test devono passare (scrivi quelli nuovi della logica e dei suoni);
- avvia il server (porta della specifica) e fai gli screenshot con ${SKILL}/strumenti/scatta.mjs (?anteprima=1&statico=1) dopo aver creato gli stati con i comandi API; guardali (Read) e correggi quello che non va;
- rigenera mockup/, aggiorna README.md e GUIDA.html per il nuovo formato;
- ${FERMA}; togli dati/ e config.json creati dalle prove.
Riporta file creati, test, screenshot salvati (percorsi) e dubbi.`,
  { label: 'costruisci', phase: 'Costruisci', schema: {
    type: 'object',
    properties: { file: ELENCO, test: { type: 'string' }, screenshot: ELENCO, porta: { type: 'number' }, dubbi: ELENCO },
    required: ['file', 'test', 'screenshot', 'porta', 'dubbi'],
  } })
if (!costruito) throw new Error('Costruzione non completata')

// ---------- Verifica e Correggi ----------
// I verificatori girano in parallelo: ognuno lavora su una COPIA nel suo scratchpad, con porte sue (4900 + 10 × indice).
const VERIFICHE = [
  { key: 'posizioni', prompt: `POSIZIONI E LEGGIBILITÀ. Avvia il server della tua copia, fai screenshot statici e ${A.screenshot ? `il prima/dopo con strumenti/composito.py sullo screenshot ${A.screenshot}` : 'con ?guide=1'}; guardali. Controlla: tutto dentro x 116…964 e fuori dalle zone dell'app; nessun testo sotto ~22 px (leggi il CSS); testi lunghi misurati con strumenti/misura-testo.mjs; podio, timer rosso negli ultimi 30 minuti (crea lo stato con il countdown), schermate finali dentro la zona visibile.` },
  { key: 'logica', prompt: `LOGICA E TEST. npm test in ${NUOVO}; leggi la logica di voto/punteggio/classifica e cerca casi limite (pareggi, voti fuori scala, doppio voto, conferma ripetuta, riavvio con stato salvato vecchio); esegui i comandi API sul server della tua copia e controlla /api/stato (giro intero del formato: checklist punto 8bis); se ${NUOVO} usa Nero, prova con strumenti/nero-finto.mjs e NERO_API.` },
  { key: 'suoni', prompt: `SUONI. Elenca ogni animazione/evento dell'overlay e controlla che abbia un effetto e che parta al momento giusto (eventi-sonori e test); misura con strumenti/suoni.mjs livelli (picco < 1, nessuno muto); controlla la scelta overlay/regia/spenti e ?muto=1 nell'anteprima della regia.` },
  { key: 'consegna', prompt: `CONSEGNA E COMPATIBILITÀ. Niente color-mix() o CSS troppo recente; URL della sorgente con .html; sfondo trasparente; README e GUIDA.html aggiornati e coerenti con il codice (porte, tasti, comandi); mockup rigenerati. Prova d'installazione da zero: copia ${NUOVO} senza node_modules/, dati/ e config.json in una cartella nuova dello scratchpad, poi npm install --omit=dev, npm test e avvio del server (lo ZIP vero con strumenti/pacchetto.py si fa dopo il commit, dalla sessione principale).` },
]
const verifica = (lista, giro) => parallel(lista.map(v => () => {
  const n = VERIFICHE.findIndex(x => x.key === v.key)
  return agent(`${BASE}
Il nuovo overlay è costruito in ${NUOVO}. Sei un revisore SCETTICO (giro ${giro}): ${v.prompt}
Lavora su una COPIA di ${NUOVO} nel tuo scratchpad (ricetta in ${SKILL}/riferimenti/verifica-e-consegna.md §0), mai nella cartella vera: altri revisori lavorano in parallelo. Porte tue: server ${4900 + 10 * n}, webhook ${4901 + 10 * n}, Nero finto ${4990 + n}; prima controlla che siano libere con lsof. ${FERMA}.
Riporta solo problemi reali e dimostrati, con la prova e la correzione concreta. Non modificare file del progetto.`,
  { label: `verifica:${v.key}:${giro}`, phase: 'Verifica', schema: PROBLEMI }).then(r => ({ key: v.key, problemi: r?.problemi ?? [] }))
}))

phase('Verifica')
let esiti = await verifica(VERIFICHE, 1)
const storico = []
for (let giro = 1; giro <= 2; giro++) {
  const daSistemare = esiti.filter(Boolean).flatMap(e => e.problemi.filter(p => p.gravita !== 'bassa').map(p => ({ ...p, area: e.key })))
  const minori = esiti.filter(Boolean).flatMap(e => e.problemi.filter(p => p.gravita === 'bassa').map(p => ({ ...p, area: e.key })))
  storico.push({ giro, problemi: daSistemare.length, minori: minori.length })
  log(`Giro ${giro}: ${daSistemare.length} problemi da sistemare, ${minori.length} minori`)
  if (!daSistemare.length && !minori.length) break
  phase('Correggi')
  await agent(`${BASE}
Correggi in ${NUOVO} questi problemi trovati dai revisori (controlla ognuno prima di cambiare; scarta quelli falsi):
${JSON.stringify([...daSistemare, ...minori], null, 1)}
Dopo le correzioni: npm test deve passare; rifai gli screenshot toccati e guardali; ${FERMA}; togli dati/ e config.json di prova.`,
    { label: `correggi:${giro}`, phase: 'Correggi' })
  if (!daSistemare.length) break
  phase('Verifica')
  const aree = new Set(daSistemare.map(p => p.area))
  esiti = await verifica(VERIFICHE.filter(v => aree.has(v.key)), giro + 1)
}
const restanti = esiti.filter(Boolean).flatMap(e => e.problemi.filter(p => p.gravita !== 'bassa'))
if (restanti.length) log(`ATTENZIONE: restano ${restanti.length} problemi dopo 2 giri di correzione`)

return { cartella: NUOVO, porta: costruito.porta, file: costruito.file, screenshot: costruito.screenshot, dubbi: costruito.dubbi, storico, restanti }
