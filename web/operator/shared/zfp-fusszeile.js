/* ZfP-Portal – zentrale Fußzeilen aller Drucke (Admin › System › Druck-Fußzeilen).
 * Jede Fußzeile hat 3 Spalten (links / Mitte / rechts) mit je 2 Zeilen. Die Standardtexte stehen hier; Änderungen des
 * Administrators liegen auf dem Server (/api/druck-fusszeilen) und überschreiben die Standards.
 * Platzhalter in den Texten: {heute} = Druckdatum (TT.MM.JJJJ), je Dokument weitere (z. B. {id}). */
(function () {
  'use strict';
  var KS = ['l1', 'l2', 'm1', 'm2', 'r1', 'r2'];
  var ERST = 'Ersteller: Häusner Daniel, WI/SW2-PQT', FREI = 'Freigeber: Blum Franz, SB/SWE-QT2', COPY = '© 2026 Schaeffler Technologies AG & Co. KG';
  var DEF = {
    operator_autorisierung: { l1: ERST, l2: FREI, m1: 'ZfP Operator Audit', m2: COPY, r1: '29.01.2026', r2: 'Version AB' },
    operator_bericht:       { l1: ERST, l2: FREI, m1: 'ZfP Operator Audit', m2: COPY, r1: '29.01.2026', r2: 'Version AB' },
    review_bericht:         { l1: ERST, l2: FREI, m1: 'ZfP Review Audit',   m2: COPY, r1: '{heute}',    r2: 'Version AE' },
    mt_protokoll:           { l1: ERST + ' · MT Level 3', l2: FREI, m1: 'FBL_INFSW01044_01_Prüfprotokoll_MT', m2: '', r1: '07.05.2026', r2: 'Version AE' },
    aetz_protokoll:         { l1: ERST, l2: FREI, m1: 'FBL_INFSW01004_01_Ätzdokumentation', m2: '', r1: '07.05.2026', r2: 'Version AD' },
    ibg_protokoll:          { l1: ERST, l2: FREI, m1: 'Prüfprotokoll Wirbelstrom (IBG)', m2: '', r1: '{heute}', r2: 'ID {id}' },
    sh1_protokoll:          { l1: ERST, l2: FREI, m1: 'Prüfprotokoll Wirbelstrom (SH1 Linie)', m2: '', r1: '{heute}', r2: 'ID {id}' },
    gefuege_anweisung:      { l1: 'Ersteller: {ersteller}', l2: 'Freigeber: {freigeber}', m1: '{dokument}_INTERN', m2: '', r1: '{datum}', r2: 'Version {version}' },
    gefuege_protokoll:      { l1: 'Ersteller: {ersteller}', l2: 'Freigeber: {freigeber}', m1: 'Prüfprotokoll zu {dokument}', m2: '', r1: '{datum}', r2: 'Version {version}' }
  };
  var LABEL = {
    operator_autorisierung: 'Operator Audit – Autorisierung (PDF und Druck)',
    operator_bericht: 'Operator Audit – Berichte / Ausdrucke',
    review_bericht: 'Review Audit – Auditbericht',
    mt_protokoll: 'MT-Prüfprotokoll (Magnetpulver) inkl. Einzelteilverfolgung',
    aetz_protokoll: 'Ätzdatenbank – Ätzprotokoll / Sammelprotokoll',
    ibg_protokoll: 'IBG – Prüfprotokoll Wirbelstrom',
    sh1_protokoll: 'SH1 Linie – Prüfprotokoll Wirbelstrom',
    gefuege_anweisung: 'Gefügeprüfung – Prüfanweisung',
    gefuege_protokoll: 'Gefügeprüfung – Prüfprotokoll'
  };
  var HINT = { review_bericht: 'Platzhalter: {heute} = Druckdatum', ibg_protokoll: 'Platzhalter: {heute} = Druckdatum + Uhrzeit, {id} = Protokoll-ID', sh1_protokoll: 'Platzhalter: {heute} = Druckdatum + Uhrzeit, {id} = Protokoll-ID',
    gefuege_anweisung: 'Platzhalter: {ersteller} und {freigeber} = Eingabe in der App (je Lagertyp) · {dokument} = Dokumentbezeichnung · {datum} = Ausgabedatum · {version} = Version der Prüfanweisung · {aufgabe} = Prüfaufgabe · {lagertyp} · {heute} = Druckdatum',
    gefuege_protokoll: 'Platzhalter: {ersteller} und {freigeber} = Eingabe in der App (je Lagertyp) · {dokument} = Dokumentbezeichnung · {datum} = Prüfdatum · {version} = Version der Prüfanweisung · {pruefer} = Prüfer · {aufgabe} = Prüfaufgabe · {lagertyp} · {heute} = Druckdatum' };
  var cfg = {}, promise = null;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function heute() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function get(key) {
    var d = DEF[key] || {}, o = cfg[key] || {}, r = {};
    KS.forEach(function (k) { r[k] = (typeof o[k] === 'string') ? o[k] : (d[k] || ''); });
    return r;
  }
  function fuell(t, vars) {
    var v = vars || {};
    return String(t).replace(/\{(\w+)\}/g, function (m, n) { return n === 'heute' && v.heute == null ? heute() : (v[n] != null ? v[n] : m); });
  }
  function spans(a, b, vars) {
    return [a, b].filter(function (x) { return String(x).trim() !== ''; }).map(function (x) { return '<span>' + esc(fuell(x, vars)) + '</span>'; }).join('');
  }
  // Inhalt der Fußzeile (drei Spalten-Divs) – passt in .gfoot / .pf / #print-global-footer
  function innen(key, vars) {
    var c = get(key);
    return '<div>' + spans(c.l1, c.l2, vars) + '</div><div style="text-align:center;font-weight:600">' + spans(c.m1, c.m2, vars) + '</div><div style="text-align:right">' + spans(c.r1, c.r2, vars) + '</div>';
  }
  function html(key, vars) { return '<div class="gfoot">' + innen(key, vars) + '</div>'; }
  function laden() {
    if (promise) return promise;
    promise = fetch('/api/druck-fusszeilen', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { if (j && typeof j === 'object') cfg = j; return cfg; })
      .catch(function () { return cfg; });
    return promise;
  }
  window.ZfPFuss = { KEYS: KS, defaults: DEF, labels: LABEL, hints: HINT, get: get, innen: innen, html: html, laden: laden, esc: esc };
  laden();
})();
