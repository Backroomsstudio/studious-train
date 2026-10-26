/* Backrooms Studio — sito 2026 */
(function () {
  'use strict';
  var CONFIG = {
    whatsapp: '393248911607',
    email: 'backrooms.studios.vi@gmail.com',
    // ID di Google Analytics 4 già usato dal sito precedente. Analytics parte solo se l'utente accetta il banner.
    gaId: 'G-VTL6MDD9VZ'
  };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var consent = null;
  try { consent = localStorage.getItem('bs_consent'); } catch (e) {}

  /* ---------- analytics (solo con consenso) ---------- */
  function track(name, params) {
    if (window.gtag && consent === 'yes') { try { window.gtag('event', name, params || {}); } catch (e) {} }
  }
  function loadGA() {
    if (!CONFIG.gaId || window.__ga) return; window.__ga = true;
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.gaId; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', CONFIG.gaId, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  }
  var ck = $('#cookie');
  function setConsent(v) { consent = v; try { localStorage.setItem('bs_consent', v); } catch (e) {} ck.hidden = true; if (v === 'yes') loadGA(); }
  if (consent === 'yes') loadGA(); else if (consent !== 'no' && CONFIG.gaId) ck.hidden = false;
  $('#ck_yes').addEventListener('click', function () { setConsent('yes'); });
  $('#ck_no').addEventListener('click', function () { setConsent('no'); });
  $('#cookiemgr').addEventListener('click', function (e) { e.preventDefault(); ck.hidden = false; });
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-track]'); if (a) track('click_' + a.getAttribute('data-track')); });

  /* ---------- header / sezioni attive ---------- */
  var hdr = $('#hdr');
  function onScroll() { hdr.classList.toggle('solid', window.scrollY > 40); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  var map = { studio: 'studio', team: 'team', prezzi: 'prezzi', percorso: 'prezzi', live: 'live', ascolta: 'ascolta', recensioni: 'recensioni', faq: 'recensioni', contatti: 'contatti' };
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var k = map[e.target.id]; if (!k) return;
        $$('.nav a, .qnav a[data-q]').forEach(function (a) { var h = (a.getAttribute('href') || '').replace('#', ''); var q = a.getAttribute('data-q'); a.classList.toggle('on', h === k || q === k); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { so.observe(s); });
    var ro = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } }); }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    $$('.rv').forEach(function (el) { ro.observe(el); });
  } else { $$('.rv').forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- servizi e prezzi: schede (senza JS restano tutte visibili) ---------- */
  var tabs = $$('[role="tab"]');
  function selectTab(t, focus) {
    tabs.forEach(function (o) {
      var on = o === t;
      o.setAttribute('aria-selected', on ? 'true' : 'false'); o.tabIndex = on ? 0 : -1;
      document.getElementById(o.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.type = 'button';
    t.addEventListener('click', function () { selectTab(t); track('scheda_prezzi', { scheda: t.id }); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  if (tabs.length) selectTab(tabs[0]);

  /* ---------- carosello foto team ---------- */
  $$('.tc').forEach(function (tc) {
    var slides = $('.slides', tc), imgs = $$('img', slides), thumbs = $('.thumbs', tc), idx = 0;
    imgs.forEach(function (im, i) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Foto ' + (i + 1)); var t = document.createElement('img'); t.src = im.src.replace('.webp', '-sm.webp'); t.alt = ''; b.appendChild(t); b.addEventListener('click', function () { go(i); }); thumbs.appendChild(b); });
    function go(i) { idx = (i + imgs.length) % imgs.length; slides.style.transform = 'translateX(-' + (idx * 100) + '%)'; $$('button', thumbs).forEach(function (c, j) { c.classList.toggle('on', j === idx); }); }
    var l = $('.arrow.l', tc), r = $('.arrow.r', tc);
    if (l) l.addEventListener('click', function () { go(idx - 1); }); if (r) r.addEventListener('click', function () { go(idx + 1); });
    var sx = null; tc.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    tc.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); });
    go(0);
  });

  /* ---------- calcolatore: prezzi del Listino 2026 ---------- */
  var PREZZO = { sess: 50, beat: 60, mm: 70 };
  var NOME = { sess: ['sessione', 'sessioni'], beat: ['beat su misura', 'beat su misura'], mm: ['mix & master', 'mix & master'], ore: ['ora di corso', 'ore di corso'] };
  // sconto sui servizi (sessioni + beat + mix & master), in qualsiasi combinazione
  function sconto(n) { return n >= 10 ? .3 : n >= 5 ? .2 : n >= 3 ? .1 : 0; }
  // le ore di corso hanno la loro scala: 1 ora €25, 5 ore €22, 10 ore €18, 20 ore €16
  function euroOra(h) { return h >= 20 ? 16 : h >= 10 ? 18 : h >= 5 ? 22 : 25; }
  function euro(v) { return '€' + v.toLocaleString('it-IT'); }
  function readQ() { var q = {}; ['sess', 'beat', 'mm', 'ore'].forEach(function (k) { var v = parseInt($('#q_' + k).value, 10); if (isNaN(v) || v < 0) v = 0; if (v > 99) v = 99; q[k] = v; }); return q; }
  function recalc() {
    var q = readQ(), n = q.sess + q.beat + q.mm, d = sconto(n), tot = 0, full = 0, p = [], $i = function (id) { return document.getElementById(id); };
    ['sess', 'beat', 'mm', 'ore'].forEach(function (k) {
      var pieno = k === 'ore' ? q.ore * 25 : q[k] * PREZZO[k], netto = k === 'ore' ? q.ore * euroOra(q.ore) : Math.round(pieno * (1 - d));
      tot += netto; full += pieno;
      $i('rn_' + k).textContent = q[k] + ' × ' + NOME[k][q[k] === 1 ? 0 : 1];
      $i('rs_' + k).textContent = netto < pieno ? euro(pieno) : '';
      $i('r_' + k).textContent = euro(netto);
      $i('rl_' + k).classList.toggle('dim', q[k] === 0);
      if (q[k]) p.push(q[k] + ' ' + NOME[k][q[k] === 1 ? 0 : 1]);
    });
    $i('r_tot').textContent = euro(tot);
    $i('r_was').textContent = full > tot ? euro(full) : '';
    $i('r_pct').textContent = d ? 'Sconto −' + Math.round(d * 100) + '%' : 'Prezzo di listino';
    $i('r_save').textContent = full > tot ? 'Risparmi ' + euro(full - tot) : 'Nessuno sconto';
    $$('.tierchips [data-t]').forEach(function (c) { c.classList.toggle('on', +c.getAttribute('data-t') === (d === .3 ? 3 : d === .2 ? 2 : d === .1 ? 1 : 0)); });
    var steps = [3, 5, 10], msg = 'Hai raggiunto lo sconto massimo sui servizi. Ottima scelta!';
    for (var i = 0; i < steps.length; i++) { if (n < steps[i]) { var k = steps[i] - n; msg = 'Aggiungi ' + k + (k === 1 ? ' servizio' : ' servizi') + ' e lo sconto sale al −' + [10, 20, 30][i] + '% su tutti.'; break; } }
    if (n === 0 && q.ore === 0) msg = 'Scegli i servizi che ti servono: più ne prendi, meno paghi.';
    $i('r_msg').textContent = msg;
    var txt = 'Ciao Backrooms Studio! Ho visto il sito. ' + (p.length ? 'Vorrei questo pacchetto: ' + p.join(', ') + ' (totale dal calcolatore: ' + euro(tot) + ').' : 'Vorrei informazioni sui vostri servizi.') + ' Possiamo partire con la prima sessione gratuita?';
    $i('calc_wa').href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(txt);
    $i('calc_mail').href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Richiesta pacchetto') + '&body=' + encodeURIComponent(txt);
  }
  if ($('#q_sess')) {
    $$('.stepper button').forEach(function (b) { b.addEventListener('click', function () { var el = $('#q_' + b.getAttribute('data-k')); el.value = Math.max(0, Math.min(99, (parseInt(el.value, 10) || 0) + parseInt(b.getAttribute('data-d'), 10))); recalc(); }); });
    $$('.stepper input').forEach(function (i) { i.addEventListener('input', recalc); i.addEventListener('change', function () { i.value = readQ()[i.getAttribute('data-k')]; recalc(); }); });
    recalc();
  }

  /* ---------- contenuti di terzi (click-to-load) ---------- */
  $('#spotload').addEventListener('click', function () {
    var f = document.createElement('iframe'); f.title = 'Playlist ufficiale Backrooms Studio su Spotify'; f.src = 'https://open.spotify.com/embed/playlist/4Hc9yJ8rSnKS8J9gKa57nw?theme=0';
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'; f.loading = 'lazy'; var box = $('#spot'); box.style.minHeight = '452px'; box.innerHTML = ''; box.appendChild(f);
    track('carica_spotify');
  });
  $('#maploadbtn').addEventListener('click', function () {
    var f = document.createElement('iframe'); f.title = 'Mappa: Backrooms Studio, Arcugnano'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://maps.google.com/maps?q=' + encodeURIComponent('Via Galileo Galilei 3, 36057 Arcugnano VI') + '&z=16&output=embed'; var box = $('#mapbox'); box.innerHTML = ''; box.appendChild(f);
  });

  /* ---------- cronometro LIVE (decorativo) ---------- */
  var lt = $('#livetime'), sec0 = 11;
  setInterval(function () { sec0++; var h = Math.floor(sec0 / 3600), m = Math.floor(sec0 % 3600 / 60), s = sec0 % 60; lt.textContent = [h, m, s].map(function (n) { return n < 10 ? '0' + n : n; }).join(':'); }, 1000);

  /* ---------- recensioni ---------- */
  var revs = $('#revs');
  function rstep(d) { var c = $('.rev', revs); revs.scrollBy({ left: d * (c.offsetWidth + 20), behavior: 'smooth' }); }
  $('#rprev').addEventListener('click', function () { rstep(-1); }); $('#rnext').addEventListener('click', function () { rstep(1); });

  /* ---------- prenotazione ---------- */
  var dlg = $('#book'), form = $('#bookform');
  function openBook(svc) {
    if (svc) { var s = form.elements.servizio; for (var i = 0; i < s.options.length; i++) { if (s.options[i].text.indexOf(svc.split(' (')[0]) === 0) { s.selectedIndex = i; break; } } }
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    track('apri_prenotazione', { servizio: svc || '' });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-book]'); if (b) { e.preventDefault(); openBook(b.getAttribute('data-svc')); } });
  // le pagine servizio rimandano qui con #prenota
  if (location.hash === '#prenota') openBook('Prima sessione gratuita');
  $('#bookx').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  function bookText() {
    var f = form.elements, L = ['Ciao Backrooms Studio! Vorrei prenotare.'];
    L.push('Nome: ' + (f.nome.value || '-'));
    if (f.contatto.value) L.push('Contatto: ' + f.contatto.value);
    L.push('Servizio: ' + (f.servizio.value || 'da definire'));
    if (f.data.value) L.push('Data preferita: ' + f.data.value);
    L.push('Fascia oraria: ' + f.fascia.value); L.push('Persone in sala: ' + f.persone.value);
    if (f.progetto.value) L.push('Progetto: ' + f.progetto.value);
    return L.join('\n');
  }
  function valid() { var f = form.elements; if (!f.nome.value.trim()) { f.nome.focus(); return false; } if (!f.servizio.value) { f.servizio.focus(); return false; } return true; }
  $('#send_wa').addEventListener('click', function () { if (!valid()) return; track('invio_whatsapp'); window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(bookText()), '_blank', 'noopener'); });
  $('#send_mail').addEventListener('click', function () { if (!valid()) return; track('invio_email'); location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Prenotazione sessione — ' + form.elements.servizio.value) + '&body=' + encodeURIComponent(bookText()); });
})();
