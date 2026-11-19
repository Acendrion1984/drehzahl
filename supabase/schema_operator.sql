-- ============================================================
-- ZfP Operator Audit (inkl. Qualifikationsmatrix) – Supabase-Schema
-- Ergänzung zu supabase/schema.sql (Schulungskalender) im SELBEN Projekt.
-- Reihenfolge: zuerst schema.sql, dann diese Datei. Mehrfaches Ausführen ist unkritisch.
--
-- Abweichungen vom Original-Paket (damit beide Apps sich ein Projekt teilen):
--  * profiles stammt aus schema.sql; hier werden nur die Spalten rechte/abteilungen ergänzt.
--  * Kein eigener Trigger für neue Nutzer (übernimmt schema.sql) und kein
--    "erster Nutzer wird Admin" – Admins werden per SQL gesetzt.
--  * Zugriff auf Qualimatrix-Daten (kv, audits, PDFs) nur für Admins und
--    Nutzer mit dem Recht 'operator_zugang'. Grund: Im Schulungskalender kann
--    sich jeder registrieren – diese Konten sollen die Personaldaten der
--    Qualimatrix NICHT lesen können.
-- ============================================================

-- 1) Profile / Rechte ------------------------------------------------------
alter table public.profiles add column if not exists rechte text[] not null default '{}';      -- z. B. operator_zugang, operator_archiv ...
alter table public.profiles add column if not exists abteilungen text[] not null default '{}'; -- Abteilungen, deren Personaldaten sichtbar sind (Admin: alle)

create or replace function public.ist_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.hat_recht(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin or r = any(rechte) from public.profiles where id = auth.uid()), false) $$;

create or replace function public.operator_zugang() returns boolean
language sql stable security definer set search_path = public as $$
  select public.hat_recht('operator_zugang') $$;

create or replace function public.mein_profil() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('is_admin', is_admin, 'rechte', rechte, 'abteilungen', abteilungen, 'email', email)
  from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
drop policy if exists profiles_lesen on public.profiles;
create policy profiles_lesen on public.profiles for select to authenticated using (id = auth.uid() or public.ist_admin());
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all to authenticated using (public.ist_admin()) with check (public.ist_admin());

-- 2) JSON-Dokumente (werke.json, Mitarbeiter, Fragenkataloge, Listen ...) -------
create table if not exists public.kv (
  name text primary key,
  data jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.kv enable row level security;
drop policy if exists kv_lesen on public.kv;
create policy kv_lesen on public.kv for select to authenticated using (public.operator_zugang());
drop policy if exists kv_loeschen on public.kv;
create policy kv_loeschen on public.kv for delete to authenticated using (public.ist_admin());

-- Schreiben nur über diese Funktion (Versionszähler, Schutz vor leerem Überschreiben)
create or replace function public.kv_speichern(p_name text, p_data jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare alt jsonb; v bigint;
begin
  if auth.uid() is null then raise exception 'NICHT_ANGEMELDET'; end if;
  if not public.operator_zugang() then raise exception 'KEIN_ZUGRIFF'; end if;
  select data into alt from public.kv where name = p_name;
  if (p_data is null or p_data = '[]'::jsonb or p_data = '{}'::jsonb or p_data = 'null'::jsonb)
     and alt is not null and alt <> '[]'::jsonb and alt <> '{}'::jsonb and alt <> 'null'::jsonb then
    raise exception 'LEERER_STAND_ABGEWIESEN';
  end if;
  insert into public.kv (name, data, version, updated_at, updated_by)
  values (p_name, p_data, 1, now(), auth.uid())
  on conflict (name) do update set data = excluded.data, version = public.kv.version + 1, updated_at = now(), updated_by = auth.uid()
  returning version into v;
  return v;
end $$;

-- 3) Abgeschlossene Audits (je Audit ein Dokument) ---------------------------
create table if not exists public.audits (
  name text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.audits enable row level security;
drop policy if exists audits_lesen on public.audits;
create policy audits_lesen on public.audits for select to authenticated using (public.operator_zugang());
drop policy if exists audits_schreiben on public.audits;
create policy audits_schreiben on public.audits for insert to authenticated with check (public.operator_zugang());
drop policy if exists audits_aendern on public.audits;
create policy audits_aendern on public.audits for update to authenticated using (public.operator_zugang()) with check (public.operator_zugang());
drop policy if exists audits_loeschen on public.audits;
create policy audits_loeschen on public.audits for delete to authenticated using (public.hat_recht('operator_audit_loeschen'));

-- 4) PDF-Ablage (Zertifikate, Autorisierungen, Archiv) -----------------------
insert into storage.buckets (id, name, public) values ('zfp-pdfs', 'zfp-pdfs', false)
on conflict (id) do nothing;
drop policy if exists pdf_lesen on storage.objects;
create policy pdf_lesen on storage.objects for select to authenticated using (bucket_id = 'zfp-pdfs' and public.operator_zugang());
drop policy if exists pdf_schreiben on storage.objects;
create policy pdf_schreiben on storage.objects for insert to authenticated with check (bucket_id = 'zfp-pdfs' and public.operator_zugang());
drop policy if exists pdf_aendern on storage.objects;
create policy pdf_aendern on storage.objects for update to authenticated using (bucket_id = 'zfp-pdfs' and public.operator_zugang());
drop policy if exists pdf_loeschen on storage.objects;
create policy pdf_loeschen on storage.objects for delete to authenticated using (bucket_id = 'zfp-pdfs' and public.operator_zugang());

-- Fertig. Rechte vergeben (Beispiele):
--   update public.profiles set rechte = array['operator_zugang','operator_archiv','operator_personaldaten','operator_audit_loeschen',
--     'operator_autorisierung_loeschen','operator_mitarbeiter_loeschen','operator_zertifikate_verlaengern'] where email = 'name@firma.de';
--   update public.profiles set abteilungen = array['Abteilung A'] where email = 'name@firma.de';
