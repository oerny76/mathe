-- ERSETZT durch zugangscodes.sql (geprüfte Funktionen mit Code) und
-- zugriff_sperren.sql. Nach dem Sperren NICHT erneut ausführen, sonst öffnet
-- die Datei den Zugriff für den öffentlichen Schlüssel wieder.
-- Extra-Übungen außerhalb der App (z.B. Anton, mit den Eltern). Wird von der
-- Kind-App geräteübergreifend synchronisiert. Einmalig im Supabase SQL-Editor
-- ausführen (Dashboard > SQL Editor > New query > einfügen > Run).

create table if not exists public.extra_practice (
  id uuid primary key,
  kid_id text not null check (kid_id in ('kind1', 'kind2')),
  practiced_on date not null check (practiced_on <= current_date + 1),
  minutes integer not null check (minutes between 5 and 180),
  art text not null check (art in ('anton', 'eltern', 'lesen', 'sonstiges')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists extra_practice_kid_day_idx
  on public.extra_practice (kid_id, practiced_on);

alter table public.extra_practice enable row level security;

drop policy if exists "extra_practice lesen" on public.extra_practice;
create policy "extra_practice lesen"
  on public.extra_practice for select to anon
  using (true);

drop policy if exists "extra_practice eintragen" on public.extra_practice;
create policy "extra_practice eintragen"
  on public.extra_practice for insert to anon
  with check (deleted_at is null);

-- "Löschen" setzt nur deleted_at (Eintrag bleibt als Spur erhalten).
drop policy if exists "extra_practice entfernen" on public.extra_practice;
create policy "extra_practice entfernen"
  on public.extra_practice for update to anon
  using (true) with check (true);

revoke all on public.extra_practice from anon, authenticated;
grant select, insert on public.extra_practice to anon;
grant update (deleted_at) on public.extra_practice to anon;
