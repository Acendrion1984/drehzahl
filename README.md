# ZfP-Schulungskalender + Operator-Audit / Qualimatrix (GitHub Pages + Supabase)

Das Repository enthält zwei Apps im selben Supabase-Projekt und mit demselben Login:
- **Schulungskalender** – `web/` → `https://acendrion1984.github.io/drehzahl/`
- **Operator-Audit mit Qualifikationsmatrix** – `web/operator/` → `https://acendrion1984.github.io/drehzahl/operator/` (Abschnitt *Operator-Audit / Qualimatrix* unten)

Eigenständiger Schulungskalender mit Anmeldung – **ohne** Namens-/Mitarbeiterdatenbank, Prüfungssystem und Simulatoren.

**Funktionen**
- Jahreskalender (12 Monate), Filter nach Schulungsart und Standort
- Anmeldung mit Login (E-Mail + Passwort); Vorname, Name, Personalnummer, Abteilung, Geburtsdatum/-ort
- Teilnehmerliste, Zurückziehen der eigenen Anmeldung, doppelte Anmeldung wird verhindert
- Regeln wie im ZfP-Portal: max. Teilnehmer (Standard 11); innerhalb von 14 Tagen vor Beginn ist die Anmeldung gesperrt, wenn das Minimum nicht erreicht ist; nach Beginn keine Anmeldung
- Admins: Schulungen anlegen/bearbeiten/löschen, beliebige Anmeldungen entfernen, CSV-Export, Anwesenheitsliste drucken
- Geburtsdatum/-ort sieht nur die anmeldende Person selbst und Admins (eigene Tabelle mit Zugriffsregeln)
- Schaeffler-Design wie im ZfP-Portal (Barlow-Schrift lokal eingebunden, Hell/Dunkel-Umschalter, Schaeffler-Logo)
- Live-Aktualisierung (Realtime), Passwort-Reset per Mail
- Die Regeln sitzen **in der Datenbank** (Row Level Security + Trigger), nicht nur im Browser

## Einrichtung (ca. 20 Minuten)

### 1. Supabase-Projekt
1. <https://supabase.com> → Konto → **New project** (Region z. B. Frankfurt), Datenbank-Passwort merken.
2. **SQL Editor → New query**: kompletten Inhalt von `supabase/schema.sql` einfügen → **Run**. (Mehrfaches Ausführen ist unschädlich.)
3. **Authentication → Providers → Email**: aktiv lassen. Empfehlung: „Confirm email“ an.
4. **Authentication → URL Configuration**: *Site URL* = die spätere Adresse der Seite (Schritt 4), z. B. `https://DEINNAME.github.io/zfp-schulungskalender/`; dieselbe Adresse zusätzlich unter *Redirect URLs*.
5. **Project Settings → API**: *Project URL* und *anon public* Key kopieren (nicht den `service_role`-Key!).

### 2. GitHub-Repository
1. Auf <https://github.com> ein neues Repository anlegen (z. B. `zfp-schulungskalender`).
2. Den **Inhalt** dieses Ordners hochladen (Web-Oberfläche: *Add file → Upload files*; wichtig: auch der versteckte Ordner `.github`). Oder per Git:
   ```
   git init && git add . && git commit -m "Schulungskalender"
   git branch -M main
   git remote add origin https://github.com/DEINNAME/zfp-schulungskalender.git
   git push -u origin main
   ```

### 3. Zugangsdaten eintragen (eine der beiden Möglichkeiten)
- **A (einfach):** `web/config.js` bearbeiten: `SUPABASE_URL` und `SUPABASE_ANON_KEY` eintragen. Der anon-Key ist für den Browser gedacht und darf im Repository stehen – geschützt wird durch die Regeln aus `schema.sql`.
- **B (ohne Key im Code):** GitHub → *Settings → Secrets and variables → Actions → Variables* → `SUPABASE_URL` und `SUPABASE_ANON_KEY` anlegen (optional `ERLAUBTE_MAIL_DOMAIN`, z. B. `@schaeffler.com`). Der Workflow erzeugt `config.js` beim Veröffentlichen selbst.

### 4. GitHub Pages einschalten
*Settings → Pages → Build and deployment → Source: **GitHub Actions***. Nach dem nächsten Push (oder *Actions → Seite veröffentlichen → Run workflow*) ist die Seite unter `https://DEINNAME.github.io/zfp-schulungskalender/` erreichbar.
(Private Repositories brauchen für Pages einen GitHub-Plan, der das erlaubt. Alternative: `web/` bei Netlify/Cloudflare Pages/Firmen-Webserver hosten – es sind nur statische Dateien.)

### 5. Ersten Admin festlegen
1. In der Seite mit der eigenen E-Mail **Konto anlegen**, Bestätigungsmail klicken, anmelden.
2. Supabase → SQL Editor:
   ```sql
   update public.profiles set is_admin = true where email = 'deine.mail@firma.de';
   ```
3. Seite neu laden – oben steht jetzt „Admin“, und **➕ Neue Schulung** erscheint. Weitere Admins genauso.

## Hinweise
- **Datenschutz:** Namen, Personalnummer und Abteilung sind für alle angemeldeten Nutzer in der Teilnehmerliste sichtbar (wie im Kalender des Portals). Geburtsdatum/-ort nur für die Person selbst und Admins. Vor dem Produktivbetrieb Datenschutz/Betriebsrat einbinden; Supabase-Region EU wählen.
- **Registrierung begrenzen:** `ERLAUBTE_MAIL_DOMAIN` in `config.js` hält nur den Browser auf. Echte Sperre: in Supabase *Authentication → Sign In / Providers* die Registrierung deaktivieren und Benutzer unter *Authentication → Users → Invite user* einladen.
- **Sicherung:** Supabase *Database → Backups* (je nach Plan) oder CSV-Export pro Schulung.
- **Schulungsarten ändern:** in `web/app.js` die Liste `TYPES` (und ggf. `MIN_DEFAULT`).
- **Kostenlos?** Supabase Free und GitHub Pages reichen für diese Nutzung. Hinweis: Supabase pausiert Free-Projekte nach längerer Inaktivität.
- **Lokaler Test:** `cd web && python3 -m http.server 8080` → <http://localhost:8080>

## Operator-Audit / Qualimatrix (`web/operator/`)

Operator-App (Operator-Audit, Qualifikationsmatrix, Mitarbeiterliste, Autorisierung als PDF, Audit-Bericht, Zertifikat-Historie, Archiv). Die App ist unverändert; `web/operator/supabase-adapter.js` ersetzt die Aufrufe des früheren Node-Servers durch Supabase. Self-Audit und Review sind nicht enthalten.

**Einrichtung:** nach `supabase/schema.sql` zusätzlich `supabase/schema_operator.sql` im SQL Editor ausführen (bereits erledigt). `web/operator/config.js` enthält dasselbe Projekt wie `web/config.js`. Der Pages-Workflow veröffentlicht den Unterordner automatisch mit.

**Zugriff:** Weil sich im Kalender jeder registrieren kann, sehen die Qualimatrix-Daten (Tabellen `kv`, `audits`, Bucket `zfp-pdfs`) nur Admins und Nutzer mit dem Recht `operator_zugang`. Weitere Rechte (Admin hat alle):

| Recht | Wirkung |
|---|---|
| `operator_zugang` | Qualimatrix-Daten lesen und bearbeiten (Grundrecht) |
| `operator_archiv` | Archiv der Qualimatrix öffnen |
| `operator_personaldaten` | Personaldaten (Geburtsdatum usw.) freischalten |
| `operator_audit_loeschen` | Audits löschen / nachträglich signieren (von der Datenbank erzwungen) |
| `operator_autorisierung_loeschen` | gespeicherte Autorisierungen löschen |
| `operator_mitarbeiter_loeschen` | Mitarbeiter löschen |
| `operator_zertifikate_verlaengern` | Zertifikate verlängern |

```sql
update public.profiles set rechte = array['operator_zugang','operator_archiv'],
  abteilungen = array['Abteilung A'] where email = 'name@firma.de';
```

**Daten:** JSON-Dokumente (Werke, Mitarbeiter, Fragenkataloge, Listen) → Tabelle `kv` (`name` = Dateiname, `data` = Inhalt); abgeschlossene Audits → `audits`; PDFs → privater Bucket `zfp-pdfs`. Zertifikat-PDFs lassen sich in der Qualimatrix über die Import-Funktion einlesen.

**Unterschiede zur Node-Version:** gleichzeitiges Bearbeiten → „letzter Stand gewinnt“ (leere Stände überschreiben keine Daten); Ausblendung von Personaldaten nach Abteilung nur in der Oberfläche (alle mit `operator_zugang` können die Daten technisch lesen); Datum früherer Zertifikatsfassungen = Upload-Datum; nicht enthalten: Nutzerverwaltung (→ Supabase-Dashboard), Audit-Log, OMS-Abfrage, automatische Datensicherung. Supabase Free: 1 GB Storage.
