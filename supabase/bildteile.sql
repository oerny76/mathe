-- Teil 5: Extra-Übungen können Bildteile des Wochenbilds freischalten und
-- dürfen auch ohne Minuten eingetragen werden (nur Bildteile). Im SQL-Editor
-- ausführen. Bestehende Einträge bleiben unverändert (keine Bildteile).

alter table public.extra_practice
  add column if not exists teile jsonb not null default '[]'::jsonb;

alter table public.extra_practice drop constraint if exists extra_practice_teile_check;
alter table public.extra_practice
  add constraint extra_practice_teile_check
  check (jsonb_typeof(teile) = 'array' and jsonb_array_length(teile) <= 8);

alter table public.extra_practice drop constraint if exists extra_practice_minutes_check;
alter table public.extra_practice
  add constraint extra_practice_minutes_check check (minutes between 0 and 180);

-- Ein Eintrag braucht Minuten oder mindestens einen Bildteil.
alter table public.extra_practice drop constraint if exists extra_practice_inhalt_check;
alter table public.extra_practice
  add constraint extra_practice_inhalt_check check (minutes > 0 or jsonb_array_length(teile) > 0);

-- Neue Signatur mit p_teile (Standard: keine). Ältere App-Versionen, die ohne
-- p_teile aufrufen, funktionieren weiter.
drop function if exists public.app_extra_add(text, text, uuid, date, integer, text);

create or replace function public.app_extra_add(
  p_token text, p_kid text, p_id uuid, p_day date, p_minutes integer, p_art text,
  p_teile jsonb default '[]'::jsonb
)
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
  if p_teile is null or jsonb_typeof(p_teile) <> 'array' then
    raise exception 'Bildteile ungueltig' using errcode = '22023';
  end if;
  insert into public.extra_practice (id, kid_id, practiced_on, minutes, art, teile)
  values (p_id, p_kid, p_day, p_minutes, p_art, p_teile)
  on conflict (id) do nothing;
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
      'minutes', e.minutes, 'art', e.art, 'teile', e.teile, 'created_at', e.created_at
    ) order by e.practiced_on, e.created_at)
    from public.extra_practice e
    where e.kid_id = p_kid and e.deleted_at is null and e.practiced_on >= coalesce(p_since, '-infinity'::date)
  ), '[]'::jsonb);
end;
$$;

revoke all on function
  public.app_extra_add(text, text, uuid, date, integer, text, jsonb),
  public.app_extra_list(text, text, date)
  from public, authenticated;
grant execute on function
  public.app_extra_add(text, text, uuid, date, integer, text, jsonb),
  public.app_extra_list(text, text, date)
  to anon;
