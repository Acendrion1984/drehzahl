/* ZfP-Schulungskalender – Anmeldung + Kalender (Supabase) */
(function () {
  'use strict';
  const CFG = window.ZFP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TYPES = ['Wirbelstrom Rissprüfung', 'Wirbelstrom Gefügeprüfung', 'Wirbelstrom Schleifbrandprüfung', 'Magnetpulverprüfung', 'Nital-Ätzen', 'Ultraschallprüfung', 'Eindringprüfung', 'Barkhausen Rauschen'];
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MIN_DEFAULT = { 'Wirbelstrom Rissprüfung': 3, 'Wirbelstrom Gefügeprüfung': 3, 'Wirbelstrom Schleifbrandprüfung': 3 };

  if (!CFG.SUPABASE_URL || /DEIN-PROJEKT/.test(CFG.SUPABASE_URL) || !window.supabase) {
    document.querySelector('main').innerHTML = '<div class="card login"><div class="sec"><span>Noch nicht eingerichtet</span></div><div class="pad"><p>In <code>web/config.js</code> fehlen die Supabase-Zugangsdaten (siehe README.md, Schritt 3).</p></div></div>';
    return;
  }
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  let me = null, isAdmin = false, trainings = [], regs = [], priv = {}, year = new Date().getFullYear(), selId = null, editId = null;

  // ---------- Hell/Dunkel (wie im Portal) ----------
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); $('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙'; try { localStorage.setItem('zfp-theme', t); } catch (e) { } }
  $('themeBtn').onclick = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  // ---------- Hilfen ----------
  function toast(t, ms) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => e.style.display = 'none', ms || 3500); }
  function msg(el, t, ok) { el.textContent = t; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.classList.toggle('hide', !t); }
  const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const parse = s => new Date(s + 'T12:00:00');
  const today0 = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
  function endDate(t) { const d = parse(t.start_date); d.setDate(d.getDate() + (t.days || 1) - 1); return d; }
  function dateText(t) { return t.days > 1 ? fmt(parse(t.start_date)) + ' – ' + fmt(endDate(t)) : fmt(parse(t.start_date)); }
  function regsOf(id) { return regs.filter(r => r.training_id === id); }
  function minOf(t) { return t.min_participants || MIN_DEFAULT[t.type] || 2; }
  function status(t) {   // gleiche Regeln wie die Datenbank
    const n = regsOf(t.id).length, td = today0(), start = parse(t.start_date);
    if (endDate(t) < td) return { key: 'past', text: 'Abgeschlossen', cls: 'gray', canReg: false };
    if (start <= td) return { key: 'run', text: 'Läuft / begonnen', cls: 'blue', canReg: false };
    if (n >= (t.max_participants || 11)) return { key: 'full', text: 'Ausgebucht', cls: 'red', canReg: false };
    const diff = Math.ceil((start - td) / 86400000);
    if (diff < 14 && n < minOf(t)) return { key: 'locked', text: 'Anmeldung gesperrt (Min. ' + minOf(t) + ' nicht erreicht)', cls: 'amb', canReg: false };
    return { key: 'open', text: 'Anmeldung offen', cls: '', canReg: true };
  }

  // ---------- Anmeldung am System ----------
  async function showLogin(note) {
    me = null; isAdmin = false; $('loginView').classList.remove('hide'); $('appView').classList.add('hide');
    $('userInfo').classList.add('hide'); $('logoutBtn').classList.add('hide'); if (note) msg($('lgMsg'), note, false);
  }
  function mailOk(mail) { const d = (CFG.ERLAUBTE_MAIL_DOMAIN || '').trim().toLowerCase(); return !d || mail.toLowerCase().endsWith(d); }
  $('lgBtn').onclick = async () => {
    const mail = $('lgMail').value.trim(), pw = $('lgPw').value; if (!mail || !pw) return msg($('lgMsg'), 'Bitte E-Mail und Passwort eingeben.', false);
    const { error } = await sb.auth.signInWithPassword({ email: mail, password: pw });
    if (error) msg($('lgMsg'), /confirm/i.test(error.message) ? 'Bitte zuerst die E-Mail bestätigen (Link in der Bestätigungsmail).' : 'Anmeldung fehlgeschlagen: ' + error.message, false);
  };
  $('lgPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('lgBtn').click(); });
  $('rgBtn').onclick = async () => {
    const mail = $('lgMail').value.trim(), pw = $('lgPw').value;
    if (!mail || pw.length < 8) return msg($('lgMsg'), 'Bitte E-Mail und ein Passwort mit mindestens 8 Zeichen eingeben.', false);
    if (!mailOk(mail)) return msg($('lgMsg'), 'Registrierung nur mit einer Adresse auf ' + CFG.ERLAUBTE_MAIL_DOMAIN + ' möglich.', false);
    const { data, error } = await sb.auth.signUp({ email: mail, password: pw, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (error) return msg($('lgMsg'), 'Konto konnte nicht angelegt werden: ' + error.message, false);
    msg($('lgMsg'), data && data.session ? 'Konto angelegt.' : 'Konto angelegt – bitte jetzt die Bestätigungsmail öffnen und den Link anklicken, danach anmelden.', true);
  };
  $('pwReset').onclick = async e => {
    e.preventDefault(); const mail = $('lgMail').value.trim(); if (!mail) return msg($('lgMsg'), 'Bitte oben die E-Mail eintragen.', false);
    const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: location.href.split('#')[0] });
    msg($('lgMsg'), error ? error.message : 'Falls das Konto existiert, wurde eine Mail zum Zurücksetzen verschickt.', !error);
  };
  $('logoutBtn').onclick = () => sb.auth.signOut();

  async function onSession(session) {
    if (!session) return showLogin();
    me = session.user;
    const { data: p } = await sb.from('profiles').select('is_admin').eq('id', me.id).maybeSingle();
    isAdmin = !!(p && p.is_admin);
    $('loginView').classList.add('hide'); $('appView').classList.remove('hide');
    $('userInfo').innerHTML = esc(me.email) + (isAdmin ? ' <span class="badge admin">Admin</span>' : ''); $('userInfo').classList.remove('hide'); $('logoutBtn').classList.remove('hide');
    $('newBtn').classList.toggle('hide', !isAdmin);
    await loadAll(); subscribe();
  }

  // ---------- Daten ----------
  async function loadAll() {
    const [t, r] = await Promise.all([sb.from('trainings').select('*').order('start_date'), sb.from('registrations').select('*').order('created_at')]);
    if (t.error || r.error) return toast('Daten konnten nicht geladen werden: ' + ((t.error || r.error).message));
    trainings = t.data || []; regs = r.data || [];
    const p = await sb.from('registration_private').select('*'); priv = {}; (p.data || []).forEach(x => priv[x.registration_id] = x);
    fillFilters(); render();
  }
  let chan = null;
  function subscribe() {
    if (chan) return; let tm = null; const later = () => { clearTimeout(tm); tm = setTimeout(loadAll, 400); };
    try { chan = sb.channel('kalender').on('postgres_changes', { event: '*', schema: 'public', table: 'trainings' }, later).on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, later).subscribe(); } catch (e) { }
  }

  // ---------- Kalender ----------
  function fillFilters() {
    const keep = [$('fType').value, $('fLoc').value];
    const types = [...new Set([...TYPES, ...trainings.map(t => t.type)])], locs = [...new Set(trainings.map(t => t.location))].sort();
    $('fType').innerHTML = '<option value="">Alle Schulungsarten</option>' + types.map(x => `<option>${esc(x)}</option>`).join('');
    $('fLoc').innerHTML = '<option value="">Alle Standorte</option>' + locs.map(x => `<option>${esc(x)}</option>`).join('');
    $('fType').value = keep[0]; $('fLoc').value = keep[1];
  }
  function render() {
    $('yLabel').textContent = year;
    const ft = $('fType').value, fl = $('fLoc').value;
    const list = trainings.filter(t => parse(t.start_date).getFullYear() === year && (!ft || t.type === ft) && (!fl || t.location === fl));
    $('months').innerHTML = MONTHS.map((m, i) => {
      const items = list.filter(t => parse(t.start_date).getMonth() === i);
      return `<div class="month"><h3>${m}</h3><div class="list">${items.length ? items.map(tile).join('') : '<div class="empty">–</div>'}</div></div>`;
    }).join('');
    $('months').querySelectorAll('.tile').forEach(b => b.onclick = () => { selId = b.dataset.id; render(); renderPanel(); $('panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    renderPanel();
  }
  function tile(t) {
    const s = status(t), n = regsOf(t.id).length;
    return `<button class="tile ${s.key === 'past' ? 'past' : ''} ${s.key === 'locked' ? 'locked' : ''} ${t.id === selId ? 'sel' : ''}" data-id="${esc(t.id)}">
      <div class="t1">${esc(t.type)}</div><div class="t2">${esc(dateText(t))} · ${esc(t.location)}</div>
      <div class="t2">👥 ${n}/${t.max_participants || 11} ${s.key === 'open' ? '' : '<span class="badge ' + s.cls + '">' + esc(s.key === 'locked' ? 'gesperrt' : s.text) + '</span>'}</div></button>`;
  }

  // ---------- Detail + Anmeldung ----------
  function renderPanel() {
    const t = trainings.find(x => x.id === selId), P = $('panel');
    if (!t) { P.classList.add('hide'); return; }
    P.classList.remove('hide');
    const s = status(t), list = regsOf(t.id), max = t.max_participants || 11;
    const canSeePriv = r => isAdmin || r.user_id === (me && me.id);
    let h = `<div class="sec"><span>📋 Schulung</span><span class="badge ${s.cls}">${esc(s.text)}</span></div><div class="pad"><h2>${esc(t.type)}</h2>
      <div class="meta"><span>📅 ${esc(dateText(t))}${t.start_time ? ' · ' + esc(String(t.start_time).slice(0, 5)) + ' Uhr' : ''}</span><span>📍 ${esc(t.location)}${t.room ? ', ' + esc(t.room) : ''}</span>${t.trainer ? '<span>👤 ' + esc(t.trainer) + '</span>' : ''}${t.qualification ? '<span>🎓 ' + esc(t.qualification) + '</span>' : ''}<span>${t.requalification ? '🔁 Requalifizierung' : 'Erstschulung'}</span><span>👥 ${list.length}/${max} (min. ${minOf(t)})</span></div>`;
    if (isAdmin) h += `<div class="row noprint" style="margin-bottom:.8rem"><button class="btn out sm" id="pEdit">✏️ Bearbeiten</button><button class="btn dang sm" id="pDel">🗑 Schulung löschen</button><button class="btn out sm" id="pCsv">⬇ Teilnehmerliste (CSV)</button><button class="btn out sm" id="pPrint">🖨 Anwesenheitsliste drucken</button></div>`;
    if (s.canReg || isAdmin && s.key !== 'past') {
      h += `<div class="noprint"><h3 class="sub">Anmelden${isAdmin && !s.canReg ? ' <span class="hint">(als Admin trotz Sperre möglich)</span>' : ''}</h3><div class="grid2">
        <div><label>Vorname *</label><input id="rVor" autocomplete="off"></div><div><label>Name *</label><input id="rNam" autocomplete="off"></div>
        <div><label>Personalnummer *</label><input id="rPnr" inputmode="numeric"></div><div><label>Abteilung *</label><input id="rAbt"></div>
        <div><label>Geburtsdatum</label><input id="rGeb" type="date"></div><div><label>Geburtsort</label><input id="rGeo"></div></div>
        <p class="hint">Geburtsdatum und -ort sind nur für dich und Admins sichtbar.</p>
        <div class="row"><button class="btn" id="rBtn">➕ Anmelden</button></div><div id="rMsg" class="msg err hide"></div></div>`;
    }
    h += `<h3 class="sub">📋 Teilnehmerliste</h3>` + (list.length ? `<div class="tw"><table><thead><tr><th>#</th><th>Name</th><th>Personalnr.</th><th>Abteilung</th>${isAdmin ? '<th>Geb.-Datum</th><th>Geburtsort</th>' : ''}<th class="noprint"></th></tr></thead><tbody>` +
      list.map((r, i) => { const pv = priv[r.id] || {}; const mine = me && r.user_id === me.id;
        return `<tr><td>${i + 1}</td><td><strong>${esc(r.vorname)} ${esc(r.name)}</strong>${mine ? ' <span class="badge">von dir</span>' : ''}</td><td>${esc(r.personalnummer)}</td><td>${esc(r.abteilung)}</td>${isAdmin ? `<td>${pv.geburtsdatum ? fmt(parse(pv.geburtsdatum)) : ''}</td><td>${esc(pv.geburtsort || '')}</td>` : ''}<td class="noprint">${(mine || isAdmin) && s.key !== 'past' ? `<button class="btn dang sm" data-del="${esc(r.id)}">Zurückziehen</button>` : ''}</td></tr>`; }).join('') + '</tbody></table></div>' : '<p class="hint">Noch keine Anmeldungen.</p>') + '</div>';
    $('panelCard').innerHTML = h;
    if ($('rBtn')) $('rBtn').onclick = () => register(t);
    $('panelCard').querySelectorAll('[data-del]').forEach(b => b.onclick = () => unregister(b.dataset.del));
    if (isAdmin) { $('pEdit').onclick = () => openModal(t); $('pDel').onclick = () => delTraining(t); $('pCsv').onclick = () => csv(t); $('pPrint').onclick = () => window.print(); }
  }
  async function register(t) {
    const v = id => $(id).value.trim(), m = $('rMsg');
    const vor = v('rVor'), nam = v('rNam'), pnr = v('rPnr'), abt = v('rAbt'), geb = $('rGeb').value, geo = v('rGeo');
    if (!vor || !nam || !pnr || !abt) return msg(m, 'Bitte Vorname, Name, Personalnummer und Abteilung ausfüllen.', false);
    if (!/^\d{4,10}$/.test(pnr)) return msg(m, 'Personalnummer: nur Ziffern (4–10 Stellen).', false);
    $('rBtn').disabled = true;
    const { data, error } = await sb.from('registrations').insert({ training_id: t.id, vorname: vor, name: nam, personalnummer: pnr, abteilung: abt }).select().single();
    if (error) { $('rBtn').disabled = false; return msg(m, /duplicate|unique/i.test(error.message) ? vor + ' ' + nam + ' ist in dieser Schulung bereits angemeldet.' : error.message, false); }
    if (geb || geo) { const e2 = await sb.from('registration_private').insert({ registration_id: data.id, geburtsdatum: geb || null, geburtsort: geo || null }); if (e2.error) toast('Geburtsdaten nicht gespeichert: ' + e2.error.message); }
    toast('✅ Angemeldet: ' + vor + ' ' + nam); await loadAll();
  }
  async function unregister(id) {
    const r = regs.find(x => x.id === id); if (!r || !confirm('Anmeldung von ' + r.vorname + ' ' + r.name + ' wirklich zurückziehen?')) return;
    const { error } = await sb.from('registrations').delete().eq('id', id); if (error) return toast('Fehler: ' + error.message);
    toast('Anmeldung zurückgezogen'); await loadAll();
  }
  function csv(t) {
    const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
    const rows = [['Nr', 'Vorname', 'Name', 'Personalnummer', 'Abteilung', 'Geburtsdatum', 'Geburtsort']].concat(regsOf(t.id).map((r, i) => { const p = priv[r.id] || {}; return [i + 1, r.vorname, r.name, r.personalnummer, r.abteilung, p.geburtsdatum ? fmt(parse(p.geburtsdatum)) : '', p.geburtsort || '']; }));
    const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ('Teilnehmer_' + t.type + '_' + t.start_date + '.csv').replace(/[^\w.\-äöüÄÖÜß]+/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- Schulung anlegen/bearbeiten (Admin) ----------
  function openModal(t) {
    editId = t ? t.id : null; $('trTitle').textContent = t ? 'Schulung bearbeiten' : 'Neue Schulung'; msg($('trMsg'), '', false);
    $('trType').innerHTML = [...new Set([...TYPES, ...(t ? [t.type] : [])])].map(x => `<option>${esc(x)}</option>`).join('');
    $('trType').value = t ? t.type : TYPES[0]; $('trLoc').value = t ? t.location : ''; $('trDate').value = t ? t.start_date : year + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-01';
    $('trDays').value = t ? t.days : 1; $('trTime').value = t ? String(t.start_time || '08:00').slice(0, 5) : '08:00'; $('trRoom').value = t ? (t.room || '') : ''; $('trTrainer').value = t ? (t.trainer || '') : '';
    $('trQual').value = t ? (t.qualification || '') : 'Prüfwerker'; $('trMin').value = t ? t.min_participants : (MIN_DEFAULT[$('trType').value] || 2); $('trMax').value = t ? t.max_participants : 11; $('trReq').checked = t ? !!t.requalification : true;
    $('trModal').classList.add('open');
  }
  $('trType').onchange = () => { if (!editId) $('trMin').value = MIN_DEFAULT[$('trType').value] || 2; };
  $('newBtn').onclick = () => openModal(null);
  $('trCancel').onclick = () => $('trModal').classList.remove('open');
  $('trSave').onclick = async () => {
    const o = { type: $('trType').value, location: $('trLoc').value.trim(), start_date: $('trDate').value, days: +$('trDays').value || 1, start_time: $('trTime').value || '08:00', room: $('trRoom').value.trim() || null, trainer: $('trTrainer').value.trim() || null, qualification: $('trQual').value || null, requalification: $('trReq').checked, min_participants: +$('trMin').value || 2, max_participants: +$('trMax').value || 11 };
    if (!o.location || !o.start_date) return msg($('trMsg'), 'Bitte Standort und Startdatum angeben.', false);
    if (o.min_participants > o.max_participants) return msg($('trMsg'), 'Min. darf nicht größer als Max. sein.', false);
    const q = editId ? sb.from('trainings').update(o).eq('id', editId).select().single() : sb.from('trainings').insert(o).select().single();
    const { data, error } = await q; if (error) return msg($('trMsg'), error.message, false);
    $('trModal').classList.remove('open'); year = parse(o.start_date).getFullYear(); selId = data ? data.id : selId; toast('✅ Gespeichert'); await loadAll();
  };
  async function delTraining(t) {
    const n = regsOf(t.id).length;
    if (!confirm('„' + t.type + '“ (' + dateText(t) + ') wirklich löschen?' + (n ? '\n\nAchtung: ' + n + ' Anmeldung(en) werden mit gelöscht.' : ''))) return;
    const { error } = await sb.from('trainings').delete().eq('id', t.id); if (error) return toast('Fehler: ' + error.message);
    selId = null; toast('Schulung gelöscht'); await loadAll();
  }

  // ---------- Start ----------
  $('yPrev').onclick = () => { year--; render(); }; $('yNext').onclick = () => { year++; render(); };
  $('fType').onchange = $('fLoc').onchange = render;
  sb.auth.onAuthStateChange((ev, session) => {   // keine weiteren Supabase-Aufrufe direkt im Callback (sonst Blockade) → setTimeout
    if (ev === 'SIGNED_OUT') { chan = null; trainings = regs = []; setTimeout(showLogin, 0); }
    else if (ev === 'PASSWORD_RECOVERY') setTimeout(async () => { const pw = prompt('Neues Passwort festlegen (mindestens 8 Zeichen):'); if (pw && pw.length >= 8) { const r = await sb.auth.updateUser({ password: pw }); alert(r.error ? r.error.message : 'Passwort geändert.'); } onSession(session); }, 0);
    else if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') setTimeout(() => onSession(session), 0);
  });
  sb.auth.getSession().then(({ data }) => { if (!data.session) showLogin(); });
})();
