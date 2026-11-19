/* ============================================================================
 * ZfP Shared Context – Werk / Sprache / Theme (seitenübergreifend)
 * ----------------------------------------------------------------------------
 * Eine EINZIGE Quelle der Wahrheit für die drei globalen Einstellungen, die
 * über ALLE Apps hinweg synchron sein sollen:
 *
 *   • Werk    -> localStorage['zfp-aktives-werk']    (ID aus werke.json)
 *   • Sprache -> localStorage['zfp-lang']            ('de' | 'en')
 *   • Theme   -> localStorage['zfp-theme-preference']('dark' | 'light')
 *
 * GLOBALE THEME-REGELN (verbindlich für ALLE Seiten, auch Unter-Apps):
 *   1. Es gibt genau EINEN Speicherschlüssel und genau EINEN Standardwert
 *      (DEFAULT_THEME unten). Keine Seite darf eigene Schlüssel, eigene
 *      Standardwerte, System-Einstellung (prefers-color-scheme) oder eigene
 *      Fallback-Controller verwenden.
 *   2. Das Skript steht im <head> jeder Seite MIT Dark Mode und setzt
 *      <html data-theme="dark|light"> samt color-scheme bereits vor dem ersten
 *      Zeichnen und bei jeder Änderung. Seiten OHNE Dark Mode (Admin, Login,
 *      Handbuch) binden es nicht ein; die PMÜ-Protokollformulare ohne Dark Mode
 *      binden es nur für Sprache/Werk ein (Attribut data-theme-off) und bleiben hell.
 *   3. Seiten reagieren nur noch über ZfPContext.onTheme(fn) und schalten nur
 *      noch über ZfPContext.toggleTheme() / setTheme() um.
 *   4. Startwert = HELL. Nach „Dunkel“ bleibt es gespeichert, bis wieder
 *      „Hell“ gewählt wird (gilt für alle Seiten gemeinsam).
 *
 * Frühere Versionen der einzelnen Seiten benutzten UNTERSCHIEDLICHE
 * Schlüssel (z. B. 'zfp-lang-preference', 'MT_LANG_KEY', 'mpi-dark'). Deshalb
 * blieben Sprache/Theme beim Seitenwechsel nicht erhalten. Dieses Modul
 * migriert alte Schlüssel EINMALIG auf die kanonischen und hält danach alle
 * offenen Tabs über das native 'storage'-Event synchron.
 *
 * Das Modul ändert von sich aus NICHTS am DOM. Jede Seite registriert per
 * ZfPContext.onWerk / onLang / onTheme ihre eigene Anwendungsfunktion und
 * bekommt den aktuellen Wert sofort + bei jeder späteren Änderung gemeldet.
 * ========================================================================== */
(function (global) {
  'use strict';

  var KEY_WERK  = 'zfp-aktives-werk';
  var KEY_LANG  = 'zfp-lang';
  var KEY_THEME = 'zfp-theme-preference';

  var SCHWEINFURT_ID = 'schweinfurt';

  // Einziger Standardwert: Das Portal startet IMMER hell. Wird auf Dunkel gestellt,
  // merkt sich der Browser das (localStorage) – bis wieder auf Hell gestellt wird.
  var DEFAULT_THEME = 'light';

  // Alte Schlüssel, deren Wert (falls vorhanden und der neue noch leer ist)
  // einmalig übernommen wird.
  var LEGACY_LANG_KEYS  = ['zfp-lang-preference', 'MT_LANG_KEY', 'mt_lang'];
  var LEGACY_THEME_KEYS = ['THEME_KEY', 'mt-theme', 'zfp-theme', 'zfp_theme', 'gefuege_theme'];

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ─── Einmalige Migration alter Schlüssel ────────────────────────────────
  (function migrate() {
    if (!safeGet(KEY_LANG)) {
      for (var i = 0; i < LEGACY_LANG_KEYS.length; i++) {
        var v = safeGet(LEGACY_LANG_KEYS[i]);
        if (v === 'de' || v === 'en') { safeSet(KEY_LANG, v); break; }
      }
    }
    if (!safeGet(KEY_THEME)) {
      for (var j = 0; j < LEGACY_THEME_KEYS.length; j++) {
        var t = safeGet(LEGACY_THEME_KEYS[j]);
        if (t === 'dark' || t === 'light') { safeSet(KEY_THEME, t); break; }
      }
    }
    if (!safeGet(KEY_THEME)) {
      var mpi = safeGet('mpi-dark');
      if (mpi === '1' || mpi === 'true') safeSet(KEY_THEME, 'dark');
      else if (mpi === '0' || mpi === 'false') safeSet(KEY_THEME, 'light');
    }
    // Veraltete Einzelschlüssel entfernen, damit sie nie wieder als zweite
    // „Wahrheit“ herangezogen werden können.
    ['zfp-theme', 'zfp_theme', 'gefuege_theme', 'THEME_KEY', 'mt-theme', 'mpi-dark'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  })();

  function getWerk()  { return safeGet(KEY_WERK)  || SCHWEINFURT_ID; }
  function getLang()  { var v = safeGet(KEY_LANG);  return (v === 'en') ? 'en' : 'de'; }
  function normTheme(v) { return (v === 'light' || v === 'dark') ? v : DEFAULT_THEME; }
  function getTheme() { return normTheme(safeGet(KEY_THEME)); }

  // Setzt das Theme sofort am <html>-Element (vor dem ersten Zeichnen, weil das
  // Skript im <head> steht) – unabhängig davon, ob die Seite selbst reagiert.
  // Seiten OHNE Dark Mode (PMÜ-Formulare) laden das Skript nur für Sprache/Werk und setzen
  // <script ... data-theme-off>: dann werden weder data-theme noch color-scheme angefasst.
  var THEME_OFF = false;
  try { THEME_OFF = !!(document.currentScript && document.currentScript.hasAttribute('data-theme-off')); } catch (e) {}
  function applyDom(theme) {
    if (THEME_OFF) return;
    try {
      var root = document.documentElement;
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
    } catch (e) {}
  }
  applyDom(getTheme());

  var listeners = { werk: [], lang: [], theme: [] };

  function fire(kind, value) {
    if (kind === 'theme') {
      applyDom(value);
      try { document.dispatchEvent(new CustomEvent('zfp:theme', { detail: value })); } catch (e) {}
    }
    var arr = listeners[kind];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](value); } catch (e) { /* eine kaputte Callback darf den Rest nicht stoppen */ }
    }
  }

  function register(kind, cb, getter) {
    if (typeof cb !== 'function') return;
    listeners[kind].push(cb);
    // Aktuellen Wert sofort liefern, damit die Seite initial korrekt rendert.
    try { cb(getter()); } catch (e) {}
  }

  // ─── Setter: schreiben + lokale Callbacks feuern + andere Tabs bekommen
  //     automatisch das native 'storage'-Event ────────────────────────────
  function setWerk(id) {
    if (!id || id === getWerk()) { fire('werk', getWerk()); return; }
    safeSet(KEY_WERK, id);
    fire('werk', id);
  }
  function setLang(lang) {
    lang = (lang === 'en') ? 'en' : 'de';
    safeSet(KEY_LANG, lang);
    fire('lang', lang);
  }
  function toggleLang() { setLang(getLang() === 'de' ? 'en' : 'de'); }

  function setTheme(theme) {
    theme = normTheme(theme);
    safeSet(KEY_THEME, theme);
    fire('theme', theme);
  }
  function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

  // ─── Cross-Tab-Sync: Änderungen aus einem anderen Tab/Fenster ───────────
  global.addEventListener('storage', function (e) {
    if (!e) return;
    if (e.key === KEY_WERK)  fire('werk',  e.newValue || SCHWEINFURT_ID);
    else if (e.key === KEY_LANG)  fire('lang',  (e.newValue === 'en') ? 'en' : 'de');
    else if (e.key === KEY_THEME) fire('theme', normTheme(e.newValue));
  });

  // Zurück/Vorwärts-Navigation (bfcache): Seite zeigt sonst evtl. ein veraltetes Theme.
  var _lastThemeShown = getTheme();
  global.addEventListener('pageshow', function (e) {
    var t = getTheme();
    if (e && e.persisted && t !== _lastThemeShown) fire('theme', t);
    _lastThemeShown = t;
  });

  global.ZfPContext = {
    KEY_WERK: KEY_WERK, KEY_LANG: KEY_LANG, KEY_THEME: KEY_THEME,
    SCHWEINFURT_ID: SCHWEINFURT_ID,
    getWerk: getWerk, setWerk: setWerk,
    getLang: getLang, setLang: setLang, toggleLang: toggleLang,
    DEFAULT_THEME: DEFAULT_THEME,
    getTheme: getTheme, setTheme: setTheme, toggleTheme: toggleTheme,
    get theme() { return getTheme(); },   // Lesezugriff wie früher in den lokalen Fallbacks
    onWerk:  function (cb) { register('werk',  cb, getWerk); },
    onLang:  function (cb) { register('lang',  cb, getLang); },
    onTheme: function (cb) { register('theme', cb, getTheme); }
  };

  // ─── WERK-REGISTER + WERK-ABHÄNGIGE PFADE ───────────────────────────────
  // Damit einfache Seiten (v. a. die PMÜ-Unterseiten) das aktive Werk erben
  // können, ohne selbst ein Dropdown oder eigene Register-Logik zu enthalten,
  // stellt das Modul hier eine kleine Hilfe bereit:
  //   • ladeWerkRegister()  – lädt werke.json einmalig (mit Fallback)
  //   • werkSuffix()        – Suffix des aktiven Werks ('' = Schweinfurt)
  //   • protokolleBase()    – '/api/protokolle' bzw. '/api/protokolle__<suffix>'
  var _werkeRegister = [{ id: SCHWEINFURT_ID, name: 'Schweinfurt', suffix: '' }];
  var _registerGeladen = false;
  var _registerPromise = null; // laufendes Laden zwischenspeichern, damit parallele
                                // Aufrufe (z. B. mehrere Seiten-Skripte) NICHT jeweils
                                // eine eigene Anfrage starten und alle auf dasselbe
                                // Ergebnis warten können (siehe protokolleBase()-Fix).

  function ladeWerkRegister() {
    if (_registerGeladen) return Promise.resolve(_werkeRegister);
    if (_registerPromise) return _registerPromise; // bereits im Gange – dieselbe Zusage zurückgeben
    _registerPromise = fetch('/api/data/werke.json?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (arr) {
        if (Array.isArray(arr) && arr.length) {
          if (!arr.find(function (w) { return w.id === SCHWEINFURT_ID; }))
            arr.unshift({ id: SCHWEINFURT_ID, name: 'Schweinfurt', suffix: '' });
          _werkeRegister = arr;
        }
        _registerGeladen = true;
        _registerPromise = null;
        return _werkeRegister;
      })
      .catch(function () { _registerGeladen = true; _registerPromise = null; return _werkeRegister; });
    return _registerPromise;
  }

  function werkSuffix() {
    var id = getWerk();
    var w = _werkeRegister.find(function (x) { return x.id === id; });
    return (w && w.suffix) ? w.suffix : '';
  }

  function protokolleBase() {
    var suf = werkSuffix();
    return suf ? ('/api/protokolle__' + suf) : '/api/protokolle';
  }

  global.ZfPContext.ladeWerkRegister = ladeWerkRegister;
  global.ZfPContext.werkSuffix = werkSuffix;
  global.ZfPContext.protokolleBase = protokolleBase;
})(window);
