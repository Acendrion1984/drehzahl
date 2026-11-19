/* ZfP-Portal · gemeinsame Card-ID-Prüfung (Browser + Server, UMD)
 * Quelle der Card-IDs: Mitarbeiterdatei (employees[].cardId, gepflegt in der Qualifikationsmatrix).
 * verify(liste, cardId, {key, min}) -> {ok, empId, name, qual, code, msg:{de,en}}
 *   key = Verfahren (z. B. 'magnetpulver', 'nital'), min = Mindeststufe ('PW' < '1' < '2' < '3')
 * check(cardId, {key,min}) (nur Browser) lädt die Mitarbeiter einmalig vom Server und ruft verify() auf.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZfPCards = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RANG = { PW: 0, '1': 1, '2': 2, '3': 3 };
  var MSG = {
    no_card:       ['Bitte Card-ID eingeben bzw. Karte an das Lesegerät halten.', 'Please enter the card ID or hold the card to the reader.'],
    unknown:       ['Card-ID unbekannt (keinem Mitarbeiter zugeordnet).', 'Card ID unknown (not assigned to an employee).'],
    ambiguous:     ['Card-ID mehrfach vergeben – bitte in der Qualifikationsmatrix korrigieren.', 'Card ID assigned more than once – please correct it in the qualification matrix.'],
    inactive:      ['Mitarbeiter ist nicht (mehr) als aktiver Prüfer geführt.', 'Employee is no longer listed as an active inspector.'],
    no_cert:       ['Kein gültiges Zertifikat für dieses Verfahren hinterlegt.', 'No certificate for this method on record.'],
    level_low:     ['Zertifikatsstufe reicht nicht aus.', 'Certificate level is not sufficient.'],
    level_unknown: ['Zertifikatsstufe nicht eindeutig hinterlegt.', 'Certificate level not clearly recorded.'],
    no_expiry:     ['Ablaufdatum des Zertifikats fehlt.', 'Certificate expiry date missing.'],
    expired:       ['Zertifikat abgelaufen.', 'Certificate expired.']
  };
  function msg(code, extra) {
    var m = MSG[code] || [code, code];
    return { de: m[0] + (extra && extra.de ? ' ' + extra.de : ''), en: m[1] + (extra && extra.en ? ' ' + extra.en : '') };
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function normLevel(l) {
    var s = norm(l).replace(/^(mt|magnetpulver)[\s:\-]*/, '').replace(/^(stufe|level|lvl|lev)[\s:\-]*/, '').replace(/^l[\s\-]*(?=[123]$)/, '');
    s = s.replace(/\s+/g, '');
    if (s === 'pw' || s === 'prüfwerker' || s === 'pruefwerker' || s === 'prüfwerk') return 'PW';
    if (s === 'i') return '1'; if (s === 'ii') return '2'; if (s === 'iii') return '3';
    return RANG.hasOwnProperty(s) ? s : null;
  }
  function parseDate(s) {
    s = String(s || '').trim(); var m;
    if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s))) return new Date(+m[3], +m[2] - 1, +m[1], 23, 59, 59);
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
    return null;
  }
  var KURZ = { wirbelstrom: 'ET', magnetpulver: 'MT', nital: 'NE', ultraschall: 'UT', barkhausen: 'BH', eindring: 'PT', durchstrahl: 'RT', dichtheit: 'LT' };
  function toList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.employees)) return data.employees;
    if (data && typeof data === 'object') return Object.keys(data).map(function (k) { return data[k]; });
    return [];
  }
  // Reine 7-8-stellige Nummern gelten als "0/129/0/<Nummer>" (Format des Lesegeräts) – so passt gespeichert/gescannt in jeder Schreibweise
  function cardNorm(v) { var t = String(v == null ? '' : v).trim(); return /^\d{7,8}$/.test(t) ? '0/129/0/' + t : t; }
  function verify(liste, cardId, req) {
    var c = cardNorm(cardId);
    if (!c) return { ok: false, code: 'no_card', msg: msg('no_card') };
    var hits = toList(liste).filter(function (e) { return e && ((e.cardId && cardNorm(e.cardId) === c) || (e.cardId2 && cardNorm(e.cardId2) === c)); });   // pro Person bis zu zwei Karten
    if (!hits.length) return { ok: false, code: 'unknown', msg: msg('unknown') };
    if (hits.length > 1) return { ok: false, code: 'ambiguous', msg: msg('ambiguous') };
    return pruefen(hits[0], req);
  }
  function pruefen(e, req) {
    var name = e.lastName || e.firstName ? [e.lastName, e.firstName].filter(Boolean).join(', ') : (e.name || '');
    var dept = String(e.department || e.abteilung || '').trim();
    var res = { ok: true, empId: e.id != null ? e.id : (e.personalNr || e.name), name: name, dept: dept, qual: dept };
    if (e.employed === false || e.zfpActive === false) return { ok: false, code: 'inactive', name: name, msg: msg('inactive') };
    if (!req || !req.key) return res;
    var cfg = e.procedureCerts && e.procedureCerts[req.key];
    if (!cfg || !cfg.enabled) return { ok: false, code: 'no_cert', name: name, msg: msg('no_cert') };
    var lvl = normLevel(cfg.level);
    if (!lvl) return { ok: false, code: 'level_unknown', name: name, msg: msg('level_unknown') };
    res.level = lvl;
    var min = normLevel(req.min || 'PW') || 'PW';
    if (RANG[lvl] < RANG[min]) return { ok: false, code: 'level_low', name: name, msg: msg('level_low', { de: '(vorhanden: ' + lvl + ', erforderlich: mindestens ' + min + ')', en: '(on record: ' + lvl + ', required: at least ' + min + ')' }) };
    var d = parseDate(cfg.expiry);
    if (!d) return { ok: false, code: 'no_expiry', name: name, msg: msg('no_expiry') };
    if (d.getTime() < Date.now()) return { ok: false, code: 'expired', name: name, msg: msg('expired', { de: '(bis ' + cfg.expiry + ')', en: '(until ' + cfg.expiry + ')' }) };
    res.qual = dept + '\n' + (KURZ[req.key] || req.key) + ' ' + (lvl === 'PW' ? 'PW' : 'Level ' + lvl) + ' (gültig bis ' + cfg.expiry + ')';
    return res;
  }
  var cache = null, cacheT = 0, cacheSuf = null;
  /* Werkstrennung: Mitarbeiterdatei des aktiven Werks (Schweinfurt = zfpEmployees.json, sonst zfpEmployees__<suffix>.json) */
  function werkDatei() {
    var C = window.ZfPContext;
    var reg = (C && C.ladeWerkRegister) ? C.ladeWerkRegister() : Promise.resolve();
    return reg.then(function () {
      var suf = (C && C.werkSuffix) ? C.werkSuffix() : '';
      return { suf: suf, file: 'zfpEmployees' + (suf ? '__' + suf : '') + '.json' };
    }, function () { return { suf: '', file: 'zfpEmployees.json' }; });
  }
  function laden(force) {
    return werkDatei().then(function (w) {
      if (!force && cache && cacheSuf === w.suf && Date.now() - cacheT < 60000) return cache;
      return fetch('/api/data/' + w.file, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (j) { cache = toList(j); cacheT = Date.now(); cacheSuf = w.suf; return cache; })
        .catch(function () { return (cacheSuf === w.suf && cache) || []; });
    });
  }
  // Immer frische Mitarbeiterdaten (kein Cache): Zertifikatsstufe/-ablauf muss zum Zeitpunkt der Prüfung stimmen
  function check(cardId, req) { return laden(true).then(function (l) { return verify(l, cardId, req); }); }
  // Erneute Prüfung einer Person (per Mitarbeiter-ID) gegen eine Anforderung – z. B. beim Abschluss eines Protokolls
  function checkEmp(empId, req) {
    return laden(true).then(function (l) {
      var hits = toList(l).filter(function (e) { return e && e.id != null && String(e.id) === String(empId); });
      if (hits.length !== 1) return { ok: false, code: 'unknown', msg: msg('unknown') };
      return pruefen(hits[0], req);
    });
  }
  // Kurzform für Badges: z. B. „MT Level 1“ / „NE PW“
  function kurz(req) { var m = normLevel((req && req.min) || 'PW') || 'PW'; return ((req && KURZ[req.key]) || (req && req.key) || '') + ' ' + (m === 'PW' ? 'PW' : 'Level ' + m); }
  // Kurzer Badge-Text: fehlende/zu niedrige Zertifizierung → „Zertifizierung nicht ausreichend (MT Level 1)“, sonst die Standardmeldung ohne Zusatz
  function kurzMsg(r, req) {
    if (r && (r.code === 'level_low' || r.code === 'no_cert' || r.code === 'level_unknown')) { var k = req && req.key ? ' (' + kurz(req).trim() + ')' : ''; return { de: 'Zertifizierung nicht ausreichend' + k, en: 'Certification not sufficient' + k }; }
    return r && r.msg ? r.msg : { de: '', en: '' };
  }
  return { kurz: kurz, kurzMsg: kurzMsg, verify: verify, check: check, checkEmp: checkEmp, normLevel: normLevel, load: laden, MSG: MSG };
}));
