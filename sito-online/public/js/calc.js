/* Backrooms Studio — calcolatore preventivo (home e /preventivo/), prezzi del Listino 2026 */
(function () {
  'use strict';
  if (!document.getElementById('q_sess')) return;
  var WA = '393248911607', MAIL = 'backrooms.studios.vi@gmail.com';
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var $i = function (id) { return document.getElementById(id); };
  var KEYS = ['sess', 'beat', 'mm', 'ore', 'sala'].filter(function (k) { return $i('q_' + k); });
  var PREZZO = { sess: 50, beat: 60, mm: 70, sala: 35 };
  var NOME = { sess: ['sessione', 'sessioni'], beat: ['beat su misura', 'beat su misura'], mm: ['mix & master', 'mix & master'], ore: ['ora di corso', 'ore di corso'], sala: ['ora di sala senza fonico', 'ore di sala senza fonico'] };
  // sconto sui servizi (sessioni + beat + mix & master), in qualsiasi combinazione; corsi e sala hanno il loro prezzo
  function sconto(n) { return n >= 10 ? .3 : n >= 5 ? .2 : n >= 3 ? .1 : 0; }
  // le ore di corso hanno la loro scala: 1 ora €25, 5 ore €22, 10 ore €18, 20 ore €16
  function euroOra(h) { return h >= 20 ? 16 : h >= 10 ? 18 : h >= 5 ? 22 : 25; }
  function euro(v) { return '€' + v.toLocaleString('it-IT'); }
  function readQ() { var q = { sess: 0, beat: 0, mm: 0, ore: 0, sala: 0 }; KEYS.forEach(function (k) { var v = parseInt($i('q_' + k).value, 10); if (isNaN(v) || v < 0) v = 0; if (v > 99) v = 99; q[k] = v; }); return q; }
  function recalc() {
    var q = readQ(), n = q.sess + q.beat + q.mm, d = sconto(n), tot = 0, full = 0, p = [];
    KEYS.forEach(function (k) {
      var pieno = k === 'ore' ? q.ore * 25 : q[k] * PREZZO[k],
        netto = k === 'ore' ? q.ore * euroOra(q.ore) : k === 'sala' ? pieno : Math.round(pieno * (1 - d));
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
    if (n === 0 && q.ore === 0 && q.sala === 0) msg = 'Scegli i servizi che ti servono: più ne prendi, meno paghi.';
    $i('r_msg').textContent = msg;
    var txt = 'Ciao Backrooms Studio! Ho visto il sito. ' + (p.length ? 'Vorrei questo pacchetto: ' + p.join(', ') + ' (totale dal calcolatore: ' + euro(tot) + ').' : 'Vorrei informazioni sui vostri servizi.') + ' Quando possiamo fissare?';
    $i('calc_wa').href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(txt);
    $i('calc_mail').href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Richiesta pacchetto') + '&body=' + encodeURIComponent(txt);
  }
  $$('.stepper button').forEach(function (b) { b.addEventListener('click', function () { var el = $i('q_' + b.getAttribute('data-k')); el.value = Math.max(0, Math.min(99, (parseInt(el.value, 10) || 0) + parseInt(b.getAttribute('data-d'), 10))); recalc(); }); });
  $$('.stepper input').forEach(function (i) { i.addEventListener('input', recalc); i.addEventListener('change', function () { i.value = readQ()[i.getAttribute('data-k')]; recalc(); }); });
  recalc();
})();
