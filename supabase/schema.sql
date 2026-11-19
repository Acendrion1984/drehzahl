-- ============================================================
-- ZfP-Schulungskalender – Datenbank für Supabase
-- Im Supabase-Dashboard: SQL Editor → New query → alles einfügen → Run
-- (kann gefahrlos mehrfach ausgeführt werden)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Profile (Rolle Admin ja/nein) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- bereits vorhandene Benutzer nachtragen
insert into public.profiles (id, email)
  select id, email from auth.users on conflict (id) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ---------- Schulungen ----------
create table if not exists public.trainings (
  id               uuid primary key default gen_random_uuid(),
  type             text not null,
  location         text not null,
  room             text,
  trainer          text,
  start_date       date not null,
  days             int  not null default 1 check (days between 1 and 14),
  start_time       time not null default '08:00',
  qualification    text,
  requalification  boolean not null default true,
  min_participants int  not null default 2 check (min_participants >= 1),
  max_participants int  not null default 11 check (max_participants >= 1),
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists trainings_start_idx on public.trainings (start_date);

-- ---------- Anmeldungen ----------
create table if not exists public.registrations (
  id             uuid primary key default gen_random_uuid(),
  training_id    uuid not null references public.trainings(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vorname        text not null,
  name           text not null,
  personalnummer text not null,
  abteilung      text not null,
  created_at     timestamptz not null default now()
);
create unique index if not exists registrations_unique_person
  on public.registrations (training_id, lower(btrim(vorname)), lower(btrim(name)));
create index if not exists registrations_training_idx on public.registrations (training_id);

-- Geburtsdatum/-ort getrennt: sichtbar nur für die anmeldende Person und Admins
create table if not exists public.registration_private (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  geburtsdatum    date,
  geburtsort      text
);

-- ---------- Regeln beim Anmelden (nur für Nicht-Admins) ----------
create or replace function public.check_registration() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.trainings; cnt int; diff int;
begin
  if public.is_admin() then return new; end if;
  select * into t from public.trainings where id = new.training_id;
  if not found then raise exception 'Schulung nicht gefunden'; end if;
  if t.start_date <= current_date then
    raise exception 'Die Schulung hat bereits begonnen – keine Anmeldung mehr möglich';
  end if;
  select count(*) into cnt from public.registrations where training_id = new.training_id;
  if cnt >= t.max_participants then
    raise exception 'Maximale Teilnehmerzahl erreicht (%)', t.max_participants;
  end if;
  diff := t.start_date - current_date;
  if diff < 14 and cnt < t.min_participants then
    raise exception 'Anmeldung gesperrt: Mindestteilnehmerzahl (%) nicht erreicht', t.min_participants;
  end if;
  return new;
end $$;

drop trigger if exists registrations_check on public.registrations;
create trigger registrations_check before insert on public.registrations
  for each row execute function public.check_registration();

-- ---------- Zugriffsregeln (Row Level Security) ----------
alter table public.profiles             enable row level security;
alter table public.trainings            enable row level security;
alter table public.registrations        enable row level security;
alter table public.registration_private enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists trainings_select on public.trainings;
create policy trainings_select on public.trainings for select to authenticated using (true);
drop policy if exists trainings_write on public.trainings;
create policy trainings_write on public.trainings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists registrations_select on public.registrations;
create policy registrations_select on public.registrations for select to authenticated using (true);
drop policy if exists registrations_insert on public.registrations;
create policy registrations_insert on public.registrations for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists registrations_delete on public.registrations;
create policy registrations_delete on public.registrations for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists regpriv_select on public.registration_private;
create policy regpriv_select on public.registration_private for select to authenticated
  using (public.is_admin() or exists (select 1 from public.registrations r
         where r.id = registration_id and r.user_id = auth.uid()));
drop policy if exists regpriv_insert on public.registration_private;
create policy regpriv_insert on public.registration_private for insert to authenticated
  with check (exists (select 1 from public.registrations r
         where r.id = registration_id and r.user_id = auth.uid()));

-- ---------- Live-Aktualisierung ----------
do $$ begin
  begin alter publication supabase_realtime add table public.trainings;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.registrations; exception when others then null; end;
end $$;

-- ============================================================
-- ERSTEN ADMIN FESTLEGEN (nachdem du dich in der App registriert hast):
--   update public.profiles set is_admin = true where email = 'deine.mail@firma.de';
-- ============================================================
