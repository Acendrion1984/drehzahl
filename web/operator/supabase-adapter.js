/* ZfP Operator Audit – Supabase-Adapter
 * Ersetzt die Aufrufe der Node-Server-API (/api/..., /data/Zertifikate/...) durch Supabase.
 * Die App selbst bleibt unverändert. Wird VOR der App geladen (siehe index.html). */
(function () {
  'use strict';
  var CFG = window.ZFP_CONFIG || {};
  var BUCKET = 'zfp-pdfs';
  var ZERT = {
    wirbelstrom: 'Wirbelstrompruefung', wirbelstrom_riss: 'Wirbelstrompruefung_Riss', wirbelstrom_gefuege: 'Wirbelstrompruefung_Gefuege',
    wirbelstrom_schleifbrand: 'Wirbelstrompruefung_Schleifbrand', magnetpulver: 'Magnetpulverpruefung', nital: 'Nitalaetzung',
    ultraschall: 'Ultraschallpruefung', durchstrahl: 'Durchstrahlpruefung', dichtheit: 'Dichtheitspruefung',
    barkhausen: 'Barkhausenrauschen', eindring: 'Eindringpruefung'
  };
  var VERFAHREN = {
    wirbelstrom: 'Wirbelstromprüfung', wirbelstrom_riss: 'Wirbelstrom Rissprüfung', wirbelstrom_gefuege: 'Wirbelstrom Gefügeprüfung',
    wirbelstrom_schleifbrand: 'Wirbelstrom Schleifbrandprüfung', magnetpulver: 'Magnetpulverprüfung', nital: 'HN03-Ätzprüfung',
    ultraschall: 'Ultraschallprüfung', durchstrahl: 'Durchstrahlprüfung', dichtheit: 'Dichtheitsprüfung',
    barkhausen: 'Barkhausenrauschen', eindring: 'Eindringprüfung'
  };
  var origFetch = window.fetch.bind(window);
  var origOpen = window.open.bind(window);

  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || /DEIN-PROJEKT|HIER/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY)) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML = '<div style="font:16px sans-serif;max-width:560px;margin:60px auto;padding:20px"><h2>Supabase ist noch nicht konfiguriert</h2><p>In <code>web/config.js</code> (bzw. in den GitHub-Repository-Variablen <code>SUPABASE_URL</code> und <code>SUPABASE_ANON_KEY</code>) die Projektdaten eintragen. Siehe README.</p></div>';
    });
    return;
  }
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.zfpSupabase = sb;

  // ---------- Anmeldung ----------
  var sessionPromise = null, profil = null;
  function loginOverlay() {
    return new Promise(function (resolve) {
      function bauen() {
        var ov = document.createElement('div');
        ov.id = 'zfpLogin';
        ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#f3f5f4;display:flex;align-items:center;justify-content:center;font-family:Barlow,Arial,sans-serif';
        ov.innerHTML = '<form style="background:#fff;border:1px solid #d0d7de;border-top:4px solid #00893d;border-radius:4px;padding:26px 28px;width:min(360px,92vw);box-shadow:0 6px 24px rgba(0,0,0,.12)">' +
          '<img src="shared/schaeffler-logo.svg" alt="" style="height:26px;margin-bottom:14px"><h2 style="margin:0 0 4px;font-family:\'Barlow Condensed\',Arial,sans-serif;letter-spacing:.5px;color:#1a1a1a">ZfP Operator Audit</h2>' +
          '<p style="margin:0 0 14px;color:#555;font-size:14px">Bitte anmelden</p>' +
          '<input name="e" type="email" required placeholder="E-Mail" autocomplete="username" style="width:100%;box-sizing:border-box;padding:9px;margin-bottom:8px;border:1px solid #b8c2cc;border-radius:4px;font:inherit">' +
          '<input name="p" type="password" required placeholder="Passwort" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:9px;margin-bottom:10px;border:1px solid #b8c2cc;border-radius:4px;font:inherit">' +
          '<div class="m" style="color:#c0392b;font-size:13px;min-height:18px"></div>' +
          '<button style="width:100%;padding:10px;border:0;border-radius:4px;background:#00893d;color:#fff;font:600 15px inherit;cursor:pointer">Anmelden</button></form>';
        document.body.appendChild(ov);
        ov.querySelector('form').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var f = ev.target, m = ov.querySelector('.m'); m.textContent = '';
          sb.auth.signInWithPassword({ email: f.e.value.trim(), password: f.p.value }).then(function (r) {
            if (r.error) { m.textContent = 'Anmeldung fehlgeschlagen: ' + r.error.message; return; }
            ov.remove(); resolve(r.data.session);
          });
        });
      }
      if (document.body) bauen(); else document.addEventListener('DOMContentLoaded', bauen);
    });
  }
  function sitzung() {
    if (!sessionPromise) {
      sessionPromise = sb.auth.getSession().then(function (r) {
        return r.data.session || loginOverlay();
      }).then(function (s) {
        return sb.rpc('mein_profil').then(function (p) { profil = p.data || { is_admin: false, rechte: [], abteilungen: [] }; abmeldeKnopf(s); return s; });
      });
    }
    return sessionPromise;
  }
  function abmeldeKnopf(s) {
    function bauen() {
      if (document.getElementById('zfpSbUser')) return;
      var b = document.createElement('div');
      b.id = 'zfpSbUser';
      b.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99990;background:rgba(0,0,0,.72);color:#fff;font:12px Barlow,Arial,sans-serif;padding:4px 10px;border-radius:14px;display:flex;gap:8px;align-items:center';
      b.innerHTML = '<span></span><a href="#" style="color:#7fe0a5">Abmelden</a>';
      b.firstChild.textContent = (s && s.user && s.user.email) || '';
      b.lastChild.onclick = function (e) { e.preventDefault(); sb.auth.signOut().then(function () { location.reload(); }); };
      document.body.appendChild(b);
    }
    if (document.body) bauen(); else document.addEventListener('DOMContentLoaded', bauen);
  }

  // ---------- Hilfen ----------
  function res(body, status, hdr) {
    var h = Object.assign({ 'Content-Type': 'application/json' }, hdr || {});
    return new Response(body === undefined ? 'null' : JSON.stringify(body), { status: status || 200, headers: h });
  }
  function fehler(msg, status, code) { return res(Object.assign({ error: msg }, code ? { code: code } : {}), status || 500); }
  function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function wk(s) { return String(s || '').toLowerCase().replace(/\.pdf$/i, '').split(/[\s_,]+/).filter(Boolean).sort().join('|'); }
  function dmy(iso) { var d = new Date(iso); return isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function istAdmin() { return !!(profil && profil.is_admin); }
  function hatRecht(r) { return istAdmin() || !!(profil && (profil.rechte || []).indexOf(r) >= 0); }
  function folderVon(p) { return ZERT[p] || (Object.keys(ZERT).map(function (k) { return ZERT[k]; }).indexOf(p) >= 0 ? p : null); }
  function procVon(folder) { return Object.keys(ZERT).filter(function (k) { return ZERT[k] === folder; })[0] || folder; }
  function lies(req) { return req.arrayBuffer ? req.arrayBuffer() : Promise.resolve(null); }

  function storageListe(pfad) {
    var alle = [];
    function seite(off) {
      return sb.storage.from(BUCKET).list(pfad, { limit: 1000, offset: off, sortBy: { column: 'name', order: 'asc' } }).then(function (r) {
        if (r.error) throw r.error;
        alle = alle.concat(r.data || []);
        return (r.data || []).length === 1000 ? seite(off + 1000) : alle;
      });
    }
    return seite(0);
  }
  function pdfs(pfad) { return storageListe(pfad).then(function (l) { return l.filter(function (x) { return x.id && /\.pdf$/i.test(x.name); }); }); }
  function pdfLaden(pfad) {
    return sb.storage.from(BUCKET).download(pfad).then(function (r) {
      if (r.error || !r.data) return fehler('Datei nicht gefunden', 404);
      return new Response(r.data, { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    });
  }
  function pdfSpeichern(pfad, buf) {
    if (!buf || !buf.byteLength) return Promise.resolve(fehler('Keine Daten empfangen', 400));
    if (new TextDecoder('latin1').decode(buf.slice(0, 4)) !== '%PDF') return Promise.resolve(fehler('Datei ist keine gültige PDF', 400));
    return sb.storage.from(BUCKET).upload(pfad, new Blob([buf], { type: 'application/pdf' }), { upsert: true, contentType: 'application/pdf' })
      .then(function (r) { return r.error ? fehler('Speichern fehlgeschlagen: ' + r.error.message) : res({ ok: true }); });
  }
  function pdfLoeschen(pfade) {
    return sb.storage.from(BUCKET).remove(pfade).then(function (r) { return r.error ? fehler(r.error.message) : res({ ok: true }); });
  }

  // ---------- Dokumente (kv) ----------
  function kvLesen(name) {
    return sb.from('kv').select('data,version').eq('name', name).maybeSingle().then(function (r) {
      if (r.error) throw r.error; return r.data;
    });
  }
  function kvSchreiben(name, data) {
    return sb.rpc('kv_speichern', { p_name: name, p_data: data }).then(function (r) {
      if (r.error) {
        if (/LEERER_STAND/.test(r.error.message)) return fehler('Leerer Stand wird nicht über vorhandene Daten gespeichert.', 409, 'LEERER_STAND_ABGEWIESEN');
        return fehler(r.error.message);
      }
      return res({ ok: true, version: String(r.data) });
    });
  }
  function dataRoute(req, name) {
    if (req.method === 'GET') {
      return kvLesen(name).then(function (d) {
        if (!d) return res(null, 200, { 'X-Data-Version': 'neu' });
        return res(d.data, 200, { 'X-Data-Version': String(d.version) });
      });
    }
    if (req.method === 'POST' || req.method === 'PUT') return req.text().then(function (t) { return kvSchreiben(name, t ? JSON.parse(t) : null); });
    if (req.method === 'DELETE') {
      return sb.from('kv').delete().eq('name', name).then(function (r) { return r.error ? fehler(r.error.message, 403) : res({ ok: true }); });
    }
    return fehler('Methode nicht unterstützt', 405);
  }

  // ---------- Audits ----------
  function auditNamen() {
    var alle = [];
    function seite(off) {
      return sb.from('audits').select('name').order('name').range(off, off + 999).then(function (r) {
        if (r.error) throw r.error; alle = alle.concat(r.data.map(function (x) { return x.name; }));
        return r.data.length === 1000 ? seite(off + 1000) : alle;
      });
    }
    return seite(0);
  }
  function auditsBulk() {
    var alle = [];
    function seite(off) {
      return sb.from('audits').select('name,data').order('name').range(off, off + 199).then(function (r) {
        if (r.error) throw r.error; alle = alle.concat(r.data.map(function (x) { return { name: x.name, content: x.data }; }));
        return r.data.length === 200 ? seite(off + 200) : alle;
      });
    }
    return seite(0);
  }

  // ---------- Zertifikate ----------
  function zertEintraege(procs, nurBase) {
    var jobs = procs.map(function (proc) {
      var folder = ZERT[proc];
      return Promise.all([pdfs('Zertifikate/' + folder), pdfs('Zertifikate/' + folder + '/alt').catch(function () { return []; })]).then(function (x) {
        var out = [];
        x[0].forEach(function (f) {
          var base = f.name.replace(/\.pdf$/i, '');
          if (nurBase && wk(base) !== wk(nurBase)) return;
          out.push(eintrag(proc, folder, f, base, true, 0));
        });
        var nr = {};
        x[1].forEach(function (f) {
          var base = f.name.replace(/\.pdf$/i, '').replace(/__.*$/, '');
          if (nurBase && wk(base) !== wk(nurBase)) return;
          nr[base] = (nr[base] || 0) + 1;
          out.push(eintrag(proc, folder, f, base, false, nr[base]));
        });
        return out;
      }).catch(function () { return []; });
    });
    return Promise.all(jobs).then(function (a) { return [].concat.apply([], a); });
  }
  function eintrag(proc, folder, f, base, aktuell, nr) {
    var t = (f.created_at || f.updated_at || '');
    return { aktuell: aktuell, procedure: proc, verfahren: VERFAHREN[proc] || proc, folder: folder, file: f.name, rel: (aktuell ? '' : 'alt/') + f.name,
      base: base, person: base.replace(/_/g, ' '), nr: nr, bytes: (f.metadata && f.metadata.size) || 0, datum: dmy(t), stufe: '', zeit: t };
  }
  function zertDatei(folder, name) {   // findet das aktuelle Zertifikat (auch bei vertauschter Namensreihenfolge)
    return pdfs('Zertifikate/' + folder).then(function (l) {
      var exakt = l.filter(function (f) { return f.name.toLowerCase() === (name + '.pdf').toLowerCase(); })[0];
      var w = exakt || l.filter(function (f) { return wk(f.name) === wk(name); })[0];
      return w ? w.name : null;
    });
  }
  function zertSpeichern(req, proc, name, alt) {
    var folder = folderVon(proc); if (!folder) return Promise.resolve(fehler('Unbekanntes Verfahren', 400));
    return lies(req).then(function (buf) {
      if (alt) {   // nachträglich eingelesenes älteres Zertifikat
        return pdfSpeichern('Zertifikate/' + folder + '/alt/' + name + '__' + Date.now() + '.pdf', buf);
      }
      return zertDatei(folder, name).then(function (vorhanden) {
        var ziel = vorhanden || (name + '.pdf');
        if (!vorhanden) return pdfSpeichern('Zertifikate/' + folder + '/' + ziel, buf);
        // bisherige Fassung nach alt/ ablegen (sofern anders), dann ersetzen
        return sb.storage.from(BUCKET).copy('Zertifikate/' + folder + '/' + ziel, 'Zertifikate/' + folder + '/alt/' + ziel.replace(/\.pdf$/i, '') + '__' + Date.now() + '.pdf')
          .then(function () { return pdfSpeichern('Zertifikate/' + folder + '/' + ziel, buf); });
      });
    });
  }

  // ---------- Archiv ----------
  function archivLesen(b) {
    return Promise.all([kvLesen('archiv_' + b + '_index'), kvLesen('archiv_' + b + '_historie')]).then(function (x) {
      return { dateien: (x[0] && x[0].data) || [], historie: (x[1] && x[1].data) || { spalten: [], zeilen: [], importe: [] } };
    });
  }
  function kvOk(name, data) { return sb.rpc('kv_speichern', { p_name: name, p_data: data }).then(function (r) { if (r.error && !/LEERER/.test(r.error.message)) throw r.error; }); }
  function archivRoute(req, b, rest, ctx) {
    if (!hatRecht('operator_archiv')) return Promise.resolve(fehler('Kein Zugriff', 403));
    if (!rest && req.method === 'GET') return archivLesen(b).then(function (a) { return res(a); });
    var m = rest.match(/^\/datei(?:\/([^\/]+))?$/);
    if (m) {
      var id = m[1] && dec(m[1]);
      if (req.method === 'POST') {
        var h = function (k) { return dec(req.headers.get(k) || ''); };
        return lies(req).then(function (buf) {
          var neuId = Date.now().toString(36) + Math.random().toString(16).slice(2, 8);
          return pdfSpeichern('Archiv/' + b + '/' + neuId + '.pdf', buf).then(function (r) {
            if (!r.ok) return r;
            var meta = { id: neuId, datei: neuId + '.pdf', originalname: h('x-dateiname') || 'dokument.pdf', kategorie: h('x-kategorie') || 'Sonstiges', titel: h('x-titel'),
              person: h('x-person'), datum: h('x-datum'), bemerkung: h('x-bemerkung'), groesse: buf.byteLength, hochgeladen: new Date().toISOString(), von: (profil && profil.email) || '' };
            return archivLesen(b).then(function (a) { a.dateien.unshift(meta); return kvOk('archiv_' + b + '_index', a.dateien); }).then(function () { return res({ ok: true, eintrag: meta }); });
          });
        });
      }
      if (req.method === 'GET') return pdfLaden('Archiv/' + b + '/' + id + '.pdf');
      if (req.method === 'DELETE') {
        return pdfLoeschen(['Archiv/' + b + '/' + id + '.pdf']).then(function () {
          return archivLesen(b).then(function (a) { return kvOk('archiv_' + b + '_index', a.dateien.filter(function (d) { return d.id !== id; })); });
        }).then(function () { return res({ ok: true }); });
      }
      if (req.method === 'PUT') {
        return req.json().then(function (body) {
          return archivLesen(b).then(function (a) {
            var e = a.dateien.filter(function (d) { return d.id === id; })[0]; if (!e) return fehler('Nicht gefunden', 404);
            ['kategorie', 'titel', 'person', 'datum', 'bemerkung'].forEach(function (k) { if (body[k] != null) e[k] = String(body[k]); });
            return kvOk('archiv_' + b + '_index', a.dateien).then(function () { return res({ ok: true, eintrag: e }); });
          });
        });
      }
    }
    var hm = rest.match(/^\/historie(?:\/([^\/]+))?$/);
    if (hm) {
      return archivLesen(b).then(function (a) {
        var h = a.historie;
        if (req.method === 'POST') {
          return req.json().then(function (body) {
            if (!Array.isArray(body.spalten) || !Array.isArray(body.zeilen) || !body.zeilen.length) return fehler('Keine Zeilen', 400);
            var iid = Date.now().toString(36);
            body.spalten.forEach(function (c) { if (h.spalten.indexOf(c) < 0) h.spalten.push(c); });
            body.zeilen.forEach(function (z) { var o = { _i: iid }; body.spalten.forEach(function (c) { o[c] = String(z[c] == null ? '' : z[c]).slice(0, 400); }); h.zeilen.push(o); });
            h.importe.unshift({ id: iid, datei: String(body.dateiname || ''), zeit: new Date().toISOString(), anzahl: body.zeilen.length, von: (profil && profil.email) || '' });
            return kvOk('archiv_' + b + '_historie', h).then(function () { return res({ ok: true, anzahl: body.zeilen.length, historie: h }); });
          });
        }
        if (req.method === 'DELETE') {
          var iid = dec(hm[1]);
          h.zeilen = h.zeilen.filter(function (z) { return z._i !== iid; }); h.importe = h.importe.filter(function (i) { return i.id !== iid; });
          return kvOk('archiv_' + b + '_historie', h).then(function () { return res({ ok: true, historie: h }); });
        }
        return fehler('Methode nicht unterstützt', 405);
      });
    }
    return Promise.resolve(fehler('Nicht gefunden', 404));
  }

  // ---------- Verteiler ----------
  function pfadVon(u) {
    try { var x = new URL(u, location.href); return { path: x.pathname, search: x.search, same: x.origin === location.origin }; } catch (e) { return null; }
  }
  function normPfad(p) {   // GitHub Pages: /<repo>/api/... -> /api/...
    var i = p.indexOf('/api/'); if (i >= 0) return p.slice(i);
    var j = p.indexOf('/data/Zertifikate/'); if (j >= 0) return p.slice(j);
    return null;
  }
  function route(req, p, search) {
    var m, q = new URLSearchParams(search || '');
    if (p === '/api/health') return Promise.resolve(res({ ok: true, time: new Date().toISOString() }));
    if (p === '/api/auth/me') {
      var admin = istAdmin();
      return Promise.resolve(res({ user: { role: admin ? 'admin' : 'user', username: (profil && profil.email) || '' }, personaldatenAbteilungen: admin ? null : ((profil && profil.abteilungen) || []) }));
    }
    if ((m = p.match(/^\/api\/access\/([^\/]+)\/verify$/))) {
      var ok = hatRecht(dec(m[1]));
      return Promise.resolve(ok ? res({ ok: true }) : res({ ok: false, error: 'Kein Zugriff' }, 403));
    }
    if (p === '/api/druck-fusszeilen') return kvLesen('druck_fusszeilen').then(function (d) { return res((d && d.data) || {}); });
    if (p === '/api/data-versionen') {
      var namen = q.getAll('f').join(',').split(',').map(function (s) { return dec(s).trim(); }).filter(Boolean);
      if (!namen.length) return Promise.resolve(res({}));
      return sb.from('kv').select('name,version').in('name', namen).then(function (r) {
        var o = {}; (r.data || []).forEach(function (x) { o[x.name] = String(x.version); }); namen.forEach(function (n) { if (!o[n]) o[n] = 'neu'; }); return res(o);
      });
    }
    if ((m = p.match(/^\/api\/data\/([^\/]+)$/))) return dataRoute(req, dec(m[1]));
    if (p === '/api/audits-bulk') return auditsBulk().then(function (a) { return res(a); });
    if (p === '/api/audits' && req.method === 'GET') return auditNamen().then(function (a) { return res(a); });
    if ((m = p.match(/^\/api\/audits\/([^\/]+)$/))) {
      var an = dec(m[1]);
      if (req.method === 'GET') return sb.from('audits').select('data').eq('name', an).maybeSingle().then(function (r) { return r.data ? res(r.data.data) : fehler('Nicht gefunden', 404); });
      if (req.method === 'POST' || req.method === 'PUT') return req.text().then(function (t) {
        return sb.from('audits').upsert({ name: an, data: JSON.parse(t), updated_at: new Date().toISOString() }).then(function (r) { return r.error ? fehler(r.error.message) : res({ ok: true }); });
      });
      if (req.method === 'DELETE') return sb.from('audits').delete().eq('name', an).select('name').then(function (r) { return r.error ? fehler(r.error.message, 403) : (r.data && r.data.length ? res({ ok: true }) : fehler('Keine Berechtigung zum Löschen', 403)); });
    }
    if (p === '/api/certs') {
      return zertEintraege(Object.keys(ZERT)).then(function (l) { return res(l.filter(function (e) { return e.aktuell; }).map(function (e) { return { procedure: e.procedure, folder: e.folder, name: e.base, file: e.file, bytes: e.bytes }; })); });
    }
    if (p === '/api/cert-alt' && req.method === 'GET') {
      return zertEintraege(Object.keys(ZERT)).then(function (l) { return res(q.get('aktuell') === '0' ? l.filter(function (e) { return !e.aktuell; }) : l); });
    }
    if ((m = p.match(/^\/api\/cert-hist\/([^\/]+)$/))) {
      var base = dec(m[1]);
      return zertEintraege(Object.keys(ZERT), base).then(function (l) { return res({ name: base, eintraege: l }); });
    }
    if ((m = p.match(/^\/api\/cert-alt\/([^\/]+)\/([^\/]+)$/))) {
      var a1 = dec(m[1]), a2 = dec(m[2]);
      if (req.method === 'GET') return pdfLaden('Zertifikate/' + a1 + '/alt/' + a2).then(function (r) { return r.ok ? r : pdfLaden('Zertifikate/' + a1 + '/' + a2); });
      if (req.method === 'POST') return zertSpeichern(req, a1, a2, true);   // /api/cert-alt/:procedure/:name
      if (req.method === 'DELETE') return pdfLoeschen(['Zertifikate/' + a1 + '/alt/' + a2]);
    }
    if ((m = p.match(/^\/(?:api\/cert|data\/Zertifikate)\/([^\/]+)\/([^\/]+)$/))) {
      var folder = folderVon(dec(m[1])), nm = dec(m[2]).replace(/\.pdf$/i, '');
      if (!folder) return Promise.resolve(fehler('Unbekanntes Verfahren', 400));
      if (req.method === 'GET') return zertDatei(folder, nm).then(function (f) { return f ? pdfLaden('Zertifikate/' + folder + '/' + f) : fehler('Zertifikat nicht gefunden', 404); });
      if (req.method === 'POST') return zertSpeichern(req, dec(m[1]), nm, false);
      if (req.method === 'DELETE') return zertDatei(folder, nm).then(function (f) { return f ? pdfLoeschen(['Zertifikate/' + folder + '/' + f]) : res({ ok: true }); });
    }
    if ((m = p.match(/^\/api\/autorisierung-pdf\/([^\/]+)$/))) {
      var aid = dec(m[1]), ap = 'Autorisierungen/' + aid.replace(/[^\w.\-]+/g, '_') + '.pdf';
      if (req.method === 'GET') return pdfLaden(ap);
      if (req.method === 'POST') return lies(req).then(function (b) { return pdfSpeichern(ap, b); });
      if (req.method === 'DELETE') return pdfLoeschen([ap]);
    }
    if ((m = p.match(/^\/api\/archiv\/([^\/]+)(\/.*)?$/))) return archivRoute(req, dec(m[1]), m[2] || '');
    return Promise.resolve(fehler('Nicht verfügbar in der Supabase-Version: ' + p, 404));
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var u = pfadVon(url), p = u && u.same && normPfad(u.path);
    if (!p) return origFetch(input, init);
    var req = new Request(new URL(url, location.href).href, init || (typeof input === 'object' ? input : undefined));
    return sitzung().then(function () { return route(req, p, u.search); }).catch(function (e) {
      return fehler((e && e.message) || String(e), 500);
    });
  };

  // PDFs, die die App per window.open('/data/Zertifikate/...') öffnet, kommen aus dem Storage
  window.open = function (url, target, feat) {
    var u = typeof url === 'string' ? pfadVon(url) : null, p = u && u.same && normPfad(u.path);
    if (!p || !/^\/(api\/(cert|cert-alt|autorisierung-pdf|archiv)|data\/Zertifikate)\//.test(p)) return origOpen(url, target, feat);
    var w = origOpen('', '_blank');
    sitzung().then(function () { return route(new Request(location.href), p, u.search); }).then(function (r) {
      if (!r.ok) throw new Error('Datei nicht gefunden');
      return r.blob();
    }).then(function (b) {
      var bu = URL.createObjectURL(b);
      if (w) w.location.href = bu; else location.href = bu;
    }).catch(function (e) { if (w) w.close(); alert('PDF konnte nicht geöffnet werden: ' + e.message); });
    return w;
  };
  window.zfpSitzung = sitzung;
  sitzung();
})();
