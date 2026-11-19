/* ZfP-Portal · Digitale Signatur per Card-ID (Abfrage-Dialog vor dem Druck)
 * ZfPSignatur.abfragen({ titel, hinweis, req, lang, minLaenge }) → Promise<{ name, qual, empId, zeit } | null>
 * req = Qualifikationsanforderung für ZfPCards.check (z. B. { key: 'nital', min: '2' }) oder null (nur gültige Karte). */
(function () {
  'use strict';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function abfragen(o) {
    o = o || {};
    var en = o.lang === 'en';
    return new Promise(function (fertig) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,Segoe UI,Arial,sans-serif';
      ov.innerHTML = '<div style="background:#fff;color:#1a1e24;border-radius:12px;max-width:440px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.4);overflow:hidden">' +
        '<div style="background:#00754a;color:#fff;padding:12px 16px;font-weight:700;font-size:15px">🔏 ' + esc(o.titel || (en ? 'Digital signature' : 'Digitale Signatur')) + '</div>' +
        '<div style="padding:14px 16px">' + (o.hinweis ? '<div style="font-size:13px;color:#4b5563;margin-bottom:10px">' + esc(o.hinweis) + '</div>' : '') +
        '<label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px">' + (en ? 'Card ID (hold card to reader)' : 'Card-ID (Karte an das Lesegerät halten)') + '</label>' +
        '<input type="password" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1.5px solid #9ca3af;border-radius:8px">' +
        '<div style="font-size:11px;color:#6b7280;margin-top:4px">' + (en ? 'Scanned cards are checked automatically; when typing by hand, the check starts after 8 characters (or press Enter).' : 'Gescannte Karten werden automatisch geprüft; bei Handeingabe startet die Prüfung ab 8 Zeichen (oder mit Enter).') + '</div>' +
        '<div class="st" style="min-height:20px;margin-top:8px;font-size:13px"></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button type="button" data-a="x" style="padding:8px 14px;border-radius:8px;border:1px solid #9ca3af;background:#fff;cursor:pointer">' + (en ? 'Cancel' : 'Abbrechen') + '</button>' +
        '<button type="button" data-a="ok" style="padding:8px 14px;border-radius:8px;border:0;background:#00754a;color:#fff;font-weight:700;cursor:pointer">' + (en ? 'Sign' : 'Signieren') + '</button></div></div></div>';
      document.body.appendChild(ov);
      var inp = ov.querySelector('input'), st = ov.querySelector('.st'), busy = false, tmr = null;
      function zu(r) { clearTimeout(tmr); ov.remove(); fertig(r); }
      function pruefen() {
        if (busy) return; var v = inp.value.trim(); if (!v) { st.textContent = ''; return; }
        if (!window.ZfPCards || !ZfPCards.check) { st.style.color = '#b91c1c'; st.textContent = en ? 'Card module not loaded.' : 'Card-Modul nicht geladen.'; return; }
        busy = true; st.style.color = '#4b5563'; st.textContent = en ? 'Checking …' : 'Wird geprüft …';
        ZfPCards.check(v, o.req || null).then(function (r) {
          busy = false;
          if (!r || !r.ok) { st.style.color = '#b91c1c'; st.textContent = (r && r.msg) ? (en ? r.msg.en : r.msg.de) : (en ? 'Card not valid.' : 'Card-ID ungültig.'); inp.select(); return; }
          var jetzt = new Date();
          zu({ name: r.name, qual: r.qual || '', empId: r.empId, zeit: jetzt.toLocaleDateString('de-DE') + ' ' + jetzt.toLocaleTimeString('de-DE').slice(0, 5) });
        }, function () { busy = false; st.style.color = '#b91c1c'; st.textContent = en ? 'Check failed.' : 'Prüfung fehlgeschlagen.'; });
      }
      // Automatische Prüfung erst ab MINLEN Zeichen (Handeingabe: nicht schon nach den ersten Zeichen); Enter bzw. „Signieren“ prüft sofort
      var MINLEN = o.minLaenge || 8;
      inp.addEventListener('input', function () { clearTimeout(tmr); st.textContent = ''; if (inp.value.trim().length >= MINLEN) tmr = setTimeout(pruefen, 700); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tmr); pruefen(); } if (e.key === 'Escape') zu(null); });
      ov.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'x') zu(null); else { clearTimeout(tmr); pruefen(); } });
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
    });
  }
  function anzeige(sig, rolle) {   // HTML-Kasten „Digital signiert von …“ (wie im MT-Protokoll)
    if (!sig) return '';
    var q = String(sig.qual || '').split('\n');
    return '<div style="border:1.5px solid #15803d;background:#f0fdf4;border-radius:4px;padding:4px 8px;text-align:left;font-size:8.5pt;line-height:1.3;color:#14532d">' +
      '<div style="font-weight:700">🔏 Digital signiert von</div><div>' + esc(String(sig.name).replace(', ', ' ')) + (rolle ? ' (' + esc(rolle) + ')' : '') + (q[0] ? ', ' + esc(q[0]) : '') + (q[1] ? '<br>' + esc(q[1]) : '') + '</div>' +
      '<div style="font-size:7.5pt;color:#166534">' + esc(sig.zeit || '') + '</div></div>';
  }
  window.ZfPSignatur = { abfragen: abfragen, anzeige: anzeige };
})();
