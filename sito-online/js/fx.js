/* Backrooms Studio — livello immersivo (2026)
   - Hero: foto dello studio in 3D attorno al logo, seguono il cursore
   - Cursore a goccia, gocce sui pulsanti, magnetismo, luce che segue il mouse sulle card
   - Infografiche: viaggio del brano disegnato allo scroll, contatori
   Ogni pezzo controlla da solo se gli elementi esistono: il file funziona anche nelle pagine servizio. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  var REDUCED = mq('(prefers-reduced-motion: reduce)');
  var FINE = mq('(hover: hover) and (pointer: fine)');
  var SAVE = navigator.connection && navigator.connection.saveData;
  var WA = '393248911607';
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function track(name, params) {
    if (window.gtag && store.get('bs_consent') === 'yes') { try { window.gtag('event', name, params || {}); } catch (e) {} }
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var hero = $('.hero');

  /* =====================================================================
     HERO: foto dello studio in 3D che seguono il cursore (a riposo ondeggiano da sole)
     ===================================================================== */
  (function () {
    var wrap = $('[data-stage]'), stage = wrap && $('.stage', wrap);
    if (!stage || REDUCED) return;
    var tx = 0, ty = 0, x = 0, y = 0, mouse = false, visible = true, t0 = performance.now();
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX / window.innerWidth - .5; ty = e.clientY / window.innerHeight - .5; mouse = true;
    }, { passive: true });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(wrap);
    (function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      var t = (now - t0) / 1000, gx = mouse ? tx : Math.sin(t * .45) * .3, gy = mouse ? ty : Math.cos(t * .33) * .18;
      x += (gx - x) * .06; y += (gy - y) * .06;
      stage.style.transform = 'rotateY(' + (x * 28).toFixed(2) + 'deg) rotateX(' + (-y * 18).toFixed(2) + 'deg)';
    })(t0);
  })();

    var HOT = '.btn,.btn-ghost,.go,a,button,summary,[data-book],[role="tab"]';

  /* =====================================================================
     CURSORE A GOCCIA + GOCCE SUI PULSANTI + MAGNETISMO + RIFLESSI
     ===================================================================== */
  if (FINE && !REDUCED) {
    var cur = document.createElement('div'), ring = document.createElement('div');
    cur.className = 'fx-cur'; ring.className = 'fx-ring';
    cur.setAttribute('aria-hidden', 'true'); ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cur); document.body.appendChild(ring);
    var mx = -100, my = -100, rx = -100, ry = -100, moving = false;
    document.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      cur.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      if (!moving) { moving = true; requestAnimationFrame(follow); }
    }, { passive: true });
    function follow() {
      rx += (mx - rx) * .18; ry += (my - ry) * .18;
      ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
      if (Math.abs(mx - rx) + Math.abs(my - ry) > .3) requestAnimationFrame(follow); else moving = false;
    }
    document.addEventListener('pointerover', function (e) { ring.classList.toggle('hot', !!e.target.closest(HOT)); });
    document.addEventListener('pointerdown', function (e) {
      ring.classList.add('down');
      var s = document.createElement('i'); s.className = 'fx-splash'; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
      document.body.appendChild(s); setTimeout(function () { s.remove(); }, 750);
    });
    document.addEventListener('pointerup', function () { ring.classList.remove('down'); });
    document.documentElement.addEventListener('pointerleave', function () { cur.style.opacity = ring.style.opacity = '0'; });
    document.documentElement.addEventListener('pointerenter', function () { cur.style.opacity = ring.style.opacity = ''; });

    // magnetismo: i pulsanti principali si lasciano "attirare" dal cursore
    $$('.btn,.fx-snd').forEach(function (b) {
      b.classList.add('fx-mag');
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });

    // card: luce che segue il mouse
    $$('.offer,.bento figure,.crew figure').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        c.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }
  // goccia che si allarga dal punto del click (anche su touch)
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.btn,.btn-ghost,.go'); if (!b || REDUCED) return;
    var r = b.getBoundingClientRect(), d = document.createElement('span');
    d.className = 'fx-drop'; d.style.left = (e.clientX - r.left) + 'px'; d.style.top = (e.clientY - r.top) + 'px';
    b.appendChild(d); setTimeout(function () { d.remove(); }, 800);
  });

  /* =====================================================================
     SCROLL: barra d'avanzamento, uscita dalle Backrooms, viaggio del brano
     ===================================================================== */
  var bar = document.createElement('div'); bar.className = 'fx-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  var wa = document.createElement('a');
  wa.className = 'fx-wa'; wa.target = '_blank'; wa.rel = 'noopener'; wa.setAttribute('data-track', 'whatsapp_flottante');
  wa.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Ciao Backrooms Studio! Ho visto il sito e vorrei prenotare la prima sessione gratuita.');
  wa.setAttribute('aria-label', 'Scrivici su WhatsApp');
  wa.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg><span>Scrivici ora</span>';
  document.body.appendChild(wa);

  var path = $('#path'), steps = path ? $$('.path-steps li', path) : [], fg = path ? $('.path-wave .fg', path) : null, len = 0;
  if (path) {
    if (fg) {
      // forma d'onda disegnata in codice: cresce d'intensità come un brano verso il ritornello
      var d = 'M0 70';
      for (var x = 0; x <= 1000; x += 4) {
        var a = 10 + 46 * Math.pow(Math.sin(Math.PI * x / 1000), .6) * (.55 + .45 * Math.sin(x / 37)), y = 70 + a * Math.sin(x / 9.5);
        d += ' L' + x + ' ' + y.toFixed(1);
      }
      $('.path-wave .bg', path).setAttribute('d', d); fg.setAttribute('d', d);
      len = fg.getTotalLength(); fg.style.strokeDasharray = len; fg.style.strokeDashoffset = len;
    }
    if (!REDUCED) path.classList.add('armed'); else steps.forEach(function (s) { s.classList.add('on'); });
  }
  var depth = {}, ticking = false, ctaSeen = 0;
  // il pulsante flottante si fa da parte quando sullo schermo c'è già un invito all'azione
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { ctaSeen += e.isIntersecting ? 1 : -1; });
      ctaSeen = Math.max(0, ctaSeen); onScroll();
    });
    $$('.final .cta,.intro .cta,.free-band,.calc-cta').forEach(function (el) { cio.observe(el); });
  }
  function onScroll() {
    ticking = false;
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight, p = max > 0 ? h.scrollTop / max : 0;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    [50, 90].forEach(function (m) { if (p * 100 >= m && !depth[m]) { depth[m] = 1; track('scroll_' + m); } });
    var hs = hero ? clamp(h.scrollTop / hero.offsetHeight, 0, 1) : 1;
    if (hero) hero.style.setProperty('--s', hs.toFixed(3));
    wa.classList.toggle('show', !ctaSeen && (!hero || hs > .7));
    if (path && !REDUCED) {
      var r = path.getBoundingClientRect(), vh = window.innerHeight;
      var pp = clamp((vh * .85 - r.top) / (r.height + vh * .35), 0, 1);
      path.style.setProperty('--p', pp.toFixed(3));
      if (fg) fg.style.strokeDashoffset = (len * (1 - pp)).toFixed(1);
      var n = Math.floor(pp * steps.length * 1.05 - .15);
      steps.forEach(function (s, i) { s.classList.toggle('on', i <= n); });
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll); onScroll();

  /* =====================================================================
     CONTATORI
     ===================================================================== */
  var stats = $('.stats');
  if (stats && 'IntersectionObserver' in window && !REDUCED) {
    var nums = $$('b', stats).map(function (b) {
      var tn = b.firstChild; if (!tn || tn.nodeType !== 3) return null;
      var m = tn.nodeValue.match(/^(\d+)(.*)$/); if (!m) return null;
      return { node: tn, to: +m[1], rest: m[2] };
    }).filter(Boolean);
    nums.forEach(function (n) { n.node.nodeValue = '0' + n.rest; });
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return; io.disconnect();
      var t0 = performance.now();
      (function run(t) {
        var k = clamp((t - t0) / 1600, 0, 1), e = 1 - Math.pow(1 - k, 4);
        nums.forEach(function (n) { n.node.nodeValue = Math.round(n.to * e) + n.rest; });
        if (k < 1) requestAnimationFrame(run);
      })(t0);
    }, { threshold: .4 });
    io.observe(stats);
  }
})();
