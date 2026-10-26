-- Teil 1 von 3: Zugangscodes und geprüfte Funktionen.
-- Ungefährlich: Es kommen nur neue Tabellen und Funktionen dazu, am bisherigen
-- Zugriff ändert sich nichts. Einmalig im Supabase SQL-Editor ausführen.
--
-- Reihenfolge der Umstellung:
--   1. zugangscodes.sql      (diese Datei)
--   2. codes_erzeugen.sql    (Codes erzeugen und notieren)
--   3. App-Update einspielen und mit den Codes anmelden
--   4. zugriff_sperren.sql   (erst danach: alte offene Zugriffe schließen)
--
-- Prinzip wie bei der Stammtisch-App: Die Tabellen sind für den Browser
-- gesperrt, jede Funktion prüft den persönlichen Code und die Rolle.
-- Gespeichert wird nur ein Hash der Codes, nie der Code selbst.

create table if not exists public.access_tokens (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('kind', 'eltern')),
  kid_id text check (kid_id in ('kind1', 'kind2')),
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((role = 'kind' and kid_id is not null) or (role = 'eltern' and kid_id is null))
);

alter table public.access_tokens enable row level security;
revoke all on public.access_tokens from anon, authenticated;

-- Hash eines Codes (Groß-/Kleinschreibung, Leerzeichen und Bindestriche egal).
create or replace function public._code_hash(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(regexp_replace(coalesce(p, ''), '[\s-]', '', 'g')), 'UTF8')), 'hex')
$$;

create or replace function public._auth(p_token text)
returns public.access_tokens
language plpgsql
stable
security definer
set search_path = ''
as $$
declare t public.access_tokens;
begin
  select * into t from public.access_tokens
  where token_hash = public._code_hash(p_token) and revoked_at is null;
  if t.id is null then
    raise exception 'Code ungueltig' using errcode = '28000';
  end if;
  return t;
end;
$$;

create or replace function public._auth_kid(p_token text, p_kid text)
returns public.access_tokens
language plpgsql
stable
security definer
set search_path = ''
as $$
declare t public.access_tokens;
begin
  t := public._auth(p_token);
  if p_kid is null or p_kid not in ('kind1', 'kind2') then
    raise exception 'Unbekanntes Kind' using errcode = '22023';
  end if;
  if t.role = 'kind' and t.kid_id <> p_kid then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return t;
end;
$$;

create or replace function public._auth_eltern(p_token text)
returns public.access_tokens
language plpgsql
stable
security definer
set search_path = ''
as $$
declare t public.access_tokens;
begin
  t := public._auth(p_token);
  if t.role <> 'eltern' then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return t;
end;
$$;

-- Wer ist das? Liefert Rolle und Kind zum Code (oder Fehler "Code ungueltig").
create or replace function public.app_check(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare t public.access_tokens;
begin
  t := public._auth(p_token);
  return jsonb_build_object('role', t.role, 'kid_id', t.kid_id);
end;
$$;

-- Ist das ein gültiger Eltern-Code? (für Einstellungen und "als richtig werten")
create or replace function public.app_eltern_check(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._auth_eltern(p_token);
  return true;
exception when others then
  return false;
end;
$$;

-- Einfacher Lebenszeichen-Aufruf ohne Code (hält das Gratis-Projekt wach).
create or replace function public.app_ping()
returns text
language sql
stable
set search_path = ''
as $$ select 'ok'::text $$;

create or replace function public.app_attempt_add(
  p_token text, p_kid text, p_file text, p_bereich text, p_woche text,
  p_correct integer, p_total integer, p_answers jsonb, p_completed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._auth_kid(p_token, p_kid);
  if p_file is null or length(p_file) > 200 or p_total is null or p_total < 1 or p_total > 200
     or p_correct is null or p_correct < 0 or p_correct > p_total then
    raise exception 'Ergebnis ungueltig' using errcode = '22023';
  end if;
  insert into public.attempts (kid_id, worksheet_file, bereich, woche, correct_count, total, answers, completed_at)
  values (p_kid, p_file, p_bereich, p_woche, p_correct, p_total, p_answers, coalesce(p_completed_at, now()));
end;
$$;

create or replace function public.app_attempts_list(p_token text, p_kid text, p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._auth_kid(p_token, p_kid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'worksheet_file', a.worksheet_file, 'bereich', a.bereich, 'woche', a.woche,
      'correct_count', a.correct_count, 'total', a.total, 'completed_at', a.completed_at
    ) order by a.completed_at)
    from public.attempts a
    where a.kid_id = p_kid and a.completed_at >= coalesce(p_since, '-infinity'::timestamptz)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.app_state_get(p_token text, p_kid text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r public.kid_state;
begin
  perform public._auth_kid(p_token, p_kid);
  select * into r from public.kid_state where kid_id = p_kid;
  if r.kid_id is null then
    return null;
  end if;
  return jsonb_build_object('state', r.state, 'version', r.version);
end;
$$;

-- Speichert den Stand nur, wenn er seit dem Laden nicht von einem anderen Gerät
-- geändert wurde (p_expected = Version beim Laden, 0 = noch kein Stand).
-- Liefert die neue Version oder null bei Konflikt.
create or replace function public.app_state_put(p_token text, p_kid text, p_state jsonb, p_expected integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v integer; n integer;
begin
  perform public._auth_kid(p_token, p_kid);
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) >= 500000 then
    raise exception 'Stand ungueltig' using errcode = '22023';
  end if;
  if coalesce(p_expected, 0) = 0 then
    insert into public.kid_state (kid_id, state, version) values (p_kid, p_state, 1)
    on conflict (kid_id) do nothing;
    get diagnostics n = row_count;
    return case when n = 1 then 1 else null end;
  end if;
  update public.kid_state
  set state = p_state, version = version + 1, updated_at = now()
  where kid_id = p_kid and version = p_expected
  returning version into v;
  return v;
end;
$$;

create or replace function public.app_extra_list(p_token text, p_kid text, p_since date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._auth_kid(p_token, p_kid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'kid_id', e.kid_id, 'practiced_on', e.practiced_on,
      'minutes', e.minutes, 'art', e.art, 'created_at', e.created_at
    ) order by e.practiced_on, e.created_at)
    from public.extra_practice e
    where e.kid_id = p_kid and e.deleted_at is null and e.practiced_on >= coalesce(p_since, '-infinity'::date)
  ), '[]'::jsonb);
end;
$$;

-- Extra-Übungen eintragen und löschen darf nur der Eltern-Code.
create or replace function public.app_extra_add(p_token text, p_kid text, p_id uuid, p_day date, p_minutes integer, p_art text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._auth_eltern(p_token);
  if p_kid is null or p_kid not in ('kind1', 'kind2') then
    raise exception 'Unbekanntes Kind' using errcode = '22023';
  end if;
  insert into public.extra_practice (id, kid_id, practiced_on, minutes, art)
  values (p_id, p_kid, p_day, p_minutes, p_art)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.app_extra_delete(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._auth_eltern(p_token);
  update public.extra_practice set deleted_at = now() where id = p_id and deleted_at is null;
end;
$$;

-- Rechte: Hilfsfunktionen sind intern, die app_*-Funktionen darf die App aufrufen.
revoke all on function
  public._code_hash(text), public._auth(text), public._auth_kid(text, text), public._auth_eltern(text)
  from public, anon, authenticated;

revoke all on function
  public.app_check(text), public.app_eltern_check(text), public.app_ping(),
  public.app_attempt_add(text, text, text, text, text, integer, integer, jsonb, timestamptz),
  public.app_attempts_list(text, text, timestamptz),
  public.app_state_get(text, text), public.app_state_put(text, text, jsonb, integer),
  public.app_extra_list(text, text, date), public.app_extra_add(text, text, uuid, date, integer, text),
  public.app_extra_delete(text, uuid)
  from public;

grant execute on function
  public.app_check(text), public.app_eltern_check(text), public.app_ping(),
  public.app_attempt_add(text, text, text, text, text, integer, integer, jsonb, timestamptz),
  public.app_attempts_list(text, text, timestamptz),
  public.app_state_get(text, text), public.app_state_put(text, text, jsonb, integer),
  public.app_extra_list(text, text, date), public.app_extra_add(text, text, uuid, date, integer, text),
  public.app_extra_delete(text, uuid)
  to anon;
