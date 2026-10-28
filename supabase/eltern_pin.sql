-- Teil 4: Kurzer Eltern-PIN (6 Ziffern) für die Eltern-Einstellungen und
-- "als richtig werten". Im SQL-Editor ausführen, danach den PIN setzen:
--
--   select public.eltern_pin_setzen('123456');   -- deinen eigenen PIN eintragen
--
-- Der PIN öffnet NUR die Eltern-Einstellungen (Extra-Übungen, Klassenstufe) und
-- das Werten einzelner Antworten. Er gibt keinen Zugriff auf Stände oder
-- Ergebnisse und ersetzt nicht den langen Eltern-Code der Eltern-Übersicht.
--
-- Schutz gegen Raten: Nach 5 falschen Eingaben ist der PIN 15 Minuten gesperrt
-- (für alle Geräte gemeinsam). Der lange Eltern-Code funktioniert in der Zeit
-- weiter. Ein richtiger PIN erzeugt eine Sitzung, die 8 Stunden gilt.
-- Den PIN kannst du jederzeit mit codes_anzeigen.sql nachsehen (Zeile "Eltern-PIN").

alter table public.access_tokens drop constraint if exists access_tokens_role_check;
alter table public.access_tokens drop constraint if exists access_tokens_check;
alter table public.access_tokens
  add constraint access_tokens_role_check check (role in ('kind', 'eltern', 'pin'));
alter table public.access_tokens
  add constraint access_tokens_check check (
    (role = 'kind' and kid_id is not null) or (role in ('eltern', 'pin') and kid_id is null)
  );

create table if not exists public.pin_versuche (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);

create table if not exists public.access_sessions (
  token_hash text primary key,
  expires_at timestamptz not null
);

create table if not exists public.access_codes_klartext (
  id uuid primary key references public.access_tokens (id) on delete cascade,
  code text not null
);

alter table public.pin_versuche enable row level security;
alter table public.access_sessions enable row level security;
alter table public.access_codes_klartext enable row level security;
revoke all on public.pin_versuche, public.access_sessions, public.access_codes_klartext from anon, authenticated;

-- Wer ist das? Nur Kinder- und Eltern-Codes zählen, weder der PIN noch eine
-- PIN-Sitzung ersetzen sie.
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
  where token_hash = public._code_hash(p_token) and revoked_at is null and role in ('kind', 'eltern');
  if t.id is null then
    raise exception 'Code ungueltig' using errcode = '28000';
  end if;
  return t;
end;
$$;

-- Eltern-Rechte (Extra-Übungen, Einstellungen): langer Eltern-Code oder eine
-- gültige PIN-Sitzung.
create or replace function public._auth_eltern(p_token text)
returns public.access_tokens
language plpgsql
stable
security definer
set search_path = ''
as $$
declare t public.access_tokens;
begin
  select * into t from public.access_tokens
  where token_hash = public._code_hash(p_token) and revoked_at is null and role = 'eltern';
  if t.id is not null then
    return t;
  end if;
  if exists (select 1 from public.access_sessions where token_hash = public._code_hash(p_token) and expires_at > now()) then
    t.role := 'eltern';
    return t;
  end if;
  raise exception 'Code ungueltig' using errcode = '28000';
end;
$$;

-- _auth_kid (Lesen von Ständen und Ergebnissen) bleibt bei Kinder- und
-- Eltern-Code: nutzt _auth, das PIN und PIN-Sitzungen nicht kennt.

create or replace function public.app_pin_login(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare fails integer; tok text;
begin
  select count(*) into fails from public.pin_versuche where at > now() - interval '15 minutes';
  if fails >= 5 then
    return jsonb_build_object('ok', false, 'gesperrt', true);
  end if;

  if exists (
    select 1 from public.access_tokens
    where role = 'pin' and revoked_at is null and token_hash = public._code_hash(p_pin)
  ) then
    tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.access_sessions (token_hash, expires_at)
    values (public._code_hash(tok), now() + interval '8 hours');
    delete from public.access_sessions where expires_at < now();
    delete from public.pin_versuche where at < now() - interval '1 day';
    return jsonb_build_object('ok', true, 'token', tok);
  end if;

  insert into public.pin_versuche default values;
  return jsonb_build_object('ok', false, 'gesperrt', fails + 1 >= 5);
end;
$$;

-- PIN setzen oder ändern: nur im SQL-Editor, nicht für die App.
create or replace function public.eltern_pin_setzen(p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare tid uuid;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'Der PIN muss aus genau 6 Ziffern bestehen.';
  end if;
  update public.access_tokens set revoked_at = now() where role = 'pin' and revoked_at is null;
  insert into public.access_tokens (role, kid_id, token_hash, label)
  values ('pin', null, public._code_hash(p_pin), 'Eltern-PIN')
  returning id into tid;
  insert into public.access_codes_klartext (id, code) values (tid, p_pin);
  delete from public.access_sessions;
  delete from public.pin_versuche;
  return 'PIN gesetzt.';
end;
$$;

revoke all on function public.app_pin_login(text), public.eltern_pin_setzen(text) from public, anon, authenticated;
grant execute on function public.app_pin_login(text) to anon;
