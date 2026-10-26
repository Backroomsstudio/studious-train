/* Backrooms Studio — livello immersivo (2026)
   - Liquido cromato in WebGL nell'hero: gocce che reagiscono a mouse, tocco, click e al ritmo della musica
   - Lounge FM: suoni e musica sintetizzati dal vivo con Web Audio (nessun file), solo se l'utente li accende
   - Cursore a goccia, gocce sui pulsanti, magnetismo, riflessi sulle card 3D
   - Infografiche animate: contatori, viaggio del brano, indicatore del pacchetto
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

  /* =====================================================================
     LIQUIDO WEBGL (hero)
     ===================================================================== */
  var Liquid = (function () {
    var hero = $('.hero');
    var api = { drop: function () {}, pulse: function () {} };
    if (!hero || REDUCED || SAVE || (navigator.deviceMemory && navigator.deviceMemory < 4)) return api;
    var cv = document.createElement('canvas');
    cv.className = 'fx-liquid'; cv.setAttribute('aria-hidden', 'true');
    var gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return api;
    hero.insertBefore(cv, hero.firstChild);

    var N = 12;
    var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var fs = [
      'precision highp float;',
      'uniform vec2 uRes;uniform float uTime;uniform float uPulse;uniform vec4 uD[' + N + '];',
      'float H(vec2 p){',
      '  float h=.03*sin(p.x*3.1+uTime*.35)*sin(p.y*2.3-uTime*.27)+.018*sin((p.x+p.y)*5.7+uTime*.6);',
      '  for(int i=0;i<' + N + ';i++){',
      '    vec4 d=uD[i];float age=uTime-d.z;',
      '    if(age>0.&&age<7.){',
      '      float r=length(p-d.xy);float front=age*.38;',
      '      float env=(1.-smoothstep(front-.18,front,r))*exp(-age*.75)*exp(-r*2.6);',
      '      h+=d.w*(.045*sin(r*40.-age*15.)*env+.25*exp(-r*r*500.)*exp(-age*9.));',
      '    }',
      '  }',
      '  return h;',
      '}',
      'void main(){',
      '  vec2 uv=gl_FragCoord.xy/uRes;vec2 p=gl_FragCoord.xy/uRes.y;float e=1.5/uRes.y;',
      '  float h=H(p);',
      '  vec3 n=normalize(vec3(-(H(p+vec2(e,0.))-h)/e,-(H(p+vec2(0.,e))-h)/e,1.));',
      '  vec3 v=vec3(0.,0.,1.);vec3 r=reflect(-v,n);',
      '  float band=.5+.5*sin(r.x*7.+r.y*4.+uTime*.25);',
      '  vec3 col=vec3(.012,.012,.02);',
      '  col+=vec3(.62,.67,.8)*pow(band,5.)*length(r.xy)*1.6;',
      '  col+=vec3(.56,.61,1.)*pow(1.-n.z,1.6)*1.4;',
      '  vec3 L=normalize(vec3(-.45,.55,.7));',
      '  col+=vec3(1.)*pow(max(dot(reflect(-L,n),v),0.),70.)*1.6;',
      '  col*=mix(.35,1.,smoothstep(.15,.85,uv.x))*(1.+uPulse*.6);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n');
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { cv.remove(); return api; }
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return api; }
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(pr, 'uRes'), uTime = gl.getUniformLocation(pr, 'uTime'), uPulse = gl.getUniformLocation(pr, 'uPulse'), uD = gl.getUniformLocation(pr, 'uD');

    var drops = new Float32Array(N * 4), di = 0, t0 = performance.now(), pulse = 0;
    for (var i = 0; i < N; i++) drops[i * 4 + 2] = -99;
    var W = 1, Hh = 1, scale = window.innerWidth < 700 ? .42 : .6;
    function size() {
      var r = hero.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * scale)); Hh = Math.max(1, Math.round(r.height * scale));
      cv.width = W; cv.height = Hh; gl.viewport(0, 0, W, Hh);
    }
    function now() { return (performance.now() - t0) / 1000; }
    /** x, y in pixel CSS relativi all'hero; amp 0..1 */
    function drop(x, y, amp) {
      var r = hero.getBoundingClientRect();
      drops[di * 4] = (x / r.width) * (W / Hh);
      drops[di * 4 + 1] = 1 - y / r.height;
      drops[di * 4 + 2] = now();
      drops[di * 4 + 3] = amp;
      di = (di + 1) % N;
    }
    function randomDrop(amp) {
      var r = hero.getBoundingClientRect();
      drop(r.width * (.45 + Math.random() * .52), r.height * (.12 + Math.random() * .76), amp);
    }

    var visible = true, raf = 0;
    function frame() {
      raf = 0;
      if (!visible || document.hidden) return;
      pulse *= .9;
      gl.uniform2f(uRes, W, Hh); gl.uniform1f(uTime, now()); gl.uniform1f(uPulse, pulse);
      gl.uniform4fv(uD, drops);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }).observe(hero);
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('resize', size);
    size(); kick();
    requestAnimationFrame(function () { cv.classList.add('on'); });

    // interazione: il mouse sfiora l'acqua, il click è una goccia piena
    var last = 0;
    hero.addEventListener('pointermove', function (e) {
      var t = performance.now(); if (t - last < 110) return; last = t;
      var r = hero.getBoundingClientRect(); drop(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch' ? .5 : .32);
    }, { passive: true });
    hero.addEventListener('pointerdown', function (e) {
      var r = hero.getBoundingClientRect(); drop(e.clientX - r.left, e.clientY - r.top, 1);
    });
    // gocce spontanee finché la musica è spenta
    (function auto() {
      if (!Sound || !Sound.playing()) randomDrop(.55 + Math.random() * .35);
      setTimeout(auto, 1700 + Math.random() * 1600);
    })();
    // prima goccia "di benvenuto"
    setTimeout(function () { randomDrop(1); }, 500);

    api.drop = randomDrop;
    api.pulse = function (v) { pulse = Math.max(pulse, v); };
    return api;
  })();

  /* =====================================================================
     LOUNGE FM — suono sintetizzato (Web Audio)
     ===================================================================== */
  var Sound = (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = null, master, verb, sendBus, noiseBuf, crackle = null, on = false, timer = 0;
    var BPM = 84, SPB = 60 / BPM, step = 0, nextT = 0;
    // Fmaj9 · Em7 · Dm9 · Cmaj9: progressione lo-fi / R&B
    var CHORDS = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 66], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]];
    var PENTA = [72, 74, 76, 79, 81, 84, 86, 88];
    var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
    var listeners = [];

    function init() {
      if (ctx || !AC) return !!ctx;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      // riverbero generato: niente file da scaricare
      verb = ctx.createConvolver();
      var len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      verb.buffer = ir;
      sendBus = ctx.createGain(); sendBus.gain.value = .4; sendBus.connect(verb); verb.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      return true;
    }
    function out(node, wet) { node.connect(master); if (wet) { var g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(sendBus); } }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }

    /** La goccia: il "plip" dell'acqua ha l'intonazione che sale */
    function drop(o) {
      if (!on) return; o = o || {};
      var t = ctx.currentTime + (o.at || 0), f = (o.f || 520) * (.92 + Math.random() * .16);
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * (o.rise || 2.6), t + .07);
      env(g, t, .004, o.vol || .22, o.len || .16);
      osc.connect(g); out(g, o.wet == null ? .5 : o.wet);
      osc.start(t); osc.stop(t + .4);
    }
    function tick() {
      if (!on) return;
      var t = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 2600 + Math.random() * 500;
      env(g, t, .002, .035, .03); osc.connect(g); out(g, .2); osc.start(t); osc.stop(t + .08);
    }
    function chime(level) {
      if (!on) return;
      for (var i = 0; i < 3 + level; i++) drop({ f: hz(PENTA[(i * 2 + level) % PENTA.length]) / 2.2, rise: 2.2, at: i * .07, vol: .16, wet: .8, len: .3 });
    }
    function noise(t, type, freq, vol, dec, wet) {
      var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; fl.type = type; fl.frequency.value = freq; fl.Q.value = .8;
      env(g, t, .002, vol, dec); s.connect(fl); fl.connect(g); out(g, wet); s.start(t, Math.random() * .5); s.stop(t + dec + .05);
    }
    function kick(t) {
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(130, t); osc.frequency.exponentialRampToValueAtTime(44, t + .14);
      env(g, t, .003, .55, .38); osc.connect(g); out(g, 0); osc.start(t); osc.stop(t + .5);
      var delay = Math.max(0, (t - ctx.currentTime) * 1000);
      setTimeout(function () { listeners.forEach(function (fn) { fn(); }); }, delay);
    }
    function pad(t, chord, dur) {
      var fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 2;
      lfo.frequency.value = .18; lg.gain.value = 380; lfo.connect(lg); lg.connect(fl.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .7); g.gain.setValueAtTime(.05, t + dur - .4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .9);
      chord.forEach(function (m) {
        [-7, 7].forEach(function (cents) {
          var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = cents;
          o.connect(fl); o.start(t); o.stop(t + dur + 1);
        });
      });
      var sub = ctx.createOscillator(), sg = ctx.createGain(); sub.type = 'sine'; sub.frequency.value = hz(chord[0] - 12);
      env(sg, t, .02, .16, dur); sub.connect(sg); out(sg, 0); sub.start(t); sub.stop(t + dur + .2);
      fl.connect(g); out(g, .6); lfo.start(t); lfo.stop(t + dur + 1);
    }
    // sequencer con anticipo: 16 sedicesimi per battuta, swing sugli hi-hat
    function schedule() {
      while (nextT < ctx.currentTime + .15) {
        var s = step % 16, bar = Math.floor(step / 16);
        if (s === 0) pad(nextT, CHORDS[bar % 4], SPB * 4);
        if (s === 0 || s === 8 || (s === 11 && bar % 2)) kick(nextT);
        if (s === 4 || s === 12) noise(nextT, 'bandpass', 1900, .16, .14, .7);
        if (s % 2 === 0) noise(nextT + (s % 4 === 2 ? SPB * .08 : 0), 'highpass', 7500, s % 4 ? .03 : .05, .035, .1);
        if (s === 14 && Math.random() < .5) drop({ f: hz(PENTA[Math.floor(Math.random() * PENTA.length)]) / 2, at: nextT - ctx.currentTime, vol: .12, wet: .9, len: .35 });
        nextT += SPB / 4; step++;
      }
    }
    function startCrackle() {
      var s = ctx.createBufferSource(), b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() < .0009 ? (Math.random() * 2 - 1) * .9 : (Math.random() * 2 - 1) * .012;
      s.buffer = b; s.loop = true; var fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 1800;
      var g = ctx.createGain(); g.gain.value = .5; s.connect(fl); fl.connect(g); out(g, 0); s.start(); crackle = s;
    }
    function start() {
      if (!init()) return false;
      on = true; ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.8, ctx.currentTime, .4);
      if (!timer) { step = 0; nextT = ctx.currentTime + .1; timer = setInterval(schedule, 25); startCrackle(); }
      return true;
    }
    function stop() {
      if (!ctx) return; on = false;
      master.gain.setTargetAtTime(0, ctx.currentTime, .12);
      clearInterval(timer); timer = 0;
      if (crackle) { try { crackle.stop(); } catch (e) {} crackle = null; }
      setTimeout(function () { if (!on) ctx.suspend(); }, 700);
    }
    document.addEventListener('visibilitychange', function () {
      if (!ctx || !on) return;
      if (document.hidden) { ctx.suspend(); clearInterval(timer); timer = 0; }
      else { ctx.resume(); nextT = ctx.currentTime + .1; timer = setInterval(schedule, 25); }
    });
    return {
      start: start, stop: stop, drop: drop, tick: tick, chime: chime,
      playing: function () { return on; },
      onBeat: function (fn) { listeners.push(fn); },
      supported: !!AC
    };
  })();

  /* ---------- interruttore del suono ---------- */
  (function () {
    var btns = $$('[data-sound]');
    if (!Sound.supported) { btns.forEach(function (b) { b.hidden = true; }); return; }
    function set(v, user) {
      if (v) { if (!Sound.start()) return; } else Sound.stop();
      btns.forEach(function (b) {
        if (b.classList.contains('fx-invite')) b.hidden = v;
        b.setAttribute('aria-pressed', v ? 'true' : 'false');
        var l = $('.lbl', b); if (l && b.classList.contains('fx-snd')) l.textContent = v ? 'Lounge FM' : 'Suono';
      });
      if (user) { store.set('bs_sound', v ? 'on' : 'off'); track(v ? 'suono_on' : 'suono_off'); }
      if (v) Sound.drop({ f: 700, vol: .25 });
    }
    btns.forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); set(!Sound.playing(), true); }); });
    // chi l'aveva acceso ritrova la musica al primo gesto (i browser vietano l'audio automatico)
    if (store.get('bs_sound') === 'on') {
      var first = function (e) {
        document.removeEventListener('pointerdown', first, true);
        if (e.target.closest('[data-sound]')) return;
        set(true, false);
      };
      document.addEventListener('pointerdown', first, true);
    }
    var root = document.documentElement, beat = 0;
    Sound.onBeat(function () {
      Liquid.drop(.85); Liquid.pulse(.5);
      beat = 1; root.style.setProperty('--beat', '1');
      setTimeout(function () { root.style.setProperty('--beat', '0'); }, 140);
    });
  })();

  /* ---------- micro-suoni dell'interfaccia ---------- */
  var HOT = '.btn,.btn-ghost,.go,a,button,summary,[data-book],.cf .it';
  document.addEventListener('pointerover', function (e) {
    var el = e.target.closest(HOT); if (!el || el.contains(e.relatedTarget)) return;
    if (FINE) Sound.tick();
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest(HOT); if (!el || el.closest('[data-sound]')) return;
    var big = el.matches('.btn,[data-book]');
    Sound.drop({ f: big ? 380 : 620, vol: big ? .3 : .18, wet: big ? .7 : .4 });
  });
  $$('.faq details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) Sound.drop({ f: 820, vol: .14 }); }); });

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
    $$('.btn,.fx-snd,.fx-wa').forEach(function (b) {
      b.classList.add('fx-mag');
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });

    // card 3D: inclinazione che segue il mouse + riflesso di luce
    if (mq('(min-width: 1000px)')) {
      $$('.slab').forEach(function (s) {
        var face = $('.face', s); if (!face) return;
        var gl = document.createElement('span'); gl.className = 'fx-glare'; gl.setAttribute('aria-hidden', 'true'); face.appendChild(gl);
        var cs = getComputedStyle(s), rx0 = cs.getPropertyValue('--rx') || '0deg', ry0 = cs.getPropertyValue('--ry') || '0deg';
        s.addEventListener('pointermove', function (e) {
          var r = s.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          s.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg');
          s.style.setProperty('--rx', ((.5 - py) * 10).toFixed(2) + 'deg');
          face.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); face.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
        s.addEventListener('pointerleave', function () { s.style.setProperty('--ry', ry0); s.style.setProperty('--rx', rx0); });
      });
    }
  }
  // goccia che si allarga dal punto del click (anche su touch)
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.btn,.btn-ghost,.go'); if (!b || REDUCED) return;
    var r = b.getBoundingClientRect(), d = document.createElement('span');
    d.className = 'fx-drop'; d.style.left = (e.clientX - r.left) + 'px'; d.style.top = (e.clientY - r.top) + 'px';
    b.appendChild(d); setTimeout(function () { d.remove(); }, 800);
  });

  /* =====================================================================
     SCROLL: barra d'avanzamento, profondità di lettura, viaggio del brano
     ===================================================================== */
  var bar = document.createElement('div'); bar.className = 'fx-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  var wa = null;
  if (!$('.fx-wa')) {
    wa = document.createElement('a');
    wa.className = 'fx-wa'; wa.target = '_blank'; wa.rel = 'noopener'; wa.setAttribute('data-track', 'whatsapp_flottante');
    wa.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Ciao Backrooms Studio! Ho visto il sito e vorrei prenotare la prima sessione gratuita.');
    wa.setAttribute('aria-label', 'Scrivici su WhatsApp');
    wa.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg><span>Scrivici ora</span>';
    document.body.appendChild(wa);
  }
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
  var depth = {}, ticking = false, lit = -1, hero = $('.hero'), ctaSeen = 0;
  // il pulsante flottante si fa da parte quando sullo schermo c'è già un invito all'azione
  if (wa && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { ctaSeen += e.isIntersecting ? 1 : -1; });
      ctaSeen = Math.max(0, ctaSeen); onScroll();
    });
    $$('.calc-cta,.path-cta,.final .cta,.intro .cta').forEach(function (el) { cio.observe(el); });
  }
  function onScroll() {
    ticking = false;
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight, p = max > 0 ? h.scrollTop / max : 0;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    [50, 90].forEach(function (m) { if (p * 100 >= m && !depth[m]) { depth[m] = 1; track('scroll_' + m); } });
    if (wa) wa.classList.toggle('show', !ctaSeen && (!hero || h.scrollTop > hero.offsetHeight * .7));
    if (path && !REDUCED) {
      var r = path.getBoundingClientRect(), vh = window.innerHeight;
      var pp = clamp((vh * .85 - r.top) / (r.height + vh * .35), 0, 1);
      path.style.setProperty('--p', pp.toFixed(3));
      if (fg) fg.style.strokeDashoffset = (len * (1 - pp)).toFixed(1);
      var n = Math.floor(pp * steps.length * 1.05 - .15);
      steps.forEach(function (s, i) { s.classList.toggle('on', i <= n); });
      if (n > lit) { for (var k = lit + 1; k <= n && k < steps.length; k++) Sound.drop({ f: 300 + k * 110, vol: .2, wet: .7 }); }
      lit = n;
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll); onScroll();

  /* =====================================================================
     CONTATORI (numeri dell'hero)
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

  /* =====================================================================
     INDICATORE DEL PACCHETTO (calcolatore)
     ===================================================================== */
  var gauge = $('#gauge'), rp = $('#r_pct');
  if (gauge && rp) {
    var C = 326.73, vl = $('.vl', gauge), num = $('.ctr b', gauge), tiers = $$('.tiers span', gauge), lvl = -1;
    function upd() {
      var n = parseInt(rp.textContent, 10) || 0, l = n >= 10 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0;
      vl.style.strokeDashoffset = (C * (1 - Math.min(n, 10) / 10)).toFixed(1);
      num.textContent = n;
      tiers.forEach(function (t) { t.classList.toggle('on', n >= +t.getAttribute('data-min')); });
      if (lvl >= 0 && l > lvl) {
        gauge.classList.remove('pop'); void gauge.offsetWidth; gauge.classList.add('pop');
        Sound.chime(l); burst(gauge);
        track('pacchetto_livello', { livello: l, servizi: n });
      }
      lvl = l;
    }
    new MutationObserver(upd).observe(rp, { childList: true, characterData: true, subtree: true });
    upd();
    $$('.stepper button').forEach(function (b) {
      b.addEventListener('click', function () { Sound.drop({ f: b.getAttribute('data-d') === '1' ? 640 : 420, vol: .2 }); });
    });
  }
  function burst(el) {
    if (REDUCED) return;
    var r = el.getBoundingClientRect(), cx = r.left + 56, cy = r.top + r.height / 2;
    for (var i = 0; i < 14; i++) {
      var b = document.createElement('i'), ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
      b.className = 'fx-bead'; b.style.left = cx + 'px'; b.style.top = cy + 'px';
      b.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      b.style.setProperty('--dy', (Math.sin(ang) * dist - 30).toFixed(0) + 'px');
      document.body.appendChild(b); setTimeout(function (n) { n.remove(); }.bind(null, b), 950);
    }
  }
})();
