/* ZfP-Archiv: PDFs (Zertifikate, Anwesenheitslisten …) und historische Daten (Excel) je Bereich.
   Bereiche: 'schulungen' | 'qualimatrix'.  Aufruf: ZfPArchiv.oeffnen('schulungen'); */
(function(){
  'use strict';
  var KAT = {
    schulungen: ['Anwesenheitsliste', 'Zertifikat', 'Prüfungsprotokoll', 'Schulungsnachweis', 'Sonstiges'],
    qualimatrix: ['Zertifikat', 'Sehtest', 'Autorisierung', 'Anwesenheitsliste', 'Sonstiges']
  };
  var TITEL = { schulungen: 'Archiv – Schulungen', qualimatrix: 'Archiv – Qualifikationsmatrix' };
  var VORLAGE = {
    schulungen: ['Name', 'Personal-Nr.', 'Schulung', 'Verfahren', 'Datum', 'Ergebnis', 'Prüfer/Trainer', 'Bemerkung'],
    qualimatrix: ['Name', 'Personal-Nr.', 'Verfahren', 'Stufe', 'Zertifikat-Nr.', 'Ausgestellt am', 'Gültig bis', 'Bemerkung']
  };
  var S = { bereich: null, dateien: [], hist: { spalten: [], zeilen: [], importe: [] }, tab: 'pdf', q: '', pending: null, alt: [], altGeladen: false, altLaedt: false, altFehler: '', ma: null, maMap: {}, person: null, fProc: {}, fLvl: {}, fAbt: 'all' };

  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function url(p){ var w = ''; try { var c = window.ZfPContext; var id = c && (c.getWerk ? c.getWerk() : c.werk); if (id) w = (p.indexOf('?') < 0 ? '?' : '&') + 'werk=' + encodeURIComponent(id); } catch (e) {} return p + w; }
  function api(path, opt){ return fetch(url(path), opt).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); }); }
  function kb(n){ return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function fdat(d){ if (!d) return ''; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : d; }

  function css(){
    if (document.getElementById('zfpArchivCss')) return;
    var st = document.createElement('style'); st.id = 'zfpArchivCss';
    st.textContent = '#zfpArchiv{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;font-family:inherit}' +
      '#zfpArchiv .za-box{background:var(--bg-card,#fff);color:var(--text,#1c2b36);border-radius:10px;width:min(1600px,100%);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.4)}' +
      '#zfpArchiv .za-h{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border,#d0d7de)}#zfpArchiv .za-h h2{margin:0;font-size:18px;flex:1}' +
      '#zfpArchiv .za-x{background:none;border:0;font-size:24px;cursor:pointer;color:inherit}' +
      '#zfpArchiv .za-tabs{display:flex;gap:6px;padding:10px 18px 0}#zfpArchiv .za-tab{padding:8px 14px;border:1px solid var(--border,#d0d7de);border-bottom:0;border-radius:6px 6px 0 0;cursor:pointer;background:transparent;color:inherit;font:inherit}' +
      '#zfpArchiv .za-tab.on{background:#00893d;color:#fff;border-color:#00893d}' +
      '#zfpArchiv .za-b{padding:14px 18px;overflow:auto;border-top:1px solid var(--border,#d0d7de)}' +
      '#zfpArchiv .za-row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:10px}' +
      '#zfpArchiv label{font-size:12px;display:flex;flex-direction:column;gap:3px}' +
      '#zfpArchiv input,#zfpArchiv select{padding:7px 9px;border:1px solid var(--border,#b8c2cc);border-radius:5px;background:var(--bg-input,#fff);color:inherit;font:inherit;min-width:140px}' +
      '#zfpArchiv .za-btn{padding:8px 14px;border:0;border-radius:5px;background:#00893d;color:#fff;cursor:pointer;font:inherit;font-weight:600}#zfpArchiv .za-btn.s{background:#5b6b78}#zfpArchiv .za-btn.r{background:#c0392b}' +
      '#zfpArchiv .za-drop{border:2px dashed #8a9aa6;border-radius:8px;padding:16px;text-align:center;margin-bottom:12px;cursor:pointer}#zfpArchiv .za-drop.on{background:rgba(0,137,61,.12);border-color:#00893d}' +
      '#zfpArchiv table{width:100%;border-collapse:collapse;font-size:13px}#zfpArchiv th,#zfpArchiv td{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid var(--border,#d0d7de);text-align:left;vertical-align:top}' +
      '#zfpArchiv th{position:sticky;top:0;background:var(--bg-card,#fff)}#zfpArchiv .za-muted{color:#7a8894;font-size:12px}' +
      '#zfpArchiv .za-chip{padding:5px 12px;border:1px solid var(--border,#b8c2cc);border-radius:16px;background:transparent;cursor:pointer;font:inherit;font-size:12px;color:inherit;margin:0 4px 4px 0}#zfpArchiv .za-chip.on{background:#00893d;color:#fff;border-color:#00893d}' +
      '#zfpArchiv a.za-lnk{color:#2f5d8a;cursor:pointer;text-decoration:underline;font-weight:600}#zfpArchiv .za-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:#e8eef3;color:#41525f}#zfpArchiv .za-badge.g{background:#d9f2e3;color:#0b6b33}' +
      '#zfpArchiv .za-tw{max-height:46vh;overflow:auto;border:1px solid var(--border,#d0d7de);border-radius:6px}';
    document.head.appendChild(st);
  }

  function laden(){ return api('/api/archiv/' + S.bereich).then(function(j){ S.dateien = j.dateien || []; S.hist = j.historie || { spalten: [], zeilen: [], importe: [] }; }); }

  function render(){
    var box = document.querySelector('#zfpArchiv .za-box'); if (!box) return;
    var h = '<div class="za-h"><h2>📁 ' + esc(TITEL[S.bereich]) + '</h2><button class="za-x" data-a="close" title="Schließen">×</button></div>' +
      '<div class="za-tabs"><button class="za-tab' + (S.tab === 'pdf' ? ' on' : '') + '" data-a="tab" data-t="pdf">📄 Dokumente (PDF) · ' + S.dateien.length + '</button>' +
      '<button class="za-tab' + (S.tab === 'hist' ? ' on' : '') + '" data-a="tab" data-t="hist">📊 Historische Daten (Excel) · ' + S.hist.zeilen.length + '</button>' +
      (S.bereich === 'qualimatrix' ? '<button class="za-tab' + (S.tab === 'alt' ? ' on' : '') + '" data-a="tab" data-t="alt">🗂 Alte Zertifikate' + (S.altGeladen ? ' · ' + S.alt.filter(istArchiv).length : '') + '</button>' : '') +
      '</div><div class="za-b">';
    h += S.tab === 'pdf' ? renderPdf() : (S.tab === 'alt' ? renderAlt() : renderHist());
    box.innerHTML = h + '</div>';
  }

  function renderPdf(){
    var kats = KAT[S.bereich], q = S.q.toLowerCase();
    var liste = S.dateien.filter(function(d){ return !q || [d.titel, d.person, d.kategorie, d.originalname, d.bemerkung].join(' ').toLowerCase().indexOf(q) >= 0; });
    var h = '<div class="za-drop" id="zaDrop" data-a="pick">📎 PDF-Dateien hierher ziehen oder klicken (mehrere möglich)<br><span class="za-muted">Zertifikate, ausgefüllte Anwesenheitslisten, Protokolle … – max. 30 MB je Datei</span>' +
      '<input type="file" id="zaFile" accept="application/pdf,.pdf" multiple style="display:none"></div>';
    if (S.pending) {
      h += '<div class="za-row"><b style="width:100%">' + S.pending.length + ' Datei(en) – Angaben ergänzen:</b>' +
        '<label>Kategorie<select id="zaKat">' + kats.map(function(k){ return '<option>' + esc(k) + '</option>'; }).join('') + '</select></label>' +
        '<label>Person / Teilnehmer<input id="zaPerson" placeholder="Name (optional)"></label>' +
        '<label>' + (S.bereich === 'schulungen' ? 'Schulung / Thema' : 'Titel') + '<input id="zaTitel" placeholder="z. B. ET-Schulung Stufe 2"></label>' +
        '<label>Datum<input type="date" id="zaDatum"></label>' +
        '<label>Bemerkung<input id="zaBem"></label>' +
        '<button class="za-btn" data-a="upload">⬆ Hochladen</button><button class="za-btn s" data-a="cancel">Abbrechen</button>' +
        '<div class="za-muted" style="width:100%">' + S.pending.map(function(f){ return esc(f.name) + ' (' + kb(f.size) + ')'; }).join(' · ') + '</div></div>';
    }
    h += '<div class="za-row"><label>Suchen<input id="zaQ" value="' + esc(S.q) + '" placeholder="Name, Titel, Kategorie …"></label></div>';
    h += '<div class="za-tw"><table><thead><tr><th>Datum</th><th>Kategorie</th><th>Person</th><th>Titel</th><th>Datei</th><th></th></tr></thead><tbody>';
    if (!liste.length) h += '<tr><td colspan="6" class="za-muted">Noch keine Dokumente im Archiv.</td></tr>';
    liste.forEach(function(d){
      h += '<tr><td>' + esc(fdat(d.datum) || fdat(d.hochgeladen)) + '</td><td>' + esc(d.kategorie) + '</td><td>' + esc(d.person) + '</td><td>' + esc(d.titel) + (d.bemerkung ? '<div class="za-muted">' + esc(d.bemerkung) + '</div>' : '') + '</td>' +
        '<td>' + esc(d.originalname) + '<div class="za-muted">' + kb(d.groesse) + '</div></td>' +
        '<td style="white-space:nowrap"><button class="za-btn" data-a="open" data-id="' + esc(d.id) + '">Öffnen</button> <button class="za-btn r" data-a="del" data-id="' + esc(d.id) + '">🗑</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function renderHist(){
    var sp = S.hist.spalten, q = S.q.toLowerCase();
    var zeilen = S.hist.zeilen.filter(function(z){ return !q || sp.some(function(c){ return String(z[c] || '').toLowerCase().indexOf(q) >= 0; }); });
    var h = '<div class="za-row"><button class="za-btn" data-a="xl">📥 Excel-Datei importieren</button>' +
      '<button class="za-btn s" data-a="tpl">📄 Excel-Vorlage laden</button>' +
      (S.hist.zeilen.length ? '<button class="za-btn s" data-a="xexp">📤 Als Excel exportieren</button>' : '') +
      '<input type="file" id="zaXl" accept=".xlsx,.xls,.csv" style="display:none">' +
      '<label>Suchen<input id="zaQ" value="' + esc(S.q) + '" placeholder="in allen Spalten …"></label></div>' +
      '<div class="za-muted" style="margin-bottom:8px">Die erste Zeile der Tabelle muss die Spaltenüberschriften enthalten. Jeder Import wird als Block gespeichert und kann einzeln wieder entfernt werden.</div>';
    if (S.imp) {
      h += '<div class="za-row" style="background:rgba(0,137,61,.1);padding:10px;border-radius:6px"><b>' + esc(S.imp.dateiname) + ':</b>&nbsp;' + S.imp.zeilen.length + ' Zeilen, Spalten: ' + esc(S.imp.spalten.join(', ')) +
        '&nbsp;<button class="za-btn" data-a="impok">✔ Übernehmen</button><button class="za-btn s" data-a="impcancel">Verwerfen</button></div>';
    }
    if (S.hist.importe.length) {
      h += '<div class="za-muted" style="margin-bottom:8px">Importe: ' + S.hist.importe.map(function(i){
        return esc(i.datei || 'Import') + ' (' + i.anzahl + ', ' + esc(fdat(i.zeit)) + ') <a href="#" data-a="impdel" data-id="' + esc(i.id) + '" style="color:#c0392b">entfernen</a>'; }).join(' · ') + '</div>';
    }
    h += '<div class="za-tw"><table><thead><tr>' + sp.map(function(c){ return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    if (!zeilen.length) h += '<tr><td class="za-muted" colspan="' + Math.max(1, sp.length) + '">Noch keine historischen Daten.</td></tr>';
    zeilen.slice(0, 1000).forEach(function(z){ h += '<tr>' + sp.map(function(c){ return '<td>' + esc(z[c]) + '</td>'; }).join('') + '</tr>'; });
    h += '</tbody></table></div>';
    if (zeilen.length > 1000) h += '<div class="za-muted">Es werden die ersten 1000 von ' + zeilen.length + ' Zeilen angezeigt – Suche verwenden oder exportieren.</div>';
    return h;
  }

  // Datum „TT.MM.JJJJ“ → sortierbar (JJJJMMTT)
  function dsort(d){ var m = String(d || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? m[3] + ('0' + m[2]).slice(-2) + ('0' + m[1]).slice(-2) : '00000000'; }
  // Name unabhängig von Reihenfolge, Umlauten und Satzzeichen (Dateiname „Nachname_Vorname“ ↔ Mitarbeiter „Vorname Nachname“)
  function nk(t){ return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' '); }
  var PROC_CHIPS = [['wirbelstrom', 'ET'], ['magnetpulver', 'MT'], ['nital', 'NE'], ['ultraschall', 'UT']];
  var PROC_SUB = [['wirbelstrom_riss', 'ET-R'], ['wirbelstrom_gefuege', 'ET-G'], ['wirbelstrom_schleifbrand', 'ET-S']];
  var LVL_CHIPS = [['PW', 'PW'], ['1', 'Level 1'], ['2', 'Level 2'], ['3', 'Level 3']];
  function nAn(o){ var n = 0; for (var k in o) if (o[k]) n++; return n; }

  function altAnreichern(){
    S.maMap = {};
    (S.ma || []).forEach(function(e){ if (e && !e.external && e.name) S.maMap[nk(e.name)] = e; });
    S.alt.forEach(function(d){ d.key = nk(d.person); var e = S.maMap[d.key]; d.ma = e || null; d.pnr = e && e.number ? String(e.number) : ''; d.abt = e && e.department ? String(e.department).trim() : ''; d.anzeige = e ? e.name : d.person;
      d.abgelaufen = false; d.ablauf = '';
      if (d.aktuell && e && e.procedureCerts && e.procedureCerts[d.procedure]) {
        var cfg = e.procedureCerts[d.procedure], m = String(cfg.expiry || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m) { d.ablauf = cfg.expiry; if (cfg.enabled && new Date(+m[3], +m[2] - 1, +m[1], 23, 59, 59) < new Date()) d.abgelaufen = true; }
      }
    });
  }
  function statusBadge(d){
    if (d.aktuell) return d.abgelaufen ? '<span class="za-badge" style="background:#fdecea;color:#c0392b">❌ abgelaufen' + (d.ablauf ? ' (' + esc(d.ablauf) + ')' : '') + '</span>' : '<span class="za-badge g">✔ aktuell</span>';
    return '<span class="za-badge">früher' + (d.nr ? ' (Fassung ' + d.nr + ')' : '') + '</span>';
  }
  function nrSichtbar(){ try { return !(S.opt && S.opt.entsperrt) || !!S.opt.entsperrt(); } catch (e) { return false; } }
  function istArchiv(d){ return !d.aktuell || d.abgelaufen; }
  function oeffnenAttr(d){ return d.aktuell ? 'data-a="openakt" data-proc="' + esc(d.procedure) + '" data-base="' + esc(d.base) + '"' : 'data-a="openalt" data-folder="' + esc(d.folder) + '" data-file="' + esc(d.file) + '"'; }
  // Suche und Filter wie in der Qualifikationsmatrix: Name/Personalnummer, Verfahren (ET/MT/NE/UT, ET-R/G/S), Stufe (PW/1/2/3), Abteilung
  function altFiltern(liste, mitSuche){
    var q = S.q.toLowerCase(), np = nAn(S.fProc), nl = nAn(S.fLvl);
    return liste.filter(function(d){
      if (mitSuche && q && [d.person, d.anzeige, (nrSichtbar() ? d.pnr : ''), d.verfahren, d.datum, d.file].join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (np && !S.fProc[d.procedure]) return false;
      if (nl && !S.fLvl[String(d.stufe)]) return false;
      if (S.fAbt !== 'all' && (S.fAbt === 'other' ? d.abt !== '' : d.abt !== S.fAbt)) return false;
      return true;
    });
  }
  function chipsHtml(){
    var h = '<div class="za-row" style="align-items:center"><span class="za-muted" style="margin-right:4px"><b>Verfahren:</b></span>' +
      PROC_CHIPS.map(function(c){ return '<button class="za-chip' + (S.fProc[c[0]] ? ' on' : '') + '" data-a="chip" data-k="p" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    if (S.fProc.wirbelstrom) h += '<span class="za-muted" style="margin:0 4px 0 10px">davon:</span>' + PROC_SUB.map(function(c){ return '<button class="za-chip' + (S.fProc[c[0]] ? ' on' : '') + '" data-a="chip" data-k="p" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    h += '<span class="za-muted" style="margin:0 4px 0 14px"><b>Stufe:</b></span>' + LVL_CHIPS.map(function(c){ return '<button class="za-chip' + (S.fLvl[c[0]] ? ' on' : '') + '" data-a="chip" data-k="l" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
    return h;
  }
  function abtHtml(){
    var set = {}; S.alt.forEach(function(d){ if (d.abt) set[d.abt] = 1; });
    var abts = Object.keys(set).sort(function(a, b){ return a.localeCompare(b, 'de'); });
    if (!abts.length) return '';
    return '<label>Abteilung<select id="zaAbt"><option value="all">Alle Abteilungen</option>' + abts.map(function(a){ return '<option' + (S.fAbt === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '<option value="other"' + (S.fAbt === 'other' ? ' selected' : '') + '>ohne Abteilung</option></select></label>';
  }
  function filterAktiv(){ return !!(S.q || nAn(S.fProc) || nAn(S.fLvl) || S.fAbt !== 'all'); }

  function renderAlt(){
    if (S.altLaedt) return '<div class="za-muted" style="padding:20px">Alte Zertifikate werden gelesen … (beim ersten Öffnen kann das einen Moment dauern)</div>';
    if (S.altFehler) return '<div class="za-muted" style="padding:20px;color:#c0392b">Fehler: ' + esc(S.altFehler) + '</div>';
    return S.person ? renderHistorie() : renderAltListe();
  }

  function renderAltListe(){
    var nurAlt = S.alt.filter(istArchiv);
    var liste = altFiltern(nurAlt, true).sort(function(a, b){ return a.anzeige.localeCompare(b.anzeige, 'de') || a.verfahren.localeCompare(b.verfahren, 'de') || dsort(b.datum).localeCompare(dsort(a.datum)); });
    var mitMa = !!(S.ma && S.ma.length);
    var h = '<div class="za-muted" style="margin-bottom:10px">Alle <b>früheren und abgelaufenen Zertifikate</b> – abgelaufene Zertifikate wandern automatisch hierher, ältere Fassungen werden beim Einlesen automatisch abgelegt (kein Upload nötig). Auf einen <b>Namen klicken</b> zeigt die komplette Historie dieses Mitarbeiters (aktuell + alle früheren). ' +
      'Die Historie eines Mitarbeiters gibt es auch direkt in der Qualifikationsmatrix (Zertifikat-Menü).</div>' +
      '<div class="za-row"><label style="flex:1;min-width:220px">Suchen<input id="zaQ" value="' + esc(S.q) + '" placeholder="🔍 Name oder Personalnummer suchen …" style="width:100%"></label>' + abtHtml() +
      '<button class="za-btn s" data-a="fclear">Filter löschen</button></div>' + chipsHtml();
    h += '<div class="za-muted" style="margin:4px 0 6px">' + liste.length + ' von ' + nurAlt.length + ' alten Zertifikaten' + (filterAktiv() ? ' (gefiltert)' : '') + '</div>';
    h += '<div class="za-tw"><table><thead><tr><th>Schulungstag</th><th>Person</th>' + (mitMa ? '<th>Pers.-Nr.</th><th>Abteilung</th>' : '') + '<th>Verfahren</th><th>Stufe</th><th>Status</th><th>Datei</th><th></th></tr></thead><tbody>';
    if (!liste.length) h += '<tr><td colspan="' + (mitMa ? 9 : 7) + '" class="za-muted">' + (nurAlt.length ? 'Keine Treffer.' : 'Noch keine alten Zertifikate vorhanden.') + '</td></tr>';
    liste.forEach(function(d){
      h += '<tr><td>' + esc(d.datum || '–') + '</td><td><a class="za-lnk" data-a="hist" data-p="' + esc(d.key) + '">' + esc(d.anzeige) + '</a></td>' +
        (mitMa ? '<td>' + esc(nrSichtbar() ? d.pnr : (d.pnr ? '••••••' : '')) + '</td><td>' + esc(d.abt) + '</td>' : '') +
        '<td>' + esc(d.verfahren) + '</td><td>' + esc(d.stufe === 'PW' ? 'PW' : (d.stufe ? 'Level ' + d.stufe : '–')) + '</td>' +
        '<td>' + statusBadge(d) + '</td><td>' + esc(d.file) + '<div class="za-muted">' + kb(d.bytes) + ' · abgelegt ' + esc(fdat(d.gespeichert)) + '</div></td>' +
        '<td style="white-space:nowrap"><button class="za-btn" ' + oeffnenAttr(d) + '>Öffnen</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function renderHistorie(){
    var alle = S.alt.filter(function(d){ return d.key === S.person; });
    var e = alle.length ? alle[0].ma : null, name = alle.length ? alle[0].anzeige : '';
    var liste = altFiltern(alle, false).sort(function(a, b){ return dsort(b.datum).localeCompare(dsort(a.datum)) || a.verfahren.localeCompare(b.verfahren, 'de') || a.nr - b.nr; });
    var h = '<div class="za-row"><button class="za-btn s" data-a="histback">← zurück zur Liste</button></div>' +
      '<h3 style="margin:4px 0 2px">' + esc(name) + '</h3><div class="za-muted" style="margin-bottom:10px">' +
      (e && e.number ? 'Personalnummer ' + (nrSichtbar() ? esc(e.number) : '••••••') + ' · ' : '') + (e && e.department ? esc(e.department) + ' · ' : '') +
      alle.length + ' Zertifikat(e): ' + alle.filter(function(d){ return d.aktuell && !d.abgelaufen; }).length + ' aktuell, ' + alle.filter(function(d){ return d.abgelaufen; }).length + ' abgelaufen, ' + alle.filter(function(d){ return !d.aktuell; }).length + ' früher</div>' + chipsHtml();
    h += '<div class="za-tw"><table><thead><tr><th>Schulungstag</th><th>Verfahren</th><th>Stufe</th><th>Status</th><th>Datei</th><th></th></tr></thead><tbody>';
    if (!liste.length) h += '<tr><td colspan="6" class="za-muted">Keine Zertifikate mit diesem Filter.</td></tr>';
    liste.forEach(function(d){
      var open = oeffnenAttr(d);
      h += '<tr><td>' + esc(d.datum || '–') + '</td><td>' + esc(d.verfahren) + '</td><td>' + esc(d.stufe === 'PW' ? 'PW' : (d.stufe ? 'Level ' + d.stufe : '–')) + '</td>' +
        '<td>' + statusBadge(d) + '</td>' +
        '<td>' + esc(d.file) + '<div class="za-muted">' + kb(d.bytes) + '</div></td><td style="white-space:nowrap"><button class="za-btn" ' + open + '>Öffnen</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function altLaden(){
    S.altLaedt = true; S.altFehler = ''; render();
    return fetch('/api/cert-alt').then(function(r){ return r.json().catch(function(){ return null; }).then(function(j){ if (!r.ok || !Array.isArray(j)) throw new Error((j && j.error) || ('HTTP ' + r.status)); return j; }); })
      .then(function(j){ S.alt = j; try { S.ma = S.opt && S.opt.mitarbeiter ? S.opt.mitarbeiter() : null; } catch (e) { S.ma = null; } altAnreichern(); S.altGeladen = true; })
      .catch(function(er){ S.altFehler = er.message; })
      .then(function(){ S.altLaedt = false; render(); });
  }

  function needXlsx(){
    if (window.XLSX) return Promise.resolve();
    return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = window.ZFP_BASE+'vendor/lib/xlsx-0.18.5.full.min.js'; s.onload = res; s.onerror = function(){ rej(new Error('Excel-Bibliothek nicht ladbar')); }; document.head.appendChild(s); });
  }
  function xlLesen(file){
    return needXlsx().then(function(){ return file.arrayBuffer(); }).then(function(buf){
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd.mm.yyyy', defval: '' });
      rows = rows.filter(function(r){ return r.some(function(c){ return String(c).trim() !== ''; }); });
      if (rows.length < 2) throw new Error('Keine Datenzeilen gefunden');
      var sp = rows[0].map(function(c, i){ return String(c).trim() || ('Spalte ' + (i + 1)); });
      var zeilen = rows.slice(1).map(function(r){ var o = {}; sp.forEach(function(c, i){ o[c] = r[i] == null ? '' : String(r[i]); }); return o; });
      return { dateiname: file.name, spalten: sp, zeilen: zeilen };
    });
  }

  function dateienUpload(){
    var kat = document.getElementById('zaKat').value, person = document.getElementById('zaPerson').value, titel = document.getElementById('zaTitel').value,
      datum = document.getElementById('zaDatum').value, bem = document.getElementById('zaBem').value, fehler = [];
    var chain = Promise.resolve();
    S.pending.forEach(function(f){
      chain = chain.then(function(){
        return fetch(url('/api/archiv/' + S.bereich + '/datei'), { method: 'POST', headers: {
          'Content-Type': 'application/pdf', 'X-Dateiname': encodeURIComponent(f.name), 'X-Kategorie': encodeURIComponent(kat), 'X-Person': encodeURIComponent(person),
          'X-Titel': encodeURIComponent(titel), 'X-Datum': datum, 'X-Bemerkung': encodeURIComponent(bem) }, body: f })
          .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) fehler.push(f.name + ': ' + (j.error || r.status)); }); });
      });
    });
    return chain.then(function(){ S.pending = null; return laden(); }).then(function(){ render(); if (fehler.length) alert('Nicht alle Dateien wurden gespeichert:\n' + fehler.join('\n')); });
  }

  function klick(e){
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.getAttribute('data-a'), id = el.getAttribute('data-id');
    if (a === 'close') { var o = document.getElementById('zfpArchiv'); if (o) o.remove(); return; }
    if (a === 'tab') { S.tab = el.getAttribute('data-t'); S.q = ''; S.person = null; if (S.tab === 'alt' && !S.altGeladen && !S.altLaedt) { altLaden(); return; } render(); return; }
    if (a === 'chip') { var m = el.getAttribute('data-k') === 'p' ? S.fProc : S.fLvl, v = el.getAttribute('data-v'); m[v] = !m[v];
      if (el.getAttribute('data-k') === 'p' && v === 'wirbelstrom' && !m[v]) { PROC_SUB.forEach(function(c){ delete S.fProc[c[0]]; }); } render(); return; }
    if (a === 'fclear') { S.q = ''; S.fProc = {}; S.fLvl = {}; S.fAbt = 'all'; render(); return; }
    if (a === 'hist') { S.person = el.getAttribute('data-p'); S.fProc = {}; S.fLvl = {}; S.fAbt = 'all'; render(); return; }
    if (a === 'histback') { S.person = null; render(); return; }
    if (a === 'openakt') { window.open('/api/cert/' + encodeURIComponent(el.getAttribute('data-proc')) + '/' + encodeURIComponent(el.getAttribute('data-base')), '_blank'); return; }
    if (a === 'openalt') { window.open('/api/cert-alt/' + encodeURIComponent(el.getAttribute('data-folder')) + '/' + encodeURIComponent(el.getAttribute('data-file')), '_blank'); return; }
    if (a === 'pick') { document.getElementById('zaFile').click(); return; }
    if (a === 'cancel') { S.pending = null; render(); return; }
    if (a === 'upload') { dateienUpload(); return; }
    if (a === 'open') { window.open(url('/api/archiv/' + S.bereich + '/datei/' + encodeURIComponent(id)), '_blank'); return; }
    if (a === 'del') {
      var d = S.dateien.find(function(x){ return x.id === id; });
      if (!confirm('„' + (d ? d.originalname : '') + '“ aus dem Archiv entfernen?\n\n(Die Datei wird in einen Papierkorb-Ordner auf dem Server verschoben.)')) return;
      api('/api/archiv/' + S.bereich + '/datei/' + encodeURIComponent(id), { method: 'DELETE' }).then(laden).then(render).catch(function(er){ alert(er.message); }); return;
    }
    if (a === 'xl') { document.getElementById('zaXl').click(); return; }
    if (a === 'tpl') { needXlsx().then(function(){ var ws = XLSX.utils.aoa_to_sheet([VORLAGE[S.bereich]]); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Historie'); XLSX.writeFile(wb, 'Vorlage_Historie_' + S.bereich + '.xlsx'); }); return; }
    if (a === 'xexp') { needXlsx().then(function(){ var sp = S.hist.spalten, aoa = [sp].concat(S.hist.zeilen.map(function(z){ return sp.map(function(c){ return z[c] || ''; }); })); var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Historie'); XLSX.writeFile(wb, 'Historie_' + S.bereich + '.xlsx'); }); return; }
    if (a === 'impcancel') { S.imp = null; render(); return; }
    if (a === 'impok') {
      api('/api/archiv/' + S.bereich + '/historie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S.imp) })
        .then(function(j){ S.hist = j.historie; S.imp = null; render(); }).catch(function(er){ alert(er.message); }); return;
    }
    if (a === 'impdel') {
      e.preventDefault();
      if (!confirm('Diesen Import (alle seine Zeilen) entfernen?')) return;
      api('/api/archiv/' + S.bereich + '/historie/' + encodeURIComponent(id), { method: 'DELETE' }).then(function(j){ S.hist = j.historie; render(); }).catch(function(er){ alert(er.message); });
    }
  }

  function dateiWahl(files){
    var l = Array.prototype.filter.call(files, function(f){ return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!l.length) { alert('Bitte PDF-Dateien wählen.'); return; }
    S.pending = l; render();
  }

  function oeffnen(bereich, opt){
    if (!KAT[bereich]) return;
    S.opt = opt || null;
    css(); S.bereich = bereich; S.tab = 'pdf'; S.q = ''; S.pending = null; S.imp = null; S.alt = []; S.altGeladen = false; S.altLaedt = false; S.altFehler = ''; S.person = null; S.fProc = {}; S.fLvl = {}; S.fAbt = 'all'; S.ma = null;
    var o = document.getElementById('zfpArchiv'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'zfpArchiv'; o.innerHTML = '<div class="za-box"><div class="za-b">Lade …</div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function(e){ if (e.target === o) { o.remove(); return; } klick(e); });
    o.addEventListener('change', function(e){
      if (e.target.id === 'zaAbt') { S.fAbt = e.target.value; render(); return; }
      if (e.target.id === 'zaFile') dateiWahl(e.target.files);
      if (e.target.id === 'zaXl' && e.target.files[0]) { xlLesen(e.target.files[0]).then(function(r){ S.imp = r; render(); }).catch(function(er){ alert('Excel konnte nicht gelesen werden: ' + er.message); }); e.target.value = ''; }
    });
    o.addEventListener('input', function(e){ if (e.target.id === 'zaQ') { S.q = e.target.value; var p = e.target.selectionStart; render(); var n = document.getElementById('zaQ'); if (n) { n.focus(); n.setSelectionRange(p, p); } } });
    o.addEventListener('dragover', function(e){ var d = document.getElementById('zaDrop'); if (d) { e.preventDefault(); d.classList.add('on'); } });
    o.addEventListener('dragleave', function(){ var d = document.getElementById('zaDrop'); if (d) d.classList.remove('on'); });
    o.addEventListener('drop', function(e){ var d = document.getElementById('zaDrop'); if (d) { e.preventDefault(); d.classList.remove('on'); dateiWahl(e.dataTransfer.files); } });
    laden().then(render).catch(function(er){ o.querySelector('.za-box').innerHTML = '<div class="za-b">Fehler: ' + esc(er.message) + '</div>'; });
  }
  window.ZfPArchiv = { oeffnen: oeffnen };
})();
