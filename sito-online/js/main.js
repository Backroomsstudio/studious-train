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
  var map = { studio: 'studio', prezzi: 'prezzi', percorso: 'percorso', team: 'team', recensioni: 'recensioni', faq: 'recensioni' };
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
