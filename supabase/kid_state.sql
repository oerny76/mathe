-- Gemeinsamer Spielstand pro Kind (Sterne, Übungstage, Kopfrechnen, Ergebnisse
-- der Arbeitsblätter, Klassenstufen-Einstellung), damit alle Geräte denselben
-- Stand zeigen. Einmalig im Supabase SQL-Editor ausführen
-- (Dashboard > SQL Editor > New query > einfügen > Run).

create table if not exists public.kid_state (
  kid_id text primary key check (kid_id in ('kind1', 'kind2')),
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object' and octet_length(state::text) < 500000),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Verlauf: Vor jeder Änderung wird der alte Stand gesichert (die letzten 300
-- pro Kind bleiben erhalten), damit sich nach einem Fehler zurückgehen lässt.
-- Kein Zugriff für die App, nur im Dashboard/SQL-Editor lesbar.
create table if not exists public.kid_state_log (
  id bigint generated always as identity primary key,
  kid_id text not null,
  state jsonb not null,
  version integer not null,
  saved_at timestamptz not null default now()
);

create index if not exists kid_state_log_kid_idx on public.kid_state_log (kid_id, id desc);

create or replace function public.kid_state_log_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.kid_state_log (kid_id, state, version)
  values (old.kid_id, old.state, old.version);

  delete from public.kid_state_log
  where kid_id = old.kid_id
    and id not in (
      select id from public.kid_state_log
      where kid_id = old.kid_id
      order by id desc
      limit 300
    );

  return new;
end;
$$;

drop trigger if exists kid_state_log_trg on public.kid_state;
create trigger kid_state_log_trg
  before update on public.kid_state
  for each row execute function public.kid_state_log_fn();

alter table public.kid_state enable row level security;
alter table public.kid_state_log enable row level security;

drop policy if exists "kid_state lesen" on public.kid_state;
create policy "kid_state lesen"
  on public.kid_state for select to anon
  using (true);

drop policy if exists "kid_state anlegen" on public.kid_state;
create policy "kid_state anlegen"
  on public.kid_state for insert to anon
  with check (true);

drop policy if exists "kid_state aendern" on public.kid_state;
create policy "kid_state aendern"
  on public.kid_state for update to anon
  using (true) with check (true);

revoke all on public.kid_state from anon, authenticated;
grant select, insert, update on public.kid_state to anon;

revoke all on public.kid_state_log from anon, authenticated;
revoke all on function public.kid_state_log_fn() from public, anon, authenticated;
